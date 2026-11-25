import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { AnimationMixer, Box3, LoopOnce, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { deriveSeed, seededShuffle } from '../../src/skills/atoms/random/index.js';

const root = new URL('./', import.meta.url);
const baseline = new URL('../game628-cat-turn-20261121/site/', root);
const checkpoint = process.env.APOLLO_WALK_CHECKPOINT ?? resolve(homedir(),
  'ApolloAssets/motion-review/m35-checkpoint-20261102-d2c/m35-d2c-walk-alternative/trial-independent-root');
const yBot = '4f5d21e1-4ccc-41f1-b35b-fb2547bd8493';
const seed = 628211;
const rate = 60;
const library = process.env.APOLLO_MOTION_LIBRARY ?? resolve(homedir(), 'ApolloAssets/motion-lib-full-frames');
const conversationId = 'talking-110090902';
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const json = async (path: URL | string) => JSON.parse(await readFile(path, 'utf8'));
const load = (bytes: Buffer) => new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, '');
const unpack = (bytes: Buffer) => {
  const length = bytes.readUInt32LE(12);
  return { doc: JSON.parse(bytes.toString('utf8', 20, 20 + length)), bin: bytes.subarray(28 + length) };
};

function appendClip(base: Buffer, clip: string, times: number[], tracks: Map<string, number[]>) {
  const { doc, bin } = unpack(base);
  const chunks = [bin];
  let offset = bin.length;
  const append = (values: number[], type: string, size: number) => {
    const data = Buffer.from(new Float32Array(values).buffer);
    const bufferView = doc.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: data.length }) - 1;
    chunks.push(data);
    offset += data.length;
    const bounds = size === 1 ? { min: [values[0]], max: [values.at(-1)] } : {};
    return doc.accessors.push({ bufferView, componentType: 5126, count: values.length / size, type, ...bounds }) - 1;
  };
  const input = append(times, 'SCALAR', 1);
  const animation = { name: clip, channels: [] as object[], samplers: [] as object[] };
  for (const [key, values] of tracks) {
    const [name, property] = key.split('.');
    const node = doc.nodes.findIndex((entry: {name: string}) => entry.name === name);
    if (node < 0) throw new Error('Missing target node ' + name);
    const rotation = property === 'quaternion';
    animation.channels.push({ sampler: animation.samplers.length, target: { node, path: rotation ? 'rotation' : 'translation' } });
    animation.samplers.push({ input, output: append(values, rotation ? 'VEC4' : 'VEC3', rotation ? 4 : 3) });
  }
  doc.animations.push(animation);
  doc.buffers[0].byteLength = offset;
  const body = Buffer.from(JSON.stringify(doc));
  const padded = Math.ceil(body.length / 4) * 4;
  const header = Buffer.alloc(28 + padded, 32);
  for (const [i, value] of [[0, 0x46546c67], [4, 2], [8, header.length + offset], [12, padded],
    [16, 0x4e4f534a], [20 + padded, offset], [24 + padded, 0x004e4942]]) header.writeUInt32LE(value, i);
  body.copy(header, 20);
  return Buffer.concat([header, ...chunks]);
}

function playback(gltf: Awaited<ReturnType<typeof load>>, clip: string) {
  const take = gltf.animations.find(animation => animation.name === clip);
  if (!take) throw new Error('Missing clip ' + clip);
  const mixer = new AnimationMixer(gltf.scene);
  const action = mixer.clipAction(take).setLoop(LoopOnce, 0);
  action.clampWhenFinished = true;
  action.play();
  return {
    take,
    seek(time: number) {
      action.reset().play();
      mixer.setTime(time);
      gltf.scene.updateMatrixWorld(true);
    },
  };
}

function shoes(gltf: Awaited<ReturnType<typeof load>>) {
  return ['Left-sole', 'Right-sole'].map(name => {
    const mesh = gltf.scene.getObjectByName(name);
    if (!mesh) throw new Error('Missing ' + name);
    return mesh;
  });
}

const gaitList = [
  { name: 'walk-easy', sourceId: 'walking-100460901' },
  { name: 'walk-swing', sourceId: 'walking-117840901' },
  { name: 'walk-neighborhood', sourceId: null },
  { name: 'walk-easy', sourceId: 'walking-100460901' },
];
const assignments = seededShuffle(gaitList, deriveSeed(seed, 'resident-gait'));
const catalog = await json(resolve(library, 'catalog.json'));
const discussionSource = catalog.clips.find((clip: {id: string}) => clip.id === conversationId);
if (!discussionSource) throw new Error('Conversation source missing in motion catalog');
const discussionBytes = await readFile(resolve(library, discussionSource.file));
if (sha(discussionBytes) !== discussionSource.sha256) throw new Error('Conversation source hash mismatch');
const discussion = await load(discussionBytes);
const talk = playback(discussion, discussion.animations[0].name);
const talkBones = /^(Spine|Neck|Head|(?:Left|Right)(?:Shoulder|Arm|ForeArm|Hand))/;
const talkTracks = new Set(talk.take.tracks.filter(track => track.name.endsWith('.quaternion')).map(track => track.name));

const street = await json(new URL('scenes/crowd-street.json', baseline));
const identities = street.crowdPrototype.identities;
const ids: string[] = street.crowdPrototype.residentIds;
if (ids.length !== assignments.length) throw new Error('Expected four residents in this fixture');
await mkdir(new URL('site/art/pedestrian-life/', root), { recursive: true });
await mkdir(new URL('site/scenes/', root), { recursive: true });
const report = [];
for (const [index, entity] of ids.entries()) {
  const identity = identities[index];
  const { name, sourceId } = assignments[index];
  const phase = [0, 0.21, 0.46, 0.73][index];
  const base = await readFile(new URL(identity.src.slice(1), baseline));
  const target = await load(base);
  const targetShoes = shoes(target);
  const e4Stem = sourceId && resolve(checkpoint, sourceId + '--' + yBot);
  const input = e4Stem ? await readFile(e4Stem + '.glb') : base;
  const proof = e4Stem ? await json(e4Stem + '.json') : undefined;
  if (proof && (proof.output.sha256 !== sha(input) || proof.failures.length)) throw new Error('E4 checkpoint mismatch');
  const source = e4Stem ? await load(input) : await load(base);
  const sample = playback(source, e4Stem ? source.animations[0].name : 'walk');
  const duration = sample.take.duration;
  const rawTracks = sample.take.tracks.filter(track => track.name.endsWith('.quaternion') || track.name.endsWith('.position'));
  const tracks = new Map(rawTracks.map(track => [track.name, [] as number[]]));
  const hip = target.scene.getObjectByName('Hips')!;
  const sourceHip = source.scene.getObjectByName('Hips')!;
  const scale = hip.parent!.getWorldScale(new Vector3()).length() / sourceHip.parent!.getWorldScale(new Vector3()).length();
  const stride = proof ? proof.strideM * scale :
    street.characters.find((recipe: {entity:string}) => recipe.entity === entity).nominalSpeedPerTick * rate * duration;
  for (const track of rawTracks) {
    const [bone] = track.name.split('.');
    const from = source.scene.getObjectByName(bone)!;
    const to = target.scene.getObjectByName(bone)!;
    if (!to || from.parent?.name !== to.parent?.name || (bone !== 'Hips' && from.position.distanceTo(to.position) > 0.005)) {
      throw new Error('Incompatible local bone ' + bone);
    }
  }
  const count = Math.ceil(duration * 120);
  const times = Array.from({ length: count + 1 }, (_, frame) => duration * frame / count);
  const floorBox = new Box3();
  for (const time of times) {
    sample.seek((time + phase * duration) % duration);
    for (const track of rawTracks) {
      const [bone, property] = track.name.split('.');
      const from = source.scene.getObjectByName(bone)!;
      const to = target.scene.getObjectByName(bone)!;
      if (property === 'quaternion') to.quaternion.copy(from.quaternion);
      else to.position.copy(from.position);
    }
    hip.position.copy(sourceHip.position);
    target.scene.updateMatrixWorld(true);
    const floor = Math.min(...targetShoes.map(sole => floorBox.setFromObject(sole, true).min.y));
    // The artist's shoe geometry differs from Y Bot. Project the support correction into the hip parent frame.
    const world = hip.getWorldPosition(new Vector3());
    world.y -= floor;
    hip.parent!.worldToLocal(world);
    hip.position.copy(world);
    for (const [key, values] of tracks) {
      const [bone, property] = key.split('.');
      const node = target.scene.getObjectByName(bone)!;
      values.push(...(property === 'quaternion' ? node.quaternion.toArray() : node.position.toArray()));
    }
  }
  const walking = appendClip(base, name, times, tracks);
  const idle = playback(target, 'idle');
  const gestureDuration = 1.15;
  const gestureTimes = Array.from({ length: 70 }, (_, frame) => gestureDuration * frame / 69);
  const gestureTracks = new Map<string, number[]>(idle.take.tracks
    .filter(track => track.name.endsWith('.quaternion') || track.name === 'Hips.position')
    .map(track => [track.name, []]));
  for (const time of gestureTimes) {
    idle.seek(time);
    talk.seek(2.4 + time);
    const envelope = Math.min(1, time / 0.19, (gestureDuration - time) / 0.24);
    for (const [key, values] of gestureTracks) {
      const [bone, property] = key.split('.');
      const node = target.scene.getObjectByName(bone)!;
      if (property === 'position') {
        values.push(...node.position.toArray());
      } else {
        const rotation = node.quaternion.clone();
        if (talkBones.test(bone) && talkTracks.has(key)) {
          rotation.slerp(discussion.scene.getObjectByName(bone)!.quaternion, envelope * 0.65);
        }
        values.push(...rotation.toArray());
      }
    }
  }
  const output = appendClip(walking, 'street-chat', gestureTimes, gestureTracks);
  const check = await load(output);
  const checkShoes = shoes(check);
  const motion = playback(check, name);
  let minFloor = Infinity, maxFloor = -Infinity;
  for (let sampleIndex = 0; sampleIndex <= count * 4; sampleIndex++) {
    motion.seek(motion.take.duration * sampleIndex / (count * 4));
    const floor = Math.min(...checkShoes.map(sole => floorBox.setFromObject(sole, true).min.y));
    minFloor = Math.min(minFloor, floor);
    maxFloor = Math.max(maxFloor, floor);
  }
  if (Math.max(-minFloor, maxFloor) > 0.004) throw new Error('Shoe contact is outside the 4 mm uniform-cycle bound: ' + entity);
  let targetSlip: number | undefined;
  if (proof) {
    targetSlip = 0;
    for (const contact of proof.contacts) {
      const bone = check.scene.getObjectByName(contact.bone)!;
      const samples: {time: number; point: Vector3}[] = [];
      for (let frame = contact.start * 4; frame <= contact.end * 4; frame++) {
        const time = frame / (proof.fps * 4);
        const local = time - phase * duration;
        motion.seek(((local % duration) + duration) % duration);
        const point = bone.getWorldPosition(new Vector3());
        point.z += time / duration * stride;
        for (const previous of samples) {
          if (time - previous.time <= 0.200000001) {
            targetSlip = Math.max(targetSlip, Math.hypot(point.x - previous.point.x, point.z - previous.point.z));
          }
        }
        samples.push({ time, point });
      }
    }
    if (targetSlip > 0.02) throw new Error('200 ms contact slip exceeds 2 cm: ' + entity + ' ' + targetSlip);
  }
  const src = '/art/pedestrian-life/' + entity + '.glb';
  await writeFile(new URL('site' + src, root), output);
  report.push({ entity, name, sourceId, phase, targetScaleRatio: scale, strideM: stride, durationS: duration, nominalSpeedPerTick: stride / duration / rate,
    minFloorM: minFloor, maxFloorM: maxFloor, inputSha256: sha(input), avatarSha256: sha(base), outputSha256: sha(output), src,
    offlineFootLock: Boolean(proof), targetMaxSlipPer200msM: targetSlip });
}
await writeFile(new URL('gait-report.json', root), JSON.stringify({ seed, rate, conversation: { id: conversationId, sha256: sha(discussionBytes) }, residents: report }, null, 2) + '\n');
console.log(report.map(({ entity, name, minFloorM, maxFloorM }) => ({ entity, name, minFloorM, maxFloorM })));
