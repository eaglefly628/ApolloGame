// game211 · 群体寻路选型压测（owner 2026-08-10「我可能要考虑一些群体 AI 寻路的算法，帮我做个调研」）。
//
// 调研不能靠读代码下结论，**选型必须有数**。这里量两条路在**我们的真实规模**下的开销：
//   ① A*-per-agent —— 本仓现成的 `t2-pathfind`（NavGraph + 通用 A*，路径缓存进 NavPath）
//   ② Flow Field   —— 参考实现（本文件内的纯函数·**不入产物**，只为量成本）：
//                     从目标点做一次 Dijkstra 铺满全图 → 每格存一个方向 → 每个单位 O(1) 查表
//
// 为什么要比这两条：这是大规模 RTS 寻路的分水岭。
//   A* 的成本 ∝ **单位数 × 图规模**；流场的成本 ∝ **图规模**（与单位数**无关**），
//   代价是「一个场只服务一个目标」。我们的场景恰好是「上千单位涌向少数几个目标」——
//   若实测支持，流场就是对症的那一个。
//
// ⚠ 本仓 A* 的 open 表是**线性扫描取 min + `open.find()` 做 decrease-key**
//   （`src/engine/spatial/astar.ts:30-50`，源码自注「小图用数组」）→ 单次查询 ~O(V²)。
//   这不是黑本仓：小图上它更快也更确定。但它把「图能多大」这条约束摆到了台面上，必须量出来。
import { describe, it, expect } from 'vitest';
import { Engine } from '@zerocraft/engine/runtime/engine.js';
import { transformCapability, velocityCapability, relationCapability } from '@zerocraft/engine/atom-skills/index.js';
import { motionApplyCapability } from '@zerocraft/engine/skills/tier1/index.js';
import { pathfindCapability } from '@zerocraft/engine/skills/tier2/index.js';
import type { Component } from '@zerocraft/engine/engine/core/types.js';

const SAFE_MS = 16.7 / 3;   // sim 安全线（与 cannon-army-bench / slg-scale 同口径）

/** 建一张 `side × side` 的四连通网格 NavGraph（节点数 = side²）。 */
function gridNav(side: number, spacing: number): { nodes: Array<{ x: number; y: number }>; edges: Array<{ a: number; b: number }> } {
  const nodes: Array<{ x: number; y: number }> = [];
  for (let j = 0; j < side; j++) for (let i = 0; i < side; i++) nodes.push({ x: (i - side / 2) * spacing, y: (j - side / 2) * spacing });
  const edges: Array<{ a: number; b: number }> = [];
  const idx = (i: number, j: number): number => j * side + i;
  for (let j = 0; j < side; j++) for (let i = 0; i < side; i++) {
    if (i + 1 < side) edges.push({ a: idx(i, j), b: idx(i + 1, j) });
    if (j + 1 < side) edges.push({ a: idx(i, j), b: idx(i, j + 1) });
  }
  return { nodes, edges };
}

/** ① A*-per-agent：真引擎能力（t2-pathfind）。 */
function buildAstarWorld(agents: number, side: number): Engine {
  const engine = new Engine();
  engine.load({
    capabilities: [transformCapability, velocityCapability, relationCapability, motionApplyCapability, pathfindCapability],
    entities: {},
  });
  const w = engine.world;
  const nav = gridNav(side, 4);
  w.createEntity('nav');
  w.addComponent('nav', { type: 'NavGraph', nodes: nav.nodes, edges: nav.edges } as unknown as Component);
  // 目标：地图一角（最坏情况——路径最长，A* 展开最多）
  w.createEntity('goal');
  w.addComponent('goal', { type: 'Transform', x: nav.nodes[nav.nodes.length - 1]!.x, y: nav.nodes[nav.nodes.length - 1]!.y, rotation: 0, scaleX: 1, scaleY: 1 } as unknown as Component);
  for (let k = 0; k < agents; k++) {
    const id = `a${k}`;
    const n0 = nav.nodes[k % Math.min(nav.nodes.length, 64)]!;   // 起点挤在另一角
    w.createEntity(id);
    w.addComponent(id, { type: 'Transform', x: n0.x, y: n0.y, rotation: 0, scaleX: 1, scaleY: 1 } as unknown as Component);
    w.addComponent(id, { type: 'Velocity', vx: 0, vy: 0 } as unknown as Component);
    w.addComponent(id, { type: 'Relation', kind: 'target', targetId: 'goal' } as unknown as Component);
    w.addComponent(id, { type: 'NavAgent', speed: 0.2, arriveRange: 1 } as unknown as Component);
  }
  return engine;
}

/** ② Flow Field 参考实现（**纯函数·只为量成本·不入产物**）。
 *  从 goal 做一次 Dijkstra 铺满全图 → 每个节点记「下一跳」→ 单位查表 O(1)。
 *  这里用二叉堆，避免拿本仓 A* 的线性 open 表去比（那样比的是数据结构不是算法）。 */
function buildFlowField(side: number, goalIdx: number): Int32Array {
  const n = side * side;
  const dist = new Float64Array(n).fill(Infinity);
  const next = new Int32Array(n).fill(-1);
  dist[goalIdx] = 0;
  // 简易二叉堆
  const heap: number[] = [goalIdx];
  const key = (i: number): number => dist[i]!;
  const push = (v: number): void => { heap.push(v); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (key(heap[p]!) <= key(heap[c]!)) break; [heap[p], heap[c]] = [heap[c]!, heap[p]!]; c = p; } };
  const pop = (): number => { const top = heap[0]!; const last = heap.pop()!; if (heap.length) { heap[0] = last; let p = 0; for (;;) { const l = p * 2 + 1, r = l + 1; let m = p; if (l < heap.length && key(heap[l]!) < key(heap[m]!)) m = l; if (r < heap.length && key(heap[r]!) < key(heap[m]!)) m = r; if (m === p) break; [heap[p], heap[m]] = [heap[m]!, heap[p]!]; p = m; } } return top; };
  const nbrs = (i: number): number[] => {
    const x = i % side, y = (i / side) | 0, out: number[] = [];
    if (x > 0) out.push(i - 1); if (x + 1 < side) out.push(i + 1);
    if (y > 0) out.push(i - side); if (y + 1 < side) out.push(i + side);
    return out;
  };
  while (heap.length) {
    const cur = pop();
    const d = dist[cur]!;
    for (const nb of nbrs(cur)) {
      const nd = d + 1;
      if (nd < dist[nb]!) { dist[nb] = nd; next[nb] = cur; push(nb); }
    }
  }
  return next;   // next[i] = 从 i 出发朝目标走的下一格
}

function bench(fn: () => void, times: number): { mean: number; p95: number } {
  const t: number[] = [];
  for (let i = 0; i < times; i++) { const t0 = performance.now(); fn(); t.push(performance.now() - t0); }
  const s = [...t].sort((a, b) => a - b);
  return { mean: t.reduce((a, b) => a + b, 0) / t.length, p95: s[Math.min(s.length - 1, Math.floor(s.length * 0.95))]! };
}

describe('群体寻路选型 · A*-per-agent vs Flow Field（实测·非估算）', () => {
  it('① A*-per-agent：首拍（全体同时求路）与稳态（走缓存路径）', () => {
    const rows: string[] = [];
    for (const [agents, side] of [[200, 24], [500, 24], [1000, 24], [500, 48]] as const) {
      const engine = buildAstarWorld(agents, side);
      const first = bench(() => engine.world.tick(), 1);            // 首拍：所有 agent 都要跑一次 A*
      const steady = bench(() => engine.world.tick(), 30);          // 稳态：路径已缓存在 NavPath
      rows.push(`${String(agents).padStart(4)} 单位 / ${side}×${side}=${side * side} 节点 → `
        + `首拍 ${first.mean.toFixed(1)}ms · 稳态 ${steady.mean.toFixed(2)}ms/tick (p95 ${steady.p95.toFixed(2)})`);
    }
    console.info('[pf/astar] A*-per-agent（本仓 t2-pathfind·NavGraph）\n  %s', rows.join('\n  '));
    expect(rows).toHaveLength(4);
  });

  it('② Flow Field：一次铺场的成本（与单位数**无关**）', () => {
    const rows: string[] = [];
    for (const side of [24, 48, 96, 192] as const) {
      const b = bench(() => buildFlowField(side, side * side - 1), 5);
      rows.push(`${side}×${side} = ${String(side * side).padStart(6)} 节点 → 铺场 ${b.mean.toFixed(2)}ms（**一次服务全部单位**）`);
    }
    console.info('[pf/flow] Flow Field（Dijkstra 铺满 + 每单位 O(1) 查表）\n  %s', rows.join('\n  '));
    expect(rows).toHaveLength(4);
  });

  it('③ 查表本身的成本：N 个单位各查一次方向', () => {
    const side = 96;
    const field = buildFlowField(side, side * side - 1);
    for (const n of [1000, 4000] as const) {
      const cells = Array.from({ length: n }, (_, i) => (i * 7919) % (side * side));
      const b = bench(() => { let acc = 0; for (const c of cells) acc += field[c]!; if (acc === -12345) throw new Error('x'); }, 20);
      console.info('[pf/lookup] %d 单位查表 → %sms/tick', n, b.mean.toFixed(4));
    }
    expect(field.length).toBe(side * side);
  });
});
