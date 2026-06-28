// 盒庭 3D 渲染线 v0（Transform3D 真三维位姿 + Camera3D 轨道相机 + render-only 红线）。
// WebGL 渲染由 ThreeRenderer 在浏览器做；此处验证纯函数几何 + 收集 + 「不进 hash」的确定性边界（node 可测）。
import { describe, it, expect } from 'vitest';
import { World } from '@engine/core/world.js';
import { collectRenderables } from './renderable.js';
import {
  transform3dPose, groundPose, orbitCamera, poseBounds3D, bounds3DCenter, bounds3DExtent, fitDistance3D, mesh3dBatchKey, mesh3dDepth,
  clampPitch, orthoFrustum, type Pose3D,
} from './three-projection.js';
import { hashPoses, camSig, postSig } from './three/stats.js';
import { getCamera3D, getSky3D, getLights3D, getPost3D } from '@engine/protocol/camera-view.js';
import { hashSnapshot } from '@net/index.js';
import type { Transform3D, Camera3D, Sky3D, Mesh3D, Model3D, Light3D, Post3D } from '@engine/protocol/components.js';

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
  it('groundPose：2D Transform → 地面（x→X、2D y→Z、Y=物高/2 坐地、rotation→绕 Y）', () => {
    const p = groundPose({ x: 12, y: -8, rotation: 0.3, scaleX: 1, scaleY: 1 }, 6);
    expect(p.x).toBe(12);
    expect(p.z).toBe(-8);   // 2D y → 地面 Z（景深）
    expect(p.y).toBe(3);    // 物高 6 / 2 → 下沿坐地（地面 y=0）
    expect(p.ry).toBeCloseTo(-0.3); // 2D 朝向 → 绕 Y
  });
  it('mesh3dBatchKey：同款盒同签名（可合一批）、尺寸/色/形不同则分批', () => {
    const box = (w: number, h: number, d: number, front: number, edge: number) =>
      ({ shape: 'box' as const, width: w, height: h, depth: d, frontTint: front, backTint: front, edgeTint: edge });
    // game-z 金阶梯两级：同尺寸同色 → 同签名 → 合一批（1 draw call）。
    expect(mesh3dBatchKey(box(10, 3, 10, 0xffb300, 0xffd54f)))
      .toBe(mesh3dBatchKey(box(10, 3, 10, 0xffb300, 0xffd54f)));
    // 尺寸不同 → 分批。
    expect(mesh3dBatchKey(box(10, 3, 10, 0xffb300, 0xffd54f)))
      .not.toBe(mesh3dBatchKey(box(6, 6, 6, 0xffb300, 0xffd54f)));
    // 颜色不同 → 分批（色烤进 vertexColors·不同色=不同几何）。
    expect(mesh3dBatchKey(box(10, 3, 10, 0xffb300, 0xffd54f)))
      .not.toBe(mesh3dBatchKey(box(10, 3, 10, 0xff0000, 0xffd54f)));
    // 形不同（box vs plane）→ 分批。
    expect(mesh3dBatchKey({ shape: 'plane', width: 10, height: 3, frontTint: 0xffb300 }))
      .not.toBe(mesh3dBatchKey(box(10, 3, 10, 0xffb300, 0xffd54f)));
    // depth 缺省=按短边推导：显式给推导值 与 不给 应同签名（同几何）。
    expect(mesh3dBatchKey({ shape: 'box', width: 10, height: 3, frontTint: 1 }))
      .toBe(mesh3dBatchKey({ shape: 'box', width: 10, height: 3, depth: mesh3dDepth('box', 10, 3), frontTint: 1 }));
  });
  it('W1-C 脏标：位姿/相机/后处理 变了签名变、不变则同（决定跳渲是否正确）', () => {
    const a: Pose3D[] = [{ x: 1, y: 2, z: 3, rotZ: 0, sx: 1, sy: 1 }];
    const b: Pose3D[] = [{ x: 1, y: 2, z: 3, rotZ: 0, sx: 1, sy: 1 }];
    const c: Pose3D[] = [{ x: 1.5, y: 2, z: 3, rotZ: 0, sx: 1, sy: 1 }];
    expect(hashPoses(a)).toBe(hashPoses(b)); // 同位姿 → 同 hash（跳渲）
    expect(hashPoses(a)).not.toBe(hashPoses(c)); // 位姿变 → hash 变（重渲）
    expect(camSig({ type: 'Camera3D', yaw: 0.5, pitch: 0.6 } as Camera3D))
      .not.toBe(camSig({ type: 'Camera3D', yaw: 0.9, pitch: 0.6 } as Camera3D)); // 相机转 → 重渲
    expect(camSig(null)).toBe('');
    expect(postSig({ type: 'Post3D', tiltShift: { focus: 0.5, intensity: 3 } } as Post3D))
      .not.toBe(postSig({ type: 'Post3D', tiltShift: { focus: 0.5, intensity: 5 } } as Post3D));
    expect(postSig(null)).toBe('');
  });
  it('REQ-3D-Camera：clampPitch 夹俯仰 + orthoFrustum 据半高/宽高比算视锥', () => {
    expect(clampPitch(0.05, 0.12, 1.45)).toBe(0.12); // 下限
    expect(clampPitch(2.0, 0.12, 1.45)).toBe(1.45); // 上限
    expect(clampPitch(0.6, 0.12, 1.45)).toBe(0.6); // 区间内不变
    expect(clampPitch(2.0)).toBe(2.0); // 无 min/max → 不夹
    const f = orthoFrustum(10, 2); // 半高 10·宽高比 2 → 半宽 20
    expect(f.top).toBe(10); expect(f.bottom).toBe(-10);
    expect(f.right).toBe(20); expect(f.left).toBe(-20);
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
  it('收进 Model3D（纯 3D 实体 + 2D Transform 实体 两条路都收 modelKey）', () => {
    const w = new World();
    // 纯 3D 实体：Transform3D + Model3D
    w.createEntity('hero3d');
    w.addComponent('hero3d', { type: 'Transform3D', x: 1, y: 0, z: 2 } as Transform3D);
    w.addComponent('hero3d', { type: 'Model3D', modelKey: 'mush-man', scale: 2, tint: 0xff0000 } as Model3D);
    // 2D Transform 实体（盒庭落地面路径）+ Model3D
    w.createEntity('hero2d');
    w.addComponent('hero2d', { type: 'Transform', x: 4, y: 6, rotation: 0, scaleX: 1, scaleY: 1 } as never);
    w.addComponent('hero2d', { type: 'Model3D', modelKey: 'toad' } as Model3D);
    const byId = Object.fromEntries(collectRenderables(w).map((r) => [r.entityId, r]));
    expect(byId['hero3d']!.model3d?.modelKey).toBe('mush-man');
    expect(byId['hero3d']!.model3d?.scale).toBe(2);
    expect(byId['hero2d']!.model3d?.modelKey).toBe('toad');
  });
});

describe('Camera3D：单例读取 + render-only 不进确定性 hash（红线）', () => {
  it('getCamera3D 取到单例', () => {
    const w = new World();
    w.createEntity('cam');
    w.addComponent('cam', { type: 'Camera3D', yaw: 0.5, pitch: 0.6 } as Camera3D);
    expect(getCamera3D(w)?.yaw).toBe(0.5);
  });
  it('getSky3D 取到天空盒单例', () => {
    const w = new World();
    w.createEntity('sky');
    w.addComponent('sky', { type: 'Sky3D', top: 0x4a90d9, bottom: 0xcfe9f7, clouds: true } as Sky3D);
    expect(getSky3D(w)?.clouds).toBe(true);
  });
  it('getLights3D 收齐所有灯（sun + ambient）；getPost3D 取后处理单例', () => {
    const w = new World();
    w.createEntity('sun'); w.addComponent('sun', { type: 'Light3D', kind: 'directional', color: 0xfff1d6, intensity: 1.6, castShadow: true } as Light3D);
    w.createEntity('fill'); w.addComponent('fill', { type: 'Light3D', kind: 'ambient', color: 0xbfd2ff, intensity: 0.4 } as Light3D);
    w.createEntity('post'); w.addComponent('post', { type: 'Post3D', tiltShift: { focus: 0.5, intensity: 3 } } as Post3D);
    const lights = getLights3D(w);
    expect(lights.length).toBe(2);
    expect(lights.map(([, l]) => l.kind).sort()).toEqual(['ambient', 'directional']);
    expect(getPost3D(w)?.tiltShift?.intensity).toBe(3);
  });
  it('Camera3D / Transform3D / Sky3D / Model3D / Light3D / Post3D 变化不改 world hash（排除出 lockstep）', () => {
    const mk = (yaw: number, x: number, skyTop: number, modelKey: string, lum: number): string => {
      const w = new World();
      w.createEntity('cam'); w.addComponent('cam', { type: 'Camera3D', yaw, pitch: 0 } as Camera3D);
      w.createEntity('b'); w.addComponent('b', { type: 'Transform3D', x, y: 0, z: 0 } as Transform3D);
      w.createEntity('sky'); w.addComponent('sky', { type: 'Sky3D', top: skyTop, bottom: 0 } as Sky3D);
      w.createEntity('m'); w.addComponent('m', { type: 'Model3D', modelKey, tint: skyTop } as Model3D);
      w.createEntity('sun'); w.addComponent('sun', { type: 'Light3D', kind: 'directional', color: skyTop, intensity: lum } as Light3D);
      w.createEntity('post'); w.addComponent('post', { type: 'Post3D', tiltShift: { focus: lum, intensity: lum } } as Post3D);
      return hashSnapshot(w.snapshot());
    };
    // 纯表现：相机/位姿/天空盒/模型/灯/后处理 全变了 hash 不变。
    expect(mk(0, 0, 0x111111, 'a', 1)).toBe(mk(2, 99, 0xabcdef, 'zzz', 9));
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
