import { describe, expect, it } from 'vitest';
import type { NavGraph, Transform, PathFollow } from '@engine/protocol/components.js';
import type { CrowdAvoidance } from '@engine/protocol/components/crowd.js';
import { bakeNavigationProfile } from './navigation-grid.js';
import { advanceRouteRepath, planRouteRejoin, prepareRepathGrid, selectEdgeRepaths } from './crowd-route-repath.js';
import { routeProjection } from './crowd-flow-guide.js';
import { exactGraphKey, validExplicitGraph } from './pathfind-graph-key.js';

const graph = (): NavGraph => bakeNavigationProfile({
  type: 'NavigationGrid', originX: 0, originY: 0, cellSize: 1, cols: 9, rows: 9,
}, 0)!;

describe('crowd A* route rejoin', () => {
  it('grants scarce replan slots to actors with an open flank', () => {
    const actors = [-1, 0, 1].map((x, i) => ({ id: `ox-${i}`, x, y: 0, radius: .4,
      desiredX: 0, desiredY: 1, stuckTicks: 0 }));
    expect([...selectEdgeRepaths(actors, actors, 2)]).toEqual(['ox-0', 'ox-2']);
  });

  it('reuses grid topology and gently routes around occupied cells', () => {
    const nav = graph();
    const empty = prepareRepathGrid(nav, [])!;
    const occupied = prepareRepathGrid(nav, [{ x: 4.5, y: 4.5, radius: 1.1 }])!;
    const direct = planRouteRejoin(empty, 1.5, 4.5, 7.5, 4.5, 0)!;
    const around = planRouteRejoin(occupied, 1.5, 4.5, 7.5, 4.5, 2)!;
    expect(direct.length).toBeGreaterThan(0);
    expect(direct.every(node => nav.nodes[node]!.y === 4.5)).toBe(true);
    expect(around.some(node => nav.nodes[node]!.y !== 4.5)).toBe(true);
    expect(around.at(-1)).toBe(direct.at(-1));
  });

  it('enters only after lateral drift and releases after returning to route', () => {
    const nav = graph();
    const prepared = prepareRepathGrid(nav, [])!;
    const cfg: CrowdAvoidance = { type: 'CrowdAvoidance', radius: .35, maxSpeed: .1,
      flowGuide: { fieldId: 'corridor', pathfindDistance: 2, releaseDistance: .5, occupancyPenalty: .25 } };
    const position: Transform = { type: 'Transform', x: 7.5, y: 4.5, rotation: 0, scaleX: 1, scaleY: 1 };
    const path: PathFollow = { type: 'PathFollow', waypoints: [{ x: 4.5, y: 1.5 }, { x: 4.5, y: 7.5 }],
      speed: .1, index: 1 };
    const desired = { x: 0, y: .1 };
    const projected = routeProjection(position, path)!;
    expect(advanceRouteRepath(cfg, position, nav, projected, desired, () => exactGraphKey(nav), () => prepared).status).toBe('planned');
    expect(cfg.repathPath?.via.length).toBeGreaterThan(0);
    position.x = 4.5;
    expect(advanceRouteRepath(cfg, position, nav, routeProjection(position, path), desired,
      () => exactGraphKey(nav), () => prepared).status).toBe('released');
    expect(cfg.repathPath).toBeUndefined();
  });

  it('invalidates cached nodes when the graph topology changes in place', () => {
    const nav = graph();
    const cfg: CrowdAvoidance = { type: 'CrowdAvoidance', radius: .35, maxSpeed: .1,
      flowGuide: { fieldId: 'corridor', pathfindDistance: 2, pathfindPeriod: 100 } };
    const position: Transform = { type: 'Transform', x: 7.5, y: 4.5, rotation: 0, scaleX: 1, scaleY: 1 };
    const path: PathFollow = { type: 'PathFollow', waypoints: [{ x: 4.5, y: 1.5 }, { x: 4.5, y: 7.5 }],
      speed: .1, index: 1 };
    const step = () => advanceRouteRepath(cfg, position, nav, routeProjection(position, path), { x: 0, y: .1 },
      () => validExplicitGraph(nav) ? exactGraphKey(nav) : null, () => prepareRepathGrid(nav, []));
    expect(step().status).toBe('planned');
    expect(step().status).toBe('following');
    nav.edges.length = 0;
    expect(step().status).toBe('unavailable');
    expect(cfg.repathPath).toBeUndefined();
  });

  it('replans immediately when the authored route segment moves', () => {
    const nav = graph();
    const cfg: CrowdAvoidance = { type: 'CrowdAvoidance', radius: .35, maxSpeed: .1,
      flowGuide: { fieldId: 'corridor', pathfindDistance: 2, pathfindPeriod: 100 } };
    const position: Transform = { type: 'Transform', x: 7.5, y: 4.5, rotation: 0, scaleX: 1, scaleY: 1 };
    const path: PathFollow = { type: 'PathFollow', waypoints: [{ x: 4.5, y: 1.5 }, { x: 4.5, y: 7.5 }],
      speed: .1, index: 1 };
    const step = () => advanceRouteRepath(cfg, position, nav, routeProjection(position, path), { x: 0, y: .1 },
      () => exactGraphKey(nav), () => prepareRepathGrid(nav, []));
    expect(step().status).toBe('planned');
    expect(step().status).toBe('following');
    path.waypoints[0]!.x = 2.5;
    path.waypoints[1]!.x = 2.5;
    expect(step().status).toBe('planned');
    expect(cfg.repathPath?.goalX).toBe(2.5);
  });
});
