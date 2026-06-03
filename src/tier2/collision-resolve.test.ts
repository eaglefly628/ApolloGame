import { describe, it, expect } from 'vitest';
import { World } from '@engine/core/world.js';
import { SystemPhase } from '@engine/core/types.js';
import type { Transform, Velocity, Shape, Acceleration, Overlap } from '@engine/protocol/components.js';
import { collisionResolveCapability } from './collision-resolve.js';
import { overlapDetectCapability } from '@atom-skills/index.js';
import { accelApplyCapability, motionApplyCapability } from '../tier1/index.js';

describe('T2 collision-resolve — capability metadata（契约钉死）', () => {
  it('id / version / 跑在 Resolve 阶段', () => {
    expect(collisionResolveCapability.id).toBe('t2-collision-resolve');
    expect(collisionResolveCapability.version).toBe('1.0.0');
    expect(collisionResolveCapability.systems[0].phase).toBe(SystemPhase.Resolve);
  });

  it('读 Overlap+Transform+Velocity+Grounded，写 Transform+Velocity，不 consume/provide', () => {
    expect(collisionResolveCapability.components.provides).toEqual({});
    // Grounded 为本次修复新增的读（动态-动态时把 Grounded 一方当静态支撑，防叠放挤穿地面）。
    expect(collisionResolveCapability.components.reads).toEqual(['Overlap', 'Transform', 'Velocity', 'Grounded']);
    expect(collisionResolveCapability.components.writes).toEqual(['Transform', 'Velocity']);
    expect(collisionResolveCapability.components.consumes).toEqual([]);
  });
});

describe('T2 collision-resolve — behavior（手工构造 Overlap）', () => {
  it('动态体推出静态体，并清零朝法线的侵入速度', () => {
    const w = new World();
    for (const s of collisionResolveCapability.systems) w.addSystem(s);

    // dyn 有 Velocity（动态），wall 无 Velocity（静态）。
    w.createEntity('dyn');
    const dt: Transform = { type: 'Transform', x: 100, y: 195, rotation: 0, scaleX: 1, scaleY: 1 };
    const dv: Velocity = { type: 'Velocity', vx: 0, vy: 8, angular: 0 }; // 正在朝下侵入
    w.addComponent('dyn', dt);
    w.addComponent('dyn', dv);
    w.createEntity('wall');
    const wt: Transform = { type: 'Transform', x: 100, y: 200, rotation: 0, scaleX: 1, scaleY: 1 };
    w.addComponent('wall', wt);

    // 手工挂一个 Overlap：法线 dyn→wall 为 +y，穿透 5。
    w.createEntity('overlap:dyn:wall');
    const o: Overlap = { type: 'Overlap', entityA: 'dyn', entityB: 'wall', normalX: 0, normalY: 1, depth: 5 };
    w.addComponent('overlap:dyn:wall', o);

    w.tick();

    expect(w.getComponent<Transform>('dyn', 'Transform')!.y).toBe(190); // 195 - 5，被推出
    expect(w.getComponent<Velocity>('dyn', 'Velocity')!.vy).toBe(0); // 朝下侵入速度清零
    expect(w.getComponent<Transform>('wall', 'Transform')!.y).toBe(200); // 静态体不动
  });
});

describe('T2 涌现：accel ⊕ motion ⊕ overlap-detect ⊕ collision-resolve = 落在地面上', () => {
  it('重力下落的方块被静态地面接住，停在地面之上（phase 让管线不成环）', () => {
    const w = new World();
    // 乱序注册四个独立原子，靠 phase + 组件拓扑自动定序。
    for (const s of collisionResolveCapability.systems) w.addSystem(s);
    for (const s of overlapDetectCapability.systems) w.addSystem(s);
    for (const s of motionApplyCapability.systems) w.addSystem(s);
    for (const s of accelApplyCapability.systems) w.addSystem(s);

    // 顺序：accel → motion → overlap-detect（皆 Update）→ collision-resolve（Resolve，最后）
    const order = w.getSortedSystems().map((s) => s.id);
    expect(order.indexOf('overlap-detect')).toBeLessThan(order.indexOf('collision-resolve'));
    expect(order[order.length - 1]).toBe('collision-resolve');

    // 玩家：动态方块 20×20，从 y=150 下落；重力 ay=2。
    w.createEntity('player');
    const pt: Transform = { type: 'Transform', x: 100, y: 150, rotation: 0, scaleX: 1, scaleY: 1 };
    const pv: Velocity = { type: 'Velocity', vx: 0, vy: 0, angular: 0 };
    const pa: Acceleration = { type: 'Acceleration', ax: 0, ay: 2 };
    const ps: Shape = { type: 'Shape', kind: 'box', width: 20, height: 20 };
    w.addComponent('player', pt);
    w.addComponent('player', pv);
    w.addComponent('player', pa);
    w.addComponent('player', ps);

    // 地面：静态方块 200×20，中心 y=200（顶边 y=190）。无 Velocity → 静态。
    w.createEntity('ground');
    const gt: Transform = { type: 'Transform', x: 100, y: 200, rotation: 0, scaleX: 1, scaleY: 1 };
    const gs: Shape = { type: 'Shape', kind: 'box', width: 200, height: 20 };
    w.addComponent('ground', gt);
    w.addComponent('ground', gs);

    for (let i = 0; i < 20; i++) w.tick();

    const py = w.getComponent<Transform>('player', 'Transform')!.y;
    const pvy = w.getComponent<Velocity>('player', 'Velocity')!.vy;
    // 静止在地面上：玩家半高 10 + 地面顶边 190 → 中心 y=180。
    expect(py).toBe(180);
    expect(pvy).toBe(0);
    // 没穿透地面（y 没掉到地面中心以下）。
    expect(py).toBeLessThan(200);
    // 地面静止未动。
    expect(w.getComponent<Transform>('ground', 'Transform')!.y).toBe(200);
  });
});
