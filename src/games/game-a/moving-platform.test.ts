import { describe, it, expect } from 'vitest';
import { World } from '@engine/core/world.js';
import type { Component } from '@engine/core/types.js';
import type { Transform } from '@engine/protocol/components.js';
import { overlapDetectCapability } from '@atom-skills/index.js';
import { accelApplyCapability, motionApplyCapability, tweenCapability } from '@skills/tier1/index.js';
import { collisionResolveCapability } from '@skills/tier2/index.js';

// 证明"数据驱动的移动平台"：一个平台实体只靠数据组件（Shape + Tween）就会动，
// 且站在它上面的玩家被碰撞解算带着一起动 —— 没有任何游戏专属系统/代码。
// 平台无 Velocity = 静态(无限质量)；Tween 改它的 Transform.y；collision-resolve 把上方玩家
// (有限质量) 推出 → 随平台升起。连续往复需要 Tween loop（见 requests REQ-004），此处验证一次性升降机制。
function build(): World {
  const w = new World();
  const caps = [overlapDetectCapability, accelApplyCapability, motionApplyCapability, collisionResolveCapability, tweenCapability];
  for (const c of caps) for (const s of c.systems) w.addSystem(s);

  // 升降平台（纯数据：Shape + Tween，无 Velocity → 静态支撑）。y 从 300 升到 200。
  w.createEntity('lift');
  w.addComponent('lift', { type: 'Transform', x: 100, y: 300, rotation: 0, scaleX: 1, scaleY: 1 } as Transform);
  w.addComponent('lift', { type: 'Shape', kind: 'box', width: 120, height: 20 } as Component);
  w.addComponent('lift', { type: 'Tween', target: 'Transform.y', from: 300, to: 200, elapsed: 0, duration: 120, easing: 'linear', done: false } as Component);

  // 站在平台顶的玩家（动态：Velocity + 重力）。平台顶 = 300-10=290；玩家半高 15 → y=275 即贴在顶上。
  w.createEntity('p');
  w.addComponent('p', { type: 'Transform', x: 100, y: 275, rotation: 0, scaleX: 1, scaleY: 1 } as Transform);
  w.addComponent('p', { type: 'Velocity', vx: 0, vy: 0, angular: 0 } as Component);
  w.addComponent('p', { type: 'Acceleration', ax: 0, ay: 0.6 } as Component);
  w.addComponent('p', { type: 'Shape', kind: 'box', width: 30, height: 30 } as Component);
  return w;
}

describe('Game A — Tween 驱动的升降平台（数据驱动 + 载人，零游戏代码）', () => {
  it('平台升起，站在上面的玩家被带着升起', () => {
    const w = build();
    const y0 = w.getComponent<Transform>('p', 'Transform')!.y; // ~275
    for (let i = 0; i < 120; i++) w.tick();
    const liftY = w.getComponent<Transform>('lift', 'Transform')!.y;
    const pY = w.getComponent<Transform>('p', 'Transform')!.y;
    expect(liftY).toBeCloseTo(200, 0); // 平台升到顶
    expect(pY).toBeLessThan(y0 - 50); // 玩家被带着升起一大段（y 变小）
    expect(Math.abs(pY - 175)).toBeLessThan(10); // 仍贴在平台顶（顶 190 - 半高 15 = 175）
  });
});
