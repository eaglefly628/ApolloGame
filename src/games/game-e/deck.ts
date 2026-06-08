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

/** 一副标准 52 张（确定性顺序：花色外、点数内）。洗牌由引擎 random 原子做，不在此。 */
export const STANDARD_DECK: readonly Card[] = SUITS.flatMap((suit) =>
  RANKS.map((rank) => ({ suit, rank }) as Card),
);
