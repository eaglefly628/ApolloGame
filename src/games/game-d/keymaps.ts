import type { KeyMap } from '@net/index.js';

// 英雄键位（设备层，物理键 → 意图）：WASD/方向键移动；数字键 1/2/3 → 离散动作名。
// 动作名 → 技能信号的语义映射在蓝图的 KeyBinding（数据，可重绑），由 keybind 能力解释。
export const KEYMAP_D: KeyMap = {
  KeyW: { dy: -1 },
  KeyS: { dy: 1 },
  KeyA: { dx: -1 },
  KeyD: { dx: 1 },
  ArrowUp: { dy: -1 },
  ArrowDown: { dy: 1 },
  ArrowLeft: { dx: -1 },
  ArrowRight: { dx: 1 },
  Digit1: { action: '1' },
  Digit2: { action: '2' },
  Digit3: { action: '3' },
};

export const PLAYER_D = 'p1'; // 与蓝图 hero.Controllable.playerId 对应
export const VIEWPORT_W = 640;
export const VIEWPORT_H = 400;
