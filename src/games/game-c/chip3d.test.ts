import { describe, it, expect } from 'vitest';
import { Engine } from '../../runtime/engine.js';
import { build3DTableBlueprint, seatWorldPos, seatStackPos, FELT_RX, FELT_RZ } from './build3d.js';
import { Chip3D } from './chip3d.js';
import type { RigidBody3D, Mesh3D } from '@engine/protocol/components.js';

function freshEngine(): Engine {
  const e = new Engine();
  e.load(build3DTableBlueprint());
  return e;
}
const thrown = (e: Engine): string[] => [...e.world.queryEntities('RigidBody3D')].filter((id) => id.startsWith('c-chip-'));
const stacks = (e: Engine): string[] => [...e.world.queryEntities('Mesh3D')].filter((id) => id.startsWith('c-stk-'));
const seatStack = (e: Engine, seat: number): string[] => [...e.world.queryEntities('Mesh3D')].filter((id) => id.startsWith(`c-stk-${seat}-`));

describe('game-c chip3d — 3D 物理筹码抛掷 + 主角堆（render-only·owner 2026-07-18）', () => {
  it('抛注 → 生成筹码 RigidBody3D(cylinder)（随机初速 + 只绕竖轴平旋·不翻转防立边）', () => {
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
    // bug 修复（owner 2026-07-23「筹码有时立在桌面上」根因=三轴翻滚落地停圆柱侧面）：只保留 avy 竖轴平旋、
    //   avx/avz 恒 0 → 筹码平飞平落不翻转、不再立边。此不变量钉死防回归。
    expect(rb.avx ?? 0).toBe(0);
    expect(rb.avz ?? 0).toBe(0);
    expect(Math.abs(rb.avy ?? 0)).toBeGreaterThan(0); // 仍有平旋（飞碟式·活泼）
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

  it('clear 清抛出筹码（新一手）·座位堆不动', () => {
    const e = freshEngine();
    const chip = new Chip3D(e, 1);
    chip.throwBet(0, 4);
    chip.setStack(0, 1000);
    const stackN = stacks(e).length;
    expect(stackN).toBeGreaterThan(0);
    chip.clear();
    expect(thrown(e)).toHaveLength(0);
    expect(stacks(e)).toHaveLength(stackN); // 座位堆保留
  });

  it('座位筹码堆越赢越高（栈越大摞越高·封顶·输光无堆）', () => {
    const e = freshEngine();
    const chip = new Chip3D(e, 1);
    chip.setStack(0, 200);
    const low = seatStack(e, 0).length;
    chip.setStack(0, 1800);
    const high = seatStack(e, 0).length;
    expect(high).toBeGreaterThan(low); // 更多筹码 = 更高堆
    chip.setStack(0, 999999);
    expect(seatStack(e, 0).length).toBeLessThanOrEqual(22); // 封顶防穿天
    chip.setStack(0, 0);
    expect(seatStack(e, 0)).toHaveLength(0); // 输光=无堆
  });

  it('座位堆=静态无物理（无 RigidBody3D·抛入筹码撞不翻·owner「不要被别人撞翻」）', () => {
    const e = freshEngine();
    new Chip3D(e, 1).setStack(0, 1500);
    const stk = seatStack(e, 0);
    expect(stk.length).toBeGreaterThan(0);
    for (const id of stk) {
      expect(e.world.getComponent(id, 'RigidBody3D')).toBeUndefined(); // 纯渲染网格·cannon-es 不建体
      expect(e.world.getComponent(id, 'Mesh3D')).toBeDefined();
    }
    // 堆贴边（f=0.85·按当前 felt 半径归一·随呢面尺寸变仍恒 0.85）：主角堆(座0)比座位环(0.9)略内·但比旧 0.8 更靠外桌缘
    expect(Math.hypot(seatStackPos(0).x / FELT_RX, seatStackPos(0).z / FELT_RZ)).toBeGreaterThan(0.8);
  });

  it('六席各有独立筹码堆（各在自己桌缘·id 命名空间隔离·owner 2026-07-18）', () => {
    const e = freshEngine();
    const chip = new Chip3D(e, 1);
    for (let s = 0; s < 6; s++) chip.setStack(s, 1000);
    for (let s = 0; s < 6; s++) expect(seatStack(e, s).length).toBeGreaterThan(0); // 每席都有堆
    expect(stacks(e).length).toBe(seatStack(e, 0).length * 6); // 六席不串号（命名空间隔离）
    // 各堆锚点=各自 seatStackPos·分处不同桌缘（x 各异=各靠自己边·非挤一处）
    const xs = new Set([0, 1, 2, 3, 4, 5].map((s) => Math.round(seatStackPos(s).x * 100)));
    expect(xs.size).toBeGreaterThan(4);
    // 主角堆(座0)比旧锚点(z≈1.52)更靠自己南桌边(z 更大)
    expect(seatStackPos(0).z).toBeGreaterThan(1.52);
  });

  it('确定性：同 seed 同抛序列 → 同筹码数（render-only 专属种子）', () => {
    const a = freshEngine(), b = freshEngine();
    new Chip3D(a, 42).throwBet(1, 3);
    new Chip3D(b, 42).throwBet(1, 3);
    expect(thrown(a).length).toBe(thrown(b).length);
  });
});
