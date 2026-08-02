// Game 102 · Pixel Pour（3D 版）—— **体素立方核心** 的确定性数据结构 + 旋转立方场景（纯数据·零渲染器代码）。
//
// owner 定案（2026-07-26）：玩法不变，只把「中央被打的目标」从 2D 像素画换成一个**在中央旋转的 3D 体素立方**
// （Minecraft 提速块观感）。**数据结构开局就钉死**：一个 dim³ 的 3D 体素格，每格世界位**完全确定**；核心是居中的
// core³ 实心立方（被打目标体），最外层壳是**炮塔轨道所在层**（后续玩法接线用）。
//
// 立体化如何做到「零渲染器代码·纯数据」：
//   · 每个体素 = 一实体（Transform3D 定位姿 + Mesh3D box + voxelTex 提速块贴图）——同 game-z diorama 的 block 先例。
//   · 整块立方**一起转** = 一个 pivot 实体挂 Pivot3D{children:所有体素}·pivot 的 Transform3D 被 Anim3D{spin} 匀速自转。
//   · 相机 = Camera3D 轨道机位（盒庭模式）；Sky3D/Light3D 给光。全是 ThreeRenderer 直接消费的 render-only 组件。
// 引擎已有全部原语（Anim3D spin / Pivot3D / Mesh3D voxelTex / Camera3D）→ **无新能力缺口·无 system 代码**（守 Lead 裁①）。

import type { WorldBlueprint, EntityBlueprint } from '@assembly/demo.assembly.js';

// ── 体素格配置（纯数据·一切可关卡覆盖）──────────────────────────────────────────────────────
export interface VoxelGridConfig {
  readonly dim: number;   // 空间体素体边长（索引 i,j,k ∈ [0,dim)）——owner 例：13
  readonly core: number;  // 核心实心立方边长（居中·被打目标体）——owner 例：10
  readonly pitch: number; // 单体素世界步距（世界单位·含缝）
  readonly voxel: number; // 单体素方块边长（< pitch → 露 1 格缝＝提速块网格线）
}
export const VOX: VoxelGridConfig = { dim: 13, core: 10, pitch: 24, voxel: 23 };

// 核心立方的索引闭区间 [lo, hi]（居中于体素体）。
export function coreBounds(cfg: VoxelGridConfig = VOX): { lo: number; hi: number } {
  const lo = Math.floor((cfg.dim - cfg.core) / 2);
  return { lo, hi: lo + cfg.core - 1 };
}
// 核心几何中心的**索引坐标**（可为半整数）——世界原点对齐它 → 立方恒居中于 (0,0,0)。
function coreCenterIdx(cfg: VoxelGridConfig = VOX): number {
  const { lo, hi } = coreBounds(cfg);
  return (lo + hi) / 2;
}
// ★ 确定性世界位：格索引 (i,j,k) → 世界坐标（居中于核心中心·纯 +-*/·跨机逐位一致）。
export function voxelPos(i: number, j: number, k: number, cfg: VoxelGridConfig = VOX): { x: number; y: number; z: number } {
  const c = coreCenterIdx(cfg);
  return { x: (i - c) * cfg.pitch, y: (j - c) * cfg.pitch, z: (k - c) * cfg.pitch };
}
// 最外层壳半径（索引·炮塔轨道所在层）= 体素体最外圈。
export function trackShellIndex(cfg: VoxelGridConfig = VOX): { min: number; max: number } {
  return { min: 0, max: cfg.dim - 1 };
}
// 某核心体素是否在**核心表面**（Minecraft 只需渲外壳·内部恒被遮）——任一轴处于核边界即表面。
export function isCoreSurface(i: number, j: number, k: number, cfg: VoxelGridConfig = VOX): boolean {
  const { lo, hi } = coreBounds(cfg);
  const inCore = (v: number): boolean => v >= lo && v <= hi;
  if (!inCore(i) || !inCore(j) || !inCore(k)) return false;
  return i === lo || i === hi || j === lo || j === hi || k === lo || k === hi;
}

// ── 提速块配色（Minecraft 地形立方观感·按高度 j 分层：草→土→石）─────────────────────────────
const TERRAIN = {
  grassTop: 0x6bbf4a, grassSide: 0x8a6b3f, // 草皮（顶绿·侧土）
  dirt: 0x8a6b3f, dirtDark: 0x71562f,
  stone: 0x8b8f98, stoneDark: 0x6d7178,
  coal: 0x2f333b, iron: 0xd8a679, gold: 0xf2c21e, // 矿脉点缀（确定性撒点）
} as const;
// 确定性伪随机（整数哈希·无 Math.random·同格恒定）——用于矿脉撒点。
function hash3(i: number, j: number, k: number): number {
  let h = (i * 73856093) ^ (j * 19349663) ^ (k * 83492791);
  h = (h ^ (h >>> 13)) >>> 0;
  return (h % 1000) / 1000; // [0,1)
}
// 单体素的提速块贴图（按高度分层 + 稀疏矿脉）。
function voxelTexFor(i: number, j: number, k: number, cfg: VoxelGridConfig): Record<string, unknown> {
  const { hi } = coreBounds(cfg);
  const depthFromTop = hi - j;
  const r = hash3(i, j, k);
  if (depthFromTop <= 0) return { top: TERRAIN.grassTop, side: TERRAIN.grassSide, pattern: 'grass', tile: 2 };
  if (depthFromTop <= 2) return { top: TERRAIN.dirt, side: TERRAIN.dirtDark, pattern: 'plain', tile: 2 };
  // 石层：偶发矿脉（侧面点缀色换成矿色）。
  const ore = r < 0.04 ? TERRAIN.gold : r < 0.1 ? TERRAIN.iron : r < 0.22 ? TERRAIN.coal : undefined;
  return { top: TERRAIN.stone, side: TERRAIN.stoneDark, side2: ore, pattern: 'stone', tile: 2 };
}

// ── 核心体素立方（外壳实体阵·全部作为 pivot 子件）───────────────────────────────────────────
// 返回 { entities, ids }：ids = 供 Pivot3D.children 收拢（整块一起转）。
export function coreCubeVoxels(cfg: VoxelGridConfig = VOX): { entities: Record<string, EntityBlueprint>; ids: string[] } {
  const entities: Record<string, EntityBlueprint> = {};
  const ids: string[] = [];
  const { lo, hi } = coreBounds(cfg);
  for (let i = lo; i <= hi; i++) {
    for (let j = lo; j <= hi; j++) {
      for (let k = lo; k <= hi; k++) {
        if (!isCoreSurface(i, j, k, cfg)) continue; // 只铺外壳（内部恒遮·省实体）
        const p = voxelPos(i, j, k, cfg);
        const id = `vox-${i}-${j}-${k}`;
        entities[id] = {
          Transform3D: { x: p.x, y: p.y, z: p.z },
          Mesh3D: {
            shape: 'box', width: cfg.voxel, height: cfg.voxel, depth: cfg.voxel,
            frontTint: TERRAIN.stone, edgeTint: 0x3a3f4d,
            voxelTex: voxelTexFor(i, j, k, cfg),
          },
        };
        ids.push(id);
      }
    }
  }
  return { entities, ids };
}

// ── 旋转体素立方场景（proof of effect·owner「先把这个效果做出来」）───────────────────────────
// 立方居中于原点、绕 Y 轴匀速自转（叠一丝 X 轴翻滚更立体）；轨道相机盒庭取景；天光。
export function buildVoxelScene(cfg: VoxelGridConfig = VOX): WorldBlueprint {
  const { entities: voxels, ids } = coreCubeVoxels(cfg);
  const span = cfg.core * cfg.pitch; // 立方世界边长（估相机距离）
  const CAM_BACK = 3.4; // 相机后拉倍数（越大立方在屏上越小·owner「cube 太大」调此值）

  const entities: Record<string, EntityBlueprint> = {
    ...voxels,
    // pivot：挂 Pivot3D 收拢所有体素 + Anim3D 匀速自转（render-only·不进 hash）。
    'cube-pivot': {
      Transform3D: { x: 0, y: 0, z: 0 },
      Pivot3D: { children: ids, centerX: 0, centerY: 0, centerZ: 0 },
      Anim3D: { channels: [
        { kind: 'spin', field: 'rotY', rate: 0.5 },   // 绕竖轴匀速自转（rad/秒）
        { kind: 'spin', field: 'rotX', rate: 0.18 },  // 叠一丝翻滚 → 看清六面立体
      ] },
    },
    // 盒庭轨道相机（等距俯视环绕·框住立方）。
    cam: {
      Transform3D: { x: 0, y: 0, z: 0 },
      Camera3D: { yaw: 0.6, pitch: 0.5, distance: span * CAM_BACK, pivotX: 0, pivotY: 0, pivotZ: 0, projection: 'perspective', fov: 40 },
    },
    // 天空盒 + 光。
    sky: { Sky3D: { top: 0x243b6b, bottom: 0x8fb6e8, clouds: true, cloudTint: 0xffffff, scroll: 0.02, env: 0.6 } },
    'sun': { Light3D: { kind: 'directional', color: 0xffffff, intensity: 1.1, dirX: -0.5, dirY: -1, dirZ: -0.35, castShadow: true } },
    'amb': { Light3D: { kind: 'ambient', color: 0x9fb4d8, intensity: 0.5 } },
  };

  return { capabilities: [], entities };
}
