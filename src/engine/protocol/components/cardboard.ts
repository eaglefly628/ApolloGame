// Protocol · 牌与棋盘算法（Tier3「算法/解释器型机制」）─────────────────────────────
// Condition→Event→Effect 表达不了的"带网格扫描/有序迭代/计数排序"的算法型机制：三消棋盘(match3-board)、
// 扑克牌型(poker-hand)、逐张计分(card-scoring)、计分 trace、带牌库出牌(card-pile)。各自一台确定性解释器。
import type { Component, EntityId } from '../../core/types.js';

// ── match3-board ── 三消棋盘机制（REQ-C-001）：网格消除（交换/找连/消除产出/重力/补块/连锁）。
// 这是「算法/解释器型机制」大类的代表——Condition→Event→Effect 表达不了"带网格扫描/循环的算法"。
// 相位状态机：idle（读点击选格/发起交换）→ swapped（首扫，无连线则回退）→ match（找≥3连线）
// → clear（按 kindResource 发 ResourceModify 产料/币、置 -1）→ fall（按列下沉）→ refill（顶部确定性随机补）
// → match（连锁）…稳定无连线 → idle。确定性：整数网格 + RandomSeed 整数 PRNG 补块，不碰浮点超越函数。
// 产出走现成 ResourceModify → resource-apply 结算 → game-c 升级/换装链自动点亮（游戏数据不动一行）。
export interface MatchBoard extends Component {
  readonly type: 'MatchBoard';
  cols: number;
  rows: number;
  kindCount: number; // 棋子种类数
  cells: number[]; // 长 cols*rows，值=种类 0..kindCount-1，-1=空
  kindResource: string[]; // 种类→产出 Resource id（消该种 → ResourceModify 该 id）
  matAmount: number; // 每消一格给对应材料的量
  coinResource: string; // 货币 Resource id（空串=不产币）
  coinPerTile: number; // 每消一格给的货币
  kindTint: number[]; // 种类→视图底色（match-view-sync 写 Color.tint）
  kindLabel: string[]; // 种类→视图文字（match-view-sync 写 Text.content）
  phase: string; // 'idle'|'swapped'|'match'|'clear'|'fall'|'refill'
  selIndex: number; // 当前选中格（-1=无）
  swapA: number; // 本次交换两格（-1=无）
  swapB: number;
  stepTimer: number; // 相位推进节拍计数
  stepDelay: number; // 相位间等待 tick 数（让连锁可见；0=即时）
  selectAction: string; // 选中格的信号名（clickable 命中格子时发的 Signal.name）
}

// ── match3-board 视图格 ── 把逻辑格 index 绑到一个可点/可显示的实体（纯数据，游戏蓝图静态建好）。
// match-view-sync 据 cells 改它的 Color.tint/Text.content；clickable 命中它发选中信号。capability 不创建/销毁实体。
export interface BoardCell extends Component {
  readonly type: 'BoardCell';
  boardId: EntityId;
  index: number;
}

// ── poker-hand 牌（REQ-011）── 一张牌 = {花色, 点数}，纯整数枚举（确定性：相等/大小比较，不碰浮点）。
// suit：0..3（♠♥♦♣，仅用于"是否同花"的相等比较，无大小语义）。
// rank：2..14（J=11,Q=12,K=13,A=14；A 在顺子里也可当 1 凑 A-2-3-4-5 的"轮子"低顺）。
// 牌不是组件，是被 PlayedHand.cards 持有的纯数据（如 StatModifier 之于 Stats）。
export interface Card {
  suit: number;
  rank: number;
  // ── REQ-E-021 牌的**内禀修正**（附魔/版式/增强）── card-scoring 逐张 pass 在 baseChips 之后、外部小丑
  // (PerCardRule) 之前**按序套用**到对应 Resource。通用「实体携带修正、被处理时套用」原语（卡牌符文/牌面状态
  // 跨卡牌游戏复用），非 Buff 元系统：语境=计分循环本身（隐式）。版式/增强全是数据：
  //   foil=[{op:'add',target:'chips',value:50}]、holo=[{op:'add',target:'mult',value:10}]、poly=[{op:'mul',target:'mult',value:1.5}]。
  mods?: Array<{ op: 'add' | 'mul'; target: string; value: number }>;
  // ── REQ-E-021 牌的内禀重触发（红蜡封）── 并进逐张计分的 repeats（该牌连同其上 mods/小丑一起重复结算）。
  retrigger?: number;
}

// ── poker-hand 出牌（REQ-011）── 本次"出"的一手牌（有序，供逐张迭代 / 按花色·点数计数）。
// 由选牌交互（clickable→signal→effect 装配）填充——**不在 poker-hand 能力里做选牌 UI / 洗牌发牌**
// （那些用现有 clickable/random/effect-apply 重组）。cards 为空=本帧不评估（基础分由装配层在新回合清零）。
export interface PlayedHand extends Component {
  readonly type: 'PlayedHand';
  cards: Card[];
  // 可选归属玩家 id（多人/coop）：card-play 按它把某玩家的「出牌」输入路由到对应牌桌的 PlayedHand。
  // 单人留空（装配层直接填 cards）。
  owner?: string;
}

// ── poker-hand 评估器配置（REQ-011；Tier3「算法/解释器型机制」大类，与 match3-board/tilemap 同构）──
// Condition→Event→Effect 表达不了"5 张是不是同花顺"这种带计数/排序的算法；本配置 + poker-eval 系统补这格缺口。
// rankingTable = 牌型名→{baseChips, baseMult} 的纯数据表（最弱 LLM 能产；设计可调，不写死在代码）。
// 系统读同实体上的 PlayedHand → 确定性判定最高牌型 → 把基础 chips/mult **set** 进两个 Resource（基础值），
// 再由小丑（effect-apply 的 op:'mul'/order，REQ-012）在其上做修正 → score=chips×mult 与盲注线（condition）比。
// 只算分、不碰渲染、不驱动逻辑外状态。确定性：纯整数/枚举比较与计数，牌型判定是纯函数（有序卡集→稳定输出）。
// 派生事实输出（REQ-011 完善）：poker-eval 把求值器已算出的「包含谓词原语 + 出牌张数」写成 condition 可读的
// Resource/Flag/StringVar，全部**可选、按需配**（配了且目标存在才写）。有了这组原语，"含对子/含三条/含两对/含顺/含同花/
// 含葫芦"等**包含**判定就是 condition 的组合表达（如 rankMaxCount≥2=含对子、and(rankMaxCount≥3,pairCount≥2)=含葫芦），
// 不必为每种牌型写专门 flag。修正「含对子≠最高牌型是对子」（葫芦也含对子）这一真 bug——只看 handTypeVar 会漏触发。
export interface PokerHand extends Component {
  readonly type: 'PokerHand';
  rankingTable: Record<string, { chips: number; mult: number }>; // 牌型名 → 基础分（纯数据表）
  chipsResource: string; // 写基础 chips 的 Resource id（按 id 全局定位）
  multResource: string; // 写基础 mult 的 Resource id
  handTypeVar?: string; // 可选：写**最高**牌型名的 StringVar id（"打出同花顺→某小丑"这类"恰是某型"判定）
  rankMaxCountResource?: string; // 可选：最大同点张数（2=含对子,3=含三条,4=含四条,5=含五条）写入此 Resource
  pairCountResource?: string; // 可选：点数计数≥2 的种数（2=含两对）写入此 Resource
  isStraightFlag?: string; // 可选：是否含顺子写入此 Flag.id
  isFlushFlag?: string; // 可选：是否含同花写入此 Flag.id
  handSizeResource?: string; // 可选：本次出牌张数写入此 Resource（Half Joker「出牌≤3张」等）
}

// ── card-scoring 逐张谓词（REQ-014）── 对"当前计分牌"求值的小词汇表（纯数据，最弱 LLM 可产）。
// 刻意只含卡面属性（花色/点数集合/序号）+ 布尔组合；**不烘焙任何 Balatro 常量**：
//   人头 = rankIn[11,12,13]；偶(Even Steven)=rankIn[2,4,6,8,10]；奇(Odd Todd)=rankIn[3,5,7,9,14]——全由数据表达。
// 与通用 Condition 不同：Condition 读世界 Flag/Resource/State，这里读的是迭代中瞬态的"当前牌"，故是卡域专用谓词。
export type PerCardWhen =
  | { kind: 'always' }
  | { kind: 'suit'; suit: number } // 该牌花色 == suit（0..3）
  | { kind: 'rankIn'; ranks: number[] } // 该牌点数 ∈ ranks（人头/偶/奇/具体点数都用它）
  | { kind: 'index'; eq: number } // 该牌在出牌序列中的序号 == eq（首张=0，供 retrigger/首张型小丑）
  | { kind: 'and'; of: PerCardWhen[] }
  | { kind: 'or'; of: PerCardWhen[] }
  | { kind: 'not'; of: PerCardWhen };

// ── card-scoring 配置（REQ-014；Tier3「算法/解释器型机制」，poker-hand 的逐张伴生件）──
// 挂"牌桌"单例（与 PlayedHand 同实体）：逐张 pass 按序遍历 PlayedHand.cards，对每张（含 retrigger 重复）
// 把该牌 baseChips 累加进 chipsResource。Condition→Event→Effect 是反应式布尔、表达不了"有序迭代 + 逐元素上下文 +
// retrigger 乘性耦合"——正是本能力补的缺口（与 match3-board/poker-hand 同构）。baseChipsByRank 纯数据，引擎不写死。
export interface PerCardScore extends Component {
  readonly type: 'PerCardScore';
  chipsResource: string; // 逐张 baseChips 累加进此 Resource（在 poker-eval set 的牌型基础分之上 add）
  baseChipsByRank: Record<string, number>; // 点数(字符串键)→该牌基础筹码，如 {"10":10,"11":10,"14":11}；缺键=0
}

// ── card-scoring 逐张规则（REQ-014）── 一条逐张小丑 = 一个 PerCardRule 组件（与 effect-apply 的 Effect 同构，
// 每张小丑一个实体）。逐张 pass 遍历每张计分牌，对每条 when 命中当前牌的规则，按 op 改 targetResource（钳上下限）。
// 例：Greedy{when:{kind:'suit',suit:2},op:'add',targetResource:'mult',value:3}（每张♦+3 倍率）。
export interface PerCardRule extends Component {
  readonly type: 'PerCardRule';
  when: PerCardWhen;
  op: 'add' | 'mul';
  targetResource: string;
  value: number;
  // 概率门（REQ-E-023②）：在场则该牌命中 when 后再掷世界 RandomSeed，nextRandom < num/den 才施用（逐张独立 roll，
  // 如 Bloodstone「每张♥ 1/2 概率 ×1.5」）。确定性同 Effect.chance（引擎种子 PRNG，lockstep 安全）。
  chance?: { num: number; den: number };
}

// ── card-scoring retrigger（REQ-014）── 重触发规则（Hanging Chad/Red Seal/Mime 折叠于此）。
// when 命中的牌，在逐张 pass 里被额外计分 extra 次（共 1+extra 次）：该牌的 baseChips 与所有命中它的 PerCardRule
// 都随之重复结算——这正是聚合计数表达不了、必须逐张迭代的乘性耦合。例：Hanging Chad{when:{kind:'index',eq:0},extra:2}。
export interface PerCardRetrigger extends Component {
  readonly type: 'PerCardRetrigger';
  when: PerCardWhen; // 哪些牌重触发（如 index==0 = 首张）
  extra: number; // 额外重复次数（Hanging Chad = 2）
}

// ── score-trace（REQ-019）── 逐步计分 trace：计分链各系统按真实执行序 append 每一步，UI 只回放、不重算。
// 通用「分步结算演出」输出（卡牌计分 / 遗物结算 / 伤害分解皆可复用）。**排除出 hashSnapshot**（纯表现输出，同 Camera）。
// opt-in：只有世界存在 ScoreTrace 单例时计分链才记录；非此类玩法零开销。每次计分由首系统(poker-eval)清空重建。
export interface ScoreEvent {
  seq: number; // 步序（= append 时 events 长度，0,1,2…）
  phase: string; // 阶段语义（自由 string：'base'|'percard'|'percard-rule'|'effect'…，保通用复用面）
  target: string; // 本步改的 Resource id（如 'chips'/'mult'/'score'）
  op: 'set' | 'add' | 'mul'; // 本步运算
  value: number; // 本步的量（add 加量 / mul 倍率 / set 值）
  after: number; // 本步后 target 的当前值（供 UI 计数器跳动）
  source?: string; // 语义来源（牌型名 / 'card:<i>' / Effect 实体 id），UI 据它高亮/抖动
}
export interface ScoreTrace extends Component {
  readonly type: 'ScoreTrace';
  events: ScoreEvent[];
}

// ── card-pile（REQ-017）── 牌库/手牌的 sim 内确定性管理（卡牌品类 staple）。
// deck=抽牌堆（预洗好的牌码数组，front=下一张，纯数据→确定性，lockstep 双端同序）；hand=当前手牌；
// handSize=目标手牌数。card-pile 系统：处理 play/discard 输入（按手牌**下标**选牌）+ 抽牌补到 handSize。
// 让"发牌→选→出/弃→补牌"全进 sim（非 React），是回合流程数据状态机化 + lockstep 联机的共同前置。
// 与 card-play(直接喂牌码、无牌库) 的区别：card-pile 是**带牌库的完整出牌管理**（下标选牌 + 自动补牌）。
export interface CardPile extends Component {
  readonly type: 'CardPile';
  owner?: string; // 输入路由 + scoring Flag id（多人各一份 CardPile）
  deck: number[]; // 抽牌堆（牌码 suit*100+rank，预洗好；front=下一张）
  hand: number[]; // 当前手牌（牌码）
  handSize: number; // 目标手牌数（抽牌补到这个数）
  // REQ-F-040(A1)「按数据值分发」最后一环：成交拍把取出的牌码写进该 id 的 Resource（恰取 1 张时；
  // 商店/锦囊/事件卡同形）→ 既有 banded EventWhen{resource eq 码} 即可分发到专属信号。
  playedCodeResource?: string;
  // REQ-F-040(A2) 可负担门：全部代价付得起才执行 play（验→扣→取牌原子在本系统内完成；
  // 付不起则整次 play 不执行、牌不丢——修"card-pile 先取牌、craft-recipe(Commit) 后查钱"的时序硬伤）。
  playCosts?: Array<{ id: string; amount: number }>;
  // REQ-F-041(A) 信号刷新桥：该名 Signal 在场 → 弃全部手牌 + 按 handSize 补满（商店刷新/prep 自动换批）。
  // 配 edge 信号（event-when/clickable 一拍脉冲）；锁店=信号链上游用 Flag 条件挡（EventWhen 重组，零引擎）。
  // 同拍撞上 play/discard 输入则忽略该输入（刷新优先，下标已失效）。
  refreshOnSignal?: string;
  // REQ-F-042(A) 手牌可视化出口：每拍把 hand[i] 牌码镜像进第 i 个 Resource（id 列表；空槽写 0）。
  // banded EventWhen{resource eq 码} 即可驱动每槽 marker 展开/销毁（与 bought_code 买入分发同构）。
  handCodeResources?: string[];
  // REQ-F-042(B) 信号出牌桥：第 i 个名字的 Signal 在场 = play(i)（clickable 槽位按钮→信号→购买）。
  // 每拍至多处理一个（最低下标优先；同拍双击=退化输入）；刷新拍忽略；照常过 playCosts 可负担门。
  playOnSignals?: string[];
  // REQ-F-048② 袋归还：returnOnSignal 在场 → 读 returnCodeResource 的牌码（>0），插回 deck **底部**并清零
  // （有限袋语义保真：卖出的将回袋可再抽）。码由卖出链写入（每将 banded sell Effect set 该资源，纯数据）。
  returnOnSignal?: string;
  returnCodeResource?: string;
}
