// Game F · 六边形棋盘配置（喂引擎 hex/grid-move 能力 —— 主程 REQ-024/027 已落地）。
//
// hex 数学（坐标/邻接/A* 寻路/投影）由**引擎**拥有：@skills/tier2/hex + grid-move。
// 本文件只剩纯**数据**：棋盘尺寸/投影常量 + 装饰性棋盘格生成（用引擎同款 offset 投影对齐单位）。
//
// 布局：**offset（REQ-F-027）**——奇行右移半格、不累积 → 规整矩形 + 六边形交错（金铲铲观感，非平行四边形）。
// 12×12 正交棋盘。axial 坐标 (q,r)，r0-5=魏上半场 / r6-11=蜀下半场，中线在 r5/6 之间。
import type { EntityBlueprint } from '../../assembly/demo.assembly.js';

export const COLS = 12;
export const ROWS = 12;
export const HALF_ROWS = 6;
export const TILE = 36; // 每格像素（= HexBoard.tileSize）
export const LAYOUT = 'offset' as const; // 行偏移布局：规整矩形（REQ-F-027）

// 居中：让整盘中心落世界 (0,0)。offset 下奇行多半格，取 +TILE/2 计入宽度。
export const ORIGIN_X = -((COLS - 1) * TILE + TILE / 2) / 2;
export const ORIGIN_Y = -((ROWS - 1) * TILE * 0.75) / 2;

// 引擎同款 offset 投影（grid-move layout:'offset' 的复刻；仅用于装饰棋盘格对齐——单位投影由引擎做）。
export function project(q: number, r: number): { x: number; y: number } {
  return { x: ORIGIN_X + q * TILE + (r & 1) * (TILE / 2), y: ORIGIN_Y + r * (TILE * 0.75) };
}

// 棋盘格实体（表现层底）：每格一个六边形贴片，落格中心、zOrder0（棋子之下）。
// r<6 = 魏冷半场 / r>=6 = 蜀暖半场，分清两方领地。
export function boardEntities(warmKey: string, coolKey: string): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  for (let r = 0; r < ROWS; r++) {
    for (let q = 0; q < COLS; q++) {
      const p = project(q, r);
      out[`hex_${q}_${r}`] = {
        Transform: { x: p.x, y: p.y, rotation: 0, scaleX: 1, scaleY: 1 },
        Sprite: { textureKey: r >= HALF_ROWS ? warmKey : coolKey, anchorX: 0.5, anchorY: 0.5, zOrder: 0 },
      } as unknown as EntityBlueprint;
    }
  }
  return out;
}
