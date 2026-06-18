// Game H ·《二十一点》(Blackjack) —— 传统 21 点游戏（纯数据驱动）
// 负责人：Lead。本目录是「游戏数据沙盒」：只装配现成引擎能力 + 内容数据。
export {
  buildGameHBlueprint,
  GAME_STATE_ENTITY,
  PLAYER_ENTITY,
  DEALER_ENTITY,
  DECK_ENTITY,
  HIT_BUTTON_ID,
  STAND_BUTTON_ID,
  RESTART_BUTTON_ID,
} from './blueprint.js';

export {
  SUITS,
  RANKS,
  DECK_ID,
  PLAYER_CARDS_ID,
  PLAYER_SCORE_ID,
  DEALER_CARDS_ID,
  DEALER_SCORE_ID,
  INITIAL_DECK_SIZE,
  BLACKJACK_LIMIT,
  DEALER_STAND_AT,
  GAME_STATES,
  OUTCOMES,
  buildDeck,
  type Card,
  type GameState,
  type Outcome,
} from './theme.js';
