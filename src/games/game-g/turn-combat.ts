// turn-combat.ts —— doc24 单机回合制战斗模型（owner 2026-06-19 大转向 · 取代 doc21 实时 CR）。
// A0 头号任务：把"驱动层"从 实时(live-combat rAF 连续行军 + 召唤源泉时间 regen + 读秒暂停) 换成 **回合制状态机**。
// 原封保留并复用：掷命对决核(clash-resolve) · 三路 · 3 血大本营 · 公平骨架(cardPoints) · 天罡 apply(TengangFx) · 续航(cardStamina)。只换驱动。
//
// 棋盘(doc24 §一)：每路一条 **9 格 slot 轨** —— 我方区 slot 0..3 · 中线 4 · 敌方区 5..8。我兵向 8(敌家)推、敌兵向 0(我家)推；先破敌 3 血大本营胜。
// 回合(doc24 §二)：① 回合开始 +1 召唤源泉 → ② 选「一类」互斥动作(抽/放[+机关]/打天罡/弃·同类无限) → ③ 结束→**推进一格**→相邻遭遇→掷命(doc19 原封)。
// 确定性：单一 seeded PRNG（同 live-combat·掷命点同序消费）；同输入流 → 同 turnHash、可回放、可喂仿真台。纯 game-side、零引擎。
//
// 战斗屏：回合制走 turn-battle-screen.ts（live）。旧实时核（showMatch + battle-screen.ts 渲染器）已**退役删除**（2026-06-21）；本模块仍从 live-combat.ts 复用 cardStamina/掷命核/TengangFx 等纯件。
import { winrate, pEff, cardPoints, CLASH_K } from './clash-resolve.js';
import { nextRandom } from '@atom-skills/index.js';
import type { RandomSeed } from '@engine/protocol/components.js';
import { cardStamina, NO_TENGANG, type TengangFx, type ClashEvent, type ClashCard } from './combat-types.js';
import { aggregateDisha, splitDisha, type DishaFx } from './disha.js';

// ── 棋盘几何（doc24 §一）──
export const SLOTS = 9;          // 每路格数：我方 0..3 / 中线 4 / 敌方 5..8
export const A_DEPLOY_SLOT = 0;  // 放牌区起点=自家大本营边(slot 0)；新兵落最靠家的空格(0→1→2 向中线填)·从家行军出去(owner 2026-06-20)
export const B_DEPLOY_SLOT = 8;  // 敌方对称：放牌区起点=敌家边(slot 8)·新兵落 8→7→6
export const A_GOAL = 8;         // 我兵越过此格(→9) → 敌大本营 −1 血
export const B_GOAL = 0;         // 敌兵越过此格(→−1) → 我大本营 −1 血
// ── 回合经济（doc24 §四·真机调；各 cost 暂定 1）──
export const TURN_HOME_BLOOD = 3;
export const MANA_START = 3, MANA_PER_TURN = 1; // 起始 3 点（owner 2026-06-29 ①·双方公平·原 6→3）；每回合 +1（前 10 回合）
export const MANA_PER_TURN_LATE = 2, MANA_RAMP_TURN = 10; // 第 10 回合后提速到 +2（owner 2026-06-21·后期放大节奏）
/** 该回合开始应 +多少召唤源泉（turn>10 提速到 2·否则 1）。 */
export const manaGain = (turn: number): number => (turn > MANA_RAMP_TURN ? MANA_PER_TURN_LATE : MANA_PER_TURN);
export const DRAW_COST = 1, DEPLOY_COST = 0, CAST_COST = 1, DISHA_COST = 2; // 抽/打天罡 花召唤源泉；放牌按 rank 收费(契约B·写在卡 cost 上)；地煞牌固定 2
export const DISCARD_REFUND = 0.5; // 弃牌返还 0.5 召唤源泉（owner 2026-06-21·源泉自此为半整数粒度）
export const OPENING_HAND = 3; // 起手摸 N（doc24 §六/七 待定）
export const HAND_MAX = 8; // 手牌上限（天罡·广纳 handMaxAdd 抬高）
const MORALE_PTS = 2, ROUT_PTS = 4; // 同 live-combat/doc06：主将在→下属 +战力 / 主将亡→溃散 −战力
// 战损档（owner 2026-06-29 v2·胜者留场不回库·改掷「三面命运」定疲劳战损%）：每胜一场按 (点数+养成)×pct 累加疲劳·扣战力。
// 强兵连胜越打越疲→弱兵车轮能磨死它。**常量可调**（日后天罡可改·节奏/难度旋钮）。
export const WAR_LOSS_TIERS = [0.25, 0.5, 0.75] as const;
export const WIN_CAP = 3; // 连胜上限（owner 2026-06-29）：一张兵最多打 3 场 → 满 3 必须光荣离场（回牌库 + 全额返还泉水）·防强兵无限霸场

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
export interface TurnUnit { id: string; rank: string; suit: string; points: number; buff: number; general: boolean; stamina: number; staminaLeft: number; slot: number; speed?: number; cost?: number; fatigue?: number; wins?: number } // fatigue=战损累减战力(owner 2026-06-29 v2·胜者留场每胜疲劳)；wins=连胜场数(显示·疲劳越叠越弱→弱兵可车轮磨死强兵)；cost=部署所花源泉
// 行军速度（owner 2026-06-21）：大王/小王(★/王/JOKER) 与 老K 三类高阶兵·疾行 2 格/回合；其余 1 格。纯 rank 派生·确定性。
const FAST_RANKS = new Set(['★', '王', 'JOKER', 'K']);
export function unitSpeed(rank: string): number { return FAST_RANKS.has(rank) ? 2 : 1; }
// 一路：双方兵列（own[0] = 前锋·最贴敌）+ 捷径门开关 + 主将阵亡/续航退场记账。
export interface TurnLane { a: TurnUnit[]; b: TurnUnit[]; aGenDead: boolean; bGenDead: boolean; spentA: number; spentB: number }
// 手牌/牌库卡：扑克兵(上场) / 天罡(施法·id)。
export interface PokerCard { kind: 'poker'; id: string; rank: string; suit: string; general: boolean; buff: number; cost?: number } // cost=放牌召唤源泉费(契约B·deployCost·建库时按 rank 写在卡上·缺省=DEPLOY_COST·避免 turn-combat←blueprint 环依赖)
export interface TengangHandCard { kind: 'tengang'; id: string }
export interface DishaHandCard { kind: 'disha'; id: string } // 地煞牌(owner 2026-06-21·混合)：Boss 手牌·cost2 打出 → 该地煞 fx 整场生效
export type Card = PokerCard | TengangHandCard | DishaHandCard;
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
  dishaBaseIds: string[]; dishaCastIds: string[]; // 地煞被动基线 ids(开局聚合) + 已打出的可施放地煞 ids(打一张并进 dishaB 重算)
  aiProfile: AiProfile; aiTier: number; // Boss 通用 utility AI（doc27 §八）：画像 + 难度档(高=更优·低=会犯错)
  homeAShieldUsed: number; // 死守(天罡 siegeDefend)：我大本营已吸收次数
  fortuneBuff: number; // 今日卦象加成（owner 2026-06-21）：大吉+2 / 吉+1 / 中庸0 / 小凶−1 / 大凶−2 → 玩家部署每张兵追加此 buff
}

const mkLane = (): TurnLane => ({ a: [], b: [], aGenDead: false, bGenDead: false, spentA: 0, spentB: 0 });
const mkSide = (pokerDeck: PokerCard[] = [], tengangDeck: TengangHandCard[] = []): TurnSide =>
  ({ mana: MANA_START, hand: [], pokerDeck: [...pokerDeck], tengangDeck: [...tengangDeck], castIds: [], tengangA: NO_TENGANG, castFx: [] });

export interface TurnInit { seed: number; homeMax?: number; disha?: readonly string[]; aiProfile?: AiProfile; aiTier?: number; fortuneBuff?: number; a?: { pokerDeck?: PokerCard[]; tengangDeck?: TengangHandCard[] }; b?: { pokerDeck?: PokerCard[]; tengangDeck?: TengangHandCard[] } }
/** 开战 init（doc24 §七）：三路 ×9 空轨；双方大本营 3 hp；召唤源泉=起步；A 先手。牌库由 caller（game-g/save）喂；起手摸由 caller 调 drawCard。
 *  cfg.disha：Boss 关卡地煞 id 集（doc23 §八）→ 聚合成 dishaB 在 Boss 侧 apply；温泉关死守覆写 Boss 大本营血。 */
export function initTurnBattle(cfg: TurnInit): TurnBattle {
  const homeMax = cfg.homeMax ?? TURN_HOME_BLOOD;
  // 地煞拆分（owner 2026-06-21·混合）：被动型开局聚合进 dishaB；可施放型进 Boss 手牌·打出才并入。
  const { passive, playable } = splitDisha(cfg.disha ?? []);
  const dishaB = aggregateDisha(passive);
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
    dishaBaseIds: passive, dishaCastIds: [],
    aiProfile: cfg.aiProfile ?? NEUTRAL_AI, aiTier: cfg.aiTier ?? 2,
    homeAShieldUsed: 0, fortuneBuff: cfg.fortuneBuff ?? 0,
  };
  for (const id of playable) battle.b.hand.push({ kind: 'disha', id }); // 可施放地煞 → Boss 起手即在手·AI 攒够 2 源泉择机打
  // owner 2026-06-29 ①：双方公平起步——a/b 皆 MANA_START(3) 源泉、皆摸 OPENING_HAND(caller) 手牌。
  // 不再「先手 6 / 后手 0」。turn-1 双方都用 3 起步预算放牌；每回合 +1 从 turn-2 起对称累加（见 endTurn）。
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
  const extraBuff = side === 'a' ? b.fortuneBuff : 0; // 今日卦象：玩家部署兵追加卦象 buff
  col.push({ id: card.id, rank: card.rank, suit: card.suit, points: cardPoints(card.rank), buff: (card.buff ?? 0) + extraBuff, general: card.general, stamina: stam, staminaLeft: stam, slot, speed: unitSpeed(card.rank), cost: card.cost });
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

// ③' 打地煞（owner 2026-06-21·混合）：施手牌第 handIdx 张地煞 → 该 fx 并入 dishaB 整场生效。花 DISHA_COST(2)·与天罡共用 cast 互斥锁。
export function castDisha(b: TurnBattle, side: 'a' | 'b', handIdx: number): boolean {
  if (!canAct(b, side, 'cast', DISHA_COST)) return false;
  const sd = sideOf(b, side); const card = sd.hand[handIdx];
  if (!card || card.kind !== 'disha') return false;
  sd.hand.splice(handIdx, 1); sd.mana -= DISHA_COST; b.actionTaken = 'cast';
  if (side === 'b') { b.dishaCastIds.push(card.id); b.dishaB = aggregateDisha([...b.dishaBaseIds, ...b.dishaCastIds]); } // 并入并重算 dishaB（玩家侧无地煞·仅 Boss 生效）
  onPlayDraw(sd);
  return true;
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
  const fat = u.fatigue ?? 0; // 战损疲劳累减战力（v2·胜者留场每胜叠加）
  if (u.general) return { pEff: pEff(u.points, u.buff - fat + tg + nearDef, mul), shift: 0, tg, nearDef };
  const genDead = side === 'a' ? lane.aGenDead : lane.bGenDead;
  const genHere = col.some((x) => x.general);
  const moraleBonus = genHere ? fx.moraleLeader : 0; // 令旗(旗手)
  const noRoutEff = noRout || fx.noRout > 0; // 督战(天罡) 或 破釜沉舟/死战不退(Boss disha)
  const shift = !genDead ? (genHere ? MORALE_PTS + moraleBonus : 0)
    : fx.revenge > 0 ? fx.revenge // 哀兵：主将亡 → 余部暴怒 +N
    : noRoutEff ? 0               // 督战：主将亡不溃散
    : -ROUT_PTS;                  // 默认：主将亡 → 溃散
  return { pEff: pEff(u.points, u.buff - fat + tg + shift + nearDef, mul), shift, tg, nearDef };
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

// 任意单位「此刻若评估」的有效战力拆解（owner 2026-06-29 ⑥：鼠标悬场上兵 → 看全加成来源）。
// **复用 effPower / tgContribOf 同款门控** → 与真实掷命逐字一致（非另起一套·杜绝预览≠实判）；非前锋亦可预览。
// 返回 ClashCard（同 resolveClash 写 lastClash 的形状）→ 与掷命特写共用 powerRows 格式器（④/⑥ 单一真相）。
export function unitPowerParts(b: TurnBattle, side: 'a' | 'b', li: number, u: TurnUnit): ClashCard {
  const lane = b.lanes[li]; const sd = sideOf(b, side); const fx = sd.tengangA;
  const champ = fx.powerMulHighest > 1 ? championId(b, side) : undefined;
  const dB = b.dishaB;
  const nearDef = side === 'b' && dB.nearBaseSlots > 0 && u.slot >= SLOTS - dB.nearBaseSlots ? dB.nearBasePower : 0; // 隘口守军（仅 Boss 侧·贴家固守）
  const noRout = side === 'b' && dB.noRout;
  const e = effPower(u, lane, side, fx, champ, noRout, nearDef);
  const tgBreak = sd.castFx.map(({ id, fx: f }) => [id, Math.round(tgContribOf(u, lane, side, f))] as [string, number]).filter((r) => r[1] !== 0); // 逐张天罡溯源（同 resolveClash）
  return { rank: u.rank, suit: u.suit, general: u.general, points: u.points, buff: u.buff, morale: e.shift, tengang: e.tg, pEff: e.pEff, tgBreak, nearDef: e.nearDef, fatigue: u.fatigue };
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

// 一路前锋相遇 → 掷命对决（doc19 原封·复用 live-combat 同款解算：tie 阶梯 + kHard/winFloor/noUpset；同序消费 rng → hash 稳）。
function resolveClash(b: TurnBattle, li: number): void {
  const ev = clashEval(b, li); if (!ev) return;
  const lane = b.lanes[li]; const { fa, fb, ea, eb, wr, ba, bb } = ev;
  const roll = nextRandom(b.rng);
  const lossRoll = nextRandom(b.rng); // 战损命运掷（v2·种子化·可回放·替原战胜硬币）：定胜者本场疲劳战损档（WAR_LOSS_TIERS）
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
  b.lastClash = { tick: b.turn, lane: li, winrate: wr, roll, aWins, tie, winStays: true, warLoss: 0, winStreak: 0, a: { id: fa.id, rank: fa.rank, suit: fa.suit, general: fa.general, points: fa.points, buff: fa.buff, morale: ba.shift, tengang: ba.tg, pEff: ea, tgBreak: tgBreakOf(b.a, fa, 'a'), nearDef: ba.nearDef, fatigue: fa.fatigue }, b: { id: fb.id, rank: fb.rank, suit: fb.suit, general: fb.general, points: fb.points, buff: fb.buff, morale: bb.shift, tengang: bb.tg, pEff: eb, tgBreak: tgBreakOf(b.b, fb, 'b'), nearDef: bb.nearDef, fatigue: fb.fatigue } }; // winStays 恒 true（v2 胜者永远留场·不回库）；warLoss/winStreak 下方据战损掷填
  b.clashLog.push(b.lastClash); // 流水（驱动层逐场抽特写）
  b.clashSeq += 1;
  if (!aWins) b.bossWinStreak += 1; // 九战九捷：Boss 胜累积
  // 死战不退（地煞·关1 仅 Boss 主将）：首负不亡 → 残喘退 1 格(向 Boss 家 slot+1)·二次才真死。
  if (aWins && fb.general && b.dishaB.lastStandGeneral && !b.bossLastStandUsed) {
    b.bossLastStandUsed = true; const q = lane.b; const u = q.shift();
    if (u) {
      // BUG#7：退 1 格·主将仍居本列最前（整列后挤填空·不与身后兵换位 → 不会"看着退了两格"）·保一格一兵·确定无 RNG。
      const target = u.slot + 1;
      if (target <= SLOTS - 1) {
        let e = target; while (e <= SLOTS - 1 && q.some((x) => x.slot === e)) e++; // 从退入格起找最近空格
        if (e <= SLOTS - 1) { for (const s of q) if (s.slot >= target && s.slot < e) s.slot += 1; u.slot = target; } // [target,e) 的兵整体后挤 1 填空 → 主将退 1 格
        // e 越界=后方全满到 Boss 家·退无可退 → 主将原地残喘（u.slot 不变·仍最前·不撞）
      }
      q.push(u); q.sort((x, y) => x.slot - y.slot);
      if (b.lastClash) b.lastClash.lastStand = true; // 标记本场触发死战不退 → 特写改显"死战不退·残喘退守"(替误导的"阵亡")
    }
  } else {
    const loser = aWins ? 'b' : 'a';
    killFront(lane, loser); // 输家阵亡
    const relay = sideOf(b, loser).tengangA.relay; // 薪火：一张阵亡 → 同路下一张接棒续航 +N
    const next = colOf(lane, loser)[0]; if (relay > 0 && next) next.staminaLeft += relay;
  }
  // 胜者去留（owner 2026-06-29 v2·取消回库/硬币）：**永远留场继续作战**（战场不空·心流不断）；
  //   改掷「三面命运」(lossRoll)定本场疲劳战损% → 按 (点数+养成)×pct 累加 fatigue·扣战力；连胜 +1。
  //   强兵连胜越打越疲 → 弱兵车轮能磨死它。（死战不退那场 boss 主将未真败·不计胜方战损。）
  const winSide: 'a' | 'b' = aWins ? 'a' : 'b';
  const wq = colOf(lane, winSide); const wf = wq[0];
  if (wf && !b.lastClash.lastStand) {
    const pct = WAR_LOSS_TIERS[Math.min(WAR_LOSS_TIERS.length - 1, Math.floor(lossRoll * WAR_LOSS_TIERS.length))];
    wf.fatigue = (wf.fatigue ?? 0) + Math.round(Math.max(0, wf.points + wf.buff) * pct); // 战损 = 自身基础战力的 pct（累减·疲劳）
    wf.wins = (wf.wins ?? 0) + 1;
    b.lastClash.warLoss = pct; b.lastClash.winStreak = wf.wins;
    if (wf.wins >= WIN_CAP) { // 连胜满 WIN_CAP → 必须光荣离场：回牌库 + 全额返还泉水（owner 2026-06-29·防强兵无限霸场·疲劳满则换防）
      wq.shift(); if (aWins) lane.spentA += 1; else lane.spentB += 1;
      const wsd = sideOf(b, winSide);
      wsd.pokerDeck.push({ kind: 'poker', id: wf.id, rank: wf.rank, suit: wf.suit, general: wf.general, buff: wf.buff, cost: wf.cost }); // 回牌库（重抽出场即满血·疲劳清零）
      wsd.mana += (wf.cost ?? 0); // 全额返还召唤源泉
      b.lastClash.winStays = false; // 满 3 离场 → UI 演「光荣回库」（替原随机硬币·现为达成 3 连胜的应得退场）
    }
  }
  b.a.mana += b.a.tengangA.clashElixir; b.b.mana += b.b.tengangA.clashElixir; // 战潮：每遭遇返召唤源泉（喂经济）
}

// 单列向敌推进（有敌前锋）：各兵 +dir×speed(疾行2格)·保 slot 间距 1·前锋停在敌前锋相邻格(不重叠)；已过门兵留原地。
// pinGeneral（owner 2026-06-29·Boss 主将关前死守）：主将不前移·原地守家（其在队尾贴家·跳过它不影响前方兵推进）。
function advanceColumnVsFoe(own: TurnUnit[], dir: number, foeFrontSlot: number, diverted: Set<string>, pinGeneral = false): void {
  for (let i = 0; i < own.length; i++) {
    if (diverted.has(own[i].id)) continue; // 本回合已过门 → 不再直进
    if (pinGeneral && own[i].general) continue; // Boss 主将死守原地·不前移
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
    if (side === 'b' && own[i].general) continue; // Boss 主将死守原地·不直扑我家（owner 2026-06-29）
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
// 行动阶段（owner 2026-06-29 ②·顺序回合模型·替 2026-06-21 同步推进）：**只推刚结束回合的那一方**——
// 我放完→我方三路向敌家推进/攻击；敌放完→敌方推进/攻击。两军不再同帧一起动（owner「一起行动看不清谁打谁」）。
// ①只处理本方捷径门分流 → ②本方三路向对家推进·前锋相邻则掷命/无敌则抵家 chip。放置回合本身不调用（放置无推进）。
// 推进「移动相」（owner 2026-06-29·拆分移动↔掷命·让 UI 能「先滑到位→弹谁打谁→掷骰→才结算离场」）：
// 只移动本方三路 + 过本方门，**不掷命**；返回前锋相邻、待掷命的路 id（caller 决定何时 resolveClashAt）。
function advanceSideMove(b: TurnBattle, side: 'a' | 'b'): number[] {
  const dir = side === 'a' ? 1 : -1;
  const diverted = new Set<string>(); // ① 只处理本方门（过门兵记入·不再直进）
  for (let gi = 0; gi < GATES.length; gi++) { if (GATES[gi].side !== side) continue; const id = gateMove(b, gi); if (id) diverted.add(id); }
  const pending: number[] = [];
  for (let li = 0; li < 3; li++) { // ② 本方兵线向对家推进；前锋相邻 → 记为待掷命路
    const lane = b.lanes[li]; const own = colOf(lane, side); const foe = colOf(lane, side === 'a' ? 'b' : 'a');
    if (!own.length) continue;
    if (foe.length) { advanceColumnVsFoe(own, dir, foe[0].slot, diverted, side === 'b'); if (Math.abs(own[0].slot - foe[0].slot) <= 1) pending.push(li); }
    else advanceColumnToBase(b, own, dir, side, diverted); // 本路无敌 → 直扑对家大本营
  }
  return pending;
}
// 行动阶段（原子·仿真台/兼容旧调用）：移动 + 逐路掷命一气呵成。live 游戏改用 advanceMovePhase + resolveClashAt 分相演出。
function advanceSide(b: TurnBattle, side: 'a' | 'b'): void {
  for (const li of advanceSideMove(b, side)) resolveClash(b, li);
}
// 当前行动方「只移动·不掷命」→ 返回待掷命路 id（owner 2026-06-29·UI 分相：移动→弹窗→掷骰→结算离场）。
export function advanceMovePhase(b: TurnBattle): number[] {
  if (b.winner !== 'pending') return [];
  return advanceSideMove(b, b.active);
}
// 结算一路掷命（live 在「谁打谁」弹窗 + 掷骰演完后调）→ 写 lastClash/clashLog·应用胜负去留。
export function resolveClashAt(b: TurnBattle, li: number): void { if (b.winner === 'pending') resolveClash(b, li); }
// 推进收尾（判负 + 轮转/回合数/源泉）→ live 在本回合所有掷命演完后调。
export function endTurnFinish(b: TurnBattle): void {
  checkWinner(b);
  if (b.winner !== 'pending') return;
  if (b.active === 'a') {
    b.active = 'b';
    if (b.turn > 1) b.b.mana += manaGain(b.turn); // turn-1 b 已带 MANA_START 起步（①）·turn-2 起对称 +源泉
    if (b.dishaB.bonusMana > 0) b.b.mana += b.dishaB.bonusMana; // 地煞·大军压境/机动调度
  } else {
    b.active = 'a'; b.turn += 1; b.a.mana += manaGain(b.turn);
  }
  b.actionTaken = null;
}

function checkWinner(b: TurnBattle): void {
  if (b.homeB <= 0 && b.homeA <= 0) b.winner = 'draw';
  else if (b.homeB <= 0) b.winner = 'a';
  else if (b.homeA <= 0) b.winner = 'b';
}

// 结束当前回合（owner 2026-06-29 ②·顺序回合）：**放完牌→本方立即推进/攻击**（不再等到敌方回合末两军同动）——
// 我方放完→advanceSide('a')（我方推进+掷命）→判负→敌方回合(+源泉)；敌方放完→advanceSide('b')（敌方推进+掷命）→判负→回我方、回合数+1。
// 源泉（①公平）：turn-1 双方都用 MANA_START(3) 起步、不额外 +；每回合 +1 从 turn-2 起对称累加。
export function endTurn(b: TurnBattle): void {
  if (b.winner !== 'pending') return;
  advanceSide(b, b.active); // 移动 + 逐路掷命（原子）
  endTurnFinish(b);         // 判负 + 轮转/回合数/源泉
}

// ── Boss 通用 utility AI（doc27 §八·甲一次写好·零 per-boss 代码·性格全在 aiProfile 数据）──
// 每回合：枚举可行动作(放兵×路 / 打天罡 / 抽兵·抽天罡) → 效用函数(局面因子 × 画像权重)打分 → 选最高(seed 破平局)。
// 难度 aiTier：低档有概率选次优(会犯错·好赢)·高档总最优。确定性(单一 rng)·可回放·可喂仿真。教学关用固定脚本(不走此)。
const wt = (v: number): number => v / 10; // 画像 0-10 → 权重 0-1

// ── aiTier >= 3 明牌情报（作弊档·Boss 全知全览）──
// 读玩家手牌 + 牌库顶，给各评分函数提供对手视角加成。
function foeIntel(b: TurnBattle): {
  handMaxPts: number;   // 玩家手牌最高底点
  handHasGeneral: boolean; // 玩家手里有没有主将
  nextIsGeneral: boolean;  // 牌库顶3张含主将（即将入手）
  nextMaxPts: number;      // 牌库顶3张最高底点
  laneWinProb: [number, number, number]; // 我方当前这路前锋 vs 玩家前锋：底点差（正=我占优）
} {
  const peek = b.a.pokerDeck.slice(0, 3).filter((c) => c.kind === 'poker') as PokerCard[];
  const handCards = b.a.hand.filter((c) => c.kind === 'poker') as PokerCard[];
  const handMaxPts = handCards.reduce((m, c) => Math.max(m, cardPoints(c.rank)), 0);
  const handHasGeneral = handCards.some((c) => c.general);
  const nextIsGeneral = peek.some((c) => c.general);
  const nextMaxPts = peek.reduce((m, c) => Math.max(m, cardPoints(c.rank)), 0);
  const laneWinProb = [0, 1, 2].map((li) => {
    const myFront = b.lanes[li].b[0]; const foeFront = b.lanes[li].a[0];
    const myPts = myFront ? myFront.points + myFront.buff - (myFront.fatigue ?? 0) : 0; // v2：双方都扣疲劳=真有效战力对比
    const foePts = foeFront ? foeFront.points + foeFront.buff - (foeFront.fatigue ?? 0) : 0;
    return myPts - foePts; // 正数=我占优
  }) as [number, number, number];
  return { handMaxPts, handHasGeneral, nextIsGeneral, nextMaxPts, laneWinProb };
}

// 放兵到某路的效用：路偏好(铺/专) + 攻击性×目标偏好(弱/强/将) + 攻防情势响应(回防空/劣势·趁势压优势路) + 节奏(疾行驰援) + 方阵扎堆 + 兵牌强度。
function scoreDeploy(b: TurnBattle, card: PokerCard, lane: number): number {
  const p = b.aiProfile; const own = b.lanes[lane].b; const foe = b.lanes[lane].a; const foeFront = foe[0];
  // v2 战损感知（owner 2026-06-29·tier≥2 才开·关1 tier1 保序战傻）：看穿玩家前锋**疲劳**→有效战力，挑软柿子车轮消耗。
  const v2 = b.aiTier >= 2;
  const foeEff = foeFront ? Math.max(0, v2 ? foeFront.points + foeFront.buff - (foeFront.fatigue ?? 0) : foeFront.points) : 0; // 玩家前锋战力：v2(tier≥2)看有效战力(含养成−疲劳)·否则同旧(仅点数·不扰 tier1 序战画像)
  let s = 10 + cardPoints(card.rank) * 0.4; // 基础 + 强牌更值
  s += (p.lanePref >= 5 ? -own.length : own.length) * (Math.abs(p.lanePref - 5) / 5) * 5; // 铺(少己兵处)↔专(扎堆)
  const ag = wt(p.aggression);
  if (p.targetPref === 'weak') s += (foe.length === 0 ? 7 : -foeEff * 0.4) * ag; // 避实击虚（v2：疲劳前锋=软柿子·更想打）
  else if (p.targetPref === 'strong') s += foeEff * 0.4 * ag; // 硬碰强
  else s += (foe.some((u) => u.general) ? 9 : 0) * ag; // 取主将路(斩首)
  // v2：玩家前锋已疲劳(战损累积) → 这路是「趁虚补刀/车轮消耗」良机·加权（连胜快满 WIN_CAP-1 的强兵尤其值得逼它退场）。
  if (v2 && foeFront && (foeFront.fatigue ?? 0) > 0) s += Math.min(7, (foeFront.fatigue ?? 0) * 0.6 + ((foeFront.wins ?? 0) >= WIN_CAP - 1 ? 2 : 0)) * (0.5 + ag);
  // 防守威胁响应（owner 2026-06-23·修 sim 实锤「玩家走空路直捣 Boss 家」requests#491）：
  // 玩家(foe)在这路推进、Boss(own)这路空虚 → 通往大本营的高速路·急回防堵漏。仅玩家真有兵才触发
  // （空板=0·不动 ai.test 画像断言）；守性(低 aggression)更看重回防·敌越深(slot→A_GOAL=8)越急。
  if (foe.length > 0) {
    const deepest = foe.reduce((m, u) => Math.max(m, u.slot), 0);
    const defendW = 0.6 + wt(10 - p.aggression) * 0.9; // aggression 低→回防权重高（守性 boss 更补防）
    if (own.length === 0) s += (10 + Math.max(0, deepest - 3) * 3) * defendW;        // 真空漏路：强回防·敌越深越急（防守压过进攻铺场·堵直捣高速路）
    else if (foe.length > own.length) s += (foe.length - own.length) * 2.2 * defendW; // 劣势路：兵力落后则补强
    else s += (own.length - foe.length) * 1.4 * wt(p.aggression);                     // 优势路：趁势压上扩大战果（攻击性放大·收割·win 不是只守平）
    if (foe.length > own.length && unitSpeed(card.rank) === 2) s += 2.5;              // ③ 节奏：吃紧/劣势的路优先派疾行兵(2格/回合·更快驰援堵口)
  }
  if (b.dishaB.phalanxPerAdj > 0) s += own.length * 1.5; // 地煞·方阵/连环：扎堆协同
  // 全知视角加成（aiTier >= 3）：看玩家手牌 + 牌库顶，做更精准的反制决策。
  if (b.aiTier >= 3) {
    const intel = foeIntel(b);
    const myPts = cardPoints(card.rank) + (card.buff ?? 0);
    const foePts = foeEff; // v2：按玩家前锋**扣疲劳后**的有效战力判占优/劣势（疲劳软柿子=可压）
    if (myPts > foePts + 3) s += 4;   // 这路我方明显占优 → 力压
    if (myPts < foePts - 3) s -= 3;   // 这路我方明显劣势 → 避开
    if (intel.nextIsGeneral && foe.length === 0) s += 5; // 玩家即将入手主将 → 抢占空路
    if (intel.handHasGeneral && foe.some((u) => u.general)) s += 3; // 玩家主将在此路 → 施压
    if (intel.handMaxPts > cardPoints(card.rank) + 4) s -= 2; // 玩家手牌比我这张强很多 → 换路
  }
  return s;
}
// 打天罡效用：早放↔攒(spellEager) + 场上己兵越多越值得加 buff。
function scoreCast(b: TurnBattle): number {
  const units = b.lanes.reduce((n, L) => n + L.b.length, 0);
  let s = 7 + b.aiProfile.spellEager * 1.0 + units * 0.6;
  // 全知加成：玩家下一张是强牌/主将 → 赶紧先施天罡占优。
  if (b.aiTier >= 3) {
    const intel = foeIntel(b);
    if (intel.nextIsGeneral || intel.nextMaxPts >= 12) s += 4;
    if (intel.handHasGeneral) s += 2;
  }
  return s;
}
// 打地煞效用（owner 2026-06-21）：攒够 2 源泉 + 场上有兵(加成有受益对象)才值得开；越多兵越值、aggression 推一把。空场不急（低于抽/铺）。
function scoreDisha(b: TurnBattle): number {
  const units = b.lanes.reduce((n, L) => n + L.b.length, 0);
  return (units > 0 ? 11 : 3) + units * 0.9 + b.aiProfile.aggression * 0.5;
}
// 抽牌效用：手空更该抽 + economy 囤(低)更爱抽攒手牌。抽天罡随 spellEager。
function scoreDraw(b: TurnBattle, from: 'poker' | 'tengang'): number {
  const sd = b.b; const have = sd.hand.filter((c) => (from === 'poker' ? c.kind === 'poker' : c.kind === 'tengang')).length;
  let s: number;
  if (from === 'poker') s = (have === 0 ? 9 : 4 - have) + (10 - b.aiProfile.economy) * 0.3;
  else s = (have === 0 ? b.aiProfile.spellEager * 0.7 : 0.5);
  // 全知加成：知道自己牌库顶是强牌/主将 → 更积极抽。
  if (b.aiTier >= 3 && from === 'poker' && sd.pokerDeck.length > 0) {
    const top = sd.pokerDeck[0]; if (top.kind === 'poker') {
      if (top.general) s += 5;          // 主将在库顶 → 立刻抽
      else if (cardPoints(top.rank) >= 12) s += 3; // 强牌（Q/K/A）
    }
  }
  return s;
}
type AiCand = { kind: 'deploy' | 'cast' | 'draw' | 'disha'; handIdx: number; lane: number; from: 'poker' | 'tengang'; score: number };
/** Boss 决策阶段（utility AI·只放牌/施法/抽·**不结束回合不推进**）。owner 2026-06-29：拆出「敌方决策」与「敌方行动」
 *  两阶段→ caller 可在两者间插「敌方决策」过场 + 渲染让玩家看清敌方布阵，再单独 endTurn 演「敌方行动」推进动画。
 *  aggTengang：caller(game-g) 传天罡聚合器 → Boss 施法后重算 tengangA 即时生效。返回本回合打出的地煞 id（caller 全屏通知·REQ-G #6）。 */
export function aiDecide(b: TurnBattle, aggTengang?: (ids: readonly string[]) => TengangFx): string[] {
  const castDishaIds: string[] = [];
  if (b.winner !== 'pending' || b.active !== 'b') return castDishaIds;
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
    if ((locked === null || locked === 'cast') && sd.mana >= DISHA_COST) {
      sd.hand.forEach((c, i) => { if (c.kind === 'disha') cands.push({ kind: 'disha', handIdx: i, lane: 0, from: 'poker', score: scoreDisha(b) }); });
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
    else if (pick.kind === 'disha') { const dc = sd.hand[pick.handIdx]; ok = castDisha(b, 'b', pick.handIdx); if (ok && dc?.kind === 'disha') castDishaIds.push(dc.id); } // 打地煞 → 记 id 供 caller 全屏通知
    else ok = drawCard(b, 'b', pick.from);
    if (!ok) break;
  }
  return castDishaIds;
}

/** Boss 整回合（决策 + 行动一气呵成·仿真台/兼容旧调用用）。live 游戏改用 aiDecide + endTurn 分两阶段演出（owner 2026-06-29）。 */
export function aiTakeTurn(b: TurnBattle, aggTengang?: (ids: readonly string[]) => TengangFx): string[] {
  const ids = aiDecide(b, aggTengang);
  endTurn(b);
  return ids;
}

export const BOSS_GARRISON_MANA = 3; // 开局布防预算（owner 2026-06-29「稍微减少一点」·9→3：留一小条设防线·非满线碾压·v2 按基础牌后裸点数下不宜过大）
/** 开局布防（owner 2026-06-29）：玩家首回合前 Boss 用 setupMana 一次性预算布一线防御（放牌/施法·可能顺手开地煞·**不推进不结束回合**）
 *  → 玩家是「攻打已设防的 Boss 阵地」而非走空场；Boss 也借此有兵在场→其地煞(需 units>0)开局即可发动。预算独立于回合经济：
 *  布完把 Boss 源泉还原到正常 turn-1 起步(MANA_START)，不挤占其后续回合 → 净效果＝Boss 免费多一条开局线（提难度）。 */
export function bossOpeningGarrison(b: TurnBattle, setupMana: number, aggTengang?: (ids: readonly string[]) => TengangFx): string[] {
  if (b.turn !== 1 || b.winner !== 'pending') return [];
  const savedActive = b.active, savedAction = b.actionTaken;
  b.active = 'b'; b.b.mana = setupMana; b.actionTaken = null;
  const dishaIds = aiDecide(b, aggTengang); // Boss 布防（不 endTurn·不推进）
  b.active = savedActive; b.actionTaken = savedAction; b.b.mana = MANA_START; // 还原回合态·Boss 正常 turn-1 经济（布防免费）
  return dishaIds;
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
