// Game Z 盒庭蓝图：纯数据（Transform3D + Mesh3D 体块 + 一个 Camera3D 单例），零专属 system。
// 验证「蓝图装进真 ECS → 收集成 renderable」的逻辑面；WebGL 看相由 ThreeRenderer 在浏览器做。
import { describe, it, expect } from 'vitest';
import { Engine } from '../../runtime/engine.js';
import { dioramaBlueprint } from './diorama.js';
import { collectRenderables } from '@renderer/renderable.js';
import { getCamera3D } from '@engine/protocol/camera-view.js';
import type { Transform3D, Mesh3D } from '@engine/protocol/components.js';

describe('Game Z · 3D 盒庭蓝图（纯数据 · 零专属 system）', () => {
  it('蓝图零 capability（静态盒庭·无 sim 系统）', () => {
    expect(dioramaBlueprint().capabilities).toEqual([]);
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

  it('collectRenderables 收齐盒庭体块（≥10 个带 transform3d+mesh3d；相机不作体块）', () => {
    const e = new Engine();
    e.load(dioramaBlueprint());
    const rs = collectRenderables(e.world);
    const blocks = rs.filter((r) => r.transform3d && r.mesh3d);
    expect(blocks.length).toBeGreaterThanOrEqual(10);
    expect(rs.find((r) => r.entityId === 'cam')).toBeUndefined(); // 相机无 Mesh3D/Transform → 不渲染为体块
  });
});
