import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { AssetManager } from '../src/assets/asset-manager';
import { parseAssetIndex, registerAssetIndex } from '../src/assets/asset-index';
import { parseManifest, parseManifestDetailed } from '../src/assembly/manifest';
import { Engine } from '../src/runtime/engine';
import { WorldHasher } from '../src/net/world-hash';
import { hashSnapshot } from '../src/net/determinism';
import { readAnimGraphParams } from '../src/renderer/three/animation-graph-params';
import { collectRenderables } from '../src/renderer/renderable';
import { getCamera3D } from '../src/engine/protocol/camera-view';
import { InverseKinematics } from '../src/renderer/three/inverse-kinematics';
import { modelYawFromFaceDir } from '../src/renderer/three/model-motion';
import { AnimationGraphController } from '../src/renderer/three/animation-graph';
import { makeMockCharacterGlb } from './fixtures/character-pipeline/mock-character.mjs';
import { createV1CpuScene } from './fixtures/v1-teapot/cpu-scene.mjs';
import { createV1KettleFixture } from './lib/v1-teapot-fixtures.mjs';
import { unpack } from './fixtures/scene-import/glb-fixtures.mjs';

const MANIFEST_PATH = new URL('./fixtures/v1-teapot/manifest.json', import.meta.url);
const manifest = () => JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const EXPECTED_IDS = [
  't2-zone-occupancy', 't2-event-when', 't3-flow', 't2-effect-apply', 't2-pathfind',
  't2-navigation-grid', 't2-ground-walk-3d', 't2-over-time', 't1-motion-apply',
  'd1-overlap-detect-3d', 'd-collision-resolve-3d', 'a-scene-import-3d',
  'a1-transform', 'b1-velocity', 'f2-flag', 'g2-relation', 'h1-visibility', 't2-hitbox', 't2-face-rotate',
];
const RENDER_ONLY = new Set(['Transform3D', 'Model3D', 'Pickable3D', 'AnimGraph3D', 'IK3D', 'Attach3D',
  'Mesh3D', 'Material3D', 'Camera3D', 'CameraShot3D', 'Light3D', 'Sky3D']);
const REQUIRED_KEYS = ['scene', 'model/hero', 'model/kettle', 'motion/idle', 'motion/walk', 'motion/reach'];
let fixture;

beforeAll(async () => { fixture = await createV1CpuScene(); });
afterEach(() => vi.restoreAllMocks());

async function assets({ corruptScene = false } = {}) {
  const sceneBytes = Buffer.from(fixture.bytes);
  if (corruptScene) sceneBytes[sceneBytes.length - 1] ^= 1;
  // These are synthetic unit inputs. No actual T5 source, model rendering or GPU proof is claimed.
  const bytes = new Map([
    ['scene', sceneBytes], ['model/hero', makeMockCharacterGlb()], ['model/kettle', fixture.bytes],
    ...['idle', 'walk', 'reach'].map(clipName => [`motion/${clipName}`, makeMockCharacterGlb({ clipName })]),
  ]);
  const loads = [];
  const manager = new AssetManager({ load: async descriptor => {
    loads.push(descriptor.key);
    return { handle: Uint8Array.from(bytes.get(descriptor.key)).buffer, width: 0, height: 0 };
  } });
  const index = parseAssetIndex({ version: 1, assets: REQUIRED_KEYS.map(id => ({
    id, type: id.startsWith('motion/') ? 'animation' : 'mesh', status: 'filled',
    description: `Synthetic CPU unit input ${id}`,
    path: `unit/${id.replaceAll('/', '-')}.glb`, source: 'explicit synthetic V1 CPU unit fixture',
    ...(id === 'scene' ? { spec: { scene: fixture.scene } } : id.startsWith('motion/') ? {
      spec: { skeleton: 'apollo-humanoid-v1', fps: 30, frames: 31, loop: id !== 'motion/reach' },
    } : {}),
  })) });
  registerAssetIndex(manager, index);
  await manager.loadAll();
  return { manager, loads, options: { sceneImports: manager.sceneImportCatalog(['scene']), assetKeys: new Set(REQUIRED_KEYS) } };
}

function checkWarnings(warnings) {
  expect(warnings).not.toHaveLength(0); // Preserve the existing renderer-only provider diagnostic.
  for (const warning of warnings) {
    const prefix = '这些组件无对应 provider capability（可能不被解释）：';
    expect(warning.startsWith(prefix), warning).toBe(true);
    for (const name of warning.slice(prefix.length).split(', ')) expect(RENDER_ONLY.has(name), warning).toBe(true);
  }
}

async function load(raw = manifest()) {
  const loaded = await assets();
  const before = JSON.stringify(raw);
  const parsed = parseManifestDetailed(raw, loaded.options);
  checkWarnings(parsed.warnings);
  expect(parsed.inferredCapabilities).toBe(false);
  expect(JSON.stringify(raw)).toBe(before);
  const engine = new Engine();
  engine.load(parsed.blueprint, loaded.options);
  expect(engine.world.strict).toBe('throw');
  return { engine, world: engine.world, parsed, ...loaded };
}

const flag = (world, id) => world.peek(`flag-${id}`, 'Flag').active;
const speed = world => {
  const velocity = world.peek('hero', 'Velocity');
  return Math.hypot(velocity.vx, velocity.vy);
};
const visible = world => [world.peek('floorKettle', 'Visibility').visible, world.peek('heldKettle', 'Visibility').visible];
const frame = world => ({
  position: structuredClone(world.peek('hero', 'Transform')), speed: speed(world),
  phase: world.peek('flow', 'GameFlow').current,
  reach: flag(world, 'reach'), carry: flag(world, 'carry'), held: flag(world, 'held'),
  visible: visible(world), face: structuredClone(world.peek('hero', 'FaceDir')),
});

describe('V1 canonical offline teapot composition (CPU only)', () => {
  it('uses nineteen explicit existing providers, six real-consumer keys and a SHA-verified actual authored scene', async () => {
    const raw = manifest(), loaded = await assets();
    expect(raw.capabilities).toEqual(EXPECTED_IDS);
    expect(new Set(raw.capabilities).size).toBe(19);
    expect(loaded.loads.sort()).toEqual([...REQUIRED_KEYS].sort());
    expect(loaded.options.sceneImports.scene.sourceSha256).toBe(hash(fixture.bytes));
    expect(new Set(fixture.scene.nodes.map(node => node.kind))).toEqual(new Set(['collision', 'navigation', 'pick', 'spawn']));
    const blueprint = parseManifest(JSON.parse(JSON.stringify(raw)), loaded.options);
    expect(blueprint.capabilities.map(capability => capability.id)).toEqual(EXPECTED_IDS);
    expect(blueprint.entities.courtyard.GroundSurface3D.triangles.length).toBeGreaterThan(0);
    expect(blueprint.entities.courtyard.NavigationProfile.gridId).toBe('courtyard');
    expect(blueprint.entities['courtyard/node-4'].Transform).toMatchObject({ x: -1, y: 1 });
    expect(blueprint.entities.hero.Model3D.modelKey).toBe('model/hero');
    expect(blueprint.entities.floorKettle.Model3D.modelKey).toBe('model/kettle');
    expect(blueprint.entities.heldKettle.Model3D.modelKey).toBe('model/kettle');
    await expect(assets({ corruptScene: true })).rejects.toThrow(/SHA256 mismatch/);
    expect(() => parseManifest(raw, { ...loaded.options, sceneImports: {} })).toThrow(/scene|verified|catalog/i);
  });

  it('walks by actual NavAgent, stops before reach Flag, and commits the contact handover after publication', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { world } = await load();
    const history = [], events = []; let tick = 0;
    const cancel = world.observeComponents(['Signal'], notice => {
      if (notice.kind === 'add') events.push({ tick, signal: notice.component.name, ...frame(world) });
    });
    for (tick = 1; tick <= 360; tick++) { world.tick(); history.push({ tick, ...frame(world) }); }
    cancel();
    const moved = history.find(value => value.speed > 0);
    expect(moved).toBeDefined();
    const stopped = history.find(value => value.tick > moved.tick && value.speed === 0);
    expect(stopped).toBeDefined();
    const reached = history.find(value => value.reach);
    expect(reached).toBeDefined();
    expect(moved.tick).toBe(61);
    expect(history.slice(0, 60).every(value => value.position.x === -1 && value.position.y === 1 && value.speed === 0)).toBe(true);
    expect(stopped.tick).toBe(134);
    expect(reached.tick).toBe(stopped.tick);
    expect(reached.speed).toBe(0);
    expect(events.map(value => [value.tick, value.signal])).toEqual([[134, 'v1.reach'], [195, 'v1.contact'], [226, 'v1.held']]);
    const contact = events.find(value => value.signal === 'v1.contact');
    expect(contact.visible).toEqual([true, false]); // EventWhen publication is before Commit effects.
    expect(history[contact.tick - 1].visible).toEqual([false, true]);
    expect(history[history.length - 1]).toMatchObject({ speed: 0, reach: false, carry: true, held: true, visible: [false, true] });
    expect(Math.hypot(reached.position.x + 1, reached.position.y + 1)).toBeLessThan(0.05);
    expect(world.peek('hero', 'GroundContact3D')).toMatchObject({ heightQ: 10, supported: true });
    expect(world.peek('hero', 'NavPath').reachable).toBe(true);
    expect(warn).not.toHaveBeenCalled();
  });

  it('keeps the navigation stand point independent from the authored kettle-facing point', async () => {
    const a = await load(), other = manifest();
    other.entities['kettle-grip'].Transform.x = -1.4;
    other.entities['kettle-grip'].Transform3D.x = -1.4;
    const b = await load(other);
    for (let tick = 0; tick < 360; tick++) {
      a.world.tick(); b.world.tick();
      expect(a.world.peek('hero', 'Transform')).toEqual(b.world.peek('hero', 'Transform'));
    }
    const face = a.world.peek('hero', 'FaceDir'), opposite = b.world.peek('hero', 'FaceDir');
    const position = a.world.peek('hero', 'Transform'), target = manifest().entities['kettle-grip'].Transform;
    const dx = target.x - position.x, dy = target.y - position.y, length = Math.hypot(dx, dy);
    expect(face.x).toBeCloseTo(dx / length, 12); expect(face.y).toBeCloseTo(dy / length, 12);
    expect(face.x * opposite.x + face.y * opposite.y).toBeLessThan(0);
    expect(a.world.peek('hero', 'NavAgent').patrol).toMatchObject({ waypoints: [{ x: -1, y: -1 }], loop: false });
  });

  it('projects actual speed and phase flags into the external graph without touching the world', async () => {
    const { world } = await load(), graph = world.peek('hero', 'AnimGraph3D');
    const samples = new Map();
    for (let tick = 1; tick <= 240; tick++) {
      world.tick();
      if ([1, 61, 134, 195, 226].includes(tick)) {
        const before = { seq: world.writeSequence, dirty: world.dirtyCount, snapshot: world.snapshot() };
        samples.set(tick, readAnimGraphParams(world.readView(), 'hero', graph));
        expect(world.writeSequence).toBe(before.seq); expect(world.dirtyCount).toBe(before.dirty);
        expect(world.snapshot()).toEqual(before.snapshot);
      }
    }
    expect(samples.get(1)).toEqual({ move: 0, reach: false, carry: false });
    expect(samples.get(61).move).toBeCloseTo(0.03, 12);
    expect(samples.get(134)).toEqual({ move: 0, reach: true, carry: false });
    expect(samples.get(195)).toEqual({ move: 0, reach: false, carry: true });
    expect(samples.get(226)).toEqual(samples.get(195));
    expect(graph.clips).toEqual({
      idle: { asset: 'motion/idle', clip: 'idle', loop: true },
      walk: { asset: 'motion/walk', clip: 'walk', loop: true },
      reach: { asset: 'motion/reach', clip: 'reach', loop: false },
    });
    expect(graph.states.locomotion.blend.points).toEqual([{ at: 0, clip: 'idle' }, { at: 0.03, clip: 'walk' }]);
    expect(graph.states.hold.clip).toBe('reach');
    expect(graph.transitions.some(row => row.from === 'locomotion' && row.to === 'hold' && row.whenParam === 'carry')).toBe(true);
    const model = new THREE.Group(), bone = new THREE.Bone(); bone.name = 'RightHand'; model.add(bone);
    const clips = new Map(['idle', 'walk', 'reach'].map((alias, value) => [alias, {
      clip: new THREE.AnimationClip(alias, 1, [new THREE.NumberKeyframeTrack('RightHand.position[x]', [0, 1], [value, value])]),
      loop: alias !== 'reach',
    }]));
    const controller = new AnimationGraphController(model, graph, clips);
    controller.update(0, samples.get(1)); expect(bone.position.x).toBe(0);
    controller.update(0.2, samples.get(61)); expect(bone.position.x).toBeCloseTo(1, 12);
    controller.update(0.2, samples.get(134)); expect(bone.position.x).toBeCloseTo(2, 12);
    controller.update(1, samples.get(195)); expect(bone.position.x).toBeCloseTo(2, 12);
    controller.dispose();
    const late = new AnimationGraphController(model, graph, clips);
    late.update(0.2, samples.get(195));
    expect(bone.position.x).toBeCloseTo(2, 12); // A late first render can observe carry without the earlier reach pulse.
    late.dispose();
  });

  it('keeps grip targets independent, raised and live through the complementary IK fades', async () => {
    const { world } = await load(), raw = manifest(), config = raw.entities.hero.IK3D;
    expect(config.chains.map(chain => [chain.root, chain.mid, chain.end])).toEqual(Array.from({ length: 2 }, () => ['RightUpperArm', 'RightLowerArm', 'RightHand']));
    expect(config.chains.map(chain => [chain.target.entity, chain.weight.param, chain.weight.fade])).toEqual([
      ['kettle-grip', 'reach', 0.4], ['carry-grip', 'carry', 0.4],
    ]);
    const low = raw.entities['kettle-grip'], high = raw.entities['carry-grip'];
    for (const target of [low, high]) {
      expect(target.Attach3D).toBeUndefined(); expect(target.Visibility).toBeUndefined();
      expect(target.Transform.x).toBe(target.Transform3D.x); expect(target.Transform.y).toBe(target.Transform3D.z);
    }
    expect(high.Transform3D.x).toBe(low.Transform3D.x); expect(high.Transform3D.z).toBe(low.Transform3D.z);
    expect(high.Transform3D.y - low.Transform3D.y).toBeCloseTo(0.25, 12);
    expect(raw.entities.heldKettle.Attach3D).toMatchObject({ parentId: 'hero', bone: 'RightHand' });
    expect(raw.entities.heldKettle.Visibility.visible).toBe(false);

    // Native Bone adapter with the authored T5 fixture's .28m/.24m arm lengths.
    // This proves data reachability/ordering; it is not the real GLB, skin or GPU.
    for (let tick = 0; tick < 134; tick++) world.tick();
    const actor = new THREE.Group(), upper = new THREE.Bone(), middle = new THREE.Bone(), hand = new THREE.Bone();
    upper.name = 'RightUpperArm'; middle.name = 'RightLowerArm'; hand.name = 'RightHand';
    upper.position.set(-0.18, 1.43, 0); middle.position.set(-0.28, 0, 0); hand.position.set(-0.24, 0, 0);
    actor.add(upper); upper.add(middle); middle.add(hand);
    const position = world.peek('hero', 'Transform'); actor.position.set(position.x, 0.001, position.y);
    actor.rotation.y = modelYawFromFaceDir(world.peek('hero', 'FaceDir'), 0); actor.updateWorldMatrix(true, true);
    const ik = new InverseKinematics(), params = () => readAnimGraphParams(world.readView(), 'hero', world.peek('hero', 'AnimGraph3D'));
    const context = { refreshAttachments() {}, resolveTarget(target) {
      const point = world.peek(target.entity, 'Transform3D');
      return point ? { position: new THREE.Vector3(point.x, point.y, point.z), dependencies: [] } : undefined;
    } };
    const solve = dt => { ik.beginFrame(); ik.sync([{ id: 'hero', config, model: actor, params: params() }], context, dt); return hand.getWorldPosition(new THREE.Vector3()); };
    solve(0);
    for (let frame = 0; frame < 30; frame++) solve(1 / 60);
    const contactPoint = solve(0), expectedLow = new THREE.Vector3(low.Transform3D.x, low.Transform3D.y, low.Transform3D.z);
    expect(contactPoint.distanceTo(expectedLow)).toBeLessThan(0.01);
    for (let tick = 134; tick < 195; tick++) world.tick();
    const boundary = solve(0);
    expect(boundary.distanceTo(contactPoint)).toBeLessThan(1e-8);
    for (let frame = 0; frame < 30; frame++) solve(1 / 60);
    const carried = solve(0), expectedHigh = new THREE.Vector3(high.Transform3D.x, high.Transform3D.y, high.Transform3D.z);
    expect(carried.distanceTo(expectedHigh)).toBeLessThan(0.01);
    expect(carried.y - contactPoint.y).toBeGreaterThan(0.24);
    expect(world.hasComponent('kettle-grip', 'Transform3D')).toBe(true);
    expect(world.hasComponent('carry-grip', 'Transform3D')).toBe(true);
    ik.clear();
  });

  it('has closed signal camera shots with usable explicit lens and no auto-play rule', async () => {
    const { world } = await load(), raw = manifest(), camera = getCamera3D(world.readView());
    expect(camera).toBeDefined();
    expect(raw.entities.cam.Camera3D.near).toBeGreaterThan(0);
    expect(raw.entities.cam.Camera3D.far).toBeGreaterThan(raw.entities.cam.Camera3D.near);
    expect(raw.entities.cam.CameraShot3D.onSignal).toEqual([
      { signal: 'v1.reach', shot: 'reach' }, { signal: 'v1.contact', shot: 'contact' }, { signal: 'v1.held', shot: 'held' },
    ]);
    for (const shot of Object.values(raw.entities.cam.CameraShot3D.shots)) {
      expect(shot.keyframes[0].at).toBe(0);
      expect(shot.keyframes.at(-1).at).toBeLessThanOrEqual(600);
      expect(shot.keyframes.every(key => key.eye.some((v, axis) => v !== key.target[axis]))).toBe(true);
    }
    expect(world.queryEntities('Signal')).toEqual([]);
  });

  it('places the actual authored teapot handle vertex at the independent grip above the separate bench', () => {
    const raw = manifest(), kettle = createV1KettleFixture(), { json, binary } = unpack(kettle.bytes);
    const handle = kettle.metadata.handleVertex;
    const primitive = json.meshes[json.nodes[handle.node].mesh].primitives[handle.primitive];
    const accessor = json.accessors[primitive.attributes.POSITION], view = json.bufferViews[accessor.bufferView];
    const offset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0) + handle.vertex * 12;
    const point = new THREE.Vector3(...[0, 1, 2].map(axis => binary.readFloatLE(offset + axis * 4)));
    const transform = raw.entities.floorKettle.Transform3D, modelScale = raw.entities.floorKettle.Model3D.scale ?? 1;
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(transform.x, transform.y, transform.z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(transform.rotX ?? 0, transform.rotY ?? 0, transform.rotZ ?? 0)),
      new THREE.Vector3((transform.scaleX ?? transform.scale ?? 1) * modelScale,
        (transform.scaleY ?? transform.scale ?? 1) * modelScale, (transform.scaleZ ?? transform.scale ?? 1) * modelScale));
    point.applyMatrix4(matrix);
    const grip = raw.entities['kettle-grip'].Transform3D;
    expect(point.distanceTo(new THREE.Vector3(grip.x, grip.y, grip.z))).toBeLessThan(0.01);
    const bench = raw.entities['bench-top'];
    expect(Math.abs(bench.Transform3D.y + bench.Mesh3D.height / 2 - transform.y)).toBeLessThan(0.01);
    expect(kettle.metadata.height).toBeCloseTo(0.35, 5);
  });

  it('keeps long dual-world snapshots, full/incremental hashes, delta, write sequences and dirty order identical with extra render reads', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const plain = await load(), projected = await load();
    const a = plain.world, b = projected.world, ah = new WorldHasher(a), bh = new WorldHasher(b);
    const view = b.readView(), seen = [];
    const cancel = b.observeComponents(['Signal'], notice => { if (notice.kind === 'add') seen.push(notice.component.name); });
    let base = 0;
    for (let tick = 0; tick < 2_000; tick++) {
      a.tick(); b.tick();
      for (let frame = 0; frame < (tick % 4 === 0 ? 2 : 0); frame++) {
        readAnimGraphParams(view, 'hero', view.getComponent('hero', 'AnimGraph3D'));
        collectRenderables(view); getCamera3D(view);
      }
      const tag = `tick ${tick}`;
      const incremental = ah.hash();
      expect(bh.hash(), tag).toBe(incremental);
      expect(bh.stats.recomputed, tag).toBe(ah.stats.recomputed);
      expect(b.writeSequence, tag).toBe(a.writeSequence);
      expect(b.drainDirty(), tag).toEqual(a.drainDirty());
      // Full snapshots/deltas at every twenty-fifth tick plus all handover boundaries;
      // incremental hash, write sequence and dirty order are checked every tick.
      if (tick % 25 === 0 || [60, 132, 133, 134, 193, 194, 195, 224, 225, 226, 1999].includes(tick)) {
        const snapshot = a.snapshot(), full = hashSnapshot(snapshot);
        expect(b.snapshot(), tag).toEqual(snapshot);
        expect(hashSnapshot(b.snapshot()), tag).toBe(full);
        expect(incremental, tag).toBe(full);
        expect(b.snapshotDelta(base), tag).toEqual(a.snapshotDelta(base));
        expect(b.snapshotOrder(), tag).toEqual(a.snapshotOrder());
        base = a.writeSequence;
      }
    }
    cancel();
    expect(seen).toEqual(['v1.reach', 'v1.contact', 'v1.held']);
    expect(warn).not.toHaveBeenCalled();
  });
});
