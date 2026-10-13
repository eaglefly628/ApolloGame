import { defineCapability } from '@engine/core/define-capability.js';
import { sortedIds } from '@engine/core/query.js';
import { SystemPhase } from '@engine/core/types.js';
import type { IWorld } from '@engine/core/types.js';
import type { NavGraph, FlowField } from '@engine/protocol/components.js';
import type { NavigationGrid, NavigationProfile, NavigationGraphGrid } from '@engine/protocol/components/navigation-grid.js';
import { gridFromBounds, rasterizeBlocked, bakeNavGraph } from '@engine/spatial/navmesh.js';
import type { Rect2 } from '@engine/spatial/navmesh.js';
import { findDebugTrace, appendTrace } from '../debug-trace.js';

// Cache stores only pure geometry. Exact keys (no hashes), no goals, bounded, and never
// exposed to callers: clearing it or restoring a world cannot change simulation output.
const cache = new Map<string, NavGraph>();
let bakes = 0;
export function clearNavigationGridCache(): void { cache.clear(); bakes = 0; }
export function navigationGridBakes(): number { return bakes; }

function gridKey(g: NavigationGrid): string {
  return JSON.stringify([g.originX, g.originY, g.cellSize, g.cols, g.rows, g.blocked ?? null, g.cost ?? null]);
}
function profileKey(key: string, radius: number): string { return `${key}:${radius}`; }

export function validNavigationGrid(g: NavigationGrid): boolean {
  const n = g.cols * g.rows;
  return Number.isFinite(g.originX) && Number.isFinite(g.originY)
    && Number.isFinite(g.cellSize) && g.cellSize > 0
    && Number.isFinite(g.originX + g.cols * g.cellSize) && Number.isFinite(g.originY + g.rows * g.cellSize)
    && Number.isInteger(g.cols) && g.cols > 0 && Number.isInteger(g.rows) && g.rows > 0
    && n <= 262144
    && (g.blocked === undefined || (Array.isArray(g.blocked) && g.blocked.length === n && g.blocked.every(v => v === 0 || v === 1)))
    && (g.cost === undefined || (Array.isArray(g.cost) && g.cost.length === n && g.cost.every(v => Number.isFinite(v) && v >= 1 && Math.ceil(v) * 14 * n < 0x3fffffff)));
}

/** Conservative full-cell clearance: every point in a free output cell can fit the
 * profile disc. Touching at radius zero does not close adjacent cells. For nonzero
 * radius, use the existing AABB rasterizer on expanded obstacle footprints. */
export function bakeNavigationProfile(g: NavigationGrid, radius: number): NavGraph | undefined {
  if (!validNavigationGrid(g) || !Number.isFinite(radius) || radius < 0) return undefined;
  const key = profileKey(gridKey(g), radius);
  const hit = cache.get(key);
  if (hit) return structuredClone(hit);
  const half = g.cellSize / 2;
  // navmesh's origin is a CENTER; FlowField / NavigationGrid use a CORNER.
  const grid = gridFromBounds(g.originX + half, g.originY + half,
    g.originX + (g.cols - 0.5) * g.cellSize, g.originY + (g.rows - 0.5) * g.cellSize, g.cellSize);
  // Avoid floating division roundoff changing authored dimensions.
  grid.cols = g.cols; grid.rows = g.rows;
  const obstacles: Rect2[] = [];
  for (let i = 0; i < g.cols * g.rows; i++) {
    if (!g.blocked?.[i]) continue;
    const x = g.originX + (i % g.cols) * g.cellSize;
    const y = g.originY + Math.floor(i / g.cols) * g.cellSize;
    obstacles.push({ minX: x - radius, maxX: x + g.cellSize + radius, minZ: y - radius, maxZ: y + g.cellSize + radius });
  }
  const blocked = radius === 0 ? Uint8Array.from(g.blocked ?? new Array(g.cols * g.rows).fill(0)) : rasterizeBlocked(grid, obstacles);
  if (radius > 0) {
    // Full-cell conservative boundary clearance, matching inflated obstacles.
    for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) {
      if (Math.min(c, r, g.cols - c - 1, g.rows - r - 1) * g.cellSize < radius) blocked[r * g.cols + c] = 1;
    }
  }
  const metadata: NavigationGraphGrid = {
    bakeKey: key,
    originX: g.originX, originY: g.originY, cellSize: g.cellSize, cols: g.cols, rows: g.rows,
    blocked: Array.from(blocked), cost: Array.from({ length: g.cols * g.rows }, (_, i) => Math.ceil(g.cost?.[i] ?? 1)),
  };
  const graph: NavGraph = { type: 'NavGraph', ...bakeNavGraph(grid, blocked), grid: metadata };
  if (cache.size >= 32) cache.delete(cache.keys().next().value!);
  cache.set(key, structuredClone(graph)); bakes++;
  return graph;
}

export const navigationGridCapability = defineCapability({
  id: 't2-navigation-grid', version: '1.0.0',
  describe: {
    name: 'navigation-grid', summary: 'Shared corner-origin grid → per-radius NavGraph and FlowField; deterministic conservative clearance.',
    semantic: ['tier2', 'navigation', 'movement'],
    whenToUse: 'Share obstacle and terrain data between A* and flow fields, with separate clearance profiles for different unit sizes.',
    examples: ['map:NavigationGrid{originX:0,originY:0,cellSize:1,cols:32,rows:32}; ox:NavigationProfile{gridId:"map",radius:0.3,goals:[{x:20.5,y:20.5}]} → NavAgent.graphId / FlowAgent.fieldId = "ox"'],
  },
  components: {
    provides: {
      NavigationGrid: { category: 'config', describe: 'Shared ground grid; origin is cell corner; row-major blocked 0/1 and integer-ceiled cost ≥1.', fields: {
        originX: { type: 'number', describe: 'Minimum cell corner x' }, originY: { type: 'number', describe: 'Minimum cell corner y (3D Z)' },
        cellSize: { type: 'number', describe: 'Positive cell edge in world units' }, cols: { type: 'number', describe: 'Positive integer columns' }, rows: { type: 'number', describe: 'Positive integer rows; total ≤262144' },
        blocked: { type: 'number[]', describe: 'Optional row-major 0/1 obstacles; exact cols×rows length' }, cost: { type: 'number[]', describe: 'Optional row-major finite costs ≥1; source-cell cost×10/14, ceiled to integer' },
      } },
      NavigationProfile: { category: 'config', describe: 'Entity id selects derived NavGraph/FlowField. Owns both outputs. Clearance is conservative over entire cells.', fields: {
        gridId: { type: 'string', describe: 'NavigationGrid entity id' }, radius: { type: 'number', describe: 'Finite nonnegative clearance radius; full-cell obstacle and boundary inflation' },
        goals: { type: 'string', describe: 'Optional flow targets [{x,y}]; invalid coordinates reject profile; blocked/outside targets omitted' },
      } },
    },
    reads: ['NavigationGrid', 'NavigationProfile'], writes: ['NavGraph', 'FlowField'], consumes: [],
  }, config: {},
  systems: [{
    id: 'navigation-grid', phase: SystemPhase.Update, runsBefore: ['nav-follow', 'flow-field'],
    reads: ['NavigationGrid', 'NavigationProfile'], writes: ['NavGraph', 'FlowField'], consumes: [],
    execute(world: IWorld) {
      let updated = 0, rejected = 0, invalidGoals = 0;
      const inputs = new Map<string, { grid: NavigationGrid; key: string } | null>();
      for (const id of sortedIds(world, 'NavigationProfile')) {
        const profile = world.getComponent<NavigationProfile>(id, 'NavigationProfile')!;
        if (!inputs.has(profile.gridId)) {
          const grid = world.getComponent<NavigationGrid>(profile.gridId, 'NavigationGrid');
          inputs.set(profile.gridId, grid && validNavigationGrid(grid) ? { grid, key: gridKey(grid) } : null);
        }
        const input = inputs.get(profile.gridId);
        const oldGraph = world.getComponent<NavGraph>(id, 'NavGraph');
        const goals = profile.goals ?? [];
        const valid = input && Number.isFinite(profile.radius) && profile.radius >= 0
          && Array.isArray(goals) && goals.every(p => p && Number.isFinite(p.x) && Number.isFinite(p.y));
        const key = valid ? profileKey(input!.key, profile.radius) : undefined;
        const graph = valid ? (oldGraph?.grid?.bakeKey === key ? oldGraph : bakeNavigationProfile(input!.grid, profile.radius)) : undefined;
        if (!graph) {
          world.removeComponent(id, 'NavGraph'); world.removeComponent(id, 'FlowField'); rejected++; continue;
        }
        const g = graph.grid!;
        const acceptedGoals = goals.filter(p => {
          const c = Math.floor((p.x - g.originX) / g.cellSize), r = Math.floor((p.y - g.originY) / g.cellSize);
          return c >= 0 && r >= 0 && c < g.cols && r < g.rows && !g.blocked[r * g.cols + c];
        });
        invalidGoals += goals.length - acceptedGoals.length;
        const field: FlowField = { type: 'FlowField', id, originX:g.originX, originY:g.originY, cellSize:g.cellSize, cols:g.cols, rows:g.rows, blocked:g.blocked, cost:g.cost, costAware:true, goals: acceptedGoals.map(p => ({ x: p.x, y: p.y })) };
        // Replace only changed serialized data; goals never invalidate geometry cache.
        const oldFlow = world.getComponent<FlowField>(id, 'FlowField');
        let changed = false;
        if (oldGraph !== graph) { world.addComponent(id, graph); changed = true; }
        if (!oldFlow || oldGraph !== graph || oldFlow.costAware !== true || JSON.stringify(oldFlow.goals) !== JSON.stringify(field.goals)) { world.addComponent(id, field); changed = true; }
        if (changed) updated++;
      }
      const trace = findDebugTrace(world);
      if (rejected || invalidGoals) appendTrace(trace, world.getVersion(), 'navigation-grid', 'reject', `invalid profiles ${rejected}; blocked/outside goals ${invalidGoals}`, 'Invalid profiles remove derived outputs; invalid goals do not seed flow');
      if (updated) appendTrace(trace, world.getVersion(), 'navigation-grid', 'commit', `updated profiles ${updated}`, 'Shared geometry → matching NavGraph and FlowField');
    },
  }],
});
