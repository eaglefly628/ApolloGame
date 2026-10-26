import { validateRenderBinding3D, validateRenderBindingCarriers } from '@engine/protocol/components/render-binding.js';

/** Atomic admission before Engine.load or either manifest entrance mutates a world. */
export function validateRenderBindings(entities: Record<string, unknown>): void {
  for (const [id, raw] of Object.entries(entities)) {
    if (!raw || typeof raw !== 'object' || !Object.hasOwn(raw, 'RenderBinding3D')) continue;
    try {
      const fields = Object.getOwnPropertyDescriptors(raw);
      if (!Object.hasOwn(fields.RenderBinding3D!, 'value')) throw new Error('non-data component');
      const config = validateRenderBinding3D(fields.RenderBinding3D!.value);
      validateRenderBindingCarriers(config, type => fields[type]?.value);
    } catch (error) {
      const message = `render-bindings: ${id}: ${error instanceof Error ? error.message : String(error)}`;
      console.warn(`[render-bindings] reject: ${message}`); throw new Error(message);
    }
  }
}
