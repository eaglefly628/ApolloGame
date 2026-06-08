// Game E · Balatro-like 卡牌构建 PoC。负责人：用户/Lead。
// 纯数据：卡牌 = Tag(花色+点数编码) + Resource(selected)；小丑 = Tag(JOKER_FLAG) + Resource(效果值)。
// 手牌评估 + 小丑效果由 UI 层读数据纯函数计算（离散事件驱动，无需专属 system）。
export {
  buildGameEBlueprint,
  SUIT_SPADES, SUIT_HEARTS, SUIT_DIAMONDS, SUIT_CLUBS,
  SUIT_MASK, RANK_SHIFT, RANK_MASK,
  CARD_FLAG, JOKER_FLAG,
  suitOf, rankOf, isCard, isJoker,
  SUIT_SYMBOL, SUIT_COLOR, RANK_LABEL, RANK_CHIPS,
} from './blueprint.js';
