import type { Transform, Shape } from '@engine/protocol/components.js';
import type { Aabb } from './aabb-tree.js';

// 接触几何：两形状的分离法线与穿透深度（法线从 A 指向 B）。无重叠返回 null。
// overlap-detect（检测）与 collision-resolve（迭代解算）共用同一份几何，确保检测与解算一致。
// box 暂按 AABB（不含旋转）。

export interface Contact {
  nx: number;
  ny: number;
  depth: number;
}

export function halfExtents(s: Shape): { hw: number; hh: number } {
  if (s.kind === 'box') return { hw: (s.width ?? 0) / 2, hh: (s.height ?? 0) / 2 };
  const r = s.radius ?? 0;
  return { hw: r, hh: r };
}

// 实体的轴对齐包围盒（宽相位树用）。
export function aabbOf(t: Transform, s: Shape): Aabb {
  const { hw, hh } = halfExtents(s);
  return { minX: t.x - hw, minY: t.y - hh, maxX: t.x + hw, maxY: t.y + hh };
}

export function contactBetween(at: Transform, as: Shape, bt: Transform, bs: Shape): Contact | null {
  const dx = bt.x - at.x;
  const dy = bt.y - at.y;

  if (as.kind === 'box' && bs.kind === 'box') {
    const a = halfExtents(as);
    const b = halfExtents(bs);
    const ox = a.hw + b.hw - Math.abs(dx);
    const oy = a.hh + b.hh - Math.abs(dy);
    if (ox <= 0 || oy <= 0) return null;
    if (ox < oy) return { nx: dx < 0 ? -1 : 1, ny: 0, depth: ox };
    return { nx: 0, ny: dy < 0 ? -1 : 1, depth: oy };
  }

  if (as.kind === 'circle' && bs.kind === 'circle') {
    const ar = as.radius ?? 0;
    const br = bs.radius ?? 0;
    const dist = Math.hypot(dx, dy);
    const pen = ar + br - dist;
    if (pen <= 0) return null;
    if (dist === 0) return { nx: 1, ny: 0, depth: pen };
    return { nx: dx / dist, ny: dy / dist, depth: pen };
  }

  // box vs circle（任意顺序）；sign 把法线统一回 A→B
  const aIsBox = as.kind === 'box';
  const boxT = aIsBox ? at : bt;
  const boxS = aIsBox ? as : bs;
  const cirT = aIsBox ? bt : at;
  const cirS = aIsBox ? bs : as;
  const sign = aIsBox ? 1 : -1;

  const bh = halfExtents(boxS);
  const r = cirS.radius ?? 0;
  const cdx = cirT.x - boxT.x;
  const cdy = cirT.y - boxT.y;
  const closestX = Math.max(-bh.hw, Math.min(cdx, bh.hw));
  const closestY = Math.max(-bh.hh, Math.min(cdy, bh.hh));
  const ddx = cdx - closestX;
  const ddy = cdy - closestY;
  const dist = Math.hypot(ddx, ddy);
  const pen = r - dist;
  if (pen <= 0) return null;
  if (dist === 0) return { nx: sign, ny: 0, depth: pen };
  return { nx: (ddx / dist) * sign, ny: (ddy / dist) * sign, depth: pen };
}
