import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { AssetManager } from '@assets/index.js';
import type { Model3D } from '@engine/protocol/components.js';
import { ModelPool, modelSelectorSig } from './models.js';

// An actual self-contained GLB, parsed by the production GLTFLoader. Duplicate
// names deliberately require associations rather than getObjectByName().
function fixture(): ArrayBuffer {
  const positions = new Float32Array([-1,-1,-1, 1,-1,-1, 1,1,-1, -1,1,-1, -1,-1,1, 1,-1,1, 1,1,1, -1,1,1]);
  const indices = new Uint16Array([0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5]);
  const bin = new Uint8Array(positions.byteLength + indices.byteLength); bin.set(new Uint8Array(positions.buffer)); bin.set(new Uint8Array(indices.buffer), positions.byteLength);
  const doc = { asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }],
    nodes: [
      { name: 'parent', translation: [3,2,-1], rotation: [0,0,Math.sin(.4),Math.cos(.4)], scale: [2,1,.5], children: [1,4] },
      { name: 'nested', rotation: [0,Math.sin(.3),0,Math.cos(.3)], scale: [1,3,1], children: [2,3] },
      { name: 'duplicate', mesh: 0, translation: [1,0,1] },
      { name: 'duplicate', mesh: 0, translation: [-4,0,0] },
      { name: 'background', mesh: 0, translation: [0,-2,0], scale: [5,.1,5] },
    ], meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    buffers: [{ byteLength: bin.length }], bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: positions.byteLength }, { buffer: 0, byteOffset: positions.byteLength, byteLength: indices.byteLength }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 8, type: 'VEC3', min: [-1,-1,-1], max: [1,1,1] }, { bufferView: 1, componentType: 5123, count: indices.length, type: 'SCALAR' }],
  };
  const json = new TextEncoder().encode(JSON.stringify(doc)), padded = Math.ceil(json.length / 4) * 4;
  const buffer = new ArrayBuffer(12 + 8 + padded + 8 + bin.length), view = new DataView(buffer), bytes = new Uint8Array(buffer);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, buffer.byteLength, true);
  view.setUint32(12, padded, true); view.setUint32(16, 0x4e4f534a, true); bytes.fill(32, 20, 20+padded); bytes.set(json,20);
  view.setUint32(20+padded, bin.length, true); view.setUint32(24+padded, 0x004e4942, true); bytes.set(bin,28+padded); return buffer;
}
function setup() {
  const listeners = new Set<(event: { key: string }) => void>(), handle = fixture();
  const assets = { get: () => ({ handle }), onEvict(listener: (event: { key: string }) => void) { listeners.add(listener); return () => listeners.delete(listener); } } as unknown as AssetManager;
  return { pool: new ModelPool(assets), scene: new THREE.Scene(), evict(key: string) { for (const listener of listeners) listener({ key }); } };
}
const spec: Model3D = { type: 'Model3D', modelKey: 'scene' };
async function ready(pool: ModelPool, scene: THREE.Scene, id: string, model: Model3D = spec): Promise<THREE.Object3D> {
  for (let i = 0; i < 100; i++) { const object = pool.ensure(scene, id, model); if (object) return object; await Promise.resolve(); }
  throw new Error('actual GLB parse timeout');
}
function meshes(object: THREE.Object3D): THREE.Mesh[] { const result: THREE.Mesh[] = []; object.traverse(node => { if ((node as THREE.Mesh).isMesh) result.push(node as THREE.Mesh); }); return result; }
function matrix(position: number[], rotation: THREE.Quaternion, scale: number[]) { return new THREE.Matrix4().compose(new THREE.Vector3(...position), rotation, new THREE.Vector3(...scale)); }
function expectedNode(index: 2 | 3): THREE.Matrix4 {
  return matrix([3,2,-1], new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1), .8), [2,1,.5])
    .multiply(matrix([0,0,0], new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), .6), [1,3,1]))
    .multiply(new THREE.Matrix4().makeTranslation(index === 2 ? 1 : -4, 0, index === 2 ? 1 : 0));
}

describe('Model3D glTF node selection', () => {
  it('keeps the legacy constructor and entire model default; instances share geometry but own materials', async () => {
    const { pool, scene } = setup();
    const a = await ready(pool, scene, 'a'), b = await ready(pool, scene, 'b');
    expect(meshes(a)).toHaveLength(3); expect(meshes(b)).toHaveLength(3);
    expect(meshes(a)[0].geometry).toBe(meshes(b)[0].geometry); expect(meshes(a)[0].material).not.toBe(meshes(b)[0].material);
    expect(pool.ensure(scene,'a',{ ...spec })).toBe(a); pool.dispose(scene);
  });

  it('selects duplicate names by original index and preserves full ancestor shear before origin and entity pose', async () => {
    const { pool, scene } = setup(), origin = [4,2,1];
    const object = await ready(pool, scene, 'pick', { ...spec, nodeIndex: 2, origin });
    expect(meshes(object)).toHaveLength(1);
    object.position.set(9,1,-2); object.rotation.y = .45; object.scale.setScalar(1.5); object.updateWorldMatrix(true,true);
    const expected = object.matrix.clone().multiply(new THREE.Matrix4().makeTranslation(-4,-2,-1)).multiply(expectedNode(2));
    meshes(object)[0].matrixWorld.elements.forEach((value, i) => expect(value).toBeCloseTo(expected.elements[i], 10));
    // Confirm this fixture actually contains non-orthogonal basis vectors.
    const x = new THREE.Vector3().setFromMatrixColumn(expectedNode(2),0), z = new THREE.Vector3().setFromMatrixColumn(expectedNode(2),2);
    expect(Math.abs(x.dot(z))).toBeGreaterThan(.1);
    const other = await ready(pool, scene, 'other', { ...spec, nodeIndex: 3 }); other.updateWorldMatrix(true,true);
    expect(meshes(other)[0].matrixWorld.elements[12]).toBeCloseTo(expectedNode(3).elements[12],10);
    expect(meshes(other)[0].matrixWorld.elements[12]).not.toBeCloseTo(expectedNode(2).elements[12]); pool.dispose(scene);
  });

  it('removes complete excluded subtrees and does not leave the independent pick object in the background', async () => {
    const { pool, scene } = setup();
    const background = await ready(pool, scene, 'background', { ...spec, excludeNodes: [2] });
    const pick = await ready(pool, scene, 'pick', { ...spec, nodeIndex: 2 });
    expect(meshes(background)).toHaveLength(2); expect(meshes(pick)).toHaveLength(1);
    pool.sweep(scene, new Set(['background'])); expect(pick.parent).toBeNull(); expect(meshes(scene)).toHaveLength(2);
    const excludedBranch = await ready(pool, scene, 'branch', { ...spec, excludeNodes: [1] }); expect(meshes(excludedBranch)).toHaveLength(1);
    const excludedSelection = await ready(pool, scene, 'empty', { ...spec, nodeIndex: 2, excludeNodes: [1] }); expect(meshes(excludedSelection)).toHaveLength(0); pool.dispose(scene);
  });

  it('rebuilds on every selector change and disposes only clone materials until model-key eviction', async () => {
    const { pool, scene, evict } = setup();
    const original = await ready(pool,scene,'a',{ ...spec,nodeIndex:2 }), sibling = await ready(pool,scene,'b',{ ...spec,nodeIndex:3 });
    const geometry = meshes(original)[0].geometry, geometryDisposed = vi.spyOn(geometry,'dispose'), materialDisposed = vi.spyOn(meshes(original)[0].material as THREE.Material,'dispose');
    const changed = await ready(pool,scene,'a',{ ...spec,nodeIndex:3 }); expect(changed).not.toBe(original); expect(original.parent).toBeNull(); expect(materialDisposed).toHaveBeenCalledOnce(); expect(geometryDisposed).not.toHaveBeenCalled();
    const shifted = await ready(pool,scene,'a',{ ...spec,nodeIndex:3,origin:[1,2,3] }); expect(shifted).not.toBe(changed);
    const pruned = await ready(pool,scene,'a',{ ...spec,nodeIndex:3,origin:[1,2,3],excludeNodes:[2] }); expect(pruned).not.toBe(shifted);
    expect(pool.ensure(scene,'a',{ ...spec,nodeIndex:3,origin:[1,2,3],excludeNodes:[2] })).toBe(pruned);
    const otherKey = await ready(pool,scene,'other-key',{ ...spec,modelKey:'other',nodeIndex:2 });
    evict('scene'); expect(pool.count).toBe(1); expect(pruned.parent).toBeNull(); expect(sibling.parent).toBeNull(); expect(otherKey.parent).toBe(scene); expect(geometryDisposed).toHaveBeenCalledOnce();
    pool.dispose(scene); expect(geometryDisposed).toHaveBeenCalledOnce();
  });

  it('owns depth/distance materials per instance, invalidates changed shadow flags, and releases them without disposing shared textures', async () => {
    const { pool, scene } = setup();
    const a = await ready(pool, scene, 'a', { ...spec, nodeIndex: 2 }), b = await ready(pool, scene, 'b', { ...spec, nodeIndex: 2 });
    const ma = meshes(a)[0], mb = meshes(b)[0];
    expect(ma.customDepthMaterial).not.toBe(mb.customDepthMaterial);
    expect(ma.customDistanceMaterial).not.toBe(mb.customDistanceMaterial);
    const depth = ma.customDepthMaterial as THREE.MeshDepthMaterial, distance = ma.customDistanceMaterial as THREE.MeshDistanceMaterial;
    const texture = new THREE.Texture(), disposedTexture = vi.spyOn(texture, 'dispose');
    const disposal = [vi.spyOn(depth, 'dispose'), vi.spyOn(distance, 'dispose')];
    const shadowDraw = (material: THREE.Material) => ma.onBeforeShadow({} as THREE.WebGLRenderer, scene, new THREE.Camera(), new THREE.Camera(), ma.geometry, material, null as never);
    depth.map = texture; shadowDraw(depth); const mapped = depth.version;
    shadowDraw(depth); expect(depth.version).toBe(mapped);
    depth.map = null; shadowDraw(depth); expect(depth.version).toBe(mapped + 1);
    distance.map = texture; shadowDraw(distance); const pointMapped = distance.version;
    distance.map = null; shadowDraw(distance); expect(distance.version).toBe(pointMapped + 1);
    pool.sweep(scene, new Set(['b']));
    for (const dispose of disposal) expect(dispose).toHaveBeenCalledOnce();
    expect(disposedTexture).not.toHaveBeenCalled(); expect(b.parent).toBe(scene);
    pool.dispose(scene); for (const dispose of disposal) expect(dispose).toHaveBeenCalledOnce(); texture.dispose();
  });

  it('does not fall back to an entire scene for an unknown node and identities include all selectors', async () => {
    const { pool, scene } = setup(); await ready(pool,scene,'a');
    expect(() => pool.ensure(scene,'bad',{ ...spec,nodeIndex:99 })).toThrow(/no glTF node 99/); expect(pool.count).toBe(1);
    for (const selector of [{nodeIndex:2},{excludeNodes:[2]},{origin:[0,0,0]}]) expect(modelSelectorSig({...spec,...selector})).not.toBe(modelSelectorSig(spec));
    pool.dispose(scene);
  });
});
