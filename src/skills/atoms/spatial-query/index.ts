import { defineCapability } from '@engine/core/define-capability.js';
import type { IWorld, EntityId } from '@engine/core/types.js';
import type { SpatialIndex, Transform } from '@engine/protocol/components.js';

export type { SpatialIndex };

// 范围查询：返回 (x,y) 半径 radius 内、拥有 Transform 的实体。
export function queryRange(world: IWorld, x: number, y: number, radius: number): EntityId[] {
  const r2 = radius * radius;
  const out: EntityId[] = [];
  for (const [id] of world.query('Transform')) {
    const t = world.getComponent<Transform>(id, 'Transform')!;
    const dx = t.x - x;
    const dy = t.y - y;
    if (dx * dx + dy * dy <= r2) out.push(id);
  }
  return out;
}

// 最近邻查询：返回离 (x,y) 最近的 count 个实体（按距离升序），可排除某 id。
export function queryNearest(world: IWorld, x: number, y: number, count: number, excludeId?: EntityId): EntityId[] {
  const scored: Array<{ id: EntityId; d2: number }> = [];
  for (const [id] of world.query('Transform')) {
    if (id === excludeId) continue;
    const t = world.getComponent<Transform>(id, 'Transform')!;
    const dx = t.x - x;
    const dy = t.y - y;
    scored.push({ id, d2: dx * dx + dy * dy });
  }
  scored.sort((a, b) => a.d2 - b.d2);
  return scored.slice(0, count).map((s) => s.id);
}

export const spatialQueryCapability = defineCapability({
  id: 'w2-spatial-query',
  version: '1.0.0',

  describe: {
    name: 'spatial-query',
    summary: '空间查询服务：范围、最近邻（overlap-detect 回答不了的"A 到 B 之间有什么"）。',
    semantic: ['world-service', 'query'],
    whenToUse:
      'AI 视线、自动索敌、范围技能需要"半径内有谁/最近的 N 个是谁"。SpatialIndex 挂在 world 实体声明服务；系统通过 queryRange / queryNearest 查询。当前为暴力实现，cellSize/kind 为后续网格/四叉树加速预留。',
    examples: ['自动索敌：queryNearest(world, x, y, 1, self)', '范围 AOE：queryRange(world, x, y, 100)', 'AI 警戒：queryRange 判断玩家是否进入视野'],
  },

  components: {
    provides: {
      SpatialIndex: {
        category: 'config',
        describe: '空间查询服务配置。cellSize/kind 为加速结构预留；查询经 queryRange/queryNearest 暴露。',
        fields: {
          cellSize: { type: 'number', describe: '网格单元大小（加速结构用）' },
          kind: { type: 'string', describe: "索引类型：'grid' | 'quadtree'" },
        },
      },
    },
    reads: ['Transform'],
    writes: [],
    consumes: [],
  },

  config: {
    cellSize: { type: 'number', default: 64, describe: '网格单元大小', question: '空间网格单元多大？', ui: { control: 'slider', min: 1, max: 1024, step: 1 } },
    kind: { type: 'select', default: 'grid', describe: '索引类型', question: '用哪种空间索引？', ui: { control: 'chips', options: ['grid', 'quadtree'] } },
  },

  systems: [],
});
