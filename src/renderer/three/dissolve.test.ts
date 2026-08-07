// 溶解消散（REQ-3D-DISSOLVE）：shader 注入 uniform + DissolveSystem 每帧驱动（显式 progress / trigger 自播）。
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { injectDissolve, dissolveSig, DissolveSystem } from './dissolve.js';
import { World } from '@engine/core/world.js';
import type { Material3D } from '@engine/protocol/components.js';

type Dis = NonNullable<Material3D['dissolve']>;
function meshWith(d: Dis): THREE.Mesh {
  const mat = new THREE.MeshStandardMaterial();
  injectDissolve(mat, d);
  return new THREE.Mesh(new THREE.SphereGeometry(1), mat);
}
const uni = (m: THREE.Mesh): { uDisProgress: { value: number }; uDisTime: { value: number } } =>
  (m.material as THREE.Material).userData['dissolveUniforms'];

describe('injectDissolve：uniform 存到 userData·onBeforeCompile 挂上', () => {
  it('初值从数据来·edgeColor 转 THREE.Color', () => {
    const m = meshWith({ progress: 0.3, edge: 0.2, edgeColor: 0xff0000, glow: 2, scale: 30 });
    const u = (m.material as THREE.Material).userData['dissolveUniforms'];
    expect(u.uDisProgress.value).toBe(0.3);
    expect(u.uDisEdge.value).toBe(0.2);
    expect(u.uDisScale.value).toBe(30);
    expect((u.uDisEdgeColor.value as THREE.Color).getHex()).toBe(0xff0000);
    expect(typeof (m.material as THREE.Material).onBeforeCompile).toBe('function');
  });
  it('progress 钳到 0..1', () => {
    expect(uni(meshWith({ progress: 1.7 })).uDisProgress.value).toBe(1);
    expect(uni(meshWith({ progress: -0.4 })).uDisProgress.value).toBe(0);
  });
});

describe('dissolveSig：pattern/shape 变 → 签名变（重建材质）', () => {
  it('pattern 与 shape 各自纳入', () => {
    expect(dissolveSig({ pattern: 'voronoi', shape: 'euclid' })).not.toBe(dissolveSig({ pattern: 'noise', shape: 'euclid' }));
    expect(dissolveSig({ shape: 'euclid' })).not.toBe(dissolveSig({ shape: 'star' }));
  });
});

describe('DissolveSystem：每帧驱动 progress/time uniform', () => {
  function scene(d: Dis): { w: World; sys: DissolveSystem; meshes: Map<string, THREE.Mesh>; m: THREE.Mesh } {
    const w = new World();
    w.createEntity('o');
    w.addComponent('o', { type: 'Material3D', preset: 'steel', dissolve: d } as Material3D);
    const m = meshWith(d);
    return { w, sys: new DissolveSystem(), meshes: new Map([['o', m]]), m };
  }
  it('显式 progress：uniform = progress·0<p<1 时 live>0', () => {
    const { w, sys, meshes, m } = scene({ progress: 0.5 });
    expect(sys.sync(w, meshes, 0)).toBe(1); // 半溶解 → 活跃（前沿在动）
    expect(uni(m).uDisProgress.value).toBe(0.5);
    // progress 改成 0（完好）→ 不活跃
    w.getComponent<Material3D>('o', 'Material3D')!.dissolve!.progress = 0;
    expect(sys.sync(w, meshes, 16)).toBe(0);
    expect(uni(m).uDisProgress.value).toBe(0);
  });
  it('trigger 自播：bump → 引擎从 0 演进到 1（out）·播放中 live>0·播完 progress=1', () => {
    const { w, sys, meshes, m } = scene({ trigger: 0, dur: 1 });
    sys.sync(w, meshes, 0); // 首见=基线·不自播
    expect(uni(m).uDisProgress.value).toBe(0);
    // bump trigger → 从此刻起播
    w.getComponent<Material3D>('o', 'Material3D')!.dissolve!.trigger = 1;
    sys.sync(w, meshes, 100);           // 起播基线帧
    const live = sys.sync(w, meshes, 600); // 0.5s / 1s dur → progress 0.5
    expect(uni(m).uDisProgress.value).toBeGreaterThan(0.3);
    expect(uni(m).uDisProgress.value).toBeLessThan(0.7);
    expect(live).toBe(1);               // 播放中活跃
    sys.sync(w, meshes, 1300);          // 超过 dur → 播完
    expect(uni(m).uDisProgress.value).toBe(1);
    expect(sys.sync(w, meshes, 1400)).toBe(0); // 播完静止 → 不活跃
  });
  it('direction:in → 从 1 演进到 0（重现）', () => {
    const { w, sys, meshes, m } = scene({ trigger: 0, dur: 1, direction: 'in' });
    sys.sync(w, meshes, 0);
    w.getComponent<Material3D>('o', 'Material3D')!.dissolve!.trigger = 1;
    sys.sync(w, meshes, 100);
    sys.sync(w, meshes, 600); // 0.5s → in 方向 progress = 1-0.5 = 0.5
    expect(uni(m).uDisProgress.value).toBeGreaterThan(0.3);
    sys.sync(w, meshes, 1300); // 播完 → in 终值 0（完好重现）
    expect(uni(m).uDisProgress.value).toBe(0);
  });
});
