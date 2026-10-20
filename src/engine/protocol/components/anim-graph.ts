import type { Component } from '../../core/types.js';
import type { CmpOp } from './logic.js';

export type AnimGraphParamSource = 'speed' | `flag:${string}` | `state:${string}`;
export type AnimGraphParamValue = number | string | boolean | undefined;
export interface AnimGraphClip { readonly asset?: string; readonly clip: string; readonly speed?: number; readonly loop?: boolean; }
export interface AnimGraphBlendPoint { readonly at: number; readonly clip: string; }
export type AnimGraphState = { readonly clip: string; readonly blend?: never } | { readonly blend: { readonly param: string; readonly points: readonly AnimGraphBlendPoint[] }; readonly clip?: never };
export interface AnimGraphTransition { readonly from: string; readonly to: string; readonly whenParam: string; readonly cmp: CmpOp; readonly value: number | string | boolean; readonly fade: number; }
/** E2: render-only inputs. The renderer owns all playback state; no sim feedback. */
export interface AnimGraph3D extends Component {
  readonly type: 'AnimGraph3D';
  readonly clips: Readonly<Record<string, AnimGraphClip>>;
  readonly states: Readonly<Record<string, AnimGraphState>>;
  readonly transitions: readonly AnimGraphTransition[];
  readonly params: Readonly<Record<string, AnimGraphParamSource>>;
}

function reject(message: string): never { throw new Error(`AnimGraph3D: ${message}`); }
function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) reject(`${label} must be a plain object`);
  return value as Record<string, unknown>;
}
function fields(value: unknown, allowed: readonly string[], label: string): Record<string, unknown> {
  const data = record(value, label); for (const key of Object.keys(data)) if (!allowed.includes(key)) reject(`${label}: unknown field ${key}`); return data;
}
function text(value: unknown, label: string): asserts value is string { if (typeof value !== 'string' || !value.trim() || /[\u0000-\u001f]/u.test(value) || value.length > 256) reject(`${label} must be nonempty text (max256)`); }
function finite(value: unknown, label: string, min = -Infinity, max = Infinity): asserts value is number { if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) reject(`${label} must be finite in ${min}..${max}`); }
function aliases(value: unknown, label: string): Record<string, unknown> {
  const data = record(value, label), names = Object.keys(data);
  if (names.length < 1 || names.length > 64) reject(`${label} needs 1..64 entries`);
  for (const key of names) if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(key) || key.length > 128) reject(`${label}: invalid stable alias ${key}`);
  return data;
}
function reference(value: unknown, table: Record<string, unknown>, label: string): asserts value is string { text(value, label); if (!Object.hasOwn(table, value)) reject(`${label}: missing alias ${value}`); }

/** Validate at every authoring/load boundary; data is never normalized or mutated. */
export function validateAnimGraph3D(value: unknown): AnimGraph3D {
  const data = fields(value, ['type','clips','states','transitions','params'], 'graph');
  if (data.type !== undefined && data.type !== 'AnimGraph3D') reject('type must be AnimGraph3D');
  const clips = aliases(data.clips, 'clips'), states = aliases(data.states, 'states'), params = aliases(data.params, 'params');
  for (const [name, raw] of Object.entries(clips)) {
    const clip = fields(raw, ['asset','clip','speed','loop'], `clips.${name}`); text(clip.clip, `clips.${name}.clip`);
    if (Object.hasOwn(clip, 'asset')) text(clip.asset, `clips.${name}.asset`);
    if (Object.hasOwn(clip, 'speed')) finite(clip.speed, `clips.${name}.speed`, 0, 16);
    if (Object.hasOwn(clip, 'loop') && typeof clip.loop !== 'boolean') reject(`clips.${name}.loop must be boolean`);
  }
  for (const [name, source] of Object.entries(params)) {
    text(source, `params.${name}`);
    if (source !== 'speed' && !/^(flag|state):[^\s\u0000-\u001f:][^\u0000-\u001f]*$/u.test(source)) reject(`params.${name}: source must be speed, flag:<id> or state:<fsm>`);
  }
  for (const [name, raw] of Object.entries(states)) {
    const state = fields(raw, ['clip','blend'], `states.${name}`), simple = Object.hasOwn(state, 'clip'), blend = Object.hasOwn(state, 'blend');
    if (simple === blend) reject(`states.${name}: exactly one of clip/blend is required`);
    if (simple) reference(state.clip, clips, `states.${name}.clip`);
    else {
      const b = fields(state.blend, ['param','points'], `states.${name}.blend`); reference(b.param, params, `states.${name}.blend.param`);
      if (params[b.param] !== 'speed') reject(`states.${name}: blend parameter must have numeric speed source`);
      if (!Array.isArray(b.points) || b.points.length < 2 || b.points.length > 64) reject(`states.${name}: blend needs 2..64 points`);
      let previous = -Infinity;
      for (const rawPoint of b.points) {
        const point = fields(rawPoint, ['at','clip'], `states.${name}.point`); finite(point.at, 'blend.at');
        if (point.at <= previous) reject('blend.at must be strictly increasing'); previous = point.at; reference(point.clip, clips, 'blend.clip');
      }
    }
  }
  if (!Array.isArray(data.transitions) || data.transitions.length > 256) reject('transitions must be an array (max256)');
  for (const raw of data.transitions) {
    const transition = fields(raw, ['from','to','whenParam','cmp','value','fade'], 'transition');
    reference(transition.from, states, 'transition.from'); reference(transition.to, states, 'transition.to'); reference(transition.whenParam, params, 'transition.whenParam');
    if (!['eq','ne','gt','gte','lt','lte'].includes(transition.cmp as string)) reject('transition.cmp must be eq/ne/gt/gte/lt/lte');
    const source = params[transition.whenParam] as string;
    if (source === 'speed') finite(transition.value, 'transition.value');
    else {
      if (transition.cmp !== 'eq' && transition.cmp !== 'ne') reject('boolean/string parameters support only eq/ne');
      if (source.startsWith('flag:') ? typeof transition.value !== 'boolean' : typeof transition.value !== 'string') reject('transition.value must match parameter source type');
      if (typeof transition.value === 'string') text(transition.value, 'transition.value');
    }
    finite(transition.fade, 'transition.fade', 0, 60);
  }
  return value as AnimGraph3D;
}
