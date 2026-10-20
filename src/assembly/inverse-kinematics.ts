import { validateIK3D } from '@engine/protocol/components/ik3d.js';
import { validateAnimGraph3D } from '@engine/protocol/components/anim-graph.js';

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/** IK consumes one model and optional same-entity numeric/flag graph parameters. */
export function validateInverseKinematics(entities: Record<string, unknown>): void {
  for (const [id, raw] of Object.entries(entities)) {
    if (!object(raw) || !Object.hasOwn(raw, 'IK3D')) continue;
    try {
      const ik = validateIK3D(raw.IK3D);
      if (!object(raw.Model3D) || typeof raw.Model3D.modelKey !== 'string' || !raw.Model3D.modelKey.trim()) throw new Error('IK3D requires Model3D with a nonempty modelKey');
      const weights = [...ik.chains.map(chain => chain.weight), ...(ik.lookAt ? [ik.lookAt.weight] : [])];
      for (const weight of weights) {
        if (typeof weight === 'number') continue;
        const graph = validateAnimGraph3D(raw.AnimGraph3D);
        if (!Object.hasOwn(graph.params, weight.param)) throw new Error(`IK3D weight references missing parameter ${weight.param}`);
        const source = graph.params[weight.param];
        if (source !== 'speed' && !source.startsWith('flag:')) throw new Error(`IK3D weight parameter ${weight.param} must have speed/flag source`);
      }
    } catch (error) {
      const message = `inverse-kinematics: ${id}: ${error instanceof Error ? error.message : String(error)}`;
      console.warn(`[inverse-kinematics] reject: ${message}`);
      throw new Error(message);
    }
  }
}
