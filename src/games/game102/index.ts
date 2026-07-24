// Game 102 · Pixel Pour《色流工坊》—— 数据驱动休闲益智。玩法=数据（WorldBlueprint + 引擎能力）；
// 本目录零专属系统代码（Lead 裁①·docs/design/game102/capability-plan.md）。
// S3 骨架关：manifest 立起 + load + 2tick 空跑（见 game102.skeleton.test.ts）。S4 接玩法链。
export { buildBlueprint } from './blueprint.js';
export { LEVELS, LEVEL_1, levelByNo } from './levels.js';
export type { Level, LevelGoal, LevelLimit } from './levels.js';
export { PALETTE, CONFIG } from './theme.js';
