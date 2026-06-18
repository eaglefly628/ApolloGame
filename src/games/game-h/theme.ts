// ═══════════════════════════════════════════════════════════════
//  Game H ·《二十一点》(Blackjack) v1.0 —— 主题和游戏数据（纯 DATA）
// ═══════════════════════════════════════════════════════════════

// ── 卡牌定义 ────────────────────────────────────────────────────
export interface Card {
  readonly suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  readonly rank: 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
  readonly display: string;
  readonly baseValue: number;
}

export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;

function buildCard(suit: typeof SUITS[number], rank: typeof RANKS[number]): Card {
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
  return { suit, rank, display: displays[rank], baseValue: values[rank] };
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
export const CHIPS_ID = 'chips';     // 玩家筹码
export const BET_ID = 'bet';         // 当前押注
export const DECK_ID = 'deck';       // 牌堆剩余数

// ── 游戏常量 ────────────────────────────────────────────────────
export const INITIAL_CHIPS = 1000;       // 初始筹码
export const MIN_BET = 10;               // 最小押注
export const MAX_BET = 500;              // 最大押注
export const BLACKJACK_LIMIT = 21;       // 21 点限制
export const DEALER_STAND_AT = 17;       // 庄家 17 点站住
export const INITIAL_DECK_SIZE = 52;     // 标准 1 副牌

// ── 游戏状态 ────────────────────────────────────────────────
export const GAME_STATES = {
  BETTING: 'betting',           // 押注阶段
  DEALING: 'dealing',           // 发牌阶段
  PLAYER_TURN: 'player_turn',   // 玩家回合
  DEALER_TURN: 'dealer_turn',   // 庄家回合
  GAME_OVER: 'game_over',       // 游戏结束
} as const;

export type GameState = typeof GAME_STATES[keyof typeof GAME_STATES];

// ── 游戏结果 ────────────────────────────────────────────────
export const OUTCOMES = {
  PLAYER_WIN: 'player_win',
  DEALER_WIN: 'dealer_win',
  TIE: 'tie',
  PLAYER_BUST: 'player_bust',
  DEALER_BUST: 'dealer_bust',
  BLACKJACK: 'blackjack',
} as const;

export type Outcome = typeof OUTCOMES[keyof typeof OUTCOMES];

// ── 手牌 ────────────────────────────────────────────────
export interface Hand {
  cards: Card[];
  bet: number;
  status: 'active' | 'stand' | 'bust' | 'win' | 'lose' | 'tie' | 'blackjack';
}
