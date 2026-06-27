// 盒庭 3D 渲染线 v0（Transform3D 真三维位姿 + Camera3D 轨道相机 + render-only 红线）。
// WebGL 渲染由 ThreeRenderer 在浏览器做；此处验证纯函数几何 + 收集 + 「不进 hash」的确定性边界（node 可测）。
import { describe, it, expect } from 'vitest';
import { World } from '@engine/core/world.js';
import { collectRenderables } from './renderable.js';
import {
  transform3dPose, orbitCamera, poseBounds3D, bounds3DCenter, bounds3DExtent, fitDistance3D, type Pose3D,
} from './three-projection.js';
import { getCamera3D } from '@engine/protocol/camera-view.js';
import { hashSnapshot } from '@net/index.js';
import type { Transform3D, Camera3D, Mesh3D } from '@engine/protocol/components.js';

describe('Transform3D / Camera3D 纯函数（盒庭位姿 + 轨道相机）', () => {
  it('transform3dPose：等比 scale 落三轴、rot 缺省 0', () => {
    expect(transform3dPose({ type: 'Transform3D', x: 1, y: 2, z: 3, scale: 2 }))
      .toMatchObject({ x: 1, y: 2, z: 3, sx: 2, sy: 2, sz: 2, rx: 0, ry: 0, rotZ: 0 });
  });
  it('orbitCamera：yaw 绕 Y、pitch 抬高相机', () => {
    const c = { x: 0, y: 0, z: 0 };
    const front = orbitCamera(c, 10, 0, 0);            // yaw0 pitch0 → +Z
    expect(front.z).toBeCloseTo(10); expect(front.x).toBeCloseTo(0); expect(front.y).toBeCloseTo(0);
    const up = orbitCamera(c, 10, 0, Math.PI / 2);     // pitch 90° → 正上方
    expect(up.y).toBeCloseTo(10); expect(up.z).toBeCloseTo(0);
    const side = orbitCamera(c, 10, Math.PI / 2, 0);   // yaw 90° → +X
    expect(side.x).toBeCloseTo(10); expect(side.z).toBeCloseTo(0);
  });
  it('poseBounds3D + center + extent + fitDistance', () => {
    const poses: Pose3D[] = [
      { x: -5, y: 0, z: -5, rotZ: 0, sx: 1, sy: 1 },
      { x: 5, y: 4, z: 5, rotZ: 0, sx: 1, sy: 1 },
    ];
    const b = poseBounds3D(poses, 0);
    expect(bounds3DCenter(b)).toMatchObject({ x: 0, y: 2, z: 0 });
    expect(bounds3DExtent(b)).toBe(5); // 最大边 10(x/z) 的一半
    expect(fitDistance3D(5, 38)).toBeGreaterThan(5);
  });
});

describe('collectRenderables：纯 3D 实体（Transform3D·无 2D Transform）也收', () => {
  it('收进带 transform3d + mesh3d 的 renderable（x,y 退化作 2D 后端位）', () => {
    const w = new World();
    w.createEntity('box');
    w.addComponent('box', { type: 'Transform3D', x: 3, y: 5, z: 7 } as Transform3D);
    w.addComponent('box', { type: 'Mesh3D', shape: 'box', width: 4, height: 4, depth: 4, frontTint: 0xffffff } as Mesh3D);
    const rs = collectRenderables(w);
    expect(rs).toHaveLength(1);
    expect(rs[0]!.transform3d?.y).toBe(5);
    expect(rs[0]!.x).toBe(3);
    expect(rs[0]!.mesh3d?.shape).toBe('box');
  });
});

describe('Camera3D：单例读取 + render-only 不进确定性 hash（红线）', () => {
  it('getCamera3D 取到单例', () => {
    const w = new World();
    w.createEntity('cam');
    w.addComponent('cam', { type: 'Camera3D', yaw: 0.5, pitch: 0.6 } as Camera3D);
    expect(getCamera3D(w)?.yaw).toBe(0.5);
  });
  it('Camera3D / Transform3D 变化不改 world hash（排除出 lockstep）', () => {
    const mk = (yaw: number, x: number): string => {
      const w = new World();
      w.createEntity('cam'); w.addComponent('cam', { type: 'Camera3D', yaw, pitch: 0 } as Camera3D);
      w.createEntity('b'); w.addComponent('b', { type: 'Transform3D', x, y: 0, z: 0 } as Transform3D);
      return hashSnapshot(w.snapshot());
    };
    expect(mk(0, 0)).toBe(mk(2, 99)); // 纯表现：角度/位姿变了 hash 不变
  });
  it('对照：2D Transform 进 hash（确认排除是针对性的、非恒等）', () => {
    const mk = (tx: number): string => {
      const w = new World();
      w.createEntity('b'); w.addComponent('b', { type: 'Transform', x: tx, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } as never);
      return hashSnapshot(w.snapshot());
    };
    expect(mk(0)).not.toBe(mk(5));
  });
});
