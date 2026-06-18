import type { Renderable } from './renderable.js';

// ═══════════════════════════════════════════════════════════════
//  three-projection —— 2D Renderable → 3D 位姿的**纯函数**（无 three / 无 WebGL 依赖 → node 可测）。
//  把易错的几何（y 翻转、zOrder→深度、相机取景）抽出来单测，three-renderer 只剩薄 WebGL 胶水
//  （同 renderable.ts 把 chooseRenderMode 抽成纯函数的先例）。
// ═══════════════════════════════════════════════════════════════

// 约定：2D y 向下 → 3D y 向上（取负）；zOrder → z 微分层（深度）；旋转随 y 翻转取负以保观感一致。
export interface Pose3D {
  x: number;
  y: number;
  z: number;
  rotZ: number;
  sx: number;
  sy: number;
}

export function renderablePose(r: Renderable, zStep = 0.01): Pose3D {
  return { x: r.x, y: -r.y, z: r.zOrder * zStep, rotZ: -r.rotation, sx: r.scaleX, sy: r.scaleY };
}

export interface Bounds2D {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

// 所有位姿的包围盒（每实体含半尺寸 half 余量）。空 → 单位盒（避免退化）。
export function poseBounds(poses: readonly Pose3D[], half = 0.5): Bounds2D {
  if (poses.length === 0) return { minX: -1, maxX: 1, minY: -1, maxY: 1 };
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of poses) {
    minX = Math.min(minX, p.x - half);
    maxX = Math.max(maxX, p.x + half);
    minY = Math.min(minY, p.y - half);
    maxY = Math.max(maxY, p.y + half);
  }
  return { minX, maxX, minY, maxY };
}

// 透视相机沿 +z 拉远到正好框住包围盒（含 pad 余量）。返回 lookAt 中心 (cx,cy) 与相机距离 dist。
// 纯表现（presentation）——用 tan/PI 不影响确定性（渲染层不进 hash）。
export function fitPerspective(b: Bounds2D, fovDeg: number, aspect: number, pad = 1.12): { cx: number; cy: number; dist: number } {
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  const halfW = Math.max(0.5, (b.maxX - b.minX) / 2);
  const halfH = Math.max(0.5, (b.maxY - b.minY) / 2);
  const tanV = Math.tan((fovDeg * Math.PI) / 180 / 2);
  const dist = Math.max(halfH / tanV, halfW / (tanV * Math.max(aspect, 1e-6))) * pad + 1;
  return { cx, cy, dist };
}

// ── Mesh3D（3D 物件即数据）几何/翻面的纯推导（无 three / 无 WebGL → node 可测）──────────────

// box 厚度：plane 无厚度(0)；box 缺省=短边*ratio 的薄板（下限 1），显式 depth 则透传。
export function mesh3dDepth(shape: 'box' | 'plane', width: number, height: number, depth?: number, ratio = 0.05): number {
  if (shape === 'plane') return 0;
  return depth ?? Math.max(1, Math.min(width, height) * ratio);
}

// 翻面：Transform.rotation 作为绕 flipAxis 的角度（0=正面朝镜头、π=反面）→ 欧拉角（另一轴恒 0）。
export function flipEuler(rotation: number, axis: 'x' | 'y' = 'x'): { x: number; y: number } {
  return axis === 'y' ? { x: 0, y: rotation } : { x: rotation, y: 0 };
}
