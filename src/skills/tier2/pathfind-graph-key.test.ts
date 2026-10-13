import { describe, expect, it } from 'vitest';
import type { NavGraph } from '@engine/protocol/components.js';
import { exactGraphKey, clearGraphKeyCache } from './pathfind-graph-key.js';

const graph = (): NavGraph => ({
  type: 'NavGraph', nodes: [{ x: .5, y: .5 }, { x: 1.5, y: .5 }], edges: [{ a: 0, b: 1 }],
  grid: { originX: 0, originY: 0, cellSize: 1, cols: 2, rows: 1, blocked: [0, 0], cost: [1, 1] },
});

describe('navigation graph semantic identity', () => {
  it('is independent of object construction order, bake hints and cache lifetime', () => {
    const a = graph();
    const b = { grid: { ...a.grid!, bakeKey: 'stale hint' }, edges: [{ b: 1, a: 0, cost: undefined }], nodes: [{ y: .5, x: .5 }, { y: .5, x: 1.5 }], type: 'NavGraph' } as NavGraph;
    const key = exactGraphKey(a);
    expect(exactGraphKey(b)).toBe(key);
    clearGraphKeyCache();
    expect(exactGraphKey(JSON.parse(JSON.stringify(a)))).toBe(key);
  });

  it('detects in-place connectivity, geometry and terrain edits with warmed caches', () => {
    const edits: Array<(g: NavGraph) => void> = [
      g => { g.edges.length = 0; },
      g => { g.edges[0].cost = 4; },
      g => { g.nodes[1].x = 1.75; },
      g => { g.grid!.blocked[1] = 1; },
      g => { g.grid!.cost[1] = 9; },
      g => { g.grid!.originY = -1; },
    ];
    for (const edit of edits) {
      const g = graph(), before = exactGraphKey(g);
      edit(g);
      const warm = exactGraphKey(g);
      expect(warm).not.toBe(before);
      clearGraphKeyCache();
      expect(exactGraphKey(g)).toBe(warm);
    }
  });
});
