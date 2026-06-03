import { defineCapability } from '@engine/core/define-capability.js';
import { SystemPhase } from '@engine/core/types.js';
import type { IWorld } from '@engine/core/types.js';
import type { Velocity, Transform, Shape, Mass, Overlap } from '@engine/protocol/components.js';
import { contactBetween } from '@engine/spatial/contact.js';

const ITERATIONS = 8;

// 逆质量：无 Velocity = 静态（不可动，0）；有 Mass 用 1/value（value<=0 视为静态）；否则单位质量 1。
function inverseMass(world: IWorld, id: string): number {
  if (!world.hasComponent(id, 'Velocity')) return 0;
  const m = world.getComponent<Mass>(id, 'Mass');
  if (m) return m.value > 0 ? 1 / m.value : 0;
  return 1;
}

// Tier 2 涌现（约束）：顺序冲量求解器（Bullet/Box2D 风格的最小核）。
// 读 overlap-detect 的候选接触对，K 遍迭代，每遍重算接触几何（与检测共用 contactBetween）：
//   1) 速度冲量（restitution=0）：按逆质量消除"接近"的相对法向速度；
//   2) 位置修正：按逆质量做全量分离。
// 静态体逆质量=0 → 每遍把动态体完全推出 → 落地/撞墙即停、且叠放不被挤穿地面（迭代收敛，无需特判）。
// 动态-动态按质量分摊；动态-静态精确退化为"推出穿透 + 清侵入速度"（与旧行为一致，老测试不破）。
//
// Resolve 阶段：写 Transform/Velocity 而 overlap-detect 读 Transform，纯组件拓扑会成环，phase 显式定序。
// 接触对按 (idA,idB) 升序处理 → 与实体插入顺序无关的确定性（lockstep 安全）。
export const collisionResolveCapability = defineCapability({
  id: 't2-collision-resolve',
  version: '1.0.0',

  describe: {
    name: 'collision-resolve',
    summary: '顺序冲量求解器：逆质量 + 速度冲量 + 迭代位置修正，把动态实体推出，且不挤穿静态/堆叠。',
    semantic: ['tier2', 'collision', 'resolution'],
    whenToUse: '需要实体不穿墙/能站立/能稳定堆叠时。读 Overlap+Transform+Shape+Velocity+Mass，写 Transform+Velocity，Resolve 阶段。',
    examples: ['玩家落在平台上 → vy 归零', '方块叠方块不挤穿地面（迭代收敛）', '不同质量相撞按逆质量分摊'],
  },

  components: {
    provides: {},
    reads: ['Overlap', 'Transform', 'Shape', 'Velocity', 'Mass'],
    writes: ['Transform', 'Velocity'],
    consumes: [],
  },

  config: {},

  systems: [
    {
      id: 'collision-resolve',
      phase: SystemPhase.Resolve,
      reads: ['Overlap', 'Transform', 'Shape', 'Velocity', 'Mass'],
      writes: ['Transform', 'Velocity'],
      consumes: [],
      execute(world) {
        // 候选接触对（来自 overlap-detect），确定序处理。
        const pairs: Array<[string, string]> = [];
        for (const [oid] of world.query('Overlap')) {
          const o = world.getComponent<Overlap>(oid, 'Overlap')!;
          pairs.push(o.entityA < o.entityB ? [o.entityA, o.entityB] : [o.entityB, o.entityA]);
        }
        pairs.sort((p, q) => (p[0] < q[0] ? -1 : p[0] > q[0] ? 1 : p[1] < q[1] ? -1 : p[1] > q[1] ? 1 : 0));

        for (let iter = 0; iter < ITERATIONS; iter++) {
          for (const [a, b] of pairs) {
            const aT = world.getComponent<Transform>(a, 'Transform');
            const bT = world.getComponent<Transform>(b, 'Transform');
            const aS = world.getComponent<Shape>(a, 'Shape');
            const bS = world.getComponent<Shape>(b, 'Shape');
            if (!aT || !bT || !aS || !bS) continue;
            const c = contactBetween(aT, aS, bT, bS); // 法线 n: a→b
            if (!c) continue; // 本遍已分离

            const invA = inverseMass(world, a);
            const invB = inverseMass(world, b);
            const invSum = invA + invB;
            if (invSum === 0) continue; // 双静态

            const { nx, ny, depth } = c;
            const aV = world.getComponent<Velocity>(a, 'Velocity');
            const bV = world.getComponent<Velocity>(b, 'Velocity');

            // 1) 速度冲量（restitution=0）：消除接近的相对法向速度。
            const rvn = ((bV?.vx ?? 0) - (aV?.vx ?? 0)) * nx + ((bV?.vy ?? 0) - (aV?.vy ?? 0)) * ny;
            if (rvn < 0) {
              const j = -rvn / invSum;
              if (aV) {
                aV.vx -= j * invA * nx;
                aV.vy -= j * invA * ny;
              }
              if (bV) {
                bV.vx += j * invB * nx;
                bV.vy += j * invB * ny;
              }
            }

            // 2) 位置修正（全量，按逆质量分摊）。
            const corr = depth / invSum;
            aT.x -= nx * corr * invA;
            aT.y -= ny * corr * invA;
            bT.x += nx * corr * invB;
            bT.y += ny * corr * invB;
          }
        }
      },
    },
  ],
});
