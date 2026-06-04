import type { KeyMap } from '@net/index.js';

// 设计键位：
//  角色 A（蓝）：A/D 移动、Space 跳。
//  角色 B（橙）：←/→ 移动、/ 跳。
// 与 blueprint 的 Controllable.playerId（'A' / 'B'）对应，由 main.tsx 的 MultiInputSource 路由。
// 交互键（A=E、B=.）与角色能力差异（二段跳 / 推重物）留到 v0.2+（需引擎交互/能力支持）。
export const KEYMAP_A: KeyMap = { KeyA: { dx: -1 }, KeyD: { dx: 1 }, Space: { jump: true } };
export const KEYMAP_B: KeyMap = { ArrowLeft: { dx: -1 }, ArrowRight: { dx: 1 }, Slash: { jump: true } };
