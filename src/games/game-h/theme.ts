// ═══════════════════════════════════════════════════════════════
//  Game H ·《二十一点》(Blackjack) —— 传统 21 点纸牌游戏（纯 DATA）
//
//  这是「内容」层：卡牌花色、点数、游戏数值。
//  逻辑（洗牌、点数计算、胜负判定）由引擎 capability 承担。
// ═══════════════════════════════════════════════════════════════

// ── 卡牌定义 ────────────────────────────────────────────────────
export interface Card {
  readonly suit: 'hearts' | 'diamonds' | 'clubs' | 'spades'; // 花色
  readonly rank: 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'; // 点数
  readonly display: string; // 显示字符
  readonly baseValue: number; // A=1, 2-10=面值, J/Q/K=10
}

export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;

function buildCard(suit: 'hearts' | 'diamonds' | 'clubs' | 'spades', rank: typeof RANKS[number]): Card {
  const displays: Record<string, string> = {
    'A': 'A', '2': '2', '3': '3', '4': '4', '5': '5',
    '6': '6', '7': '7', '8': '8', '9': '9', '10': '10',
    'J': 'J', 'Q': 'Q', 'K': 'K',
  };
  const values: Record<string, number> = {
    'A': 1, '2': 2, '3': 3, '4': 4, '5': 5,
    '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
    'J': 10, 'Q': 10, 'K': 10,
  };
  return {
    suit,
    rank,
    display: displays[rank],
    baseValue: values[rank],
  };
}

export function buildDeck(): readonly Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(buildCard(suit, rank));
    }
  }
  return deck;
}

// ── 游戏资源 ID ────────────────────────────────────────────────────
export const DECK_ID = 'deck'; // 牌堆剩余卡数
export const PLAYER_CARDS_ID = 'player_cards'; // 玩家手牌数
export const PLAYER_SCORE_ID = 'player_score'; // 玩家点数
export const DEALER_CARDS_ID = 'dealer_cards'; // 庄家手牌数
export const DEALER_SCORE_ID = 'dealer_score'; // 庄家点数

// ── 游戏常量 ────────────────────────────────────────────────────
export const INITIAL_DECK_SIZE = 52; // 标准 1 副牌
export const BLACKJACK_LIMIT = 21; // 21 点限制
export const DEALER_STAND_AT = 17; // 庄家 17 点站住

// ── 游戏状态 enum（用于 state capability）────────────────────────
export const GAME_STATES = {
  INIT: 'init', // 初始化
  PLAYER_TURN: 'player_turn', // 玩家回合
  DEALER_TURN: 'dealer_turn', // 庄家回合
  GAME_OVER: 'game_over', // 游戏结束
} as const;

export type GameState = typeof GAME_STATES[keyof typeof GAME_STATES];

// ── 游戏结果 enum ────────────────────────────────────────────────
export const OUTCOMES = {
  PLAYER_WIN: 'player_win',
  DEALER_WIN: 'dealer_win',
  TIE: 'tie',
  PLAYER_BUST: 'player_bust',
  DEALER_BUST: 'dealer_bust',
} as const;

export type Outcome = typeof OUTCOMES[keyof typeof OUTCOMES];
