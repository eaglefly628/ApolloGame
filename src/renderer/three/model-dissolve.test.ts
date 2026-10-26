import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { World } from '@engine/core/world.js';
import { ModelDissolves } from './model-dissolve.js';
import { DissolveSystem } from './dissolve.js';
import { applyMaterialRef } from './material.js';

function model(material: THREE.Material, geometry: THREE.BufferGeometry) {
  const object = new THREE.Group(); object.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, [material, material])); return object;
}
describe('GLB effect material ownership (native CPU materials)', () => {
  it('isolates every submesh/face and sibling, updates all progress uniforms, restores and disposes only effect clones', () => {
    const geometry = new THREE.BoxGeometry(), texture = new THREE.Texture(), original = new THREE.MeshStandardMaterial({ map: texture });
    const a = model(original, geometry), b = model(original, geometry), controller = new ModelDissolves();
    let textureDisposals = 0, geometryDisposals = 0, originalDisposals = 0, clonesDisposed = 0;
    texture.addEventListener('dispose', () => textureDisposals++); geometry.addEventListener('dispose', () => geometryDisposals++); original.addEventListener('dispose', () => originalDisposals++);
    const configs = new Map([['a', { object: a, dissolve: { progress: .2 } }], ['b', { object: b, dissolve: { progress: .8 } }]]);
    const materials = controller.sync(configs); expect(materials.get('a')).toHaveLength(3); expect(materials.get('b')).toHaveLength(3);
    const all = [...materials.get('a')!, ...materials.get('b')!]; expect(new Set(all).size).toBe(6);
    for (const material of all) { expect(material).not.toBe(original); expect((material as THREE.MeshStandardMaterial).map).toBe(texture); material.addEventListener('dispose', () => clonesDisposed++); }
    const world = new World(); for (const id of ['a', 'b']) { world.createEntity(id); world.addComponent(id, { type: 'Material3D', preset: 'matte', dissolve: { progress: id === 'a' ? .2 : .8 } }); }
    const playback = new DissolveSystem(); playback.sync(world.readView(), new Map(), 0, materials);
    for (const material of materials.get('a')!) expect(material.userData.dissolveUniforms.uDisProgress.value).toBe(.2);
    for (const material of materials.get('b')!) expect(material.userData.dissolveUniforms.uDisProgress.value).toBe(.8);
    configs.delete('a'); controller.sync(configs); expect((a.children[0] as THREE.Mesh).material).toBe(original); expect(clonesDisposed).toBe(3);
    expect(materials.get('b')![0]!.userData.dissolveUniforms.uDisProgress.value).toBe(.8);
    controller.clear(); controller.clear(); expect(clonesDisposed).toBe(6); expect(textureDisposals).toBe(0); expect(geometryDisposals).toBe(0); expect(originalDisposals).toBe(0);
    original.dispose(); geometry.dispose(); texture.dispose(); playback.dispose();
  });
  it('preserves materialRef inline dissolve and other authored effects through catalogue composition', () => {
    const input = { type: 'Material3D' as const, preset: 'matte' as const, materialRef: 'shared', dissolve: { progress: .7, pattern: 'noise' as const }, outline: { color: 0x123456 }, transparent: true };
    const output = applyMaterialRef(input, { preset: 'gold', color: 0xabcdef });
    expect(output.dissolve).toBe(input.dissolve); expect(output.outline).toBe(input.outline); expect(output.transparent).toBe(true); expect(output.color).toBe(0xabcdef); expect(input.preset).toBe('matte');
  });
  it('releases prior variants and same-id model replacements and uses distinct native shader program keys', () => {
    const geometry = new THREE.BoxGeometry(), original = new THREE.MeshStandardMaterial(), a = model(original, geometry), controller = new ModelDissolves();
    const first = controller.sync(new Map([['a', { object: a, dissolve: { pattern: 'noise' as const } }]])).get('a')![0]!;
    let freed = 0; first.addEventListener('dispose', () => freed++);
    const second = controller.sync(new Map([['a', { object: a, dissolve: { pattern: 'voronoi' as const } }]])).get('a')![0]!;
    expect(freed).toBe(1); expect(first.customProgramCacheKey()).not.toBe(second.customProgramCacheKey());
    const replacement = model(original, geometry); controller.sync(new Map([['a', { object: replacement, dissolve: {} }]]));
    expect((a.children[0] as THREE.Mesh).material).toBe(original); controller.clear(); expect((replacement.children[0] as THREE.Mesh).material).toBe(original); original.dispose(); geometry.dispose();
  });
});
