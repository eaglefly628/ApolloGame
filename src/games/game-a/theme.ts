// Game A ·《掼蛋夜宴》—— 视觉常量与资产 key 映射（纯数据·零逻辑）。
// 色锚取自 owner 钦定蓝本 guandan-lite-mockup.html（深夜暗红底 × 朱砂 × 米金）；
// 布局基准=ui-scene-design §1：横屏 16:9 · 1280×720 逻辑分辨率。S5 UI 关按蓝本 1:1 定稿。
import { codeRank, codeSuit, RANK_BIG_JOKER, RANK_SMALL_JOKER } from './rules.js';

export const FIELD_W = 1280;
export const FIELD_H = 720;

// 蓝本色锚（mockup 缩略图源色）：暗红夜局底 / 朱砂红强调 / 米金（金钱·标题）/ 暖沙。
export const NIGHT_BG = '#2a0f11';
export const CINNABAR = '#c8352b';
export const GOLD = '#f0c96a';
export const WARM_SAND = '#d8b878';

// 私宅夜局场景底（宿主装饰层·真背景图=S6 台账件 A-BG-01/02·风格锚 modern-manor）。
export const MANOR_BG =
  'radial-gradient(ellipse at 50% 20%, #4a1c1f 0%, #341316 52%, #2a0f11 100%),' +
  'repeating-linear-gradient(90deg, rgba(240,201,106,0.02) 0 2px, transparent 2px 8px)';
export const WRAPPER_BG = '#140a0b';

// ── 牌资产 key（本地库 public/games/game-a/art/index.json·vendor 自 PD 货架·§5.1）───
// 两副=同素材引两次；级牌/逢人配高亮=运行时特效叠加，不烤进牌面（§5.1 铁律）。
const RANK_WORDS: Record<number, string> = {
  2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight',
  9: 'nine', 10: 'ten', 11: 'jack', 12: 'queen', 13: 'king', 14: 'ace',
};
const SUIT_WORDS = ['spades', 'hearts', 'diamonds', 'clubs'] as const;

/** 牌码 → 本地资产 id（card/<rank>-of-<suit>·王=joker-black/red）。 */
export function cardAssetId(code: number): string {
  const rank = codeRank(code);
  if (rank === RANK_SMALL_JOKER) return 'card/joker-black';
  if (rank === RANK_BIG_JOKER) return 'card/joker-red';
  return `card/${RANK_WORDS[rank]}-of-${SUIT_WORDS[codeSuit(code)]}`;
}
export const CARD_BACK_ID = 'card/back';

/** 资产 id → 站点绝对 URL（本地索引 path 约定·vendor-asset 落盘规律；vendor.test 逐条对账钉死）。 */
export function cardAssetUrl(assetId: string): string {
  const ext = assetId === CARD_BACK_ID ? 'png' : 'svg';
  return `/games/game-a/art/cards/${assetId.slice('card/'.length)}.${ext}`;
}
