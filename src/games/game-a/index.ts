// Game A · 双人协作冒险（co-op platformer）。负责人：PA。
// v0.1：双人移动 + 跳跃 + 平台（固定屏核心闭环）。路线/引擎需求见 DESIGN.md。
export { buildGameABlueprint, COLOR_A, COLOR_B, PLAYER_A, PLAYER_B, PLAYER_A_ENTITY, PLAYER_B_ENTITY } from './blueprint.js';
export { KEYMAP_A, KEYMAP_B } from './keymaps.js';
export { LEVEL_W1_1 } from './level.js';
export type { Level, Box, Spawn } from './level.js';
export { makeCoopGoalCapability, COOP_ENTITY, COOP_CLEAR_FLAG } from './coop-goal.js';
