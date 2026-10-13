import type { FlowField, Line3D } from '@zerocraft/engine/engine/protocol/components.js';
import { getBakedField, UNREACHABLE } from '@zerocraft/engine/skills/tier2/flow-field-core.js';
import { usableGuideField } from '@zerocraft/engine/skills/tier2/crowd-flow-guide.js';

export type FlowView = 'off' | 'vertical' | 'horizontal' | 'cart';
export const FLOW_VIEWS: readonly FlowView[] = ['off', 'vertical', 'horizontal', 'cart'];

const PROFILES: Record<Exclude<FlowView, 'off'>, {
  fieldId: string; color: number; minX: number; maxX: number; minY: number; maxY: number;
}> = {
  vertical: { fieldId: 'ox-flow-vertical', color: 0x32e4ff, minX: -18, maxX: 18, minY: -24, maxY: 24 },
  horizontal: { fieldId: 'ox-flow-horizontal', color: 0xff91dc, minX: -22, maxX: 22, minY: -18, maxY: 18 },
  cart: { fieldId: 'cart-flow-horizontal', color: 0xffd36a, minX: -22, maxX: 22, minY: -5, maxY: 13 },
};

export function flowFieldId(view: Exclude<FlowView, 'off'>): string { return PROFILES[view].fieldId; }

/** Preview-only world-space glyphs. The baked field remains the single source of direction truth. */
export function buildFlowDebugLines(field: FlowField, view: Exclude<FlowView, 'off'>): Array<{ id: string; line: Line3D }> {
  if (!usableGuideField(field)) return [];
  const p = PROFILES[view];
  const baked = getBakedField(field);
  const result: Array<{ id: string; line: Line3D }> = [];
  const stride = Math.max(1, Math.round(2 / field.cellSize));
  const height = .55;
  for (let row = 0; row < field.rows; row += stride) {
    const y = field.originY + (row + .5) * field.cellSize;
    if (y < p.minY || y > p.maxY) continue;
    for (let col = 0; col < field.cols; col += stride) {
      const x = field.originX + (col + .5) * field.cellSize;
      if (x < p.minX || x > p.maxX) continue;
      const cell = row * field.cols + col;
      const dx = baked.dir[cell * 2]!, dy = baked.dir[cell * 2 + 1]!;
      if (baked.integration[cell] === UNREACHABLE) continue;
      let points: [number, number, number][];
      if (dx === 0 && dy === 0) {
        // Goal cells are diamonds; inaccessible cells are left blank.
        points = [[x, height, y - .13], [x + .13, height, y], [x, height, y + .13],
          [x - .13, height, y], [x, height, y - .13]];
      } else {
        const length = Math.sqrt(dx * dx + dy * dy), ux = dx / length, uy = dy / length;
        const tipX = x + ux * .37, tipY = y + uy * .37;
        const wingX = tipX - ux * .17, wingY = tipY - uy * .17;
        points = [[x - ux * .35, height, y - uy * .35], [tipX, height, tipY],
          [wingX - uy * .13, height, wingY + ux * .13], [tipX, height, tipY],
          [wingX + uy * .13, height, wingY - ux * .13]];
      }
      result.push({
        id: `flow-debug-${view}-${row}-${col}`,
        line: { type: 'Line3D', points, color: baked.cost[cell] === 1 ? p.color : 0xa2b0af,
          width: .05, opacity: baked.cost[cell] === 1 ? .95 : .62 },
      });
    }
  }
  return result;
}

/** The same occupied-cell layer used by A*; markers do not claim to alter the static flow arrows. */
export function buildOccupancyDebugLines(field: FlowField, occupied: Uint8Array,
  view: Exclude<FlowView, 'off'>): Array<{ id: string; line: Line3D }> {
  const p = PROFILES[view];
  const result: Array<{ id: string; line: Line3D }> = [];
  const half = field.cellSize * .43, height = .59;
  for (let row = 0; row < field.rows; row++) {
    const y = field.originY + (row + .5) * field.cellSize;
    if (y < p.minY || y > p.maxY) continue;
    for (let col = 0; col < field.cols; col++) {
      const x = field.originX + (col + .5) * field.cellSize;
      if (x < p.minX || x > p.maxX) continue;
      const count = occupied[row * field.cols + col]!;
      if (count === 0) continue;
      result.push({ id: `flow-cost-${view}-${row}-${col}`, line: {
        type: 'Line3D', color: count > 1 ? 0xff613d : 0xff9b43, width: .035, opacity: .75,
        points: [[x-half,height,y-half],[x+half,height,y-half],[x+half,height,y+half],
          [x-half,height,y+half],[x-half,height,y-half]],
      } });
    }
  }
  return result;
}
