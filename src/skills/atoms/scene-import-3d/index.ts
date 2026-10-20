import { defineCapability } from '@engine/core/define-capability.js';
import { defineComponent } from '@engine/core/define-component.js';
import { t } from '@engine/core/schema.js';

export const sceneImport3dCapability = defineCapability({
  id: 'a-scene-import-3d', version: '1.0.0',
  describe: {
    name: 'scene-import-3d', summary: 'Expand a verified static GLB scene into existing collision, navigation, picking and spawn data at load time.',
    semantic: ['scene', '3d', 'authoring'],
    whenToUse: 'Import final scene GLB nodes using the closed default col_/nav_/pick_/spawn_ convention.',
    examples: ['scene: {SceneImport3D:{modelKey:"level",rules:"default"}}; NavAgent.graphId="scene"'],
  },
  components: {
    provides: {
      SceneImport3D: defineComponent('SceneImport3D', { modelKey: t.asset('model'), rules: t.lit('default'), ground: t.opt(t.obj({ source: t.enum(['navigation', 'collision']) })) },
        { category: 'config', describe: 'Load-time static scene declaration; requires SHA-verified scene catalog.' }),
    },
    reads: [], writes: [], consumes: [],
  }, config: {}, systems: [],
});
