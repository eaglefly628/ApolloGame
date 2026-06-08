// ════════════════════════════════════════════════════════════════════════
//  Game E · 牌组数据（纯数据：一副标准 52 张 + 每张牌的基础 chip 值）
//  这是「数据」侧：牌就是 {suit, rank}。牌型评估（5 张→牌型）是引擎能力 REQ-011，不在此。
//  数值源：Balatro Wiki · Poker Hands（2-10 取点数，J/Q/K=10，A=11）。
// ════════════════════════════════════════════════════════════════════════

export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  readonly suit: Suit;
  readonly rank: Rank;
}

export const SUITS: readonly Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
export const RANKS: readonly Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

/** 每张牌计分时贡献的基础 chips（进牌型后逐张相加）。 */
export const RANK_CHIPS: Readonly<Record<Rank, number>> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 10,
  Q: 10,
  K: 10,
  A: 11,
};

/** 点数排序权（用于顺子判定的参考数据；A 可高可低由引擎 REQ-011 处理）。 */
export const RANK_ORDER: Readonly<Record<Rank, number>> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

/** 人头牌（部分小丑按此触发，如 Scary Face / Smiley Face）。 */
export const FACE_RANKS: readonly Rank[] = ['J', 'Q', 'K'];

/** 一副标准 52 张（确定性顺序：花色外、点数内）。 */
export const STANDARD_DECK: readonly Card[] = SUITS.flatMap((suit) =>
  RANKS.map((rank) => ({ suit, rank }) as Card),
);

// ── 确定性洗牌 / 发牌（纯数据生成，种子化可复现）──────────────────────────
// 卡牌游戏的"洗牌+抽牌"是离散数据生成，不是引擎模拟逻辑（牌型判定/计分才是引擎能力）。
// 用 mulberry32（与引擎 RandomSeed 同族确定性 PRNG）→ 同 seed 同牌序，为后续 lockstep 联机铺路。
// 注：若将来多游戏复用"牌库/抽弃/洗牌"，再评估下沉 card-pile capability（当前 YAGNI，先纯函数）。

/** mulberry32 确定性 PRNG：返回每次 [0,1) 的取数器（与引擎 random 原子同算法）。 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 确定性 Fisher-Yates 洗牌（不改原数组；同 seed 同结果）。 */
export function shuffle<T>(cards: readonly T[], seed: number): T[] {
  const out = [...cards];
  const rng = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 一副洗好的标准牌（确定性，种子化）。 */
export function shuffledDeck(seed: number): Card[] {
  return shuffle(STANDARD_DECK, seed);
}
