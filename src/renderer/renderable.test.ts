import { describe, it, expect } from 'vitest';
import { screenToWorld } from './renderable.js';
import type { CameraView } from './renderable.js';

describe('screenToWorld — 屏幕→世界逆投影（Q5）', () => {
  const cam: CameraView = { centerX: 100, centerY: 50, zoom: 2 };
  const W = 640;
  const H = 400;

  it('视口中心 → 相机中心', () => {
    expect(screenToWorld(W / 2, H / 2, cam, W, H)).toEqual({ x: 100, y: 50 });
  });

  it('是渲染投影的逆：world→screen→world 还原', () => {
    const wx = 220;
    const wy = -30;
    // 正向投影（与 CanvasRenderer 一致）：screen = (world-center)*zoom + 画布中心
    const sx = (wx - cam.centerX) * cam.zoom + W / 2;
    const sy = (wy - cam.centerY) * cam.zoom + H / 2;
    expect(screenToWorld(sx, sy, cam, W, H)).toEqual({ x: wx, y: wy });
  });

  it('无相机 → 屏幕即世界', () => {
    expect(screenToWorld(12, 34, null, W, H)).toEqual({ x: 12, y: 34 });
  });
});
