// Game A · 双人协作冒险（co-op platformer）。负责人：PA。
// v0.1：双人移动 + 跳跃 + 平台（固定屏核心闭环）。路线/引擎需求见 DESIGN.md。
export { buildGameABlueprint, COLOR_A, COLOR_B, PLAYER_A, PLAYER_B, PLAYER_A_ENTITY, PLAYER_B_ENTITY, CAMERA_ENTITY, VIEWPORT_W, VIEWPORT_H, COOP_ENTITY, COOP_CLEAR_FLAG } from './blueprint.js';
export { KEYMAP_A, KEYMAP_B } from './keymaps.js';
export { LEVEL_W1_1, LEVEL_SCROLL, LEVEL_SWITCH } from './level.js';
export type { Level, Box, Spawn, Mover, Door, Switch } from './level.js';
export { GAME_A_ASSETS, ASSET_BG, ASSET_GOAL } from './assets.js';
