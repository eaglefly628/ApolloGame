// Game K · Zombie Slots —— 数据驱动僵尸老虎机。玩法=数据（blueprint 组件 + 引擎能力：dice-roll 掷轮、
// t3-slot-payout 判线赔付）；本目录零专属系统代码（宿主 mount/host + 纯数据工厂 + 表现层美术/音效）。
// 卡带 launcher 契约：mount(container) → cleanup。
export { mount } from './game-k.js';
export { buildBlueprint } from './blueprint.js';
export { buildTopBar, buildBottomBar, buildOverlay } from './hud.js';
export type { HudState } from './hud.js';
