// Game 102 · Pixel Pour《色流工坊》—— 数据驱动休闲益智。玩法=数据（WorldBlueprint + 引擎能力）；
// 本目录零专属系统代码（Lead 裁①·docs/design/game102/capability-plan.md）。
// S3 骨架关：manifest 立起 + load + 2tick 空跑（见 game102.skeleton.test.ts）。S4 接玩法链。
// 分工：sim/blueprint/levels/colors = PE 域（theme.ts）；四屏 UI chrome = PUI 域（ui-theme.ts + hud.ts·REQ-G102-UI）。
export { buildBlueprint } from './blueprint.js';
export { LEVELS, LEVEL_1, levelByNo } from './levels.js';
export type { Level, LevelGoal, LevelLimit } from './levels.js';
export { PALETTE, CONFIG } from './theme.js';

// ── UI（PUI·四屏纯 LayoutNode builder + pixelPour 皮·REQ-G102-UI）──────────────────────
export {
  buildTopBar, buildBurst, buildResult, buildSelect, buildRevive, defaultHud,
} from './hud.js';
export type { HudState, BurstState, ResultState, SelectState, ReviveState } from './hud.js';
export { pixelPour, KEYS_TOTAL, DOOR_GOAL, TRAY_SLOTS, AMMO_MAX, CAPACITY, G102_SLICE } from './ui-theme.js';
