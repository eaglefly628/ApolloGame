// Decal3D 地面贴花（render-only）：纯函数遮罩形状 + 系统跟随实体地面位 + 不进 hash。
import { describe, it, expect } from 'vitest';
import { decalMask, DecalSystem } from './decal.js';
import * as THREE from 'three';
import { World } from '@engine/core/world.js';
import { hashSnapshot } from '@net/index.js';
import type { Decal3D, Transform3D } from '@engine/protocol/components.js';

// 取遮罩某像素的 alpha（第 4 通道）。
const alphaAt = (data: Uint8Array, size: number, x: number, y: number): number => data[(y * size + x) * 4 + 3]!;

describe('decalMask（纯函数·alpha 形状遮罩）', () => {
  const S = 64;
  it('blob：中心实、边缘 0（软径向·rgb 全白供染色）', () => {
    const m = decalMask('blob', S);
    const c = Math.floor((S - 1) / 2);
    expect(alphaAt(m, S, c, c)).toBeGreaterThan(200); // 中心不透明
    expect(alphaAt(m, S, 0, 0)).toBe(0);              // 角（出圆）透明
    expect(m[0]).toBe(255); expect(m[1]).toBe(255); expect(m[2]).toBe(255); // rgb 白
  });
  it('disc：中心与近中都实（实心圆）', () => {
    const m = decalMask('disc', S);
    const c = Math.floor((S - 1) / 2);
    expect(alphaAt(m, S, c, c)).toBe(255);            // 实心
    expect(alphaAt(m, S, c, c + 10)).toBeGreaterThan(200); // 半径内仍实
  });
  it('ring：中心透明、环带处实（空心环）', () => {
    const m = decalMask('ring', S);
    const c = Math.floor((S - 1) / 2);
    expect(alphaAt(m, S, c, c)).toBeLessThan(40);     // 中心空
    // 环带在 r≈0.8 → 距中心 0.8*c 像素处应有 alpha
    const ry = Math.round(c + 0.8 * c);
    expect(alphaAt(m, S, c, Math.min(S - 1, ry))).toBeGreaterThan(120);
  });
});

describe('DecalSystem（跟随实体地面位·render-only）', () => {
  it('贴片跟随实体 XZ；改参重建；实体消失清理', () => {
    const scene = new THREE.Scene();
    const w = new World();
    w.createEntity('u');
    w.addComponent('u', { type: 'Transform3D', x: 5, y: 2, z: -3 } as Transform3D);
    w.addComponent('u', { type: 'Decal3D', kind: 'blob', radius: 3 } as Decal3D);
    const sys = new DecalSystem();
    expect(sys.sync(scene, w)).toBeGreaterThan(0); // 首帧创建=有变化
    // 贴片挂到场景、贴地（y≈0.05·非实体 y=2）、随 XZ
    const mesh = scene.children.find((o) => o instanceof THREE.Mesh) as THREE.Mesh;
    expect(mesh).toBeTruthy();
    expect(mesh.position.x).toBe(5); expect(mesh.position.z).toBe(-3);
    expect(mesh.position.y).toBeCloseTo(0.05); // 贴地·不随实体高度
    // 移动实体 → 贴片跟随（有变化）
    w.getComponent<Transform3D>('u', 'Transform3D')!.x = 9;
    expect(sys.sync(scene, w)).toBeGreaterThan(0);
    expect(mesh.position.x).toBe(9);
    // 静止再 sync → 无变化（0·不强制重渲）
    expect(sys.sync(scene, w)).toBe(0);
    // 实体消失 → 清理贴片
    w.destroyEntity('u');
    expect(sys.sync(scene, w)).toBeGreaterThan(0);
    expect(scene.children.some((o) => o instanceof THREE.Mesh)).toBe(false);
  });
});

describe('Decal3D = render-only（不进 hash）', () => {
  it('加 Decal3D 不改变 world hash', () => {
    const w = new World();
    w.createEntity('e');
    const h0 = hashSnapshot(w.snapshot());
    w.addComponent('e', { type: 'Decal3D', kind: 'ring', color: 0x00ff00 } as Decal3D);
    expect(hashSnapshot(w.snapshot())).toBe(h0); // Decal3D 被 NON_DETERMINISTIC 排除
  });
});
