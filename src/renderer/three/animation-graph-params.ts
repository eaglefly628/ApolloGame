import type { IWorld } from '@engine/core/types.js';
import { buildIdLookup } from '@engine/logic/index.js';
import type { Velocity } from '@engine/protocol/components.js';
import type { AnimGraph3D, AnimGraphParamValue } from '@engine/protocol/components/anim-graph.js';

const EMPTY_PARAMS: Readonly<Record<string, AnimGraphParamValue>> = Object.freeze(Object.create(null) as Record<string, AnimGraphParamValue>);

/** Renderer inputs only. No playback state or world writes belong in this projection. */
export function readAnimGraphParams(world: IWorld, entityId: string, graph: AnimGraph3D): Readonly<Record<string, AnimGraphParamValue>> {
  // Raw runtime components can be malformed before ModelPool validates/rejects them.
  // This projection stays quiet; the playback owner emits the once-only diagnostic.
  let sources: Array<[string, string]>;
  try {
    const params = graph?.params;
    if (!params || typeof params !== 'object' || Array.isArray(params)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(params))) return EMPTY_PARAMS;
    sources = Object.entries(params);
    if (!sources.length || sources.length > 64 || sources.some(([, source]) => typeof source !== 'string'
      || (source !== 'speed' && !/^(flag|state):[^\s\u0000-\u001f:][^\u0000-\u001f]*$/u.test(source)))) return EMPTY_PARAMS;
  } catch { return EMPTY_PARAMS; }
  // World.getComponent marks potential writes; renderer read views use peek instead.
  const root = (world.root ?? world) as IWorld & { readView?: () => IWorld };
  const view = root.readView?.() ?? world;
  const lookup = buildIdLookup(view);
  const values: Record<string, AnimGraphParamValue> = Object.create(null) as Record<string, AnimGraphParamValue>;
  for (const [name, source] of sources) {
    let value: AnimGraphParamValue;
    if (source === 'speed') {
      const velocity = view.getComponent<Velocity>(entityId, 'Velocity');
      if (velocity && Number.isFinite(velocity.vx) && Number.isFinite(velocity.vy)) {
        const speed = Math.hypot(velocity.vx, velocity.vy);
        value = Number.isFinite(speed) ? speed : undefined;
      }
    } else if (source.startsWith('flag:')) value = lookup.flag(source.slice(5))?.active;
    else if (source.startsWith('state:')) value = lookup.state(source.slice(6))?.current;
    values[name] = value;
  }
  return Object.freeze(values);
}
