// game112《星尾会客厅》—— 猫陪伴 × 轻卡牌 × 回忆。玩法 = 数据（blueprint + 引擎能力）；本目录零专属系统代码。
// 架构基石：**猫的行为在 sim，猫的画面是投影**（docs/design/game112/framework.md §0）。
export { buildBlueprint, EMPTY_STATE } from './blueprint.js';
export type { PersistedState } from './blueprint.js';
export { HallSession } from './session.js';
export { buildHallView, buildReadingView, toPersisted } from './project.js';
export type { HallView, ReadingView } from './project.js';
export { buildScreen, buildHome, buildHall, buildOrbs, buildTable, buildToys, buildShop, buildMemory, buildReading, UI_ACTIONS } from './ui.js';
export type { Screen } from './ui.js';
export { mount, routeAction, normalizeState, SAVE_CODEC, SAVE_SLOT } from './game112.js';
export * from './world-data.js';
