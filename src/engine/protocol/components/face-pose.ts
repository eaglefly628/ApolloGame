import type { Component } from '../../core/types.js';
import { t } from '../../core/schema.js';
import { validateDriverTree, driverFields, driverInt } from './animation-driver.js';

export const FACE_MAX_CHANNELS = 64;
export const FACE_MAX_POINTS = 128;
export const FACE_MAX_TICK = 10_000_000;
export interface FacePosePoint { readonly atTick: number; readonly value: number }
export interface FacePoseCurve {
  readonly source: 'performance-slot';
  readonly slot: string;
  /** Section-local cursor ticks, not clip absolute time, wall time or cycle. */
  readonly points: readonly FacePosePoint[];
}
export interface FacePose3D extends Component {
  readonly type: 'FacePose3D';
  readonly version: 1;
  readonly channels: Readonly<Record<string, {
    readonly mesh: string;
    readonly morph: string;
    /** Final override of this named morph. Other morphs retain native animation. */
    readonly weight: number | FacePoseCurve;
  }>>;
}
function reject(message: string): never { throw Error('FacePose3D: ' + message); }
function fields(v: unknown, keys: readonly string[]): Record<string, unknown> {
  const r = driverFields(v, keys, 'face');
  if (keys.some(k => !Object.hasOwn(r, k))) reject('missing fields');
  return r;
}
function stable(v: unknown): asserts v is string {
  if (typeof v !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,127}$/.test(v)) reject('stable alias/slot required');
}
function name(v: unknown): asserts v is string {
  if (typeof v !== 'string' || !v.trim() || v.length > 256 || /[\u0000-\u001f\u007f]/.test(v)) reject('bounded mesh/morph name required');
}
function weight(v: unknown): asserts v is number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1) reject('weight/value must be 0..1');
}
export function validateFacePose3D(value: unknown): FacePose3D {
  validateDriverTree(value);
  const f = fields(value, ['type', 'version', 'channels']);
  if (f.type !== 'FacePose3D' || f.version !== 1) reject('version/type');
  if (!f.channels || typeof f.channels !== 'object' || Array.isArray(f.channels)) reject('channel table required');
  const channels = f.channels as Record<string, unknown>, aliases = Object.keys(channels);
  if (!aliases.length || aliases.length > FACE_MAX_CHANNELS) reject('channel budget');
  const targets = new Set<string>();
  for (const alias of aliases) {
    stable(alias);
    const c = fields(channels[alias], ['mesh', 'morph', 'weight']);
    name(c.mesh); name(c.morph);
    const key = JSON.stringify([c.mesh, c.morph]);
    if (targets.has(key)) reject('duplicate mesh/morph target');
    targets.add(key);
    if (typeof c.weight === 'number') { weight(c.weight); continue; }
    const curve = fields(c.weight, ['source', 'slot', 'points']);
    if (curve.source !== 'performance-slot') reject('curve source');
    stable(curve.slot);
    if (!Array.isArray(curve.points) || curve.points.length < 1 || curve.points.length > FACE_MAX_POINTS) reject('point budget');
    let previous = -1;
    for (const raw of curve.points) {
      const p = fields(raw, ['atTick', 'value']);
      driverInt(p.atTick, 'face point tick', 0, FACE_MAX_TICK);
      if (p.atTick <= previous) reject('points must be strictly increasing');
      previous = p.atTick; weight(p.value);
    }
  }
  return value as FacePose3D;
}
/** Caller supplies a validated curve. Endpoints clamp; no extrapolation or loop
 * inference. Each incoming/outgoing source is sampled independently by its own
 * section-local cursor; looping naturally replays the same closed curve. */
export function sampleFaceCurve(curve: FacePoseCurve, cursorTick: number): number {
  driverInt(cursorTick, 'face cursor tick', 0, FACE_MAX_TICK);
  const points = curve.points;
  if (cursorTick <= points[0].atTick) return points[0].value;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    if (cursorTick <= b.atTick) return a.value + (b.value - a.value) * (cursorTick - a.atTick) / (b.atTick - a.atTick);
  }
  return points[points.length - 1].value;
}
const point = t.obj({ atTick: t.num(), value: t.num() });
export const FACE_POSE_SCHEMAS = {
  FacePose3D: t.obj({ version: t.lit(1), channels: t.rec(t.obj({
    mesh: t.str(), morph: t.str(), weight: t.union([
      t.num(), t.obj({ source: t.lit('performance-slot'), slot: t.str(), points: t.arr(point) }),
    ]),
  })) }),
} as const;
