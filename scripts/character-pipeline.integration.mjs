#!/usr/bin/env node
// Offline test evidence only. Generic Blender fixtures cannot certify ARP/Mixamo/Tripo.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { assertBlenderLaunchAllowed } from './lib/blender-runtime.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLIPS = ['idle', 'walk', 'reach'];
const BONES = ['Hips', 'Spine', 'Chest', 'Neck', 'Head',
  'LeftUpperArm', 'LeftLowerArm', 'LeftHand', 'RightUpperArm', 'RightLowerArm', 'RightHand',
  'LeftUpperLeg', 'LeftLowerLeg', 'LeftFoot', 'RightUpperLeg', 'RightLowerLeg', 'RightFoot'];
const DEFAULT_BLENDER = '/private/tmp/apollo-tools/blender-4.5.14/Blender.app/Contents/MacOS/Blender';
const sha = (value) => createHash('sha256').update(value).digest('hex');
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));

function options() {
  const result = { mock: false };
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === '--mock') result.mock = true;
    else if (arg === '--out-dir' && process.argv[i + 1]) result.out = resolve(process.argv[++i]);
    else throw new Error(`Unknown or incomplete argument: ${arg}`);
  }
  return result;
}

async function runBlender(binary, out) {
  assertBlenderLaunchAllowed(binary);
  await mkdir(out, { recursive: true });
  await new Promise((accept, reject) => {
    const child = spawn(binary, ['--background', '--factory-startup', '--python-exit-code', '1', '--python',
      join(HERE, 'fixtures/character-pipeline/blender-character.py'), '--', '--out-dir', out],
    { stdio: ['ignore', 'pipe', 'pipe'] });
    // stdout is reserved for the runner's single machine-readable JSON result.
    child.stdout.on('data', (chunk) => process.stderr.write(chunk));
    child.stderr.on('data', (chunk) => process.stderr.write(chunk));
    child.on('error', reject);
    child.on('close', (code, signal) => code === 0 ? accept() :
      reject(new Error(`Blender failed: exit=${code}, signal=${signal ?? 'none'}`)));
  });
}

function verifySampling(bytes, clip) {
  const data = Buffer.from(bytes);
  assert.equal(data.toString('ascii', 0, 4), 'glTF');
  assert.equal(data.readUInt32LE(4), 2);
  assert.equal(data.readUInt32LE(8), data.length);
  const jsonLength = data.readUInt32LE(12);
  const gltf = JSON.parse(data.toString('utf8', 20, 20 + jsonLength));
  const binOffset = 20 + jsonLength + 8;
  assert.equal(gltf.animations?.length, 1, `${clip}: exactly one clip`);
  assert.equal(gltf.animations[0].name, clip);
  assert.ok(!gltf.images?.length && !gltf.textures?.length, 'Fixture needs no image/DOM polyfills');
  for (const sampler of gltf.animations[0].samplers) {
    const accessor = gltf.accessors[sampler.input];
    const view = gltf.bufferViews[accessor.bufferView];
    assert.equal(accessor.componentType, 5126);
    assert.equal(accessor.type, 'SCALAR');
    assert.equal(accessor.count, 31, `${clip}: sampled endpoints included`);
    for (let i = 0; i < 31; i++) {
      const time = data.readFloatLE(binOffset + (view.byteOffset ?? 0) +
        (accessor.byteOffset ?? 0) + i * (view.byteStride ?? 4));
      assert.ok(Math.abs(time - i / 30) < 1e-6, `${clip}: frame ${i} must be at ${i / 30}s`);
    }
  }
  return gltf;
}

async function play(bytes, clipName) {
  const THREE = await import('three');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const source = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const gltf = await new Promise((accept, reject) => new GLTFLoader().parse(source, '', accept, reject));
  assert.equal(gltf.animations.length, 1);
  const clip = gltf.animations[0];
  assert.equal(clip.name, clipName);
  assert.ok(Math.abs(clip.duration - 1) < 1e-6);
  const bones = [], meshes = [];
  gltf.scene.traverse((node) => {
    if (node.isBone) bones.push(node);
    if (node.isSkinnedMesh) meshes.push(node);
  });
  assert.deepEqual(bones.map((bone) => bone.name).sort(), [...BONES].sort());
  assert.ok(meshes.length, `${clipName}: a real SkinnedMesh must load`);
  const mixer = new THREE.AnimationMixer(gltf.scene);
  const action = mixer.clipAction(clip);
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  const snapshots = [];
  for (const time of [0, .25, .5, .75, 1]) {
    mixer.setTime(time);
    gltf.scene.updateMatrixWorld(true);
    for (const mesh of meshes) mesh.skeleton.update();
    snapshots.push({ time,
      joints: bones.map((bone) => ({ name: bone.name,
        position: bone.getWorldPosition(new THREE.Vector3()).toArray(),
        rotation: bone.getWorldQuaternion(new THREE.Quaternion()).toArray() })),
      vertices: meshes.flatMap((mesh) => Array.from({ length: mesh.geometry.attributes.position.count }, (_, i) =>
        mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld).toArray())),
    });
  }
  let jointPositionDelta = 0, jointRotationDelta = 0, skinnedVertexDelta = 0;
  const perJointDeltas = bones.map((bone) => ({ name: bone.name, position: 0, rotationRadians: 0 }));
  const first = snapshots[0];
  for (const snapshot of snapshots.slice(1)) {
    for (let i = 0; i < first.joints.length; i++) {
      const positionDelta = distance(first.joints[i].position, snapshot.joints[i].position);
      jointPositionDelta = Math.max(jointPositionDelta, positionDelta);
      perJointDeltas[i].position = Math.max(perJointDeltas[i].position, positionDelta);
      const a = new THREE.Quaternion().fromArray(first.joints[i].rotation);
      const b = new THREE.Quaternion().fromArray(snapshot.joints[i].rotation);
      const rotationDelta = a.angleTo(b);
      jointRotationDelta = Math.max(jointRotationDelta, rotationDelta);
      perJointDeltas[i].rotationRadians = Math.max(perJointDeltas[i].rotationRadians, rotationDelta);
    }
    for (let i = 0; i < first.vertices.length; i++) {
      skinnedVertexDelta = Math.max(skinnedVertexDelta, distance(first.vertices[i], snapshot.vertices[i]));
    }
  }
  assert.ok(jointPositionDelta > .001 || jointRotationDelta > .01, `${clipName}: joints must actually animate`);
  assert.ok(skinnedVertexDelta > .001, `${clipName}: weighted vertices must actually move`);
  const semantic = {
    clipName: clip.name, duration: clip.duration,
    bones: bones.map((b) => ({ name: b.name, parent: b.parent?.name })),
    skins: meshes.map((m) => ({
      positions: Array.from(m.geometry.attributes.position.array),
      joints: Array.from(m.geometry.attributes.skinIndex.array),
      weights: Array.from(m.geometry.attributes.skinWeight.array),
      inverseBinds: m.skeleton.boneInverses.map((matrix) => matrix.toArray()),
    })),
    tracks: clip.tracks.map((track) => ({ name: track.name, times: Array.from(track.times), values: Array.from(track.values) })),
    snapshots,
  };
  const result = { duration: clip.duration, sampleTimes: snapshots.map((s) => s.time),
    jointPositionDelta, jointRotationDeltaRadians: jointRotationDelta, skinnedVertexDelta,
    semanticSha256: sha(JSON.stringify(semantic)), poseSha256: sha(JSON.stringify(snapshots)),
    vertexCount: first.vertices.length, jointCount: bones.length, perJointDeltas, snapshots };
  mixer.stopAllAction();
  mixer.uncacheRoot(gltf.scene);
  for (const mesh of meshes) {
    mesh.geometry.dispose();
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose();
  }
  return result;
}

async function main() {
  let out;
  let report = { schemaVersion: 1, source: 'generic-blender-fixture', realValidation: false,
    realArpValidated: false, realMixamoValidated: false, realTripoValidated: false };
  try {
    const args = options();
    out = args.out ?? await mkdtemp(join(tmpdir(), 'apollo-character-pipeline-'));
    await mkdir(out, { recursive: true });
    report = { ...report, source: args.mock ? 'mock-character-fixture' : 'generic-blender-fixture',
      outputDirectory: out, mode: args.mock ? 'mock' : 'blender',
      validationScope: 'Offline format, skin, same skeleton, actual playback, and reproducibility only' };
    const blender = process.env.BLENDER_BIN || DEFAULT_BLENDER;
    if (!args.mock && !existsSync(blender)) {
      report.status = 'skipped';
      report.reason = `Blender executable is missing: ${blender}`;
      return;
    }
    const dirs = [join(out, 'run-1'), join(out, 'run-2')];
    for (const dir of dirs) {
      if (args.mock) {
        await mkdir(dir, { recursive: true });
        const { makeMockCharacterGlb } = await import('./fixtures/character-pipeline/mock-character.mjs');
        for (const clipName of CLIPS) {
          const made = makeMockCharacterGlb({ clipName, fps: 30, frames: 31 });
          await writeFile(join(dir, `${clipName}.glb`), made.bytes ?? made.glb ?? made);
        }
      } else await runBlender(blender, dir);
    }
    const { inspectCharacterGlb } = await import('./lib/character-glb.mjs');
    report.runs = [];
    let expectedSkeleton;
    for (const dir of dirs) {
      const run = { directory: dir, clips: [] };
      for (const clipName of CLIPS) {
        const file = join(dir, `${clipName}.glb`);
        const bytes = await readFile(file);
        verifySampling(bytes, clipName);
        const inspection = inspectCharacterGlb(bytes, { clipName, fps: 30, frames: 31,
          requireSkin: true, requireHumanoid: true });
        assert.equal(inspection.animations.length, 1);
        assert.equal(inspection.animations[0].name, clipName);
        assert.ok(inspection.skeletonHash, 'Validator must return a skeleton hash');
        expectedSkeleton ??= inspection.skeletonHash;
        assert.equal(inspection.skeletonHash, expectedSkeleton, `${clipName}: common bind/rest skeleton`);
        const playback = await play(bytes, clipName);
        run.clips.push({ clipName, file, byteLength: bytes.length, sha256: sha(bytes),
          skeletonHash: inspection.skeletonHash, bounds: inspection.bounds, playback });
      }
      run.distinctPlayedPoseCount = new Set(run.clips.map((clip) => clip.playback.poseSha256)).size;
      if (!args.mock) assert.equal(run.distinctPlayedPoseCount, 3,
        'idle, walk, and reach must contain distinct played poses');
      report.runs.push(run);
    }
    report.reproducibility = CLIPS.map((clipName, i) => {
      const a = report.runs[0].clips[i], b = report.runs[1].clips[i];
      const byteIdentical = a.sha256 === b.sha256;
      const semanticIdentical = a.playback.semanticSha256 === b.playback.semanticSha256;
      let maxJointPositionDifference = 0, maxVertexPositionDifference = 0;
      for (let s = 0; s < a.playback.snapshots.length; s++) {
        const left = a.playback.snapshots[s], right = b.playback.snapshots[s];
        for (let j = 0; j < left.joints.length; j++) maxJointPositionDifference = Math.max(
          maxJointPositionDifference, distance(left.joints[j].position, right.joints[j].position));
        for (let v = 0; v < left.vertices.length; v++) maxVertexPositionDifference = Math.max(
          maxVertexPositionDifference, distance(left.vertices[v], right.vertices[v]));
      }
      assert.ok(byteIdentical || semanticIdentical, `${clipName}: repeated exports changed semantics`);
      return { clipName, byteIdentical, semanticIdentical, poseIdentical: a.playback.poseSha256 === b.playback.poseSha256,
        maxJointPositionDifference, maxVertexPositionDifference,
        sha256: [a.sha256, b.sha256], semanticSha256: [a.playback.semanticSha256, b.playback.semanticSha256] };
    });
    if (!args.mock) {
      report.fixture = JSON.parse(await readFile(join(dirs[0], 'fixture-source.json'), 'utf8'));
      assert.match(report.fixture.blenderVersion, /^4\.5\./, 'The real fixture requires Blender 4.5');
    }
    report.status = 'validated';
    report.realValidation = !args.mock;
    report.skeletonHash = expectedSkeleton;
  } catch (error) {
    report.status = 'failed';
    report.realValidation = false;
    report.error = error.stack ?? String(error);
    process.stderr.write(`${report.error}\n`);
    process.exitCode = 1;
  } finally {
    if (out) {
      report.reportPath = join(out, 'report.json');
      await writeFile(report.reportPath, JSON.stringify(report, null, 2) + '\n');
    }
    process.stdout.write(JSON.stringify(report) + '\n');
  }
}

await main();
