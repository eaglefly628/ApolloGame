// Game Q · Neon Siege —— 数据驱动塔防。玩法=数据（blueprint 组件 + 引擎能力）；本目录零专属系统代码。
// 卡带 launcher 契约：mount(container) → cleanup。
export { mount } from './game-q.js';
export { buildBlueprint } from './blueprint.js';
export { buildTopBar, buildBottomBar, buildOverlay } from './hud.js';
export type { HudState } from './hud.js';
