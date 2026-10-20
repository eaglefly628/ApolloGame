// E6 real-camera/browser acceptance. Characters and props are generic fixtures.
import * as THREE from 'three';
import { ThreeRenderer } from '../../../src/renderer/three-renderer.ts';
import { createManifestAssets } from '../../../src/services/scene-game-assets.ts';
import { parseAssetIndex, registerAssetIndex } from '../../../src/assets/asset-index.ts';
import { Engine } from '../../../src/runtime/engine.ts';
import { resolveCapabilities } from '../../../src/assembly/capability-registry.ts';
import { hashSnapshot } from '../../../src/net/determinism.ts';
import { hashWorld } from '../../../src/net/world-hash.ts';

const ensure = (value, message) => { if (!value) throw new Error(message); };
const maxError = (a, b) => Math.max(...a.map((value, i) => Math.abs(value - b[i])));
const digest = bytes => { let h = 2166136261; for (const byte of bytes) h = Math.imul(h ^ byte, 16777619); return (h >>> 0).toString(16); };
let clock = 1000, readOnlyChecks = 0, observerTicks = 0, mainDraws = 0, postDraws = 0, rayCalls = 0, worldUICalls = 0;
Object.defineProperty(performance, 'now', { configurable: true, value: () => clock });
const assets = createManifestAssets(), backend = new ThreeRenderer({ assets, width: 900, height: 600, dprCap: 1, antialias: false, shadowMapSize: 512 });
backend.init(document.getElementById('stage')); backend.resize(900, 600);
const gl = backend.gl.getContext(), trackedBuffers = new Set(); let buffersCreated = 0, buffersDeleted = 0;
const createBuffer = gl.createBuffer.bind(gl), deleteBuffer = gl.deleteBuffer.bind(gl);
gl.createBuffer = (...args) => { const buffer = createBuffer(...args); if (buffer) { trackedBuffers.add(buffer); buffersCreated++; } return buffer; };
gl.deleteBuffer = buffer => { deleteBuffer(buffer); if (trackedBuffers.delete(buffer)) buffersDeleted++; };
const buffers = () => ({ live: trackedBuffers.size, created: buffersCreated, deleted: buffersDeleted, initBaseline: 0 });
const wideFrame = { eye: [3.6, 2.5, 5.4], target: [0, .9, 0] }, closeFrame = { eye: [.9, 1.45, 3], target: [-.35, .95, 0] }, panFrom = { eye: [-2.8, 2.2, 4.8], target: [-.4, .9, 0] }, panTo = { eye: [2.9, 1.7, 3.8], target: [.4, .85, .1] };
const table = { type: 'CameraShot3D', shots: { wide: { keyframes: [{ at: 0, ...wideFrame }] }, close: { keyframes: [{ at: 0, ...closeFrame }] }, linear: { keyframes: [{ at: 0, ...panFrom, ease: 'linear' }, { at: 1, ...panTo }] }, cubic: { keyframes: [{ at: 0, ...panFrom, ease: 'cubicOut' }, { at: 1, ...panTo }] }, pan: { keyframes: [{ at: 0, ...panFrom, ease: 'inOut' }, { at: 1, ...panTo }] } }, onSignal: [{ signal: 'wide', shot: 'wide' }, { signal: 'close', shot: 'close' }, { signal: 'linear', shot: 'linear' }, { signal: 'cubic', shot: 'cubic' }, { signal: 'pan', shot: 'pan' }] };
const baseCamera = { type: 'Camera3D', yaw: 0, pitch: 0, distance: 5, pivotX: 0, pivotY: 1, pivotZ: 0, near: .1, far: 40, fov: 50 };
const pausedGraph = { clips: { walk: { asset: 'motion/walk', clip: 'walk', speed: 0 } }, states: { standing: { clip: 'walk' } }, transitions: [], params: { speed: 'speed' } };
const raw = { entities: {
  camera: { Camera3D: structuredClone(baseCamera), CameraShot3D: structuredClone(table) },
  post: { Post3D: { grade: { exposure: 1.03, contrast: 1.02, saturation: 1.05 }, vignette: { intensity: .1, smoothness: .5, color: 0x101522 } } },
  floor: { Transform3D: { x: 0, y: -.1, z: 0 }, Mesh3D: { shape: 'box', width: 9, height: .15, depth: 5, frontTint: 0x8295a5 } },
  'actor-a': { Transform3D: { x: -.8, y: 0, z: 0 }, Model3D: { modelKey: 'model/a' }, Velocity: { vx: 0, vy: 0, angular: 0 }, AnimGraph3D: structuredClone(pausedGraph), WorldUI3D: { text: 'Generic fixture A', size: 'sm', offsetY: 1.85 } },
  'actor-b': { Transform3D: { x: .95, y: 0, z: -.2 }, Model3D: { modelKey: 'model/b', scale: .9 }, Velocity: { vx: 0, vy: 0, angular: 0 }, AnimGraph3D: structuredClone(pausedGraph) },
  'model-prop': { Transform3D: { x: .15, y: .15, z: .7, scale: .22 }, Model3D: { modelKey: 'model/prop', scale: .7 } },
  'pick-target': { Transform3D: { x: 0, y: .45, z: .5 }, Mesh3D: { shape: 'box', width: .28, height: .3, depth: .22, frontTint: 0xffbb33 }, Material3D: { preset: 'plastic', color: 0xffbb33, roughness: .35 }, Pickable3D: { signal: 'fixture-pick' } },
  mover: { Transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }, Velocity: { vx: .0001, vy: 0, angular: 0 } },
  control: {},
  timeline: { Timeline: { id: 'camera-probe', playOnSignal: 'timeline-play', cues: [{ at: 0, do: { kind: 'signal', signal: 'wide' } }, { at: 1, do: { kind: 'signal', signal: 'linear' } }, { at: 2, do: { kind: 'signal', signal: 'close' } }, { at: 3, do: { kind: 'signal', signal: 'pan' } }] } },
} };
const caps = resolveCapabilities(['a1-transform', 'b1-velocity', 'b3-mass', 't1-motion-apply', 't3-timeline']);
function makePair() {
  const a = new Engine(), b = new Engine();
  for (const engine of [a, b]) {
    engine.load({ entities: structuredClone(raw.entities), capabilities: caps });
    engine.world.addSystem({ id: 'camera-probe-cleanup', phase: 30, reads: ['ShotProbeInstruction'], writes: ['Signal', 'CameraShot3D'], consumes: ['Signal'], execute(view) {
      const instruction = view.getComponent('control', 'ShotProbeInstruction'); if (!instruction) return;
      if (instruction.mode === 'dynamic') view.addComponent('camera', structuredClone(instruction.table));
      if (instruction.mode === 'consumes') { if (!view.getAllEntities().includes('consumed-signal')) view.createEntity('consumed-signal'); view.addComponent('consumed-signal', { type: 'Signal', name: instruction.names[0], source: 'probe-system' }); }
      else for (const name of instruction.names) { view.createEntity('instant-signal'); view.addComponent('instant-signal', { type: 'Signal', name, source: 'probe-system' }); view.destroyEntity('instant-signal'); }
    } });
  }
  return { world: a.world, replica: b.world };
}
const pair = makePair(); let world = pair.world, replica = pair.replica, renderWorld = world;
world.setObserver({ onTickStart() { observerTicks++; } });
window.e6Report = {};
const record = (name, value) => (window.e6Report[name] = value);
const nativeLooks = new WeakMap(), drawUniforms = new WeakMap(), monitored = new WeakSet(); let activeMesh, lastMainDrawFrame = -1;
for (const camera of [backend.cameras.persp, backend.cameras.ortho]) { const native = camera.lookAt.bind(camera); camera.lookAt = (...args) => { nativeLooks.set(camera, args[0]?.isVector3 ? args[0].toArray() : args.slice(0, 3)); return native(...args); }; }
const nativeRender = backend.gl.render.bind(backend.gl); backend.gl.render = (scene, camera) => { if (scene === backend.scene) { ensure(camera === backend.cameras.current, 'Native scene render received a different camera'); mainDraws++; } else activeMesh = undefined; return nativeRender(scene, camera); };
const nativePost = backend.post.render.bind(backend.post); backend.post.render = (...args) => { ensure(args[1] === backend.cameras.current, 'Post pipeline received a different native camera'); postDraws++; return nativePost(...args); };
const nativeWorldUI = backend.worldUi.sync.bind(backend.worldUi); backend.worldUi.sync = (...args) => { ensure(args[1] === backend.cameras.current, 'WorldUI received a different native camera'); worldUICalls++; return nativeWorldUI(...args); };
const nativeRay = THREE.Raycaster.prototype.setFromCamera; THREE.Raycaster.prototype.setFromCamera = function (point, camera) { ensure(camera === backend.cameras.current, 'Public pick/screenToWorld ray received a different camera'); rayCalls++; return nativeRay.call(this, point, camera); };
for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) { const native = gl[name].bind(gl); gl[name] = (...args) => { native(...args); if (!activeMesh) return; const program = gl.getParameter(gl.CURRENT_PROGRAM), p = gl.getUniformLocation(program, 'projectionMatrix'), v = gl.getUniformLocation(program, 'viewMatrix'); if (p) { lastMainDrawFrame = backend.frame; drawUniforms.set(activeMesh, { frame: backend.frame, projection: Array.from(gl.getUniform(program, p)), view: v ? Array.from(gl.getUniform(program, v)) : undefined }); } }; }
function watch() { let added = 0; backend.scene.traverse(mesh => { if (!mesh.isMesh || monitored.has(mesh)) return; monitored.add(mesh); added++; const native = mesh.onBeforeRender, shadow = mesh.onBeforeShadow; mesh.onBeforeRender = function (...args) { native.apply(this, args); activeMesh = args[1] === backend.scene ? this : undefined; if (activeMesh) ensure(args[2] === backend.cameras.current, 'Actual mesh draw received wrong camera'); }; mesh.onBeforeShadow = function (...args) { shadow.apply(this, args); activeMesh = undefined; }; }); return added; }
function sync(dt = 0, current = renderWorld) {
  clock += dt * 1000; watch(); const snap = JSON.stringify(current.snapshot()), full = hashSnapshot(current.snapshot()), incremental = hashWorld(current), version = current.getVersion(), dirty = JSON.stringify([...current.dirty]);
  ensure(full === incremental, 'Full/incremental hash mismatch before camera sync'); backend.sync(current.readView()); if (watch() > 0) { backend.lastRenderSig = ''; backend.sync(current.readView()); }
  ensure(snap === JSON.stringify(current.snapshot()) && full === hashSnapshot(current.snapshot()) && incremental === hashWorld(current) && version === current.getVersion() && dirty === JSON.stringify([...current.dirty]), 'Camera shots mutated snapshot/hash/writeSequence/dirty'); readOnlyChecks++;
  return backend.readStats().rendered;
}
function bothAdd(id, data) { for (const current of [world, replica]) current.addComponent(id, structuredClone(data)); }
function bothRemove(id, type) { for (const current of [world, replica]) current.removeComponent(id, type); }
function pulse(name) { for (const current of [world, replica]) { if (!current.getAllEntities().includes('pulse')) current.createEntity('pulse'); current.addComponent('pulse', { type: 'Signal', name, source: 'probe-pulse' }); } }
function tick(count = 1) { for (let i = 0; i < count; i++) { world.tick(); replica.tick(); ensure(hashSnapshot(world.snapshot()) === hashSnapshot(replica.snapshot()) && hashWorld(world) === hashWorld(replica), 'Complete/incremental simulation hashes diverged'); } }
function installTable(value = table) { bothAdd('camera', value); }
function clearShot() { bothRemove('camera', 'CameraShot3D'); bothAdd('camera', baseCamera); sync(0); }
const easing = (k, kind) => kind === 'cubicOut' ? 1 - (1 - k) ** 3 : kind === 'inOut' ? k * k * (3 - 2 * k) : k;
function sample(k, kind = 'linear') { const t = easing(k, kind); return { eye: panFrom.eye.map((value, i) => value + (panTo.eye[i] - value) * t), target: panFrom.target.map((value, i) => value + (panTo.target[i] - value) * t) }; }
function cameraFrame(expected) {
  const camera = backend.cameras.current; camera.updateWorldMatrix(true, false); const independent = new THREE.PerspectiveCamera(); independent.position.fromArray(expected.eye); independent.lookAt(new THREE.Vector3(...expected.target)); independent.updateWorldMatrix(true, false);
  const eyeError = maxError(camera.position.toArray(), expected.eye), targetError = maxError(nativeLooks.get(camera) ?? [Infinity, Infinity, Infinity], expected.target), matrixError = maxError(camera.matrixWorld.elements, independent.matrixWorld.elements);
  ensure(eyeError < 1e-8 && targetError < 1e-8 && matrixError < 1e-8, 'Actual camera shot matrix/eye/target mismatch: ' + JSON.stringify({ expected, actualEye: camera.position.toArray(), actualTarget: nativeLooks.get(camera), eyeError, targetError, matrixError }));
  let gpuError = 0, gpuSamples = 0; backend.scene.traverse(mesh => { const uploaded = drawUniforms.get(mesh); if (!uploaded || uploaded.frame !== lastMainDrawFrame) return; gpuSamples++; gpuError = Math.max(gpuError, maxError(uploaded.projection, camera.projectionMatrix.elements)); if (uploaded.view) gpuError = Math.max(gpuError, maxError(uploaded.view, camera.matrixWorldInverse.elements)); }); ensure(gpuSamples > 0 && gpuError < 3e-5, 'Native GPU camera uniforms differ from CameraRig.current: ' + gpuError);
  return { expected, actualEye: camera.position.toArray(), actualTarget: nativeLooks.get(camera), nativeMatrix: camera.matrixWorld.toArray(), eyeError, targetError, matrixError, gpuError, gpuSamples };
}
function services() {
  const camera = backend.cameras.current, point = new THREE.Vector3(0, .45, .5), projected = point.clone().project(camera), rect = backend.gl.domElement.getBoundingClientRect(), client = { x: rect.left + (projected.x + 1) * rect.width / 2, y: rect.top + (1 - projected.y) * rect.height / 2 };
  const hit = backend.pick(client.x, client.y), roundTrip = backend.screenToWorld(client.x, client.y, .5, 'z'); ensure(hit?.entityId === 'pick-target' && roundTrip && maxError([roundTrip.x, roundTrip.y, roundTrip.z], point.toArray()) < 1e-7, 'Public picking/screenToWorld did not use actual shot camera');
  const anchor = new THREE.Vector3(-.8, 1.85, 0).project(camera), item = backend.worldUi.items.get('actor-a'), expectedUI = [(anchor.x + 1) * 450, (1 - anchor.y) * 300]; ensure(item, 'Actual WorldUI host missing'); const visible = anchor.z < 1 && anchor.x >= -1.05 && anchor.x <= 1.05 && anchor.y >= -1.05 && anchor.y <= 1.05; ensure((item.host.style.display !== 'none') === visible, 'WorldUI visibility did not use native camera projection'); let uiError = 0; if (visible) { uiError = maxError([parseFloat(item.host.style.left), parseFloat(item.host.style.top)], expectedUI); ensure(uiError < .001, 'WorldUI pixel position differs from native camera.project: ' + JSON.stringify({ expectedUI, actual: [item.host.style.left, item.host.style.top], uiError })); }
  ensure(backend.post.renderPass?.camera === camera && mainDraws > 0 && postDraws > 0 && worldUICalls > 0 && rayCalls > 0, 'Post/render/WorldUI/rays did not share CameraRig.current');
  return { hit, client, roundTrip, expectedUI, uiError, uiVisible: visible, oneNativeCamera: true, mainDraws, postDraws, worldUICalls, rayCalls };
}
function pixels() { const bytes = new Uint8Array(900 * 600 * 4); gl.readPixels(0, 0, 900, 600, gl.RGBA, gl.UNSIGNED_BYTE, bytes); return digest(bytes); }
function resources() { return { gpu: { ...backend.gl.info.memory }, buffers: buffers(), instances: backend.models.instances.size, templates: backend.models.cache.size, motions: backend.models.motions.size }; }
async function ready() { for (let attempt = 0; attempt < 300; attempt++) { sync(); if (['actor-a', 'actor-b', 'model-prop'].every(id => backend.models.instance(id)) && ['actor-a', 'actor-b'].every(id => backend.models.graphs.get(id)?.controller)) { sync(); return; } await new Promise(resolve => requestAnimationFrame(resolve)); } throw new Error('Formal camera-shot scene readiness timeout'); }
window.e6Probe = {
  async load() { const index = parseAssetIndex(await (await fetch('/fixtures/index.json')).json()); registerAssetIndex(assets, index, '/'); await assets.preloadGroup('cast'); await ready(); const ext = gl.getExtension('WEBGL_debug_renderer_info'); return record('load', { gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), noAutomaticPlayback: cameraFrame({ eye: [0, 1, 5], target: [0, 1, 0] }), services: services(), pixels: pixels(), resources: resources() }); },
  baselines() {
    clearShot(); const orbit = cameraFrame({ eye: [0, 1, 5], target: [0, 1, 0] }); bothAdd('camera', { ...baseCamera, mode: 'follow', target: 'pick-target', distance: 4, follow: { lag: 0, lookAhead: 0 } }); sync(); const follow = cameraFrame({ eye: [0, .45, 4.5], target: [0, .45, .5] });
    bothAdd('camera', { ...baseCamera, projection: 'ortho', orthoSize: 2 }); sync(); ensure(backend.cameras.current.isOrthographicCamera, 'No-shot orthographic baseline changed'); const ortho = cameraFrame({ eye: [0, 1, 5], target: [0, 1, 0] }); services();
    bothAdd('camera', { ...baseCamera }); sync(); bothAdd('camera', { ...baseCamera, yaw: Math.PI / 2, tween: { trigger: 1, dur: 1, ease: 'linear' } }); sync(); const tweenStart = cameraFrame({ eye: [0, 1, 5], target: [0, 1, 0] }); sync(.25); const tweenMid = cameraFrame({ eye: [1.25, 1, 3.75], target: [0, 1, 0] }); sync(.75); const tweenEnd = cameraFrame({ eye: [5, 1, 0], target: [0, 1, 0] }); clearShot(); installTable(); sync(); return record('baselines', { orbit, follow, ortho, tweenStart, tweenMid, tweenEnd });
  },
  wide() { pulse('wide'); const rendered = sync(); ensure(rendered, 'First hard-cut frame did not render'); return record('wide', { camera: cameraFrame(wideFrame), services: services(), rendered, pixels: pixels() }); },
  closeup() {
    const eases = []; for (const [signal, kind] of [['linear', 'linear'], ['cubic', 'cubicOut'], ['pan', 'inOut']]) { pulse(signal); sync(); const first = cameraFrame(panFrom); sync(.25); const middle = cameraFrame(sample(.25, kind)), middlePixel = pixels(); const finalRendered = sync(.75), last = cameraFrame(panTo); ensure(finalRendered && middlePixel !== pixels(), 'Final shot pose did not draw actual changed pixels'); const held = [sync(.01), sync(.01), sync(.01)]; ensure(held.every(value => !value), 'Held last shot key permanently redrew the scene'); eases.push({ kind, first, middle, last, finalRendered, held }); }
    pulse('close'); sync(); return record('closeup', { eases, camera: cameraFrame(closeFrame), services: services(), pixels: pixels() });
  },
  pan() {
    pulse('pan'); sync(); const repeats = []; for (let frame = 1; frame <= 36; frame++) { sync(1 / 144); const result = cameraFrame(sample(frame / 144, 'inOut')); if (frame % 9 === 0) repeats.push(result); }
    pulse('pan'); sync(); const samePayloadReplay = cameraFrame(panFrom); sync(.1); pulse('linear'); sync(); const interrupted = cameraFrame(panFrom);
    bothAdd('camera', { ...baseCamera, yaw: -Math.PI / 2, tween: { trigger: 22, dur: 2, ease: 'linear' } }); pulse('close'); sync(); const tweenBypassed = cameraFrame(closeFrame); pulse('pan'); sync(); sync(.5); return record('pan', { renderHz: 144, sameTickSamples: repeats, samePayloadReplay, interrupted, tweenBypassed, camera: cameraFrame(sample(.5, 'inOut')), services: services(), pixels: pixels() });
  },
  catchup() {
    pulse('timeline-play'); const beforeObserver = observerTicks; tick(5); ensure(world.queryEntities('Signal').length === 0, 'Cleanup did not consume/destroy transient timeline signals'); sync(); const timeline = cameraFrame(panFrom); ensure(observerTicks === beforeObserver + 5, 'Camera listener overwrote the existing tick observer');
    bothAdd('control', { type: 'ShotProbeInstruction', mode: 'instant', names: ['wide', 'close', 'linear'] }); tick(); bothRemove('control', 'ShotProbeInstruction'); ensure(world.queryEntities('Signal').length === 0 && !world.getAllEntities().includes('instant-signal'), 'Same-system transient signal was not destroyed'); sync(); const instant = cameraFrame(panFrom);
    bothAdd('control', { type: 'ShotProbeInstruction', mode: 'consumes', names: ['close'] }); tick(); bothRemove('control', 'ShotProbeInstruction'); ensure(world.queryEntities('Signal').length === 0, 'System consumes seam did not remove the published signal'); sync(); const consumed = cameraFrame(closeFrame);
    clearShot(); const dynamic = structuredClone(table); dynamic.shots.close.keyframes[0].eye = [.2, 1.3, 2.8]; bothAdd('control', { type: 'ShotProbeInstruction', mode: 'dynamic', table: dynamic, names: ['close'] }); tick(); bothRemove('control', 'ShotProbeInstruction'); sync(); const dynamicTable = cameraFrame(dynamic.shots.close.keyframes[0]); installTable(); sync(); return record('catchup', { timelineFiveTicks: timeline, transientSameSystem: instant, consumedSameTick: consumed, dynamicTableThenSignal: dynamicTable, observerPreserved: true });
  },
  boundaries() {
    clearShot(); installTable(); sync(); pulse('linear'); sync(); sync(.25); installTable(structuredClone(table)); sync(.25); const equalReplacement = cameraFrame(sample(.5));
    const changed = structuredClone(table); changed.shots.linear.keyframes[0].eye = [-2.4, 1.4, 4]; installTable(changed); sync(); const contentChanged = cameraFrame({ eye: [0, 1, 5], target: [0, 1, 0] }); clearShot(); const removed = cameraFrame({ eye: [0, 1, 5], target: [0, 1, 0] }); installTable(); sync(); pulse('wide'); sync();
    for (const current of [world, replica]) { current.destroyEntity('camera'); current.createEntity('camera'); current.addComponent('camera', structuredClone(baseCamera)); current.addComponent('camera', structuredClone(table)); } sync(); const sameId = cameraFrame({ eye: [0, 1, 5], target: [0, 1, 0] });
    const switched = makePair(); switched.world.createEntity('restored-old-signal'); switched.world.addComponent('restored-old-signal', { type: 'Signal', name: 'close', source: 'old' }); renderWorld = switched.world; sync(); ensure(world.componentObservers === undefined, 'World switch retained the old camera-shot observer'); const switchBaseline = cameraFrame({ eye: [0, 1, 5], target: [0, 1, 0] }); pulse('wide'); sync(0, switched.world); cameraFrame({ eye: [0, 1, 5], target: [0, 1, 0] }); renderWorld = world; sync(); ensure(switched.world.componentObservers === undefined, 'Returning from World switch retained the abandoned camera-shot observer'); const returnBaseline = cameraFrame({ eye: [0, 1, 5], target: [0, 1, 0] });
    pulse('close'); sync(); const snap = world.snapshot(), order = world.snapshotOrder(); world.restore(snap, order); replica.restore(snap, order); sync(); const restored = cameraFrame({ eye: [0, 1, 5], target: [0, 1, 0] }); return record('boundaries', { equalReplacement, contentChanged, removed, sameId, switchBaseline, returnBaseline, restored });
  },
  soak() {
    pulse('close'); sync(); sync(1); const start = resources(), hashes = []; for (let tickIndex = 0; tickIndex < 2000; tickIndex++) { if (tickIndex % 125 === 0) pulse(tickIndex % 250 === 0 ? 'linear' : 'pan'); tick(); sync(1 / 144); const full = hashSnapshot(world.snapshot()), incremental = hashWorld(world); ensure(full === hashSnapshot(replica.snapshot()) && incremental === hashWorld(replica) && full === incremental, 'Camera-shot long full/incremental hash diverged'); hashes.push(full); }
    pulse('close'); sync(); sync(1); const end = resources(); ensure(start.gpu.geometries === end.gpu.geometries && start.gpu.textures === end.gpu.textures && start.buffers.live === end.buffers.live && start.instances === end.instances, 'Long camera-shot rendering grew native GPU resources'); return record('soak', { ticks: hashes.length, completeHashSequence: hashes, start, end, readOnlyChecks, observerTicks, signalExcludedFromHash: false });
  },
  async lifecycle() { const cycles = []; for (let cycle = 0; cycle < 5; cycle++) { assets.releaseGroup('cast'); sync(); const evicted = resources(); ensure(evicted.instances === 0 && evicted.templates === 0 && evicted.motions === 0, 'Asset eviction retained camera scene models'); await assets.preloadGroup('cast'); await ready(); services(); cycles.push({ evicted, reloaded: resources() }); } ensure(cycles.every(row => row.reloaded.gpu.geometries === cycles[0].reloaded.gpu.geometries && row.reloaded.gpu.textures === cycles[0].reloaded.gpu.textures && row.reloaded.buffers.live === cycles[0].reloaded.buffers.live), 'Camera scene reload resources grew'); return record('lifecycle', { cycles }); },
  destroy() { for (const current of [world, replica]) for (const id of current.getAllEntities()) { if (id !== 'camera') current.destroyEntity(id); } sync(); assets.releaseGroup('cast'); sync(); const before = resources(); ensure(world.componentObservers !== undefined, 'Destroy probe did not retain a live camera-shot observer before renderer destroy'); backend.destroy(); ensure(world.componentObservers === undefined, 'Renderer destroy retained camera-shot World.componentObservers subscription'); world.createEntity('post-destroy-signal'); world.addComponent('post-destroy-signal', { type: 'Signal', name: 'wide', source: 'destroy-probe' }); ensure(world.componentObservers === undefined, 'Signal publication after destroy recreated the old camera-shot subscription'); backend.destroy(); const after = { ...backend.gl.info.memory }, result = record('destroy', { before, after, observerUnsubscribed: world.componentObservers === undefined, nativeBuffers: buffers(), contextLost: gl.isContextLost(), readOnlyChecks, mainDraws, postDraws, rayCalls, worldUICalls }); ensure(after.geometries === 0 && after.textures === 0 && trackedBuffers.size === 0 && buffersCreated === buffersDeleted, 'Camera scene destroy retained native GPU resources: ' + JSON.stringify({ after, buffers: buffers() })); THREE.Raycaster.prototype.setFromCamera = nativeRay; return result; },
};
