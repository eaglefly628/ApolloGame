import type { Signal } from '../protocol/components/logic.js';
import { validateAnimationDriver3D, validateAnimationDriverPlayback3D, type AnimationDriver3D, type AnimationDriverPlayback3D } from '../protocol/components/animation-driver.js';
import { validateAnimationPerformance3D, validateAnimationPerformancePlayback3D, type AnimationPerformance3D, type AnimationPerformancePlayback3D } from '../protocol/components/animation-performance.js';
import { compileLocomotionDriver3D, type LocomotionDriver3D } from './locomotion-driver.js';
import { validateLocomotionPlayback3D } from './locomotion-envelope.js';
import type { LocomotionPlayback3D } from '../protocol/components/locomotion-driver.js';
import { validateCharacterMotor3D, validateCharacterMotorPlayback3D } from '../spatial/character-motor-driver.js';
import type { CharacterMotor3D, CharacterMotorPlayback3D } from '../protocol/components/character-motor.js';
import { CUE_MAX_CANONICAL, cueFields, cueCanonical, cueIdentity, cueSignalId, cueSourceKind, cueMarker, cueReject, validateAnimationCueSignals3D, validateAnimationCueSignalsPlayback3D, type AnimationCueSignals3D, type AnimationCueSignalsPlayback3D, type AnimationCueSource3D, type AnimationCueMatch, type CueOwnedSignal, type CueSourceKind } from '../protocol/components/animation-cue-signals.js';

export interface AnimationCueSources {
  readonly base?: { readonly config: AnimationDriver3D; readonly playback?: AnimationDriverPlayback3D };
  readonly performance?: { readonly config: AnimationPerformance3D; readonly playback?: AnimationPerformancePlayback3D };
  readonly locomotion?: { readonly config: LocomotionDriver3D; readonly playback?: LocomotionPlayback3D };
  readonly motor?: { readonly config: CharacterMotor3D; readonly playback?: CharacterMotorPlayback3D };
}
interface CueEvent { readonly id: string; readonly match: AnimationCueMatch }
export interface CueSourceFrame { readonly tick: number; readonly identity: string; readonly snapshotCanonical: string; readonly events: readonly CueEvent[] }
export interface AnimationCueEmission { readonly entityId: string; readonly signal: Signal; readonly marker: AnimationCueSource3D }
const sourceKinds: readonly CueSourceKind[] = ['base', 'performance', 'locomotion', 'motor'];
function boundedCanonical(v: unknown): string { const s = cueCanonical(v); if (s.length > CUE_MAX_CANONICAL) cueReject('source canonical budget'); return s; }

/** Pure source validation, shared by live planning and atomic scene loading.
 * No source is synthesized from names, timers, descriptions or pose guesses. */
export function readAnimationCueSources(config: AnimationCueSignals3D, actorId: string, sources: AnimationCueSources): Partial<Record<CueSourceKind, CueSourceFrame>> {
  validateAnimationCueSignals3D(config); cueFields(sources, [], sourceKinds);
  for (const raw of Object.values(sources)) cueFields(raw, ['config'], ['playback']);
  const base = sources.base, perf = sources.performance, loco = sources.locomotion, motor = sources.motor;
  if (base) { validateAnimationDriver3D(base.config); if (base.playback) validateAnimationDriverPlayback3D(base.config, base.playback); }
  if (perf) { validateAnimationPerformance3D(perf.config); if (perf.playback) { validateAnimationPerformancePlayback3D(perf.config, perf.playback); if (perf.playback.actorId !== actorId) cueReject('performance source actor mismatch'); } }
  const compiled = loco ? compileLocomotionDriver3D(loco.config) : undefined;
  if (loco?.playback) validateLocomotionPlayback3D(compiled!, loco.playback);
  if (motor) { validateCharacterMotor3D(motor.config); if (motor.playback) { validateCharacterMotorPlayback3D(motor.config, motor.playback); for (const e of motor.playback.events) if (e.id !== `${actorId}:${e.kind}:${e.instance}`) cueReject('motor source actor mismatch'); } }
  for (const b of config.bindings) {
    const m = b.match;
    if (m.kind === 'base-notify' || m.kind === 'base-complete') {
      if (!base || !Object.hasOwn(base.config.clips, m.clip)) cueReject('base clip reference');
      if (m.kind === 'base-notify' && !base.config.clips[m.clip].notifies?.some(n => n.id === m.cueId)) cueReject('base notify reference');
    } else if (m.kind === 'performance-notify' || m.kind === 'performance-complete') {
      const montage = perf?.config.montages[m.montage];
      if (!perf || !Object.hasOwn(perf.config.slots, m.slot) || !montage || montage.slot !== m.slot) cueReject('performance montage/slot reference');
      if (m.kind === 'performance-notify') {
        const sections = m.section === undefined ? montage.sections : montage.sections.filter(s => s.id === m.section);
        if (!sections.length || !sections.some(s => perf.config.clips[s.clip].notifies?.some(n => n.id === m.cueId && n.atTick >= s.startTick && n.atTick <= s.endTick))) cueReject('performance section/notify reference');
      }
    } else if (m.kind === 'plant') {
      if (!loco || !loco.config.gait.markers.some(marker => marker.kind === 'plant' && marker.foot === m.foot)) cueReject('declared plant source reference');
    } else if (!motor) cueReject('jump/land requires motor source');
  }
  if (estimateBound(config, sources) > config.maxSignalsPerTick) cueReject('static signal bound exceeds maxSignalsPerTick');
  const frames: Partial<Record<CueSourceKind, CueSourceFrame>> = {};
  if (base?.playback) {
    const p = base.playback;
    frames.base = { tick: p.tick, identity: boundedCanonical(base.config), snapshotCanonical: boundedCanonical(p), events: p.events.map(e => ({ id: e.id, match: e.kind === 'notify' ? { kind: 'base-notify', clip: e.alias, cueId: e.notifyId! } : { kind: 'base-complete', clip: e.alias } })) };
  }
  if (perf?.playback) {
    const p = perf.playback;
    frames.performance = { tick: p.tick, identity: boundedCanonical(perf.config), snapshotCanonical: boundedCanonical(p), events: p.events.flatMap(e => {
      if (e.kind !== 'notify' && e.kind !== 'complete') return [];
      return [{ id: e.id, match: e.kind === 'notify' ? { kind: 'performance-notify' as const, slot: e.slot, montage: e.montage, section: perf.config.montages[e.montage].sections[e.sectionIndex].id, cueId: e.cueId! } : { kind: 'performance-complete' as const, slot: e.slot, montage: e.montage } }];
    }) };
  }
  if (loco?.playback) frames.locomotion = { tick: loco.playback.playback.tick, identity: boundedCanonical(loco.config), snapshotCanonical: boundedCanonical(loco.playback), events: loco.playback.events.map(e => ({ id: e.id, match: { kind: 'plant', foot: e.foot } })) };
  if (motor?.playback) frames.motor = { tick: motor.playback.motor.tick, identity: boundedCanonical(motor.config), snapshotCanonical: boundedCanonical(motor.playback), events: motor.playback.events.map(e => ({ id: e.id, match: { kind: e.kind } })) };
  return frames;
}
function estimateBound(config: AnimationCueSignals3D, sources: AnimationCueSources): number {
  return config.bindings.reduce((sum, b) => {
    const m = b.match;
    if (m.kind === 'base-notify' || m.kind === 'base-complete') {
      const clip = sources.base!.config.graph.clips[m.clip], speed = clip.speed ?? 1;
      return sum + (speed === 0 ? 0 : clip.loop ? Math.floor(speed / sources.base!.config.clips[m.clip].durationTicks) + 2 : 1);
    }
    return sum + (m.kind === 'performance-notify' ? 2 : m.kind === 'plant' ? 64 : 1);
  }, 0);
}
/** Conservative authored bound, not runtime truncation. Requires the exact same
 * validated source references as playback; e.g. a wildcard montage notify may
 * occur at both sides of a section boundary in one fixed tick. */
export function animationCueSignalUpperBound(config: AnimationCueSignals3D, actorId: string, sources: AnimationCueSources): number {
  readAnimationCueSources(config, actorId, sources); return estimateBound(config, sources);
}
function matches(binding: AnimationCueMatch, event: AnimationCueMatch): boolean {
  if (binding.kind !== event.kind) return false;
  return Object.entries(binding).every(([key, value]) => (event as unknown as Record<string, unknown>)[key] === value);
}
/** Revalidate the saved source witnesses as source snapshots, rather than
 * trusting a fabricated owned eventId. This is structural provenance, not a
 * signature/authentication system against arbitrary replacement of a World. */
export function validateAnimationCueHistory(config: AnimationCueSignals3D, playback: AnimationCueSignalsPlayback3D, sources: AnimationCueSources): void {
  validateAnimationCueSignalsPlayback3D(config, playback);
  const current = readAnimationCueSources(config, playback.actorId, sources);
  const historical: Record<string, unknown> = { ...sources };
  for (const kind of sourceKinds) {
    const old = playback.lastSeen[kind]; if (!old) continue;
    const frame = current[kind];
    if (!frame || old.identity !== frame.identity || frame.tick < old.tick || frame.tick > old.tick + 1 || frame.tick === old.tick && old.snapshotCanonical !== frame.snapshotCanonical) cueReject('source history continuity/same source tick changed snapshot');
    let snapshot: unknown; try { snapshot = JSON.parse(old.snapshotCanonical); } catch { cueReject('source history JSON'); }
    if (cueCanonical(snapshot) !== old.snapshotCanonical) cueReject('source history canonical');
    historical[kind] = { config: sources[kind]!.config, playback: snapshot };
  }
  const frames = readAnimationCueSources(config, playback.actorId, historical as AnimationCueSources);
  for (const kind of sourceKinds) { const old = playback.lastSeen[kind]; if (old && (!frames[kind] || frames[kind]!.tick !== old.tick || frames[kind]!.identity !== old.identity)) cueReject('source history identity/tick'); }
  for (const item of playback.owned) {
    const binding = config.bindings.find(b => b.id === item.bindingId)!;
    if (!frames[item.sourceKind]?.events.some(event => event.id === item.eventId && matches(binding.match, event.match))) cueReject('owned event missing from validated source history');
  }
}
export function createAnimationCueSignals(config: AnimationCueSignals3D, actorId: string): AnimationCueSignalsPlayback3D {
  validateAnimationCueSignals3D(config);
  const p: AnimationCueSignalsPlayback3D = { type: 'AnimationCueSignalsPlayback3D', version: 1, configIdentity: cueIdentity(config), actorId, seq: 0, lastSeen: {}, owned: [] };
  validateAnimationCueSignalsPlayback3D(config, p, actorId); return p;
}
/** Repeated source tick is accepted only for the exact same validated snapshot.
 * After first observation, skipped or decreasing ticks are rejected rather than
 * pretending an unavailable intermediate cue history was delivered. */
export function stepAnimationCueSignals(config: AnimationCueSignals3D, previous: AnimationCueSignalsPlayback3D, sources: AnimationCueSources): { readonly playback: AnimationCueSignalsPlayback3D; readonly emissions: readonly AnimationCueEmission[]; readonly signalBound: number } {
  validateAnimationCueSignalsPlayback3D(config, previous);
  validateAnimationCueHistory(config, previous, sources);
  const frames = readAnimationCueSources(config, previous.actorId, sources);
  const needed = new Set(config.bindings.map(b => cueSourceKind(b.match)));
  const lastSeen = { ...previous.lastSeen }; let seq = previous.seq;
  const owned: CueOwnedSignal[] = [], emissions: AnimationCueEmission[] = [];
  for (const kind of sourceKinds) {
    if (!needed.has(kind)) continue;
    const frame = frames[kind], old = previous.lastSeen[kind];
    if (!frame) { if (old) cueReject('source playback disappeared'); continue; }
    if (old) {
      if (old.identity !== frame.identity || frame.tick < old.tick || frame.tick > old.tick + 1) cueReject('source identity/tick continuity');
      if (frame.tick === old.tick) { if (old.snapshotCanonical !== frame.snapshotCanonical) cueReject('same source tick changed snapshot'); continue; }
    }
    lastSeen[kind] = { tick: frame.tick, identity: frame.identity, snapshotCanonical: frame.snapshotCanonical };
    for (const event of frame.events) for (const binding of config.bindings) {
      if (cueSourceKind(binding.match) !== kind || !matches(binding.match, event.match)) continue;
      if (owned.length >= config.maxSignalsPerTick || seq >= Number.MAX_SAFE_INTEGER - 1) cueReject('signal/sequence budget');
      const item: CueOwnedSignal = { entityId: cueSignalId(previous.actorId, ++seq), seq, bindingId: binding.id, sourceKind: kind, sourceTick: frame.tick, eventId: event.id };
      const marker = cueMarker(config, previous.actorId, item); owned.push(item);
      emissions.push({ entityId: item.entityId, marker, signal: { type: 'Signal', ...marker.signal } });
    }
  }
  const playback: AnimationCueSignalsPlayback3D = { ...previous, lastSeen, seq, owned };
  validateAnimationCueSignalsPlayback3D(config, playback); return { playback, emissions, signalBound: estimateBound(config, sources) };
}
