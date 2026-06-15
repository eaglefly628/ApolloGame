import { describe, it, expect } from 'vitest';
import { renderablePose, poseBounds, fitPerspective, type Pose3D } from './three-projection.js';
import type { Renderable } from './renderable.js';

const R = (o: Partial<Renderable>): Renderable => ({
  entityId: 'e',
  x: 0,
  y: 0,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  zOrder: 0,
  ...o,
});
const P = (o: Partial<Pose3D>): Pose3D => ({ x: 0, y: 0, z: 0, rotZ: 0, sx: 1, sy: 1, ...o });

describe('three-projection — 纯 2D→3D 映射（无 three / 无 WebGL）', () => {
  it('renderablePose：y 翻转、zOrder→z、旋转取负、缩放透传', () => {
    expect(renderablePose(R({ x: 10, y: 20, rotation: 0.5, zOrder: 3, scaleX: 2, scaleY: 3 }), 0.01)).toEqual({
      x: 10,
      y: -20,
      z: 0.03,
      rotZ: -0.5,
      sx: 2,
      sy: 3,
    });
  });

  it('poseBounds：空 → 单位盒；含半尺寸余量', () => {
    expect(poseBounds([])).toEqual({ minX: -1, maxX: 1, minY: -1, maxY: 1 });
    expect(poseBounds([P({ x: 0, y: 0 }), P({ x: 10, y: 4 })], 0.5)).toEqual({
      minX: -0.5,
      maxX: 10.5,
      minY: -0.5,
      maxY: 4.5,
    });
  });

  it('fitPerspective：中心居中、距离>0、盒越大距离越大', () => {
    const small = fitPerspective({ minX: -1, maxX: 1, minY: -1, maxY: 1 }, 50, 1.6);
    const big = fitPerspective({ minX: -10, maxX: 10, minY: -10, maxY: 10 }, 50, 1.6);
    expect(small.cx).toBe(0);
    expect(small.cy).toBe(0);
    expect(small.dist).toBeGreaterThan(0);
    expect(big.dist).toBeGreaterThan(small.dist);
  });

  it('fitPerspective：中心随包围盒平移', () => {
    const fit = fitPerspective({ minX: 4, maxX: 6, minY: 10, maxY: 14 }, 50, 1);
    expect(fit.cx).toBe(5);
    expect(fit.cy).toBe(12);
  });
});
