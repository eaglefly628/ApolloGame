import { defineCapability } from '@engine/core/define-capability.js';
import type { IWorld, Component } from '@engine/core/types.js';

// ── Components ──

export interface Health extends Component {
  readonly type: 'Health';
  current: number;
  max: number;
}

export interface Dead extends Component {
  readonly type: 'Dead';
}

// ── Capability Definition ──

export const healthCapability = defineCapability({
  id: 'health',
  version: '0.1.0',

  describe: {
    name: 'Health',
    summary: '生命值管理系统。消费 HealthModifyEvent，更新 Health，归零则标记 Dead。',
    semantic: ['resource', 'health', 'core'],
    whenToUse: '任何需要生命值的实体。所有"活着"的角色都应该有 Health。',
    examples: ['玩家角色', 'Boss', 'NPC', '可破坏物体'],
  },

  components: {
    provides: {
      Health: {
        category: 'resource',
        describe: '生命值资源。current/max 结构，可被 status-bar 等通用 UI 读取。',
        fields: {
          current: { type: 'number', describe: '当前生命值' },
          max: { type: 'number', describe: '最大生命值' },
        },
      },
      Dead: {
        category: 'marker',
        describe: '生命值归零标记。存在即表示实体已死亡。',
        fields: {},
      },
    },
    reads: ['HealthModifyEvent'],
    writes: ['Health', 'Dead'],
    consumes: ['HealthModifyEvent'],
  },

  config: {
    maxHealth: {
      type: 'number',
      default: 100,
      describe: '实体的最大生命值',
      question: '最大生命值是多少？',
      ui: { control: 'slider', min: 10, max: 2000, step: 10 },
    },
  },

  systems: [
    {
      id: 'health.apply',
      reads: ['Health', 'HealthModifyEvent'],
      writes: ['Health', 'Dead'],
      consumes: ['HealthModifyEvent'],

      execute(world: IWorld): void {
        const entities = world.query('Health', 'HealthModifyEvent');

        for (const [entityId, comps] of entities) {
          const health = comps.get('Health') as Health;
          const event = comps.get('HealthModifyEvent') as Component & { amount: number };

          const newCurrent = Math.max(0, Math.min(health.max, health.current + event.amount));

          world.addComponent(entityId, {
            type: 'Health',
            current: newCurrent,
            max: health.max,
          } as Health);

          if (newCurrent <= 0 && !world.hasComponent(entityId, 'Dead')) {
            world.addComponent(entityId, { type: 'Dead' } as Dead);
          }

          if (newCurrent > 0 && world.hasComponent(entityId, 'Dead')) {
            world.removeComponent(entityId, 'Dead');
          }
        }
      },
    },
  ],
});
