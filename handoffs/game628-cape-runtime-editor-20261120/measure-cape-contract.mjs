import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { AnimationMixer, Group, LoadingManager, Quaternion, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

globalThis.ProgressEvent ??= class {};
const contract = JSON.parse(await readFile(new URL('./cape-contract.json', import.meta.url), 'utf8'));
const runtimeContract = JSON.parse(await readFile(new URL(contract.runtimeContract, import.meta.url), 'utf8'));
const directory = new URL('./public/art/face-studio-20261120/', import.meta.url);
const shared = await readFile(new URL('shared-body.bin', directory));
const sharedUri = '/art/face-studio-20261120/shared-body.bin';
const sharedData = 'data:application/octet-stream;base64,' + shared.toString('base64');
const loader = new GLTFLoader(new LoadingManager().setURLModifier(uri => uri === sharedUri ? sharedData : uri));
const hash = data => createHash('sha256').update(data).digest('hex');
const rest = new Vector3();
const worldOffset = (bone, meters) => new Vector3().fromArray(meters)
  .applyQuaternion(bone.getWorldQuaternion(new Quaternion()).normalize());
const worldPoint = (bone, meters) => bone.getWorldPosition(new Vector3()).add(worldOffset(bone, meters));
const sampleRate = 60;
const bodies = [];

for (const bodyId of contract.avatar.bodyByIndex) {
  const path = `body-${bodyId}.gltf`;
  const json = await readFile(new URL(path, directory), 'utf8');
  const asset = await loader.parseAsync(json, '');
  const root = new Group();
  root.add(asset.scene);
  const mixer = new AnimationMixer(asset.scene);
  const bones = [runtimeContract.attachment.left, runtimeContract.attachment.right].map(spec => ({
    spec, node: asset.scene.getObjectByName(spec.node),
  }));
  for (const { spec, node } of bones) assert.ok(node, spec.node);
  const report = { bodyId, modelSha256: hash(json), clips: {} };

  for (const clipName of ['idle', 'walk', 'wave']) {
    const clip = asset.animations.find(clip => clip.name === clipName);
    assert.ok(clip);
    mixer.stopAllAction();
    const action = mixer.clipAction(clip).reset().play();
    const frames = Math.ceil(clip.duration * sampleRate) + 1;
    const result = { samples: frames, minShoulderSpanM: Infinity, maxShoulderSpanM: 0,
      maxRootInvarianceErrorM: 0, maxWorldRoundTripErrorM: 0, maxMeterOffsetErrorM: 0 };
    for (let frame = 0; frame < frames; frame++) {
      const time = Math.min(Math.max(0, clip.duration - 1e-6), frame / sampleRate);
      action.time = time;
      mixer.update(0);

      root.position.copy(rest);
      root.rotation.y = 0;
      root.updateMatrixWorld(true);
      const baseline = bones.map(({ spec, node }) => root.worldToLocal(worldPoint(node, spec.offsetM)));
      const span = baseline[0].distanceTo(baseline[1]);
      result.minShoulderSpanM = Math.min(result.minShoulderSpanM, span);
      result.maxShoulderSpanM = Math.max(result.maxShoulderSpanM, span);

      root.position.set(.43 + frame / sampleRate * .035, .14, -.72);
      root.rotation.y = Math.min(1.9, frame / sampleRate);
      root.updateMatrixWorld(true);
      for (const [index, { spec, node }] of bones.entries()) {
        const rendered = worldPoint(node, spec.offsetM);
        const local = root.worldToLocal(rendered.clone());
        result.maxRootInvarianceErrorM = Math.max(result.maxRootInvarianceErrorM, local.distanceTo(baseline[index]));
        result.maxWorldRoundTripErrorM = Math.max(result.maxWorldRoundTripErrorM, root.localToWorld(local).distanceTo(rendered));
        const offset = [.021, -.013, .034];
        const measured = worldPoint(node, offset).distanceTo(node.getWorldPosition(new Vector3()));
        result.maxMeterOffsetErrorM = Math.max(result.maxMeterOffsetErrorM, Math.abs(measured - Math.hypot(...offset)));
      }
    }
    assert.ok(result.minShoulderSpanM > .25);
    for (const error of [result.maxRootInvarianceErrorM, result.maxWorldRoundTripErrorM, result.maxMeterOffsetErrorM]) {
      assert.ok(error < 1e-7, JSON.stringify(result));
    }
    report.clips[clipName] = result;
  }
  bodies.push(report);
}
const result = { mode: 'offline animated bone and coordinate validation', sampleRate, sharedBinSha256: hash(shared), bodies };
await writeFile(new URL('./evidence/shoulder-space.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.info('[cape-contract:verified]', bodies.map(({ bodyId, clips }) => ({ bodyId,
  samples: Object.values(clips).reduce((count, clip) => count + clip.samples, 0),
})));
