// Real AssetIndex -> AssetManager -> ModelPool -> ThreeRenderer acceptance probe.
import * as THREE from 'three';
import { ThreeRenderer } from '../../../src/renderer/three-renderer.ts';
import { createManifestAssets } from '../../../src/services/scene-game-assets.ts';
import { parseAssetIndex, registerAssetIndex } from '../../../src/assets/asset-index.ts';
import { Engine } from '../../../src/runtime/engine.ts';
import { resolveCapabilities } from '../../../src/assembly/capability-registry.ts';
import { hashSnapshot } from '../../../src/net/determinism.ts';

const ensure = (value, message) => { if (!value) throw new Error(message); };
const close = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
let clock = 1000, hashChecks = 0;
Object.defineProperty(performance, 'now', { configurable: true, value: () => clock });
const assets = createManifestAssets();
const backend = new ThreeRenderer({ assets, width: 720, height: 480, dprCap: 1, antialias: false, shadowMapSize: 512 });
backend.init(document.getElementById('stage'));
const gl = backend.gl.getContext(), engine = new Engine(), replica = new Engine(), world = engine.world;
const ids = ['hero-a', 'hero-a-copy', 'hero-b'];
const graph = {
  // `run` deliberately reuses the generic fixture walk at 2x; it is not a
  // separately captured running animation or paid-provider evidence.
  type: 'AnimGraph3D', clips: { idle: { asset: 'motion/idle', clip: 'idle' }, walk: { asset: 'motion/walk', clip: 'walk' }, run: { asset: 'motion/walk', clip: 'walk', speed: 2 }, reach: { asset: 'motion/reach', clip: 'reach', loop: false } },
  states: { locomotion: { blend: { param: 'speed', points: [{ at: 0, clip: 'idle' }, { at: .001, clip: 'walk' }, { at: .002, clip: 'run' }] } }, reaching: { clip: 'reach' } },
  transitions: [{ from: 'locomotion', to: 'reaching', whenParam: 'reach', cmp: 'eq', value: true, fade: .2 }],
  params: { speed: 'speed', reach: 'flag:reach' },
};
const raw = { entities: {
  camera: { Camera3D: { yaw: .3, pitch: .32, distance: 6, pivotX: 0, pivotY: .9, pivotZ: 0, near: .1, far: 30 } },
  floor: { Transform3D: { x: 0, y: -.08, z: 0 }, Mesh3D: { shape: 'box', width: 8, height: .12, depth: 5, frontTint: 0x708090 } },
  flags: { Flag: { id: 'reach', active: false } },
} };
ids.forEach((id, i) => { raw.entities[id] = { Transform: { x: (i - 1) * 1.4, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }, Velocity: { vx: 0, vy: 0, angular: 0 }, Model3D: { modelKey: i === 2 ? 'model/b' : 'model/a' }, AnimGraph3D: structuredClone(graph) }; });
const caps = resolveCapabilities(['a1-transform', 'b1-velocity', 'b3-mass', 't1-motion-apply']);
engine.load({ ...raw, capabilities: caps });
const replicaRaw = structuredClone(raw); for (const id of ids) delete replicaRaw.entities[id].AnimGraph3D;
replica.load({ ...replicaRaw, capabilities: caps });
window.e2Report = {};
function sync(dt = .1) {
  clock += dt * 1000;
  const before = hashSnapshot(world.snapshot()), serialized = JSON.stringify(world.snapshot()), version = world.getVersion();
  backend.sync(world.readView());
  ensure(before === hashSnapshot(world.snapshot()) && serialized === JSON.stringify(world.snapshot()) && version === world.getVersion(), 'Renderer mutated the world');
  hashChecks++;
  return backend.readStats().rendered;
}
function object(id) { return backend.models.instances.get(id); }
function controller(id) { return backend.models.graphs.get(id)?.controller; }
function mesh(id) { let result; object(id)?.traverse(node => { if (node.isSkinnedMesh) result = node; }); return result; }
function digest(bytes) { let value = 2166136261; for (const byte of bytes) value = Math.imul(value ^ byte, 16777619); return (value >>> 0).toString(16); }
function pixels() { const bytes = new Uint8Array(720 * 480 * 4); gl.readPixels(0, 0, 720, 480, gl.RGBA, gl.UNSIGNED_BYTE, bytes); return digest(bytes); }
function shadow() { const target = backend.lights.key.shadow.map; ensure(target, 'Real native shadow target missing'); const bytes = new Uint8Array(target.width * target.height * 4); backend.gl.readRenderTargetPixels(target, 0, 0, target.width, target.height, bytes); return { hash: digest(bytes), width: target.width, height: target.height, uploaded: gl.isTexture(backend.gl.properties.get(target.texture).__webglTexture) }; }
const poseVertices = new WeakMap();
function pose(id) {
  const model = mesh(id); ensure(model, 'Missing SkinnedMesh for ' + id); object(id).updateMatrixWorld(true); model.skeleton.update();
  const bones = model.skeleton.bones.map(bone => [...bone.position.toArray(), ...bone.quaternion.toArray()]);
  const positions = model.geometry.attributes.position, vertices = [];
  for (let i = 0; i < positions.count; i++) vertices.push(...model.applyBoneTransform(i, new THREE.Vector3().fromBufferAttribute(positions, i)).toArray());
  const result = { bones, vertexHash: digest(new Uint8Array(new Float32Array(vertices).buffer)), boneTextureUploaded: !!model.skeleton.boneTexture && gl.isTexture(backend.gl.properties.get(model.skeleton.boneTexture).__webglTexture), graph: controller(id)?.debug };
  poseVertices.set(result, vertices); return result;
}
function resources() { return { memory: { ...backend.gl.info.memory }, instances: backend.models.instances.size, models: backend.models.cache.size, motions: backend.models.motions.size, pendingModels: backend.models.parsing.size, pendingMotions: backend.models.motionParsing.size, graphResources: ids.map(id => controller(id)?.debug.resources).filter(Boolean) }; }
function edit(type, id, values) { for (const current of [world, replica.world]) { Object.assign(current.getComponent(id, type), values); current.markDirty(id, type); } }
function replaceGraphs(value) { for (const id of ids) world.addComponent(id, structuredClone(value)); }
async function ready() {
  for (let attempt = 0; attempt < 300; attempt++) { sync(); if (ids.every(id => object(id) && controller(id))) return; await new Promise(resolve => requestAnimationFrame(resolve)); }
  throw new Error('AssetManager/ModelPool animation graph readiness timeout: ' + JSON.stringify(resources()));
}
function record(name, value) { window.e2Report[name] = value; return value; }
window.e2Probe = {
  async load() {
    const index = parseAssetIndex(await (await fetch('/fixtures/index.json')).json()); registerAssetIndex(assets, index, '/'); await assets.preloadGroup('cast'); await ready();
    const a = mesh(ids[0]), copy = mesh(ids[1]), b = mesh(ids[2]);
    ensure(a.skeleton !== copy.skeleton && a.skeleton !== b.skeleton && a.skeleton.bones[0] !== copy.skeleton.bones[0], 'Instances share a live skeleton/bone');
    ensure(a.geometry !== b.geometry && a.geometry.attributes.position.array[0] !== b.geometry.attributes.position.array[0], 'Second mesh must contain different actual position bytes');
    ensure(ids.every(id => pose(id).boneTextureUploaded), 'Native GPU bone texture not uploaded');
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return record('load', { webgl: gl.getParameter(gl.VERSION), gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), poses: ids.map(pose), pixels: pixels(), shadow: shadow(), resources: resources(), independentBones: true });
  },
  blend() {
    const paused = structuredClone(graph); for (const config of Object.values(paused.clips)) config.speed = 0;
    replaceGraphs(paused); for (const id of ids) edit('Velocity', id, { vx: 0 }); sync();
    const idle = ids.map(pose), idlePixel = pixels(), idleShadow = shadow();
    // Paused clip first frames may be equal, so first prove actual weights, then
    // advance native clips for visible pose/pixel/shadow evidence.
    edit('Velocity', ids[0], { vx: .0005 }); edit('Velocity', ids[1], { vx: .001 }); sync();
    ensure(close(controller(ids[0]).debug.weights.idle, .5) && close(controller(ids[0]).debug.weights.walk, .5), 'Expected actual 1D midpoint weights');
    ensure(controller(ids[1]).debug.weights.walk === 1 && controller(ids[2]).debug.weights.idle === 1, 'Independent parameter inputs must select independent weights');
    const weightEvidence = ids.map(id => controller(id).debug.weights);
    replaceGraphs(graph); for (let i = 0; i < 4; i++) sync();
    const animated = ids.map(pose), activePixel = pixels(), activeShadow = shadow();
    ensure(idle.some((p, i) => p.vertexHash !== animated[i].vertexHash), 'Native skinned vertices did not move');
    ensure(idlePixel !== activePixel && idleShadow.hash !== activeShadow.hash, 'Actual framebuffer and shadow pixels must change');
    ensure(animated[0].vertexHash !== animated[1].vertexHash, 'Same-model independent blends produced identical vertices');
    const locomotionSequence = [], requested = [
      [0, [1, 0, 0]], [.0005, [.5, .5, 0]], [.0015, [0, .5, .5]],
      [.002, [0, 0, 1]], [.001, [0, 1, 0]], [0, [1, 0, 0]],
    ];
    let aliasSpeedProof;
    for (const [speed, expected] of requested) {
      edit('Velocity', ids[0], { vx: speed }); const rendered = sync(1 / 16), debug = controller(ids[0]).debug;
      const weights = ['idle', 'walk', 'run'].map(alias => debug.weights[alias]);
      ensure(weights.every((weight, i) => close(weight, expected[i])) && close(weights.reduce((a, b) => a + b, 0), 1) && debug.weights.reach === 0, 'Idle/walk/run sequence weights disagree at speed ' + speed);
      ensure(debug.actions.walk.speed === 1 && debug.actions.run.speed === 2 && debug.resources.actions === 4, 'Walk/run aliases lack independent native speed/actions');
      const row = { speed, expected, weights: debug.weights, actions: debug.actions, rendered, pixels: pixels(), vertexHash: pose(ids[0]).vertexHash, shadow: shadow() };
      if (speed === .0015) {
        ensure(debug.actions.walk.scheduled && debug.actions.run.scheduled, 'Walk and run must both be active in the upper midpoint');
        sync(1 / 32); const after = controller(ids[0]).debug;
        const walkDelta = after.actions.walk.time - debug.actions.walk.time, runDelta = after.actions.run.time - debug.actions.run.time;
        ensure(close(walkDelta, 1 / 32) && close(runDelta, 1 / 16) && !close(after.actions.walk.time, after.actions.run.time), 'Same-source aliases did not advance independently at 1x/2x');
        aliasSpeedProof = { before: { walk: debug.actions.walk, run: debug.actions.run }, after: { walk: after.actions.walk, run: after.actions.run }, walkDelta, runDelta, pixels: [row.pixels, pixels()] };
        ensure(aliasSpeedProof.pixels[0] !== aliasSpeedProof.pixels[1], 'Independent 1x/2x animation sampling did not change real GPU pixels');
      }
      locomotionSequence.push(row);
    }
    ensure(locomotionSequence.every(row => row.rendered) && new Set(locomotionSequence.map(row => row.pixels)).size >= 4, 'Idle/walk/run round trip did not change the actual GPU framebuffer');
    return record('blend', { weightEvidence, idle, animated, pixels: [idlePixel, activePixel], shadows: [idleShadow, activeShadow], locomotionSequence, aliasSpeedProof, runProvenance: { asset: 'motion/walk', clip: 'walk', speed: 2, source: 'generic-blender-fixture', separateRunningCapture: false } });
  },
  once() {
    edit('Flag', 'flags', { active: true });
    const frames = [];
    // Binary-exact 1/16 deltas avoid a 0.9999999999999999 penultimate
    // sample, whose pixels are already indistinguishable from the endpoint.
    for (let i = 0; i < 22; i++) { const rendered = sync(1 / 16); frames.push({ rendered, time: controller(ids[0]).debug.actions.reach.time, state: controller(ids[0]).debug.state, pixels: pixels() }); }
    record('once', { frames });
    const lastChanging = frames.findIndex((frame, i) => frame.time === 1 && i > 0 && frames[i - 1].time < 1);
    ensure(lastChanging > 0 && frames[lastChanging].rendered, 'LoopOnce final pose did not draw');
    ensure(frames.slice(-3).every(frame => !frame.rendered), 'Stopped graphs did not converge to skipped rendering');
    ensure(frames[lastChanging].pixels !== frames[lastChanging - 1].pixels, 'LoopOnce final pose did not change actual pixels');
    return record('once', { frames, final: ids.map(pose), shadow: shadow() });
  },
  removal() {
    // Remove the graph while a real non-bind pose is displayed, rather than
    // accidentally checking only the reach clip's bind-like endpoint.
    const reaching = structuredClone(graph); reaching.states = { reaching: { clip: 'reach' } }; reaching.transitions = [];
    world.addComponent(ids[0], reaching); for (let i = 0; i < 5; i++) sync();
    const animated = pose(ids[0]), animatedPixel = pixels();
    const removed = object(ids[0]), removedController = controller(ids[0]); world.removeComponent(ids[0], 'AnimGraph3D'); sync();
    ensure(!controller(ids[0]) && removedController.debug.resources.actions === 0, 'Removed graph retained actions');
    const bind = pose(ids[0]);
    const referenceVertices = poseVertices.get(window.e2Report.blend.idle[0]);
    const bindMaxError = Math.max(...poseVertices.get(bind).map((value, i) => Math.abs(value - referenceVertices[i])));
    record('removal', { animatedVertexHash: animated.vertexHash, bindVertexHash: bind.vertexHash, bindMaxError });
    ensure(animated.vertexHash !== bind.vertexHash && bindMaxError < 1e-6, 'Graph removal did not restore actual bind vertices: ' + bindMaxError);
    ensure(animatedPixel !== pixels(), 'Graph removal did not refresh actual GPU framebuffer');
    world.removeComponent(ids[0], 'Model3D'); sync();
    ensure(!backend.scene.getObjectByProperty('uuid', removed.uuid) && !object(ids[0]), 'Removed Model3D left its old object in the actual scene');
    const old = object(ids[1]); world.removeComponent(ids[1], 'Model3D'); world.addComponent(ids[1], { type: 'Mesh3D', shape: 'box', width: .5, height: .8, depth: .5, frontTint: 0xff4477 }); sync();
    ensure(!backend.scene.getObjectByProperty('uuid', old.uuid) && !object(ids[1]), 'Switching to Mesh3D left old model attached');
    const oldB = object(ids[2]); world.addComponent(ids[2], { type: 'Model3D', modelKey: 'model/a' }); sync();
    ensure(!backend.scene.getObjectByProperty('uuid', oldB.uuid), 'Switching model key left old model attached');
    return record('removal', { graphReleased: true, animatedVertexHash: animated.vertexHash, bindVertexHash: bind.vertexHash, bindMaxError, modelRemoved: true, meshReplacementClean: true, modelSwitchClean: true, resources: resources() });
  },
  async soak() {
    edit('Flag', 'flags', { active: false });
    for (let i = 0; i < ids.length; i++) { const id = ids[i]; world.removeComponent(id, 'Mesh3D'); world.addComponent(id, { type: 'Model3D', modelKey: i === 2 ? 'model/b' : 'model/a' }); world.addComponent(id, structuredClone(graph)); }
    await ready(); const start = resources(), hashes = [];
    for (let frame = 0; frame < 2400; frame++) {
      const speed = (frame % 200) / 200 * .002;
      for (const id of ids) edit('Velocity', id, { vx: speed });
      engine.world.tick(); replica.world.tick();
      const actual = hashSnapshot(world.snapshot()), reference = hashSnapshot(replica.world.snapshot());
      ensure(actual === reference, 'Complete simulation hashes diverged at tick ' + frame); hashes.push(actual); sync(1 / 60);
    }
    const end = resources();
    ensure(end.models === 2 && end.motions === 3 && end.instances === 3, 'Unbounded or missing renderer caches');
    ensure(end.graphResources.every(resource => resource.actions === 4 && resource.interpolants === 0 && resource.activeActions <= 3), 'Unbounded native actions/interpolants');
    ensure(end.memory.geometries === start.memory.geometries && end.memory.textures === start.memory.textures, 'GPU allocation grew during steady state');
    return record('soak', { ticks: hashes.length, completeHashSequence: hashes, renderReadOnlyChecks: hashChecks, start, end });
  },
  async lifecycle() {
    const cycles = [];
    for (let cycle = 0; cycle < 5; cycle++) {
      const old = ids.map(object), controllers = ids.map(controller); assets.releaseGroup('cast'); sync();
      ensure(old.every(model => !backend.scene.getObjectByProperty('uuid', model.uuid)), 'Evicted models remain in scene');
      ensure(controllers.every(c => c.debug.resources.actions === 0), 'Evicted graph retained native resources');
      const evicted = resources(); ensure(evicted.models === 0 && evicted.motions === 0 && evicted.instances === 0, 'Eviction retained caches');
      await assets.preloadGroup('cast'); await ready(); const reloaded = resources();
      ensure(reloaded.instances === 3 && reloaded.models === 2 && reloaded.motions === 3, 'Reload did not restore bounded caches');
      cycles.push({ evicted, reloaded });
    }
    ensure(cycles.every(cycle => cycle.reloaded.memory.geometries === cycles[0].reloaded.memory.geometries && cycle.reloaded.memory.textures === cycles[0].reloaded.memory.textures), 'Repeated reload grew GPU resources');
    return record('lifecycle', { cycles });
  },
  destroy() {
    const controllers = ids.map(controller); for (const id of world.getAllEntities()) world.destroyEntity(id); sync(); assets.releaseGroup('cast'); sync();
    ensure(controllers.every(c => c.debug.resources.actions === 0), 'Destroyed entities retained native actions');
    const before = resources(); backend.destroy(); backend.destroy(); const after = { ...backend.gl.info.memory };
    ensure(after.geometries === 0 && after.textures === 0, 'Renderer destroy retained GPU resources');
    return record('destroy', { before, after, contextLost: gl.isContextLost(), renderReadOnlyChecks: hashChecks });
  },
};
