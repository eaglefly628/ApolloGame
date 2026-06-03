import { defineCapability } from '@engine/core/define-capability.js';
import { SystemPhase } from '@engine/core/types.js';
import type { Transform, Velocity, Overlap } from '@engine/protocol/components.js';

// 把朝"侵入"方向的速度分量清零：落地 → vy 归零，撞墙 → vx 归零。
// n 为分离法线，intoSign=+1 表示"侵入方向"是 +n，-1 表示 -n。任意法线通用（box/circle）。
function killIntoVelocity(v: Velocity, nx: number, ny: number, intoSign: number): void {
  const vn = v.vx * nx + v.vy * ny; // 速度在法线上的投影
  if (vn * intoSign > 0) {
    v.vx -= vn * nx;
    v.vy -= vn * ny;
  }
}

// Tier 2 涌现（规则与约束）：读 overlap-detect 产出的 Overlap，把动态实体沿分离法线推出
// 穿透深度，并清零朝法线的侵入速度（落地/撞墙即停）。这是 overlap-detect 注释里
// 预留的"响应消费者"。动/静判定：有 Velocity = 动态，无 Velocity = 静态墙地。
// 最小形态：动态-静态完整解算；动态-动态仅对称分离不改速度。
//
// 必须在 Resolve 阶段：它写 Transform 而 overlap-detect 读 Transform，纯组件拓扑会判成环；
// phase 把"先检测后解算"显式表达出来。不 consume Overlap —— 其生命周期由 overlap-detect
// 每帧销毁+重建管理（consume 会让重建时 createEntity 撞已存在实体）。
export const collisionResolveCapability = defineCapability({
  id: 't2-collision-resolve',
  version: '1.0.0',

  describe: {
    name: 'collision-resolve',
    summary: '读 Overlap 把动态实体推出静态实体，并清零侵入速度（落地/撞墙）。',
    semantic: ['tier2', 'collision', 'resolution'],
    whenToUse: '需要实体不穿墙、能站在地面上时。读 Overlap + Transform + Velocity，写 Transform + Velocity，跑在 Resolve 阶段。',
    examples: ['玩家落在平台上 → vy 归零', '撞墙停住 → vx 归零', '两动态体相撞 → 对称推开'],
  },

  components: {
    provides: {},
    reads: ['Overlap', 'Transform', 'Velocity'],
    writes: ['Transform', 'Velocity'],
    consumes: [],
  },

  config: {},

  systems: [
    {
      id: 'collision-resolve',
      phase: SystemPhase.Resolve,
      reads: ['Overlap', 'Transform', 'Velocity'],
      writes: ['Transform', 'Velocity'],
      consumes: [],
      execute(world) {
        for (const [oid] of world.query('Overlap')) {
          const o = world.getComponent<Overlap>(oid, 'Overlap')!;
          const aT = world.getComponent<Transform>(o.entityA, 'Transform');
          const bT = world.getComponent<Transform>(o.entityB, 'Transform');
          if (!aT || !bT) continue;

          // 法线 n 从 A 指向 B。Velocity 存在 = 动态。
          const aV = world.getComponent<Velocity>(o.entityA, 'Velocity');
          const bV = world.getComponent<Velocity>(o.entityB, 'Velocity');
          const nx = o.normalX;
          const ny = o.normalY;
          const d = o.depth;

          if (aV && !bV) {
            // A 动 B 静：把 A 沿 -n 推出（远离 B），清零 A 朝 +n 的侵入速度。
            aT.x -= nx * d;
            aT.y -= ny * d;
            killIntoVelocity(aV, nx, ny, +1);
          } else if (bV && !aV) {
            // B 动 A 静：把 B 沿 +n 推出，清零 B 朝 -n 的侵入速度。
            bT.x += nx * d;
            bT.y += ny * d;
            killIntoVelocity(bV, nx, ny, -1);
          } else if (aV && bV) {
            // 动态-动态：各推一半，速度暂不处理（最小形态）。
            aT.x -= nx * d * 0.5;
            aT.y -= ny * d * 0.5;
            bT.x += nx * d * 0.5;
            bT.y += ny * d * 0.5;
          }
          // 双静态：忽略。
        }
      },
    },
  ],
});
