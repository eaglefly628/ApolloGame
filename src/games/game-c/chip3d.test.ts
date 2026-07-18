import { describe, it, expect } from 'vitest';
import { Engine } from '../../runtime/engine.js';
import { build3DTableBlueprint, seatWorldPos } from './build3d.js';
import { Chip3D } from './chip3d.js';
import type { RigidBody3D, Mesh3D } from '@engine/protocol/components.js';

function freshEngine(): Engine {
  const e = new Engine();
  e.load(build3DTableBlueprint());
  return e;
}
const thrown = (e: Engine): string[] => [...e.world.queryEntities('RigidBody3D')].filter((id) => id.startsWith('c-chip-'));
const heroStack = (e: Engine): string[] => [...e.world.queryEntities('Mesh3D')].filter((id) => id.startsWith('c-herostk-'));

describe('game-c chip3d — 3D 物理筹码抛掷 + 主角堆（render-only·owner 2026-07-18）', () => {
  it('抛注 → 生成筹码 RigidBody3D(cylinder)（随机初速 + 三轴翻滚）', () => {
    const e = freshEngine();
    expect(thrown(e)).toHaveLength(0);
    const chip = new Chip3D(e, 1);
    chip.throwBet(0, 3);
    const bodies = thrown(e);
    expect(bodies).toHaveLength(3);
    const rb = e.world.getComponent<RigidBody3D>(bodies[0], 'RigidBody3D')!;
    expect(rb.shape).toBe('cylinder');
    expect(rb.mass).toBe(1);
    expect(Math.abs(rb.vx ?? 0) + Math.abs(rb.vy ?? 0) + Math.abs(rb.vz ?? 0)).toBeGreaterThan(0); // 有抛速
    expect(Math.abs(rb.avx ?? 0) + Math.abs(rb.avy ?? 0) + Math.abs(rb.avz ?? 0)).toBeGreaterThan(0); // 有翻滚
    expect(e.world.getComponent<Mesh3D>(bodies[0], 'Mesh3D')!.shape).toBe('cylinder');
  });

  it('从座位前起、初速朝底池（座0 在 +z → vz 朝 -z 底池）', () => {
    const e = freshEngine();
    new Chip3D(e, 5).throwBet(0, 1);
    const rb = e.world.getComponent<RigidBody3D>(thrown(e)[0], 'RigidBody3D')!;
    expect(rb.vz).toBeLessThan(0);
    expect(seatWorldPos(0).z).toBeGreaterThan(0);
  });

  it('每 50 一枚·上限 6 枚/次', () => {
    const e = freshEngine();
    new Chip3D(e, 1).throwBet(2, 20);
    expect(thrown(e)).toHaveLength(6);
  });

  it('clear 清抛出筹码（新一手）·主角堆不动', () => {
    const e = freshEngine();
    const chip = new Chip3D(e, 1);
    chip.throwBet(0, 4);
    chip.setHeroStack(1000);
    const stackN = heroStack(e).length;
    expect(stackN).toBeGreaterThan(0);
    chip.clear();
    expect(thrown(e)).toHaveLength(0);
    expect(heroStack(e)).toHaveLength(stackN); // 主角堆保留
  });

  it('主角筹码堆越赢越高（栈越大摞越高·封顶）', () => {
    const e = freshEngine();
    const chip = new Chip3D(e, 1);
    chip.setHeroStack(200);
    const low = heroStack(e).length;
    chip.setHeroStack(1800);
    const high = heroStack(e).length;
    expect(high).toBeGreaterThan(low); // 更多筹码 = 更高堆
    chip.setHeroStack(999999);
    expect(heroStack(e).length).toBeLessThanOrEqual(22); // 封顶防穿天
    chip.setHeroStack(0);
    expect(heroStack(e)).toHaveLength(0); // 输光=无堆
  });

  it('确定性：同 seed 同抛序列 → 同筹码数（render-only 专属种子）', () => {
    const a = freshEngine(), b = freshEngine();
    new Chip3D(a, 42).throwBet(1, 3);
    new Chip3D(b, 42).throwBet(1, 3);
    expect(thrown(a).length).toBe(thrown(b).length);
  });
});
