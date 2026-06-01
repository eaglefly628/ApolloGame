import { defineCapability } from '@engine/core/define-capability.js';
import type { IWorld, Component } from '@engine/core/types.js';

// ── Components ──

export interface StatusBarSource extends Component {
  readonly type: 'StatusBarSource';
  readonly sourceComponent: string;
  readonly label: string;
  readonly highColor: string;
  readonly midColor: string;
  readonly lowColor: string;
  readonly lowThreshold: number;
  readonly midThreshold: number;
}

export interface BarDisplay extends Component {
  readonly type: 'BarDisplay';
  percentage: number;
  color: string;
  label: string;
  current: number;
  max: number;
}

// ── Capability Definition ──

export const statusBarCapability = defineCapability({
  id: 'status-bar',
  version: '0.1.0',

  describe: {
    name: 'Status Bar',
    summary: '通用状态条。读取任何 current/max 资源组件，生成 BarDisplay 渲染数据。可用于 HP、MP、体力、经验值等。',
    semantic: ['render', 'ui', 'bar', 'generic'],
    whenToUse: '需要用条形 UI 展示任何 current/max 数值时使用。',
    examples: ['生命条', '魔法条', '体力条', '经验条', 'Boss 血条', '充能条'],
  },

  components: {
    provides: ['BarDisplay', 'StatusBarSource'],
    reads: ['StatusBarSource'],
    writes: ['BarDisplay'],
    consumes: [],
  },

  config: {
    highColor: {
      type: 'string',
      default: '#22c55e',
      describe: '数值充足时的颜色',
      question: '条形在数值充足时显示什么颜色？',
      ui: { control: 'input' },
    },
    midColor: {
      type: 'string',
      default: '#eab308',
      describe: '数值中等时的颜色',
      question: '条形在数值中等时显示什么颜色？',
      ui: { control: 'input' },
    },
    lowColor: {
      type: 'string',
      default: '#ef4444',
      describe: '数值不足时的颜色',
      question: '条形在数值不足时显示什么颜色？',
      ui: { control: 'input' },
    },
    lowThreshold: {
      type: 'number',
      default: 0.3,
      describe: '低于此百分比变为低值颜色',
      question: '数值低于百分之多少变为警告色？',
      ui: { control: 'slider', min: 0.05, max: 0.5, step: 0.05 },
    },
  },

  systems: [
    {
      id: 'status-bar.sync',
      reads: ['StatusBarSource'],
      writes: ['BarDisplay'],
      consumes: [],

      execute(world: IWorld): void {
        const entities = world.query('StatusBarSource');

        for (const [entityId, comps] of entities) {
          const source = comps.get('StatusBarSource') as StatusBarSource;
          const resource = comps.get(source.sourceComponent) as Component & { current: number; max: number } | undefined;
          if (!resource) continue;

          const percentage = resource.max > 0 ? resource.current / resource.max : 0;

          let color = source.highColor;
          if (percentage <= source.lowThreshold) color = source.lowColor;
          else if (percentage <= source.midThreshold) color = source.midColor;

          world.addComponent(entityId, {
            type: 'BarDisplay',
            percentage,
            color,
            label: source.label,
            current: resource.current,
            max: resource.max,
          } as BarDisplay);
        }
      },
    },
  ],
});
