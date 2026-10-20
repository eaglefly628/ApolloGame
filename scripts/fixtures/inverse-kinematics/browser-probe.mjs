// E4 real browser evidence. All characters, clips and grip props are fixtures.
import * as THREE from 'three';
import { ThreeRenderer } from '../../../src/renderer/three-renderer.ts';
import { createManifestAssets } from '../../../src/services/scene-game-assets.ts';
import { parseAssetIndex, registerAssetIndex } from '../../../src/assets/asset-index.ts';
import { Engine } from '../../../src/runtime/engine.ts';
import { resolveCapabilities } from '../../../src/assembly/capability-registry.ts';
import { hashSnapshot } from '../../../src/net/determinism.ts';
import { voxelMode } from '../../../src/renderer/three/geometry.ts';

const ensure = (value, message) => { if (!value) throw new Error(message); };
const maxError = (a, b) => Math.max(...a.map((value, i) => Math.abs(value - b[i])));
const digest = bytes => { let h = 2166136261; for (const byte of bytes) h = Math.imul(h ^ byte, 16777619); return (h >>> 0).toString(16); };
let clock = 1000, readOnlyChecks = 0;
Object.defineProperty(performance, 'now', { configurable: true, value: () => clock });
const warnings = [], nativeWarn = console.warn.bind(console);
console.warn = (...args) => { warnings.push(args.map(String).join(' ')); nativeWarn(...args); };
const assets = createManifestAssets(), backend = new ThreeRenderer({ assets, width: 900, height: 600, dprCap: 1, antialias: false, shadowMapSize: 512 });
backend.init(document.getElementById('stage')); backend.resize(900, 600);
const gl = backend.gl.getContext(), trackedBuffers = new Set(); let buffersCreated = 0, buffersDeleted = 0;
const createBuffer = gl.createBuffer.bind(gl), deleteBuffer = gl.deleteBuffer.bind(gl);
gl.createBuffer = (...args) => { const buffer = createBuffer(...args); if (buffer) { trackedBuffers.add(buffer); buffersCreated++; } return buffer; };
gl.deleteBuffer = buffer => { deleteBuffer(buffer); if (trackedBuffers.delete(buffer)) buffersDeleted++; };
const buffers = () => ({ live: trackedBuffers.size, created: buffersCreated, deleted: buffersDeleted, initBaseline: 0 });
const engine = new Engine(), replica = new Engine(), world = engine.world;
const graph = { type: 'AnimGraph3D', clips: { walk: { asset: 'motion/walk', clip: 'walk' }, reach: { asset: 'motion/reach', clip: 'reach', loop: false } }, states: { walking: { clip: 'walk' } }, transitions: [], params: { reach: 'flag:reach' } };
const pausedGraph = structuredClone(graph); for (const spec of Object.values(pausedGraph.clips)) spec.speed = 0;
const baseTransform = { x: 0, y: 0, z: 0, rotY: .35, rotZ: .1, scaleX: 1.2, scaleY: .85, scaleZ: 1.35 };
const attachment = offset => ({ parentId: 'actor', bone: 'RightHand', offset, rot: [.2, .3, -.15] });
const raw = { entities: {
  camera: { Camera3D: { yaw: .2, pitch: .35, distance: 5.2, pivotX: 1, pivotY: 1, pivotZ: 0, near: .1, far: 40 } },
  floor: { Transform3D: { x: 1, y: -.1, z: 0 }, Mesh3D: { shape: 'box', width: 10, height: .15, depth: 6, frontTint: 0x8592a1 } },
  flags: { Flag: { id: 'reach', active: false } },
  actor: { Transform3D: { ...baseTransform }, Model3D: { modelKey: 'model/a' }, AnimGraph3D: structuredClone(graph), Visibility: { visible: true, active: true } },
  reference: { Transform3D: { ...baseTransform, x: 2.2 }, Model3D: { modelKey: 'model/a' }, AnimGraph3D: structuredClone(graph), Visibility: { visible: true, active: true } },
  anchor: { Transform3D: { x: 0, y: 1.1, z: .35 }, Visibility: { visible: true, active: true } },
  'look-anchor': { Transform3D: { x: 0, y: 1.7, z: 2 }, Visibility: { visible: true, active: true } },
  'target-marker': { Transform3D: { x: 0, y: 1.1, z: .35 }, Mesh3D: { shape: 'sphere', width: .07, height: .07, frontTint: 0xffdd44 } },
  'model-prop': { Transform3D: { x: -2, y: .4, z: 0, scale: .13 }, Model3D: { modelKey: 'model/prop', scale: .7 }, Attach3D: attachment([.08, .06, -.08]) },
  grip: { Transform3D: { x: -2, y: .7, z: 0, scale: .8 }, Mesh3D: { shape: 'cylinder', width: .1, height: .14, depth: .1, frontTint: 0xffaa22 }, Material3D: { preset: 'plastic', color: 0xffaa22, roughness: .3 }, Attach3D: attachment([.025, .015, .005]), Pickable3D: { signal: 'pick-ik-grip' } },
  dice: { Transform3D: { x: -2, y: .7, z: .5, scale: .35 }, Mesh3D: { shape: 'box', width: .22, height: .25, depth: .18, frontTint: 0xeeeeff, dieFaces: Array.from({ length: 6 }, (_, i) => ({ color: 0xeeeeff, pip: i + 1 })) }, Attach3D: attachment([.2, .1, .1]) },
  voxel: { Transform3D: { x: -2, y: .7, z: .6, scale: .35 }, Mesh3D: { shape: 'box', width: .22, height: .25, depth: .18, frontTint: 0x55c755, voxelTex: { top: 0x55c755, side: 0x39773e, pattern: 'plain', tile: .1 } }, Attach3D: attachment([-.15, .1, .1]) },
} };
const caps = resolveCapabilities(['a1-transform', 'b1-velocity', 'b3-mass', 't1-motion-apply']);
engine.load({ ...raw, capabilities: caps }); replica.load({ entities: structuredClone(raw.entities), capabilities: caps });
window.e4Report = {};
const record = (name, value) => (window.e4Report[name] = value);
const drawMatrices = new WeakMap(), monitored = new WeakSet(), observedTextures = new Map(); let activeMesh;
for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) { const native = gl[name].bind(gl); gl[name] = (...args) => { native(...args); if (!activeMesh) return; const program = gl.getParameter(gl.CURRENT_PROGRAM), location = gl.getUniformLocation(program, 'modelViewMatrix'); if (location) drawMatrices.set(activeMesh, Array.from(gl.getUniform(program, location))); }; }
function watch() { let added = 0; backend.scene.traverse(mesh => { if (!mesh.isMesh || monitored.has(mesh)) return; added++; monitored.add(mesh); const render = mesh.onBeforeRender, shadow = mesh.onBeforeShadow; mesh.onBeforeRender = function (...args) { render.apply(this, args); activeMesh = this; }; mesh.onBeforeShadow = function (...args) { shadow.apply(this, args); activeMesh = undefined; }; }); return added; }
function watchTextures() { backend.scene.traverse(mesh => { if (!mesh.material) return; const owner = [...backend.meshes].find(([, value]) => value === mesh)?.[0] ?? [...backend.batches.batches].find(([, value]) => value.mesh === mesh)?.[0] ?? mesh.name; for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) for (const [slot, texture] of Object.entries(material)) { if (!texture?.isTexture) continue; let row = observedTextures.get(texture); if (!row) { row = { uuid: texture.uuid, width: texture.image?.width, height: texture.image?.height, shared: texture.userData?.shared, slots: [], owners: [], disposals: 0 }; observedTextures.set(texture, row); texture.addEventListener('dispose', () => row.disposals++); } if (!row.slots.includes(slot)) row.slots.push(slot); if (!row.owners.includes(owner)) row.owners.push(owner); } }); }
function sync(dt = 1 / 16) { clock += dt * 1000; watch(); const before = JSON.stringify(world.snapshot()), hash = hashSnapshot(world.snapshot()), version = world.getVersion(); backend.sync(world.readView()); if (watch() > 0) { backend.lastRenderSig = ''; backend.sync(world.readView()); } watchTextures(); ensure(before === JSON.stringify(world.snapshot()) && hash === hashSnapshot(world.snapshot()) && version === world.getVersion(), 'IK renderer mutated snapshot/hash/writeSequence'); readOnlyChecks++; return backend.readStats().rendered; }
function object(id) { return backend.models.instance(id) ?? backend.meshes.get(id); }
function bone(name, id = 'actor') { const found = []; backend.models.instance(id)?.traverse(node => { if (node.isBone && node.name === name) found.push(node); }); ensure(found.length === 1, 'Expected one native bone ' + id + '/' + name); return found[0]; }
function position(name, id = 'actor') { return bone(name, id).getWorldPosition(new THREE.Vector3()); }
function pose(id = 'actor') { const result = []; backend.models.instance(id).traverse(node => { if (node.isBone) result.push({ name: node.name, position: node.position.toArray(), quaternion: node.quaternion.toArray(), scale: node.scale.toArray() }); }); return result; }
function boneQuat(name, id = 'actor') { return bone(name, id).quaternion.clone(); }
function edit(type, id, values) { for (const current of [world, replica.world]) { Object.assign(current.getComponent(id, type), values); current.markDirty(id, type); } }
function bothAdd(id, component) { for (const current of [world, replica.world]) current.addComponent(id, structuredClone(component)); }
function bothRemove(id, type) { for (const current of [world, replica.world]) current.removeComponent(id, type); }
function setGraph(value) { for (const id of ['actor', 'reference']) bothAdd(id, structuredClone(value)); }
function setIK(value) { world.addComponent('actor', structuredClone(value)); }
function rightChain(weight = 1, target = { entity: 'anchor', offset: [0, 0, 0] }) { return { kind: 'two-bone', root: 'RightUpperArm', mid: 'RightLowerArm', end: 'RightHand', target, pole: [0, 1.8, 1.2], weight }; }
function leftChain(target, weight = 1) { return { kind: 'two-bone', root: 'LeftUpperArm', mid: 'LeftLowerArm', end: 'LeftHand', target, pole: [1, 1.8, 1.2], weight }; }
function pixels() { const bytes = new Uint8Array(900 * 600 * 4); gl.readPixels(0, 0, 900, 600, gl.RGBA, gl.UNSIGNED_BYTE, bytes); return digest(bytes); }
function shadow() { const target = backend.lights.key.shadow.map; ensure(target, 'Actual GPU shadow target missing'); const bytes = new Uint8Array(target.width * target.height * 4); backend.gl.readRenderTargetPixels(target, 0, 0, target.width, target.height, bytes); return { hash: digest(bytes), uploaded: gl.isTexture(backend.gl.properties.get(target.texture).__webglTexture) }; }
function targetMatrix(target) { const obj = object(target.entity); if (target.bone) return bone(target.bone, target.entity).matrixWorld; if (obj) { obj.updateWorldMatrix(true, true); return obj.matrixWorld; } const t = world.peek(target.entity, 'Transform3D'); ensure(t, 'Missing independently measured target Transform3D'); return new THREE.Matrix4().compose(new THREE.Vector3(t.x, t.y, t.z), t.quat ? new THREE.Quaternion(...t.quat) : new THREE.Quaternion().setFromEuler(new THREE.Euler(t.rotX ?? 0, t.rotY ?? 0, t.rotZ ?? 0)), new THREE.Vector3(t.scaleX ?? t.scale ?? 1, t.scaleY ?? t.scale ?? 1, t.scaleZ ?? t.scale ?? 1)); }
function targetPosition(target) { return new THREE.Vector3(...target.offset).applyMatrix4(targetMatrix(target)); }
function endpoint(chain) { const actual = position(chain.end), expected = targetPosition(chain.target), error = actual.distanceTo(expected); ensure(error < .01, 'Actual native bone endpoint misses target: ' + chain.end + ' error=' + error); return { end: chain.end, actual: actual.toArray(), expected: expected.toArray(), error }; }
function finalAttachments() {
  // Independent native matrix arithmetic. Do not call the attachment/IK helper:
  // this specifically detects omission of the final E3 pass after IK solving.
  return ['grip', 'model-prop'].map(id => {
    const child = object(id), config = raw.entities[id].Attach3D, transform = raw.entities[id].Transform3D, modelScale = raw.entities[id].Model3D?.scale ?? 1;
    const anchor = bone(config.bone, config.parentId); anchor.updateWorldMatrix(true, false); child.updateWorldMatrix(true, true);
    const scale = new THREE.Vector3((transform.scaleX ?? transform.scale ?? 1) * modelScale, (transform.scaleY ?? transform.scale ?? 1) * modelScale, (transform.scaleZ ?? transform.scale ?? 1) * modelScale);
    const local = new THREE.Matrix4().compose(new THREE.Vector3(...config.offset), new THREE.Quaternion().setFromEuler(new THREE.Euler(...config.rot, 'XYZ')), scale);
    const expected = anchor.matrixWorld.clone().multiply(local), matrixError = maxError(expected.elements, child.matrixWorld.elements);
    ensure(matrixError < 1e-8, 'attachment lagged final IK bone: ' + id + ' matrixError=' + matrixError);
    let gpuError = 0, gpuDrawSamples = 0;
    child.traverse(mesh => { if (!mesh.isMesh) return; const uploaded = drawMatrices.get(mesh); if (!uploaded) return; const expectedDraw = expected.clone().multiply(child.matrixWorld.clone().invert().multiply(mesh.matrixWorld)), gpuWorld = backend.cameras.current.matrixWorld.clone().multiply(new THREE.Matrix4().fromArray(uploaded)); gpuError = Math.max(gpuError, maxError(expectedDraw.elements, gpuWorld.elements)); gpuDrawSamples++; });
    ensure(gpuDrawSamples > 0 && gpuError < 3e-5, 'attachment GPU draw lagged final IK bone: ' + id + ' matrixError=' + gpuError);
    let picking;
    if (raw.entities[id].Pickable3D) {
      const bounds = new THREE.Box3(), positions = child.geometry.attributes.position;
      for (let index = 0; index < positions.count; index++) bounds.expandByPoint(new THREE.Vector3().fromBufferAttribute(positions, index).applyMatrix4(expected));
      const center = bounds.getCenter(new THREE.Vector3()), half = bounds.getSize(new THREE.Vector3()).multiplyScalar(.5), actual = backend.pickables.get(id);
      ensure(actual, 'attachment final IK pick box missing: ' + id);
      const pickBoxError = maxError([center.x, center.y, center.z, half.x, half.y, half.z], [actual.cx, actual.cy, actual.cz, actual.hx, actual.hy, actual.hz]);
      ensure(pickBoxError < 1e-8, 'attachment pick box lagged final IK bone: ' + id + ' error=' + pickBoxError);
      const projected = center.clone().project(backend.cameras.current), rect = backend.gl.domElement.getBoundingClientRect(), point = { x: rect.left + (projected.x + 1) * rect.width / 2, y: rect.top + (1 - projected.y) * rect.height / 2 }, hit = backend.pick(point.x, point.y);
      ensure(hit?.entityId === id, 'attachment public picking lagged final IK bone: ' + id);
      picking = { pickBoxError, point, hit, expectedCenter: center.toArray(), expectedHalf: half.toArray() };
    }
    return { id, matrixError, gpuError, gpuDrawSamples, expected: expected.toArray(), actual: child.matrixWorld.toArray(), picking };
  });
}
function setAnchor(point) { edit('Transform3D', 'anchor', { x: point.x, y: point.y, z: point.z, rotX: 0, rotY: 0, rotZ: 0, scale: 1 }); edit('Transform3D', 'target-marker', { x: point.x, y: point.y, z: point.z }); }
function reachablePoint() { const root = bone('RightUpperArm'), left = bone('LeftUpperArm'); root.parent.updateWorldMatrix(true, true); const r = root.parent.worldToLocal(position('RightUpperArm')), l = root.parent.worldToLocal(left.getWorldPosition(new THREE.Vector3())); return r.add(l).multiplyScalar(.5).add(new THREE.Vector3(0, -.1, .2)).applyMatrix4(root.parent.matrixWorld); }
function resources() { return { gpu: { ...backend.gl.info.memory }, buffers: buffers(), instances: backend.models.instances.size, templates: backend.models.cache.size, motions: backend.models.motions.size, pendingModels: backend.models.parsing.size, pendingMotions: backend.models.motionParsing.size }; }
function gpuBones(id = 'actor') {
  let mesh; backend.models.instance(id).traverse(node => { if (node.isSkinnedMesh) mesh = node; }); ensure(mesh, 'Actual SkinnedMesh missing');
  const texture = mesh.skeleton.boneTexture, handle = texture && backend.gl.properties.get(texture).__webglTexture; ensure(handle && gl.isTexture(handle), 'Native skinning bone texture was not uploaded');
  ensure(gl.getExtension('EXT_color_buffer_float'), 'GPU float bone texture readback requires EXT_color_buffer_float');
  const previous = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING), framebuffer = gl.createFramebuffer(), data = new Float32Array(texture.image.width * texture.image.height * 4);
  try { gl.bindFramebuffer(gl.READ_FRAMEBUFFER, framebuffer); gl.framebufferTexture2D(gl.READ_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, handle, 0); ensure(gl.checkFramebufferStatus(gl.READ_FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE, 'Native bone texture readback framebuffer incomplete'); gl.readPixels(0, 0, texture.image.width, texture.image.height, gl.RGBA, gl.FLOAT, data); }
  finally { gl.bindFramebuffer(gl.READ_FRAMEBUFFER, previous); gl.deleteFramebuffer(framebuffer); }
  const error = maxError(Array.from(texture.image.data), Array.from(data)); ensure(Number.isFinite(error) && error < 1e-6, 'Actual GPU bone palette disagrees with native skeleton: ' + error);
  const uploaded = drawMatrices.get(mesh); ensure(uploaded, 'Actual modelView uniform not observed'); const gpuWorld = backend.cameras.current.matrixWorld.clone().multiply(new THREE.Matrix4().fromArray(uploaded)); ensure(maxError(gpuWorld.elements, mesh.matrixWorld.elements) < 3e-5, 'Actual model draw ancestry matrix disagrees');
  const index = mesh.skeleton.bones.indexOf(bone('RightHand', id));
  return { textureWidth: texture.image.width, textureHeight: texture.image.height, nativeTextureUploaded: true, maxPaletteError: error, hash: digest(new Uint8Array(data.buffer)), rightHandGPU: Array.from(data.slice(index * 16, index * 16 + 16)) };
}
async function ready(graphRequired = true) { for (let attempt = 0; attempt < 300; attempt++) { sync(); if (backend.models.instance('actor') && backend.models.instance('reference') && backend.models.instance('model-prop') && (!graphRequired || ['actor', 'reference'].every(id => backend.models.graphs.get(id)?.controller))) { sync(); return; } await new Promise(resolve => requestAnimationFrame(resolve)); } throw new Error('Formal IK models/graphs readiness timeout: ' + JSON.stringify(resources())); }
let fixedTarget;
window.e4Probe = {
  async load() { const index = parseAssetIndex(await (await fetch('/fixtures/index.json')).json()); registerAssetIndex(assets, index, '/'); await assets.preloadGroup('cast'); await ready(); setGraph(pausedGraph); sync(0); fixedTarget = reachablePoint(); setAnchor(fixedTarget); sync(0); ensure(!object('anchor'), 'Point anchor must remain non-drawable'); const ext = gl.getExtension('WEBGL_debug_renderer_info'); return record('load', { gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), sourcePose: pose(), nativeGPU: gpuBones(), target: fixedTarget.toArray(), pixels: pixels(), shadow: shadow(), resources: resources() }); },
  reachable() {
    const before = { pixels: pixels(), shadow: shadow(), gpu: gpuBones() }, chain = rightChain(); setIK({ type: 'IK3D', chains: [chain] }); sync(0);
    const solved = endpoint(chain), after = { pixels: pixels(), shadow: shadow(), gpu: gpuBones(), finalAttachments: finalAttachments() };
    ensure(before.pixels !== after.pixels && before.shadow.hash !== after.shadow.hash && before.gpu.hash !== after.gpu.hash, 'IK did not change native GPU bones, framebuffer and shadows');
    const head = position('Head'), look = head.clone().add(new THREE.Vector3(.3, .25, 1.5)); edit('Transform3D', 'look-anchor', { x: look.x, y: look.y, z: look.z });
    const lookAt = { bone: 'Head', target: { entity: 'look-anchor', offset: [0, 0, 0] }, weight: 1 }; setIK({ type: 'IK3D', chains: [chain], lookAt }); sync(0);
    const forward = new THREE.Vector3(0, 0, 1).transformDirection(bone('Head').matrixWorld), wanted = targetPosition(lookAt.target).sub(position('Head')).normalize(), dot = forward.dot(wanted); ensure(dot > .9999, 'Head local +Z does not face actual lookAt target: dot=' + dot); endpoint(chain); const lookAttachments = finalAttachments();
    const moving = [], reachGraph = structuredClone(graph); reachGraph.states = { reaching: { clip: 'reach' } };
    for (const [alias, animation] of [['walk', graph], ['reach', reachGraph]]) {
      setGraph(animation); let previousTime = -1;
      for (let frame = 0; frame < 6; frame++) { sync(); const time = backend.models.graphs.get('actor').controller.debug.actions[alias].time; ensure(time > previousTime, 'External native clip did not advance beneath IK: ' + alias); previousTime = time; moving.push({ clip: alias, time, endpoint: endpoint(chain), finalAttachments: finalAttachments(), gpu: gpuBones(), pixels: pixels(), shadow: shadow() }); }
    }
    ensure(new Set(moving.map(row => row.gpu.hash)).size > 4 && new Set(moving.map(row => row.pixels)).size > 4 && new Set(moving.map(row => row.shadow.hash)).size > 4, 'Moving external walk/reach plus IK lacked actual GPU/bone/shadow changes');
    setGraph(pausedGraph); sync(0); endpoint(chain); const pausedAttachments = finalAttachments();
    return record('reachable', { solved, before, after, movingExternalClips: moving, lookAt: { forward: forward.toArray(), desired: wanted.toArray(), dot, finalAttachments: lookAttachments }, pausedAttachments, ancestryNonuniform: baseTransform, chainLocalScales: ['RightUpperArm', 'RightLowerArm', 'RightHand'].map(name => bone(name).scale.toArray()) });
  },
  async zeroWeight() {
    world.removeComponent('actor', 'IK3D'); sync(0); const naked = pose(); const zero = { type: 'IK3D', chains: [rightChain(0)], lookAt: { bone: 'Head', target: { entity: 'look-anchor', offset: [0, 0, 0] }, weight: 0 } }; setIK(zero); sync(0);
    ensure(JSON.stringify(pose()) === JSON.stringify(naked) && JSON.stringify(pose()) === JSON.stringify(pose('reference')), 'Weight zero altered a native animation field');
    for (let frame = 0; frame < 40; frame++) { sync(); ensure(JSON.stringify(pose()) === JSON.stringify(naked), 'Paused zero-weight IK accumulated pose'); }
    for (const id of ['actor', 'reference']) { bothRemove(id, 'AnimGraph3D'); bothAdd(id, { type: 'Model3D', modelKey: 'model/legacy' }); bothAdd(id, { type: 'AnimState3D', clip: 'walk', speed: 1, loop: true }); }
    await ready(false); for (let frame = 0; frame < 12; frame++) { sync(); ensure(JSON.stringify(pose()) === JSON.stringify(pose('reference')), 'Constant zero without AnimGraph3D changed legacy animation pose'); }
    for (const id of ['actor', 'reference']) { bothRemove(id, 'AnimState3D'); bothAdd(id, { type: 'Model3D', modelKey: 'model/a' }); } setGraph(pausedGraph); await ready(); sync(0);
    return record('zeroWeight', { exactAllBoneFields: true, pausedFrames: 40, legacyFrames: 12, legacyWithoutGraph: true, pose: pose() });
  },
  weights() {
    setAnchor(fixedTarget); setIK({ type: 'IK3D', chains: [rightChain()] }); sync(0); const full = ['RightUpperArm', 'RightLowerArm'].map(name => boneQuat(name));
    world.removeComponent('actor', 'IK3D'); sync(0); const base = ['RightUpperArm', 'RightLowerArm'].map(name => boneQuat(name)); edit('Flag', 'flags', { active: false });
    setIK({ type: 'IK3D', chains: [rightChain({ param: 'reach', fade: .2 })] }); sync(0); const frames = [];
    for (const [flag, dt, weight] of [[true, .05, .25], [true, .05, .5], [false, .05, .375], [true, .05, .53125], [true, .1, .84375], [true, .05, 1]]) {
      edit('Flag', 'flags', { active: flag }); sync(dt); const angles = ['RightUpperArm', 'RightLowerArm'].map((name, i) => boneQuat(name).angleTo(base[i].clone().slerp(full[i], weight))); ensure(angles.every(angle => angle < 2e-6), 'Param fade/interruption did not slerp from current weight: ' + JSON.stringify({ weight, angles })); frames.push({ flag, dt, expectedWeight: weight, quaternionErrors: angles, endpoint: position('RightHand').toArray(), pixels: pixels() });
    }
    endpoint(rightChain()); return record('weights', { binding: { param: 'reach', source: 'flag:reach', fade: .2 }, frames, noAccumulation: true });
  },
  targets() {
    const target = { entity: 'anchor', offset: [.04, -.025, .03] }; edit('Transform3D', 'anchor', { rotX: .2, rotY: .35, rotZ: -.15, scaleX: .8, scaleY: 1.2, scaleZ: 1.1 }); const right = rightChain(1, target); setIK({ type: 'IK3D', chains: [right] }); sync(0); const localOffset = endpoint(right);
    setAnchor(fixedTarget); const gripTarget = { entity: 'grip', offset: [.02, .01, 0] }, left = leftChain(gripTarget); setIK({ type: 'IK3D', chains: [rightChain(), left] }); sync(0); const grip = [endpoint(rightChain()), endpoint(left)];
    const matrix = object('grip').matrixWorld.toArray(), boneTarget = { entity: 'actor', bone: 'RightHand', offset: [.015, 0, 0] }; setIK({ type: 'IK3D', chains: [rightChain(), leftChain(boneTarget)] }); sync(0); const sequentialBone = [endpoint(rightChain()), endpoint(leftChain(boneTarget))];
    const originalVoxel = object('voxel'); world.removeComponent('voxel', 'Attach3D'); sync(); ensure(!backend.scene.getObjectByProperty('uuid', originalVoxel.uuid) && backend.batches.batches.has(voxelMode(raw.entities.voxel.Mesh3D)), 'IK grip fixture voxel did not return to native batch'); world.addComponent('voxel', { type: 'Attach3D', ...structuredClone(raw.entities.voxel.Attach3D) }); sync();
    return record('targets', { localOffset, sequentialAttachGrip: grip, gripMatrix: matrix, sequentialBone, actualGPU: gpuBones(), pixels: pixels(), shadow: shadow(), prop: 'Generic GLB statuette and small orange grip marker, not a production kettle' });
  },
  unreachable() {
    world.removeComponent('actor', 'IK3D'); sync(0); const root = bone('RightUpperArm'), parent = root.parent; parent.updateWorldMatrix(true, true); const a = parent.worldToLocal(position('RightUpperArm')), b = parent.worldToLocal(position('RightLowerArm')), c = parent.worldToLocal(position('RightHand')), total = a.distanceTo(b) + b.distanceTo(c), frames = [];
    let previous;
    for (const z of [0, .001, -.001, 0]) { setAnchor(a.clone().add(new THREE.Vector3(10, 0, z)).applyMatrix4(parent.matrixWorld)); setIK({ type: 'IK3D', chains: [rightChain()] }); sync(0); const x = parent.worldToLocal(position('RightUpperArm')), y = parent.worldToLocal(position('RightLowerArm')), end = parent.worldToLocal(position('RightHand')), dot = y.clone().sub(x).normalize().dot(end.clone().sub(y).normalize()), q = boneQuat('RightUpperArm'); ensure(Math.abs(x.distanceTo(end) - total) < 1e-6 && dot > .99999 && pose().every(row => [...row.position, ...row.quaternion, ...row.scale].every(Number.isFinite)), 'Unreachable target did not produce a finite straight chain'); if (previous) ensure(previous.angleTo(q) < .01, 'Unreachable chain flipped between nearby targets'); previous = q; frames.push({ target: structuredClone(world.peek('anchor', 'Transform3D')), totalLength: total, reachedLength: x.distanceTo(end), directionDot: dot }); }
    setAnchor(fixedTarget); setIK({ type: 'IK3D', chains: [rightChain()] }); sync(0); endpoint(rightChain()); return record('unreachable', { frames, finite: true, noFlip: true, gpu: gpuBones() });
  },
  async visibility() {
    const originalAnchor = structuredClone(world.peek('anchor', 'Transform3D')); for (const current of [world, replica.world]) current.destroyEntity('anchor'); sync(0); ensure(JSON.stringify(pose()) === JSON.stringify(pose('reference')), 'Missing target retained previous IK pose');
    for (const current of [world, replica.world]) { current.createEntity('anchor'); current.addComponent('anchor', originalAnchor); current.addComponent('anchor', { type: 'Visibility', visible: true, active: true }); } sync(0); endpoint(rightChain());
    edit('Visibility', 'anchor', { visible: false }); sync(0);
    const hiddenPoint = { actualPose: pose(), referencePose: pose('reference'), actualEnd: position('RightHand').toArray(), expectedNativeEnd: position('RightHand', 'reference').sub(new THREE.Vector3(2.2, 0, 0)).toArray() };
    record('visibility', { hiddenPoint }); ensure(JSON.stringify(hiddenPoint.actualPose) === JSON.stringify(hiddenPoint.referencePose), 'Hidden point target did not restore native pose: ' + JSON.stringify({ actualEnd: hiddenPoint.actualEnd, expectedNativeEnd: hiddenPoint.expectedNativeEnd })); edit('Visibility', 'anchor', { visible: true }); sync(0); endpoint(rightChain());
    const old = backend.models.instance('actor'); edit('Visibility', 'actor', { visible: false }); sync(); ensure(!backend.models.instance('actor') && !backend.scene.getObjectByProperty('uuid', old.uuid), 'Hidden IK source retained old model'); edit('Visibility', 'actor', { visible: true }); await ready(); sync(0); endpoint(rightChain());
    const previous = backend.models.instance('actor'); bothAdd('actor', { type: 'Model3D', modelKey: 'model/b' }); await ready(); ensure(!backend.scene.getObjectByProperty('uuid', previous.uuid), 'Source model change retained old IK instance'); endpoint(rightChain()); bothAdd('actor', { type: 'Model3D', modelKey: 'model/a' }); await ready();
    for (const current of [world, replica.world]) { current.createEntity('target-source'); current.addComponent('target-source', { type: 'Transform3D', x: 0, y: 0, z: .1, scale: .8 }); current.addComponent('target-source', { type: 'Model3D', modelKey: 'model/b' }); current.addComponent('target-source', { type: 'Visibility', visible: true, active: true }); }
    for (let attempt = 0; attempt < 100; attempt++) { sync(); if (backend.models.instance('target-source')) break; await new Promise(resolve => requestAnimationFrame(resolve)); }
    world.addComponent('grip', { type: 'Attach3D', ...structuredClone(raw.entities.grip.Attach3D), parentId: 'target-source' }); setIK({ type: 'IK3D', chains: [leftChain({ entity: 'grip', offset: [0, 0, 0] })] }); sync(0);
    edit('Visibility', 'target-source', { visible: false }); sync(0); ensure(object('grip').visible === false && JSON.stringify(pose()) === JSON.stringify(pose('reference')), 'Hidden attachment target fell back to base transform or retained IK'); edit('Visibility', 'target-source', { visible: true });
    for (let attempt = 0; attempt < 100; attempt++) { sync(); if (backend.models.instance('target-source') && object('grip').visible) break; await new Promise(resolve => requestAnimationFrame(resolve)); }
    ensure(object('grip').visible, 'Attach target did not recover'); world.addComponent('grip', { type: 'Attach3D', ...structuredClone(raw.entities.grip.Attach3D) }); for (const current of [world, replica.world]) current.destroyEntity('target-source'); setIK({ type: 'IK3D', chains: [rightChain()] }); sync(0); endpoint(rightChain());
    return record('visibility', { hiddenPoint, missingTargetRestored: true, hiddenTargetRestored: true, hiddenSourceRecovered: true, sourceModelChanged: true, hiddenAttachedTargetSkipped: true, attachedTargetRecovered: true, warnings: [...warnings] });
  },
  async soak() { setAnchor(fixedTarget); setIK({ type: 'IK3D', chains: [rightChain()] }); await ready(); const start = resources(), hashes = [], warningCount = warnings.length; let renderedFrames = 0; for (let tick = 0; tick < 2000; tick++) { engine.world.tick(); replica.world.tick(); const a = hashSnapshot(world.snapshot()), b = hashSnapshot(replica.world.snapshot()); ensure(a === b, 'Complete E4 simulation hashes diverged at ' + tick); hashes.push(a); if (sync(1 / 60)) renderedFrames++; if (tick % 100 === 0) endpoint(rightChain()); } const end = resources(); record('soak', { ticks: hashes.length, renderedFrames, completeHashSequence: hashes, start, end, readOnlyChecks }); ensure(renderedFrames <= 2, 'Static IK permanently invalidated actual GPU rendering: frames=' + renderedFrames); ensure(start.gpu.geometries === end.gpu.geometries && start.gpu.textures === end.gpu.textures && start.buffers.live === end.buffers.live && start.instances === end.instances && warnings.length === warningCount, 'IK steady-state resources/diagnostics grew'); return window.e4Report.soak; },
  async lifecycle() { const cycles = []; for (let i = 0; i < 5; i++) { const old = backend.models.instance('actor'); assets.releaseGroup('cast'); sync(); const evicted = resources(); ensure(evicted.instances === 0 && evicted.templates === 0 && evicted.motions === 0 && !backend.scene.getObjectByProperty('uuid', old.uuid), 'IK eviction retained model/clip generation'); await assets.preloadGroup('cast'); await ready(); endpoint(rightChain()); gpuBones(); cycles.push({ evicted, reloaded: resources() }); } ensure(cycles.every(row => row.reloaded.gpu.geometries === cycles[0].reloaded.gpu.geometries && row.reloaded.gpu.textures === cycles[0].reloaded.gpu.textures && row.reloaded.buffers.live === cycles[0].reloaded.buffers.live && row.evicted.buffers.live === cycles[0].evicted.buffers.live), 'IK reload GPU resources grew'); return record('lifecycle', { cycles }); },
  destroy() { for (const current of [world, replica.world]) for (const id of current.getAllEntities()) current.destroyEntity(id); sync(); assets.releaseGroup('cast'); sync(); const before = resources(), textureInventory = [...observedTextures].map(([texture, row]) => ({ ...row, nativeGPUAllocated: gl.isTexture(backend.gl.properties.get(texture).__webglTexture) })); backend.destroy(); backend.destroy(); const after = { ...backend.gl.info.memory }, result = record('destroy', { before, after, nativeBuffers: buffers(), textureInventory, contextLost: gl.isContextLost(), readOnlyChecks, warnings }); ensure(after.geometries === 0 && after.textures === 0 && trackedBuffers.size === 0 && buffersCreated === buffersDeleted, 'IK destroy retained native GPU resources: ' + JSON.stringify({ after, buffers: buffers() })); ensure(textureInventory.filter(row => row.shared !== true).every(row => row.disposals === 1 && !row.nativeGPUAllocated), 'IK fixture owned textures were leaked or disposed repeatedly'); console.warn = nativeWarn; return result; },
};
