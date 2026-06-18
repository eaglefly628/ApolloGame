// live-combat.ts —— doc 18 核心博弈层 · 3D-2「live 遭遇解析器」（确定性逐拍战斗 sim）。
// 取代 MARCH-1 的 build 时批量 resolveArmy：兵沿三路 march → 前锋接触成前线 → 每 ENC_PERIOD 拍对决
// （decideFaceUp 读**当下** favor）→ 清空敌路的幸存者突破、march 到敌老家逐个 chip home_hp → 先破者胜。
//
// outcome-first 三本质（doc 18 §三）原样保留：① 生死由确定性规则 decideFaceUp 定（非物理）；② 表现单向不回灌
// （本模块纯逻辑、不碰渲染）；③ 可复现：单一 seeded PRNG，遭遇按 lane 序消费 → 同 seed + 同投放指令流 逐拍 hash 稳。
// favor 在遭遇拍读（含此前所有投放/干预）→ 中途干预自然只影响未遭遇牌（前向单遍、不破 hash，同 12 §五.5）。
// 纯 game-side 解释器（manifesto §2 固定解释器那部分），零新引擎能力；复用 decideFaceUp + seeded PRNG。
import { clashResolve, pEff, cardPoints } from './clash-resolve.js';
import type { RandomSeed } from '@engine/protocol/components.js';

// ── 调参（初版锚点，doc 18 §八 / doc 19；真机 + 仿真台调入 14）──
export const LANE_LEN = 100;   // 路长：己家 0 ↔ 敌家 100
export const MARCH_STEP = 2;   // 每拍单侧推进（双侧 → gap 每拍 −2·STEP）
export const CONTACT = 6;      // 前锋距 ≤ 此 = 接触（成前线）
export const ENC_PERIOD = 6;   // 每多少拍一次对决（成波、可读、给决策窗）
export const TRAVEL = 14;      // 突破后 march 到敌老家的基准拍
const MORALE_PTS = 2, ROUT_PTS = 4; // 主将在→下属 +战力 / 主将亡→溃散 −战力（点数空间·bounded，doc 06）
export const HOME_BLOOD = 3;        // 大本营 3 滴血（doc19 §六，替 home_hp 8；防无限拖、保节奏）
// 续航（doc19 §五）：每张牌能赢几场对决就得回家歇 → 战线靠接力前压、神牌也不能包打 → 逼牌组轮转。
//   数字牌 1 场 / 人头牌(A·J·Q·K) 2 场 / 小丑 3 场（初值，仿真台调）。
export function cardStamina(rank: string): number {
  if (rank === 'JOKER' || rank === '★' || rank === '王') return 3;
  if (rank === 'A' || rank === 'K' || rank === 'Q' || rank === 'J') return 2;
  return 1;
}

export interface LiveUnit { id: string; rank: string; suit: string; points: number; buff: number; general: boolean; dead: boolean; stamina: number; staminaLeft: number }
export interface LiveLane { a: LiveUnit[]; b: LiveUnit[]; gap: number; clash: number; aGenDead: boolean; bGenDead: boolean; pendA: number[]; pendB: number[]; spentA: number; spentB: number }
export interface LiveBattle { tick: number; lanes: [LiveLane, LiveLane, LiveLane]; homeA: number; homeB: number; homeMax: number; winner: 'a' | 'b' | 'draw' | 'pending'; rng: RandomSeed }
// 投放指令：第 tick 拍把 unit 投进 lane 的 side 侧（确定性输入流；预布阵 = tick 1 投放）。
// 点数=公平骨架（cardPoints 由 rank 算，双方同副）；buff=经营（小丑/附魔/协同/路…聚合，缺省 0）。
export interface DeployCmd { tick: number; side: 'a' | 'b'; lane: number; unit: { id: string; rank: string; suit: string; general: boolean; buff?: number } }

const mkLane = (): LiveLane => ({ a: [], b: [], gap: LANE_LEN, clash: 0, aGenDead: false, bGenDead: false, pendA: [], pendB: [], spentA: 0, spentB: 0 });
export function initLiveBattle(seed: number, homeMax: number = HOME_BLOOD): LiveBattle {
  return { tick: 0, lanes: [mkLane(), mkLane(), mkLane()], homeA: homeMax, homeB: homeMax, homeMax, winner: 'pending', rng: { type: 'RandomSeed', seed, sequence: 0 } };
}

function applyDeploy(b: LiveBattle, c: DeployCmd): void {
  const L = b.lanes[c.lane];
  const stam = cardStamina(c.unit.rank);
  const u: LiveUnit = { id: c.unit.id, rank: c.unit.rank, suit: c.unit.suit, points: cardPoints(c.unit.rank), buff: c.unit.buff ?? 0, general: c.unit.general, dead: false, stamina: stam, staminaLeft: stam };
  (c.side === 'a' ? L.a : L.b).push(u); // 队尾入列（front=index0=先投者）
}

// 遭遇拍的有效战力 P_eff（doc19 §三）：基础点数 + 经营 buff + 本路士气（主将在 +MORALE_PTS / 亡 −ROUT_PTS）。读当下 → live。
function effPower(u: LiveUnit, lane: LiveLane, side: 'a' | 'b'): number {
  if (u.general) return pEff(u.points, u.buff);
  const genDead = side === 'a' ? lane.aGenDead : lane.bGenDead;
  const genHere = (side === 'a' ? lane.a : lane.b).some((x) => x.general && !x.dead);
  const shift = genDead ? -ROUT_PTS : genHere ? MORALE_PTS : 0;
  return pEff(u.points, u.buff + shift);
}

function killFront(lane: LiveLane, side: 'a' | 'b'): void {
  const q = side === 'a' ? lane.a : lane.b;
  const u = q.shift();
  if (u) { u.dead = true; if (u.general) { if (side === 'a') lane.aGenDead = true; else lane.bGenDead = true; } }
}

// 一路推进一拍：march → 接触 → 对决（成波）→ 一侧清空则另侧幸存者突破入 pend。
function stepLane(b: LiveBattle, li: number): void {
  const lane = b.lanes[li];
  const hasA = lane.a.length > 0, hasB = lane.b.length > 0;
  if (hasA && hasB) {
    if (lane.gap > CONTACT) { lane.gap -= 2 * MARCH_STEP; return; } // 行军靠拢（决策窗）
    // 接触：每 ENC_PERIOD 拍一次对决（成波）。doc19 §三 pairwise：P_eff 聚合 → logistic 胜率 → 种子骰 → 单一胜负。
    if (b.tick % ENC_PERIOD !== 0) return;
    const aWins = clashResolve(effPower(lane.a[0], lane, 'a'), effPower(lane.b[0], lane, 'b'), b.rng);
    killFront(lane, aWins ? 'b' : 'a'); // 输家翻反·阵亡 → 本局弃堆
    // 赢家翻正·前进，但续航 −1；续航尽 → 退场（沉牌底 + deploy 冷却，3D-1 再部署轮转）→ 战线接力、神牌不包打。
    const wq = aWins ? lane.a : lane.b;
    const wf = wq[0];
    if (wf) { wf.staminaLeft -= 1; if (wf.staminaLeft <= 0) { wq.shift(); if (aWins) lane.spentA += 1; else lane.spentB += 1; } }
    lane.clash = 0;
  } else if (hasA && !hasB) { // B 路清空 → A 幸存者突破，march 到敌(B)老家
    lane.a.forEach((_, i) => lane.pendA.push(b.tick + TRAVEL + i * 2));
    lane.a = [];
  } else if (hasB && !hasA) {
    lane.b.forEach((_, i) => lane.pendB.push(b.tick + TRAVEL + i * 2));
    lane.b = [];
  }
}

// 推进整局一拍：投放 → 三路 step → 突破到家 chip home → 判胜负。
export function stepLiveBattle(b: LiveBattle, deploys: DeployCmd[] = []): void {
  if (b.winner !== 'pending') return;
  b.tick += 1;
  for (const c of deploys) if (c.tick === b.tick) applyDeploy(b, c);
  for (const li of [0, 1, 2]) stepLane(b, li);
  // 突破到敌老家 → chip（pendA 攻 B 家、pendB 攻 A 家）。
  for (const lane of b.lanes) {
    lane.pendA = lane.pendA.filter((eta) => { if (eta <= b.tick) { b.homeB = Math.max(0, b.homeB - 1); return false; } return true; });
    lane.pendB = lane.pendB.filter((eta) => { if (eta <= b.tick) { b.homeA = Math.max(0, b.homeA - 1); return false; } return true; });
  }
  if (b.homeB <= 0 && b.homeA <= 0) b.winner = 'draw';
  else if (b.homeB <= 0) b.winner = 'a';
  else if (b.homeA <= 0) b.winner = 'b';
}

// 战局是否还有未决（用于跑到底）：有牌在路、在前线、或在途。
export function liveActive(b: LiveBattle): boolean {
  if (b.winner !== 'pending') return false;
  return b.lanes.some((l) => l.a.length || l.b.length || l.pendA.length || l.pendB.length);
}

// 跑到分胜负或 maxTicks（无人破家但都打完 → 比 home 残血定，平则 draw）。
export function runLiveBattle(b: LiveBattle, deploys: DeployCmd[] = [], maxTicks = 4000): void {
  while (b.winner === 'pending' && b.tick < maxTicks && (liveActive(b) || deploys.some((c) => c.tick > b.tick))) stepLiveBattle(b, deploys);
  if (b.winner === 'pending') b.winner = b.homeB < b.homeA ? 'a' : b.homeA < b.homeB ? 'b' : 'draw'; // 都打完无人破 → 残血少(被攻多)者负
}

// 确定性状态指纹（逐拍对比；不含渲染）。
export function liveHash(b: LiveBattle): string {
  const lane = (l: LiveLane): string => `${l.a.length},${l.b.length},${l.gap},${l.clash},${l.aGenDead ? 1 : 0}${l.bGenDead ? 1 : 0},${l.pendA.length},${l.pendB.length},${l.spentA},${l.spentB}`;
  return `t${b.tick}|hA${b.homeA}|hB${b.homeB}|w${b.winner}|s${b.rng.sequence}|${b.lanes.map(lane).join('|')}`;
}
