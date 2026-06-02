import { defineCapability } from '@engine/core/define-capability.js';
import type { Transform, Shape, Overlap } from '@engine/protocol/components.js';

export type { Overlap };

interface Hit {
  nx: number;
  ny: number;
  depth: number;
}

function halfExtents(s: Shape): { hw: number; hh: number } {
  if (s.kind === 'box') return { hw: (s.width ?? 0) / 2, hh: (s.height ?? 0) / 2 };
  const r = s.radius ?? 0;
  return { hw: r, hh: r };
}

// 法线方向：从 A 指向 B。无重叠返回 null。
function testOverlap(at: Transform, as: Shape, bt: Transform, bs: Shape): Hit | null {
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

  // box vs circle (任意顺序)；sign 把法线统一回 A→B
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

export const overlapDetectCapability = defineCapability({
  id: 'd1-overlap-detect',
  version: '1.0.0',

  describe: {
    name: 'overlap-detect',
    summary: '哪两个实体重叠了？法线和穿透深度？',
    semantic: ['collision', 'detection'],
    whenToUse:
      '需要碰撞事实时。纯检测：每帧对所有 Transform+Shape 实体两两测试，为重叠对创建 Overlap 实体（法线 A→B、穿透深度）。响应（推开/弹性/触发）是消费者，归组合层。box 暂按 AABB（不含旋转）。',
    examples: ['玩家撞墙：Overlap{entityA:player, entityB:wall, normal, depth}', '子弹命中：collision-separate 读 Overlap 推开', '触发区：trigger-zone 读 Overlap + tag'],
  },

  components: {
    provides: {
      Overlap: {
        category: 'event',
        describe: '一对重叠实体的事实。法线从 A 指向 B，depth 为穿透深度。每帧重算（挂在 overlap:<a>:<b> 实体上）。',
        fields: {
          entityA: { type: 'EntityId', describe: '重叠对的第一个实体' },
          entityB: { type: 'EntityId', describe: '重叠对的第二个实体' },
          normalX: { type: 'number', describe: '分离法线 X（A→B）' },
          normalY: { type: 'number', describe: '分离法线 Y（A→B）' },
          depth: { type: 'number', describe: '穿透深度' },
        },
      },
    },
    reads: ['Transform', 'Shape'],
    writes: ['Overlap'],
    consumes: [],
  },

  config: {},

  systems: [
    {
      id: 'overlap-detect',
      reads: ['Transform', 'Shape'],
      writes: ['Overlap'],
      consumes: [],
      execute(world) {
        for (const [id] of world.query('Overlap')) world.destroyEntity(id);

        const ents = world.query('Transform', 'Shape');
        for (let i = 0; i < ents.length; i++) {
          for (let j = i + 1; j < ents.length; j++) {
            const aId = ents[i][0];
            const bId = ents[j][0];
            const at = world.getComponent<Transform>(aId, 'Transform')!;
            const as = world.getComponent<Shape>(aId, 'Shape')!;
            const bt = world.getComponent<Transform>(bId, 'Transform')!;
            const bs = world.getComponent<Shape>(bId, 'Shape')!;
            const hit = testOverlap(at, as, bt, bs);
            if (!hit) continue;
            const lo = aId < bId ? aId : bId;
            const hi = aId < bId ? bId : aId;
            const oid = `overlap:${lo}:${hi}`;
            world.createEntity(oid);
            const overlap: Overlap = { type: 'Overlap', entityA: aId, entityB: bId, normalX: hit.nx, normalY: hit.ny, depth: hit.depth };
            world.addComponent(oid, overlap);
          }
        }
      },
    },
  ],
});
