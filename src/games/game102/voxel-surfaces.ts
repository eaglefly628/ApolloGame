// game102《色流工坊 / Pixel Pour》· 体素表面材质预设库（render-only·数据配方·可复用）。
//
// 目的：给 voxel-proto 的立方体素更好的观感，同时**不破坏 P3D 实例化归批**——
//   预设 = 一组 `VoxelTex` 参数配方（走 `Mesh3D.voxelTex`·渲染器程序化生成六面贴图），
//   **绝不挂 Material3D**（挂了体素会退化成单 mesh/格·卡且做不大·见 three-renderer/geometry voxelMode 归批）。
//   同一 (preset, tint) 的所有体素 voxelMode 签名一致 → 共享一个 InstancedMesh（1 draw call）。
//
// 用法（数据驱动·最弱 LLM 也只能在枚举里选）：
//   import { VOXEL_SURFACES, type VoxelSurface } from './voxel-surfaces.js';
//   const mesh = { shape:'box', width:VOX, height:VOX, depth:VOX, frontTint:t, ...VOXEL_SURFACES['speed'](t) };
//
// 闭集依据：`VoxelTex`（src/engine/protocol/components/render.ts）——top/side/top2/side2/trim/pattern/tile。
// pattern 枚举 'grass'|'stone'|'crystal'|'plain' 为引擎既有闭集，本表只组合、不新增枚举/不碰渲染器。
import type { VoxelTex } from '@engine/protocol/components/render.js';

/** 0xRRGGBB 乘系数明暗（clamp）。 */
function shade(t: number, k: number): number {
  const r = Math.min(255, Math.round(((t >> 16) & 0xff) * k));
  const g = Math.min(255, Math.round(((t >> 8) & 0xff) * k));
  const b = Math.min(255, Math.round((t & 0xff) * k));
  return (r << 16) | (g << 8) | b;
}

/** 体素表面预设名（闭集·扩表=加一条配方·不碰引擎）。 */
export type VoxelSurface = 'matte' | 'speed' | 'gem';

/** 预设表：surface 名 → (tint)⇒VoxelTex 配方。每个配方按传入主色染色，保留观感母题。 */
export const VOXEL_SURFACES: Record<VoxelSurface, (tint: number) => VoxelTex> = {
  // 素面（当前基线·owner：一个放大的干净体素·8×8·中间无拼缝线）：纯色一格一面·顶亮侧暗出体积。
  //   tile:8 = 每面 8×8 像素（干净像素块·非重复母题 → 不再"两块拼一块"的中缝）。观感靠 GTAO/post 出厚度。
  matte: (t) => ({ top: t, side: shade(t, 0.82), pattern: 'plain', tile: 8 }),

  // 提速块（Minecraft 感）：石纹母题（竖裂 + 深勾缝）· 顶亮侧暗分明 · 小 tile 出块面网格。
  speed: (t) => ({
    top: shade(t, 1.08),
    side: shade(t, 0.72),
    top2: shade(t, 0.86),
    side2: shade(t, 0.6),
    pattern: 'stone',
    tile: 11,
  }),

  // 果冻/宝石感：晶裂母题（浅色断面高光）· 提亮主色 · 亮饰边 trim → 通透宝石观感。
  gem: (t) => ({
    top: shade(t, 1.16),
    side: shade(t, 0.92),
    top2: shade(t, 1.34),
    side2: shade(t, 1.05),
    trim: shade(t, 1.5),
    pattern: 'crystal',
    tile: 22,
  }),
};

/** 预设名有序列表（供 UI 循环切换展示）。 */
export const VOXEL_SURFACE_NAMES: VoxelSurface[] = ['speed', 'gem', 'matte'];
