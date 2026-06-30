// 3D 能力展台蓝图：纯数据加载 + tick 不抛；nav 蓝图真能寻路（追兵被 pathfind 写出位移）；粒子真生成。
import { describe, it, expect } from 'vitest';
import { Engine } from '../../runtime/engine.js';
import { light3dBlueprint, post3dBlueprint, nav3dBlueprint, collide3dBlueprint, particle3dBlueprint, text3dBlueprint, ao3dBlueprint, vfx3dBlueprint, material3dBlueprint, fog3dBlueprint, pointlight3dBlueprint, surface3dBlueprint } from './three3d.js';

function run(bp: ReturnType<typeof light3dBlueprint>, ticks: number): Engine {
  const e = new Engine();
  e.load(bp);
  for (let i = 0; i < ticks; i++) e.world.tick();
  return e;
}

describe('Game I · 3D 能力展台蓝图', () => {
  it('十二个蓝图都纯数据加载 + 长跑 tick 不抛错', () => {
    for (const bp of [light3dBlueprint, post3dBlueprint, nav3dBlueprint, collide3dBlueprint, particle3dBlueprint, text3dBlueprint, ao3dBlueprint, vfx3dBlueprint, material3dBlueprint, fog3dBlueprint, pointlight3dBlueprint, surface3dBlueprint]) {
      expect(() => run(bp(), 120)).not.toThrow();
    }
  });

  it('IBL 已开（材质场景 Sky3D.env>0）+ 表面细节含 surface', () => {
    const m = new Engine(); m.load(material3dBlueprint());
    const sky = m.world.getComponent('sky', 'Sky3D') as unknown as { env?: number };
    expect(sky.env).toBeGreaterThan(0);
    const s = new Engine(); s.load(surface3dBlueprint());
    const mat = s.world.getComponent('s-bumps', 'Material3D') as unknown as { surface?: unknown };
    expect(mat.surface).toBeTruthy();
  });

  it('点光源/聚光灯蓝图含 2 盏动态局部光（point + spot·预算内）', () => {
    const e = new Engine(); e.load(pointlight3dBlueprint());
    const locals = e.world.query('Light3D')
      .map(([id]) => e.world.getComponent(id, 'Light3D') as unknown as { kind: string })
      .filter((l) => l.kind === 'point' || l.kind === 'spot');
    expect(locals.length).toBe(2);
  });

  it('PBR 材质 / 距离雾组件在蓝图里', () => {
    const m = new Engine(); m.load(material3dBlueprint());
    expect(m.world.query('Material3D').length).toBe(7); // 7 个预设
    const f = new Engine(); f.load(fog3dBlueprint());
    expect(f.world.query('Fog3D').length).toBe(1);
  });

  it('新特性组件齐：WorldUI3D（头顶文字）/ Post3D.ao / Vfx3D 都在蓝图里', () => {
    const t = new Engine(); t.load(text3dBlueprint());
    expect(t.world.query('WorldUI3D').length).toBeGreaterThanOrEqual(4);
    const a = new Engine(); a.load(ao3dBlueprint());
    const post = a.world.getComponent('post', 'Post3D') as unknown as { ao?: unknown };
    expect(post.ao).toBeTruthy(); // AO 数据在
    const v = new Engine(); v.load(vfx3dBlueprint());
    expect(v.world.query('Vfx3D').length).toBe(3); // 三股喷泉发射器
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
