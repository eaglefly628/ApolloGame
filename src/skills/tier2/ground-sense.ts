import { defineCapability } from '@engine/core/define-capability.js';
import type { Overlap, Grounded } from '@engine/protocol/components.js';

// Tier 2 涌现（感知）：读 overlap-detect 产出的 Overlap，若动态实体被"向上"分离（脚下有地面），
// 给它打 Grounded 标记。每帧重算（先清后标）。与 collision-resolve 并列，都是 Overlap 的消费者、
// 互不依赖 —— 同一份检测事实，一个用来推开、一个用来感知。
//
// 跑在 Update：只写 Grounded、不碰 Transform，组件拓扑自动把它排到 overlap-detect 之后。
// 约定：有 Velocity = 动态，无 Velocity = 静态地面；up = -y（重力为 +y），故法线朝下(ny>0)推开 A、
// 或法线朝上(ny<0)推开 B，都表示对应动态体脚下踩到了静态体。阈值 0.5 滤掉墙面(ny≈0)。
export const groundSenseCapability = defineCapability({
  id: 't2-ground-sense',
  version: '1.0.0',

  describe: {
    name: 'ground-sense',
    summary: '读 Overlap，给"脚下踩到静态地面"的动态实体打 Grounded 标记（每帧重算）。',
    semantic: ['tier2', 'collision', 'sensing'],
    whenToUse: '需要知道实体是否站在地面上时（跳跃、地面/空中动画、摩擦的前置）。读 Overlap+Velocity，写 Grounded。',
    examples: ['起跳前判断是否着地', '离地即切换下落动画', '只有着地才能跳'],
  },

  components: {
    provides: {
      Grounded: {
        category: 'marker',
        describe: '实体这帧站在地面上。存在即着地，每帧由 ground-sense 先清后标。',
        fields: {},
      },
    },
    reads: ['Overlap', 'Velocity'],
    writes: ['Grounded'],
    consumes: [],
  },

  config: {},

  systems: [
    {
      id: 'ground-sense',
      reads: ['Overlap', 'Velocity'],
      writes: ['Grounded'],
      consumes: [],
      execute(world) {
        // 每帧重算：先清掉上一帧的 Grounded。
        for (const [id] of world.query('Grounded')) world.removeComponent(id, 'Grounded');

        for (const [oid] of world.query('Overlap')) {
          const o = world.getComponent<Overlap>(oid, 'Overlap')!;
          const aDyn = world.hasComponent(o.entityA, 'Velocity');
          const bDyn = world.hasComponent(o.entityB, 'Velocity');
          // 法线 A→B。动态体被"向上"推（up=-y）即视为踩在对方（静态地面）上。
          if (aDyn && !bDyn && o.normalY > 0.5) {
            world.addComponent(o.entityA, { type: 'Grounded' } as Grounded);
          } else if (bDyn && !aDyn && o.normalY < -0.5) {
            world.addComponent(o.entityB, { type: 'Grounded' } as Grounded);
          }
        }
      },
    },
  ],
});
