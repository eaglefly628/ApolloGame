import { defineCapability } from '@engine/core/define-capability.js';
import type { IWorld, Component } from '@engine/core/types.js';

// ── Components ──

export interface Shield extends Component {
  readonly type: 'Shield';
  current: number;
  max: number;
}

// ── Capability Definition ──

export const shieldCapability = defineCapability({
  id: 'shield',
  version: '0.1.0',

  describe: {
    name: 'Shield',
    summary: '护盾系统。拦截 HealthModifyEvent 中的伤害部分，用 Shield 资源吸收后将剩余伤害写回。治疗事件不拦截。',
    semantic: ['resource', 'defense', 'absorb', 'interceptor'],
    whenToUse: '需要在伤害到达 Health 之前进行吸收/减免时使用。',
    examples: ['魔法护盾', '能量护盾', '临时护甲'],
  },

  components: {
    provides: {
      Shield: {
        category: 'resource',
        describe: '护盾资源。current/max 结构，吸收伤害直到归零。可被 status-bar 通用显示。',
        fields: {
          current: { type: 'number', describe: '当前护盾值' },
          max: { type: 'number', describe: '最大护盾值' },
        },
      },
    },
    reads: ['HealthModifyEvent', 'Shield'],
    writes: ['HealthModifyEvent', 'Shield'],
    consumes: [],
  },

  config: {
    maxShield: {
      type: 'number',
      default: 50,
      describe: '最大护盾值',
      question: '护盾最多能吸收多少伤害？',
      ui: { control: 'slider', min: 10, max: 500, step: 10 },
    },
  },

  systems: [
    {
      id: 'shield.absorb',
      reads: ['HealthModifyEvent', 'Shield'],
      writes: ['HealthModifyEvent', 'Shield'],
      consumes: [],

      execute(world: IWorld): void {
        const entities = world.query('Shield', 'HealthModifyEvent');

        for (const [entityId, comps] of entities) {
          const shield = comps.get('Shield') as Shield;
          const event = comps.get('HealthModifyEvent') as Component & { amount: number };

          // Only intercept damage (negative amount), let heals pass through
          if (event.amount >= 0) continue;

          const damage = Math.abs(event.amount);
          const absorbed = Math.min(damage, shield.current);
          const remaining = damage - absorbed;

          world.addComponent(entityId, {
            type: 'Shield',
            current: shield.current - absorbed,
            max: shield.max,
          } as Shield);

          world.addComponent(entityId, {
            type: 'HealthModifyEvent',
            amount: remaining > 0 ? -remaining : 0,
          } as Component & { amount: number });
        }
      },
    },
  ],
});
