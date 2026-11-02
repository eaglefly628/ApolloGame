import type { Component } from '../../core/types.js';
import { t } from '../../core/schema.js';
import { fnv1a32 } from '../../math/hash.js';
import { validateDriverTree, driverFields, driverInt } from './animation-driver.js';

export const CUE_SIGNAL_PREFIX = 'animation-cue:';
export const CUE_MAX_BINDINGS = 64;
export const CUE_MAX_SIGNALS = 256;
export const CUE_MAX_WORLD_SIGNALS = 4096;
export const CUE_MAX_CANONICAL = 2_000_000;
export type CueSourceKind = 'base' | 'performance' | 'locomotion' | 'motor';
export type AnimationCueMatch =
  | { readonly kind: 'base-notify'; readonly clip: string; readonly cueId: string }
  | { readonly kind: 'base-complete'; readonly clip: string }
  | { readonly kind: 'performance-notify'; readonly slot: string; readonly montage: string; readonly section?: string; readonly cueId: string }
  | { readonly kind: 'performance-complete'; readonly slot: string; readonly montage: string }
  | { readonly kind: 'plant'; readonly foot: 'left' | 'right' }
  | { readonly kind: 'jump' | 'land' };
export interface AnimationCueSignals3D extends Component {
  readonly type: 'AnimationCueSignals3D'; readonly version: 1;
  readonly maxSignalsPerTick: number;
  readonly bindings: readonly { readonly id: string; readonly match: AnimationCueMatch; readonly signal: string; readonly arg?: string }[];
}
export interface CueOwnedSignal {
  readonly entityId: string; readonly seq: number; readonly bindingId: string;
  readonly sourceKind: CueSourceKind; readonly sourceTick: number; readonly eventId: string;
}
export interface CueIdentity { readonly canonical: string; readonly fnv: number }
export interface AnimationCueSignalsPlayback3D extends Component {
  readonly type: 'AnimationCueSignalsPlayback3D'; readonly version: 1;
  readonly configIdentity: CueIdentity; readonly actorId: string; readonly seq: number;
  readonly lastSeen: Readonly<Partial<Record<CueSourceKind, { readonly tick: number; readonly identity: string; readonly snapshotCanonical: string }>>>;
  readonly owned: readonly CueOwnedSignal[];
}
export interface AnimationCueSource3D extends Component, CueOwnedSignal {
  readonly type: 'AnimationCueSource3D'; readonly version: 1;
  readonly configIdentity: CueIdentity; readonly actorId: string;
  readonly delivery: 'pending' | 'delivered';
  readonly signal: { readonly name: string; readonly source: string; readonly arg?: string };
}
export function cueReject(message: string): never { throw Error('AnimationCueSignals3D: ' + message); }
export function cueFields(value: unknown, required: readonly string[], optional: readonly string[] = []): Record<string, unknown> {
  const r = driverFields(value, [...required, ...optional], 'cue');
  if (required.some(k => !Object.hasOwn(r, k))) cueReject('missing fields'); return r;
}
export function cueText(value: unknown, label: string, max = 256): asserts value is string {
  if (typeof value !== 'string' || !value.length || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) cueReject(label + ' bounded text required');
}
function stable(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,127}$/.test(value)) cueReject('stable identifier required');
}
export function cueCanonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(cueCanonical).join(',') + ']';
  return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + cueCanonical((value as Record<string, unknown>)[k])).join(',') + '}';
}
export function cueIdentity(config: AnimationCueSignals3D): CueIdentity {
  const canonical = cueCanonical(config); return { canonical, fnv: fnv1a32(canonical) };
}
export function cueSignalId(actorId: string, seq: number): string {
  cueText(actorId, 'actor'); driverInt(seq, 'cue seq', 1, Number.MAX_SAFE_INTEGER - 1);
  let encoded: string; try { encoded = encodeURIComponent(actorId); } catch { cueReject('actor Unicode must be well formed'); }
  return CUE_SIGNAL_PREFIX + encoded + ':' + seq;
}
export function cueSourceKind(match: AnimationCueMatch): CueSourceKind {
  if (match.kind.startsWith('base-')) return 'base';
  if (match.kind.startsWith('performance-')) return 'performance';
  return match.kind === 'plant' ? 'locomotion' : 'motor';
}
export function validateAnimationCueSignals3D(value: unknown): AnimationCueSignals3D {
  validateDriverTree(value); const c = cueFields(value, ['type', 'version', 'maxSignalsPerTick', 'bindings']);
  if (c.type !== 'AnimationCueSignals3D' || c.version !== 1) cueReject('config version/type');
  driverInt(c.maxSignalsPerTick, 'signal budget', 1, CUE_MAX_SIGNALS);
  if (!Array.isArray(c.bindings) || !c.bindings.length || c.bindings.length > CUE_MAX_BINDINGS) cueReject('bindings budget');
  const ids = new Set<string>();
  for (const raw of c.bindings) {
    const b = cueFields(raw, ['id', 'match', 'signal'], ['arg']); stable(b.id); cueText(b.signal, 'signal');
    if (ids.has(b.id)) cueReject('duplicate binding id'); ids.add(b.id);
    if (b.arg !== undefined) { if (typeof b.arg !== 'string' || b.arg.length > 1024) cueReject('arg budget'); }
    const kind = (b.match as AnimationCueMatch).kind;
    if (kind === 'base-notify' || kind === 'base-complete') {
      const m = cueFields(b.match, ['kind', 'clip', ...(kind === 'base-notify' ? ['cueId'] : [])]); stable(m.clip); if (kind === 'base-notify') stable(m.cueId);
    } else if (kind === 'performance-notify' || kind === 'performance-complete') {
      const m = cueFields(b.match, ['kind', 'slot', 'montage', ...(kind === 'performance-notify' ? ['cueId'] : [])], kind === 'performance-notify' ? ['section'] : []);
      stable(m.slot); stable(m.montage); if (kind === 'performance-notify') { stable(m.cueId); if (m.section !== undefined) stable(m.section); }
    } else if (kind === 'plant') {
      const m = cueFields(b.match, ['kind', 'foot']); if (m.foot !== 'left' && m.foot !== 'right') cueReject('plant foot');
    } else if (kind === 'jump' || kind === 'land') cueFields(b.match, ['kind']);
    else cueReject('unknown match kind');
  }
  return value as AnimationCueSignals3D;
}
export function cueConfigFromIdentity(value: unknown): AnimationCueSignals3D {
  const i = cueFields(value, ['canonical', 'fnv']);
  if (typeof i.canonical !== 'string' || i.canonical.length > CUE_MAX_CANONICAL) cueReject('identity size');
  driverInt(i.fnv, 'identity digest', 0, 0xffffffff);
  let config: AnimationCueSignals3D;
  try { config = validateAnimationCueSignals3D(JSON.parse(i.canonical)); } catch { cueReject('invalid canonical config'); }
  const expected = cueIdentity(config); if (i.canonical !== expected.canonical || i.fnv !== expected.fnv) cueReject('identity mismatch'); return config;
}
function validateOwned(config: AnimationCueSignals3D, actorId: string, raw: unknown): CueOwnedSignal {
  const o = cueFields(raw, ['entityId', 'seq', 'bindingId', 'sourceKind', 'sourceTick', 'eventId']);
  driverInt(o.seq, 'owned seq', 1, Number.MAX_SAFE_INTEGER - 1); driverInt(o.sourceTick, 'source tick'); cueText(o.eventId, 'event id', 1024);
  if (o.entityId !== cueSignalId(actorId, o.seq)) cueReject('owned namespace/sequence');
  const b = config.bindings.find(b => b.id === o.bindingId); if (!b || o.sourceKind !== cueSourceKind(b.match)) cueReject('owned binding/source');
  return raw as CueOwnedSignal;
}
export function validateAnimationCueSignalsPlayback3D(config: AnimationCueSignals3D, value: unknown, actorId?: string): AnimationCueSignalsPlayback3D {
  validateAnimationCueSignals3D(config); validateDriverTree(value);
  const p = cueFields(value, ['type', 'version', 'configIdentity', 'actorId', 'seq', 'lastSeen', 'owned']);
  if (p.type !== 'AnimationCueSignalsPlayback3D' || p.version !== 1) cueReject('playback type/version');
  cueText(p.actorId, 'actor'); cueSignalId(p.actorId, 1); if (actorId !== undefined && p.actorId !== actorId) cueReject('playback actor mismatch');
  if (cueCanonical(p.configIdentity) !== cueCanonical(cueIdentity(config))) cueReject('playback config mismatch');
  driverInt(p.seq, 'playback seq', 0, Number.MAX_SAFE_INTEGER - 1);
  const needed = new Set(config.bindings.map(b => cueSourceKind(b.match))), seen = cueFields(p.lastSeen, [], [...needed]);
  for (const raw of Object.values(seen)) {
    const s = cueFields(raw, ['tick', 'identity', 'snapshotCanonical']); driverInt(s.tick, 'last seen tick');
    for (const key of ['identity', 'snapshotCanonical']) if (typeof s[key] !== 'string' || !s[key].length || s[key].length > CUE_MAX_CANONICAL) cueReject('source snapshot budget');
  }
  if (!Array.isArray(p.owned) || p.owned.length > config.maxSignalsPerTick) cueReject('owned budget');
  let seq = 0;
  for (const raw of p.owned) { const o = validateOwned(config, p.actorId, raw); if (o.seq <= seq || o.seq > p.seq) cueReject('owned order/sequence'); seq = o.seq; const source = seen[o.sourceKind] as { tick: number } | undefined; if (!source || o.sourceTick !== source.tick) cueReject('owned source tick'); }
  return value as AnimationCueSignalsPlayback3D;
}
export function cueMarker(config: AnimationCueSignals3D, actorId: string, owned: CueOwnedSignal, delivery: 'pending' | 'delivered' = 'pending'): AnimationCueSource3D {
  const b = config.bindings.find(b => b.id === owned.bindingId)!;
  return { type: 'AnimationCueSource3D', version: 1, ...owned, configIdentity: cueIdentity(config), actorId, delivery, signal: { name: b.signal, source: actorId, ...(b.arg === undefined ? {} : { arg: b.arg }) } };
}
export function validateAnimationCueSource3D(value: unknown, entityId?: string): AnimationCueSource3D {
  validateDriverTree(value); const m = cueFields(value, ['type', 'version', 'entityId', 'seq', 'bindingId', 'sourceKind', 'sourceTick', 'eventId', 'configIdentity', 'actorId', 'delivery', 'signal']);
  if (m.type !== 'AnimationCueSource3D' || m.version !== 1 || (m.delivery !== 'pending' && m.delivery !== 'delivered')) cueReject('marker type/version/delivery');
  cueText(m.actorId, 'marker actor'); const config = cueConfigFromIdentity(m.configIdentity);
  const owned = validateOwned(config, m.actorId, Object.fromEntries(['entityId', 'seq', 'bindingId', 'sourceKind', 'sourceTick', 'eventId'].map(k => [k, m[k]])));
  if (entityId !== undefined && owned.entityId !== entityId) cueReject('marker entity mismatch');
  if (cueCanonical(m) !== cueCanonical(cueMarker(config, m.actorId, owned, m.delivery))) cueReject('marker exact payload mismatch');
  return value as AnimationCueSource3D;
}
const identity = t.obj({ canonical: t.str(), fnv: t.num() });
const sourceKind = t.enum(['base', 'performance', 'locomotion', 'motor']);
const owned = { entityId: t.str(), seq: t.num(), bindingId: t.str(), sourceKind, sourceTick: t.num(), eventId: t.str() };
const match = t.union([
  t.obj({ kind: t.lit('base-notify'), clip: t.str(), cueId: t.str() }), t.obj({ kind: t.lit('base-complete'), clip: t.str() }),
  t.obj({ kind: t.lit('performance-notify'), slot: t.str(), montage: t.str(), section: t.opt(t.str()), cueId: t.str() }), t.obj({ kind: t.lit('performance-complete'), slot: t.str(), montage: t.str() }),
  t.obj({ kind: t.lit('plant'), foot: t.enum(['left', 'right']) }), t.obj({ kind: t.lit('jump') }), t.obj({ kind: t.lit('land') }),
], 'kind');
export const ANIMATION_CUE_SCHEMAS = {
  AnimationCueSignals3D: t.obj({ version: t.lit(1), maxSignalsPerTick: t.num(), bindings: t.arr(t.obj({ id: t.str(), match, signal: t.str(), arg: t.opt(t.str()) })) }),
  AnimationCueSignalsPlayback3D: t.obj({ version: t.lit(1), configIdentity: identity, actorId: t.str(), seq: t.num(), lastSeen: t.rec(t.obj({ tick: t.num(), identity: t.str(), snapshotCanonical: t.str() })), owned: t.arr(t.obj(owned)) }),
  AnimationCueSource3D: t.obj({ version: t.lit(1), ...owned, configIdentity: identity, actorId: t.str(), delivery: t.enum(['pending', 'delivered']), signal: t.obj({ name: t.str(), source: t.str(), arg: t.opt(t.str()) }) }),
} as const;
