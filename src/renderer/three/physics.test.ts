// 真物理刚体（cannon-es·render-only 表现·非同步）：重力下落 + 落地不穿地 + render-only 不进 hash。
import { describe, it, expect, beforeAll } from 'vitest';
import { PhysicsSystem, preloadPhysics } from './physics.js';
import { World } from '@engine/core/world.js';
import { hashSnapshot } from '@net/index.js';
import type { RigidBody3D, Transform3D, Mesh3D } from '@engine/protocol/components.js';

describe('PhysicsSystem：真物理刚体（cannon-es·render-only 表现）', () => {
  beforeAll(async () => { await preloadPhysics(); }); // cannon-es 懒加载 → 测试先预载，首帧即可步进
  it('刚体在重力下下落 → 落地停在地面之上（不穿地）+ 写四元数', () => {
    const w = new World();
    w.createEntity('d');
    w.addComponent('d', { type: 'Transform3D', x: 0, y: 20, z: 0 } as Transform3D);
    w.addComponent('d', { type: 'Mesh3D', shape: 'box', width: 4, height: 4, depth: 4, frontTint: 0xffffff } as Mesh3D);
    w.addComponent('d', { type: 'RigidBody3D', shape: 'box', mass: 1 } as RigidBody3D);
    const phys = new PhysicsSystem();
    const t = (): Transform3D => w.getComponent<Transform3D>('d', 'Transform3D')!;
    const y0 = t().y;
    for (let i = 1; i <= 10; i++) phys.sync(w, i * 16.7);
    expect(t().y).toBeLessThan(y0); // 下落了
    for (let i = 11; i <= 240; i++) phys.sync(w, i * 16.7);
    expect(t().y).toBeGreaterThan(1.0); // 盒半高 2·没穿地
    expect(t().y).toBeLessThan(3.5); // 停在地面附近
    expect(t().quat).toBeTruthy(); // 写了四元数
    phys.dispose();
  });

  it('无刚体时 sync 返回 0（不建物理世界）；有则返回刚体数', () => {
    const w = new World();
    const phys = new PhysicsSystem();
    expect(phys.sync(w, 16)).toBe(0);
    w.createEntity('d');
    w.addComponent('d', { type: 'Transform3D', x: 0, y: 10, z: 0 } as Transform3D);
    w.addComponent('d', { type: 'RigidBody3D', shape: 'box', mass: 1 } as RigidBody3D);
    expect(phys.sync(w, 32)).toBe(1);
    phys.dispose();
  });

  it('RigidBody3D + Transform3D（含 quat）是 render-only（不进 hash）', () => {
    const w = new World();
    w.createEntity('d');
    const h0 = hashSnapshot(w.snapshot());
    w.addComponent('d', { type: 'RigidBody3D', shape: 'box', mass: 1, avx: 5 } as RigidBody3D);
    expect(hashSnapshot(w.snapshot())).toBe(h0); // RigidBody3D 不进 hash
    w.addComponent('d', { type: 'Transform3D', x: 0, y: 5, z: 0, quat: [0, 0, 0, 1] } as Transform3D);
    expect(hashSnapshot(w.snapshot())).toBe(h0); // Transform3D 整体 render-only
  });
});
