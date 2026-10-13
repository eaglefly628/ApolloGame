import type { IWorld } from '@engine/core/types.js';
import type { CrowdAvoidance } from '@engine/protocol/components/crowd.js';
import type { Transform, Line3D } from '@engine/protocol/components.js';

export function clearDebugVectors(world: IWorld, cfg: CrowdAvoidance): void {
  if (typeof cfg.debugVectorPrefix !== 'string' || !cfg.debugVectorPrefix) return;
  for (const suffix of ['desired', 'raw', 'actual', 'avoid']) {
    const line = world.getComponent<Line3D>(`${cfg.debugVectorPrefix}:${suffix}`, 'Line3D');
    if (line) line.points = [];
  }
}

function arrowPoints(x: number, y: number, vx: number, vy: number, scale: number, height: number): Line3D['points'] {
  const dx = vx * scale, dz = vy * scale;
  const length = Math.sqrt(dx * dx + dz * dz);
  if (length < .015) return [];
  const tx = x + dx, tz = y + dz;
  const hx = dx / length, hz = dz / length;
  const head = Math.min(.24, length * .22);
  return [[x,height,y],[tx,height,tz],
    [tx - hx * head - hz * head * .55,height,tz - hz * head + hx * head * .55],
    [tx,height,tz],
    [tx - hx * head + hz * head * .55,height,tz - hz * head - hx * head * .55]];
}

export function writeDebugVectors(world: IWorld, cfg: CrowdAvoidance, t: Transform,
  desired: {x:number;y:number}, raw: {x:number;y:number}, actual: {x:number;y:number}): number {
  const prefix = cfg.debugVectorPrefix;
  if (!prefix) return 0;
  const scale = cfg.debugVectorScale ?? 50, height = cfg.debugVectorY ?? 1;
  const lines: Array<[string, Line3D['points']]> = [
    ['desired', arrowPoints(t.x,t.y,desired.x,desired.y,scale,height)],
    ['raw', arrowPoints(t.x,t.y,raw.x,raw.y,scale,height+.04)],
    ['actual', arrowPoints(t.x,t.y,actual.x,actual.y,scale,height+.08)],
    ['avoid', arrowPoints(t.x+desired.x*scale,t.y+desired.y*scale,
      actual.x-desired.x,actual.y-desired.y,scale,height+.12)],
  ];
  let missing = 0;
  for (const [suffix, points] of lines) {
    const line = world.getComponent<Line3D>(`${prefix}:${suffix}`, 'Line3D');
    if (line) line.points = points;
    else missing++;
  }
  return missing;
}
