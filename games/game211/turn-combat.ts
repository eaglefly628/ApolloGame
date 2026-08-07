// turn-combat.ts —— doc24 单机回合制战斗模型（owner 2026-06-19 大转向 · 取代 doc21 实时 CR）。
// A0 头号任务：把"驱动层"从 实时(live-combat rAF 连续行军 + 召唤源泉时间 regen + 读秒暂停) 换成 **回合制状态机**。
// 原封保留并复用：掷命对决核(clash-resolve) · 三路 · 3 血大本营 · 公平骨架(cardPoints) · 天罡 apply(TengangFx) · 续航(cardStamina)。只换驱动。
//
// 棋盘(doc24 §一)：每路一条 **9 格 slot 轨** —— 我方区 slot 0..3 · 中线 4 · 敌方区 5..8。我兵向 8(敌家)推、敌兵向 0(我家)推；先破敌 3 血大本营胜。
// 回合(doc24 §二)：① 回合开始 +1 召唤源泉 → ② 选「一类」互斥动作(抽/放[+机关]/打天罡/弃·同类无限) → ③ 结束→**推进一格**→相邻遭遇→掷命(doc19 原封)。
// 确定性：单一 seeded PRNG（同 live-combat·掷命点同序消费）；同输入流 → 同 turnHash、可回放、可喂仿真台。纯 game-side、零引擎。
//
// 战斗屏：回合制走 turn-battle-screen.ts（live）。旧实时核（showMatch + battle-screen.ts 渲染器）已**退役删除**（2026-06-21）；本模块仍从 live-combat.ts 复用 cardStamina/掷命核/TengangFx 等纯件。
import { pEff, cardPoints, P_MIN, P_MAX, rollWithMods, rollWinProbMods, type RollMods } from './clash-resolve.js';
import { nextRandom } from '@zerocraft/engine/atom-skills/index.js';
import type { RandomSeed } from '@zerocraft/engine/engine/protocol/components.js';
import { cardStamina, NO_TENGANG, type TengangFx, type ClashEvent, type ClashCard } from './combat-types.js';
import { aggregateDisha, splitDisha, type DishaFx } from './disha.js';
import { TIANGANG_BY_ID } from './tiangang-data.js'; // 纯数据·无 import → 无环依赖（读天罡 op 参数供选路 op 施法）

// ── 棋盘几何（doc24 §一）──
export const SLOTS = 9;          // 每路格数：我方 0..3 / 中线 4 / 敌方 5..8
export const A_DEPLOY_SLOT = 0;  // 放牌区起点=自家大本营边(slot 0)；新兵落最靠家的空格(0→1→2 向中线填)·从家行军出去(owner 2026-06-20)
export const B_DEPLOY_SLOT = 8;  // 敌方对称：放牌区起点=敌家边(slot 8)·新兵落 8→7→6
export const A_GOAL = 8;         // 我兵越过此格(→9) → 敌大本营 −1 血
export const B_GOAL = 0;         // 敌兵越过此格(→−1) → 我大本营 −1 血
// ── 回合经济（doc24 §四·真机调；各 cost 暂定 1）──
export const TURN_HOME_BLOOD = 3;
export const MANA_START = 4, MANA_PER_TURN = 1; // 起手源泉 4（owner 2026-06-23 REQ-G-起手源泉·双方对称·6→3→4·4vs3 未最终拍板·先按 4·一行常量）；每回合 +1（前 10 回合）
export const MANA_CAP = 10; // 源泉累积上限（owner 2026-07-04 拍板·bug：无处可花时一路涨到 15→封顶 10·双方对称；满 10 再 += 为浪费→源泉 sink「源泉换战力/直接施法」另议）
export const MANA_PER_TURN_LATE = 2, MANA_RAMP_TURN = 10; // 第 10 回合后提速到 +2（owner 2026-06-21·后期放大节奏）
/** 该回合开始应 +多少召唤源泉（turn>10 提速到 2·否则 1）。 */
export const manaGain = (turn: number): number => (turn > MANA_RAMP_TURN ? MANA_PER_TURN_LATE : MANA_PER_TURN);
export const DRAW_COST = 1, DEPLOY_COST = 0, CAST_COST = 1, DISHA_COST = 2; // 抽/打天罡 花召唤源泉；放牌按 rank 收费(契约B·写在卡 cost 上)；地煞牌固定 2
// 选路 op 数值（REQ-G-天罡原生重构 §四.3·策划定案 0bde67dc·部分待 sim 标）：
export const RUSH_UNITS = 2, RUSH_POWER = 3;      // 驰援：+2 固定援兵·战力3(rank '3'·无 buff·无将)
export const SACRIFICE_BUFF = 8;                  // 舍车：另两路当前兵各 +8 战力（快照·起标 8·待 sim）
export const IRONCHAIN_TURNS = 2;                 // 铁索：敌全军 speed−1 持续 2 回合
export const DISCARD_REFUND = 0.5; // 弃牌返还 0.5 召唤源泉（owner 2026-06-21·源泉自此为半整数粒度）——旧「免费纯弃牌」·已被换牌(swapCard)取代退役（owner 2026-07-03·弃了不补=没用）
export const SWAP_PER_TURN = 1, SWAP_COST = 0; // 换牌（owner 2026-07-03·三行为自由）：选中手牌 1 张 → 弃 + 从指定库随机补 1 张；每回合硬帽 1 次(破无限churn死循环)·免费。未来 Boss 地煞可按关加税/上锁(swapTax/swapLock·明牌杠杆)。
export const OPENING_HAND = 3; // 起手摸 N（doc24 §六/七 待定）
export const HAND_MAX = 8; // 手牌上限（天罡·广纳 handMaxAdd 抬高）
const MORALE_PTS = 2; // 同 live-combat/doc06：主将在→该路下属 +战力（士气光环·live）
// 士气 v2（owner 2026-07-05·REQ-G-主将阵亡士气重构·替旧「永久 −ROUT_PTS(4) 全路溃散」死亡螺旋+反逻辑）：
//   主将阵亡瞬间 → 只给**当时在场**的该路余部盖一枚临时震荡 → 逐回合**线性衰减**、第 N 回合归 0；
//   阵亡后**新部署**的兵 0 惩罚（没见过·可重建）；兵离场即清（不写 pokerDeck·不烙卡·重抽干净）。
export const MORALE_SHOCK_PTS = 3;   // 震荡初值 −N（阵亡当回合满档·owner「−4 夸张→靠 −2/−3」·design G sim 标终值 X=2~3）
export const MORALE_SHOCK_TURNS = 3; // 衰减窗口 N 回合（第 N 回合归 0·owner N=2~3·design G sim 标）
// 战损疲劳（owner 2026-07-06·连续疲劳条·替离散「0.5^wins 对折」）：胜者永远留场；疲劳 = 连续量 `fatiguePm∈[0,1000]`（战力损失千分比）。
//   胜一场 → `fatiguePm += (1000−fatiguePm)×0.5`（0→500→750→875…·有效战力仍逐胜对折·首几场与旧 0.5^wins 逐字等价·「数值对了」）；
//   本轮**不战斗**的在场兵 → `fatiguePm −= REST_RECOVER_PM`（休整回血·夹≥0·回不到负=最多满血）。强兵连战越疲、歇一轮回一成 → 弱兵车轮仍磨得动、但强兵能喘。
//   **无自动退场**（owner 2026-07-06「这设计过时了·没必要退场·满3光荣回库删掉」）：连胜数不再触发回库·纯由疲劳条治理。
//   注：旧「满 WIN_CAP=3 光荣回库」「三面命运掷」「战胜硬币」皆已退役。
export const WAR_LOSS_PER_WIN = 0.5; // 每胜疲劳 += 剩余战力的一半（有效战力对折·owner 2026-07-01 定率·2026-07-06 转连续量口径）
export const REST_RECOVER_PM = 100; // 本轮不战斗休整 → 疲劳回落 100‰（=恢复 10% 战力·owner 2026-07-06「每走一步/下一轮不战就恢复10%」）
// 回合上限·保底收敛（owner 2026-07-06 拍板前置默认·可 veto）：删自动退场 + 加疲劳恢复 → 强兵变「不死」·棋盘不再轮替 →
//   极少数对局（双方龟缩/近赢僵持）会永不分胜负（AI-vs-AI 与脚本活局实测复现）。设回合硬上限：到 MAX_TURNS 未分胜负 → 按大本营血判（高者胜·平则平）。
//   常规对局 ~20-45 回合即结·永远够不到此线（安全网·非平衡旋钮·不动疲劳手感）。turn 已进 turnHash → 判定确定·回放稳。
export const MAX_TURNS = 60;

// ── 捷径门/换路整套已退役（owner 2026-07-03·REQ-G-退役机关门）：不给乐趣·高复杂度低价值·旧实时 CR 遗留概念。
//    Gate/GATES/gatesOpen/gateMove/toggleGate/tryGate + advanceBoth 分流 + deployUnit gateToggle + turnHash g段 + 天罡「城门令」全数删除。
//    兵天生想直走推底破家·中途换路是跟核心目标对着干；真策略深度在部署那一刻选哪条路（田忌赛马）·不在中途改路。

// 场上兵：占一格 slot；续航 staminaLeft 打光退场（同 live-combat 经济）。speed=每回合推进格数(默认1·缺省视作1·向后兼容旧字面量)。
export interface TurnUnit { id: string; rank: string; suit: string; points: number; buff: number; general: boolean; stamina: number; staminaLeft: number; slot: number; speed?: number; cost?: number; wins?: number; fatiguePm?: number; hold?: boolean; moraleShock?: number } // moraleShock=士气震荡到期回合(owner 2026-07-05 士气v2)：主将阵亡瞬间给当时在场余部盖=deathTurn+MORALE_SHOCK_TURNS；clash 时按剩余回合线性衰减出 −战力·到期归0；per-unit 战场态·离场随兵对象丢弃(绝不写 pokerDeck→不烙卡)·新兵无此字段→免疫。// fatiguePm=疲劳千分比(战力损失量·owner 2026-07-06 连续疲劳条·替离散 0.5^wins)：胜→fatiguePm+=(1000−fatiguePm)×0.5(仍≈对折)；本轮不战→−REST_RECOVER_PM(休整回血·夹≥0)；有效战力×(1000−fatiguePm)/1000。wins=累计胜场(仅日志/画像·不再驱动战力)；cost=部署所花源泉；hold=开局排阵守军·静态死守(REQ-G-开局排阵·不前压/不冲家/接触才战/赢守原位)
// 行军速度（owner 2026-06-21）：大王/小王(★/王/JOKER) 与 老K 三类高阶兵·疾行 2 格/回合；其余 1 格。纯 rank 派生·确定性。
const FAST_RANKS = new Set(['★', '王', 'JOKER', 'K']);
export function unitSpeed(rank: string): number { return FAST_RANKS.has(rank) ? 2 : 1; }
// 一路：双方兵列（own[0] = 前锋·最贴敌）+ 捷径门开关 + 主将阵亡/续航退场记账。
export interface TurnLane { a: TurnUnit[]; b: TurnUnit[]; aGenDead: boolean; bGenDead: boolean; spentA: number; spentB: number; aSkipAdvance?: boolean; bSkipAdvance?: boolean } // aSkipAdvance/bSkipAdvance=泥沼(REQ-G-天罡原生重构 §四.3)：该侧本路下次推进跳过一次(即时·用后清)
// 手牌/牌库卡：扑克兵(上场) / 天罡(施法·id)。
export interface PokerCard { kind: 'poker'; id: string; rank: string; suit: string; general: boolean; buff: number; cost?: number } // cost=放牌召唤源泉费(契约B·deployCost·建库时按 rank 写在卡上·缺省=DEPLOY_COST·避免 turn-combat←blueprint 环依赖)
export interface TengangHandCard { kind: 'tengang'; id: string }
export interface DishaHandCard { kind: 'disha'; id: string } // 地煞牌(owner 2026-06-21·混合)：Boss 手牌·cost2 打出 → 该地煞 fx 整场生效
export type Card = PokerCard | TengangHandCard | DishaHandCard;
// 一方运行态：召唤源泉 / 手牌 / 两库 / 已施天罡集 + 其聚合修正。
export interface TurnSide { mana: number; hand: Card[]; pokerDeck: PokerCard[]; tengangDeck: TengangHandCard[]; castIds: string[]; tengangA: TengangFx; castFx: { id: string; fx: TengangFx }[]; swapsUsed: number } // castFx：逐张已打天罡的单卡修正(caller 经 aggregateTengang([id]) 填)·供对决明细逐张溯源；swapsUsed=本回合已换牌次数(每回合重置·硬帽 SWAP_PER_TURN)
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
  homeA: number; homeB: number; homeMax: number;
  a: TurnSide; b: TurnSide;
  rng: RandomSeed; winner: 'a' | 'b' | 'draw' | 'pending';
  actionTaken: ActionKind | null;
  lastClash: ClashEvent | null; clashLog: ClashEvent[]; clashSeq: number; // clashLog：逐场掷命流水（驱动层抽特写·不进 hash）
  foughtNow: string[]; movedNow: string[]; // 本行动相已参战/已前进的兵 id（applyClashOutcome/advanceSideMove 追加·endTurnFinish 休整回血后清）·瞬态·不进 turnHash
  dishaB: DishaFx; bossWinStreak: number; batteryLane: number; bossGenDefeats: number; // 地煞(Boss 招牌战术·doc23 §八)运行态；bossGenDefeats=主将已消耗命数(战败次数·死战不退计数·<N 才残喘退·=N-1 那次真退)
  dishaBaseIds: string[]; dishaCastIds: string[]; // 地煞被动基线 ids(开局聚合) + 已打出的可施放地煞 ids(打一张并进 dishaB 重算)
  aiProfile: AiProfile; aiTier: number; // Boss 通用 utility AI（doc27 §八）：画像 + 难度档(高=更优·低=会犯错)
  homeAShieldUsed: number; // 死守(天罡 siegeDefend)：我大本营已吸收次数
  fortuneBuff: number; // 今日卦象加成（owner 2026-06-21）：大吉+2 / 吉+1 / 中庸0 / 小凶−1 / 大凶−2 → 玩家部署每张兵追加此 buff
  slowA: number; slowB: number; // 铁索(REQ-G-天罡原生重构 §四.3)：该侧全军 speed−1(下限1) 剩余回合数(0=无·敌施铁索时设 N=2·每轮该侧行动后 −1)
}

const mkLane = (): TurnLane => ({ a: [], b: [], aGenDead: false, bGenDead: false, spentA: 0, spentB: 0 });
const mkSide = (pokerDeck: PokerCard[] = [], tengangDeck: TengangHandCard[] = []): TurnSide =>
  ({ mana: MANA_START, hand: [], pokerDeck: [...pokerDeck], tengangDeck: [...tengangDeck], castIds: [], tengangA: NO_TENGANG, castFx: [], swapsUsed: 0 });

export interface TurnInit { seed: number; homeMax?: number; disha?: readonly string[]; aiProfile?: AiProfile; aiTier?: number; fortuneBuff?: number; a?: { pokerDeck?: PokerCard[]; tengangDeck?: TengangHandCard[] }; b?: { pokerDeck?: PokerCard[]; tengangDeck?: TengangHandCard[] }; startFormation?: readonly { rank: string; suit: string; lane: number; slot: number; buff?: number }[] } // startFormation=Boss 开局排阵守军(REQ-G-开局排阵·明牌摆兵·不花源泉·静守 hold)
/** 开战 init（doc24 §七）：三路 ×9 空轨；双方大本营 3 hp；召唤源泉=起步；A 先手。牌库由 caller（game211/save）喂；起手摸由 caller 调 drawCard。
 *  cfg.disha：Boss 关卡地煞 id 集（doc23 §八）→ 聚合成 dishaB 在 Boss 侧 apply；温泉关死守覆写 Boss 大本营血。 */
export function initTurnBattle(cfg: TurnInit): TurnBattle {
  const homeMax = cfg.homeMax ?? TURN_HOME_BLOOD;
  // 地煞拆分（owner 2026-06-21·混合）：被动型开局聚合进 dishaB；可施放型进 Boss 手牌·打出才并入。
  const { passive, playable } = splitDisha(cfg.disha ?? []);
  const dishaB = aggregateDisha(passive);
  const battle: TurnBattle = {
    turn: 1, active: 'a',
    lanes: [mkLane(), mkLane(), mkLane()],
    homeA: homeMax, homeB: dishaB.homeHp > 0 ? dishaB.homeHp : homeMax, homeMax, // 地煞·温泉关死守 → Boss 大本营更厚
    a: mkSide(cfg.a?.pokerDeck, cfg.a?.tengangDeck),
    b: mkSide(cfg.b?.pokerDeck, cfg.b?.tengangDeck),
    rng: { type: 'RandomSeed', seed: cfg.seed, sequence: 0 },
    winner: 'pending', actionTaken: null, lastClash: null, clashLog: [], clashSeq: 0, foughtNow: [], movedNow: [],
    dishaB, bossWinStreak: 0, batteryLane: -1, bossGenDefeats: 0,
    dishaBaseIds: passive, dishaCastIds: [],
    aiProfile: cfg.aiProfile ?? NEUTRAL_AI, aiTier: cfg.aiTier ?? 2,
    homeAShieldUsed: 0, fortuneBuff: cfg.fortuneBuff ?? 0,
    slowA: 0, slowB: 0,
  };
  for (const id of playable) battle.b.hand.push({ kind: 'disha', id }); // 可施放地煞 → Boss 起手即在手·AI 攒够 2 源泉择机打
  // 开局排阵守军（REQ-G-开局排阵·design G）：Boss 明牌摆兵在场·不花源泉·静守 hold（不前压/不冲家/接触才战/赢守原位）。
  for (const f of cfg.startFormation ?? []) {
    const lane = battle.lanes[f.lane]; if (!lane) continue;
    const stam = cardStamina(f.rank);
    lane.b.push({ id: `sf-${f.lane}-${f.slot}-${f.rank}${f.suit}`, rank: f.rank, suit: f.suit, points: cardPoints(f.rank), buff: f.buff ?? 0, general: false, stamina: stam, staminaLeft: stam, slot: f.slot, speed: unitSpeed(f.rank), hold: true });
    lane.b.sort((x, y) => x.slot - y.slot); // 保 slot 升序（前锋=最小 slot·同渲染/推进契约）
  }
  // owner 2026-06-29 ①：双方公平起步——a/b 皆 MANA_START 源泉、皆摸 OPENING_HAND(caller) 手牌。
  // 不再「先手 6 / 后手 0」。turn-1 双方都用起步预算放牌；每回合 +1 从 turn-2 起对称累加（见 endTurn）。
  return battle;
}

const sideOf = (b: TurnBattle, s: 'a' | 'b'): TurnSide => (s === 'a' ? b.a : b.b);
const colOf = (lane: TurnLane, s: 'a' | 'b'): TurnUnit[] => (s === 'a' ? lane.a : lane.b);
const isFaceRank = (r: string): boolean => r === 'A' || r === 'K' || r === 'Q' || r === 'J';

// 能否做这个动作（owner 2026-07-03·三行为自由·源泉唯一门）：只被「轮到本方 + 未分胜负 + 源泉≥cost」限制。
// **大类互斥已退役**——抽/打(天罡/部署扑克)一回合内任意混（源泉稀缺本就是天然的闸·不再叠动作互斥）。
// actionTaken 仅留作「本回合最后一次动作类别」的记录(供 UI 高亮/回归断言)·不再据它拒动作。
function canAct(b: TurnBattle, side: 'a' | 'b', cost: number): boolean {
  if (b.winner !== 'pending' || b.active !== side) return false;
  return sideOf(b, side).mana >= cost;
}

// ① 抽牌：从 poker / tengang 库顶摸一张进手牌，花召唤源泉（互斥·同类无限）。返回是否成功。
export function drawCard(b: TurnBattle, side: 'a' | 'b', from: 'poker' | 'tengang'): boolean {
  if (!canAct(b, side, DRAW_COST)) return false;
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

// ② 放牌：把手牌第 handIdx 张扑克兵部署到 lane（入我方/敌方部署格·队尾排队）。花召唤源泉（自由混·源泉唯一门）。
export function deployUnit(b: TurnBattle, side: 'a' | 'b', handIdx: number, lane: number): boolean {
  const sd = sideOf(b, side); const card = sd.hand[handIdx];
  if (!card || card.kind !== 'poker' || lane < 0 || lane > 2) return false;
  const cost = card.cost ?? DEPLOY_COST; // 放牌按牌点数收费（契约B·建库时已写在卡上·2-4免费/5-7=1/8-10=2/JQKA=3）
  if (!canAct(b, side, cost)) return false;
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
  onPlayDraw(sd); // 川流：放牌后免费补抽
  return true;
}

// ③ 打天罡：施手牌第 handIdx 张天罡 → 进 castIds（持续修正由 caller 经 aggregateTengang 重算喂 tengangA）。花召唤源泉（互斥·同类无限）。
export function castTengang(b: TurnBattle, side: 'a' | 'b', handIdx: number): boolean {
  if (!canAct(b, side, CAST_COST)) return false;
  const sd = sideOf(b, side); const card = sd.hand[handIdx];
  if (!card || card.kind !== 'tengang') return false;
  if (tengangTargetKind(card.id)) return false; // 选路 op 天罡(疾行/泥沼/驰援/舍车/铁索)须走 castTengangAt·此处拒绝(防无目标空施)
  sd.hand.splice(handIdx, 1); sd.mana -= CAST_COST; sd.castIds.push(card.id); b.actionTaken = 'cast';
  onPlayDraw(sd); // 川流：施法后免费补抽（用本次之前已生效的 onPlay）
  return true; // tengangA 重算：caller 做 sd.tengangA = aggregateTengang(sd.castIds)（避免 turn-combat ← blueprint 环依赖）
}

// ③' 打地煞（owner 2026-06-21·混合）：施手牌第 handIdx 张地煞 → 该 fx 并入 dishaB 整场生效。花 DISHA_COST(2)·与天罡共用 cast 互斥锁。
export function castDisha(b: TurnBattle, side: 'a' | 'b', handIdx: number): boolean {
  if (!canAct(b, side, DISHA_COST)) return false;
  const sd = sideOf(b, side); const card = sd.hand[handIdx];
  if (!card || card.kind !== 'disha') return false;
  sd.hand.splice(handIdx, 1); sd.mana -= DISHA_COST; b.actionTaken = 'cast';
  if (side === 'b') { b.dishaCastIds.push(card.id); b.dishaB = aggregateDisha([...b.dishaBaseIds, ...b.dishaCastIds]); } // 并入并重算 dishaB（玩家侧无地煞·仅 Boss 生效）
  onPlayDraw(sd);
  return true;
}

// ③'' 选路 op 天罡（REQ-G-天罡原生重构 §四.3·策划定案·即时一次性·不进 castIds/tengangA）：疾行/泥沼/驰援/舍车/铁索。
// tengangTargetKind：施法前 UI 判该天罡要不要选路 + 选哪侧路。'own-lane'=选我方路 / 'enemy-lane'=选敌方路 / 'global'=无需选(铁索) / null=非选路(走 castTengang 的 fx 卡)。
export function tengangTargetKind(id: string): 'own-lane' | 'enemy-lane' | 'global' | null {
  const p = TIANGANG_BY_ID.get(id)?.params as Record<string, unknown> | undefined; if (!p) return null;
  const op = String(p.op);
  if (op === 'advance' || op === 'reinforce' || op === 'sacrifice' || op === 'jumpToMid') return 'own-lane'; // 疾行/驰援/舍车/抢滩=选我方路
  if (op === 'slow') return p.scope === 'all' ? 'global' : 'enemy-lane'; // 铁索(scope all)=全局 · 泥沼=敌该路
  if (op === 'aoePower') return 'enemy-lane'; // AOE(火攻/齐射/塌方)=选敌方路·范围削战力
  return null;
}
// 疾行：我该路整列即时前进 1 格（镜像 advanceColumnVsFoe·step=1·前锋停敌前一格·守军不动·不触发掷命）。
function advanceLaneOneStep(lane: TurnLane, side: 'a' | 'b'): void {
  const dir = side === 'a' ? 1 : -1;
  const own = colOf(lane, side); const foe = colOf(lane, side === 'a' ? 'b' : 'a'); const foeFront = foe[0]?.slot;
  for (let i = 0; i < own.length; i++) {
    if (own[i].hold) continue;
    let t = own[i].slot + dir;
    if (i > 0) { const ahead = own[i - 1].slot; t = dir > 0 ? Math.min(t, ahead - 1) : Math.max(t, ahead + 1); }
    else if (foeFront != null && (dir > 0 ? own[i].slot <= foeFront : own[i].slot >= foeFront)) { const limit = foeFront - dir; t = dir > 0 ? Math.min(t, limit) : Math.max(t, limit); } // 前锋停敌前一格（仅接近侧·已突穿则不反向顶·修 REQ-G-突深边角）
    own[i].slot = Math.max(0, Math.min(SLOTS - 1, t));
  }
}
// 驰援：该路凭空 +1 固定援兵（战力 RUSH_POWER·无 buff·无将·落部署区空格）。部署区满 → 放不下(返 false)。
function deployReinforcement(b: TurnBattle, side: 'a' | 'b', lane: number): boolean {
  const L = b.lanes[lane]; const col = colOf(L, side); const foeCol = colOf(L, side === 'a' ? 'b' : 'a');
  const occ = new Set([...col, ...foeCol].map((u) => u.slot));
  const zone = side === 'a' ? [A_DEPLOY_SLOT, A_DEPLOY_SLOT + 1, A_DEPLOY_SLOT + 2] : [B_DEPLOY_SLOT, B_DEPLOY_SLOT - 1, B_DEPLOY_SLOT - 2];
  const slot = zone.find((s) => !occ.has(s)); if (slot === undefined) return false;
  const rank = String(RUSH_POWER); const stam = cardStamina(rank);
  col.push({ id: `rush-${lane}-${slot}-${b.turn}-${col.length}`, rank, suit: 'S', points: cardPoints(rank), buff: 0, general: false, stamina: stam, staminaLeft: stam, slot, speed: unitSpeed(rank) });
  col.sort((x, y) => (side === 'a' ? y.slot - x.slot : x.slot - y.slot)); // 维持 [0]=前锋
  return true;
}
// 舍车：弃该路我方兵（回牌库·非销毁·复用人面回库形状）+ 另两路当前兵各 +x 战力（施放瞬间快照·烙 buff·永久随兵）。
function sacrificeLane(b: TurnBattle, side: 'a' | 'b', lane: number, x: number): void {
  const sd = sideOf(b, side); const col = colOf(b.lanes[lane], side);
  for (const u of col) sd.pokerDeck.push({ kind: 'poker', id: u.id, rank: u.rank, suit: u.suit, general: u.general, buff: u.buff, cost: u.cost }); // 回库
  col.length = 0; // 弃该路（清空）
  for (let li = 0; li < 3; li++) if (li !== lane) for (const u of colOf(b.lanes[li], side)) u.buff += x; // 另两路当前兵 +x 战力（快照烙兵身）
}
// 应用选路 op 的即时效果（castTengangAt / 铁索全局 共用）。
function applyTargetedTengang(b: TurnBattle, side: 'a' | 'b', id: string, lane: number): void {
  const p = (TIANGANG_BY_ID.get(id)?.params ?? {}) as Record<string, unknown>;
  const op = String(p.op); const v = typeof p.value === 'number' ? p.value : 0; const foe: 'a' | 'b' = side === 'a' ? 'b' : 'a'; const dir = side === 'a' ? 1 : -1;
  if (op === 'advance') { for (let s = 0; s < (v || 1); s++) advanceLaneOneStep(b.lanes[lane], side); } // 疾行：+value 格(默认1)
  else if (op === 'slow') {
    if (p.scope === 'all') { const N = v || IRONCHAIN_TURNS; if (foe === 'a') b.slowA = Math.max(b.slowA, N); else b.slowB = Math.max(b.slowB, N); } // 铁索：敌全军减速 N 回合(刷新不叠深)
    else { if (foe === 'a') b.lanes[lane].aSkipAdvance = true; else b.lanes[lane].bSkipAdvance = true; } // 泥沼：敌该路本回合不推进
  } else if (op === 'reinforce') { for (let k = 0; k < (v || RUSH_UNITS); k++) deployReinforcement(b, side, lane); } // 驰援：+N 援兵
  else if (op === 'sacrifice') { sacrificeLane(b, side, lane, v || SACRIFICE_BUFF); } // 舍车：弃该路 + 另两路 +v
  else if (op === 'jumpToMid') { // 抢滩：我该路整列即时抢到中线（逐格推进到前锋达中线·卡住即停·不越敌/不越界）·⚠"新部署兵"语义→即时现兵版·存疑已提主程
    const MID = Math.floor(SLOTS / 2); const own = colOf(b.lanes[lane], side);
    for (let guard = 0; guard < SLOTS && own[0]; guard++) {
      const front = own[0]; if (dir > 0 ? front.slot >= MID : front.slot <= MID) break; // 前锋已达/过中线
      const before = front.slot; advanceLaneOneStep(b.lanes[lane], side); if (own[0].slot === before) break; // 卡住(敌挡/界)→停
    }
  } else if (op === 'aoePower') { // AOE(火攻/齐射/塌方)：敌该路 span 个兵(前锋起·默认全路) buff += value(负=削战力·快照)；p.slow→兼施泥沼(塌方)
    const foeCol = colOf(b.lanes[lane], foe); const span = typeof p.span === 'number' ? p.span : foeCol.length;
    for (const u of foeCol.slice(0, span)) u.buff += v;
    if (p.slow) { if (foe === 'a') b.lanes[lane].aSkipAdvance = true; else b.lanes[lane].bSkipAdvance = true; } // 塌方：兼本回合不推进
  }
}
// ③''' 施选路天罡：选中手牌第 handIdx 张选路天罡 → 立即对目标 lane 结算（不进 castIds/tengangA·即时一次性）。花 CAST_COST·占 cast 动作。
//   lane 语义：own-lane/enemy-lane → 该 lane 索引；global(铁索) → lane 忽略。非选路天罡返 false（应走 castTengang）。
export function castTengangAt(b: TurnBattle, side: 'a' | 'b', handIdx: number, lane: number): boolean {
  if (!canAct(b, side, CAST_COST)) return false;
  const sd = sideOf(b, side); const card = sd.hand[handIdx];
  if (!card || card.kind !== 'tengang') return false;
  const kind = tengangTargetKind(card.id); if (!kind) return false; // 非选路天罡·拒绝(走 castTengang)
  if (kind !== 'global' && (lane < 0 || lane > 2)) return false;    // 选路类须给合法 lane
  sd.hand.splice(handIdx, 1); sd.mana -= CAST_COST; b.actionTaken = 'cast';
  applyTargetedTengang(b, side, card.id, lane);
  onPlayDraw(sd); // 川流：施法后免费补抽（与 castTengang 一致）
  return true;
}

// ④ 换牌（owner 2026-07-03·三行为·取代旧「免费纯弃牌」）：选中手牌第 handIdx 张 → **弃掉它 + 从指定库(poker/tengang·caller/AI 选)随机补 1 张**。
//   `SWAP_PER_TURN=1`（每回合硬帽·破「选牌→弃→随机补→还是废牌→再换」的无限 churn 死循环）· `SWAP_COST=0`（免费）· 补的是随机牌(非搜牌/tutor·不能定向挖组合)。
//   补牌**消费 b.rng**（随机下标·顺序固定 → turnHash 稳）。库空则无从补 → 换失败(手牌不动)。返回是否成功。
export function swapCard(b: TurnBattle, side: 'a' | 'b', handIdx: number, from: 'poker' | 'tengang'): boolean {
  if (b.winner !== 'pending' || b.active !== side) return false;
  const sd = sideOf(b, side);
  if (sd.swapsUsed >= SWAP_PER_TURN) return false;                 // 每回合硬帽 1 次
  if (handIdx < 0 || handIdx >= sd.hand.length) return false;
  if (sd.mana < SWAP_COST) return false;                          // 免费(cost=0)·留 hook 供未来 swapTax
  const deck: Card[] = from === 'poker' ? sd.pokerDeck : sd.tengangDeck;
  if (deck.length === 0) return false;                            // 指定库空 → 无牌可补·换不了(手牌不动)
  sd.hand.splice(handIdx, 1);                                     // 弃掉选中的那张
  const idx = Math.floor(nextRandom(b.rng) * deck.length);        // 从库随机补 1 张(消费 rng·顺序固定)
  const [drawn] = deck.splice(idx, 1);
  sd.hand.push(drawn);
  sd.swapsUsed += 1; sd.mana -= SWAP_COST;                        // 记账(免费·不动 actionTaken → 换牌非大类互斥动作)
  return true;
}

// ── 调试专用（owner 2026-07-04·测天罡/无限操作·非玩法·走调试菜单调用·不进正规流程·未调用时零影响 turnHash）──
// 授召一张天罡到手牌（by id·不花源泉·不受回合限制）——测新天罡（改掷系/AOE…）效果用。
export function debugGrantTengang(b: TurnBattle, side: 'a' | 'b', id: string): void {
  sideOf(b, side).hand.push({ kind: 'tengang', id });
}
// 加源泉（无限操作·测复杂连招/满仪式用；夹 ≥0）。
export function debugAddMana(b: TurnBattle, side: 'a' | 'b', n: number): void {
  const sd = sideOf(b, side); sd.mana = Math.max(0, sd.mana + n);
}
// ④' 旧「免费纯弃牌」（owner 2026-06-21）已**退役**（owner 2026-07-03·被换牌取代·弃了不补没用）——保留导出供 UI 迁移期兼容(程序B 会把弃牌钮改成换牌)。新逻辑/AI/sim 一律走 swapCard。
export function discardCard(b: TurnBattle, side: 'a' | 'b', handIdx: number): boolean {
  if (b.winner !== 'pending' || b.active !== side) return false;
  const sd = sideOf(b, side);
  if (handIdx < 0 || handIdx >= sd.hand.length) return false;
  sd.hand.splice(handIdx, 1); sd.mana += DISCARD_REFUND;
  return true;
}

// 擎天「最强单张」：某方全军(跨三路) base 点数最高一张 id（防 buff 循环·ties 队首确定性）。
function championId(b: TurnBattle, side: 'a' | 'b'): string | undefined {
  let best: TurnUnit | undefined;
  for (const L of b.lanes) for (const u of colOf(L, side)) if (!best || u.points > best.points) best = u;
  return best?.id;
}

// 有效战力 P_eff（doc19 §三 · 复用 live-combat 同款：base + 经营 buff + 天罡(双方己侧·Boss 施法亦生效) + 士气；apply add→mul→floor→clamp）。
// noRout（地煞·破釜沉舟/死战不退）：Boss 主将亡不溃散（shift 不取 −ROUT）。fx=该侧 tengangA（NO_TENGANG → 零修正·行为同前）。
// 士气 v2 · 当时在场兵的即时震荡值（owner 2026-07-05）：主将阵亡后 [deathTurn, until) 内线性衰减 −N → 0，到期/无字段=0。
//   until = deathTurn + MORALE_SHOCK_TURNS；remaining = until − turn ∈ (0, N] → −round(PTS×remaining/N)；≤0 已到期归 0。整数运算·确定性（回放/lockstep 无漂移）。
function activeShock(u: TurnUnit, turn: number): number {
  const until = u.moraleShock ?? 0;
  const remaining = until - turn;
  if (remaining <= 0) return 0; // 无震荡 / 已衰减到期
  return -Math.round((MORALE_SHOCK_PTS * remaining) / MORALE_SHOCK_TURNS);
}
function effPower(u: TurnUnit, lane: TurnLane, side: 'a' | 'b', fx: TengangFx, champId?: string, noRout = false, nearDef = 0, phalanx = 0, turn = 0): { pEff: number; shift: number; tg: number; nearDef: number; phalanx: number } {
  const col = colOf(lane, side);
  let tg = fx.powerAll + fx.pEffAdd;
  if (fx.powerFront && col.length && u.id === col[0].id) tg += fx.powerFront; // 锋矢：前锋
  if (col.length <= 3) tg += fx.powerLE3;                                     // 寡兵
  if (fx.powerSameSuit && col.filter((x) => x.suit === u.suit).length >= 2) tg += fx.powerSameSuit; // 同花魁
  if (fx.comboPair || fx.comboTrips) { const rc = new Map<string, number>(); for (const x of col) rc.set(x.rank, (rc.get(x.rank) ?? 0) + 1); const vals = [...rc.values()]; if (fx.comboPair && vals.some((n) => n >= 2)) tg += fx.comboPair; if (fx.comboTrips && vals.some((n) => n >= 3)) tg += fx.comboTrips; } // 对子诀/鼎立
  const mul = fx.powerMulHighest > 1 && u.id === champId ? fx.powerMulHighest : 1; // 擎天最强单张 ×N（疲劳改走 pEff 的 fatiguePm 整数千分比·不再折进 mul·owner 2026-07-06）
  const fp = u.fatiguePm ?? 0; // 连续疲劳千分比 → pEff 内 ×(1000−fp)/1000（整数·确定性）
  if (u.general) return { pEff: pEff(u.points, u.buff + tg + nearDef + phalanx, mul, fp), shift: 0, tg, nearDef, phalanx };
  const genDead = side === 'a' ? lane.aGenDead : lane.bGenDead;
  const genHere = col.some((x) => x.general);
  const moraleBonus = genHere ? fx.moraleLeader : 0; // 令旗(旗手)
  const noRoutEff = noRout || fx.noRout > 0; // 督战(天罡) 或 破釜沉舟/死战不退(Boss disha)
  const shift = !genDead ? (genHere ? MORALE_PTS + moraleBonus : 0)
    : fx.revenge > 0 ? fx.revenge // 哀兵：主将亡 → 余部暴怒 +N
    : noRoutEff ? 0               // 督战：主将亡不溃散
    : activeShock(u, turn);       // 默认(士气v2)：主将亡 → 当时在场兵临时震荡·线性衰减·N回合归0·新兵免疫(无字段=0)
  return { pEff: pEff(u.points, u.buff + tg + shift + nearDef + phalanx, mul, fp), shift, tg, nearDef, phalanx };
}
// 斯巴达方阵（owner 2026-07-03 改逻辑为真·每兵加战力）：Boss 侧每兵按**自身**相邻友兵数 → +确定战力
// （min(封顶, 相邻数×每邻) 折成战力·同 dishaEdge 用 EDGE_TO_POWER 换算·保原量级 + 每兵独立 + 进拆解可见）。
function phalanxPower(b: TurnBattle, li: number, u: TurnUnit): number {
  const d = b.dishaB;
  if (d.phalanxPerAdj <= 0) return 0;
  const adj = dishaAllies(b, li, u, d.phalanxAdj8);
  return Math.round(Math.min(d.phalanxCap, adj * d.phalanxPerAdj) / EDGE_TO_POWER);
}

// AI 画像用·近似有效战力（点数+养成后按连续疲劳折价·不含 lane 天罡/士气·够 AI 挑软柿子/占优判断）。
const halvedEff = (u: TurnUnit): number => Math.floor((Math.max(0, u.points + u.buff) * (1000 - (u.fatiguePm ?? 0))) / 1000);

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
  const phalanx = side === 'b' ? phalanxPower(b, li, u) : 0; // 斯巴达方阵：每兵按自身相邻友兵数 +战力（owner 2026-07-03·仅 Boss 侧）
  const noRout = side === 'b' && dB.noRout;
  const e = effPower(u, lane, side, fx, champ, noRout, nearDef, phalanx, b.turn);
  const tgBreak = sd.castFx.map(({ id, fx: f }) => [id, Math.round(tgContribOf(u, lane, side, f))] as [string, number]).filter((r) => r[1] !== 0); // 逐张天罡溯源（同 resolveClash）
  return { rank: u.rank, suit: u.suit, general: u.general, points: u.points, buff: u.buff, morale: e.shift, tengang: e.tg, pEff: e.pEff, tgBreak, nearDef: e.nearDef, phalanx: e.phalanx, wins: u.wins, fatiguePm: u.fatiguePm };
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
  // 斯巴达方阵/连环船已从「Boss 胜率 edge」改为「每兵按自身相邻 +确定战力」（phalanxPower·进各兵 pEff + 拆解可见·owner 2026-07-03）→ 不再计入 bossEdge（防重复）。
  if (d.nearBaseSlots > 0 && bf.slot >= SLOTS - d.nearBaseSlots) e += d.nearBaseWinPct; // 温泉关·隘口(贴 Boss 家)
  if (d.eliteMidWinPct > 0 && li === 1) e += d.eliteMidWinPct; // 近卫军(简化·中路前锋)
  if (d.winStreakPer > 0) e += Math.min(d.winStreakCap, b.bossWinStreak * d.winStreakPer); // 九战九捷
  if (d.firstStrike) e += d.firstStrikeWinPct; // 长枪方阵·先手
  if (li === b.batteryLane) e += d.batteryWinPct; // 大炮兵·你这路被压
  if (d.flankYouWinPct > 0 && flankedBoth(b, li, pf)) e += d.flankYouWinPct; // 锤砧·你被夹
  return e;
}

function killFront(lane: TurnLane, side: 'a' | 'b', shockUntil = 0): void {
  const q = colOf(lane, side); const u = q.shift();
  if (u?.general) {
    if (side === 'a') lane.aGenDead = true; else lane.bGenDead = true;
    // 士气 v2（owner 2026-07-05）：主将阵亡瞬间 → 只给**当时在场**的该路余部盖临时震荡（衰减·N回合归0）；
    //   此刻还没部署的兵拿不到字段 → 天然免疫（新兵可重建这条路·杜绝永久诅咒/死亡螺旋）。
    if (shockUntil > 0) for (const x of q) if (!x.general) x.moraleShock = shockUntil;
  }
}

// 掷命解算评估（纯读·不掷骰不改状态）：算两军前锋有效战力 ea/eb（含地煞·招牌气势折成的确定战力）。
// owner 2026-07-01「确定制」：**去掉 logistic 胜率骰 + 掷硬币**——战力高者直接胜（平局走阶梯）→ 玩家可做确定预测。
//   地煞的胜率 edge 折成 Boss **确定战力**（`edge/EDGE_TO_POWER`）→ 既保留地煞威慑、又进战力拆解可见（守 ⑥ 透明·不搞暗改）。
//   （旧 logistic/kHard/winFloor/noUpset/爆冷缝 随掷骰退役；未来「各自掷战力骰」见 game-g-clash-fate-roll-vision.md。）
const clampP = (x: number): number => (x < P_MIN ? P_MIN : x > P_MAX ? P_MAX : x);
const EDGE_TO_POWER = 5; // 地煞胜率百分点→确定战力 的换算（≈旧 logistic 在 50% 处斜率反解·k=5 时 0.2/点）·待「重排数值」精调
interface ClashEval { fa: TurnUnit; fb: TurnUnit; ea: number; eb: number; dishaEdge: number; ba: ReturnType<typeof effPower>; bb: ReturnType<typeof effPower> }
function clashEval(b: TurnBattle, li: number): ClashEval | null {
  const lane = b.lanes[li]; const fa = lane.a[0], fb = lane.b[0];
  if (!fa || !fb) return null;
  const champA = b.a.tengangA.powerMulHighest > 1 ? championId(b, 'a') : undefined;
  const champB = b.b.tengangA.powerMulHighest > 1 ? championId(b, 'b') : undefined;
  const dB = b.dishaB;
  const nearDefB = dB.nearBaseSlots > 0 && fb.slot >= SLOTS - dB.nearBaseSlots ? dB.nearBasePower : 0; // 温泉关·隘口守军固守 +战力（贴 Boss 家·进战力拆解）
  const phalanxB = phalanxPower(b, li, fb); // 斯巴达方阵：前锋按自身相邻友兵数 +战力（owner 2026-07-03·改逻辑为真·每兵加战力·已从 bossEdge 移出防重复计）
  const ba = effPower(fa, lane, 'a', b.a.tengangA, champA, false, 0, 0, b.turn), bb = effPower(fb, lane, 'b', b.b.tengangA, champB, dB.noRout, nearDefB, phalanxB, b.turn);
  const dishaEdge = Math.round(bossEdge(b, li, fa, fb) / EDGE_TO_POWER); // 地煞·招牌气势 → Boss 确定战力加成
  const ea = ba.pEff, eb = clampP(bb.pEff + dishaEdge); // Boss 有效战力含地煞气势（夹 P_MAX）
  return { fa, fb, ea, eb, dishaEdge, ba, bb };
}

// 掷平裁定（owner 2026-07-01·两边掷出同数时才用）：战力高者胜 → 点数 → 续航 → 先手(地煞·长枪方阵)判 Boss / 否则玩家。纯确定。
function decideTie(b: TurnBattle, ev: ClashEval): { aWins: boolean; tie: ClashEvent['tie'] } {
  const { fa, fb, ea, eb } = ev;
  if (ea !== eb) return { aWins: ea > eb, tie: 'power' };
  if (fa.points !== fb.points) return { aWins: fa.points > fb.points, tie: 'points' };
  if (fa.staminaLeft !== fb.staminaLeft) return { aWins: fa.staminaLeft > fb.staminaLeft, tie: 'stamina' };
  return { aWins: !b.dishaB.firstStrike, tie: 'roll' };
}

// 掷骰系改掷（REQ-G-天罡原生重构 §四.2）：从持方 tengangA 取改掷参数（鬼手 bonus/磐石 floor/灌铅骰 twice）。
const clashMods = (fx: { rollBonus: number; rollFloor: number; rollTwice: number }): RollMods => ({ bonus: fx.rollBonus, floor: fx.rollFloor, twice: fx.rollTwice });
// 铁骰·占优必胜：持方 autoWinGE>0 且 前锋有效战力 ≥ 敌 → 免掷直接判该方胜。返回 'a'/'b'/null（a 优先）。
function autoWinner(b: TurnBattle, ev: ClashEval): 'a' | 'b' | null {
  if (b.a.tengangA.autoWinGE > 0 && ev.ea >= ev.eb) return 'a';
  if (b.b.tengangA.autoWinGE > 0 && ev.eb >= ev.ea) return 'b';
  return null;
}
// 玩家(a)视角·当前若开战的胜率(0~1)·纯读不掷骰（owner 2026-07-01「各自掷战力骰」+ §四.2 改掷/占优必胜）：
//   双方各掷（含改掷）[1,战力] 比大小 → P(玩家掷值 > 敌掷值) + 掷平时按 decideTie 归给胜方。无前锋相遇→null。供 UI「掷命预报」。
export function clashOdds(b: TurnBattle, li: number): number | null {
  const ev = clashEval(b, li); if (!ev) return null;
  const auto = autoWinner(b, ev); if (auto) return auto === 'a' ? 1 : 0; // 铁骰·占优必胜 → 预报 100/0
  const { pGreater, pEqual } = rollWinProbMods(ev.ea, ev.eb, clashMods(b.a.tengangA), clashMods(b.b.tengangA));
  return pGreater + (decideTie(b, ev).aWins ? pEqual : 0); // 掷平归属方吃下 pEqual
}

// 一路前锋相遇 → 各自掷战力骰对决（owner 2026-07-01）：双方各掷 [1,有效战力]（含天罡/士气/地煞/连胜对折）比大小·大者胜；
//   掷平走 decideTie（战力→点数→续航→先手）。胜者留场·每胜累加疲劳（有效战力对折·连续疲劳条）；无自动退场。掷硬币已退役为死代码。
//   TODO（owner 2026-07-01「还可以有额外 Action/Buff 干涉掷骰」）：改掷牌(方片×2·意大利×1.2…)在此处 rollA/rollB 后 applyRollMods —— 见 game-g-clash-fate-roll-vision.md（防数据爆炸护栏）。
function resolveClash(b: TurnBattle, li: number): void {
  const ev = clashEval(b, li); if (!ev) return;
  const { ea, eb } = ev;
  const auto = autoWinner(b, ev); // 铁骰·占优必胜 → 免掷（不消费 rng·确定判胜）
  if (auto) { applyClashOutcome(b, li, ev, auto === 'a', 'power', 0, 0); return; }
  const rollA = rollWithMods(ea, b.rng, clashMods(b.a.tengangA)), rollB = rollWithMods(eb, b.rng, clashMods(b.b.tengangA)); // 各自掷各自的（含改掷·消费 rng：a 先 b 后·每方 1+twice 次·顺序固定→hash 稳）
  let aWins: boolean, tie: ClashEvent['tie'] = null;
  if (rollA !== rollB) aWins = rollA > rollB; // 大者胜
  else { const d = decideTie(b, ev); aWins = d.aWins; tie = d.tie; } // 掷平 → 阶梯裁定
  applyClashOutcome(b, li, ev, aWins, tie, rollA, rollB);
}

// 确定性 EV 结算（Player-AI 前向推演专用·**不消费 rng**·owner 2026-07-03「推演敌人未来」）：
//   遭遇不掷骰——用 rollWinProbMods(ea,eb,改掷) 精确胜率坍缩到「更可能一方」判胜（含平局归属+占优必胜），再走与 resolveClash 逐字相同的善后
//   （applyClashOutcome：死战不退/阵亡/薪火/胜者累加疲劳/战潮）。仅在克隆局上跑·真局不受影响→turnHash 稳。
export function resolveClashEV(b: TurnBattle, li: number): void {
  const ev = clashEval(b, li); if (!ev) return;
  const auto = autoWinner(b, ev); // 铁骰·占优必胜（EV 侧同判·确定）
  if (auto) { applyClashOutcome(b, li, ev, auto === 'a', 'power', 0, 0); return; }
  const { pGreater, pEqual } = rollWinProbMods(ev.ea, ev.eb, clashMods(b.a.tengangA), clashMods(b.b.tengangA)); // 含改掷分布
  const tieToA = decideTie(b, ev).aWins;          // 掷平归谁（战力→点数→续航→先手·确定）
  const aWins = pGreater + (tieToA ? pEqual : 0) >= 0.5; // 坍缩：胜率 ≥50% 判玩家胜（expectimax chance 节点取最可能支）
  const tie: ClashEvent['tie'] = ev.ea === ev.eb ? 'power' : null;
  applyClashOutcome(b, li, ev, aWins, tie, 0, 0);
}

// 掷命善后（resolveClash / resolveClashEV 共用·owner 2026-07-03 抽出防漂移）：给定胜负 aWins → 写 lastClash/流水 +
//   死战不退（Boss 主将退回牌库）/ 阵亡+薪火 / 胜者累加疲劳（连续疲劳条·无自动退场）/ 战潮返泉。**纯状态机·不掷骰**（rng 由 caller 消费）。
function applyClashOutcome(b: TurnBattle, li: number, ev: ClashEval, aWins: boolean, tie: ClashEvent['tie'], rollA: number, rollB: number): void {
  const lane = b.lanes[li]; const { fa, fb, ea, eb, dishaEdge, ba, bb } = ev;
  const wr = clashOdds(b, li) ?? (aWins ? 1 : 0); // 预报胜率(留档·特写显)
  const tgBreakOf = (sd: TurnSide, u: TurnUnit, sk: 'a' | 'b'): [string, number][] => sd.castFx.map(({ id, fx }) => [id, Math.round(tgContribOf(u, lane, sk, fx))] as [string, number]).filter((r) => r[1] !== 0); // 逐张天罡溯源
  b.lastClash = { tick: b.turn, lane: li, winrate: wr, roll: 0, rollA, rollB, aWins, tie, winStays: true, warLoss: 0, winStreak: 0, a: { id: fa.id, rank: fa.rank, suit: fa.suit, general: fa.general, points: fa.points, buff: fa.buff, morale: ba.shift, tengang: ba.tg, pEff: ea, tgBreak: tgBreakOf(b.a, fa, 'a'), nearDef: ba.nearDef, wins: fa.wins, fatiguePm: fa.fatiguePm, rollMod: clashMods(b.a.tengangA) }, b: { id: fb.id, rank: fb.rank, suit: fb.suit, general: fb.general, points: fb.points, buff: fb.buff, morale: bb.shift, tengang: bb.tg, pEff: eb, tgBreak: tgBreakOf(b.b, fb, 'b'), nearDef: bb.nearDef, dishaEdge, phalanx: bb.phalanx, wins: fb.wins, fatiguePm: fb.fatiguePm, rollMod: clashMods(b.b.tengangA) } }; // rollA/rollB=双方掷值·winrate=预报胜率·winStays 恒 true(胜者留场)
  b.clashLog.push(b.lastClash); // 流水（驱动层逐场抽特写）
  b.clashSeq += 1;
  if (!aWins) b.bossWinStreak += 1; // 九战九捷：Boss 胜累积
  // 死战不退（地煞·关1 仅 Boss 主将）：命数 N（laststand=3）→ 前 N-1 次战败不亡·**退回牌库·不消失**（owner 2026-07-04 改：不是残喘退守 1 格·是退回牌库可重部署）·第 N 次才真死。
  const genLives = b.dishaB.lastStandGeneral; // 主将命数 N（0=无死战不退）
  if (aWins && fb.general && genLives > 0 && b.bossGenDefeats < genLives - 1) {
    b.bossGenDefeats += 1; const q = lane.b; const u = q.shift();
    if (u) {
      lane.spentB += 1; // 该格计一次离场(维持满血/spent 记账口径同光荣回库)
      b.b.pokerDeck.push({ kind: 'poker', id: u.id, rank: u.rank, suit: u.suit, general: true, buff: u.buff, cost: u.cost }); // 主将负伤不退 → 退回 Boss 牌库(不消失·可重抽重部署·满血·owner 2026-07-04)·替旧「残喘退守 1 格」
      if (b.lastClash) b.lastClash.lastStand = true; // 标记本场触发死战不退 → 特写/横幅改显"死战不退·退回牌库"(替误导的"阵亡")
    }
  } else {
    const loser = aWins ? 'b' : 'a';
    const loserFront = colOf(lane, loser)[0];
    const vacatedSlot = loserFront?.slot; // 阵亡敌兵腾出的格（攻方胜 → 前进占据·owner 2026-07-06）
    const winnerKillsGeneral = !!loserFront?.general; // 本场斩掉的是敌主将？
    killFront(lane, loser, b.turn + MORALE_SHOCK_TURNS); // 输家阵亡（主将亡则盖士气震荡·士气v2）
    // 擒王（REQ-G-天罡原生重构 §四.3）：胜方持擒王 + 本场斩掉败方主将 → 败方该路余部全溃（主将已由 killFront 斩·余部清空该列）。
    if (winnerKillsGeneral && sideOf(b, aWins ? 'a' : 'b').tengangA.killGeneralRout > 0) {
      if (loser === 'a') lane.aGenDead = true; else lane.bGenDead = true; // 主将亡标记（若前锋即主将·killFront 已置；防御性重置）
      colOf(lane, loser).length = 0; // 该路败方余部全溃·清空
    }
    const relay = sideOf(b, loser).tengangA.relay; // 薪火：一张阵亡 → 同路下一张接棒续航 +N
    const next = colOf(lane, loser)[0]; if (relay > 0 && next) next.staminaLeft += relay;
    // 攻方胜 → 前进占据阵亡敌兵腾出的格（owner 2026-07-06「往前攻击撞死人的当然占位；守方守原位」·替 2026-07-04「胜者一律守原位」）。
    //   攻方 = 本行动相推进者 = b.active（clash 恒由 advanceSide(b.active) 触发·攻守由此判）；仅胜方==active 才占（守方胜=被攻方·不动）。
    //   攻方前锋此刻恰停在敌前一格（advanceColumnVsFoe 封顶「敌前一格」）→ 占位=前进 1 格到 vacatedSlot·不越界不瞬移；静守兵(hold)不追击。
    const winSide = aWins ? 'a' : 'b';
    if (winSide === b.active && vacatedSlot != null) {
      const wf = colOf(lane, winSide)[0];
      if (wf && !wf.hold) wf.slot = vacatedSlot;
    }
  }
  // 胜者去留（owner 2026-07-06 连续疲劳条·取消离散连胜/自动退场）：**永远留场继续作战**（战场不空·心流不断）；
  //   胜一场 → 累加疲劳 `fatiguePm += (1000−fatiguePm)×0.5`（有效战力对折·整数千分比·确定性）；**无自动退场**（owner「没必要退场·满3光荣回库删掉」）。
  //   强兵连战越疲 → 弱兵车轮磨得动；歇一轮（本轮不战）回一成（endTurnFinish 的休整）。（死战不退那场 boss 主将未真败·不计胜方战损。）
  const winSide: 'a' | 'b' = aWins ? 'a' : 'b';
  const wf = colOf(lane, winSide)[0];
  if (wf && !b.lastClash.lastStand) {
    wf.wins = (wf.wins ?? 0) + 1; // 累计胜场（仅日志/AI 画像·不再驱动战力）
    const fpBefore = wf.fatiguePm ?? 0;
    wf.fatiguePm = fpBefore + Math.round((1000 - fpBefore) * WAR_LOSS_PER_WIN); // 疲劳 += 剩余战力的一半（0→500→750→875…·有效战力逐胜对折·整数确定）
    b.lastClash.warLoss = WAR_LOSS_PER_WIN; b.lastClash.winStreak = wf.wins; b.lastClash.fatiguePm = wf.fatiguePm; // warLoss=本场对折率(显「本场−N」)·fatiguePm=胜者累计疲劳(显头顶总疲劳/供恢复回看)
    // 胜者**守原位·不追击**（owner 2026-07-04：赢了不立即推进占腾出格——赢=守住/敌离场，前进交给下回合正常行军）。
  }
  b.foughtNow.push(fa.id, fb.id); // 本行动相参战的两前锋 id → endTurnFinish 据此把「本轮没打的在场兵」休整回血（owner 2026-07-06）
  b.a.mana += b.a.tengangA.clashElixir; b.b.mana += b.b.tengangA.clashElixir; // 战潮：每遭遇返召唤源泉（喂经济）
}

// 单列向敌推进（有敌前锋）：各兵 +dir×speed(疾行2格)·保 slot 间距 1·前锋停在敌前锋相邻格(不重叠)。
// pinGeneral（owner 2026-06-29·Boss 主将关前死守）：主将不前移·原地守家（其在队尾贴家·跳过它不影响前方兵推进）。
function advanceColumnVsFoe(own: TurnUnit[], dir: number, foeFrontSlot: number, pinGeneral = false, speedPen = 0): void {
  for (let i = 0; i < own.length; i++) {
    if (own[i].hold) continue; // 开局排阵守军·静守不前压（REQ-G-开局排阵 #1）
    if (pinGeneral && own[i].general) continue; // Boss 主将死守原地·不前移
    let t = own[i].slot + dir * Math.max(1, (own[i].speed ?? 1) - speedPen); // 铁索：speedPen 减速(下限1格)
    if (i > 0) { const ahead = own[i - 1].slot; t = dir > 0 ? Math.min(t, ahead - 1) : Math.max(t, ahead + 1); }
    else if (dir > 0 ? own[i].slot <= foeFrontSlot : own[i].slot >= foeFrontSlot) { const limit = foeFrontSlot - dir; t = dir > 0 ? Math.min(t, limit) : Math.max(t, limit); } // 停在敌前锋前一格（仅接近侧·已突穿则不反向顶穿棋盘·修 REQ-G-突深边角）
    own[i].slot = t;
  }
}
// 破家收割（owner 2026-07-06·修「突深兵走出棋盘 / 破家不掉血」）：任何越过敌家末格(goal)的己兵 → 敌大本营 −1·该兵回库返半费。
//   **两条推进路都调它**：无敌路(advanceColumnToBase)照常；有敌路(advanceColumnVsFoe)里突深过敌前锋、越线到家的兵也必须在这里破家离场——
//   否则该兵会因「本路仍有敌(在它身后)→不走破家分支」而无限往前走出棋盘(slot 9/10/11…)、既不破家也不掉血(owner 实录：我兵现敌后场 / 敌到我家我不掉血)。
// 返破家兵数（供日志）。
function reapPastGoal(b: TurnBattle, own: TurnUnit[], dir: number, side: 'a' | 'b'): number {
  const goal = side === 'a' ? A_GOAL : B_GOAL;
  let broke = 0;
  for (let i = own.length - 1; i >= 0; i--) {
    const past = dir > 0 ? own[i].slot > goal : own[i].slot < goal;
    if (!past) continue;
    const [u] = own.splice(i, 1); // 攻进对家的兵（破家立功）·取出待善后
    if (side === 'a') b.homeB = Math.max(0, b.homeB - (1 + b.a.tengangA.siegeChip)); // 攻城锤：破敌家多 chip
    else if (b.homeAShieldUsed < b.a.tengangA.siegeDefend) b.homeAShieldUsed += 1; // 死守：我家首破免疫(吸收·不掉血)
    else b.homeA = Math.max(0, b.homeA - 1);
    // 破家善后（REQ-G-破家善后·doc24 §4.2.6）：不凭空消失·不留场——走掷命「人面·回库」同款：回牌库 + 返半费（可再抽再冲→持续攻城·非一兵砸穿）。
    const wsd = sideOf(b, side);
    wsd.pokerDeck.push({ kind: 'poker', id: u.id, rank: u.rank, suit: u.suit, general: u.general, buff: u.buff, cost: u.cost });
    wsd.mana += (u.cost ?? 0) / 2; // 返半费（sim 显攻城经济过快可单独清零·先按半费）
    broke += 1;
  }
  return broke;
}
// 单列向敌家推进（本路无敌）：越过敌区末格 → 敌大本营 −1(攻城锤多 chip)·该兵退场（死守可吸我家首破）。
function advanceColumnToBase(b: TurnBattle, own: TurnUnit[], dir: number, side: 'a' | 'b', speedPen = 0): void {
  for (let i = 0; i < own.length; i++) {
    if (own[i].hold) continue; // 开局排阵守军·不自动冲家（REQ-G-开局排阵 #2·守军绝不主动冲锋）
    if (side === 'b' && own[i].general) continue; // Boss 主将死守原地·不直扑我家（owner 2026-06-29）
    let t = own[i].slot + dir * Math.max(1, (own[i].speed ?? 1) - speedPen); // 铁索：speedPen 减速(下限1格)
    if (i > 0) { const ahead = own[i - 1].slot; t = dir > 0 ? Math.min(t, ahead - 1) : Math.max(t, ahead + 1); }
    own[i].slot = t;
  }
  reapPastGoal(b, own, dir, side);
}
// 行动阶段（owner 2026-06-29 ②·顺序回合模型·替 2026-06-21 同步推进）：**只推刚结束回合的那一方**——
// 我放完→我方三路向敌家推进/攻击；敌放完→敌方推进/攻击。两军不再同帧一起动（owner「一起行动看不清谁打谁」）。
// ①只处理本方捷径门分流 → ②本方三路向对家推进·前锋相邻则掷命/无敌则抵家 chip。放置回合本身不调用（放置无推进）。
// 推进「移动相」（owner 2026-06-29·拆分移动↔掷命·让 UI 能「先滑到位→弹谁打谁→掷骰→才结算离场」）：
// 只移动本方三路 + 过本方门，**不掷命**；返回前锋相邻、待掷命的路 id（caller 决定何时 resolveClashAt）。
function advanceSideMove(b: TurnBattle, side: 'a' | 'b', dbg?: (m: string) => void): number[] {
  const dir = side === 'a' ? 1 : -1;
  const say = dbg ?? ((): void => {}); const LN = ['上', '中', '下']; const sideNm = side === 'a' ? '我' : '敌'; // 行走日志（owner 2026-07-03「看每张牌走向哪·为啥没触发战斗」）
  const slowPen = (side === 'a' ? b.slowA : b.slowB) > 0 ? 1 : 0; // 铁索：本方被敌铁索锁 → 本轮全军 speed−1（下限1）
  const pending: number[] = [];
  b.movedNow = []; // 本行动相「前进过」的兵 id（供休整回血只回给真前进的兵·owner 2026-07-06「每走一步恢复10%」·驻守不动的堵路兵不自愈→僵局能破）
  for (let li = 0; li < 3; li++) { // 本方兵线向对家推进；前锋相邻 → 记为待掷命路
    const lane = b.lanes[li]; const own = colOf(lane, side); const foe = colOf(lane, side === 'a' ? 'b' : 'a');
    if (!own.length) continue;
    const skip = side === 'a' ? lane.aSkipAdvance : lane.bSkipAdvance; // 泥沼：本方本路本回合不推进（跳一次·用后清）
    if (skip) { if (side === 'a') lane.aSkipAdvance = false; else lane.bSkipAdvance = false; say(`[${sideNm}·${LN[li]}路] 陷泥沼·本回合不推进（跳过）`); continue; }
    const beforeMap = new Map(own.map((u) => [u.id, u.slot])); // 移动前各兵位（供逐兵行走日志）
    if (foe.length) {
      // 碰撞才战（owner 2026-07-03·替「相邻 gap≤1 即战」）：前锋这一步的**落点**踩到/越过敌前锋才触发掷命；落点是空格只走位、不打。
      const front = own[0];
      const mobile = !front.hold && !(side === 'b' && front.general); // 会移动的前锋才可能撞（守军/主将 不撞）
      const natural = front.slot + dir * Math.max(1, (front.speed ?? 1) - slowPen); // 不封顶的自然落点（含铁索减速）
      const approaching = dir > 0 ? front.slot <= foe[0].slot : front.slot >= foe[0].slot; // 前锋仍在敌前锋接近侧（未突穿）才可能撞·修 REQ-G-突深边角(突穿后别一律误判碰撞)
      const collides = mobile && approaching && (dir > 0 ? natural >= foe[0].slot : natural <= foe[0].slot); // 落点会踩到/越过敌前锋 = 碰撞
      const foeFrontBefore = foe[0].slot;
      advanceColumnVsFoe(own, dir, foe[0].slot, side === 'b', slowPen); // 实际移动仍封顶在敌前一格（停一格·胜后再推进占据）
      const broke = reapPastGoal(b, own, dir, side); // 突深过敌前锋、越线到敌家的兵 → 破家离场（修：别走出棋盘·别到家不掉血·owner 2026-07-06）
      if (collides) pending.push(li);
      for (const u of own) if (beforeMap.get(u.id) !== u.slot) b.movedNow.push(u.id); // 真前进的兵（供休整回血）
      const moves = own.filter((u) => beforeMap.get(u.id) !== u.slot).map((u) => `${u.rank}${u.suit}:${beforeMap.get(u.id)}→${u.slot}`).join('、') || '无移动';
      const why = collides ? '★碰撞→掷命' : !mobile ? (front.hold ? '守军静守·不撞' : '主将死守·不撞') : `走位不打（前锋落点${natural} 未踩到敌前锋@${foeFrontBefore}）`;
      say(`[${sideNm}·${LN[li]}路] 前锋 ${front.rank}${front.suit}@${beforeMap.get(front.id)} · 敌前锋@${foeFrontBefore} → ${why}${broke ? `｜★突深破家 ${broke} 兵` : ''}｜移动:[${moves}]`);
    } else {
      advanceColumnToBase(b, own, dir, side, slowPen); // 本路无敌 → 直扑对家大本营
      for (const u of own) if (beforeMap.get(u.id) !== u.slot) b.movedNow.push(u.id); // 真前进的兵（破家离场的已 splice 出 own·不计）
      const moves = own.filter((u) => beforeMap.get(u.id) !== u.slot).map((u) => `${u.rank}${u.suit}:${beforeMap.get(u.id)}→${u.slot}`).join('、');
      say(`[${sideNm}·${LN[li]}路] 无敌·向对家推进${moves ? `｜移动:[${moves}]` : ''}${own.length < beforeMap.size ? `（有兵破家·剩${own.length}）` : ''}`);
    }
  }
  if (slowPen) { if (side === 'a') b.slowA -= 1; else b.slowB -= 1; } // 铁索倒计时：本方被减速的这一轮走完 → 剩余回合 −1
  return pending;
}
// 行动阶段（原子·仿真台/兼容旧调用）：移动 + 逐路掷命一气呵成。live 游戏改用 advanceMovePhase + resolveClashAt 分相演出。
function advanceSide(b: TurnBattle, side: 'a' | 'b'): void {
  for (const li of advanceSideMove(b, side)) resolveClash(b, li);
}
// 行动阶段·确定性 EV 版（Player-AI 推演专用·**不消费 rng**）：移动同真局(advanceSideMove 无 rng) + 逐路 resolveClashEV。
function advanceSideEV(b: TurnBattle, side: 'a' | 'b'): void {
  for (const li of advanceSideMove(b, side)) resolveClashEV(b, li);
}
/** 结束当前回合·确定性 EV 版（Player-AI 前向推演专用·owner 2026-07-03）：与 endTurn 同结构但遭遇走 EV(不掷骰不消费 rng)
 *  → 克隆局上推演一整回合而不触真 rng·真局 turnHash 不受影响。真局落子仍用 endTurn(真掷骰)。 */
export function endTurnEV(b: TurnBattle): void {
  if (b.winner !== 'pending') return;
  advanceSideEV(b, b.active); // 移动 + 逐路 EV 掷命（确定坍缩·无 rng）
  endTurnFinish(b);           // 判负 + 轮转/回合数/源泉（与真局同·无 rng）
}
// 当前行动方「只移动·不掷命」→ 返回待掷命路 id（owner 2026-06-29·UI 分相：移动→弹窗→掷骰→结算离场）。
export function advanceMovePhase(b: TurnBattle, dbg?: (m: string) => void): number[] {
  if (b.winner !== 'pending') return [];
  return advanceSideMove(b, b.active, dbg);
}
// 结算一路掷命（live 在「谁打谁」弹窗 + 掷骰演完后调）→ 写 lastClash/clashLog·应用胜负去留。
export function resolveClashAt(b: TurnBattle, li: number): void { if (b.winner === 'pending') resolveClash(b, li); }
// 推进收尾（判负 + 轮转/回合数/源泉）→ live 在本回合所有掷命演完后调。
// 休整回血（owner 2026-07-06·P20「每走一步/不战斗就恢复10%」）：本行动相结束 → 行动方**本轮真前进了且没参战**的兵疲劳回落 REST_RECOVER_PM（夹≥0=最多满血）。
//   条件＝在 b.movedNow（真前进·owner「每走一步」）且不在 b.foughtNow（没打·applyClashOutcome 追加的两前锋）。
//   **只回给前进的兵**（驻守堵路/被挡不动的兵不自愈）→ 既忠「每走一步」原话·又让龟缩僵局能破（强堵路兵不永续满血·终会被磨穿·保对局收敛）。
//   纯确定性（整数·无 rng）→ 真局/EV 推演/回放逐字一致。收尾清 foughtNow/movedNow。
function restRecover(b: TurnBattle): void {
  const side = b.active; const fought = new Set(b.foughtNow); const moved = new Set(b.movedNow);
  for (const L of b.lanes) for (const u of colOf(L, side)) {
    if (fought.has(u.id) || !moved.has(u.id)) continue; // 参战过 或 没前进 → 不休整
    const fp = u.fatiguePm ?? 0;
    if (fp > 0) u.fatiguePm = Math.max(0, fp - REST_RECOVER_PM); // 前进一步且没打 → 回一成战力（夹≥0·回不到超满）
  }
  b.foughtNow = []; b.movedNow = [];
}
export function endTurnFinish(b: TurnBattle): void {
  restRecover(b); // 行动方本轮没打的在场兵休整回血（在轮转前·acting=b.active·owner 2026-07-06）
  checkWinner(b);
  if (b.winner !== 'pending') return;
  if (b.active === 'a') {
    b.active = 'b'; b.b.swapsUsed = 0; // 换牌硬帽·新回合方重置(owner 2026-07-03)
    if (b.turn > 1) b.b.mana += manaGain(b.turn); // turn-1 b 已带 MANA_START 起步（①）·turn-2 起对称 +源泉
    if (b.dishaB.bonusMana > 0) b.b.mana += b.dishaB.bonusMana; // 地煞·大军压境/机动调度
    b.b.mana = Math.min(MANA_CAP, b.b.mana); // 源泉封顶 10（owner 2026-07-04·防无处可花累积溢出）
  } else {
    b.active = 'a'; b.turn += 1; b.a.mana += manaGain(b.turn); b.a.swapsUsed = 0; // 换牌硬帽·新回合方重置
    b.a.mana = Math.min(MANA_CAP, b.a.mana); // 源泉封顶 10（owner 2026-07-04）
  }
  b.actionTaken = null;
}

function checkWinner(b: TurnBattle): void {
  if (b.homeB <= 0 && b.homeA <= 0) b.winner = 'draw';
  else if (b.homeB <= 0) b.winner = 'a';
  else if (b.homeA <= 0) b.winner = 'b';
  else if (b.turn > MAX_TURNS) b.winner = b.homeA > b.homeB ? 'a' : b.homeB > b.homeA ? 'b' : 'draw'; // 回合上限保底收敛（owner 2026-07-06·疲劳恢复+无退场→防僵局·按大本营血判·常规对局够不到）
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
    const myPts = myFront ? halvedEff(myFront) : 0; // v2：双方都按连胜对折=真有效战力对比
    const foePts = foeFront ? halvedEff(foeFront) : 0;
    return myPts - foePts; // 正数=我占优
  }) as [number, number, number];
  return { handMaxPts, handHasGeneral, nextIsGeneral, nextMaxPts, laneWinProb };
}

// 放兵到某路的效用：路偏好(铺/专) + 攻击性×目标偏好(弱/强/将) + 攻防情势响应(回防空/劣势·趁势压优势路) + 节奏(疾行驰援) + 方阵扎堆 + 兵牌强度。
// garrison（owner 2026-07-02·修「开局布防全挤一路·另两路真空被玩家直捣家」）：布防阶段**强制分散铺满三路**——
//   一条无兵的路 = 通往自家大本营的免费高速路，任何画像的 boss 开局都不该留。故布防时空路重奖、扎堆重罚 → 三路各留一守；
//   **仅布防阶段生效**，常规回合 scoreDeploy 不变（列奥尼达"专一路"画像 + ai.test 断言照旧）。
function scoreDeploy(b: TurnBattle, card: PokerCard, lane: number, garrison = false): number {
  const p = b.aiProfile; const own = b.lanes[lane].b; const foe = b.lanes[lane].a; const foeFront = foe[0];
  // v2 战损感知（owner 2026-06-29·tier≥2 才开·关1 tier1 保序战傻）：看穿玩家前锋**疲劳**→有效战力，挑软柿子车轮消耗。
  const v2 = b.aiTier >= 2;
  const foeEff = foeFront ? Math.max(0, v2 ? halvedEff(foeFront) : foeFront.points) : 0; // 玩家前锋战力：v2(tier≥2)看有效战力(含养成·连胜对折)·否则同旧(仅点数·不扰 tier1 序战画像)
  let s = 10 + cardPoints(card.rank) * 0.4; // 基础 + 强牌更值
  if (garrison) s += own.length === 0 ? 12 : -own.length * 8; // 布防：空路重奖(每路先留一守·别留高速路) / 已有兵重罚(别堆) → 铺满三路
  s += (p.lanePref >= 5 ? -own.length : own.length) * (Math.abs(p.lanePref - 5) / 5) * 5; // 铺(少己兵处)↔专(扎堆)
  const ag = wt(p.aggression);
  if (p.targetPref === 'weak') s += (foe.length === 0 ? 7 : -foeEff * 0.4) * ag; // 避实击虚（v2：疲劳前锋=软柿子·更想打）
  else if (p.targetPref === 'strong') s += foeEff * 0.4 * ag; // 硬碰强
  else s += (foe.some((u) => u.general) ? 9 : 0) * ag; // 取主将路(斩首)
  // v2：玩家前锋已疲劳(战力被折) → 这路是「趁虚补刀/车轮消耗」良机·加权（疲劳越深=战力被折越多·越值得逼它继续挨打·连续疲劳条·owner 2026-07-06）。
  if (v2 && foeFront && (foeFront.fatiguePm ?? 0) > 0) s += Math.min(7, ((foeFront.fatiguePm ?? 0) / 1000) * 7 + ((foeFront.fatiguePm ?? 0) >= 700 ? 2 : 0)) * (0.5 + ag);
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
 *  aggTengang：caller(game211) 传天罡聚合器 → Boss 施法后重算 tengangA 即时生效。返回本回合打出的地煞 id（caller 全屏通知·REQ-G #6）。 */
export function aiDecide(b: TurnBattle, aggTengang?: (ids: readonly string[]) => TengangFx, dbg?: (m: string) => void, garrison = false): string[] {
  const castDishaIds: string[] = [];
  if (b.winner !== 'pending' || b.active !== 'b') return castDishaIds;
  // 大炮兵（地煞·关4）：每 N 回合压你兵最多的一路 → 该路你掷命 −winPct（应用到你下个推进的遭遇）。
  b.batteryLane = (b.dishaB.batteryEveryTurns > 0 && b.turn % b.dishaB.batteryEveryTurns === 0)
    ? [0, 1, 2].reduce((m, li) => (b.lanes[li].a.length > b.lanes[m].a.length ? li : m), 0) : -1;
  const sd = b.b; const mistakeChance = Math.max(0, 0.5 - b.aiTier * 0.12); // 低档会犯错·高档总最优
  // AI 决策日志（owner 2026-07-02「要更多日志·看敌人 AI 决定」）：dbg 传入才记·纯诊断·不进 hash。
  const say = dbg ?? ((): void => {});
  const LN = ['上', '中', '下']; const handStr = (): string => sd.hand.map((c) => c.kind === 'poker' ? `${c.rank}${c.suit}(费${c.cost ?? DEPLOY_COST})` : c.kind === 'tengang' ? `罡:${c.id}` : `煞:${c.id}`).join('、') || '空';
  say(`敌AI·决策开始：源泉${sd.mana} · 手牌[${handStr()}] · 库(扑${sd.pokerDeck.length}/罡${sd.tengangDeck.length}) · 场上兵${b.lanes.reduce((n, L) => n + L.b.length, 0)}`);
  let guard = 0; let garrisonDeploys = 0; // 开局布防最多铺 3 兵（owner 2026-07-04·「4 张免费布防太多·改 3」）——防廉价牌(费0)白铺满
  while (guard++ < 40) {
    if (garrison && garrisonDeploys >= 3) break; // 布防满 3 兵即停（免费额外线上限·balance 连带见 design 24 §三附）
    // owner 2026-07-03·对称同规则（REQ-G-退役机关门 + Boss自由混·balance §五）：**Boss 与玩家同一套动作规则·一回合内自由混 抽/打**——
    // 大类互斥基线（旧 `locked = actionTaken` 自锁）已删：每步枚举所有买得起的动作·只被 `mana≥cost` 限制。难度只来自 Boss 明牌 kit（地煞/布防/牌力）·不靠降/升规则。
    // **Boss 无换牌**：swapCard 是玩家专属 QoL（偏向玩家的小不对称·对玩家无损=公平）·Boss 不枚举 swap。
    const cands: AiCand[] = [];
    sd.hand.forEach((c, i) => { if (c.kind === 'poker' && (c.cost ?? DEPLOY_COST) <= sd.mana) for (const lane of [0, 1, 2]) cands.push({ kind: 'deploy', handIdx: i, lane, from: 'poker', score: scoreDeploy(b, c, lane, garrison) }); });
    if (sd.mana >= CAST_COST) {
      sd.hand.forEach((c, i) => { if (c.kind === 'tengang') cands.push({ kind: 'cast', handIdx: i, lane: 0, from: 'poker', score: scoreCast(b) }); });
    }
    if (sd.mana >= DISHA_COST) {
      sd.hand.forEach((c, i) => { if (c.kind === 'disha') cands.push({ kind: 'disha', handIdx: i, lane: 0, from: 'poker', score: scoreDisha(b) }); });
    }
    if (sd.mana >= DRAW_COST) {
      if (sd.pokerDeck.length) cands.push({ kind: 'draw', handIdx: -1, lane: 0, from: 'poker', score: scoreDraw(b, 'poker') });
      if (sd.tengangDeck.length) cands.push({ kind: 'draw', handIdx: -1, lane: 0, from: 'tengang', score: scoreDraw(b, 'tengang') });
    }
    if (cands.length === 0) {
      const pokerInHand = sd.hand.filter((c) => c.kind === 'poker').length;
      const why = sd.hand.length === 0 ? '手牌空' : pokerInHand > 0 ? `有${pokerInHand}张兵但源泉${sd.mana}买不起（放牌费=牌点·2~4免费）` : '手无兵牌（只剩罡/煞）'; // 为什么不部署：把原因写清（owner「敌人为啥不放兵」）
      say(`敌AI·决策结束：无更多可行动 —— ${why}；抽牌？${sd.mana >= DRAW_COST ? (sd.pokerDeck.length ? '可但没选' : '库空') : `源泉<${DRAW_COST}`}`);
      break;
    }
    // 会犯错（低档）：owner bug清单#5 修——旧「全随机」会让 Boss 抽牌(2.8分)压过部署(15.9分)→整局0源泉像弱智。
    //   改「保守但理性」：误选只在 **top-3 好动作**里随机（多样/不完美·但绝不选最差）→ 弱=打得不最优·非弱智。（ε 频率仍随 aiTier·design G 再定 Boss 强度目标。）
    const rnd = nextRandom(b.rng); const mistake = rnd < mistakeChance;
    let pick: AiCand;
    if (mistake) { const ranked = [...cands].sort((x, y) => y.score - x.score); pick = ranked[Math.floor(nextRandom(b.rng) * Math.min(3, ranked.length))]; }
    else pick = cands.reduce((bst, c) => (c.score > bst.score ? c : bst), cands[0]);
    const manaBefore = sd.mana; const card = pick.handIdx >= 0 ? sd.hand[pick.handIdx] : undefined;
    let ok = false;
    if (pick.kind === 'deploy') { ok = deployUnit(b, 'b', pick.handIdx, pick.lane); if (ok && garrison) garrisonDeploys++; } // 布防兵计数（上限 3·owner 2026-07-04）
    else if (pick.kind === 'cast') { ok = castTengang(b, 'b', pick.handIdx); if (ok && aggTengang) { sd.tengangA = aggTengang(sd.castIds); sd.castFx = sd.castIds.map((id) => ({ id, fx: aggTengang([id]) })); } } // 施法即重算·当回合推进生效（+逐张 castFx 供溯源）
    else if (pick.kind === 'disha') { const dc = sd.hand[pick.handIdx]; ok = castDisha(b, 'b', pick.handIdx); if (ok && dc?.kind === 'disha') castDishaIds.push(dc.id); } // 打地煞 → 记 id 供 caller 全屏通知
    else ok = drawCard(b, 'b', pick.from);
    const desc = pick.kind === 'deploy' ? `部署 ${card && card.kind === 'poker' ? card.rank + card.suit : '?'}→${LN[pick.lane]}路`
      : pick.kind === 'cast' ? `施天罡 ${card && card.kind === 'tengang' ? card.id : ''}`
      : pick.kind === 'disha' ? `打地煞 ${card && card.kind === 'disha' ? card.id : ''}`
      : `抽${pick.from === 'poker' ? '扑克' : '天罡'}`;
    say(`敌AI·${ok ? desc : '×' + desc + '(失败)'}（源泉${manaBefore}→${sd.mana}·评分${pick.score.toFixed(1)}${mistake ? '·随机误选' : ''}）`);
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
export function bossOpeningGarrison(b: TurnBattle, setupMana: number, aggTengang?: (ids: readonly string[]) => TengangFx, dbg?: (m: string) => void): string[] {
  if (b.turn !== 1 || b.winner !== 'pending') return [];
  const savedActive = b.active, savedAction = b.actionTaken;
  b.active = 'b'; b.b.mana = setupMana; b.actionTaken = null;
  dbg?.(`敌AI·开局布防（预算${setupMana}源泉·免费额外线·强制铺满三路防高速路）`);
  const dishaIds = aiDecide(b, aggTengang, dbg, true); // Boss 布防（garrison=true·分散铺三路·不 endTurn·不推进）
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
  return `T${b.turn}|${b.active}|mA${b.a.mana}|mB${b.b.mana}|hA${b.a.hand.length}|hB${b.b.hand.length}|HA${b.homeA}|HB${b.homeB}|w${b.winner}|s${b.rng.sequence}|${b.lanes.map(lane).join('|')}`;
}
