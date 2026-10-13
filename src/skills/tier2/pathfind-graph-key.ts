import type { NavGraph } from '@engine/protocol/components.js';
import { validNavigationGrid } from './navigation-grid.js';

export function validExplicitGraph(nav: NavGraph): boolean {
  return Array.isArray(nav.nodes) && Array.isArray(nav.edges)
    && nav.nodes.every(n => n && Number.isFinite(n.x) && Number.isFinite(n.y))
    && nav.edges.every(e => e && Number.isInteger(e.a) && Number.isInteger(e.b) && e.a >= 0 && e.b >= 0
      && e.a < nav.nodes.length && e.b < nav.nodes.length && (e.cost === undefined || (Number.isFinite(e.cost) && e.cost > 0)))
    && (!nav.grid || (Array.isArray(nav.grid.blocked) && Array.isArray(nav.grid.cost)
      && validNavigationGrid({ type: 'NavigationGrid', ...nav.grid })));
}

let observedGraphs = new WeakMap<NavGraph, { snapshot: NavGraph; key: string }>();
export function clearGraphKeyCache(): void { observedGraphs = new WeakMap(); }

/** Object identity is only a lookup hint. Every semantic scalar/array element is
 * compared with an independent immutable copy before reusing its exact key. Thus
 * in-place edits, restored worlds and cache clearing produce the same result. */
export function exactGraphKey(graph: NavGraph): string {
  const old = observedGraphs.get(graph);
  if (old && sameGraph(graph, old.snapshot)) return old.key;
  const snapshot: NavGraph = {
    type: 'NavGraph', nodes: graph.nodes.map(n => ({ x:n.x, y:n.y })),
    edges: graph.edges.map(e => e.cost === undefined ? {a:e.a,b:e.b} : {a:e.a,b:e.b,cost:e.cost}),
  };
  if (graph.grid) {
    const g = graph.grid;
    snapshot.grid = { originX:g.originX, originY:g.originY, cellSize:g.cellSize, cols:g.cols, rows:g.rows,
      blocked:Array.from(g.blocked), cost:Array.from(g.cost) };
  }
  const key = JSON.stringify(snapshot);
  observedGraphs.set(graph, { snapshot, key });
  return key;
}
function sameGraph(a: NavGraph, b: NavGraph): boolean {
  if (a.nodes.length !== b.nodes.length || a.edges.length !== b.edges.length || !!a.grid !== !!b.grid) return false;
  for (let i=0; i<a.nodes.length; i++) if (a.nodes[i].x !== b.nodes[i].x || a.nodes[i].y !== b.nodes[i].y) return false;
  for (let i=0; i<a.edges.length; i++) {
    const x=a.edges[i],y=b.edges[i];
    if(x.a!==y.a || x.b!==y.b || x.cost!==y.cost) return false;
  }
  if (a.grid && b.grid) {
    const x=a.grid,y=b.grid;
    if(x.originX!==y.originX || x.originY!==y.originY || x.cellSize!==y.cellSize || x.cols!==y.cols || x.rows!==y.rows
      || x.blocked.length!==y.blocked.length || x.cost.length!==y.cost.length) return false;
    for(let i=0;i<x.blocked.length;i++) if(x.blocked[i]!==y.blocked[i]) return false;
    for(let i=0;i<x.cost.length;i++) if(x.cost[i]!==y.cost[i]) return false;
  }
  return true;
}
