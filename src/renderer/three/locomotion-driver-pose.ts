/** Renderer adapter only: validate a committed locomotion snapshot, then sample
 * its absolute pose. No motor facts, live parameters or wall-clock transitions. */
import { compileLocomotionDriver3D, projectLocomotionDriver, type LocomotionDriver3D, type LocomotionPlayback } from '@engine/animation/locomotion-driver.js';
import type { LocomotionPlayback3D } from '@engine/protocol/components/locomotion-driver.js';
import type { DriverPoseSample } from './animation-driver-pose.js';
export function unwrapLocomotionPlayback(value: unknown): LocomotionPlayback {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new Error('LocomotionPlayback3D: plain wrapper required');
  const names = Object.getOwnPropertyNames(value), keys = Object.keys(value);
  if (Object.getOwnPropertySymbols(value).length || names.length !== 4 || keys.length !== 4 || ['type', 'version', 'playback', 'events'].some(k => !Object.hasOwn(value, k))) throw new Error('LocomotionPlayback3D: closed wrapper required');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.values(descriptors).some(d => !('value' in d))) throw new Error('LocomotionPlayback3D: accessor wrapper rejected');
  if (descriptors.type.value !== 'LocomotionPlayback3D' || descriptors.version.value !== 1) throw new Error('LocomotionPlayback3D: type/version rejected');
  const events: unknown = descriptors.events.value;
  if (!Array.isArray(events) || Object.getPrototypeOf(events) !== Array.prototype || events.length > 64 || Object.getOwnPropertySymbols(events).length || Object.getOwnPropertyNames(events).length !== events.length + 1 || Object.keys(events).length !== events.length) throw new Error('LocomotionPlayback3D: invalid events array');
  const ids = new Set<string>();
  for (let i = 0; i < events.length; i++) {
    const element = Object.getOwnPropertyDescriptor(events, String(i));
    if (!element || !('value' in element)) throw new Error('LocomotionPlayback3D: event accessor/sparse array');
    const event: unknown = element.value;
    if (!event || typeof event !== 'object' || Array.isArray(event) || ![Object.prototype, null].includes(Object.getPrototypeOf(event)) || Object.getOwnPropertySymbols(event).length) throw new Error('LocomotionPlayback3D: plain event required');
    const ds = Object.getOwnPropertyDescriptors(event);
    const fields = ['id', 'groupId', 'instance', 'cycle', 'markerId', 'phaseQ', 'kind', 'foot'];
    if (Object.getOwnPropertyNames(event).length !== fields.length || Object.keys(event).length !== fields.length || fields.some(k => !Object.hasOwn(ds, k) || !('value' in ds[k]))) throw new Error('LocomotionPlayback3D: closed data event required');
    const e = Object.fromEntries(fields.map(k => [k, ds[k].value]));
    const stable = (x: unknown) => typeof x === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,127}$/.test(x);
    if (!stable(e.groupId) || !stable(e.markerId) || !Number.isSafeInteger(e.instance) || e.instance < 1 || !Number.isSafeInteger(e.cycle) || e.cycle < 0 || e.cycle > 1_000_000_000 || !Number.isSafeInteger(e.phaseQ) || e.phaseQ < 0 || e.phaseQ >= 1_000_000 || e.kind !== 'plant' || !['left', 'right'].includes(e.foot) || e.id !== `${e.groupId}:${e.instance}:${e.cycle}:${e.markerId}` || ids.has(e.id)) throw new Error('LocomotionPlayback3D: invalid plant event');
    ids.add(e.id);
  }
  // Events stay snapshot-owned; this render adapter neither consumes nor emits them.
  return descriptors.playback.value as LocomotionPlayback3D['playback'];
}
export function prepareLocomotionPose(config: LocomotionDriver3D, playback: LocomotionPlayback): {
  readonly config: LocomotionDriver3D; readonly signature: string; readonly samples: readonly DriverPoseSample[];
} {
  const compiled = compileLocomotionDriver3D(config);
  const projection = projectLocomotionDriver(compiled, playback);
  return {
    config: compiled.configuration, signature: playback.configCanonical,
    samples: Object.freeze(Object.entries(projection.samples).map(([clip, sample]) => Object.freeze({ clip, timeSeconds: sample.timeSeconds, weight: sample.weight }))),
  };
}
