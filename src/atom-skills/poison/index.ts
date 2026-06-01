import { defineCapability } from '@engine/core/define-capability.js';
import type { IWorld, Component } from '@engine/core/types.js';

// ── Components ──

export interface Poisoned extends Component {
  readonly type: 'Poisoned';
  damagePerTick: number;
  remainingTicks: number;
}

// ── Capability Definition ──

export const poisonCapability = defineCapability({
  id: 'poison',
  version: '0.1.0',

  describe: {
    name: 'Poison',
    summary: '中毒效果。每帧对有 Poisoned 标记的实体产生 HealthModifyEvent 持续扣血，倒计时结束后自动移除。',
    semantic: ['debuff', 'dot', 'damage-over-time'],
    whenToUse: '需要持续伤害效果时使用，如中毒、灼烧、流血。',
    examples: ['毒蛇攻击附带中毒', '沼泽地形持续掉血', '毒药道具'],
  },

  components: {
    provides: {
      Poisoned: {
        category: 'marker',
        describe: '中毒状态标记。存在即表示实体正在中毒，每帧产生伤害事件。倒计时归零后自动移除。',
        fields: {
          damagePerTick: { type: 'number', describe: '每帧伤害量' },
          remainingTicks: { type: 'number', describe: '剩余持续帧数' },
        },
      },
    },
    reads: ['Poisoned'],
    writes: ['HealthModifyEvent', 'Poisoned'],
    consumes: [],
  },

  config: {
    damagePerTick: {
      type: 'number',
      default: 3,
      describe: '每帧中毒伤害',
      question: '中毒每帧扣多少血？',
      ui: { control: 'slider', min: 1, max: 50, step: 1 },
    },
    duration: {
      type: 'number',
      default: 60,
      describe: '中毒持续帧数',
      question: '中毒持续多少帧？',
      ui: { control: 'slider', min: 10, max: 300, step: 10 },
    },
  },

  systems: [
    {
      id: 'poison.tick',
      reads: ['Poisoned'],
      writes: ['HealthModifyEvent', 'Poisoned'],
      consumes: [],

      execute(world: IWorld): void {
        const entities = world.query('Poisoned');

        for (const [entityId, comps] of entities) {
          const poison = comps.get('Poisoned') as Poisoned;

          if (poison.remainingTicks <= 0) {
            world.removeComponent(entityId, 'Poisoned');
            continue;
          }

          world.addComponent(entityId, {
            type: 'HealthModifyEvent',
            amount: -poison.damagePerTick,
          } as Component & { amount: number });

          world.addComponent(entityId, {
            type: 'Poisoned',
            damagePerTick: poison.damagePerTick,
            remainingTicks: poison.remainingTicks - 1,
          } as Poisoned);
        }
      },
    },
  ],
});
