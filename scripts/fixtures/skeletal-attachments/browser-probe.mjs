// E3 actual browser/GPU evidence; generic Blender fixtures and marker props only.
import * as THREE from 'three';
import { ThreeRenderer } from '../../../src/renderer/three-renderer.ts';
import { createManifestAssets } from '../../../src/services/scene-game-assets.ts';
import { parseAssetIndex, registerAssetIndex } from '../../../src/assets/asset-index.ts';
import { Engine } from '../../../src/runtime/engine.ts';
import { resolveCapabilities } from '../../../src/assembly/capability-registry.ts';
import { hashSnapshot } from '../../../src/net/determinism.ts';
import { mesh3dBatchKey } from '../../../src/renderer/three-projection.ts';
import { voxelMode } from '../../../src/renderer/three/geometry.ts';
import { pbrSig } from '../../../src/renderer/three/material.ts';

const ensure = (value, message) => { if (!value) throw new Error(message); };
const maxError = (a, b) => Math.max(...a.map((value, i) => Math.abs(value - b[i])));
let clock = 1000, readOnlyChecks = 0, observedDraws = 0;
Object.defineProperty(performance, 'now', { configurable: true, value: () => clock });
const warnings = [], nativeWarn = console.warn.bind(console);
console.warn = (...args) => { warnings.push(args.map(String).join(' ')); nativeWarn(...args); };
const assets = createManifestAssets(), backend = new ThreeRenderer({ assets, width: 800, height: 560, dprCap: 1, antialias: false, shadowMapSize: 512 });
backend.init(document.getElementById('stage'));
backend.resize(800, 560);
const gl = backend.gl.getContext(), engine = new Engine(), replica = new Engine(), world = engine.world;
// Track actual native buffer ownership after renderer init. Every GL operation
// still executes unchanged; geometry counters alone cannot see instance buffers.
const trackedBuffers = new Set(); let buffersCreated = 0, buffersDeleted = 0;
const createBuffer = gl.createBuffer.bind(gl), deleteBuffer = gl.deleteBuffer.bind(gl);
gl.createBuffer = (...args) => { const buffer = createBuffer(...args); if (buffer) { trackedBuffers.add(buffer); buffersCreated++; } return buffer; };
gl.deleteBuffer = buffer => { deleteBuffer(buffer); if (trackedBuffers.delete(buffer)) buffersDeleted++; };
const buffers = () => ({ live: trackedBuffers.size, created: buffersCreated, deleted: buffersDeleted, initBaseline: 0 });
const graph = { type: 'AnimGraph3D', clips: { walk: { asset: 'motion/walk', clip: 'walk' }, reach: { asset: 'motion/reach', clip: 'reach', loop: false } }, states: { walking: { clip: 'walk' }, reaching: { clip: 'reach' } }, transitions: [{ from: 'walking', to: 'reaching', whenParam: 'reach', cmp: 'eq', value: true, fade: .15 }, { from: 'reaching', to: 'walking', whenParam: 'reach', cmp: 'eq', value: false, fade: .15 }], params: { reach: 'flag:reach' } };
const attach = (parentId, offset, rot = [.2, -.35, .4], bone = 'RightHand') => ({ type: 'Attach3D', parentId, bone, offset, rot });
const marker = (color = 0xffaa22) => ({ shape: 'box', width: .22, height: .25, depth: .18, frontTint: color });
const raw = { entities: {
  camera: { Camera3D: { yaw: .25, pitch: .4, distance: 7.5, pivotX: 0, pivotY: 1, pivotZ: 0, near: .1, far: 40 } },
  floor: { Transform3D: { x: 0, y: -.1, z: 0 }, Mesh3D: { shape: 'box', width: 9, height: .15, depth: 6, frontTint: 0x8592a1 } },
  flags: { Flag: { id: 'reach', active: false } },
  actor: { Transform3D: { x: 0, y: 0, z: 0, rotY: .35, rotZ: .1, scaleX: 1.2, scaleY: .85, scaleZ: 1.35 }, Model3D: { modelKey: 'model/a' }, AnimGraph3D: structuredClone(graph), Visibility: { visible: true, active: true } },
  'model-prop': { Transform3D: { x: -2, y: .4, z: 0, scale: .16 }, Model3D: { modelKey: 'model/prop', scale: .8 }, Attach3D: attach('actor', [0, .2, .1]) },
  plain: { Transform3D: { x: -2.1, y: .7, z: 0, rotX: .2, rotY: .1, rotZ: .3, scaleX: .8, scaleY: 1.1, scaleZ: .7 }, Mesh3D: marker(), Attach3D: attach('actor', [.15, -.15, .15]), Pickable3D: { signal: 'pick-fixture' } },
  pbr: { Transform3D: { x: -2.3, y: .7, z: .3, scale: .7 }, Mesh3D: marker(0x42d9af), Material3D: { preset: 'plastic', color: 0x42d9af, roughness: .25, outline: { width: .015, color: 0x111122 } }, Attach3D: attach('actor', [.35, .15, .15]) },
  'pbr-batchable': { Transform3D: { x: -2.2, y: .7, z: .6, scale: .6 }, Mesh3D: marker(0x2288ff), Material3D: { preset: 'plastic', color: 0x2288ff, roughness: .3 }, Attach3D: attach('actor', [.55, .35, .2]) },
  transparent: { Transform3D: { x: -2.4, y: .7, z: .4, scale: .7 }, Mesh3D: marker(0xff66bb), Color: { r: 1, g: .4, b: .7, alpha: .55 }, Attach3D: attach('actor', [-.3, .15, .2]) },
  dice: { Transform3D: { x: -2.6, y: .7, z: .5, scale: .6 }, Mesh3D: { ...marker(0xeeeeff), dieFaces: Array.from({ length: 6 }, (_, i) => ({ color: 0xeeeeff, pip: i + 1 })) }, Attach3D: attach('actor', [.2, .45, .2]) },
  voxel: { Transform3D: { x: -2.7, y: .7, z: .6, scale: .6 }, Mesh3D: { ...marker(0x55c755), voxelTex: { top: 0x55c755, side: 0x39773e, pattern: 'plain', tile: .1 } }, Attach3D: attach('actor', [-.2, .45, .2]) },
  nested: { Transform3D: { x: -3, y: .5, z: 0, scale: .2 }, Model3D: { modelKey: 'model/a' }, Attach3D: attach('actor', [.5, .1, -.15]) },
  'nested-leaf': { Transform3D: { x: -3, y: .7, z: .2, scale: .4 }, Mesh3D: marker(0xff4444), Attach3D: attach('nested', [.1, .1, .1]) },
} };
const attached = ['model-prop', 'plain', 'pbr', 'pbr-batchable', 'transparent', 'dice', 'voxel', 'nested', 'nested-leaf'];
const initialAttach = Object.fromEntries(attached.map(id => [id, structuredClone(raw.entities[id].Attach3D)]));
const caps = resolveCapabilities(['a1-transform', 'b1-velocity', 'b3-mass', 't1-motion-apply']);
engine.load({ ...raw, capabilities: caps });
const replicaRaw = structuredClone(raw); for (const components of Object.values(replicaRaw.entities)) { delete components.Attach3D; delete components.AnimGraph3D; }
replica.load({ ...replicaRaw, capabilities: caps });
window.e3Report = {};
const record = (name, value) => (window.e3Report[name] = value);
const drawMatrices = new WeakMap(), instanceBuffers = new WeakMap(), monitored = new WeakSet(); let activeMesh;
const observedTextures = new Map();
function watchTextures() { backend.scene.traverse(mesh => { if (!mesh.material) return; const owner = [...backend.meshes].find(([, value]) => value === mesh)?.[0] ?? [...backend.batches.batches].find(([, value]) => value.mesh === mesh)?.[0] ?? mesh.name; for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) for (const [slot, texture] of Object.entries(material)) { if (!texture?.isTexture) continue; let record = observedTextures.get(texture); if (!record) { record = { uuid: texture.uuid, name: texture.name, width: texture.image?.width, height: texture.image?.height, shared: texture.userData?.shared, slots: [], owners: [], disposals: 0 }; observedTextures.set(texture, record); texture.addEventListener('dispose', () => record.disposals++); } if (!record.slots.includes(slot)) record.slots.push(slot); if (!record.owners.includes(owner)) record.owners.push(owner); } }); }
// Observe native uniform uploads at actual GL draws; keep every native call intact.
for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
  const native = gl[name].bind(gl);
  gl[name] = (...args) => { native(...args); if (!activeMesh) return; const program = gl.getParameter(gl.CURRENT_PROGRAM), location = gl.getUniformLocation(program, 'modelViewMatrix'); if (location) { drawMatrices.set(activeMesh, Array.from(gl.getUniform(program, location))); observedDraws++; } if (activeMesh.isInstancedMesh) { const handles = {}; for (const [key, attribute] of [['matrix', 'instanceMatrix'], ['color', 'instanceColor']]) { const index = gl.getAttribLocation(program, attribute); if (index >= 0) handles[key] = gl.getVertexAttrib(index, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING); } instanceBuffers.set(activeMesh, handles); } };
}
function watch() { let added = 0; backend.scene.traverse(mesh => { if (!mesh.isMesh || monitored.has(mesh)) return; monitored.add(mesh); added++; const before = mesh.onBeforeRender; mesh.onBeforeRender = function (...args) { before.apply(this, args); activeMesh = this; }; const shadow = mesh.onBeforeShadow; mesh.onBeforeShadow = function (...args) { shadow.apply(this, args); activeMesh = undefined; }; }); return added; }
function sync(dt = 1 / 16) {
  clock += dt * 1000; watch();
  const before = JSON.stringify(world.snapshot()), hash = hashSnapshot(world.snapshot()), version = world.getVersion(); backend.sync(world.readView());
  // A drawable can be allocated inside sync after hooks were installed. Render
  // it once with unchanged clock/data after observing it, so GPU evidence comes
  // from a real draw even when the scene would otherwise already be static.
  if (watch() > 0) { backend.lastRenderSig = ''; backend.sync(world.readView()); }
  watchTextures();
  ensure(before === JSON.stringify(world.snapshot()) && hash === hashSnapshot(world.snapshot()) && version === world.getVersion(), 'Attachment renderer changed world snapshot/hash/version'); readOnlyChecks++;
  return backend.readStats().rendered;
}
function object(id) { return backend.models.instance(id) ?? backend.meshes.get(id); }
function allMeshes(object) { const result = []; object.traverse(node => { if (node.isMesh) result.push(node); }); return result; }
function matrices(id, fallback = false) {
  const config = world.peek(id, 'Attach3D'), parent = backend.models.instance(config.parentId), child = object(id); ensure(parent && child, 'Missing actual attachment objects for ' + id);
  parent.updateWorldMatrix(true, true); child.updateWorldMatrix(true, true);
  let bone; parent.traverse(node => { if (node.isBone && node.name === config.bone) bone = node; });
  const source = fallback ? parent : bone; ensure(source, 'Expected actual named bone ' + config.bone);
  const t = world.peek(id, 'Transform3D'), model = world.peek(id, 'Model3D'), ms = model?.scale ?? 1;
  const scale = new THREE.Vector3((t.scaleX ?? t.scale ?? 1) * ms, (t.scaleY ?? t.scale ?? 1) * ms, (t.scaleZ ?? t.scale ?? 1) * ms);
  const local = new THREE.Matrix4().compose(new THREE.Vector3(...config.offset), new THREE.Quaternion().setFromEuler(new THREE.Euler(...config.rot, 'XYZ')), scale);
  const expected = source.matrixWorld.clone().multiply(local), cpuError = maxError(expected.elements, child.matrixWorld.elements);
  ensure(cpuError < 1e-8, 'Attachment lost full bone world matrix for ' + id + ': ' + cpuError);
  let gpuError = 0, gpuSamples = 0;
  for (const mesh of allMeshes(child)) { const uploaded = drawMatrices.get(mesh); if (!uploaded) continue; const gpuWorld = backend.cameras.current.matrixWorld.clone().multiply(new THREE.Matrix4().fromArray(uploaded)), relative = child.matrixWorld.clone().invert().multiply(mesh.matrixWorld), expectedDraw = expected.clone().multiply(relative); gpuError = Math.max(gpuError, maxError(gpuWorld.elements, expectedDraw.elements)); gpuSamples++; }
  ensure(gpuSamples > 0 && gpuError < 3e-5, 'Uploaded native draw matrix disagrees for ' + id + ': ' + gpuError + ' samples=' + gpuSamples);
  const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); expected.decompose(p, q, s); const lossy = new THREE.Matrix4().compose(p, q, s), shear = maxError(expected.elements, lossy.elements);
  return { id, cpuError, gpuError, gpuSamples, shearLostByTRS: shear, expected: expected.toArray(), actual: child.matrixWorld.toArray() };
}
function digest(bytes) { let h = 2166136261; for (const byte of bytes) h = Math.imul(h ^ byte, 16777619); return (h >>> 0).toString(16); }
function pixels() { const data = new Uint8Array(800 * 560 * 4); gl.readPixels(0, 0, 800, 560, gl.RGBA, gl.UNSIGNED_BYTE, data); return digest(data); }
function shadow() { const target = backend.lights.key.shadow.map; ensure(target, 'Native shadow map missing'); const data = new Uint8Array(target.width * target.height * 4); backend.gl.readRenderTargetPixels(target, 0, 0, target.width, target.height, data); return { hash: digest(data), uploaded: gl.isTexture(backend.gl.properties.get(target.texture).__webglTexture) }; }
function screen(position) { const p = position.clone().project(backend.cameras.current), rect = backend.gl.domElement.getBoundingClientRect(); return { x: rect.left + (p.x + 1) * rect.width / 2, y: rect.top + (1 - p.y) * rect.height / 2 }; }
function pickAt(position) { const point = screen(position); return { point, hit: backend.pick(point.x, point.y) }; }
function origin(id) { return new THREE.Vector3().setFromMatrixPosition(object(id).matrixWorld); }
function resources() { return { gpu: { ...backend.gl.info.memory }, buffers: buffers(), instances: backend.models.instances.size, templates: backend.models.cache.size, motions: backend.models.motions.size, pendingModels: backend.models.parsing.size, pendingMotions: backend.models.motionParsing.size, attachedObjects: attached.filter(id => !!object(id)).length }; }
function edit(type, id, values) { for (const current of [world, replica.world]) { Object.assign(current.getComponent(id, type), values); current.markDirty(id, type); } }
function setAttach(id, config) { world.addComponent(id, structuredClone(config)); }
function hidden(id) { const value = object(id); if (!value) return true; for (let node = value; node; node = node.parent) if (!node.visible) return true; return false; }
async function ready() { for (let i = 0; i < 300; i++) { sync(); if (backend.models.instance('actor') && backend.models.instance('model-prop') && backend.models.instance('nested') && backend.models.graphs.get('actor')?.controller && attached.every(id => object(id) && !hidden(id))) { sync(); return; } await new Promise(resolve => requestAnimationFrame(resolve)); } throw new Error('Formal model/attachment readiness timeout: ' + JSON.stringify(resources())); }
function compareHashes(tick) { const a = hashSnapshot(world.snapshot()), b = hashSnapshot(replica.world.snapshot()); ensure(a === b, 'E3 simulation replica hash mismatch tick ' + tick); return a; }
window.e3Probe = {
  async load() {
    const index = parseAssetIndex(await (await fetch('/fixtures/index.json')).json()); registerAssetIndex(assets, index, '/'); await assets.preloadGroup('cast'); await ready();
    const ext = gl.getExtension('WEBGL_debug_renderer_info'), evidence = attached.map(id => matrices(id));
    ensure(evidence.some(row => row.shearLostByTRS > .01), 'Fixture does not exercise nonuniform scale/shear');
    const transparentMaterials = Array.isArray(object('transparent').material) ? object('transparent').material : [object('transparent').material];
    const routes = { outlineChildren: object('pbr').children.length, transparent: transparentMaterials.map(material => ({ transparent: material.transparent, opacity: material.opacity })), diceMaterials: Array.isArray(object('dice').material), voxelMaterials: Array.isArray(object('voxel').material) };
    record('routes', routes);
    ensure(routes.outlineChildren > 0 && transparentMaterials.every(material => material.transparent && material.opacity < 1) && routes.diceMaterials && routes.voxelMaterials, 'Existing PBR outline/transparent/dice/voxel routes were not preserved: ' + JSON.stringify(routes));
    return record('load', { webgl: gl.getParameter(gl.VERSION), gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), routes, matrices: evidence, pixels: pixels(), shadow: shadow(), resources: resources(), fixtureProp: 'Static GLB statuette and small mesh markers, not a production kettle' });
  },
  follow() {
    const frames = []; let previous;
    for (let frame = 0; frame < 8; frame++) { sync(); const row = { phase: 'walk', matrices: attached.map(id => matrices(id)), pixels: pixels(), shadow: shadow(), plain: origin('plain').toArray() }; if (previous) ensure(maxError(row.plain, previous.plain) > 1e-4, 'Hand prop did not follow actual animated bone'); frames.push(row); previous = row; }
    edit('Flag', 'flags', { active: true });
    for (let frame = 0; frame < 6; frame++) { sync(); frames.push({ phase: 'reach', matrices: attached.map(id => matrices(id)), pixels: pixels(), shadow: shadow(), plain: origin('plain').toArray() }); }
    const current = origin('plain'), hit = pickAt(current), oldBase = pickAt(new THREE.Vector3(raw.entities.plain.Transform3D.x, raw.entities.plain.Transform3D.y, raw.entities.plain.Transform3D.z));
    ensure(hit.hit?.entityId === 'plain' && oldBase.hit?.entityId !== 'plain', 'Attachment picking did not follow new position or retained base ghost');
    ensure(new Set(frames.map(row => row.pixels)).size > 4 && new Set(frames.map(row => row.shadow.hash)).size > 4, 'Actual framebuffer/shadow did not change along hand animation');
    return record('follow', { frames, picking: { current: hit, oldBase }, warnings: [...warnings] });
  },
  fallback() {
    const beforeWarnings = warnings.length, original = initialAttach.plain;
    setAttach('plain', { ...original, bone: 'MissingFixtureBone' }); sync(); const fallback = matrices('plain', true), firstWarnings = warnings.length;
    for (let i = 0; i < 5; i++) sync(); ensure(firstWarnings === beforeWarnings + 1 && warnings.length === firstWarnings, 'Missing-bone fallback did not WARN exactly once');
    setAttach('plain', original); sync(); matrices('plain');
    return record('fallback', { fallback, warning: warnings[beforeWarnings], onceOnly: true });
  },
  async visibility() {
    const before = origin('plain'); edit('Visibility', 'actor', { visible: false }); sync();
    ensure(attached.every(hidden), 'Hidden parent left visible nested attachments'); ensure(pickAt(before).hit?.entityId !== 'plain', 'Hidden prop left a pickable ghost');
    edit('Visibility', 'actor', { visible: true }); await ready(); attached.forEach(id => matrices(id));
    const actorComponents = structuredClone(raw.entities.actor), old = backend.models.instance('actor'); world.destroyEntity('actor'); replica.world.destroyEntity('actor'); sync();
    ensure(attached.every(hidden) && !backend.scene.getObjectByProperty('uuid', old.uuid), 'Destroyed parent left old model or attachments visible');
    for (const current of [world, replica.world]) { current.createEntity('actor'); for (const [type, value] of Object.entries(actorComponents)) if (current === world || type !== 'AnimGraph3D') current.addComponent('actor', { ...structuredClone(value), type }); }
    await ready(); attached.forEach(id => matrices(id));
    const previous = backend.models.instance('actor'); world.addComponent('actor', { type: 'Model3D', modelKey: 'model/b' }); sync();
    ensure(!backend.scene.getObjectByProperty('uuid', previous.uuid), 'Changed parent model retained old generation'); await ready(); attached.forEach(id => matrices(id));
    world.addComponent('actor', { type: 'Model3D', modelKey: 'model/a' }); await ready();
    const lateConfig = attach('late-parent', [.1, .1, .1]); setAttach('plain', lateConfig); sync(); ensure(hidden('plain'), 'Missing late parent did not hide attachment');
    for (const current of [world, replica.world]) { current.createEntity('late-parent'); current.addComponent('late-parent', { type: 'Transform3D', x: 1.5, y: 0, z: 0 }); current.addComponent('late-parent', { type: 'Model3D', modelKey: 'model/b' }); }
    for (let attempt = 0; attempt < 100; attempt++) { sync(); if (!hidden('plain')) break; await new Promise(resolve => requestAnimationFrame(resolve)); }
    ensure(!hidden('plain'), 'Late parent did not recover attachment'); matrices('plain');
    setAttach('plain', initialAttach.plain); for (const current of [world, replica.world]) current.destroyEntity('late-parent'); sync();
    return record('visibility', { hiddenParent: true, restored: true, destroyedParent: true, modelSwitch: true, lateParent: true, warnings: [...warnings], resources: resources() });
  },
  async removal() {
    const attachedPosition = origin('plain'), rebatchIds = ['plain', 'pbr-batchable', 'voxel'], oldObjects = rebatchIds.map(object);
    for (const id of rebatchIds) world.removeComponent(id, 'Attach3D'); sync();
    const transform = raw.entities.plain.Transform3D, expected = new THREE.Matrix4().compose(new THREE.Vector3(transform.x, transform.y, transform.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(transform.rotX, transform.rotY, transform.rotZ)), new THREE.Vector3(transform.scaleX, transform.scaleY, transform.scaleZ));
    const keys = [mesh3dBatchKey(raw.entities.plain.Mesh3D), `pbr|${pbrSig(raw.entities['pbr-batchable'].Mesh3D, raw.entities['pbr-batchable'].Material3D)}|`, voxelMode(raw.entities.voxel.Mesh3D)];
    const batches = keys.map(key => backend.batches.batches.get(key)?.mesh);
    ensure(batches.every(Boolean) && rebatchIds.every(id => !backend.meshes.has(id)) && oldObjects.every(old => !backend.scene.getObjectByProperty('uuid', old.uuid)), 'Attach removal left a plain/PBR/voxel standalone ghost instead of restoring native batches');
    const actual = new THREE.Matrix4(); batches[0].getMatrixAt(0, actual);
    ensure(maxError(expected.elements, actual.elements) < 1e-6, 'Attach removal failed to restore base render transform');
    ensure(pickAt(new THREE.Vector3(transform.x, transform.y, transform.z)).hit?.entityId === 'plain' && pickAt(attachedPosition).hit?.entityId !== 'plain', 'Attach removal left stale picked location');
    for (const id of rebatchIds) setAttach(id, initialAttach[id]); sync(); rebatchIds.forEach(id => matrices(id));
    const priorMesh = object('plain'); world.removeComponent('plain', 'Mesh3D'); world.addComponent('plain', { type: 'Model3D', modelKey: 'model/prop', scale: .15 }); sync();
    ensure(!backend.scene.getObjectByProperty('uuid', priorMesh.uuid), 'Same-id attached Mesh3D-to-Model3D retained old mesh');
    for (let attempt = 0; attempt < 100; attempt++) { sync(); if (backend.models.instance('plain')) break; await new Promise(resolve => requestAnimationFrame(resolve)); }
    ensure(backend.models.instance('plain'), 'Same-id model replacement did not arrive'); matrices('plain');
    world.removeComponent('plain', 'Model3D'); world.addComponent('plain', { ...raw.entities.plain.Mesh3D, type: 'Mesh3D' }); sync(); matrices('plain');
    const bufferBaseline = buffers(), nativeBufferCycles = [];
    for (let cycle = 0; cycle < 5; cycle++) {
      world.removeComponent('plain', 'Attach3D'); sync();
      const original = backend.batches.batches.get(keys[0]).mesh, originalMatrix = instanceBuffers.get(original)?.matrix;
      ensure(originalMatrix && trackedBuffers.has(originalMatrix) && gl.isBuffer(originalMatrix), 'Actual instanceMatrix GPU buffer was not observed');
      original.setColorAt(0, new THREE.Color(.2, .65, .95)); original.instanceColor.needsUpdate = true;
      for (const material of Array.isArray(original.material) ? original.material : [original.material]) material.needsUpdate = true;
      backend.lastRenderSig = ''; sync(0);
      const originalColor = instanceBuffers.get(original)?.color;
      ensure(originalColor && trackedBuffers.has(originalColor) && gl.isBuffer(originalColor), 'Native instanceColor attribute was not uploaded');
      const beforeGrow = buffers(), cloneIds = [];
      for (let index = 0; index < 17; index++) { const id = `buffer-grow-${cycle}-${index}`; cloneIds.push(id); for (const current of [world, replica.world]) { current.createEntity(id); current.addComponent(id, { type: 'Transform3D', x: -1.5 + index * .15, y: .2, z: 1, scale: .3 }); current.addComponent(id, { ...raw.entities.plain.Mesh3D, type: 'Mesh3D' }); } }
      sync();
      const grown = backend.batches.batches.get(keys[0]).mesh;
      ensure(grown !== original && !gl.isBuffer(originalMatrix) && !gl.isBuffer(originalColor) && !trackedBuffers.has(originalMatrix) && !trackedBuffers.has(originalColor), 'Batch growth leaked native instanceMatrix/instanceColor buffers');
      const afterGrow = buffers(), grownMatrix = instanceBuffers.get(grown)?.matrix;
      ensure(grownMatrix && gl.isBuffer(grownMatrix), 'Grown batch native instanceMatrix buffer missing');
      for (const current of [world, replica.world]) for (const id of cloneIds) current.destroyEntity(id);
      setAttach('plain', initialAttach.plain); sync(); matrices('plain');
      ensure(!gl.isBuffer(grownMatrix) && !trackedBuffers.has(grownMatrix), 'Removing the empty native batch leaked its instance buffer');
      const restored = buffers(); ensure(restored.live === bufferBaseline.live, 'Attach/batch/grow cycles grew native GPU buffers: ' + JSON.stringify({ cycle, bufferBaseline, restored }));
      nativeBufferCycles.push({ beforeGrow, afterGrow, restored, oldMatrixDeleted: true, oldColorDeleted: true, grownMatrixDeleted: true });
    }
    return record('removal', { restoredBaseMatrix: expected.toArray(), oldAttachedGhostAbsent: true, pickingRestored: true, rebatches: rebatchIds, sameIdMeshToModelClean: true, nativeBuffers: { baseline: bufferBaseline, cycles: nativeBufferCycles } });
  },
  async soak() {
    edit('Flag', 'flags', { active: false }); await ready(); const start = resources(), hashes = [], warningCount = warnings.length;
    for (let tick = 0; tick < 2000; tick++) { engine.world.tick(); replica.world.tick(); hashes.push(compareHashes(tick)); sync(1 / 60); if (tick % 100 === 0) attached.forEach(id => matrices(id)); }
    const end = resources(); ensure(start.gpu.geometries === end.gpu.geometries && start.gpu.textures === end.gpu.textures && start.instances === end.instances && start.templates === end.templates && start.buffers.live === end.buffers.live, 'Attachment steady-state GPU/model/buffer allocations grew'); ensure(warnings.length === warningCount, 'Unchanged attachments spammed warnings');
    return record('soak', { ticks: hashes.length, completeHashSequence: hashes, start, end, readOnlyChecks, observedDraws });
  },
  async lifecycle() {
    const cycles = [];
    for (let i = 0; i < 5; i++) { const old = backend.models.instance('actor'); assets.releaseGroup('cast'); sync(); ensure(attached.every(hidden) && !backend.scene.getObjectByProperty('uuid', old.uuid), 'Asset eviction retained visible attachments/parent generation'); const evicted = resources(); ensure(evicted.instances === 0 && evicted.templates === 0 && evicted.motions === 0, 'Eviction retained model/clip caches'); await assets.preloadGroup('cast'); await ready(); attached.forEach(id => matrices(id)); cycles.push({ evicted, reloaded: resources() }); }
    ensure(cycles.every(row => row.reloaded.gpu.geometries === cycles[0].reloaded.gpu.geometries && row.reloaded.gpu.textures === cycles[0].reloaded.gpu.textures && row.reloaded.buffers.live === cycles[0].reloaded.buffers.live && row.evicted.buffers.live === cycles[0].evicted.buffers.live), 'Attachment reload GPU/buffer resources grew');
    return record('lifecycle', { cycles, warnings: [...warnings] });
  },
  destroy() {
    for (const current of [world, replica.world]) for (const id of current.getAllEntities()) current.destroyEntity(id); sync(); assets.releaseGroup('cast'); sync(); const before = resources(), textureInventory = [...observedTextures].map(([texture, row]) => ({ ...row, nativeGPUAllocated: gl.isTexture(backend.gl.properties.get(texture).__webglTexture) })); backend.destroy(); backend.destroy(); const after = { ...backend.gl.info.memory };
    const result = record('destroy', { before, after, nativeBuffers: buffers(), textureInventory, contextLost: gl.isContextLost(), readOnlyChecks, observedDraws, warnings });
    ensure(after.geometries === 0 && after.textures === 0, 'Renderer destroy retained E3 GPU resources: ' + JSON.stringify(after));
    ensure(trackedBuffers.size === 0 && buffersCreated === buffersDeleted, 'Renderer destroy retained tracked native WebGL buffers: ' + JSON.stringify(buffers()));
    ensure(textureInventory.filter(row => row.shared !== true).every(row => row.disposals === 1 && !row.nativeGPUAllocated), 'Owned standalone/batch textures were leaked or disposed more than once: ' + JSON.stringify(textureInventory)); console.warn = nativeWarn;
    return result;
  },
};
