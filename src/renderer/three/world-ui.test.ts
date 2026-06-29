// TA Phase 3：世界 UI 投影（纯函数·真相机无需 GL）+ WorldUI3D render-only（不进 hash）。
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { projectPoint } from './world-ui.js';
import { World } from '@engine/core/world.js';
import { hashSnapshot } from '@net/index.js';
import type { WorldUI3D } from '@engine/protocol/components.js';

function cam(): THREE.PerspectiveCamera {
  const c = new THREE.PerspectiveCamera(50, 2, 0.1, 100);
  c.position.set(0, 0, 10); c.lookAt(0, 0, 0); c.updateMatrixWorld(); c.updateProjectionMatrix();
  return c;
}

describe('world-ui 投影（TA Phase 3）', () => {
  it('原点 → 屏幕中心·可见', () => {
    const p = projectPoint(cam(), 0, 0, 0, 800, 400);
    expect(p.sx).toBeCloseTo(400);
    expect(p.sy).toBeCloseTo(200);
    expect(p.visible).toBe(true);
  });
  it('相机后方的点 → 不可见', () => {
    const p = projectPoint(cam(), 0, 0, 30, 800, 400); // 相机在 z=10 看向 -Z → z=30 在身后
    expect(p.visible).toBe(false);
  });
  it('点在右上 → sx>中心、sy<中心（屏幕 Y 向下）', () => {
    const p = projectPoint(cam(), 3, 3, 0, 800, 400);
    expect(p.sx).toBeGreaterThan(400);
    expect(p.sy).toBeLessThan(200);
  });
});

describe('WorldUI3D = render-only（不进 hash）', () => {
  it('加/改 WorldUI3D 不改变 world hash', () => {
    const w = new World();
    w.createEntity('e');
    const h0 = hashSnapshot(w.snapshot());
    w.addComponent('e', { type: 'WorldUI3D', text: '头顶', offsetY: 6 } as WorldUI3D);
    expect(hashSnapshot(w.snapshot())).toBe(h0); // WorldUI3D 被 NON_DETERMINISTIC 排除
  });
});
