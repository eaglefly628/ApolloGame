// 华丽起手包出口（PUI·owner 2026-07「起手默认华丽」）。新游戏 UI 起手 import 这里·别从零搭朴素屏。
export { STARTER_THEME, buildStarterHome, buildStarterResult } from './starter-kit.js';
export type { StarterAction } from './starter-kit.js';
// 剧情起手 · 伴侣在场件（REQ-DIALOGUE M3·用 M1 三件拼装·非新控件）。
export { buildPresence, pickReaction, SAMPLE_REACTIONS } from './presence.js';
export type { ReactionEntry, ReactionTable } from './presence.js';
// 剧情起手 · 立绘/表情链（REQ-DIALOGUE M2·emotion→assetKey 纯数据表 + 分级降级）。
export { resolveEmotionArt, emotionArtResolver, SAMPLE_EMOTION_ART } from './emotion-art.js';
export type { EmotionArtTable, ArtFallback, ArtResolver } from './emotion-art.js';
// 剧情起手屏（REQ-DIALOGUE M4·PUI 半·复制即跑的 VN 剧情屏模板·M1 三件已接线 bind + house 主题）。
export { buildStoryStarter } from './story-starter.js';
// 组合瓦片（查缺补漏 #6·跨游戏反复手搓的 ItemSlot/StatTile 去重·不加新控件·纯 LayoutNode）。
export { buildItemSlot, buildStatTile } from './tiles.js';
export type { ItemSlotSpec, StatTileSpec } from './tiles.js';
