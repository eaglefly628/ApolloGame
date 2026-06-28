import type { Renderable } from './renderable.js';
import type { Transform3D } from '@engine/protocol/components.js';

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
  rx?: number; // 绕 X 欧拉角（仅 Transform3D 真三维路径用；2D 投影路径缺省 0）
  ry?: number; // 绕 Y 欧拉角（同上）
  sz?: number; // Z 轴缩放（同上；2D 路径缺省 1）
}

export function renderablePose(r: Renderable, zStep = 0.01): Pose3D {
  return { x: r.x, y: -r.y, z: r.zOrder * zStep, rotZ: -r.rotation, sx: r.scaleX, sy: r.scaleY };
}

// 真三维位姿（盒庭）：Transform3D → 完整 3D 位姿（地面=XZ、Y=高度）。等比 scale 落到三轴。纯函数（node 可测）。
export function transform3dPose(t3: Transform3D): Pose3D {
  const s = t3.scale ?? 1;
  return { x: t3.x, y: t3.y, z: t3.z, rx: t3.rotX ?? 0, ry: t3.rotY ?? 0, rotZ: t3.rotZ ?? 0, sx: s, sy: s, sz: s };
}

// 盒庭模式下「把 2D sim 实体投到地面」：Transform(x,y) → 地面 XZ（x→X、2D y→Z 景深），Y=物高/2（下沿坐地 y=0）。
// 2D rotation → 绕 Y 的朝向。→ 让用现成 input/velocity/motion 能力驱动的 2D 实体（如可控角色）在盒庭里走来走去，
// 即「同一份 2D sim 数据，换 3D 后端当盒庭看」。纯函数（node 可测）。
export function groundPose(r: { x: number; y: number; rotation: number; scaleX: number; scaleY: number }, height: number): Pose3D {
  return { x: r.x, y: height / 2, z: r.y, rotZ: 0, rx: 0, ry: -r.rotation, sx: r.scaleX, sy: r.scaleY, sz: r.scaleX };
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

// W1-A 实例化绘制：Mesh3D 的「视觉签名」——同签名的多实体可合进一个 InstancedMesh（1 draw call）。
// 含 shape + 尺寸 + 逐面色（色烤进几何 vertexColors，故色不同=不同几何=不同批）。纯函数（node 可测）。
export function mesh3dBatchKey(m: {
  shape: 'box' | 'plane'; width: number; height: number; depth?: number;
  frontTint: number; backTint?: number; edgeTint?: number;
}): string {
  if (m.shape === 'plane') return `plane|${m.width}|${m.height}|${m.frontTint}`;
  const depth = mesh3dDepth('box', m.width, m.height, m.depth);
  return `box|${m.width}|${m.height}|${depth}|${m.frontTint}|${m.backTint ?? m.frontTint}|${m.edgeTint ?? 0x1f2937}`;
}

// 翻面：Transform.rotation 作为绕 flipAxis 的角度（0=正面朝镜头、π=反面）→ 欧拉角（另一轴恒 0）。
export function flipEuler(rotation: number, axis: 'x' | 'y' = 'x'): { x: number; y: number } {
  return axis === 'y' ? { x: 0, y: rotation } : { x: rotation, y: 0 };
}

// 翻面后哪面朝镜头：rotation 归一到 [0,2π)，落在 (π/2, 3π/2) → 反面朝前（看到 back）。WebGL 后端靠真几何自动
// 决定可见面，无需此函数；正交看帧（frame-svg 无真几何）则据此选正/反面色，保真翻面。
export function faceDown(rotation: number): boolean {
  const tau = Math.PI * 2;
  const a = ((rotation % tau) + tau) % tau;
  return a > Math.PI / 2 && a < (3 * Math.PI) / 2;
}

// ── Camera3D（盒庭轨道相机）几何的纯推导（无 three / 无 WebGL → node 可测）──────────────────

export interface Bounds3D { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }

// 一组 3D 位姿的包围盒（每物含 half 余量）。空 → 单位盒（避免退化）。
export function poseBounds3D(poses: readonly Pose3D[], half = 0.5): Bounds3D {
  if (poses.length === 0) return { minX: -1, maxX: 1, minY: -1, maxY: 1, minZ: -1, maxZ: 1 };
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of poses) {
    minX = Math.min(minX, p.x - half); maxX = Math.max(maxX, p.x + half);
    minY = Math.min(minY, p.y - half); maxY = Math.max(maxY, p.y + half);
    minZ = Math.min(minZ, p.z - half); maxZ = Math.max(maxZ, p.z + half);
  }
  return { minX, maxX, minY, maxY, minZ, maxZ };
}

export function bounds3DCenter(b: Bounds3D): { x: number; y: number; z: number } {
  return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2, z: (b.minZ + b.maxZ) / 2 };
}

// 包围盒最大半边长（用于自适配相机距离 / 阴影相机视锥尺寸）。
export function bounds3DExtent(b: Bounds3D): number {
  return Math.max(b.maxX - b.minX, b.maxY - b.minY, b.maxZ - b.minZ) / 2;
}

// 透视相机框住半径 radius 的球所需距离（fov 度）。纯表现，用 tan 不影响确定性。
export function fitDistance3D(radius: number, fovDeg: number, pad = 1.4): number {
  const tanV = Math.tan((fovDeg * Math.PI) / 180 / 2);
  return (radius / Math.max(tanV, 1e-6)) * pad + radius;
}

// REQ-3D-Camera：俯仰夹角（行为层运镜 + 解释器都用·缺省不夹）。纯函数。
export function clampPitch(pitch: number, min?: number, max?: number): number {
  let p = pitch;
  if (min !== undefined) p = Math.max(min, p);
  if (max !== undefined) p = Math.min(max, p);
  return p;
}

// REQ-3D-Camera：正交相机视锥（按半高 + 宽高比）。纯函数（无 three）→ node 单测正交取景。
export function orthoFrustum(orthoSize: number, aspect: number): { left: number; right: number; top: number; bottom: number } {
  const halfH = Math.max(orthoSize, 1e-3);
  const halfW = halfH * Math.max(aspect, 1e-6);
  return { left: -halfW, right: halfW, top: halfH, bottom: -halfH };
}

// 轨道相机位置：绕 center 的球面坐标（y 上）。yaw=方位(绕Y)，pitch=俯仰(正=俯视)，dist=半径。
// 纯函数（无 three）→ node 单测相机定位，three-renderer 只剩 set/lookAt 薄胶水。
export function orbitCamera(
  center: { x: number; y: number; z: number },
  dist: number,
  yaw: number,
  pitch: number,
): { x: number; y: number; z: number } {
  const horiz = dist * Math.cos(pitch);
  return {
    x: center.x + horiz * Math.sin(yaw),
    y: center.y + dist * Math.sin(pitch),
    z: center.z + horiz * Math.cos(yaw),
  };
}
