// live-combat.ts —— doc 17/18/19 核心：确定性逐拍 live 战斗 sim。
// owner 模型(钉死)：**一张牌一张牌、一格格慢慢往前爬**（不是一堆牌刷过去，doc18 §一 L14）——
//   基础布局预铺 → 牌从己家 pos 沿路每拍 +MARCH_STEP 往敌家爬（保队形间距）→ **最前两张相邻才对决**
//   （doc19 §三 pairwise logistic 定生死）→ 赢家前进·续航−1(尽则退场沉底)、输家弃堆 → 突破到敌大本营 −1 血(3 血)先破者胜。
// outcome-first：单一 seeded PRNG 按 lane 序消费、逐拍 hash 稳；favor/buff 遭遇拍读 → 中途投放/干预只影响未遭遇牌。
// 纯 game-side 解释器、零引擎；复用 clash-resolve（decideFaceUp 升级为 pairwise）+ seeded PRNG。
import { winrate, pEff, cardPoints } from './clash-resolve.js';
import { nextRandom } from '@atom-skills/index.js';
import type { RandomSeed } from '@engine/protocol/components.js';

// ── 调参（初版锚点，doc 18 §八 / 19；真机 + 仿真台调入 14）──
export const LANE_LEN = 100;   // 路长：A 家 pos 0 ↔ B 家 pos LANE_LEN
export const MARCH_STEP = 2;   // 每拍每张牌往敌家爬几格（慢 = 决策窗，doc18 §一/19 §二 一格格）
export const SPACING = 5;      // 同侧相邻牌最小间距（保队形、不重叠、一张张排着走）
export const ENC_PERIOD = 6;   // 最前两张相邻后每多少拍一次对决（成波·可读·给决策窗）
export const HOME_BLOOD = 3;   // 大本营 3 滴血（doc19 §六，替 home_hp 8；防无限拖、保节奏）
const MORALE_PTS = 2, ROUT_PTS = 4; // 主将在→下属 +战力 / 主将亡→溃散 −战力（点数空间·bounded，doc 06）
// 续航（doc19 §五）：数字 1 / 人头(A·J·Q·K) 2 / 小丑 3 场 → 神牌也得回家歇、逼牌组轮转。
export function cardStamina(rank: string): number {
  if (rank === 'JOKER' || rank === '★' || rank === '王') return 3;
  if (rank === 'A' || rank === 'K' || rank === 'Q' || rank === 'J') return 2;
  return 1;
}

export interface LiveUnit { id: string; rank: string; suit: string; points: number; buff: number; general: boolean; dead: boolean; stamina: number; staminaLeft: number; pos: number }
export interface LiveLane { a: LiveUnit[]; b: LiveUnit[]; aGenDead: boolean; bGenDead: boolean; spentA: number; spentB: number; encT: number }
// 对决事件（doc19 §三「胜率可读」+ 命运一掷 · 给战斗表演特写读数）：双方点数/经营加成/有效战力 P_eff、胜率、所掷点 roll、谁胜。
// 纯记录（不进 liveHash、不改判定）：roll = clash 那一掷的 nextRandom 值，aWins = roll < winrate ——把"算出概率→掷→落在区间定生死"如实暴露。
export interface ClashCard { rank: string; suit: string; general: boolean; points: number; buff: number; morale: number; pEff: number }
export interface ClashEvent { tick: number; lane: number; winrate: number; roll: number; aWins: boolean; a: ClashCard; b: ClashCard }
export interface LiveBattle { tick: number; lanes: [LiveLane, LiveLane, LiveLane]; homeA: number; homeB: number; homeMax: number; winner: 'a' | 'b' | 'draw' | 'pending'; rng: RandomSeed; lastClash: ClashEvent | null; clashSeq: number; clashLog: ClashEvent[] }
// 投放指令：第 tick 拍把 unit 投进 lane 的 side 侧（确定性输入流；预布阵 = tick 1 投放）。
// 点数=公平骨架（cardPoints 由 rank 算·双方同副）；buff=经营（小丑/附魔/协同/路…聚合，缺省 0）。
export interface DeployCmd { tick: number; side: 'a' | 'b'; lane: number; unit: { id: string; rank: string; suit: string; general: boolean; buff?: number } }

const mkLane = (): LiveLane => ({ a: [], b: [], aGenDead: false, bGenDead: false, spentA: 0, spentB: 0, encT: 0 });
export function initLiveBattle(seed: number, homeMax: number = HOME_BLOOD): LiveBattle {
  return { tick: 0, lanes: [mkLane(), mkLane(), mkLane()], homeA: homeMax, homeB: homeMax, homeMax, winner: 'pending', rng: { type: 'RandomSeed', seed, sequence: 0 }, lastClash: null, clashSeq: 0, clashLog: [] };
}

function applyDeploy(b: LiveBattle, c: DeployCmd): void {
  const L = b.lanes[c.lane];
  const q = c.side === 'a' ? L.a : L.b;
  const stam = cardStamina(c.unit.rank);
  // 入场位 = 己家边 + 已有同侧牌往后错开间距（一张张排队 staging，front=index0=先投者在最前）。
  const pos = c.side === 'a' ? -q.length * SPACING : LANE_LEN + q.length * SPACING;
  q.push({ id: c.unit.id, rank: c.unit.rank, suit: c.unit.suit, points: cardPoints(c.unit.rank), buff: c.unit.buff ?? 0, general: c.unit.general, dead: false, stamina: stam, staminaLeft: stam, pos });
}

// 遭遇拍的有效战力 P_eff（doc19 §三）：基础点数 + 经营 buff + 本路士气（主将在 +MORALE_PTS / 亡 −ROUT_PTS）。读当下 → live。
// 返回拆解（供对决特写「主 Buff 明细」）：pEff 终值 + shift（士气/溃散分量）。经营 buff = u.buff（养成/干预聚合）。
function effPowerBreak(u: LiveUnit, lane: LiveLane, side: 'a' | 'b'): { pEff: number; shift: number } {
  if (u.general) return { pEff: pEff(u.points, u.buff), shift: 0 }; // 主将自身=士气源、不再吃士气分量
  const genDead = side === 'a' ? lane.aGenDead : lane.bGenDead;
  const genHere = (side === 'a' ? lane.a : lane.b).some((x) => x.general && !x.dead);
  const shift = genDead ? -ROUT_PTS : genHere ? MORALE_PTS : 0;
  return { pEff: pEff(u.points, u.buff + shift), shift };
}

function killFront(lane: LiveLane, side: 'a' | 'b'): void {
  const q = side === 'a' ? lane.a : lane.b;
  const u = q.shift();
  if (u) { u.dead = true; if (u.general) { if (side === 'a') lane.aGenDead = true; else lane.bGenDead = true; } }
}

// 一张张往敌家爬一拍：front(index0) 受 frontLimit 卡停（贴敌前锋/抵敌家），其余受前一张间距 SPACING 卡停（排队）。
function marchSide(q: LiveUnit[], dir: 1 | -1, frontLimit: number | null): void {
  for (let i = 0; i < q.length; i++) {
    let t = q[i].pos + dir * MARCH_STEP;
    if (i > 0) { const ahead = q[i - 1].pos; t = dir > 0 ? Math.min(t, ahead - SPACING) : Math.max(t, ahead + SPACING); } // 别撞上前一张
    else if (frontLimit !== null) t = dir > 0 ? Math.min(t, frontLimit) : Math.max(t, frontLimit); // 前锋：贴线/抵家停
    q[i].pos = dir > 0 ? Math.min(t, LANE_LEN) : Math.max(t, 0);
  }
}

// 一路推进一拍：未相邻→一格格爬；最前两张相邻→成波对决；一侧清空→另侧一张张爬向敌家、抵家 chip。
function stepLane(b: LiveBattle, li: number): void {
  const lane = b.lanes[li];
  const A = lane.a, B = lane.b;
  if (A.length && B.length) {
    const fa = A[0], fb = B[0];
    if (fa.pos + 1 < fb.pos) { marchSide(A, 1, fb.pos - 1); marchSide(B, -1, fa.pos + 1); lane.encT = 0; return; } // 还没碰面 → 慢慢爬
    lane.encT += 1; // 相邻 → 成波对决（每 ENC_PERIOD 一掷）
    if (lane.encT % ENC_PERIOD !== 0) return;
    // doc19 §三 pairwise logistic：算 P_eff → 胜率 → 掷一点 roll 落在区间定生死。内联 clashResolve 同序消费 rng（hash 不变），且暴露 roll/明细供特写。
    const ba = effPowerBreak(fa, lane, 'a'), bb = effPowerBreak(fb, lane, 'b');
    const ea = ba.pEff, eb = bb.pEff;
    const wr = winrate(ea, eb);
    const roll = nextRandom(b.rng);
    const aWins = roll < wr;
    const ev: ClashEvent = { tick: b.tick, lane: li, winrate: wr, roll, aWins, a: { rank: fa.rank, suit: fa.suit, general: fa.general, points: fa.points, buff: fa.buff, morale: ba.shift, pEff: ea }, b: { rank: fb.rank, suit: fb.suit, general: fb.general, points: fb.points, buff: fb.buff, morale: bb.shift, pEff: eb } };
    b.lastClash = ev; b.clashSeq += 1; b.clashLog.push(ev);
    killFront(lane, aWins ? 'b' : 'a'); // 输家翻反·阵亡 → 本局弃堆
    const wq = aWins ? A : B; const wf = wq[0]; // 赢家翻正·前进，续航 −1；尽则退场（沉牌底·3D-1 再部署轮转）
    if (wf) { wf.staminaLeft -= 1; if (wf.staminaLeft <= 0) { wq.shift(); if (aWins) lane.spentA += 1; else lane.spentB += 1; } }
  } else if (A.length) { // B 清空 → A 一张张爬向 B 家、抵家 −1 血
    marchSide(A, 1, null);
    for (let i = A.length - 1; i >= 0; i--) if (A[i].pos >= LANE_LEN) { A.splice(i, 1); b.homeB = Math.max(0, b.homeB - 1); }
  } else if (B.length) {
    marchSide(B, -1, null);
    for (let i = B.length - 1; i >= 0; i--) if (B[i].pos <= 0) { B.splice(i, 1); b.homeA = Math.max(0, b.homeA - 1); }
  }
}

// 推进整局一拍：投放 → 三路 step（爬/对决/突破到家 chip）→ 判胜负。
export function stepLiveBattle(b: LiveBattle, deploys: DeployCmd[] = []): void {
  if (b.winner !== 'pending') return;
  b.tick += 1;
  for (const c of deploys) if (c.tick === b.tick) applyDeploy(b, c);
  for (const li of [0, 1, 2]) stepLane(b, li);
  if (b.homeB <= 0 && b.homeA <= 0) b.winner = 'draw';
  else if (b.homeB <= 0) b.winner = 'a';
  else if (b.homeA <= 0) b.winner = 'b';
}

// 战局是否还有未决（用于跑到底）：任一路还有牌。
export function liveActive(b: LiveBattle): boolean {
  if (b.winner !== 'pending') return false;
  return b.lanes.some((l) => l.a.length || l.b.length);
}

// 跑到分胜负或 maxTicks（无人破家但都打完 → 比残血定，平则 draw）。
export function runLiveBattle(b: LiveBattle, deploys: DeployCmd[] = [], maxTicks = 6000): void {
  while (b.winner === 'pending' && b.tick < maxTicks && (liveActive(b) || deploys.some((c) => c.tick > b.tick))) stepLiveBattle(b, deploys);
  if (b.winner === 'pending') b.winner = b.homeB < b.homeA ? 'a' : b.homeA < b.homeB ? 'b' : 'draw';
}

// 确定性状态指纹（逐拍对比；含最前两张位置·队长·续航退场·老家血·rng 序）。
export function liveHash(b: LiveBattle): string {
  const lane = (l: LiveLane): string => `${l.a.length}@${l.a[0]?.pos ?? '_'},${l.b.length}@${l.b[0]?.pos ?? '_'},${l.aGenDead ? 1 : 0}${l.bGenDead ? 1 : 0},${l.spentA},${l.spentB},${l.encT}`;
  return `t${b.tick}|hA${b.homeA}|hB${b.homeB}|w${b.winner}|s${b.rng.sequence}|${b.lanes.map(lane).join('|')}`;
}
