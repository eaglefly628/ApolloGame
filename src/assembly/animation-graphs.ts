import { validateAnimGraph3D } from '@engine/protocol/components/anim-graph.js';

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/** Validate before any load-time/world mutation, including direct Engine.load. */
export function validateAnimationGraphs(entities: Record<string, unknown>): void {
  for (const [id, raw] of Object.entries(entities)) {
    if (!object(raw) || !Object.hasOwn(raw, 'AnimGraph3D')) continue;
    try {
      validateAnimGraph3D(raw.AnimGraph3D);
      if (!object(raw.Model3D) || typeof raw.Model3D.modelKey !== 'string' || !raw.Model3D.modelKey.trim())
        throw new Error('AnimGraph3D requires Model3D with a nonempty modelKey');
    } catch (error) {
      const message = `animation-graphs: ${id}: ${error instanceof Error ? error.message : String(error)}`;
      console.warn(`[animation-graphs] reject: ${message}`);
      throw new Error(message);
    }
  }
}
