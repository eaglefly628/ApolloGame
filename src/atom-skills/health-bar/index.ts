import { defineCapability } from '@engine/core/define-capability.js';
import type { IWorld, Component } from '@engine/core/types.js';

// ── Components ──

export interface BarDisplay extends Component {
  readonly type: 'BarDisplay';
  percentage: number;
  color: string;
  label: string;
  current: number;
  max: number;
}

// ── Capability Definition ──

const BAR_GREEN = '#22c55e';
const BAR_YELLOW = '#eab308';
const BAR_RED = '#ef4444';

export const healthBarCapability = defineCapability({
  id: 'health-bar',
  version: '0.1.0',

  describe: {
    name: 'Health Bar',
    summary: '读取 Health 数据，生成 BarDisplay 渲染组件供 UI 层显示生命条。',
    semantic: ['render', 'ui', 'health-display'],
    whenToUse: '需要在屏幕上显示实体生命值条时使用。',
    examples: ['玩家血条', 'Boss 血条', 'NPC 头顶血条'],
  },

  components: {
    provides: ['BarDisplay'],
    reads: ['Health'],
    writes: ['BarDisplay'],
    consumes: [],
  },

  config: {
    barColor: {
      type: 'string',
      default: BAR_GREEN,
      describe: '满血时的颜色',
      question: '血条满血时显示什么颜色？',
      ui: { control: 'input' },
    },
    lowColor: {
      type: 'string',
      default: BAR_RED,
      describe: '低血量时的颜色',
      question: '血条低血量时显示什么颜色？',
      ui: { control: 'input' },
    },
    lowThreshold: {
      type: 'number',
      default: 0.3,
      describe: '低血量阈值 (0-1)',
      question: '血量低于百分之多少变色？',
      ui: { control: 'slider', min: 0.1, max: 0.5, step: 0.05 },
    },
  },

  systems: [
    {
      id: 'health-bar.render',
      reads: ['Health'],
      writes: ['BarDisplay'],
      consumes: [],

      execute(world: IWorld): void {
        const entities = world.query('Health');

        for (const [entityId, comps] of entities) {
          const health = comps.get('Health') as Component & { current: number; max: number };
          const percentage = health.max > 0 ? health.current / health.max : 0;

          let color = BAR_GREEN;
          if (percentage <= 0.3) color = BAR_RED;
          else if (percentage <= 0.6) color = BAR_YELLOW;

          world.addComponent(entityId, {
            type: 'BarDisplay',
            percentage,
            color,
            label: 'HP',
            current: health.current,
            max: health.max,
          } as BarDisplay);
        }
      },
    },
  ],
});
