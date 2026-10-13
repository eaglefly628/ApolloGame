import type { IWorld } from '@engine/core/types.js';
import type { CrowdAvoidance } from '@engine/protocol/components/crowd.js';
import type { Transform, Velocity, FlowAgent, PathFollow, NavGraph, Shape } from '@engine/protocol/components.js';
import { routeProjection } from './crowd-flow-guide.js';
import { planRouteRejoin, prepareRepathGrid, selectEdgeRepaths,
  type EdgeRepathCandidate, type PreparedRepathGrid, type RepathObstacle } from './crowd-route-repath.js';
import { exactGraphKey, validExplicitGraph } from './pathfind-graph-key.js';
import { valid } from './crowd-config.js';

export function prepareEdgeRepaths(world: IWorld, ids: string[]) {
        const repathGrids = new Map<string, PreparedRepathGrid | null>();
        const repathGraphKeys = new Map<NavGraph, string | null>();
        const preplannedRoutes = new Map<string, number[]>();
        let repathObstacles: Array<RepathObstacle & { group: string }> | undefined;
        const edgeGranted = new Set<string>();
        if (ids.some(id => world.getComponent<CrowdAvoidance>(id, 'CrowdAvoidance')?.flowGuide?.edgeRepathSlots)) {
          const actors = ids.flatMap(id => {
            const t = world.getComponent<Transform>(id, 'Transform');
            const cfg = world.getComponent<CrowdAvoidance>(id, 'CrowdAvoidance');
            const shape = world.getComponent<Shape>(id, 'Shape');
            const radius = shape?.kind === 'circle' ? shape.radius : cfg?.radius;
            if (!t || !cfg || !Number.isFinite(t.x) || !Number.isFinite(t.y) ||
                !Number.isFinite(radius) || !(radius! > 0) || world.hasComponent(id, 'Sensor')) return [];
            return [{ id, x: t.x, y: t.y, radius: radius!, group: cfg.group ?? '' }];
          });
          repathObstacles = actors;
          const buckets = new Map<string, { fieldId: string; group: string; slots: number; active: string[];
            candidates: EdgeRepathCandidate[] }>();
          const goals = new Map<string, { x: number; y: number }>();
          for (const actor of actors) {
            const cfg = world.getComponent<CrowdAvoidance>(actor.id, 'CrowdAvoidance')!;
            const guide = cfg.flowGuide;
            const flow = world.getComponent<FlowAgent>(actor.id, 'FlowAgent');
            if (flow?.orca || flow?.separation) {
              delete cfg.repathPath;
              continue;
            }
            if (!guide?.edgeRepathSlots || !guide.pathfindDistance || !valid(cfg)) continue;
            const key = `${guide.fieldId}\u0000${actor.group}`;
            let bucket = buckets.get(key);
            if (!bucket) {
              bucket = { fieldId: guide.fieldId, group: actor.group,
                slots: guide.edgeRepathSlots, active: [], candidates: [] };
              buckets.set(key, bucket);
            }
            bucket.slots = Math.min(bucket.slots, guide.edgeRepathSlots);
            const path = world.getComponent<PathFollow>(actor.id, 'PathFollow');
            const projection = path ? routeProjection(world.getComponent<Transform>(actor.id, 'Transform')!, path) : null;
            const v = world.getComponent<Velocity>(actor.id, 'Velocity');
            if (cfg.repathPath) {
              if (!projection || projection.distance <= (guide.releaseDistance ?? guide.pathfindDistance / 2)) {
                delete cfg.repathPath;
              } else {
                if ((cfg.stuckTicks ?? 0) < Math.max(12, Math.floor((cfg.yieldAfterTicks ?? 60) / 2))) {
                  bucket.active.push(actor.id);
                }
                continue;
              }
            }
            if (!projection || !v || ![v.vx, v.vy].every(Number.isFinite) || !(v.vx !== 0 || v.vy !== 0)) continue;
            if (projection.distance < guide.pathfindDistance) continue;
            if ((cfg.stuckTicks ?? 0) >= Math.max(12, Math.floor((cfg.yieldAfterTicks ?? 60) / 2))) {
              edgeGranted.add(actor.id);
              continue;
            }
            bucket.candidates.push({ ...actor, desiredX: v.vx, desiredY: v.vy,
              stuckTicks: cfg.stuckTicks ?? 0 });
            goals.set(actor.id, { x: projection.goalX, y: projection.goalY });
          }
          for (const bucket of buckets.values()) {
            if (bucket.active.length > bucket.slots) {
              const activeCandidates = bucket.active.map(id => {
                const actor = actors.find(other => other.id === id)!;
                const velocity = world.getComponent<Velocity>(id, 'Velocity');
                return { ...actor, desiredX: velocity?.vx ?? 0, desiredY: velocity?.vy ?? 0,
                  stuckTicks: world.getComponent<CrowdAvoidance>(id, 'CrowdAvoidance')!.stuckTicks ?? 0 };
              });
              const retained = selectEdgeRepaths(activeCandidates,
                actors.filter(actor => actor.group === bucket.group), bucket.slots);
              for (const id of bucket.active) {
                if (!retained.has(id)) delete world.getComponent<CrowdAvoidance>(id, 'CrowdAvoidance')!.repathPath;
              }
              bucket.active = bucket.active.filter(id => retained.has(id));
            }
            const available = Math.max(0, bucket.slots - bucket.active.length);
            if (!available || !bucket.candidates.length) continue;
            const graph = world.getComponent<NavGraph>(bucket.fieldId, 'NavGraph');
            if (!graph?.grid || !validExplicitGraph(graph)) continue;
            repathGraphKeys.set(graph, exactGraphKey(graph));
            const key = `${bucket.fieldId}\u0000${bucket.group}`;
            const prepared = prepareRepathGrid(graph,
              actors.filter(actor => actor.group === bucket.group));
            repathGrids.set(key, prepared);
            if (!prepared) continue;
            const ranked = selectEdgeRepaths(bucket.candidates,
              actors.filter(actor => actor.group === bucket.group), bucket.candidates.length);
            let granted = 0;
            for (const id of ranked) {
              const actor = bucket.candidates.find(candidate => candidate.id === id)!;
              const goal = goals.get(id)!;
              const guide = world.getComponent<CrowdAvoidance>(id, 'CrowdAvoidance')!.flowGuide!;
              const via = planRouteRejoin(prepared, actor.x, actor.y, goal.x, goal.y,
                guide.occupancyPenalty ?? 0);
              if (!via) continue;
              edgeGranted.add(id);
              preplannedRoutes.set(id, via);
              if (++granted >= available) break;
            }
          }
        }
  return { repathGrids, repathGraphKeys, preplannedRoutes, repathObstacles, edgeGranted };
}
