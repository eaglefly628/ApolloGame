// Mesh3D.faceAxis（REQ-3D-CARD-FACE-AXIS）：正反分色作用面按轴重映射·两条 box 上色路径口径一致。
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { faceAxisSlots, faceAxisOrder, buildInstancedMesh3DGeometry, buildMesh3D } from './geometry.js';
import type { Mesh3D } from '@engine/protocol/components.js';

// BoxGeometry 面序 [+x,-x,+y,-y,+z,-z]（每面 4 顶点）。
describe('faceAxisSlots：正反面落在指定轴的两面（单一真相）', () => {
  it('缺省/z → +z(4)/−z(5)·edge 取其余面（零回归）', () => {
    expect(faceAxisSlots(undefined)).toEqual({ front: 4, back: 5, edge: 0 });
    expect(faceAxisSlots('z')).toEqual({ front: 4, back: 5, edge: 0 });
  });
  it('y → +y(2)/−y(3)；x → +x(0)/−x(1)·edge 必是真正的其余面', () => {
    expect(faceAxisSlots('y')).toEqual({ front: 2, back: 3, edge: 0 });
    const x = faceAxisSlots('x');
    expect([x.front, x.back]).toEqual([0, 1]);
    expect([x.front, x.back]).not.toContain(x.edge); // edge 不撞 front/back
  });
});

describe('faceAxisOrder：六面序值从 slots 派生·其余面=edge', () => {
  it('y → [e,e,front,back,e,e]；缺省 → [e,e,e,e,front,back]', () => {
    expect(faceAxisOrder('y', 'F', 'B', 'e')).toEqual(['e', 'e', 'F', 'B', 'e', 'e']);
    expect(faceAxisOrder(undefined, 'F', 'B', 'e')).toEqual(['e', 'e', 'e', 'e', 'F', 'B']);
    expect(faceAxisOrder('x', 'F', 'B', 'e')).toEqual(['F', 'B', 'e', 'e', 'e', 'e']);
  });
});

// 读某面第一个顶点的烤入色（faceTints 每面 4 顶点·face f 起于顶点 f*4）。
function faceColorHex(geo: THREE.BufferGeometry, face: number): number {
  const col = geo.getAttribute('color') as THREE.BufferAttribute;
  const vpf = col.count / 6; // 每面顶点数
  const i = Math.round(face * vpf) * 3;
  const arr = col.array as ArrayLike<number>;
  const c = new THREE.Color(arr[i], arr[i + 1], arr[i + 2]);
  return c.getHex();
}

describe('buildInstancedMesh3DGeometry：faceAxis 决定正反色落哪两面（逐面色烤入）', () => {
  const base: Mesh3D = { type: 'Mesh3D', shape: 'box', width: 10, height: 0.4, depth: 7, frontTint: 0xff0000, backTint: 0x00ff00, edgeTint: 0x222222 };
  it('缺省 → 正红在 +z(4)、反绿在 −z(5)、+y 顶是 edge', () => {
    const g = buildInstancedMesh3DGeometry(base);
    expect(faceColorHex(g, 4)).toBe(0xff0000);
    expect(faceColorHex(g, 5)).toBe(0x00ff00);
    expect(faceColorHex(g, 2)).toBe(0x222222); // +y 顶=edge
  });
  it('faceAxis:y → 正红在 +y(2·顶)、反绿在 −y(3·底)、+z 面变 edge（薄牌躺平顶底分色）', () => {
    const g = buildInstancedMesh3DGeometry({ ...base, faceAxis: 'y' });
    expect(faceColorHex(g, 2)).toBe(0xff0000); // 顶=正
    expect(faceColorHex(g, 3)).toBe(0x00ff00); // 底=反
    expect(faceColorHex(g, 4)).toBe(0x222222); // +z 侧=edge
  });
});

describe('buildMesh3D（单 mesh 材质数组）：faceAxis 决定 front/back 材质落哪两槽', () => {
  it('faceAxis:y → 槽 2/3 是独立 front/back 材质实例（≠ edge 实例）', () => {
    const mesh = buildMesh3D({ type: 'Mesh3D', shape: 'box', width: 10, height: 0.4, depth: 7, frontTint: 0xff0000, faceAxis: 'y' });
    const a = mesh.material as THREE.Material[];
    expect(a).toHaveLength(6);
    expect(a[2]).not.toBe(a[0]); // 顶=front 实例·独立于 edge
    expect(a[3]).not.toBe(a[0]); // 底=back 实例
    expect(a[4]).toBe(a[0]);     // +z 侧=edge 共享实例
  });
});
