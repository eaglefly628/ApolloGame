// 3D 能力展台蓝图：纯数据加载 + tick 不抛；nav 蓝图真能寻路（追兵被 pathfind 写出位移）；粒子真生成。
import { describe, it, expect } from 'vitest';
import { Engine } from '../../runtime/engine.js';
import { light3dBlueprint, post3dBlueprint, nav3dBlueprint, collide3dBlueprint, particle3dBlueprint } from './three3d.js';

function run(bp: ReturnType<typeof light3dBlueprint>, ticks: number): Engine {
  const e = new Engine();
  e.load(bp);
  for (let i = 0; i < ticks; i++) e.world.tick();
  return e;
}

describe('Game I · 3D 能力展台蓝图', () => {
  it('五个蓝图都纯数据加载 + 长跑 tick 不抛错', () => {
    for (const bp of [light3dBlueprint, post3dBlueprint, nav3dBlueprint, collide3dBlueprint, particle3dBlueprint]) {
      expect(() => run(bp(), 120)).not.toThrow();
    }
  });

  it('光照/景深场景含 Camera3D + Light3D + Sky3D（渲染器自动读）', () => {
    const e = new Engine(); e.load(light3dBlueprint());
    expect(e.world.query('Camera3D').length).toBe(1);
    expect(e.world.query('Light3D').length).toBe(2); // 主光 + 环境
    expect(e.world.query('Sky3D').length).toBe(1);
    const p = new Engine(); p.load(post3dBlueprint());
    expect(p.world.query('Post3D').length).toBe(1);
  });

  it('3D 寻路：追兵被 pathfind 写出位移（绕障逼近移动目标）', () => {
    const e = new Engine(); e.load(nav3dBlueprint());
    const id = 'seeker-1';
    const before = e.world.getComponent(id, 'Transform') as unknown as { x: number; y: number };
    const bx = before.x, by = before.y;
    for (let i = 0; i < 80; i++) e.world.tick();
    const after = e.world.getComponent(id, 'Transform') as unknown as { x: number; y: number };
    const moved = Math.hypot(after.x - bx, after.y - by);
    expect(moved).toBeGreaterThan(2); // 真沿 NavGraph 走动了
  });

  it('3D 粒子：引爆后实体数增长（caster→Mesh3D 火花）且寿命有界', () => {
    const e = new Engine(); e.load(particle3dBlueprint());
    const n0 = e.world.query('Mesh3D').length;
    for (let i = 0; i < 60; i++) e.world.tick();
    const n1 = e.world.query('Mesh3D').length;
    expect(n1).toBeGreaterThan(n0); // 火花生出来
    for (let i = 0; i < 200; i++) e.world.tick();
    const n2 = e.world.query('Mesh3D').length;
    expect(n2).toBeLessThan(n1 + 40); // 到期自毁·总量有界
  });
});
