// turn-combat.ts —— doc24 单机回合制战斗模型（owner 2026-06-19 大转向 · 取代 doc21 实时 CR）。
// A0 头号任务：把"驱动层"从 实时(live-combat rAF 连续行军 + 召唤源泉时间 regen + 读秒暂停) 换成 **回合制状态机**。
// 原封保留并复用：掷命对决核(clash-resolve) · 三路 · 3 血大本营 · 公平骨架(cardPoints) · 天罡 apply(TengangFx) · 续航(cardStamina)。只换驱动。
//
// 棋盘(doc24 §一)：每路一条 **9 格 slot 轨** —— 我方区 slot 0..3 · 中线 4 · 敌方区 5..8。我兵向 8(敌家)推、敌兵向 0(我家)推；先破敌 3 血大本营胜。
// 回合(doc24 §二)：① 回合开始 +1 召唤源泉 → ② 选「一类」互斥动作(抽/放[+机关]/打天罡/弃·同类无限) → ③ 结束→**推进一格**→相邻遭遇→掷命(doc19 原封)。
// 确定性：单一 seeded PRNG（同 live-combat·掷命点同序消费）；同输入流 → 同 turnHash、可回放、可喂仿真台。纯 game-side、零引擎。
//
// ⚠️ logic 先行·UI 待 Cloud Design 稿(doc24 §九)：本模块不碰 live-combat / showMatch / battle-screen（实时路保持可跑），待新战斗屏落地再切换、退役实时核。
import { winrate, pEff, cardPoints, CLASH_K } from './clash-resolve.js';
import { nextRandom } from '@atom-skills/index.js';
import type { RandomSeed } from '@engine/protocol/components.js';
import { cardStamina, NO_TENGANG, type TengangFx, type ClashEvent } from './live-combat.js';
import { aggregateDisha, type DishaFx } from './disha.js';

// ── 棋盘几何（doc24 §一）──
export const SLOTS = 9;          // 每路格数：我方 0..3 / 中线 4 / 敌方 5..8
export const A_DEPLOY_SLOT = 0;  // 放牌区起点=自家大本营边(slot 0)；新兵落最靠家的空格(0→1→2 向中线填)·从家行军出去(owner 2026-06-20)
export const B_DEPLOY_SLOT = 8;  // 敌方对称：放牌区起点=敌家边(slot 8)·新兵落 8→7→6
export const A_GOAL = 8;         // 我兵越过此格(→9) → 敌大本营 −1 血
export const B_GOAL = 0;         // 敌兵越过此格(→−1) → 我大本营 −1 血
// ── 回合经济（doc24 §四·真机调；各 cost 暂定 1）──
export const TURN_HOME_BLOOD = 3;
export const MANA_START = 1, MANA_PER_TURN = 1;
export const DRAW_COST = 1, DEPLOY_COST = 0, CAST_COST = 1; // 抽/打天罡 花召唤源泉；放牌按 rank 收费(契约B·写在卡 cost 上)
export const DISCARD_REFUND = 0.5; // 弃牌返还 0.5 召唤源泉（owner 2026-06-21·源泉自此为半整数粒度）
export const OPENING_HAND = 3; // 起手摸 N（doc24 §六/七 待定）
export const HAND_MAX = 8; // 手牌上限（天罡·广纳 handMaxAdd 抬高）
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

// 场上兵：占一格 slot；续航 staminaLeft 打光退场（同 live-combat 经济）。speed=每回合推进格数(默认1·缺省视作1·向后兼容旧字面量)。
export interface TurnUnit { id: string; rank: string; suit: string; points: number; buff: number; general: boolean; stamina: number; staminaLeft: number; slot: number; speed?: number; cost?: number } // cost=部署所花源泉(战胜回库返还一半用)
// 行军速度（owner 2026-06-21）：大王/小王(★/王/JOKER) 与 老K 三类高阶兵·疾行 2 格/回合；其余 1 格。纯 rank 派生·确定性。
const FAST_RANKS = new Set(['★', '王', 'JOKER', 'K']);
export function unitSpeed(rank: string): number { return FAST_RANKS.has(rank) ? 2 : 1; }
// 一路：双方兵列（own[0] = 前锋·最贴敌）+ 捷径门开关 + 主将阵亡/续航退场记账。
export interface TurnLane { a: TurnUnit[]; b: TurnUnit[]; aGenDead: boolean; bGenDead: boolean; spentA: number; spentB: number }
// 手牌/牌库卡：扑克兵(上场) / 天罡(施法·id)。
export interface PokerCard { kind: 'poker'; id: string; rank: string; suit: string; general: boolean; buff: number; cost?: number } // cost=放牌召唤源泉费(契约B·deployCost·建库时按 rank 写在卡上·缺省=DEPLOY_COST·避免 turn-combat←blueprint 环依赖)
export interface TengangHandCard { kind: 'tengang'; id: string }
export type Card = PokerCard | TengangHandCard;
// 一方运行态：召唤源泉 / 手牌 / 两库 / 已施天罡集 + 其聚合修正。
export interface TurnSide { mana: number; hand: Card[]; pokerDeck: PokerCard[]; tengangDeck: TengangHandCard[]; castIds: string[]; tengangA: TengangFx; castFx: { id: string; fx: TengangFx }[] } // castFx：逐张已打天罡的单卡修正(caller 经 aggregateTengang([id]) 填)·供对决明细逐张溯源
export type ActionKind = 'draw' | 'deploy' | 'cast' | 'discard';
// Boss 策略画像（doc27 §八·性格即数据·最弱 LLM 也能填权重）：通用 utility AI 读它打分→选动作。0-10。
export interface AiProfile {
  aggression: number;  // 攻 10 ↔ 守 0
  lanePref: number;    // 铺三路 10 ↔ 专一路 0
  spellEager: number;  // 早放天罡 10 ↔ 攒大招 0
  targetPref: 'weak' | 'strong' | 'general'; // 打弱/打强/取主将路
  risk: number;        // 赌低胜率 10 ↔ 求稳 0
  economy: number;     // 快花源泉 10 ↔ 囤积 0
}
export const NEUTRAL_AI: AiProfile = { aggression: 5, lanePref: 5, spellEager: 5, targetPref: 'weak', risk: 5, economy: 5 };
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
  dishaB: DishaFx; bossWinStreak: number; batteryLane: number; bossLastStandUsed: boolean; // 地煞(Boss 招牌战术·doc23 §八)运行态
  aiProfile: AiProfile; aiTier: number; // Boss 通用 utility AI（doc27 §八）：画像 + 难度档(高=更优·低=会犯错)
  homeAShieldUsed: number; // 死守(天罡 siegeDefend)：我大本营已吸收次数
}

const mkLane = (): TurnLane => ({ a: [], b: [], aGenDead: false, bGenDead: false, spentA: 0, spentB: 0 });
const mkSide = (pokerDeck: PokerCard[] = [], tengangDeck: TengangHandCard[] = []): TurnSide =>
  ({ mana: MANA_START, hand: [], pokerDeck: [...pokerDeck], tengangDeck: [...tengangDeck], castIds: [], tengangA: NO_TENGANG, castFx: [] });

export interface TurnInit { seed: number; homeMax?: number; disha?: readonly string[]; aiProfile?: AiProfile; aiTier?: number; a?: { pokerDeck?: PokerCard[]; tengangDeck?: TengangHandCard[] }; b?: { pokerDeck?: PokerCard[]; tengangDeck?: TengangHandCard[] } }
/** 开战 init（doc24 §七）：三路 ×9 空轨；双方大本营 3 hp；召唤源泉=起步；A 先手。牌库由 caller（game-g/save）喂；起手摸由 caller 调 drawCard。
 *  cfg.disha：Boss 关卡地煞 id 集（doc23 §八）→ 聚合成 dishaB 在 Boss 侧 apply；温泉关死守覆写 Boss 大本营血。 */
export function initTurnBattle(cfg: TurnInit): TurnBattle {
  const homeMax = cfg.homeMax ?? TURN_HOME_BLOOD;
  const dishaB = aggregateDisha(cfg.disha ?? []);
  const battle: TurnBattle = {
    turn: 1, active: 'a',
    lanes: [mkLane(), mkLane(), mkLane()],
    gatesOpen: GATES.map(() => false), // 默认全闭 ✕(owner 2026-06-20 拍板)：放牌时点门钮翻成 ◉ 通路 / AI 亦可翻；开门才在推进时分流
    homeA: homeMax, homeB: dishaB.homeHp > 0 ? dishaB.homeHp : homeMax, homeMax, // 地煞·温泉关死守 → Boss 大本营更厚
    a: mkSide(cfg.a?.pokerDeck, cfg.a?.tengangDeck),
    b: mkSide(cfg.b?.pokerDeck, cfg.b?.tengangDeck),
    rng: { type: 'RandomSeed', seed: cfg.seed, sequence: 0 },
    winner: 'pending', actionTaken: null, lastClash: null, clashLog: [], clashSeq: 0,
    dishaB, bossWinStreak: 0, batteryLane: -1, bossLastStandUsed: false,
    aiProfile: cfg.aiProfile ?? NEUTRAL_AI, aiTier: cfg.aiTier ?? 2,
    homeAShieldUsed: 0,
  };
  battle.b.mana = 0; // 后手方召唤源泉在其回合开始才 +1（每回合 +1 对称·turn-1 的 +1 已含在先手起步值里）
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

// ① 抽牌：从 poker / tengang 库顶摸一张进手牌，花召唤源泉（互斥·同类无限）。返回是否成功。
export function drawCard(b: TurnBattle, side: 'a' | 'b', from: 'poker' | 'tengang'): boolean {
  if (!canAct(b, side, 'draw', DRAW_COST)) return false;
  const sd = sideOf(b, side);
  if (sd.hand.length >= HAND_MAX + sd.tengangA.handMaxAdd) return false; // 手牌上限（广纳 +2）
  const card: Card | undefined = from === 'poker' ? sd.pokerDeck.shift() : sd.tengangDeck.shift();
  if (!card) return false;
  sd.mana -= DRAW_COST; sd.hand.push(card); b.actionTaken = 'draw';
  return true;
}

// 川流（天罡·draw onPlay）：放牌/施法后免费补抽（不耗源泉·不算动作·受手牌上限约束）。
function onPlayDraw(sd: TurnSide): void {
  for (let i = 0; i < sd.tengangA.onPlay && sd.pokerDeck.length && sd.hand.length < HAND_MAX + sd.tengangA.handMaxAdd; i++) sd.hand.push(sd.pokerDeck.shift()!);
}

// ② 放牌：把手牌第 handIdx 张扑克兵部署到 lane（入我方/敌方部署格·队尾排队）+ 可选改机关（开/关门）。花召唤源泉（互斥·同类无限）。
export function deployUnit(b: TurnBattle, side: 'a' | 'b', handIdx: number, lane: number, gateToggle = -1): boolean {
  const sd = sideOf(b, side); const card = sd.hand[handIdx];
  if (!card || card.kind !== 'poker' || lane < 0 || lane > 2) return false;
  const cost = card.cost ?? DEPLOY_COST; // 放牌按牌点数收费（契约B·建库时已写在卡上·2-4免费/5-7=1/8-10=2/JQKA=3）
  if (!canAct(b, side, 'deploy', cost)) return false;
  const L = b.lanes[lane]; const col = colOf(L, side); const foeCol = colOf(L, side === 'a' ? 'b' : 'a');
  // 放牌区=贴自家大本营 3 格(home→中线)：新兵落最靠家的空格(owner 2026-06-20)。**不可落在已占格——敌我皆不可**(owner 2026-06-21)。
  const occ = new Set([...col, ...foeCol].map((u) => u.slot));
  const zone = side === 'a' ? [A_DEPLOY_SLOT, A_DEPLOY_SLOT + 1, A_DEPLOY_SLOT + 2] : [B_DEPLOY_SLOT, B_DEPLOY_SLOT - 1, B_DEPLOY_SLOT - 2];
  const slot = zone.find((s) => !occ.has(s));
  if (slot === undefined) return false; // 放牌区(贴家3格)被占满(含敌兵深入) → 拒绝
  sd.hand.splice(handIdx, 1); sd.mana -= cost; b.actionTaken = 'deploy';
  const stamBonus = sd.tengangA.stamPlus + (isFaceRank(card.rank) ? sd.tengangA.stamFaces : 0); // 不屈/老兵（双侧·Boss 施法亦得）
  const stam = cardStamina(card.rank) + stamBonus;
  col.push({ id: card.id, rank: card.rank, suit: card.suit, points: cardPoints(card.rank), buff: card.buff, general: card.general, stamina: stam, staminaLeft: stam, slot, speed: unitSpeed(card.rank), cost: card.cost });
  col.sort((x, y) => (side === 'a' ? y.slot - x.slot : x.slot - y.slot)); // 维持 [0]=前锋(贴敌·最高/最低 slot)
  if (gateToggle >= 0 && gateToggle < GATES.length) b.gatesOpen[gateToggle] = !b.gatesOpen[gateToggle]; // 放牌附赠：开/关一道捷径门（doc24 §三·可不用）
  onPlayDraw(sd); // 川流：放牌后免费补抽
  return true;
}

// ③ 打天罡：施手牌第 handIdx 张天罡 → 进 castIds（持续修正由 caller 经 aggregateTengang 重算喂 tengangA）。花召唤源泉（互斥·同类无限）。
export function castTengang(b: TurnBattle, side: 'a' | 'b', handIdx: number): boolean {
  if (!canAct(b, side, 'cast', CAST_COST)) return false;
  const sd = sideOf(b, side); const card = sd.hand[handIdx];
  if (!card || card.kind !== 'tengang') return false;
  sd.hand.splice(handIdx, 1); sd.mana -= CAST_COST; sd.castIds.push(card.id); b.actionTaken = 'cast';
  onPlayDraw(sd); // 川流：施法后免费补抽（用本次之前已生效的 onPlay）
  return true; // tengangA 重算：caller 做 sd.tengangA = aggregateTengang(sd.castIds)（避免 turn-combat ← blueprint 环依赖）
}

// ④ 弃牌（owner 2026-06-21）：**不互斥**——不锁 actionTaken，弃完还能放牌/抽/打天罡；每弃 1 张**返还 0.5 源泉**。
export function discardCard(b: TurnBattle, side: 'a' | 'b', handIdx: number): boolean {
  if (b.winner !== 'pending' || b.active !== side) return false;
  const sd = sideOf(b, side);
  if (handIdx < 0 || handIdx >= sd.hand.length) return false;
  sd.hand.splice(handIdx, 1); sd.mana += DISCARD_REFUND; // 返 0.5·不动 actionTaken(不互斥)
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

// 擎天「最强单张」：某方全军(跨三路) base 点数最高一张 id（防 buff 循环·ties 队首确定性）。
function championId(b: TurnBattle, side: 'a' | 'b'): string | undefined {
  let best: TurnUnit | undefined;
  for (const L of b.lanes) for (const u of colOf(L, side)) if (!best || u.points > best.points) best = u;
  return best?.id;
}

// 有效战力 P_eff（doc19 §三 · 复用 live-combat 同款：base + 经营 buff + 天罡(双方己侧·Boss 施法亦生效) + 士气；apply add→mul→floor→clamp）。
// noRout（地煞·破釜沉舟/死战不退）：Boss 主将亡不溃散（shift 不取 −ROUT）。fx=该侧 tengangA（NO_TENGANG → 零修正·行为同前）。
function effPower(u: TurnUnit, lane: TurnLane, side: 'a' | 'b', fx: TengangFx, champId?: string, noRout = false, nearDef = 0): { pEff: number; shift: number; tg: number; nearDef: number } {
  const col = colOf(lane, side);
  let tg = fx.powerAll + fx.pEffAdd;
  if (fx.powerFront && col.length && u.id === col[0].id) tg += fx.powerFront; // 锋矢：前锋
  if (col.length <= 3) tg += fx.powerLE3;                                     // 寡兵
  if (fx.powerSameSuit && col.filter((x) => x.suit === u.suit).length >= 2) tg += fx.powerSameSuit; // 同花魁
  if (fx.comboPair || fx.comboTrips) { const rc = new Map<string, number>(); for (const x of col) rc.set(x.rank, (rc.get(x.rank) ?? 0) + 1); const vals = [...rc.values()]; if (fx.comboPair && vals.some((n) => n >= 2)) tg += fx.comboPair; if (fx.comboTrips && vals.some((n) => n >= 3)) tg += fx.comboTrips; } // 对子诀/鼎立
  const mul = fx.powerMulHighest > 1 && u.id === champId ? fx.powerMulHighest : 1; // 擎天
  if (u.general) return { pEff: pEff(u.points, u.buff + tg + nearDef, mul), shift: 0, tg, nearDef };
  const genDead = side === 'a' ? lane.aGenDead : lane.bGenDead;
  const genHere = col.some((x) => x.general);
  const moraleBonus = genHere ? fx.moraleLeader : 0; // 令旗(旗手)
  const noRoutEff = noRout || fx.noRout > 0; // 督战(天罡) 或 破釜沉舟/死战不退(Boss disha)
  const shift = !genDead ? (genHere ? MORALE_PTS + moraleBonus : 0)
    : fx.revenge > 0 ? fx.revenge // 哀兵：主将亡 → 余部暴怒 +N
    : noRoutEff ? 0               // 督战：主将亡不溃散
    : -ROUT_PTS;                  // 默认：主将亡 → 溃散
  return { pEff: pEff(u.points, u.buff + tg + shift + nearDef, mul), shift, tg, nearDef };
}

// 单张天罡 fx 对该前锋的 tg 贡献（与 effPower 的 tg 门控逐字一致）→ 对决明细逐张溯源（owner 2026-06-21）。
function tgContribOf(u: TurnUnit, lane: TurnLane, side: 'a' | 'b', fx: TengangFx): number {
  const col = colOf(lane, side);
  let tg = fx.powerAll + fx.pEffAdd;
  if (fx.powerFront && col.length && u.id === col[0].id) tg += fx.powerFront;
  if (col.length <= 3) tg += fx.powerLE3;
  if (fx.powerSameSuit && col.filter((x) => x.suit === u.suit).length >= 2) tg += fx.powerSameSuit;
  if (fx.comboPair || fx.comboTrips) { const rc = new Map<string, number>(); for (const x of col) rc.set(x.rank, (rc.get(x.rank) ?? 0) + 1); const vals = [...rc.values()]; if (fx.comboPair && vals.some((n) => n >= 2)) tg += fx.comboPair; if (fx.comboTrips && vals.some((n) => n >= 3)) tg += fx.comboTrips; }
  return tg;
}

// ── 地煞 apply（Boss 侧·doc23 §八）：把 dishaB 各效果折成「Boss 掷命胜率 +X 百分点」(玩家 wr 相应减) ──
// 8 邻/同路相邻 己兵计数（方阵/连环船）。bf=Boss 前锋；li=其所在路。
function dishaAllies(b: TurnBattle, li: number, bf: TurnUnit, adj8: boolean): number {
  let n = 0;
  for (let lj = 0; lj < 3; lj++) {
    if (adj8 ? Math.abs(lj - li) > 1 : lj !== li) continue;
    for (const x of b.lanes[lj].b) { if (x.id === bf.id) continue; if (Math.abs(x.slot - bf.slot) <= 1) n += 1; }
  }
  return n;
}
// 锤砧：你前锋 pf 在 li 路被 Boss 兵左右(slot±1)夹住。
function flankedBoth(b: TurnBattle, li: number, pf: TurnUnit): boolean {
  const bb = b.lanes[li].b;
  return bb.some((x) => x.slot === pf.slot - 1) && bb.some((x) => x.slot === pf.slot + 1);
}
// Boss 掷命胜率加成（百分点·apply 时 wr -= edge/100）。pf/bf=两军前锋·li=路。
function bossEdge(b: TurnBattle, li: number, pf: TurnUnit, bf: TurnUnit): number {
  const d = b.dishaB;
  let e = d.allWinPct; // 挟天子/破釜沉舟：全军
  if (bf.general) e += d.generalWinPct; // 霸王之勇/伙伴骑兵(简化)
  if (d.phalanxPerAdj > 0) e += Math.min(d.phalanxCap, dishaAllies(b, li, bf, d.phalanxAdj8) * d.phalanxPerAdj); // 方阵/连环船
  if (d.nearBaseSlots > 0 && bf.slot >= SLOTS - d.nearBaseSlots) e += d.nearBaseWinPct; // 温泉关·隘口(贴 Boss 家)
  if (d.eliteMidWinPct > 0 && li === 1) e += d.eliteMidWinPct; // 近卫军(简化·中路前锋)
  if (d.winStreakPer > 0) e += Math.min(d.winStreakCap, b.bossWinStreak * d.winStreakPer); // 九战九捷
  if (d.firstStrike) e += d.firstStrikeWinPct; // 长枪方阵·先手
  if (li === b.batteryLane) e += d.batteryWinPct; // 大炮兵·你这路被压
  if (d.flankYouWinPct > 0 && flankedBoth(b, li, pf)) e += d.flankYouWinPct; // 锤砧·你被夹
  return e;
}

function killFront(lane: TurnLane, side: 'a' | 'b'): void {
  const q = colOf(lane, side); const u = q.shift();
  if (u?.general) { if (side === 'a') lane.aGenDead = true; else lane.bGenDead = true; }
}

// 掷命解算评估（纯读·不掷骰不改状态）：算两军前锋有效战力 + 玩家(a)胜率 wr（含 kHard/winFloor/地煞 edge）。
// resolveClash 与 UI 预报 clashOdds 共用此**单一真相**，杜绝"预报与实判不一致"。
interface ClashEval { fa: TurnUnit; fb: TurnUnit; ea: number; eb: number; wr: number; ba: ReturnType<typeof effPower>; bb: ReturnType<typeof effPower> }
function clashEval(b: TurnBattle, li: number): ClashEval | null {
  const lane = b.lanes[li]; const fa = lane.a[0], fb = lane.b[0];
  if (!fa || !fb) return null;
  const champA = b.a.tengangA.powerMulHighest > 1 ? championId(b, 'a') : undefined;
  const champB = b.b.tengangA.powerMulHighest > 1 ? championId(b, 'b') : undefined;
  const dB = b.dishaB;
  const nearDefB = dB.nearBaseSlots > 0 && fb.slot >= SLOTS - dB.nearBaseSlots ? dB.nearBasePower : 0; // 温泉关·隘口守军固守 +战力（贴 Boss 家·进战力拆解）
  const ba = effPower(fa, lane, 'a', b.a.tengangA, champA), bb = effPower(fb, lane, 'b', b.b.tengangA, champB, dB.noRout, nearDefB);
  const ea = ba.pEff, eb = bb.pEff;
  let wr = winrate(ea, eb, Math.max(2, CLASH_K - b.a.tengangA.kHard)); // 灌铅骰
  if (b.a.tengangA.winFloor > 0) wr = Math.min(0.97, Math.max(wr, 0.03 + b.a.tengangA.winFloor)); // 稳手
  const edge = bossEdge(b, li, fa, fb); // 地煞：Boss 招牌战术压低玩家胜率
  if (edge !== 0) wr = Math.min(0.97, Math.max(0.03, wr - edge / 100));
  return { fa, fb, ea, eb, wr, ba, bb };
}

// 玩家(a)视角·当前若开战的胜率(0~1)·纯读不掷骰；无前锋相遇→null。供 UI「掷命预报」（owner 2026-06-21）。
export function clashOdds(b: TurnBattle, li: number): number | null {
  const ev = clashEval(b, li); if (!ev) return null;
  const { fa, fb, ea, eb, wr } = ev;
  if (ea === eb) { // 战力全平 → 破平阶梯的确定性部分（点数→续航→先手/掷骰）
    if (fa.points !== fb.points) return fa.points > fb.points ? 1 : 0;
    if (fa.staminaLeft !== fb.staminaLeft) return fa.staminaLeft > fb.staminaLeft ? 1 : 0;
    return b.dishaB.firstStrike ? 0 : 0.5;
  }
  if (b.a.tengangA.noUpset > 0 && wr >= 0.5) return 1; // 铁骰：稳赢
  return wr;
}

// 掷命「10 颗十面骰」表现数据（owner 2026-06-21·3D 物理骰 → 表现层乙渲染）：把已定的 roll/winrate/胜负
// 折成「10 粒 d10(0-9·共 0~90) 落点 + 需冲破的门槛线」。**胜率低→门槛高(难)·胜率高→门槛低(易)**；
// 关键：sum>threshold ⟺ 实际胜负(aWins)，**强制对齐·绝不重新 RNG**——表现永不与真实结果矛盾(确定性/回放安全)。
export interface ClashDice { dice: number[]; sum: number; threshold: number; win: boolean }
export function clashDiceRoll(roll: number, winrate: number, aWins: boolean): ClashDice {
  const SCALE = 90; // 10 颗 d10(每颗 0-9) → 总点 0..90
  const c01 = (x: number): number => Math.max(0, Math.min(1, x));
  const threshold = Math.round((1 - c01(winrate)) * SCALE); // 胜率低 → 门槛高(要扔很高才赢)
  let sum = Math.round((1 - c01(roll)) * SCALE);
  if (aWins && sum <= threshold) sum = Math.min(SCALE, threshold + 1); // 与实判对齐(含平局裁定)：赢则必冲破
  if (!aWins && sum > threshold) sum = threshold;                       // 负则不冲破
  const dice = Array.from({ length: 10 }, () => Math.floor(sum / 10)); // 摊到 10 粒·确定性(基数+余数均摊)
  let rem = sum - dice.reduce((a, b) => a + b, 0);
  for (let i = 0; i < 10 && rem > 0; i++) { const add = Math.min(9 - dice[i], rem); dice[i] += add; rem -= add; }
  return { dice, sum, threshold, win: aWins };
}


// 一路前锋相遇 → 掷命对决（doc19 原封·复用 live-combat 同款解算：tie 阶梯 + kHard/winFloor/noUpset；同序消费 rng → hash 稳）。
function resolveClash(b: TurnBattle, li: number): void {
  const ev = clashEval(b, li); if (!ev) return;
  const lane = b.lanes[li]; const { fa, fb, ea, eb, wr, ba, bb } = ev;
  const roll = nextRandom(b.rng);
  let aWins: boolean, tie: ClashEvent['tie'] = null;
  if (ea === eb) {
    if (fa.points !== fb.points) { aWins = fa.points > fb.points; tie = 'points'; }
    else if (fa.staminaLeft !== fb.staminaLeft) { aWins = fa.staminaLeft > fb.staminaLeft; tie = 'stamina'; }
    else { aWins = b.dishaB.firstStrike ? false : roll < 0.5; tie = 'roll'; } // 长枪方阵·先手 → 全平判 Boss 胜
  } else {
    aWins = roll < wr;
    if (b.a.tengangA.noUpset > 0 && wr >= 0.5) aWins = true; // 铁骰
  }
  const tgBreakOf = (sd: TurnSide, u: TurnUnit, sk: 'a' | 'b'): [string, number][] => sd.castFx.map(({ id, fx }) => [id, Math.round(tgContribOf(u, lane, sk, fx))] as [string, number]).filter((r) => r[1] !== 0); // 逐张天罡溯源
  b.lastClash = { tick: b.turn, lane: li, winrate: wr, roll, aWins, tie, a: { rank: fa.rank, suit: fa.suit, general: fa.general, points: fa.points, buff: fa.buff, morale: ba.shift, tengang: ba.tg, pEff: ea, tgBreak: tgBreakOf(b.a, fa, 'a'), nearDef: ba.nearDef }, b: { rank: fb.rank, suit: fb.suit, general: fb.general, points: fb.points, buff: fb.buff, morale: bb.shift, tengang: bb.tg, pEff: eb, tgBreak: tgBreakOf(b.b, fb, 'b'), nearDef: bb.nearDef } };
  b.clashLog.push(b.lastClash); // 流水（驱动层逐场抽特写）
  b.clashSeq += 1;
  if (!aWins) b.bossWinStreak += 1; // 九战九捷：Boss 胜累积
  // 死战不退（地煞·关1 仅 Boss 主将）：首负不亡 → 残喘退 1 格(向 Boss 家 slot+1)·二次才真死。
  if (aWins && fb.general && b.dishaB.lastStandGeneral && !b.bossLastStandUsed) {
    b.bossLastStandUsed = true; const q = lane.b; const u = q.shift();
    if (u) { u.slot = Math.min(SLOTS - 1, u.slot + 1); q.push(u); q.sort((x, y) => x.slot - y.slot); }
  } else {
    const loser = aWins ? 'b' : 'a';
    killFront(lane, loser); // 输家阵亡
    const relay = sideOf(b, loser).tengangA.relay; // 薪火：一张阵亡 → 同路下一张接棒续航 +N
    const next = colOf(lane, loser)[0]; if (relay > 0 && next) next.staminaLeft += relay;
  }
  // 战胜牌「光荣回牌库」+ 返还一半部署花费（owner 2026-06-21·替原"续航−1·尽则退场"）：胜者下场入库、可再抽。
  const winSide: 'a' | 'b' = aWins ? 'a' : 'b';
  const wq = colOf(lane, winSide); const wf = wq[0];
  if (wf) {
    wq.shift(); if (aWins) lane.spentA += 1; else lane.spentB += 1; // 离场（记控路·同原退场口径）
    const wsd = sideOf(b, winSide);
    wsd.pokerDeck.push({ kind: 'poker', id: wf.id, rank: wf.rank, suit: wf.suit, general: wf.general, buff: wf.buff, cost: wf.cost }); // 回牌库
    wsd.mana += (wf.cost ?? 0) / 2; // 返还一半花费（半整数）
  }
  b.a.mana += b.a.tengangA.clashElixir; b.b.mana += b.b.tengangA.clashElixir; // 战潮：每遭遇返召唤源泉（喂经济）
}

// 单列向敌推进（有敌前锋）：各兵 +dir×speed(疾行2格)·保 slot 间距 1·前锋停在敌前锋相邻格(不重叠)；已过门兵留原地。
function advanceColumnVsFoe(own: TurnUnit[], dir: number, foeFrontSlot: number, diverted: Set<string>): void {
  for (let i = 0; i < own.length; i++) {
    if (diverted.has(own[i].id)) continue; // 本回合已过门 → 不再直进
    let t = own[i].slot + dir * (own[i].speed ?? 1);
    if (i > 0) { const ahead = own[i - 1].slot; t = dir > 0 ? Math.min(t, ahead - 1) : Math.max(t, ahead + 1); }
    else { const limit = foeFrontSlot - dir; t = dir > 0 ? Math.min(t, limit) : Math.max(t, limit); } // 停在敌前锋前一格
    own[i].slot = t;
  }
}
// 单列向敌家推进（本路无敌）：越过敌区末格 → 敌大本营 −1(攻城锤多 chip)·该兵退场（死守可吸我家首破）。
function advanceColumnToBase(b: TurnBattle, own: TurnUnit[], dir: number, side: 'a' | 'b', diverted: Set<string>): void {
  for (let i = 0; i < own.length; i++) {
    if (diverted.has(own[i].id)) continue;
    let t = own[i].slot + dir * (own[i].speed ?? 1);
    if (i > 0) { const ahead = own[i - 1].slot; t = dir > 0 ? Math.min(t, ahead - 1) : Math.max(t, ahead + 1); }
    own[i].slot = t;
  }
  const goal = side === 'a' ? A_GOAL : B_GOAL;
  for (let i = own.length - 1; i >= 0; i--) {
    const past = dir > 0 ? own[i].slot > goal : own[i].slot < goal;
    if (!past) continue;
    own.splice(i, 1);
    if (side === 'a') b.homeB = Math.max(0, b.homeB - (1 + b.a.tengangA.siegeChip)); // 攻城锤：破敌家多 chip
    else if (b.homeAShieldUsed < b.a.tengangA.siegeDefend) b.homeAShieldUsed += 1; // 死守：我家首破免疫(吸收·不掉血)
    else b.homeA = Math.max(0, b.homeA - 1);
  }
}
// 行动阶段（owner 2026-06-21 同步推进模型·替原"只推 active 方"·PvP 地基）：①双方捷径门分流 →
// ②三路两军兵线**同时**向对家推进·前锋相遇才掷命/无敌则抵家 chip。放置回合不调用此函数（放置无 Action）。
function advanceBoth(b: TurnBattle): void {
  const diverted = new Set<string>(); // ① 双方门都处理（过门兵记入·不再直进）
  for (let gi = 0; gi < GATES.length; gi++) { const id = gateMove(b, gi); if (id) diverted.add(id); }
  for (let li = 0; li < 3; li++) { // ② 两线同时推进；前锋相遇才掷命
    const lane = b.lanes[li]; const A = lane.a, B = lane.b;
    if (A.length && B.length) {
      const bFrontPre = B[0].slot; // 用推进前的敌前锋夹我方·再用我方新前锋夹敌方（确定性·同步逼近）
      advanceColumnVsFoe(A, 1, bFrontPre, diverted);
      advanceColumnVsFoe(B, -1, A[0].slot, diverted);
      if (Math.abs(A[0].slot - B[0].slot) <= 1) resolveClash(b, li); // 相邻 → 遭遇掷命
    } else if (A.length) advanceColumnToBase(b, A, 1, 'a', diverted);
    else if (B.length) advanceColumnToBase(b, B, -1, 'b', diverted);
  }
}

function checkWinner(b: TurnBattle): void {
  if (b.homeB <= 0 && b.homeA <= 0) b.winner = 'draw';
  else if (b.homeB <= 0) b.winner = 'a';
  else if (b.homeA <= 0) b.winner = 'b';
}

// 结束当前放置回合（owner 2026-06-21 同步推进模型·PvP 地基）：**放置回合无 Action(战斗)**——
// 我方结束→敌方放置回合(+源泉)；敌方结束→**行动阶段**(两军兵线同时推进·前锋相遇才掷命)→判负→回我方放置、回合数+1。
export function endTurn(b: TurnBattle): void {
  if (b.winner !== 'pending') return;
  if (b.active === 'a') {
    b.active = 'b'; // 我方放置完 → 敌方放置回合（不推进·无战斗）
    b.b.mana += MANA_PER_TURN; // 回合开始 +1 召唤源泉
    if (b.dishaB.bonusMana > 0) b.b.mana += b.dishaB.bonusMana; // 地煞·大军压境/机动调度：Boss 多铺(免费多动)
    b.actionTaken = null;
  } else {
    advanceBoth(b); // 敌方放置完 → 行动阶段：两军同时推进 + 相遇掷命
    checkWinner(b);
    if (b.winner !== 'pending') return;
    b.active = 'a'; // 下一轮回到我方放置回合
    b.a.mana += MANA_PER_TURN;
    b.actionTaken = null;
    b.turn += 1;
  }
}

// ── Boss 通用 utility AI（doc27 §八·甲一次写好·零 per-boss 代码·性格全在 aiProfile 数据）──
// 每回合：枚举可行动作(放兵×路 / 打天罡 / 抽兵·抽天罡) → 效用函数(局面因子 × 画像权重)打分 → 选最高(seed 破平局)。
// 难度 aiTier：低档有概率选次优(会犯错·好赢)·高档总最优。确定性(单一 rng)·可回放·可喂仿真。教学关用固定脚本(不走此)。
const wt = (v: number): number => v / 10; // 画像 0-10 → 权重 0-1
// 放兵到某路的效用：路偏好(铺/专) + 攻击性×目标偏好(弱/强/将) + 方阵扎堆协同 + 兵牌强度。
function scoreDeploy(b: TurnBattle, card: PokerCard, lane: number): number {
  const p = b.aiProfile; const own = b.lanes[lane].b; const foe = b.lanes[lane].a; const foeFront = foe[0];
  let s = 10 + cardPoints(card.rank) * 0.4; // 基础 + 强牌更值
  s += (p.lanePref >= 5 ? -own.length : own.length) * (Math.abs(p.lanePref - 5) / 5) * 5; // 铺(少己兵处)↔专(扎堆)
  const ag = wt(p.aggression);
  if (p.targetPref === 'weak') s += (foe.length === 0 ? 7 : -(foeFront ? foeFront.points : 0) * 0.4) * ag; // 避实击虚
  else if (p.targetPref === 'strong') s += (foeFront ? foeFront.points : 0) * 0.4 * ag; // 硬碰强
  else s += (foe.some((u) => u.general) ? 9 : 0) * ag; // 取主将路(斩首)
  if (b.dishaB.phalanxPerAdj > 0) s += own.length * 1.5; // 地煞·方阵/连环：扎堆协同
  return s;
}
// 打天罡效用：早放↔攒(spellEager) + 场上己兵越多越值得加 buff。
function scoreCast(b: TurnBattle): number {
  const units = b.lanes.reduce((n, L) => n + L.b.length, 0);
  return 7 + b.aiProfile.spellEager * 1.0 + units * 0.6;
}
// 抽牌效用：手空更该抽 + economy 囤(低)更爱抽攒手牌。抽天罡随 spellEager。
function scoreDraw(b: TurnBattle, from: 'poker' | 'tengang'): number {
  const sd = b.b; const have = sd.hand.filter((c) => (from === 'poker' ? c.kind === 'poker' : c.kind === 'tengang')).length;
  if (from === 'poker') return (have === 0 ? 9 : 4 - have) + (10 - b.aiProfile.economy) * 0.3;
  return (have === 0 ? b.aiProfile.spellEager * 0.7 : 0.5);
}
type AiCand = { kind: 'deploy' | 'cast' | 'draw'; handIdx: number; lane: number; from: 'poker' | 'tengang'; score: number };
/** Boss 回合（utility AI）。aggTengang：caller(game-g) 传天罡聚合器 → Boss 施法后重算 tengangA 即时生效(避免 turn-combat ← blueprint 环依赖)。 */
export function aiTakeTurn(b: TurnBattle, aggTengang?: (ids: readonly string[]) => TengangFx): void {
  if (b.winner !== 'pending' || b.active !== 'b') return;
  // 大炮兵（地煞·关4）：每 N 回合压你兵最多的一路 → 该路你掷命 −winPct（应用到你下个推进的遭遇）。
  b.batteryLane = (b.dishaB.batteryEveryTurns > 0 && b.turn % b.dishaB.batteryEveryTurns === 0)
    ? [0, 1, 2].reduce((m, li) => (b.lanes[li].a.length > b.lanes[m].a.length ? li : m), 0) : -1;
  const sd = b.b; const mistakeChance = Math.max(0, 0.5 - b.aiTier * 0.12); // 低档会犯错·高档总最优
  let guard = 0;
  while (guard++ < 40) {
    const locked = b.actionTaken; const cands: AiCand[] = [];
    if (locked === null || locked === 'deploy') {
      sd.hand.forEach((c, i) => { if (c.kind === 'poker' && (c.cost ?? DEPLOY_COST) <= sd.mana) for (const lane of [0, 1, 2]) cands.push({ kind: 'deploy', handIdx: i, lane, from: 'poker', score: scoreDeploy(b, c, lane) }); }); // 只考虑买得起的兵
    }
    if ((locked === null || locked === 'cast') && sd.mana >= CAST_COST) {
      sd.hand.forEach((c, i) => { if (c.kind === 'tengang') cands.push({ kind: 'cast', handIdx: i, lane: 0, from: 'poker', score: scoreCast(b) }); });
    }
    if (locked === null && sd.mana >= DRAW_COST) {
      if (sd.pokerDeck.length) cands.push({ kind: 'draw', handIdx: -1, lane: 0, from: 'poker', score: scoreDraw(b, 'poker') });
      if (sd.tengangDeck.length) cands.push({ kind: 'draw', handIdx: -1, lane: 0, from: 'tengang', score: scoreDraw(b, 'tengang') });
    }
    if (cands.length === 0) break;
    const pick = nextRandom(b.rng) < mistakeChance ? cands[Math.floor(nextRandom(b.rng) * cands.length)] : cands.reduce((bst, c) => (c.score > bst.score ? c : bst), cands[0]);
    let ok = false;
    if (pick.kind === 'deploy') ok = deployUnit(b, 'b', pick.handIdx, pick.lane);
    else if (pick.kind === 'cast') { ok = castTengang(b, 'b', pick.handIdx); if (ok && aggTengang) { sd.tengangA = aggTengang(sd.castIds); sd.castFx = sd.castIds.map((id) => ({ id, fx: aggTengang([id]) })); } } // 施法即重算·当回合推进生效（+逐张 castFx 供溯源）
    else ok = drawCard(b, 'b', pick.from);
    if (!ok) break;
  }
  endTurn(b);
}

// 战局是否还有未决（任一路有兵 / 任一方手牌或牌库还能动）——给跑到底/仿真台用。
export function turnActive(b: TurnBattle): boolean {
  if (b.winner !== 'pending') return false;
  const sideCanProgress = (s: TurnSide): boolean => s.hand.length > 0 || s.pokerDeck.length > 0 || s.tengangDeck.length > 0;
  return b.lanes.some((l) => l.a.length || l.b.length) || sideCanProgress(b.a) || sideCanProgress(b.b);
}

// 确定性状态指纹（逐回合对比·回归 + 仿真台）：回合/谁/召唤源泉/手牌数/各路前锋 slot+队长/大本营/rng 序。
export function turnHash(b: TurnBattle): string {
  const lane = (l: TurnLane): string => `${l.a.length}@${l.a[0]?.slot ?? '_'},${l.b.length}@${l.b[0]?.slot ?? '_'},${l.aGenDead ? 1 : 0}${l.bGenDead ? 1 : 0},${l.spentA},${l.spentB}`;
  return `T${b.turn}|${b.active}|mA${b.a.mana}|mB${b.b.mana}|hA${b.a.hand.length}|hB${b.b.hand.length}|HA${b.homeA}|HB${b.homeB}|w${b.winner}|s${b.rng.sequence}|g${b.gatesOpen.map((o) => (o ? 1 : 0)).join('')}|${b.lanes.map(lane).join('|')}`;
}
