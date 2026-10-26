import type { Component } from '../../core/types.js';

export type RenderBindingTarget = 'Light3D.intensity' | 'Material3D.dissolve.progress' | 'Vfx3D.rate' | 'Glow3D.opacity';
export type RenderBindingSource =
  | { readonly kind: 'resource-ratio'; readonly id: string }
  | { readonly kind: 'flag'; readonly id: string }
  | { readonly kind: 'signal'; readonly on: string; readonly off: string; readonly arg?: 'self' }
  | { readonly kind: 'hover' };
export interface RenderBinding {
  readonly target: RenderBindingTarget;
  readonly source: RenderBindingSource;
  readonly range: readonly [number, number];
  readonly transition?: { readonly duration: number; readonly ease?: 'linear' | 'cubicOut' | 'inOut' };
}
export interface RenderBinding3D extends Component {
  readonly type: 'RenderBinding3D';
  readonly bindings: readonly RenderBinding[];
}
const TARGETS: readonly string[] = ['Light3D.intensity', 'Material3D.dissolve.progress', 'Vfx3D.rate', 'Glow3D.opacity'];
function reject(message: string): never { throw new Error(`RenderBinding3D: ${message}`); }
function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) reject('expected plain object');
  for (const key of Reflect.ownKeys(value)) {
    const d = Object.getOwnPropertyDescriptor(value, key)!;
    if (typeof key !== 'string' || !keys.includes(key) || !Object.hasOwn(d, 'value') || !d.enumerable) reject(`unknown/non-data field ${String(key)}`);
  }
  return value as Record<string, unknown>;
}
function list(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || !value.length || value.length > max) reject(`array requires 1..${max} entries`);
  for (const key of Reflect.ownKeys(value)) if (key !== 'length' && (typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length)) reject('unknown array field');
  for (let i = 0; i < value.length; i++) if (!Object.hasOwn(Object.getOwnPropertyDescriptor(value, String(i)) ?? {}, 'value')) reject('array holes/accessors');
  return value;
}
function text(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > 256) reject('id/signal requires nonempty text <=256');
}
/** Strict POD admission, shared by load boundaries and direct runtime data. Never normalizes. */
export function validateRenderBinding3D(value: unknown): RenderBinding3D {
  const data = record(value, ['type', 'bindings']);
  if (Object.hasOwn(data, 'type') && data.type !== 'RenderBinding3D') reject('type must be RenderBinding3D');
  const targets = new Set<string>();
  for (const entry of list(data.bindings, 4)) {
    const b = record(entry, ['target', 'source', 'range', 'transition']);
    if (typeof b.target !== 'string' || !TARGETS.includes(b.target) || targets.has(b.target)) reject('target must be closed and unique');
    targets.add(b.target);
    const source = record(b.source, ['kind', 'id', 'on', 'off', 'arg']);
    if (source.kind === 'flag' || source.kind === 'resource-ratio') { record(source, ['kind', 'id']); text(source.id); }
    else if (source.kind === 'signal') {
      record(source, ['kind', 'on', 'off', 'arg']); text(source.on); text(source.off);
      if (source.on === source.off) reject('signal on/off must differ');
      if (Object.hasOwn(source, 'arg') && source.arg !== 'self') reject('signal arg must be self');
    } else if (source.kind === 'hover') record(source, ['kind']);
    else reject('unknown source kind');
    const range = list(b.range, 2);
    const unit = b.target === 'Material3D.dissolve.progress' || b.target === 'Glow3D.opacity';
    if (range.length !== 2 || range.some(n => typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > (unit ? 1 : 1e6))) reject('range requires finite nonnegative endpoints (opacity/progress <=1; others <=1e6)');
    if (Object.hasOwn(b, 'transition')) {
      const t = record(b.transition, ['duration', 'ease']);
      if (typeof t.duration !== 'number' || !Number.isFinite(t.duration) || t.duration < 0 || t.duration > 600) reject('transition duration requires 0..600 seconds');
      if (Object.hasOwn(t, 'ease') && !['linear', 'cubicOut', 'inOut'].includes(t.ease as string)) reject('invalid transition ease');
    }
  }
  return value as RenderBinding3D;
}

/** Required same-entity carriers; a binding never creates components or effects. */
export function validateRenderBindingCarriers(config: RenderBinding3D, get: (type: string) => unknown): void {
  for (const binding of config.bindings) {
    const type = binding.target.split('.')[0]!, raw = get(type);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) reject(`requires ${type} on the same entity`);
    if (type === 'Material3D') {
      const d = Object.getOwnPropertyDescriptor(raw, 'dissolve');
      if (!d || !Object.hasOwn(d, 'value') || !d.value || typeof d.value !== 'object' || Array.isArray(d.value)) reject('requires authored Material3D.dissolve');
      if (Object.hasOwn(d.value, 'trigger')) reject('bound dissolve cannot also use trigger playback');
      if (!get('Mesh3D') && !get('Model3D')) reject('dissolve requires Mesh3D or Model3D');
    }
    if (binding.source.kind === 'hover' && !get('Pickable3D')) reject('hover requires Pickable3D on the same entity');
  }
}
