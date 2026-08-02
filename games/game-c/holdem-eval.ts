import type { Card } from '@zerocraft/engine/engine/protocol/components.js';
import { evaluateHand, type HandType } from '@zerocraft/engine/skills/tier3/poker-hand.js';
import { seededShuffle } from '@zerocraft/engine/atom-skills/random/index.js';

// ═══════════════════════════════════════════════════════════════
//  game-c ·《六人德州》摊牌评估（capability-plan §4-a·owner 2026-07-17 TS 口径）
//
//  积木边界（owner 铁令：TS 只补缝，不绕积木）：
//    · 判型（含 A 低轮子顺）＝引擎 `t3-poker-hand` 的 evaluateHand ——本文件**不重写**任何牌型判定；
//    · 洗牌＝引擎 `w1-random` 的 seededShuffle（种子 PRNG·同 seed 同局）；
//    · 牌码＝`t2-card-pile` 契约 suit*100+rank（A=14），Card 形状取自 protocol/components。
//  本文件只补引擎积木没有的德州缝隙：7 选 5 最优、同型 kicker 全序值、比较/平分判定、发牌流。
//  确定性：纯整数枚举与比较，无浮点超越函数、无 IO、无隐藏随机。
// ═══════════════════════════════════════════════════════════════

// 德州牌型强度序（标准 52 张无 wild 下 evaluateHand 可能输出的 9 型；相对顺序与引擎 HAND_TYPE_ORDER 一致，
// 由扑克规则固定——测试钉死与 evaluateHand 的跨型一致性）。
export const HOLDEM_TYPE_ORDER: readonly HandType[] = [
  'high-card', 'pair', 'two-pair', 'three-of-a-kind', 'straight', 'flush',
  'full-house', 'four-of-a-kind', 'straight-flush',
];

// 全序值：[牌型序, 决胜位1..5]（不足补 0），字典序可比 —— 两手牌全部信息压进 6 个整数。
export type HandRank = readonly number[];

export function compareRank(a: HandRank, b: HandRank): number {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

// 顺子最高张：evaluateHand 已判定 isStraight；5 张相异里唯一歧义是 A 低轮子（A-2-3-4-5 时 A 当 1，高张=5）。
function straightHigh(ranks: readonly number[]): number {
  const set = new Set(ranks);
  if (set.has(14) && set.has(2) && set.has(3) && set.has(4) && set.has(5)) return 5;
  return Math.max(...ranks);
}

/** 5 张 → 全序值。判型走引擎 evaluateHand；决胜位=按（张数降序，点数降序）展平的分组点数——
 *  四条[四张点,踢脚]、葫芦[三条点,对点]、两对[高对,低对,踢]、对子[对点,踢×3]、同花/高牌[5 张降序]，
 *  顺子族只有[最高张]。恰好覆盖德州全部同型比较规则。 */
export function rank5(cards: readonly Card[]): HandRank {
  if (cards.length !== 5) throw new Error(`rank5 需要恰 5 张，收到 ${cards.length}`);
  const ev = evaluateHand(cards);
  const type = HOLDEM_TYPE_ORDER.indexOf(ev.type);
  if (type < 0) throw new Error(`标准 52 张不可能的牌型: ${ev.type}`);
  let tie: number[];
  if (ev.type === 'straight' || ev.type === 'straight-flush') {
    tie = [straightHigh([...ev.rankCounts.keys()])];
  } else {
    // 每组记一位（同型牌分组结构必同构，向量按位对齐可比）。
    tie = [...ev.rankCounts.entries()]
      .sort((x, y) => (y[1] - x[1]) || (y[0] - x[0]))
      .map(([rank]) => rank);
  }
  while (tie.length < 5) tie.push(0);
  return [type, ...tie];
}

/** 7（或 5/6）张里选 5 最优：C(n,5) 全枚举取字典序最大全序值。并列取枚举序最先（结果值相等，确定性）。
 *  返回全序值 + 最优 5 张（点数降序、同点花色升序——展示/测试稳定）。 */
export function bestOf7(cards: readonly Card[]): { value: HandRank; best: Card[] } {
  if (cards.length < 5 || cards.length > 7) throw new Error(`bestOf7 需要 5..7 张，收到 ${cards.length}`);
  let bestValue: HandRank | null = null;
  let bestCards: Card[] | null = null;
  const n = cards.length;
  const idx = [0, 1, 2, 3, 4];
  for (;;) {
    const five = idx.map((i) => cards[i]);
    const v = rank5(five);
    if (bestValue === null || compareRank(v, bestValue) > 0) {
      bestValue = v;
      bestCards = five;
    }
    // 下一个 5 组合（字典序）：从右往左找可进位。
    let p = 4;
    while (p >= 0 && idx[p] === n - 5 + p) p--;
    if (p < 0) break;
    idx[p]++;
    for (let q = p + 1; q < 5; q++) idx[q] = idx[q - 1] + 1;
  }
  const best = [...bestCards!].sort((a, b) => (b.rank - a.rank) || (a.suit - b.suit));
  return { value: bestValue!, best };
}

// ── 牌码互转（t2-card-pile 契约 suit*100+rank）──────────────────────────────
export const cardToCode = (c: Card): number => c.suit * 100 + c.rank;
export const codeToCard = (code: number): Card => ({ suit: Math.floor(code / 100), rank: code % 100 });

/** 标准 52 张（花色 0..3=♠♥♦♣ × 点数 2..14）·花色主序——确定性基准牌序，洗牌前的单一真相。 */
export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (let suit = 0; suit < 4; suit++) for (let rank = 2; rank <= 14; rank++) deck.push({ suit, rank });
  return deck;
}

export interface HoldemDeal {
  holes: Card[][]; // 每席 2 张（席序=调用方座位序）
  board: Card[]; // 公共牌 5 张（翻3+转1+河1，发牌即定·揭示节奏归表现层）
}

/** 发一手牌：seededShuffle（引擎积木）洗基准牌序 → 轮发两圈底牌 → （可选烧牌）翻/转/河。
 *  同 seed 同席数同开关 → 逐张一致（回放/测试基石）。burn=仪式感数据开关（GDD §3），不影响公平。 */
export function dealHoldem(seed: number, seatCount: number, opts: { burn?: boolean } = {}): HoldemDeal {
  if (seatCount < 2 || seatCount > 10) throw new Error(`席数 2..10，收到 ${seatCount}`);
  const deck = seededShuffle(buildDeck(), seed);
  let ptr = 0;
  const holes: Card[][] = Array.from({ length: seatCount }, () => []);
  for (let round = 0; round < 2; round++) {
    for (let s = 0; s < seatCount; s++) holes[s].push(deck[ptr++]);
  }
  const board: Card[] = [];
  if (opts.burn) ptr++;
  board.push(deck[ptr++], deck[ptr++], deck[ptr++]);
  if (opts.burn) ptr++;
  board.push(deck[ptr++]);
  if (opts.burn) ptr++;
  board.push(deck[ptr++]);
  return { holes, board };
}

/** 七张封装：底牌 2 + 公共 5 → 最优全序值（摊牌主入口）。 */
export function holdemRank(hole: readonly Card[], board: readonly Card[]): { value: HandRank; best: Card[] } {
  if (hole.length !== 2 || board.length !== 5) throw new Error('holdemRank 需要底牌 2 + 公共 5');
  return bestOf7([...hole, ...board]);
}
