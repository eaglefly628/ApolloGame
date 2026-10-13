import type { CrowdAvoidance } from '@engine/protocol/components/crowd.js';
import type { FlowField, PathFollow, Transform } from '@engine/protocol/components.js';

type Guide = NonNullable<CrowdAvoidance['flowGuide']>;

/** Lateral drift activates guidance; the clamped point is the A* rejoin target. */
export function routeProjection(t: Transform, path: PathFollow):
  { distance: number; goalX: number; goalY: number; index: number; segmentKey: string } | null {
  const points = path.waypoints;
  const index = path.index ?? 0;
  if (!Array.isArray(points) || points.length < 2 || !Number.isInteger(index) || index < 0 || index >= points.length) return null;
  const from = points[(index - 1 + points.length) % points.length]!;
  const to = points[index]!;
  if (!from || !to) return null;
  const dx = to.x - from.x, dy = to.y - from.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (!(length > 0) || ![t.x, t.y, from.x, from.y, to.x, to.y].every(Number.isFinite)) return null;
  // An agent that just crossed the endpoint must turn via PathFollow, not be pulled backward by the field.
  const distance = Math.abs((t.x - from.x) * dy - (t.y - from.y) * dx) / length;
  const projection = Math.min(1, Math.max(0, ((t.x - from.x) * dx + (t.y - from.y) * dy) / (length * length)));
  return { distance, goalX: from.x + projection * dx, goalY: from.y + projection * dy, index,
    segmentKey: JSON.stringify([from.x, from.y, to.x, to.y]) };
}

/** Current route segment is the baseline; off-route distance smoothly raises grid-flow influence. */
export function flowGuideWeight(t: Transform, path: PathFollow, guide: Guide): number | null {
  if (!guide.fieldId) return null;
  const projection = routeProjection(t, path);
  if (!projection) return null;
  const threshold = guide.repathDistance ?? 1;
  const base = guide.weight ?? 0;
  return base + (1 - base) * Math.min(1, Math.max(0, (projection.distance - threshold) / threshold));
}

/** Preserve the route's intended speed, including a strict zero-intent stop. */
export function blendFlowDirection(desired: { x: number; y: number }, direction: { x: number; y: number }, weight: number):
  { x: number; y: number } | null {
  const speed = Math.sqrt(desired.x * desired.x + desired.y * desired.y);
  if (speed === 0) return { x: 0, y: 0 };
  const dm = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
  if (!(dm > 0) || !Number.isFinite(dm)) return null;
  const x = desired.x * (1 - weight) + direction.x / dm * speed * weight;
  const y = desired.y * (1 - weight) + direction.y / dm * speed * weight;
  const magnitude = Math.sqrt(x * x + y * y);
  if (magnitude < 1e-9) return weight >= .5
    ? { x: direction.x / dm * speed, y: direction.y / dm * speed } : desired;
  return { x: x / magnitude * speed, y: y / magnitude * speed };
}

/** Avoid passing malformed optional guide data into the shared field baker. */
export function usableGuideField(field: FlowField): boolean {
  const cells = field.cols * field.rows;
  return Number.isInteger(field.cols) && field.cols > 0 && Number.isInteger(field.rows) && field.rows > 0
    && cells <= 262144
    && Number.isFinite(field.cellSize) && field.cellSize > 0
    && Number.isFinite(field.originX) && Number.isFinite(field.originY)
    && Number.isFinite(field.originX + field.cols * field.cellSize)
    && Number.isFinite(field.originY + field.rows * field.cellSize)
    && Array.isArray(field.goals) && field.goals.length > 0
    && field.goals.every(goal => goal && Number.isFinite(goal.x) && Number.isFinite(goal.y))
    && (field.blocked === undefined || (Array.isArray(field.blocked) && field.blocked.length === cells
      && field.blocked.every(value => value === 0 || value === 1)))
    && (field.cost === undefined || (Array.isArray(field.cost) && field.cost.length === cells
      && field.cost.every(value => Number.isFinite(value) && value >= 1 && Math.ceil(value) * 14 * cells < 0x3fffffff)));
}
