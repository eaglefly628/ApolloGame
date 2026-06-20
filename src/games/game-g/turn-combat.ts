// turn-combat.ts —— doc24 单机回合制战斗模型（owner 2026-06-19 大转向 · 取代 doc21 实时 CR）。
// A0 头号任务：把"驱动层"从 实时(live-combat rAF 连续行军 + 圣水时间 regen + 读秒暂停) 换成 **回合制状态机**。
// 原封保留并复用：掷命对决核(clash-resolve) · 三路 · 3 血大本营 · 公平骨架(cardPoints) · 天罡 apply(TengangFx) · 续航(cardStamina)。只换驱动。
//
// 棋盘(doc24 §一)：每路一条 **9 格 slot 轨** —— 我方区 slot 0..3 · 中线 4 · 敌方区 5..8。我兵向 8(敌家)推、敌兵向 0(我家)推；先破敌 3 血大本营胜。
// 回合(doc24 §二)：① 回合开始 +1 圣水 → ② 选「一类」互斥动作(抽/放[+机关]/打天罡/弃·同类无限) → ③ 结束→**推进一格**→相邻遭遇→掷命(doc19 原封)。
// 确定性：单一 seeded PRNG（同 live-combat·掷命点同序消费）；同输入流 → 同 turnHash、可回放、可喂仿真台。纯 game-side、零引擎。
//
// ⚠️ logic 先行·UI 待 Cloud Design 稿(doc24 §九)：本模块不碰 live-combat / showMatch / battle-screen（实时路保持可跑），待新战斗屏落地再切换、退役实时核。
import { winrate, pEff, cardPoints, CLASH_K } from './clash-resolve.js';
import { nextRandom } from '@atom-skills/index.js';
import type { RandomSeed } from '@engine/protocol/components.js';
import { cardStamina, NO_TENGANG, type TengangFx, type ClashEvent } from './live-combat.js';

// ── 棋盘几何（doc24 §一）──
export const SLOTS = 9;          // 每路格数：我方 0..3 / 中线 4 / 敌方 5..8
export const A_DEPLOY_SLOT = 3;  // §七 建议：我方部署入"最后格"(我区最前·贴中线)
export const B_DEPLOY_SLOT = 5;  // 敌方对称
export const A_GOAL = 8;         // 我兵越过此格(→9) → 敌大本营 −1 血
export const B_GOAL = 0;         // 敌兵越过此格(→−1) → 我大本营 −1 血
// ── 回合经济（doc24 §四·真机调；各 cost 暂定 1）──
export const TURN_HOME_BLOOD = 3;
export const MANA_START = 1, MANA_PER_TURN = 1;
export const DRAW_COST = 1, DEPLOY_COST = 1, CAST_COST = 1; // 抽/放/打天罡 花圣水；弃免费
export const OPENING_HAND = 3; // 起手摸 N（doc24 §六/七 待定）
const MORALE_PTS = 2, ROUT_PTS = 4; // 同 live-combat/doc06：主将在→下属 +战力 / 主将亡→溃散 −战力

// ── 捷径门（owner 2026-06-20 定向·doc21/24 跨路调度·8 门：我方 4 + 敌方对称镜像 4）──
// 门开 → 源格(fromLane,fromSlot)的己兵可过门到目标格(toLane,toSlot)·增援/堵敌。第N格 = slot index N-1。
// 我方(side a)：上[1]→中[2] · 下[1]→中[2] · 中[3]→上[4] · 中[3]→下[4]
// 敌方(side b·镜像 8-s)：上[7]→中[6] · 下[7]→中[6] · 中[5]→上[4] · 中[5]→下[4]
export interface Gate { side: 'a' | 'b'; fromLane: number; fromSlot: number; toLane: number; toSlot: number }
export const GATES: readonly Gate[] = [
  { side: 'a', fromLane: 0, fromSlot: 1, toLane: 1, toSlot: 2 },
  { side: 'a', fromLane: 2, fromSlot: 1, toLane: 1, toSlot: 2 },
  { side: 'a', fromLane: 1, fromSlot: 3, toLane: 0, toSlot: 4 },
  { side: 'a', fromLane: 1, fromSlot: 3, toLane: 2, toSlot: 4 },
  { side: 'b', fromLane: 0, fromSlot: 7, toLane: 1, toSlot: 6 },
  { side: 'b', fromLane: 2, fromSlot: 7, toLane: 1, toSlot: 6 },
  { side: 'b', fromLane: 1, fromSlot: 5, toLane: 0, toSlot: 4 },
  { side: 'b', fromLane: 1, fromSlot: 5, toLane: 2, toSlot: 4 },
];

// 场上兵：占一格 slot；续航 staminaLeft 打光退场（同 live-combat 经济）。
export interface TurnUnit { id: string; rank: string; suit: string; points: number; buff: number; general: boolean; stamina: number; staminaLeft: number; slot: number }
// 一路：双方兵列（own[0] = 前锋·最贴敌）+ 捷径门开关 + 主将阵亡/续航退场记账。
export interface TurnLane { a: TurnUnit[]; b: TurnUnit[]; aGenDead: boolean; bGenDead: boolean; spentA: number; spentB: number }
// 手牌/牌库卡：扑克兵(上场) / 天罡(施法·id)。
export interface PokerCard { kind: 'poker'; id: string; rank: string; suit: string; general: boolean; buff: number }
export interface TengangHandCard { kind: 'tengang'; id: string }
export type Card = PokerCard | TengangHandCard;
// 一方运行态：圣水 / 手牌 / 两库 / 已施天罡集 + 其聚合修正。
export interface TurnSide { mana: number; hand: Card[]; pokerDeck: PokerCard[]; tengangDeck: TengangHandCard[]; castIds: string[]; tengangA: TengangFx }
export type ActionKind = 'draw' | 'deploy' | 'cast' | 'discard';
// 整局态。active = 当前回合方；actionTaken = 本回合已锁定的互斥动作类别(同类无限·null=未选)。
export interface TurnBattle {
  turn: number; active: 'a' | 'b';
  lanes: [TurnLane, TurnLane, TurnLane];
  gatesOpen: boolean[]; // 8 道捷径门开/关（index 同 GATES）
  homeA: number; homeB: number; homeMax: number;
  a: TurnSide; b: TurnSide;
  rng: RandomSeed; winner: 'a' | 'b' | 'draw' | 'pending';
  actionTaken: ActionKind | null;
  lastClash: ClashEvent | null; clashLog: ClashEvent[]; clashSeq: number; // clashLog：逐场掷命流水（驱动层抽特写·不进 hash）
}

const mkLane = (): TurnLane => ({ a: [], b: [], aGenDead: false, bGenDead: false, spentA: 0, spentB: 0 });
const mkSide = (pokerDeck: PokerCard[] = [], tengangDeck: TengangHandCard[] = []): TurnSide =>
  ({ mana: MANA_START, hand: [], pokerDeck: [...pokerDeck], tengangDeck: [...tengangDeck], castIds: [], tengangA: NO_TENGANG });

export interface TurnInit { seed: number; homeMax?: number; a?: { pokerDeck?: PokerCard[]; tengangDeck?: TengangHandCard[] }; b?: { pokerDeck?: PokerCard[]; tengangDeck?: TengangHandCard[] } }
/** 开战 init（doc24 §七）：三路 ×9 空轨；双方大本营 3 hp；圣水=起步；A 先手。牌库由 caller（game-g/save）喂；起手摸由 caller 调 drawCard。 */
export function initTurnBattle(cfg: TurnInit): TurnBattle {
  const homeMax = cfg.homeMax ?? TURN_HOME_BLOOD;
  const battle: TurnBattle = {
    turn: 1, active: 'a',
    lanes: [mkLane(), mkLane(), mkLane()],
    gatesOpen: GATES.map(() => false), // 默认全闭 ✕(owner 2026-06-20 拍板)：放牌时点门钮翻成 ◉ 通路 / AI 亦可翻；开门才在推进时分流
    homeA: homeMax, homeB: homeMax, homeMax,
    a: mkSide(cfg.a?.pokerDeck, cfg.a?.tengangDeck),
    b: mkSide(cfg.b?.pokerDeck, cfg.b?.tengangDeck),
    rng: { type: 'RandomSeed', seed: cfg.seed, sequence: 0 },
    winner: 'pending', actionTaken: null, lastClash: null, clashLog: [], clashSeq: 0,
  };
  battle.b.mana = 0; // 后手方圣水在其回合开始才 +1（每回合 +1 对称·turn-1 的 +1 已含在先手起步值里）
  return battle;
}

const sideOf = (b: TurnBattle, s: 'a' | 'b'): TurnSide => (s === 'a' ? b.a : b.b);
const colOf = (lane: TurnLane, s: 'a' | 'b'): TurnUnit[] => (s === 'a' ? lane.a : lane.b);
const isFaceRank = (r: string): boolean => r === 'A' || r === 'K' || r === 'Q' || r === 'J';

// 能否选这类动作：未锁(null)随便选；已锁则只能同类（弃牌免费·不消耗 mana）。
function canAct(b: TurnBattle, side: 'a' | 'b', kind: ActionKind, cost: number): boolean {
  if (b.winner !== 'pending' || b.active !== side) return false;
  if (b.actionTaken !== null && b.actionTaken !== kind) return false; // 互斥：本回合只能一类
  return sideOf(b, side).mana >= cost;
}

// ① 抽牌：从 poker / tengang 库顶摸一张进手牌，花圣水（互斥·同类无限）。返回是否成功。
export function drawCard(b: TurnBattle, side: 'a' | 'b', from: 'poker' | 'tengang'): boolean {
  if (!canAct(b, side, 'draw', DRAW_COST)) return false;
  const sd = sideOf(b, side);
  const card: Card | undefined = from === 'poker' ? sd.pokerDeck.shift() : sd.tengangDeck.shift();
  if (!card) return false;
  sd.mana -= DRAW_COST; sd.hand.push(card); b.actionTaken = 'draw';
  return true;
}

// ② 放牌：把手牌第 handIdx 张扑克兵部署到 lane（入我方/敌方部署格·队尾排队）+ 可选改机关（开/关门）。花圣水（互斥·同类无限）。
export function deployUnit(b: TurnBattle, side: 'a' | 'b', handIdx: number, lane: number, gateToggle = -1): boolean {
  if (!canAct(b, side, 'deploy', DEPLOY_COST)) return false;
  const sd = sideOf(b, side); const card = sd.hand[handIdx];
  if (!card || card.kind !== 'poker' || lane < 0 || lane > 2) return false;
  const L = b.lanes[lane]; const col = colOf(L, side);
  const deploySlot = side === 'a' ? A_DEPLOY_SLOT : B_DEPLOY_SLOT;
  // 入场格 = 部署格往家方向错开（队尾·离敌最远；占格不重叠）。
  const slot = side === 'a' ? deploySlot - col.length : deploySlot + col.length;
  if (side === 'a' ? slot < B_GOAL : slot > A_GOAL) return false; // 我方区满(挤不下) → 拒绝
  sd.hand.splice(handIdx, 1); sd.mana -= DEPLOY_COST; b.actionTaken = 'deploy';
  const stamBonus = side === 'a' ? sd.tengangA.stamPlus + (isFaceRank(card.rank) ? sd.tengangA.stamFaces : 0) : 0;
  const stam = cardStamina(card.rank) + stamBonus;
  col.push({ id: card.id, rank: card.rank, suit: card.suit, points: cardPoints(card.rank), buff: card.buff, general: card.general, stamina: stam, staminaLeft: stam, slot });
  if (gateToggle >= 0 && gateToggle < GATES.length) b.gatesOpen[gateToggle] = !b.gatesOpen[gateToggle]; // 放牌附赠：开/关一道捷径门（doc24 §三·可不用）
  return true;
}

// ③ 打天罡：施手牌第 handIdx 张天罡 → 进 castIds（持续修正由 caller 经 aggregateTengang 重算喂 tengangA）。花圣水（互斥·同类无限）。
export function castTengang(b: TurnBattle, side: 'a' | 'b', handIdx: number): boolean {
  if (!canAct(b, side, 'cast', CAST_COST)) return false;
  const sd = sideOf(b, side); const card = sd.hand[handIdx];
  if (!card || card.kind !== 'tengang') return false;
  sd.hand.splice(handIdx, 1); sd.mana -= CAST_COST; sd.castIds.push(card.id); b.actionTaken = 'cast';
  return true; // tengangA 重算：caller 做 sd.tengangA = aggregateTengang(sd.castIds)（避免 turn-combat ← blueprint 环依赖）
}

// ④ 弃牌：清手牌第 handIdx 张，免费·无限（互斥类别=discard，但不耗圣水）。
export function discardCard(b: TurnBattle, side: 'a' | 'b', handIdx: number): boolean {
  if (b.winner !== 'pending' || b.active !== side) return false;
  if (b.actionTaken !== null && b.actionTaken !== 'discard') return false;
  const sd = sideOf(b, side);
  if (handIdx < 0 || handIdx >= sd.hand.length) return false;
  sd.hand.splice(handIdx, 1); b.actionTaken = 'discard';
  return true;
}

// ── 捷径门(上下通路梯子) 操作（owner 2026-06-20 Cloud Design 参考图）──
// 门钮单击(放牌时)或 AI 触发 → 翻 通路(◉,开) ↔ ✕(闭)。开门 = 下一步(推进阶段)该格己兵按门向过门(替直进)；目标格已有牌(任一方)→ 失败留原地。
// toggleGate：翻一道门开/关。gateMove(内部)：门开 + 源格有己兵 + 目标格空 → 搬过去，返回过门兵 id；否则 null。tryGate：单次手动过门(占位/测试)。
export function toggleGate(b: TurnBattle, gateIdx: number): boolean {
  if (b.winner !== 'pending' || gateIdx < 0 || gateIdx >= GATES.length) return false;
  b.gatesOpen[gateIdx] = !b.gatesOpen[gateIdx];
  return true;
}
function gateMove(b: TurnBattle, gateIdx: number): string | null {
  if (!b.gatesOpen[gateIdx]) return null;
  const g = GATES[gateIdx];
  const from = colOf(b.lanes[g.fromLane], g.side); const to = colOf(b.lanes[g.toLane], g.side);
  const foeTo = colOf(b.lanes[g.toLane], g.side === 'a' ? 'b' : 'a');
  const idx = from.findIndex((u) => u.slot === g.fromSlot);
  if (idx < 0 || to.some((u) => u.slot === g.toSlot) || foeTo.some((u) => u.slot === g.toSlot)) return null; // 源格无兵 / 目标格已有牌(任一方) → 失败
  const [u] = from.splice(idx, 1);
  u.slot = g.toSlot; to.push(u);
  to.sort((x, y) => (g.side === 'a' ? y.slot - x.slot : x.slot - y.slot)); // 维持 [0]=前锋(贴敌)序
  return u.id;
}
export function tryGate(b: TurnBattle, gateIdx: number): boolean {
  if (b.winner !== 'pending' || gateIdx < 0 || gateIdx >= GATES.length) return false;
  return gateMove(b, gateIdx) !== null;
}

// 擎天「最强单张」：side a 全军(跨三路) base 点数最高一张 id（防 buff 循环·ties 队首确定性）。
function championIdA(b: TurnBattle): string | undefined {
  let best: TurnUnit | undefined;
  for (const L of b.lanes) for (const u of L.a) if (!best || u.points > best.points) best = u;
  return best?.id;
}

// 有效战力 P_eff（doc19 §三 · 复用 live-combat 同款：base + 经营 buff + 天罡(只己方 a) + 士气；apply add→mul→floor→clamp）。
function effPower(u: TurnUnit, lane: TurnLane, side: 'a' | 'b', fx: TengangFx, championId?: string): { pEff: number; shift: number; tg: number } {
  const col = colOf(lane, side);
  let tg = 0;
  if (side === 'a') {
    tg += fx.powerAll + fx.pEffAdd;
    if (fx.powerFront && col.length && u.id === col[0].id) tg += fx.powerFront; // 锋矢：前锋
    if (col.length <= 3) tg += fx.powerLE3;                                     // 寡兵
    if (fx.powerSameSuit && col.filter((x) => x.suit === u.suit).length >= 2) tg += fx.powerSameSuit; // 同花魁
    if (fx.comboPair || fx.comboTrips) { const rc = new Map<string, number>(); for (const x of col) rc.set(x.rank, (rc.get(x.rank) ?? 0) + 1); const vals = [...rc.values()]; if (fx.comboPair && vals.some((n) => n >= 2)) tg += fx.comboPair; if (fx.comboTrips && vals.some((n) => n >= 3)) tg += fx.comboTrips; } // 对子诀/鼎立
  }
  const mul = side === 'a' && fx.powerMulHighest > 1 && u.id === championId ? fx.powerMulHighest : 1; // 擎天
  if (u.general) return { pEff: pEff(u.points, u.buff + tg, mul), shift: 0, tg };
  const genDead = side === 'a' ? lane.aGenDead : lane.bGenDead;
  const genHere = col.some((x) => x.general);
  const moraleBonus = side === 'a' && genHere ? fx.moraleLeader : 0; // 令旗
  const shift = genDead ? -ROUT_PTS : genHere ? MORALE_PTS + moraleBonus : 0;
  return { pEff: pEff(u.points, u.buff + tg + shift, mul), shift, tg };
}

function killFront(lane: TurnLane, side: 'a' | 'b'): void {
  const q = colOf(lane, side); const u = q.shift();
  if (u?.general) { if (side === 'a') lane.aGenDead = true; else lane.bGenDead = true; }
}

// 一路前锋相遇 → 掷命对决（doc19 原封·复用 live-combat 同款解算：tie 阶梯 + kHard/winFloor/noUpset；同序消费 rng → hash 稳）。
function resolveClash(b: TurnBattle, li: number): void {
  const lane = b.lanes[li]; const fa = lane.a[0], fb = lane.b[0];
  if (!fa || !fb) return;
  const champId = b.a.tengangA.powerMulHighest > 1 ? championIdA(b) : undefined;
  const ba = effPower(fa, lane, 'a', b.a.tengangA, champId), bb = effPower(fb, lane, 'b', b.b.tengangA);
  const ea = ba.pEff, eb = bb.pEff;
  let wr = winrate(ea, eb, Math.max(2, CLASH_K - b.a.tengangA.kHard)); // 灌铅骰
  if (b.a.tengangA.winFloor > 0) wr = Math.min(0.97, Math.max(wr, 0.03 + b.a.tengangA.winFloor)); // 稳手
  const roll = nextRandom(b.rng);
  let aWins: boolean, tie: ClashEvent['tie'] = null;
  if (ea === eb) {
    if (fa.points !== fb.points) { aWins = fa.points > fb.points; tie = 'points'; }
    else if (fa.staminaLeft !== fb.staminaLeft) { aWins = fa.staminaLeft > fb.staminaLeft; tie = 'stamina'; }
    else { aWins = roll < 0.5; tie = 'roll'; }
  } else {
    aWins = roll < wr;
    if (b.a.tengangA.noUpset > 0 && wr >= 0.5) aWins = true; // 铁骰
  }
  b.lastClash = { tick: b.turn, lane: li, winrate: wr, roll, aWins, tie, a: { rank: fa.rank, suit: fa.suit, general: fa.general, points: fa.points, buff: fa.buff, morale: ba.shift, tengang: ba.tg, pEff: ea }, b: { rank: fb.rank, suit: fb.suit, general: fb.general, points: fb.points, buff: fb.buff, morale: bb.shift, tengang: bb.tg, pEff: eb } };
  b.clashLog.push(b.lastClash); // 流水（驱动层逐场抽特写）
  b.clashSeq += 1;
  killFront(lane, aWins ? 'b' : 'a'); // 输家阵亡
  const wq = colOf(lane, aWins ? 'a' : 'b'); const wf = wq[0]; // 赢家续航 −1·尽则退场
  if (wf) { wf.staminaLeft -= 1; if (wf.staminaLeft <= 0) { wq.shift(); if (aWins) lane.spentA += 1; else lane.spentB += 1; } }
}

// 推进阶段（doc24 §七·只推 active 方自己的兵）：①开门分流(下一步该格己兵按门向过门·替直进) → ②各路前锋向敌家推一格 → 相邻敌前锋则掷命 / 无敌则抵敌家 chip 血。
function advanceSide(b: TurnBattle, side: 'a' | 'b'): void {
  const dir = side === 'a' ? 1 : -1;
  // ① 捷径门分流（owner 2026-06-20 上下通路梯子）：active 方每道开门 → 源格己兵过门(替本回合直进)；过门兵记入 diverted 不再直进。
  const diverted = new Set<string>();
  for (let gi = 0; gi < GATES.length; gi++) { if (GATES[gi].side !== side) continue; const id = gateMove(b, gi); if (id) diverted.add(id); }
  // ② 直进
  for (let li = 0; li < 3; li++) {
    const lane = b.lanes[li]; const own = colOf(lane, side); const foe = colOf(lane, side === 'a' ? 'b' : 'a');
    if (own.length === 0) continue;
    if (foe.length > 0) {
      const foeFront = foe[0];
      // own 各兵 +dir，保 slot 间距 1·前锋停在敌前锋相邻格(不重叠)；已过门兵留原地。
      for (let i = 0; i < own.length; i++) {
        if (diverted.has(own[i].id)) continue; // 本回合已过门 → 不再直进
        let t = own[i].slot + dir;
        if (i > 0) { const ahead = own[i - 1].slot; t = dir > 0 ? Math.min(t, ahead - 1) : Math.max(t, ahead + 1); }
        else { const limit = foeFront.slot - dir; t = dir > 0 ? Math.min(t, limit) : Math.max(t, limit); } // 停在敌前锋前一格
        own[i].slot = t;
      }
      if (Math.abs(own[0].slot - foeFront.slot) <= 1) resolveClash(b, li); // 相邻 → 遭遇掷命
    } else {
      // 无敌 → 向敌家推；越过敌区末格 → 敌大本营 −1·该兵退场。
      for (let i = 0; i < own.length; i++) {
        if (diverted.has(own[i].id)) continue;
        let t = own[i].slot + dir;
        if (i > 0) { const ahead = own[i - 1].slot; t = dir > 0 ? Math.min(t, ahead - 1) : Math.max(t, ahead + 1); }
        own[i].slot = t;
      }
      const goal = side === 'a' ? A_GOAL : B_GOAL;
      for (let i = own.length - 1; i >= 0; i--) {
        const past = dir > 0 ? own[i].slot > goal : own[i].slot < goal;
        if (past) { own.splice(i, 1); if (side === 'a') b.homeB = Math.max(0, b.homeB - 1); else b.homeA = Math.max(0, b.homeA - 1); }
      }
    }
  }
}

function checkWinner(b: TurnBattle): void {
  if (b.homeB <= 0 && b.homeA <= 0) b.winner = 'draw';
  else if (b.homeB <= 0) b.winner = 'a';
  else if (b.homeA <= 0) b.winner = 'b';
}

// 结束当前回合（doc24 §七.3）：active 方推进一格 + 遭遇结算 → 判负 → 切换回合方、+1 圣水、回合数 +1、解锁动作。
export function endTurn(b: TurnBattle): void {
  if (b.winner !== 'pending') return;
  advanceSide(b, b.active);
  checkWinner(b);
  if (b.winner !== 'pending') return;
  b.active = b.active === 'a' ? 'b' : 'a';
  const sd = sideOf(b, b.active);
  sd.mana += MANA_PER_TURN; // 回合开始 +1 圣水（doc24 §二.1）
  b.actionTaken = null;     // 新回合解锁互斥动作
  b.turn += 1;
}

// 极简脚本 AI（doc24 §七 AI 回合·占位）：手里有扑克且够圣水就部署到兵最少的路，否则尽量摸普通，再不行就结束。真 AI/难度参数后续切片。
export function aiTakeTurn(b: TurnBattle): void {
  if (b.winner !== 'pending' || b.active !== 'b') return;
  let guard = 0;
  while (guard++ < 32) {
    const sd = b.b;
    const pokerIdx = sd.hand.findIndex((c) => c.kind === 'poker');
    if (pokerIdx >= 0 && sd.mana >= DEPLOY_COST && (b.actionTaken === null || b.actionTaken === 'deploy')) {
      const lane = [0, 1, 2].reduce((m, li) => (b.lanes[li].b.length < b.lanes[m].b.length ? li : m), 0);
      if (deployUnit(b, 'b', pokerIdx, lane)) continue;
    }
    if (b.actionTaken === null && sd.mana >= DRAW_COST && sd.pokerDeck.length && drawCard(b, 'b', 'poker')) continue;
    break;
  }
  endTurn(b);
}

// 战局是否还有未决（任一路有兵 / 任一方手牌或牌库还能动）——给跑到底/仿真台用。
export function turnActive(b: TurnBattle): boolean {
  if (b.winner !== 'pending') return false;
  const sideCanProgress = (s: TurnSide): boolean => s.hand.length > 0 || s.pokerDeck.length > 0 || s.tengangDeck.length > 0;
  return b.lanes.some((l) => l.a.length || l.b.length) || sideCanProgress(b.a) || sideCanProgress(b.b);
}

// 确定性状态指纹（逐回合对比·回归 + 仿真台）：回合/谁/圣水/手牌数/各路前锋 slot+队长/大本营/rng 序。
export function turnHash(b: TurnBattle): string {
  const lane = (l: TurnLane): string => `${l.a.length}@${l.a[0]?.slot ?? '_'},${l.b.length}@${l.b[0]?.slot ?? '_'},${l.aGenDead ? 1 : 0}${l.bGenDead ? 1 : 0},${l.spentA},${l.spentB}`;
  return `T${b.turn}|${b.active}|mA${b.a.mana}|mB${b.b.mana}|hA${b.a.hand.length}|hB${b.b.hand.length}|HA${b.homeA}|HB${b.homeB}|w${b.winner}|s${b.rng.sequence}|g${b.gatesOpen.map((o) => (o ? 1 : 0)).join('')}|${b.lanes.map(lane).join('|')}`;
}
