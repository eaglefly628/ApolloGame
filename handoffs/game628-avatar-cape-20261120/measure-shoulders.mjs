import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { AnimationMixer, Box3, LoadingManager, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const avatarRoot = path.resolve(root, '../game628-avatar-edit-20261120/public');
globalThis.ProgressEvent ??= class ProgressEvent {};
const result = { status: 'measured-candidate-awaiting-editor-contract', units: 'meters', axes: 'Y-up, character forward +Z', bodies: [] };
for (const bodyId of ['slim', 'regular', 'full']) {
  const relative = `/art/face-studio-20261120/body-${bodyId}.gltf`;
  const bytes = await fs.readFile(avatarRoot + relative);
  const source = JSON.parse(bytes);
  const binBytes = await fs.readFile(avatarRoot + source.buffers[0].uri);
  const bin = `data:application/octet-stream;base64,${binBytes.toString('base64')}`;
  const loader = new GLTFLoader(new LoadingManager().setURLModifier(url => url === source.buffers[0].uri ? bin : url));
  const asset = await loader.parseAsync(bytes.toString(), '');
  const mixer = new AnimationMixer(asset.scene);
  const samples = [];
  for (const clipName of ['idle', 'walk', 'wave']) {
    const clip = asset.animations.find(clip => clip.name === clipName);
    if (!clip) throw new Error(`Missing clip ${clipName}`);
    mixer.stopAllAction();
    mixer.clipAction(clip).reset().play();
    for (const time of [0, 0.25, 0.5, 0.75, 1]) {
      mixer.setTime(time);
      asset.scene.updateMatrixWorld(true);
      const points = {};
      for (const name of ['LeftUpperArm', 'RightUpperArm', 'Spine1']) {
        const node = asset.scene.getObjectByName(name);
        if (!node) throw new Error(`Missing attachment candidate ${name}`);
        points[name] = node.getWorldPosition(new Vector3()).toArray();
      }
      samples.push({ clip: clipName, time, points });
    }
  }
  const torso = asset.scene.getObjectByName('shirt-body');
  const bounds = new Box3().setFromObject(torso);
  const idleZero = samples[0].points;
  const shoulderMovementFromIdleZeroM = Object.fromEntries(['idle', 'walk', 'wave'].map(clip => {
    let peak = 0;
    for (const sample of samples.filter(sample => sample.clip === clip)) {
      for (const name of ['LeftUpperArm', 'RightUpperArm']) {
        peak = Math.max(peak, new Vector3().fromArray(sample.points[name]).distanceTo(new Vector3().fromArray(idleZero[name])));
      }
    }
    return [clip, peak];
  }));
  result.bodies.push({ bodyId, source: relative, shoulderMovementFromIdleZeroM,
    modelSha256: createHash('sha256').update(bytes).digest('hex'),
    binSha256: createHash('sha256').update(binBytes).digest('hex'),
    bindPoseIsAnimated: true,
    torsoBoundsAtLastSample: { min: bounds.min.toArray(), max: bounds.max.toArray() }, samples });
}
await fs.writeFile(path.join(root, 'evidence/shoulder-candidates.json'), JSON.stringify(result, null, 2));
console.log(result.bodies.map(body => ({ body: body.bodyId, first: body.samples[0].points })));
