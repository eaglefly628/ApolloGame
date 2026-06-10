// Game F · 六边形棋盘数据层（金铲铲/TFT 布局：7 列 × 8 行 = 56 格，每方 7×4=28）。
//
// ⚠️ 临时数据生成器：本文件只做「hex 坐标 → 像素位置」的布局数据生成（供蓝图摆棋盘/站位）。
//    待主程 REQ-024 的 hex-grid capability 落地后，hex 数学（坐标/邻接/占位）由**引擎**拥有，
//    game-f 只保留「哪些格、哪个英雄站哪格」的纯坐标**数据**。现在先把棋盘数据建起来，A* 等引擎。
//
// 朝向：pointy-top（尖顶向上，水平成排——对应金铲铲「前排/后排」），offset「odd-r」（奇数行右移半格）。
// 坐标：offset 坐标 (col,row)，col∈[0,6]，row∈[0,7]。row 0-3 = 上方(魏)，row 4-7 = 下方(蜀)，中线在 row3/4 之间。
import type { EntityBlueprint } from '../../assembly/demo.assembly.js';

export const COLS = 7;
export const ROWS = 8; // 战斗全场（两方各 4 行）
export const HALF_ROWS = 4; // 每方 4 行
export const HEX_SIZE = 28; // 六边形外接半径（中心→顶点）

const SQRT3 = Math.sqrt(3);
const X_STEP = HEX_SIZE * SQRT3; // 同排相邻列水平间距
const Y_STEP = HEX_SIZE * 1.5; // 相邻行垂直间距
// 居中偏移：让整盘中心落在世界 (0,0)，中线（row3/4 之间）落在 y=0 附近。
const X_OFF = X_STEP * (COLS - 1 + 0.5) / 2;
const Y_OFF = Y_STEP * (ROWS - 1) / 2;

export interface HexCell {
  col: number;
  row: number;
  x: number;
  y: number;
  side: 'A' | 'B'; // A=蜀(下,row4-7) / B=魏(上,row0-3)
}

// offset(col,row) → 世界像素中心（pointy-top, odd-r 右移半格，已居中）。
export function hexToPixel(col: number, row: number): { x: number; y: number } {
  const x = X_STEP * (col + 0.5 * (row & 1)) - X_OFF;
  const y = Y_STEP * row - Y_OFF;
  return { x, y };
}

// 全部 56 格（含像素位置 + 归属半场）。
export function boardCells(): HexCell[] {
  const cells: HexCell[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const { x, y } = hexToPixel(col, row);
      cells.push({ col, row, x, y, side: row < HALF_ROWS ? 'B' : 'A' });
    }
  }
  return cells;
}

// 棋盘格实体（表现层）：每格一个六边形贴片 sprite，落在格中心、zOrder 最低（棋子之下）。
// side 决定暖/冷贴片（蜀半场暖、魏半场冷），分清两方领地。
export function boardEntities(warmKey: string, coolKey: string): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  for (const c of boardCells()) {
    out[`hex_${c.col}_${c.row}`] = {
      Transform: { x: c.x, y: c.y, rotation: 0, scaleX: 1, scaleY: 1 },
      Sprite: { textureKey: c.side === 'A' ? warmKey : coolKey, anchorX: 0.5, anchorY: 0.5, zOrder: 0 },
    } as unknown as EntityBlueprint;
  }
  return out;
}
