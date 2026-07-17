import { describe, it, expect } from 'vitest';
import { Engine } from '../../runtime/engine.js';
import { build3DTableBlueprint, seatWorldPos } from './build3d.js';
import { Chip3D } from './chip3d.js';
import type { RigidBody3D, Mesh3D } from '@engine/protocol/components.js';

function freshEngine(): Engine {
  const e = new Engine();
  e.load(build3DTableBlueprint()); // 静态场景无 RigidBody3D
  return e;
}
// 只数筹码物理体（c-chip- 前缀）·排除桌面静态碰撞体。
const rigidBodies = (e: Engine): string[] => [...e.world.queryEntities('RigidBody3D')].filter((id) => id.startsWith('c-chip-'));

describe('game-c chip3d — 3D 物理筹码抛掷（render-only·throw3d 同款）', () => {
  it('抛注 → 生成筹码 RigidBody3D(cylinder) 实体（带初速/翻滚）', () => {
    const e = freshEngine();
    expect(rigidBodies(e)).toHaveLength(0); // 抛掷前无筹码物理体
    const chip = new Chip3D(e, 1);
    chip.throwBet(0, 3);
    const bodies = rigidBodies(e);
    expect(bodies).toHaveLength(3);
    const rb = e.world.getComponent<RigidBody3D>(bodies[0], 'RigidBody3D')!;
    expect(rb.shape).toBe('cylinder');
    expect(rb.mass).toBe(1);
    // 有初速（抛掷）+ 角速度（翻滚）
    expect(Math.abs(rb.vx ?? 0) + Math.abs(rb.vy ?? 0) + Math.abs(rb.vz ?? 0)).toBeGreaterThan(0);
    expect(Math.abs(rb.avx ?? 0) + Math.abs(rb.avy ?? 0) + Math.abs(rb.avz ?? 0)).toBeGreaterThan(0);
    const mesh = e.world.getComponent<Mesh3D>(bodies[0], 'Mesh3D')!;
    expect(mesh.shape).toBe('cylinder');
  });

  it('筹码从座位前方起、初速朝底池（+z 座位 vz 应朝 -z 底池）', () => {
    const e = freshEngine();
    const chip = new Chip3D(e, 5);
    chip.throwBet(0, 1); // 主角座位 +z（南）
    const id = rigidBodies(e)[0];
    const rb = e.world.getComponent<RigidBody3D>(id, 'RigidBody3D')!;
    expect(rb.vz).toBeLessThan(0); // 底池在 -z → 朝 -z 抛
    expect(seatWorldPos(0).z).toBeGreaterThan(0); // 座位在 +z
  });

  it('每 50 一枚映射上限 6 枚/次', () => {
    const e = freshEngine();
    const chip = new Chip3D(e, 1);
    chip.throwBet(2, 20); // 请求 20 枚 → 上限 6
    expect(rigidBodies(e)).toHaveLength(6);
  });

  it('clear 清场（收池/新一手·移除所有物理筹码）', () => {
    const e = freshEngine();
    const chip = new Chip3D(e, 1);
    chip.throwBet(0, 4);
    chip.throwBet(3, 2);
    expect(rigidBodies(e)).toHaveLength(6);
    chip.clear();
    expect(rigidBodies(e)).toHaveLength(0);
  });

  it('确定性：同 seed 同抛掷参数（可测·表现层种子 PRNG）', () => {
    const shoot = (): number[] => {
      const e = freshEngine(); const c = new Chip3D(e, 42); c.throwBet(1, 2);
      return rigidBodies(e).map((id) => e.world.getComponent<RigidBody3D>(id, 'RigidBody3D')!.vx ?? 0);
    };
    expect(shoot()).toEqual(shoot());
  });
});
