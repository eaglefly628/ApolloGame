// Game H ·《二十一点》(Blackjack) v1.0 —— 传统 21 点游戏（纯数据驱动）
// 负责人：Lead。本目录是「游戏数据沙盒」：只装配现成引擎能力 + 内容数据。
export {
  buildGameHBlueprint,
  GAME_STATE_ENTITY,
  CHIPS_ENTITY,
  BET_ENTITY,
} from './blueprint.js';

export {
  SUITS,
  RANKS,
  CHIPS_ID,
  BET_ID,
  DECK_ID,
  INITIAL_CHIPS,
  MIN_BET,
  MAX_BET,
  BLACKJACK_LIMIT,
  DEALER_STAND_AT,
  INITIAL_DECK_SIZE,
  GAME_STATES,
  OUTCOMES,
  buildDeck,
  type Card,
  type GameState,
  type Outcome,
  type Hand,
} from './theme.js';
