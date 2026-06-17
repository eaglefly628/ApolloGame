// live-combat.ts —— doc 18 核心博弈层 · 3D-2「live 遭遇解析器」（确定性逐拍战斗 sim）。
// 取代 MARCH-1 的 build 时批量 resolveArmy：兵沿三路 march → 前锋接触成前线 → 每 ENC_PERIOD 拍对决
// （decideFaceUp 读**当下** favor）→ 清空敌路的幸存者突破、march 到敌老家逐个 chip home_hp → 先破者胜。
//
// outcome-first 三本质（doc 18 §三）原样保留：① 生死由确定性规则 decideFaceUp 定（非物理）；② 表现单向不回灌
// （本模块纯逻辑、不碰渲染）；③ 可复现：单一 seeded PRNG，遭遇按 lane 序消费 → 同 seed + 同投放指令流 逐拍 hash 稳。
// favor 在遭遇拍读（含此前所有投放/干预）→ 中途干预自然只影响未遭遇牌（前向单遍、不破 hash，同 12 §五.5）。
// 纯 game-side 解释器（manifesto §2 固定解释器那部分），零新引擎能力；复用 decideFaceUp + seeded PRNG。
import { decideFaceUp } from './blueprint.js';
import type { RandomSeed } from '@engine/protocol/components.js';

// ── 调参（初版锚点，doc 18 §八；真机调入 14）──
export const LANE_LEN = 100;   // 路长：己家 0 ↔ 敌家 100
export const MARCH_STEP = 2;   // 每拍单侧推进（双侧 → gap 每拍 −2·STEP）
export const CONTACT = 6;      // 前锋距 ≤ 此 = 接触（成前线）
export const ENC_PERIOD = 6;   // 每多少拍一次对决（成波、可读、给决策窗）
export const CLASH_CAP = 6;    // 双方连续都活的对决上限 → 到顶低 favor 者让位（确定性收敛、有界）
export const TRAVEL = 14;      // 突破后 march 到敌老家的基准拍
const MORALE = 8, ROUT = 14;   // 主将在场→本路下属士气 / 主将阵亡→溃散（doc 06）
const clampFavor = (f: number): number => Math.max(5, Math.min(95, Math.round(f)));

export interface LiveUnit { id: string; rank: string; suit: string; favor: number; general: boolean; dead: boolean }
export interface LiveLane { a: LiveUnit[]; b: LiveUnit[]; gap: number; clash: number; aGenDead: boolean; bGenDead: boolean; pendA: number[]; pendB: number[] }
export interface LiveBattle { tick: number; lanes: [LiveLane, LiveLane, LiveLane]; homeA: number; homeB: number; homeMax: number; winner: 'a' | 'b' | 'draw' | 'pending'; rng: RandomSeed }
// 投放指令：第 tick 拍把 unit 投进 lane 的 side 侧（确定性输入流；预布阵 = tick 0 投放）。
export interface DeployCmd { tick: number; side: 'a' | 'b'; lane: number; unit: Omit<LiveUnit, 'dead'> }

const mkLane = (): LiveLane => ({ a: [], b: [], gap: LANE_LEN, clash: 0, aGenDead: false, bGenDead: false, pendA: [], pendB: [] });
export function initLiveBattle(seed: number, homeMax: number): LiveBattle {
  return { tick: 0, lanes: [mkLane(), mkLane(), mkLane()], homeA: homeMax, homeB: homeMax, homeMax, winner: 'pending', rng: { type: 'RandomSeed', seed, sequence: 0 } };
}

function applyDeploy(b: LiveBattle, c: DeployCmd): void {
  const L = b.lanes[c.lane];
  (c.side === 'a' ? L.a : L.b).push({ ...c.unit, dead: false }); // 队尾入列（front=index0=先投者）
}

// 遭遇拍的有效 favor：主将本身用基础；下属吃本路本侧士气（主将在 +MORALE / 主将亡 −ROUT）。读当下 → live。
function effFavor(u: LiveUnit, lane: LiveLane, side: 'a' | 'b'): number {
  if (u.general) return clampFavor(u.favor);
  const genDead = side === 'a' ? lane.aGenDead : lane.bGenDead;
  const genHere = (side === 'a' ? lane.a : lane.b).some((x) => x.general && !x.dead);
  const shift = genDead ? -ROUT : genHere ? MORALE : 0;
  return clampFavor(u.favor + shift);
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
    // 接触：每 ENC_PERIOD 拍一次对决。
    if (b.tick % ENC_PERIOD !== 0) return;
    const aF = lane.a[0], bF = lane.b[0];
    const aAlive = decideFaceUp(effFavor(aF, lane, 'a'), b.rng); // RNG 先 A 后 B、lane 0→1→2 序 → 确定
    const bAlive = decideFaceUp(effFavor(bF, lane, 'b'), b.rng);
    if (!aAlive && !bAlive) { killFront(lane, 'a'); killFront(lane, 'b'); lane.clash = 0; }
    else if (!aAlive) { killFront(lane, 'a'); lane.clash = 0; }
    else if (!bAlive) { killFront(lane, 'b'); lane.clash = 0; }
    else { // 双活：再战；到顶低 favor 让位（有界确定）
      lane.clash += 1;
      if (lane.clash >= CLASH_CAP) { (effFavor(aF, lane, 'a') < effFavor(bF, lane, 'b') ? killFront(lane, 'a') : killFront(lane, 'b')); lane.clash = 0; }
    }
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
  const lane = (l: LiveLane): string => `${l.a.length},${l.b.length},${l.gap},${l.clash},${l.aGenDead ? 1 : 0}${l.bGenDead ? 1 : 0},${l.pendA.length},${l.pendB.length}`;
  return `t${b.tick}|hA${b.homeA}|hB${b.homeB}|w${b.winner}|s${b.rng.sequence}|${b.lanes.map(lane).join('|')}`;
}
