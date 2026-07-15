// @vitest-environment happy-dom
// Diegetic3D UI 贴 3D 面（render-only）：渲 LayoutNode → 栅格（mock）→ 挂 CanvasTexture 到材质 + 生命周期 + 不进 hash。
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { DiegeticSystem } from './diegetic.js';
import { World } from '@engine/core/world.js';
import { hashSnapshot } from '@net/index.js';
import type { Diegetic3D } from '@engine/protocol/components.js';

// mock 栅格器：不真渲染·返回一个占位 canvas（避开浏览器 SVG/Image 依赖·只验数据管路）。
const mockRaster = (): Promise<CanvasImageSource> => { const c = document.createElement('canvas'); c.width = 4; c.height = 4; return Promise.resolve(c); };
const NODE = (t: string): Diegetic3D['node'] => ({ type: 'Panel', id: 'p', props: {}, children: [{ type: 'Label', id: 'l', props: { text: t } }] });

describe('DiegeticSystem（UI→贴图→材质·render-only）', () => {
  it('渲 node → 给 mesh 材质挂 CanvasTexture（map + 自发光 emissiveMap）', () => {
    const container = document.createElement('div'); document.body.appendChild(container);
    const sys = new DiegeticSystem(mockRaster);
    sys.init(container);
    const w = new World(); w.createEntity('screen');
    w.addComponent('screen', { type: 'Diegetic3D', node: NODE('HELLO'), pxWidth: 64, pxHeight: 64 } as Diegetic3D);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial());
    const meshes = new Map([['screen', mesh]]);
    const live = sys.sync(w, meshes);
    const mat = mesh.material as THREE.MeshStandardMaterial;
    expect(mat.map).toBeInstanceOf(THREE.CanvasTexture); // 贴图挂上
    expect(mat.emissiveMap).toBe(mat.map);               // 自亮（任意光照可读）
    expect(mat.emissive.getHex()).toBe(0xffffff);
    expect(live).toBeGreaterThan(0);                     // 首帧 + 栅格在途 → 持续重渲
    sys.dispose();
  });
  it('node 变 → 重挂重栅格（sig 变）；静止不重复；实体消失清理', () => {
    const container = document.createElement('div'); document.body.appendChild(container);
    const sys = new DiegeticSystem(mockRaster);
    sys.init(container);
    const w = new World(); w.createEntity('s');
    w.addComponent('s', { type: 'Diegetic3D', node: NODE('A'), pxWidth: 32, pxHeight: 32 } as Diegetic3D);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial());
    const meshes = new Map([['s', mesh]]);
    sys.sync(w, meshes);
    // 改 node → 有变化
    w.removeComponent('s', 'Diegetic3D');
    w.addComponent('s', { type: 'Diegetic3D', node: NODE('B'), pxWidth: 32, pxHeight: 32 } as Diegetic3D);
    expect(sys.sync(w, meshes)).toBeGreaterThan(0);
    // 实体消失 → 清理（材质 tex 释放·宿主移除不崩）
    w.destroyEntity('s');
    expect(sys.sync(w, meshes)).toBeGreaterThan(0); // 清理算一次变化
    sys.dispose();
  });
  it('无 doc（未 init）→ sync 返回 0（headless 安全）', () => {
    const sys = new DiegeticSystem(mockRaster);
    const w = new World(); w.createEntity('s');
    w.addComponent('s', { type: 'Diegetic3D', node: NODE('X') } as Diegetic3D);
    expect(sys.sync(w, new Map())).toBe(0);
  });
});

describe('Diegetic3D = render-only（不进 hash）', () => {
  it('加 Diegetic3D 不改变 world hash', () => {
    const w = new World(); w.createEntity('e');
    const h0 = hashSnapshot(w.snapshot());
    w.addComponent('e', { type: 'Diegetic3D', node: NODE('hud') } as Diegetic3D);
    expect(hashSnapshot(w.snapshot())).toBe(h0); // Diegetic3D 被 NON_DETERMINISTIC 排除
  });
});
