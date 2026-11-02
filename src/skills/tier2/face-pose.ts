import { defineCapability } from '@engine/core/define-capability.js';
import { defineComponent } from '@engine/core/define-component.js';
import { FACE_POSE_SCHEMAS, validateFacePose3D } from '@engine/protocol/components/face-pose.js';

/** Render-only named morph control. This provider creates no clock, simulation
 * state, generated visemes or fallback skeletal facial poses. */
export const facePoseCapability = defineCapability({
  id: 't2-face-pose', version: '1.0.0',
  describe: {
    name: 'face-pose', summary: 'Named native glTF morph channels, constant or driven by the same actor performance-slot snapshot.',
    semantic: ['tier2', 'animation', 'facial', 'render-only'],
    whenToUse: 'Use only when the selected model actually exposes unique named meshes and morph targets. Curves follow existing performance section ticks; this does not generate lip sync or infer emotion.',
    examples: ['Override a verified smile morph with a constant weight.', 'Drive a verified jaw morph from an explicitly authored montage-slot curve.'],
  },
  components: {
    provides: { FacePose3D: defineComponent('FacePose3D', FACE_POSE_SCHEMAS.FacePose3D.props, {
      category: 'config', sim: false,
      describe: 'Explicit named mesh/morph overrides. Missing model morphs are unsupported. Slot curves use validated actor-owned incoming/outgoing cursors and weights, with no simulation writes.',
      refine(value) { try { validateFacePose3D({ ...value, type: 'FacePose3D' }); return []; } catch (error) { return [{ path: '', severity: 'error' as const, message: String(error) }]; } },
    }) },
    reads: ['FacePose3D', 'AnimationPerformance3D', 'AnimationPerformancePlayback3D'], writes: [], consumes: [],
  },
  config: {}, systems: [],
});
