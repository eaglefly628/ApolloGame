import type { NavAgent } from '@engine/protocol/components.js';

type Patrol = NonNullable<NavAgent['patrol']>;

/** Select the next fixed A* goal only after reaching the current point. */
export function selectPatrolGoal(patrol: Patrol, x: number, y: number, arriveRange: number):
  { x: number; y: number; index: number; changed: boolean } | null {
  const points = patrol.waypoints;
  const index = patrol.index ?? 0;
  if (!Number.isFinite(arriveRange) || arriveRange < 0 || !Array.isArray(points) || points.length === 0
    || !Number.isInteger(index) || index < 0 || index >= points.length
    || !points.every(p => p && Number.isFinite(p.x) && Number.isFinite(p.y))) return null;
  const current = points[index];
  const dx = x - current.x, dy = y - current.y;
  const reached = dx * dx + dy * dy <= arriveRange * arriveRange;
  const next = reached && (index + 1 < points.length || patrol.loop)
    ? (index + 1) % points.length : index;
  return { ...points[next], index: next, changed: next !== index };
}
