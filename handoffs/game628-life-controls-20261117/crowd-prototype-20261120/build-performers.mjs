import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {AnimationMixer, Box3, LoopOnce} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(here, '..');
const publicDir = path.join(project, 'public');
const output = path.join(publicDir, 'art/street-performers');
const library = process.env.APOLLO_MOTION_LIBRARY ?? '/Users/junbaili/ApolloAssets/motion-lib-full-frames';
const readJson = async p => JSON.parse(await fs.readFile(p, 'utf8'));
const sha = b => createHash('sha256').update(b).digest('hex');

function unpack(bytes) {
  const length = bytes.readUInt32LE(12);
  return {json: JSON.parse(bytes.subarray(20, 20 + length)), bin: bytes.subarray(28 + length)};
}

function pack(json, bin) {
  const bytes = Buffer.from(JSON.stringify(json));
  const jsonSize = Math.ceil(bytes.length / 4) * 4;
  const binSize = Math.ceil(bin.length / 4) * 4;
  const result = Buffer.alloc(28 + jsonSize + binSize);
  result.writeUInt32LE(0x46546c67);
  result.writeUInt32LE(2, 4);
  result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(jsonSize, 12);
  result.writeUInt32LE(0x4e4f534a, 16);
  result.fill(32, 20, 20 + jsonSize);
  bytes.copy(result, 20);
  result.writeUInt32LE(binSize, 20 + jsonSize);
  result.writeUInt32LE(0x004e4942, 24 + jsonSize);
  bin.copy(result, 28 + jsonSize);
  return result;
}

const parse = bytes => new GLTFLoader().parseAsync(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length), '',
);
await fs.mkdir(output, {recursive: true});
const base = await fs.readFile(path.join(publicDir, 'art/reference-rebuild-20261120/character/traveler-v4.glb'));
const {json, bin} = unpack(base);
const chunks = [bin];
let offset = bin.length;
function append(values, type, size) {
  const data = Buffer.from(Float32Array.from(values).buffer);
  const bufferView = json.bufferViews.length;
  json.bufferViews.push({buffer: 0, byteOffset: offset, byteLength: data.length});
  chunks.push(data);
  offset += data.length;
  json.buffers[0].byteLength = offset;
  return json.accessors.push({
    bufferView, componentType: 5126, count: values.length / size, type,
    ...(size === 1 ? {min: [values[0]], max: [values.at(-1)]} : {}),
  }) - 1;
}

function values(source, index, size) {
  const a = source.json.accessors[index];
  const view = source.json.bufferViews[a.bufferView];
  if (a.componentType !== 5126 || a.sparse || view.byteStride) throw new Error('Unsupported motion accessor');
  const start = (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
  return Array.from({length: a.count * size}, (_, i) => source.bin.readFloatLE(start + i * 4));
}

const catalog = await readJson(path.join(library, 'catalog.json'));
const targetNodes = new Map(json.nodes.map((node, i) => [node.name, i]));
const hipIndex = targetNodes.get('Hips');
const hipRest = json.nodes[hipIndex].translation;
const actions = [];
for (const [clip, label, sourceId] of [
  ['dance', '跳舞', 'arms-hip-hop-dance-108990901'],
  ['clap', '鼓掌', 'clapping-100570901'],
  ['bow', '鞠躬', 'quick-formal-bow-119110901'],
]) {
  const bytes = await fs.readFile(path.join(library, 'clips', sourceId + '.glb'));
  if (sha(bytes) !== catalog.clips.find(c => c.id === sourceId)?.sha256) throw new Error('Motion source mismatch: ' + sourceId);
  const source = unpack(bytes);
  const animation = {name: clip, samplers: [], channels: []};
  const inputs = new Map();
  const sourceClip = source.json.animations[0];
  for (const channel of sourceClip.channels) {
    const name = source.json.nodes[channel.target.node].name;
    const node = targetNodes.get(name);
    if (node === undefined || channel.target.path !== 'rotation') continue;
    const sampler = sourceClip.samplers[channel.sampler];
    if (sampler.interpolation && sampler.interpolation !== 'LINEAR') throw new Error('Unexpected interpolation');
    if (!inputs.has(sampler.input)) inputs.set(sampler.input, append(values(source, sampler.input, 1), 'SCALAR', 1));
    const output = append(values(source, sampler.output, 4), 'VEC4', 4);
    animation.channels.push({sampler: animation.samplers.length, target: {node, path: 'rotation'}});
    animation.samplers.push({input: inputs.get(sampler.input), output, interpolation: 'LINEAR'});
  }
  if (animation.channels.length < 60) throw new Error('Incomplete retarget: ' + sourceId);
  json.animations.push(animation);

  // Keep the simulation's planar position fixed and ground the lowest actual shoe.
  const {scene, animations} = await parse(pack(json, Buffer.concat(chunks)));
  const take = animations.find(a => a.name === clip);
  const hip = scene.getObjectByName('Hips');
  const feet = ['Left-sole', 'Right-sole'].map(name => scene.getObjectByName(name));
  const mixer = new AnimationMixer(scene);
  const action = mixer.clipAction(take);
  action.setLoop(LoopOnce, 0);
  action.clampWhenFinished = true;
  action.play();
  const times = [], heights = [];
  const n = Math.ceil(take.duration * 120);
  for (let i = 0; i <= n; i++) {
    const time = i * take.duration / n;
    mixer.setTime(time);
    scene.updateMatrixWorld(true);
    const floor = Math.min(...feet.map(foot => new Box3().setFromObject(foot, true).min.y));
    const vertical = hip.parent.matrixWorld.elements[9];
    if (!Number.isFinite(floor) || Math.abs(vertical) < 1e-5) throw new Error('Invalid ground projection');
    times.push(time);
    heights.push(hipRest[0], hipRest[1], hipRest[2] - floor / vertical);
  }
  animation.channels.push({sampler: animation.samplers.length, target: {node: hipIndex, path: 'translation'}});
  animation.samplers.push({input: append(times, 'SCALAR', 1), output: append(heights, 'VEC3', 3)});
  actions.push({clip, label, sourceId, sourceSha256: sha(bytes), action: 'pose.' + clip, durationMs: take.duration * 1000});
}
const playerSrc = '/art/street-performers/traveler-performances.glb';
await fs.writeFile(path.join(publicDir, playerSrc.slice(1)), pack(json, Buffer.concat(chunks)));

const face = await readJson(path.join(project, 'face-studio-20261120/face-contract.json'));
const variants = [...face.variants];
const sharedBody = await fs.readFile(path.join(publicDir, face.sharedBinary.src.slice(1)));
// Reproducible commissioning-time draw. A resident keeps the same face on reload.
const seed = 628211;
let state = seed;
const residents = [];
for (let i = 0; i < 4; i++) {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  const variant = variants.splice(Math.floor(state / 2 ** 32 * variants.length), 1)[0];
  const avatar = await readJson(path.join(publicDir, variant.src.slice(1)));
  const female = i % 2 === 1;
  const head = avatar.nodes.find(n => n.name === 'Head');
  const omitted = new Set(['apron-front', 'apron-pocket', ...(female ? ['cap-crown', 'cap-visor'] : [])]);
  for (const node of avatar.nodes) if (node.children) {
    node.children = node.children.filter(child => !omitted.has(avatar.nodes[child].name));
  }
  if (female) {
    const hair = avatar.nodes.find(n => n.name === 'back-hair');
    hair.scale = (hair.scale ?? [1, 1, 1]).map((n, axis) => axis === 1 ? n * 1.55 : n);
    if (!head.children.some(index => avatar.nodes[index] === hair)) throw new Error('Back hair must follow Head');
  }
  const palette = [[.16, .27, .4], [.56, .23, .27], [.36, .23, .12], [.19, .36, .27]][i];
  for (const name of ['shirt-body', 'Left-sleeve', 'Right-sleeve']) {
    const node = avatar.nodes.find(n => n.name === name);
    for (const primitive of avatar.meshes[node.mesh].primitives) {
      const material = structuredClone(avatar.materials[primitive.material]);
      material.pbrMetallicRoughness.baseColorFactor = [...palette, 1];
      primitive.material = avatar.materials.push(material) - 1;
    }
  }
  const key = 'street-pedestrian-' + (i + 1);
  const src = '/art/street-performers/' + key + '.glb';
  delete avatar.buffers[0].uri;
  const bytes = pack(avatar, sharedBody);
  const loaded = await parse(bytes);
  if (!loaded.animations.some(a => a.name === 'walk')) throw new Error('Resident walk is missing');
  await fs.writeFile(path.join(publicDir, src.slice(1)), bytes);
  residents.push({key, src, gender: female ? 'female' : 'male', faceId: variant.id, faceDNA: variant.dna});
}
await fs.writeFile(path.join(here, 'performers.json'), JSON.stringify({playerSrc, actions, seed, residents}, null, 2) + '\n');
console.log({actions: actions.map(a => a.clip), residents: residents.map(r => [r.gender, r.faceId])});
