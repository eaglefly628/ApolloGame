import { describe, expect, it } from 'vitest';
import { sceneImport3dCapability } from './index.js';
import { validateAssetRefs, validateComponentData } from '@assembly/validate-manifest.js';
import { Engine } from '../../../runtime/engine.js';
import type { SceneImportCatalog } from '@assets/scene-import-data.js';

const entities = { level: { SceneImport3D: { modelKey: 'scene/yard', rules: 'default' } } };
describe('scene-import-3d load-time capability', () => {
  it('declares a model asset reference that the shared linker validates against actual keys', () => {
    expect(validateAssetRefs([sceneImport3dCapability], entities, new Set(['scene/yard']))).toEqual([]);
    expect(validateAssetRefs([sceneImport3dCapability], entities, new Set())).toHaveLength(1);
  });
  it('validates data through the same shared schema checker as other capabilities', () => {
    expect(validateComponentData([sceneImport3dCapability], entities).errors).toEqual([]);
    expect(validateComponentData([sceneImport3dCapability], { level: { SceneImport3D: { modelKey: 42, rules: 'default' } } }).errors.length).toBeGreaterThan(0);
  });
  it('creates existing components before the first tick and never registers an import tick system', () => {
    const catalog: SceneImportCatalog = { 'scene/yard': { version: 1, sourceSha256: '0'.repeat(64), nodes: [
      { index: 0, path: [0], name: 'spawn_hero', kind: 'spawn', worldMatrix: [1,0,0,0,0,1,0,0,0,0,1,0,2,0,3,1] },
    ] } };
    const engine = new Engine(); engine.load({ capabilities: [sceneImport3dCapability], entities }, { sceneImports: catalog });
    expect(engine.world.getComponent('level', 'SceneImport3D')).toBeUndefined();
    expect(engine.world.getComponent('level/node-0', 'Transform')).toMatchObject({ x: 2, y: 3 });
    expect(sceneImport3dCapability.systems).toEqual([]);
    const before = engine.hash(); engine.world.tick(); engine.world.tick(); expect(engine.hash()).toBe(before);
  });
});
