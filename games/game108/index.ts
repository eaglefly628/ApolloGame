// game108《拳律 / Rule of Three》—— 数据驱动猜拳对决。玩法=数据（blueprint 组件 + 引擎能力）；本目录零专属系统代码。
// 卡带 launcher 契约：mount(container) → cleanup。
export { mount, setCard, setWorldObserver, setWorldRestore, consumeWorldRestore } from './game108.js';
export type { WorldRestorePayload } from './game108.js';
export { buildBlueprint } from './blueprint.js';
export { buildDuelScreen, emptyView } from './duel-screen.js';
export type { DuelView } from './duel-screen.js';
