// Game F · 六边形棋盘配置（喂引擎 hex/grid-move 能力 —— 主程 REQ-024 已落地）。
//
// hex 数学（坐标/邻接/确定性 A* 寻路/投影）已由**引擎**拥有：@skills/tier2/hex（纯算法 hexNextStep）
// + @skills/tier2/grid-move（HexBoard/HexPos/GridMover 组件 + 逐格移动系统）。
// 本文件只剩纯**数据**：棋盘尺寸/投影常量 + 装饰性棋盘格生成（用引擎同款投影对齐单位）。
//
// 金铲铲布局：7 列 × 8 行 = 56 格（每方 7×4）。axial 坐标 (q,r)，r0-3=魏上半场 / r4-7=蜀下半场。
// 投影同 grid-move.project：x = originX + q*TILE + r*TILE/2，y = originY + r*TILE*0.75（精确二进制分数，跨端一致）。
import type { EntityBlueprint } from '../../assembly/demo.assembly.js';

export const COLS = 7;
export const ROWS = 8;
export const HALF_ROWS = 4;
export const TILE = 40; // 每格像素（= HexBoard.tileSize）

// 居中：让整盘中心落世界 (0,0)。
export const ORIGIN_X = -TILE * ((COLS - 1) + (ROWS - 1) / 2) / 2;
export const ORIGIN_Y = -TILE * 0.75 * (ROWS - 1) / 2;

// 引擎同款投影（grid-move 内 project 的复刻；仅用于装饰棋盘格对齐——单位投影由引擎做）。
export function project(q: number, r: number): { x: number; y: number } {
  return { x: ORIGIN_X + q * TILE + r * (TILE / 2), y: ORIGIN_Y + r * (TILE * 0.75) };
}

// 棋盘格实体（表现层底）：每格一个六边形贴片，落格中心、zOrder0（棋子之下）。
// r<4 = 魏冷半场 / r>=4 = 蜀暖半场，分清两方领地。
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
