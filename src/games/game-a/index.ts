// Game A ·《掼蛋夜宴》—— 出口（launcher 动态 import 消费 mount；数据/纯转换供测试与 GD sim 复用）。
export { mount } from './game-a.js';
export { buildTableBlueprint, type TableOptions } from './blueprint.js';
export {
  buildDeck108, guandanConfig, cardCode, codeSuit, codeRank, isJoker,
  SEATS, AI_TIERS, DECK_SIZE, HAND_SIZE, DRESS_TIERS,
  INITIAL_FUNDS, STAKES, BUYIN_MULT, RESULT_MULTS, ROUND_MULT_CAP, LEVEL_START,
} from './rules.js';
export { cardAssetId, cardAssetUrl, CARD_BACK_ID } from './theme.js';
