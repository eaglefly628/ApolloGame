import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {AnimationMixer, Box3, LoopOnce} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(here, 'preview');
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
const base = await fs.readFile(path.join(publicDir, 'art/street-performers/traveler-performances.glb'));
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
  ['martial', '武术表演', 'ginga-variation-3-121180901'],
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
const playerSrc = '/art/street-performers/traveler-martial-preview.glb';
await fs.writeFile(path.join(publicDir, playerSrc.slice(1)), pack(json, Buffer.concat(chunks)));


const metadata = catalog.clips.find(clip => clip.id === actions[0].sourceId);
const result = await fs.readFile(path.join(publicDir, playerSrc.slice(1)));
const final = unpack(result);
const original = unpack(base);
if (JSON.stringify(final.json.animations.slice(0, -1)) !== JSON.stringify(original.json.animations) ||
    !final.bin.subarray(0, original.json.buffers[0].byteLength).equals(original.bin.subarray(0, original.json.buffers[0].byteLength))) {
  throw new Error('Original performances changed');
}
const loaded = await parse(result);
const clip = loaded.animations.find(clip => clip.name === 'martial');
const mixer = new AnimationMixer(loaded.scene);
const playerAction = mixer.clipAction(clip);
playerAction.setLoop(LoopOnce, 0);
playerAction.clampWhenFinished = true;
playerAction.play();
const sole = ['Left-sole', 'Right-sole'].map(name => loaded.scene.getObjectByName(name));
const pelvis = loaded.scene.getObjectByName('Hips');
let maxFootError = 0;
for (let i = 0; i <= 700; i++) {
  mixer.setTime(clip.duration * i / 700);
  loaded.scene.updateMatrixWorld(true);
  const floor = Math.min(...sole.map(foot => new Box3().setFromObject(foot, true).min.y));
  maxFootError = Math.max(maxFootError, Math.abs(floor));
  if (Math.abs(pelvis.position.x - hipRest[0]) > 1e-6 || Math.abs(pelvis.position.y - hipRest[1]) > 1e-6) {
    throw new Error('Unexpected planar root motion');
  }
}
if (maxFootError > .002) throw new Error('Foot support exceeds 2 mm');
const actionSpec = actions[0];
for (const name of ['crowd-street', 'crowd-navigation']) {
  const scenePath = path.join(publicDir, 'scenes', name + '.json');
  const scene = await readJson(scenePath);
  const player = scene.manifest.entities.player;
  const oldKey = player.Model3D.modelKey;
  player.Model3D.modelKey = 'street-player-martial-preview';
  scene.assets = scene.assets.map(asset => asset.key === oldKey
    ? {...asset, key: player.Model3D.modelKey, src: playerSrc} : asset);
  const recipe = scene.characters.find(recipe => recipe.entity === 'player');
  recipe.performances = [...recipe.performances.filter(entry => entry.clip !== 'martial'), actionSpec];
  const menu = scene.layout.children.find(node => node.id === 'performance-menu');
  if (menu && !menu.children.some(node => node.id === 'perform-martial')) {
    const stop = menu.children.findIndex(node => node.id === 'perform-stop');
    menu.children.splice(stop, 0, {
      id: 'perform-martial', type: 'Button',
      props: {label: actionSpec.label, action: actionSpec.action, kind: 'quiet'},
    });
  }
  await fs.writeFile(scenePath, JSON.stringify(scene, null, 2) + '\n');
}
const report = {
  action: actionSpec, source: metadata.source, authorization: 'Existing local collection. Local preview only. No new downloads or release clearance.',
  modelSha256: sha(result), previousModelSha256: sha(base), priorClipsUnchanged: true,
  importedClips: loaded.animations.map(clip => clip.name), planarRootMotionMetres: 0,
  groundCheck: {samples: 701, maxFootErrorMetres: maxFootError},
};
await fs.writeFile(path.join(here, 'verification.json'), JSON.stringify(report, null, 2) + '\n');
console.log(report);
