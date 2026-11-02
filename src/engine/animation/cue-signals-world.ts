import type { IWorld } from '../core/types.js';
import type { Signal } from '../protocol/components/logic.js';
import { validateDriverTree } from '../protocol/components/animation-driver.js';
import { CUE_MAX_WORLD_SIGNALS, cueCanonical, cueReject, validateAnimationCueSignals3D, validateAnimationCueSignalsPlayback3D, validateAnimationCueSource3D, type AnimationCueSignals3D, type AnimationCueSignalsPlayback3D, type AnimationCueSource3D } from '../protocol/components/animation-cue-signals.js';
import { createAnimationCueSignals, stepAnimationCueSignals, animationCueSignalUpperBound, validateAnimationCueHistory, type AnimationCueSources, type AnimationCueEmission } from './cue-signals.js';

/** No systems/capabilities imported by the pure core or assembly validator. */
export function animationCueSourcesFromWorld(view: Pick<IWorld, 'getComponent'>, id: string): AnimationCueSources {
  const result: Record<string, unknown> = {};
  for (const [kind, configType, playbackType] of [
    ['base', 'AnimationDriver3D', 'AnimationDriverPlayback3D'], ['performance', 'AnimationPerformance3D', 'AnimationPerformancePlayback3D'],
    ['locomotion', 'LocomotionDriver3D', 'LocomotionPlayback3D'], ['motor', 'CharacterMotor3D', 'CharacterMotorPlayback3D'],
  ]) {
    const config = view.getComponent(id, configType), playback = view.getComponent(id, playbackType);
    if (playback && !config) cueReject('orphan source playback: ' + playbackType);
    if (config) result[kind] = { config, ...(playback ? { playback } : {}) };
  }
  return result as AnimationCueSources;
}
interface CueActor { id: string; config: AnimationCueSignals3D; playback: AnimationCueSignalsPlayback3D; sources: AnimationCueSources }
function actors(view: Pick<IWorld, 'query' | 'getComponent'>): CueActor[] {
  const ids = new Set([...view.query('AnimationCueSignals3D'), ...view.query('AnimationCueSignalsPlayback3D')].map(([id]) => id));
  if (ids.size > 4096) cueReject('actor budget');
  const rows: CueActor[] = []; let bound = 0;
  for (const id of [...ids].sort()) {
    const config = view.getComponent<AnimationCueSignals3D>(id, 'AnimationCueSignals3D');
    if (!config) cueReject('orphan cue playback'); validateAnimationCueSignals3D(config);
    const playback = view.getComponent<AnimationCueSignalsPlayback3D>(id, 'AnimationCueSignalsPlayback3D') ?? createAnimationCueSignals(config, id);
    validateAnimationCueSignalsPlayback3D(config, playback, id);
    const sources = animationCueSourcesFromWorld(view, id); validateAnimationCueHistory(config, playback, sources); bound += animationCueSignalUpperBound(config, id, sources);
    if (bound > CUE_MAX_WORLD_SIGNALS) cueReject('world static signal bound');
    rows.push({ id, config, playback, sources });
  }
  return rows;
}
/** A marker is an owned event entity, never authority to delete another actor.
 * Even a forged playback cannot widen the reserved ID or permitted component set. */
function markers(view: Pick<IWorld, 'query' | 'getComponent' | 'getAllEntities'>, owners: readonly CueActor[]): AnimationCueSource3D[] {
  const all = new Set(view.getAllEntities()), actorMap = new Map(owners.map(a => [a.id, a]));
  const rows = view.query('AnimationCueSource3D'); if (rows.length > CUE_MAX_WORLD_SIGNALS) cueReject('world marker budget');
  const result: AnimationCueSource3D[] = [], byId = new Set<string>();
  for (const [id, components] of [...rows].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    const marker = validateAnimationCueSource3D(view.getComponent(id, 'AnimationCueSource3D'), id);
    if ([...components.keys()].some(k => k !== 'AnimationCueSource3D' && k !== 'Signal')) cueReject('foreign components on owned cue entity');
    const actual = view.getComponent<Signal>(id, 'Signal');
    if (actual) { validateDriverTree(actual); if (cueCanonical(actual) !== cueCanonical({ type: 'Signal', ...marker.signal })) cueReject('foreign Signal on owned cue entity'); }
    const owner = actorMap.get(marker.actorId);
    if (owner) {
      const owned = owner.playback.owned.find(o => o.entityId === id);
      if (!owned || cueCanonical(marker.configIdentity) !== cueCanonical(owner.playback.configIdentity) || Object.entries(owned).some(([key, value]) => (marker as unknown as Record<string, unknown>)[key] !== value)) cueReject('marker not authenticated by owner playback');
    } else if (all.has(marker.actorId)) cueReject('cue marker belongs to an untracked/reused live actor');
    result.push(marker); byId.add(id);
  }
  for (const owner of owners) for (const item of owner.playback.owned) if (all.has(item.entityId) && !byId.has(item.entityId)) cueReject('owned event ID was replaced by a foreign entity');
  return result;
}
export function planAnimationCueDelivery(view: Pick<IWorld, 'query' | 'getComponent' | 'getAllEntities'>): readonly AnimationCueSource3D[] {
  const pending = markers(view, actors(view)).filter(m => m.delivery === 'pending');
  return pending.map(m => ({ ...m, delivery: 'delivered' }));
}
export function planAnimationCuePublication(view: Pick<IWorld, 'query' | 'getComponent' | 'getAllEntities'>): {
  readonly cleanup: readonly string[]; readonly playback: readonly { readonly actorId: string; readonly value: AnimationCueSignalsPlayback3D }[]; readonly emissions: readonly AnimationCueEmission[];
} {
  const owners = actors(view), old = markers(view, owners), existing = new Set(view.getAllEntities());
  if (old.some(m => m.delivery !== 'delivered')) cueReject('pending cue must be delivered before cleanup');
  const playback: { actorId: string; value: AnimationCueSignalsPlayback3D }[] = [], emissions: AnimationCueEmission[] = [];
  for (const owner of owners) {
    const next = stepAnimationCueSignals(owner.config, owner.playback, owner.sources);
    if (emissions.length + next.emissions.length > CUE_MAX_WORLD_SIGNALS) cueReject('world runtime signal budget');
    for (const e of next.emissions) if (existing.has(e.entityId)) cueReject('dynamic cue entity ID collision');
    emissions.push(...next.emissions); playback.push({ actorId: owner.id, value: next.playback });
  }
  return { cleanup: old.map(m => m.entityId), playback, emissions };
}
export function validateAnimationCueWorld(view: Pick<IWorld, 'query' | 'getComponent' | 'getAllEntities'>): void { markers(view, actors(view)); }
