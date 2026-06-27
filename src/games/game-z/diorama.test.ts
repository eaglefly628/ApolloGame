// Game Z 盒庭蓝图：纯数据（Transform3D + Mesh3D 体块 + 一个 Camera3D 单例），零专属 system。
// 验证「蓝图装进真 ECS → 收集成 renderable」的逻辑面；WebGL 看相由 ThreeRenderer 在浏览器做。
import { describe, it, expect } from 'vitest';
import { Engine } from '../../runtime/engine.js';
import { dioramaBlueprint } from './diorama.js';
import { collectRenderables } from '@renderer/renderable.js';
import { getCamera3D, getSky3D } from '@engine/protocol/camera-view.js';
import type { Transform, Transform3D, Velocity, Mesh3D } from '@engine/protocol/components.js';

describe('Game Z · 3D 盒庭蓝图（纯数据 · 仅现成 motion-apply 能力）', () => {
  it('只用现成 motion-apply 能力（无专属 system）', () => {
    const caps = dioramaBlueprint().capabilities;
    expect(caps.length).toBe(1);
    expect(caps[0]!.describe.name).toBe('motion-apply');
  });

  it('每个物件 = Transform3D + Mesh3D（盒庭体块即数据）', () => {
    const e = new Engine();
    e.load(dioramaBlueprint());
    const t3 = e.world.getComponent<Transform3D>('ground', 'Transform3D')!;
    const m = e.world.getComponent<Mesh3D>('ground', 'Mesh3D')!;
    expect(m.shape).toBe('box');
    expect(typeof t3.y).toBe('number');
  });

  it('一个 Camera3D 单例 → 盒庭模式（轨道相机·俯角）', () => {
    const e = new Engine();
    e.load(dioramaBlueprint());
    const cam = getCamera3D(e.world);
    expect(cam).not.toBeNull();
    expect(cam!.pitch).toBeGreaterThan(0);
    expect(cam!.distance).toBeGreaterThan(0);
  });

  it('collectRenderables 收齐盒庭体块（≥10 个带 transform3d+mesh3d；相机/天空盒不作体块）', () => {
    const e = new Engine();
    e.load(dioramaBlueprint());
    const rs = collectRenderables(e.world);
    const blocks = rs.filter((r) => r.transform3d && r.mesh3d);
    expect(blocks.length).toBeGreaterThanOrEqual(10);
    expect(rs.find((r) => r.entityId === 'cam')).toBeUndefined(); // 相机无 Mesh3D/Transform → 不渲染为体块
    expect(rs.find((r) => r.entityId === 'sky')).toBeUndefined(); // 天空盒同理
  });

  it('天空盒 Sky3D 在场（带云）', () => {
    const e = new Engine();
    e.load(dioramaBlueprint());
    expect(getSky3D(e.world)?.clouds).toBe(true);
  });

  it('可控角色 hero：2D Transform + Velocity + Mesh3D（无 transform3d·盒庭模式落地面）', () => {
    const e = new Engine();
    e.load(dioramaBlueprint());
    const rs = collectRenderables(e.world);
    const hero = rs.find((r) => r.entityId === 'hero')!;
    expect(hero.mesh3d?.shape).toBe('box');
    expect(hero.transform3d).toBeUndefined(); // 走 2D Transform → groundPose 落地面
  });

  it('角色按 Velocity 走动（motion-apply 驱动·纯数据 sim）', () => {
    const e = new Engine();
    e.load(dioramaBlueprint());
    const v = e.world.getComponent<Velocity>('hero', 'Velocity')!;
    v.vx = 0.5; v.vy = 0.5; // 模拟键盘设速
    const x0 = e.world.getComponent<Transform>('hero', 'Transform')!.x;
    for (let i = 0; i < 10; i++) e.world.tick();
    expect(e.world.getComponent<Transform>('hero', 'Transform')!.x).toBeGreaterThan(x0);
  });
});
