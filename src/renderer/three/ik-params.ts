import {validateAnimationPerformance3D,validateAnimationPerformancePlayback3D} from '@engine/protocol/components/animation-performance.js';
import type { IWorld } from '@engine/core/types.js';
import { validateAnimGraph3D, type AnimGraph3D, type AnimGraphParamValue } from '@engine/protocol/components/anim-graph.js';
import { readAnimGraphParams } from './animation-graph-params.js';

const EMPTY_PARAMS: Readonly<Record<string, AnimGraphParamValue>> = Object.freeze(Object.create(null) as Record<string, AnimGraphParamValue>);

// Validate data descriptors before the existing graph validator touches fields.
// Every valid closed graph is shallower than this bound; malformed cyclic/deep
// objects and accessors are rejected without running arbitrary property getters.
function plainData(value: unknown, ancestors = new Set<object>(), depth = 0): boolean {
  if (!value || typeof value !== 'object') return !['function', 'symbol', 'bigint'].includes(typeof value);
  if (depth > 16 || ancestors.has(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (Array.isArray(value) ? prototype !== Array.prototype : ![Object.prototype, null].includes(prototype)) return false;
  ancestors.add(value);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (typeof key !== 'string' || !Object.hasOwn(descriptor, 'value') || !plainData(descriptor.value, ancestors, depth + 1)) return false;
  }
  ancestors.delete(value);
  return true;
}

/** IK shares E2 parameter semantics, even when no graph animation is playing. */
export function readIKParams(world: IWorld, id: string): Readonly<Record<string, AnimGraphParamValue>> {
  try {
    const root = (world.root ?? world) as IWorld & { readView?: () => IWorld };
    const view = root.readView?.() ?? world;
    const raw = view.getComponent<AnimGraph3D>(id, 'AnimGraph3D');
    if (!raw || !plainData(raw)) return EMPTY_PARAMS;
    const graph = validateAnimGraph3D(raw);
    return readAnimGraphParams(view, id, graph);
  } catch { return EMPTY_PARAMS; } // Playback owner diagnoses invalid raw IK/graph data once.
}

/** Snapshot-derived performance envelope. No E2/flag fallback and no renderer
 * delta smoothing: the fixed-tick slot already owns entry/exit fade clocks. */
export function readIKPerformanceWeights(world:IWorld,id:string):Readonly<Record<string,number>>{
 try{const root=(world.root??world) as IWorld&{readView?:()=>IWorld};const view=root.readView?.()??world;
 const config=validateAnimationPerformance3D(view.getComponent(id,'AnimationPerformance3D'));const playback=validateAnimationPerformancePlayback3D(config,view.getComponent(id,'AnimationPerformancePlayback3D'));if(playback.actorId!==id)return Object.freeze({});
 return Object.freeze(Object.fromEntries(Object.keys(config.slots).map(slot=>{const state=playback.slots[slot];return[slot,((state?.weightQ??0)+(state?.outgoing?.weightQ??0))/1000000];})));
 }catch{return Object.freeze({});}
}
