import type { NavGraph, Transform } from '@engine/protocol/components.js';
import type { CrowdAvoidance } from '@engine/protocol/components/crowd.js';
import { astar } from '@engine/spatial/astar.js';
import { buildAdjacency, graphCell } from './pathfind.js';
import type { routeProjection } from './crowd-flow-guide.js';

export interface RepathObstacle { x: number; y: number; radius: number }
export interface EdgeRepathCandidate extends RepathObstacle {
  id: string;
  desiredX: number;
  desiredY: number;
  stuckTicks: number;
}

/** Prefer agents with an open flank; stable id breaks exact ties for replay. */
export function selectEdgeRepaths(candidates: readonly EdgeRepathCandidate[],
  neighbors: readonly (RepathObstacle & { id: string })[], slots: number): Set<string> {
  const ranked = candidates.map(actor => {
    const magnitude = Math.sqrt(actor.desiredX * actor.desiredX + actor.desiredY * actor.desiredY);
    const nx = magnitude > 0 ? -actor.desiredY / magnitude : 1;
    const ny = magnitude > 0 ? actor.desiredX / magnitude : 0;
    let left = 0, right = 0;
    for (const other of neighbors) {
      if (other.id === actor.id) continue;
      const dx = other.x - actor.x, dy = other.y - actor.y;
      const range = actor.radius + other.radius + 2;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance >= range) continue;
      const pressure = (range - distance) / range;
      const side = dx * nx + dy * ny;
      if (side > .1) left += pressure;
      else if (side < -.1) right += pressure;
      else { left += pressure * .5; right += pressure * .5; }
    }
    return { id: actor.id, flankPressure: Math.min(left, right),
      totalPressure: left + right, stuckTicks: actor.stuckTicks };
  });
  ranked.sort((a, b) => a.flankPressure - b.flankPressure || a.totalPressure - b.totalPressure
    || b.stuckTicks - a.stuckTicks || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return new Set(ranked.slice(0, Math.max(0, slots)).map(actor => actor.id));
}

export interface PreparedRepathGrid {
  graph: NavGraph;
  adj: number[][];
  nodeByCell: Int32Array;
  cellByNode: Int32Array;
  occupied: Uint8Array;
}

/** Occupancy is a temporary soft-cost layer; the authored NavigationGrid stays terrain-only. */
export function repathOccupancy(graph: NavGraph, obstacles: readonly RepathObstacle[]): Uint8Array | null {
  const grid = graph.grid;
  if (!grid) return null;
  const occupied = new Uint8Array(grid.cols * grid.rows);
  for (const actor of obstacles) {
    const pad = actor.radius + grid.cellSize * .35;
    const minCol = Math.max(0, Math.floor((actor.x - pad - grid.originX) / grid.cellSize));
    const maxCol = Math.min(grid.cols - 1, Math.floor((actor.x + pad - grid.originX) / grid.cellSize));
    const minRow = Math.max(0, Math.floor((actor.y - pad - grid.originY) / grid.cellSize));
    const maxRow = Math.min(grid.rows - 1, Math.floor((actor.y + pad - grid.originY) / grid.cellSize));
    for (let row = minRow; row <= maxRow; row++) for (let col = minCol; col <= maxCol; col++) {
      const x = grid.originX + (col + .5) * grid.cellSize;
      const y = grid.originY + (row + .5) * grid.cellSize;
      if ((x - actor.x) ** 2 + (y - actor.y) ** 2 > pad * pad) continue;
      const cell = row * grid.cols + col;
      if (occupied[cell] < 255) occupied[cell]++;
    }
  }
  return occupied;
}

type RouteProjection = NonNullable<ReturnType<typeof routeProjection>>;
type Vector = { x: number; y: number };
export type RepathStep = { desired: Vector; status: 'off' | 'planned' | 'following' | 'unavailable' | 'released' };

/** Same NavGraph topology as NavAgent, with a per-tick soft dynamic occupancy layer. */
export function prepareRepathGrid(graph: NavGraph, obstacles: readonly RepathObstacle[]): PreparedRepathGrid | null {
  const grid = graph.grid;
  if (!grid) return null;
  const cells = grid.cols * grid.rows;
  const nodeByCell = new Int32Array(cells).fill(-1);
  const cellByNode = new Int32Array(graph.nodes.length);
  for (let n = 0; n < graph.nodes.length; n++) {
    const node = graph.nodes[n]!;
    const cell = graphCell(graph, node.x, node.y);
    if (cell < 0) return null;
    nodeByCell[cell] = n;
    cellByNode[n] = cell;
  }
  const occupied = repathOccupancy(graph, obstacles)!;
  return { graph, adj: buildAdjacency(graph).adj, nodeByCell, cellByNode, occupied };
}

/** Rejoin the current authored route at its nearest point; congestion is a cost, never a wall. */
export function planRouteRejoin(prepared: PreparedRepathGrid, x: number, y: number,
  goalX: number, goalY: number, occupancyPenalty: number): number[] | null {
  const { graph, adj, nodeByCell, cellByNode, occupied } = prepared;
  const grid = graph.grid!;
  const startCell = graphCell(graph, x, y), goalCell = graphCell(graph, goalX, goalY);
  if (startCell < 0 || goalCell < 0) return null;
  const start = nodeByCell[startCell]!, goal = nodeByCell[goalCell]!;
  if (start < 0 || goal < 0) return null;
  const goalCol = goalCell % grid.cols, goalRow = Math.floor(goalCell / grid.cols);
  const full = astar(start, goal, n => adj[n]!, (a, b) => {
    const source = cellByNode[a]!, destination = cellByNode[b]!;
    const diagonal = source % grid.cols !== destination % grid.cols &&
      Math.floor(source / grid.cols) !== Math.floor(destination / grid.cols);
    return grid.cost[source]! * (diagonal ? 14 : 10) * (1 + occupancyPenalty * occupied[destination]!);
  }, n => {
    const cell = cellByNode[n]!, col = cell % grid.cols, row = Math.floor(cell / grid.cols);
    const dx = Math.abs(col - goalCol), dy = Math.abs(row - goalRow);
    return 14 * Math.min(dx, dy) + 10 * Math.abs(dx - dy);
  });
  return full?.slice(1) ?? null;
}

/** Hysteresis and cached route nodes are serialized in CrowdAvoidance for replay safety. */
export function advanceRouteRepath(cfg: CrowdAvoidance, position: Transform, graph: NavGraph | undefined,
  projection: RouteProjection | null, desired: Vector, graphIdentity: () => string | null,
  prepare: () => PreparedRepathGrid | null, preplannedVia?: number[]): RepathStep {
  const guide = cfg.flowGuide;
  if (!guide?.pathfindDistance || !projection) {
    delete cfg.repathPath;
    return { desired, status: 'off' };
  }
  const trigger = guide.pathfindDistance, release = guide.releaseDistance ?? trigger / 2;
  if (cfg.repathPath && projection.distance <= release) {
    delete cfg.repathPath;
    return { desired, status: 'released' };
  }
  if (!cfg.repathPath && projection.distance < trigger) return { desired, status: 'off' };
  if (!graph?.grid) {
    delete cfg.repathPath;
    return { desired, status: 'unavailable' };
  }
  const graphKey = graphIdentity();
  if (graphKey === null) {
    delete cfg.repathPath;
    return { desired, status: 'unavailable' };
  }
  const state = cfg.repathPath;
  const invalid = state && (!Array.isArray(state.via) || !Number.isInteger(state.age) || state.age < 0
    || !Number.isFinite(state.goalX) || !Number.isFinite(state.goalY) || typeof state.segmentKey !== 'string');
  const needPlan = !state || invalid || state.graphId !== guide.fieldId || state.graphKey !== graphKey
    || state.routeIndex !== projection.index || state.segmentKey !== projection.segmentKey
    || state.age >= (guide.pathfindPeriod ?? 45);
  let planned = false;
  if (needPlan) {
    const prepared = preplannedVia ? null : prepare();
    const via = preplannedVia ?? (prepared ? planRouteRejoin(prepared, position.x, position.y,
      projection.goalX, projection.goalY, guide.occupancyPenalty ?? 0) : null);
    if (!via) {
      delete cfg.repathPath;
      return { desired, status: 'unavailable' };
    }
    cfg.repathPath = { via, goalX: projection.goalX, goalY: projection.goalY,
      routeIndex: projection.index, segmentKey: projection.segmentKey, age: 0,
      graphId: guide.fieldId, graphKey };
    planned = true;
  }
  const route = cfg.repathPath!;
  const reach = Math.max(cfg.maxSpeed, graph.grid.cellSize * .2);
  while (route.via.length > 0) {
    const node = graph.nodes[route.via[0]!]!;
    if (!node || !Number.isFinite(node.x) || !Number.isFinite(node.y)) {
      delete cfg.repathPath;
      return { desired, status: 'unavailable' };
    }
    const dx = node.x - position.x, dy = node.y - position.y;
    if (dx * dx + dy * dy > reach * reach) break;
    route.via.shift();
  }
  const waypoint = route.via.length > 0 ? graph.nodes[route.via[0]!] : undefined;
  const wx = waypoint?.x ?? route.goalX, wy = waypoint?.y ?? route.goalY;
  const dx = wx - position.x, dy = wy - position.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  route.age++;
  if (!(distance > 0)) return { desired, status: planned ? 'planned' : 'following' };
  const speed = Math.min(Math.sqrt(desired.x * desired.x + desired.y * desired.y), distance);
  return { desired: { x: dx / distance * speed, y: dy / distance * speed },
    status: planned ? 'planned' : 'following' };
}
