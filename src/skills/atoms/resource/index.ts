import { defineCapability } from '@engine/core/define-capability.js';
import type { Resource, ResourceModify } from '@engine/protocol/components.js';

export const resourceCapability = defineCapability({
  id: 'f1-resource',
  version: '1.0.0',

  describe: {
    name: 'resource',
    summary: '某种有上下限的数值（hp / mp / stamina / shield / ...），支持通过事件组件修改。',
    semantic: ['numeric', 'clamped', 'stat', 'resource'],
    whenToUse: '当实体需要跟踪任何带上下限的数值时使用，例如生命值、法力值、耐力、护盾等。min 可为非零（如温度下限 -50）。',
    examples: [
      '角色生命值：Resource { id: "hp", current: 100, min: 0, max: 100 }',
      '法力值：Resource { id: "mp", current: 50, min: 0, max: 100 }',
      '温度：Resource { id: "temp", current: 20, min: -50, max: 100 }',
      '受伤：ResourceModify { resourceId: "hp", amount: -10 }',
      '治疗：ResourceModify { resourceId: "hp", amount: 25 }',
    ],
  },

  components: {
    provides: {
      Resource: {
        category: 'resource',
        describe: '持久有界数值，用 id 区分语义（hp / mp / ...）。每实体每 type 唯一，一个实体一个 Resource。',
        fields: {
          id: { type: 'string', describe: '资源语义标识（如 "hp"、"mp"、"stamina"）' },
          current: { type: 'number', describe: '当前值，始终保持在 [min, max] 范围内' },
          min: { type: 'number', describe: '允许的最小值，可为非零（如 -50）' },
          max: { type: 'number', describe: '允许的最大值' },
        },
      },
      ResourceModify: {
        category: 'event',
        describe: '请求修改指定 id 资源的一次性事件，执行后由 World 自动删除。',
        fields: {
          resourceId: { type: 'string', describe: '目标资源的 id，与 Resource.id 匹配' },
          amount: { type: 'number', describe: '修改量，正数增加，负数减少' },
        },
      },
    },
    reads: ['Resource'],
    writes: ['Resource'],
    consumes: ['ResourceModify'],
  },

  config: {
    id: {
      type: 'string',
      default: 'hp',
      describe: '资源语义标识',
      question: '这个资源代表什么？（如 hp、mp、stamina）',
      ui: { control: 'input' },
    },
    current: {
      type: 'number',
      default: 100,
      describe: '初始当前值',
      question: '初始值是多少？',
      ui: { control: 'slider', min: 0, max: 1000, step: 1 },
    },
    min: {
      type: 'number',
      default: 0,
      describe: '最小值下限',
      question: '最小值是多少？',
      ui: { control: 'input' },
    },
    max: {
      type: 'number',
      default: 100,
      describe: '最大值上限',
      question: '最大值是多少？',
      ui: { control: 'slider', min: 1, max: 10000, step: 1 },
    },
  },

  systems: [
    {
      id: 'resource-apply',
      reads: ['Resource'],
      writes: ['Resource'],
      consumes: ['ResourceModify'],
      execute(world) {
        for (const [entityId] of world.query('Resource', 'ResourceModify')) {
          const resource = world.getComponent<Resource>(entityId, 'Resource');
          const modify = world.getComponent<ResourceModify>(entityId, 'ResourceModify');
          if (!resource || !modify) continue;
          if (modify.resourceId !== resource.id) continue;
          const next = resource.current + modify.amount;
          resource.current = next < resource.min ? resource.min : next > resource.max ? resource.max : next;
        }
      },
    },
  ],
});
