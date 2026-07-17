// Game T ·《墨消》—— 出口（launcher 动态 import 消费 mount；数据/纯函数供测试与 GD sim 复用）。
export { mount } from './game-t.js';
export { buildLevelBlueprint } from './blueprint.js';
export { LEVELS, parseLayout, goalRequirements, finalScore, starsFor, progressStates, levelIssues } from './levels.js';
export type { LevelSpec, LevelGoal } from './levels.js';
