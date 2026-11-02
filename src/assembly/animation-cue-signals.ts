import type { Component, IWorld } from '../engine/core/types.js';
import { validateDriverTree, driverFields, driverInt } from '../engine/protocol/components/animation-driver.js';
import { cueReject } from '../engine/protocol/components/animation-cue-signals.js';
import { validateAnimationCueWorld } from '../engine/animation/cue-signals-world.js';

const cueTypes = ['AnimationCueSignals3D', 'AnimationCueSignalsPlayback3D', 'AnimationCueSource3D'];
const sourceTypes = ['AnimationDriver3D', 'AnimationDriverPlayback3D', 'AnimationPerformance3D', 'AnimationPerformancePlayback3D', 'LocomotionDriver3D', 'LocomotionPlayback3D', 'CharacterMotor3D', 'CharacterMotorPlayback3D'];
/** Atomic all-merged-scene validation. The legacy-only fast path never reads
 * component values. No capability/provider, system or actual World is imported. */
export function validateAnimationCueSignals(entities: Record<string, unknown>, tickRate?: number): void {
  const descriptors = Object.getOwnPropertyDescriptors(entities);
  const relevant = Object.values(descriptors).some(d => 'value' in d && d.value && typeof d.value === 'object' && cueTypes.some(k => Object.hasOwn(d.value, k)));
  if (!relevant) return;
  driverFields(entities, Object.keys(entities), 'cue entities');
  if (tickRate !== undefined) driverInt(tickRate, 'cue Engine tickRate', 1, 240);
  const rows = new Map<string, Map<string, Component>>();
  for (const [id, raw] of Object.entries(entities)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) cueReject('entity component map required');
    const row = driverFields(raw, Object.keys(raw), 'cue entity');
    const components = new Map<string, Component>();
    for (const [type, value] of Object.entries(row)) {
      if ([...cueTypes, ...sourceTypes].includes(type) || type === 'Signal' && Object.hasOwn(row, 'AnimationCueSource3D')) {
        validateDriverTree(value);
        if (!value || typeof value !== 'object' || Array.isArray(value)) cueReject('component object required');
        if (Object.hasOwn(value, 'type') && (value as { type: unknown }).type !== type) cueReject('conflicting component type');
        components.set(type, { ...value, type });
      } else components.set(type, value as Component);
    }
    rows.set(id, components);
  }
  const view: Pick<IWorld, 'query' | 'getComponent' | 'getAllEntities'> = {
    getAllEntities: () => [...rows.keys()],
    getComponent: <T extends Component>(id: string, type: string) => rows.get(id)?.get(type) as T | undefined,
    query: (...types: string[]) => [...rows].filter(([, row]) => types.every(t => row.has(t))),
  };
  validateAnimationCueWorld(view);
  if (tickRate !== undefined) for (const components of rows.values()) for (const [type, c] of components) {
    if (!components.has('AnimationCueSignals3D') || !sourceTypes.includes(type) || type.endsWith('Playback3D')) continue;
    const data = c as unknown as { tickRate?: number; motion?: { tickRate: number } };
    if ((type === 'CharacterMotor3D' ? data.motion?.tickRate : data.tickRate) !== tickRate) cueReject('source clock differs from Engine tickRate');
  }
}
