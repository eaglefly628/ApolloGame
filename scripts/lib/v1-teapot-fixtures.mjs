// Isolated offline technical assets. No production registry, network or process launch.
import { readFileSync, writeFileSync, mkdirSync, existsSync, lstatSync, readdirSync, realpathSync } from 'node:fs';
import { dirname, join, resolve, relative, isAbsolute, parse } from 'node:path';
import { homedir } from 'node:os';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { TeapotGeometry } from 'three/examples/jsm/geometries/TeapotGeometry.js';
import { inspectCharacterGlb } from './character-glb.mjs';
import { parseGlb, bakeSceneImport } from './scene-geometry.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = message => { throw new Error(`V1 fixture reject: ${message}`); };
const canonical = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const inside = (parent, child) => { const path = relative(parent, child); return path === '' || (!path.startsWith('..') && !isAbsolute(path)); };
function pack(json, binary) {
  const raw = Buffer.from(JSON.stringify(json)), text = Buffer.concat([raw, Buffer.alloc((4 - raw.length % 4) % 4, 32)]);
  const bin = Buffer.concat([binary, Buffer.alloc((4 - binary.length % 4) % 4)]), bytes = Buffer.alloc(28 + text.length + bin.length);
  bytes.write('glTF'); bytes.writeUInt32LE(2, 4); bytes.writeUInt32LE(bytes.length, 8); bytes.writeUInt32LE(text.length, 12); bytes.writeUInt32LE(0x4e4f534a, 16); text.copy(bytes, 20);
  bytes.writeUInt32LE(bin.length, 20 + text.length); bytes.writeUInt32LE(0x004e4942, 24 + text.length); bin.copy(bytes, 28 + text.length); return bytes;
}

/** Installed native Utah teapot, authored offline to metres and bbox-foot-center. */
export function createV1KettleFixture() {
  const geometry = new TeapotGeometry(1, 8, true, true, true, true, true);
  try {
    geometry.computeBoundingBox(); const box = geometry.boundingBox, scale = .35 / (box.max.y - box.min.y);
    geometry.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2); geometry.scale(scale, scale, scale); geometry.computeBoundingBox();
    const position = geometry.getAttribute('position'); let handleVertex = 12 * 81;
    for (let i = 12 * 81; i < 16 * 81; i++) if (position.getX(i) < position.getX(handleVertex)) handleVertex = i;
    const handleLocal = [position.getX(handleVertex), position.getY(handleVertex), position.getZ(handleVertex)];
    const require = createRequire(import.meta.url), nativePath = require.resolve('three/examples/jsm/geometries/TeapotGeometry.js');
    const licensePath = resolve(dirname(require.resolve('three')), '../LICENSE');
    const metadata = { source: 'three/TeapotGeometry', sourceSha256: sha(readFileSync(nativePath)), license: 'MIT', licenseText: readFileSync(licensePath, 'utf8'),
      licenseSha256: sha(readFileSync(licensePath)), height: geometry.boundingBox.max.y - geometry.boundingBox.min.y,
      bounds: { min: geometry.boundingBox.min.toArray(), max: geometry.boundingBox.max.toArray() },
      handleLocal, handleVertex: { node: 0, primitive: 0, vertex: handleVertex, nativePatches: [12, 13, 14, 15] }, axes: 'Y-up; handle -X; spout +X; bbox-foot-center', segments: 8 };
    const binary = [], bufferViews = [], accessors = []; let offset = 0;
    function accessor(values, itemSize, indices = false) {
      const data = Buffer.alloc(values.length * 4); values.forEach((value, i) => indices ? data.writeUInt32LE(value, i * 4) : data.writeFloatLE(value, i * 4));
      bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: data.length, target: indices ? 34963 : 34962 }); binary.push(data); offset += data.length;
      accessors.push({ bufferView: bufferViews.length - 1, componentType: indices ? 5125 : 5126, count: values.length / itemSize, type: indices ? 'SCALAR' : `VEC${itemSize}`,
        ...(values === position.array ? { min: metadata.bounds.min, max: metadata.bounds.max } : {}) }); return accessors.length - 1;
    }
    const attributes = { POSITION: accessor(position.array, 3), NORMAL: accessor(geometry.getAttribute('normal').array, 3), TEXCOORD_0: accessor(geometry.getAttribute('uv').array, 2) };
    const indices = accessor(geometry.index.array, 1, true);
    const json = { asset: { version: '2.0', generator: 'Apollo offline native three TeapotGeometry export' }, scene: 0, scenes: [{ nodes: [0] }],
      nodes: [{ name: 'UtahTeapotOfflineKettle', mesh: 0 }], meshes: [{ name: 'UtahTeapotWithHandleSpoutAndLid', primitives: [{ attributes, indices, material: 0 }] }],
      materials: [{ name: 'OfflineTurquoisePorcelain', doubleSided: true, pbrMetallicRoughness: { baseColorFactor: [.04, .62, .66, 1], metallicFactor: .05, roughnessFactor: .28 } }],
      accessors, bufferViews, buffers: [{ byteLength: offset }], extras: { v1TeapotFixture: { source: metadata.source, sourceSha256: metadata.sourceSha256, license: metadata.license } } };
    return { bytes: pack(json, Buffer.concat(binary)), metadata };
  } finally { geometry.dispose(); }
}

function outputPath(outDir, sources) {
  if (typeof outDir !== 'string' || !outDir.trim()) fail('outDir is required');
  const path = resolve(outDir); let ancestor = path, suffix = [];
  while (!existsSync(ancestor)) { suffix.unshift(parse(ancestor).base); ancestor = dirname(ancestor); }
  const actual = join(realpathSync(ancestor), ...suffix), repo = realpathSync(ROOT);
  if (actual === parse(actual).root || actual === realpathSync(homedir()) || inside(repo, actual) || sources.some(source => inside(actual, realpathSync(source)) || inside(realpathSync(source), actual))) fail('unsafe output path or source overlap');
  for (let parent = actual; parent !== dirname(parent); parent = dirname(parent)) if (existsSync(join(parent, '.git'))) fail('unsafe output inside a source repository');
  if (existsSync(path) && (lstatSync(path).isSymbolicLink() || !lstatSync(path).isDirectory() || readdirSync(path).length)) fail('outDir must be new or an empty real directory');
  return actual;
}

// Read actual default-scene POSITION vertices, retaining node transforms and vertex IDs.
function staticVertices(bytes) {
  inspectCharacterGlb(bytes, { requireSkin: false, requireHumanoid: false });
  const { json, binary } = parseGlb(bytes), vertices = [];
  if (json.skins?.length || json.animations?.length) fail('kettle must be static');
  function visit(index, parent) {
    const node = json.nodes[index], local = node.matrix ? new Matrix4().fromArray(node.matrix) : new Matrix4().compose(new Vector3(...(node.translation ?? [0, 0, 0])), new Quaternion(...(node.rotation ?? [0, 0, 0, 1])), new Vector3(...(node.scale ?? [1, 1, 1])));
    const world = parent.clone().multiply(local);
    if (node.mesh !== undefined) for (const [primitive, part] of json.meshes[node.mesh].primitives.entries()) {
      const accessor = json.accessors[part.attributes.POSITION], view = json.bufferViews[accessor.bufferView];
      if (accessor.componentType !== 5126 || accessor.type !== 'VEC3') fail('kettle POSITION must be raw Float32 VEC3');
      for (let i = 0; i < accessor.count; i++) {
        const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0) + i * (view.byteStride ?? 12);
        vertices.push({ point: new Vector3(binary.readFloatLE(start), binary.readFloatLE(start + 4), binary.readFloatLE(start + 8)).applyMatrix4(world).toArray(), node: index, primitive, vertex: i });
      }
    }
    for (const child of node.children ?? []) visit(child, world);
  }
  for (const root of json.scenes[json.scene ?? 0].nodes) visit(root, new Matrix4());
  return vertices;
}

/** Explicit isolated bundle. All validation precedes output creation. */
export async function prepareV1TeapotFixtures({ outDir, characterDir, sceneGlb, sceneData, kettleGlb } = {}) {
  for (const [name, value] of Object.entries({ characterDir, sceneGlb, sceneData })) if (typeof value !== 'string' || !value) fail(`${name} path is required`);
  const sources = [characterDir, sceneGlb, sceneData, ...(kettleGlb ? [kettleGlb] : [])], output = outputPath(outDir, sources);
  const sourceBytes = readFileSync(join(characterDir, 'fixture-source.json')), source = JSON.parse(sourceBytes);
  if (!['generic-blender-fixture', 'unit-synthetic-character-fixture'].includes(source.source)) fail('character source must identify generic offline or explicitly synthetic unit fixture');
  for (const field of ['realArpValidated', 'realMixamoValidated', 'realTripoValidated', 'productionApproved']) if (Object.hasOwn(source, field) && source[field] !== false) fail('paid/production approval must not be asserted by offline fixture input');
  if (source.fps !== 30 || source.sampleCount !== 31 || canonical([...(source.clips ?? [])].sort()) !== canonical(['idle', 'reach', 'walk'])) fail('character source must declare idle/walk/reach at 30 fps, 31 samples');
  const files = {}, clips = {}; let skeletonHash, actualBones;
  for (const clip of ['idle', 'walk', 'reach']) {
    const bytes = readFileSync(join(characterDir, `${clip}.glb`)), inspected = inspectCharacterGlb(bytes, { clipName: clip, fps: 30, frames: 31 });
    if (inspected.animations.length !== 1 || inspected.animations[0].name !== clip) fail(`${clip} must contain exactly its named external clip`);
    if (inspected.mock !== (source.source === 'unit-synthetic-character-fixture')) fail('character mock provenance does not match actual GLB bytes');
    if (skeletonHash && skeletonHash !== inspected.skeletonHash) fail('all external clips must preserve the same actual skeleton'); skeletonHash = inspected.skeletonHash; actualBones = inspected.bones;
    files[`${clip}.glb`] = bytes; clips[clip] = { sha256: sha(bytes), skeletonHash, fps: 30, frames: 31, loop: clip !== 'reach' };
  }
  const hero = parseGlb(files['idle.glb']); delete hero.json.animations; files['hero.glb'] = pack(hero.json, hero.binary);
  if (inspectCharacterGlb(files['hero.glb']).skeletonHash !== skeletonHash) fail('hero skeleton changed while removing embedded animations');
  const sceneBytes = readFileSync(sceneGlb), dataBytes = readFileSync(sceneData), scene = JSON.parse(dataBytes);
  const sceneJson = parseGlb(sceneBytes).json;
  if (sceneJson.extras?.mock === true || /mock|placeholder/i.test(sceneJson.asset?.generator ?? '')) fail('scene must be actual authored geometry, not an AI mock placeholder');
  if (scene.sourceSha256 !== sha(sceneBytes)) fail('scene candidate SHA does not match actual GLB bytes');
  if (canonical(scene) !== canonical(await bakeSceneImport(sceneBytes))) fail('scene candidate geometry does not match actual GLB bake');
  files['scene.glb'] = sceneBytes;
  const generated = createV1KettleFixture(); let kettle = generated.metadata;
  files['kettle.glb'] = kettleGlb ? readFileSync(kettleGlb) : generated.bytes;
  if (kettleGlb) {
    const vertices = staticVertices(files['kettle.glb']);
    const min = [0, 1, 2].map(axis => Math.min(...vertices.map(v => v.point[axis]))), max = [0, 1, 2].map(axis => Math.max(...vertices.map(v => v.point[axis])));
    if (Math.abs(max[1] - min[1] - .35) > 1e-5 || Math.abs(min[1]) > 1e-5 || Math.abs(max[0] + min[0]) > 1e-5 || Math.abs(max[2] + min[2]) > 1e-5) fail('supplied kettle must be .35m high with bbox-foot-center and declared handle -X');
    const handle = vertices.reduce((a, b) => b.point[0] < a.point[0] ? b : a);
    kettle = { source: 'user-supplied offline normalized kettle; handle declared -X', license: 'unverified-user-supplied; not production approved', sourceSha256: sha(files['kettle.glb']), height: max[1] - min[1], bounds: { min, max },
      handleLocal: handle.point, handleVertex: { node: handle.node, primitive: handle.primitive, vertex: handle.vertex }, axes: generated.metadata.axes };
  }
  const flags = { realArpValidated: false, realMixamoValidated: false, realTripoValidated: false, productionApproved: false };
  const assets = [{ id: 'scene', type: 'mesh', file: 'scene.glb', spec: { scene } }, { id: 'model/hero', type: 'mesh', file: 'hero.glb' },
    ...['idle', 'walk', 'reach'].map(clip => ({ id: `motion/${clip}`, type: 'animation', file: `${clip}.glb`, spec: { skeleton: 'apollo-humanoid-v1', fps: 30, frames: 31, loop: clip !== 'reach' } })), { id: 'model/kettle', type: 'mesh', file: 'kettle.glb' }];
  const index = { version: 1, assets: assets.map(({ file, ...entry }) => ({ ...entry, path: `/fixtures/${file}`, status: 'filled', description: 'Explicit isolated V1 offline technical fixture, not production art',
    source: entry.id === 'model/kettle' ? kettle.source : entry.id === 'scene' ? 'existing SHA-verified authored scene GLB' : source.source,
    license: entry.id === 'model/kettle' ? kettle.license : 'self-authored technical fixture; production license not approved', provenance: { ...flags, sha256: sha(files[file]), offlineFixture: true } })), groups: { v1: assets.map(a => a.id) }, initialGroup: 'v1' };
  const metadata = { version: 1, ...flags, offlineFixture: true, character: { source: source.source, sourcePath: realpathSync(characterDir), sourceSha256: sha(sourceBytes), skeletonHash, bones: actualBones, fixtureSource: source, clips,
    hero: { sha256: sha(files['hero.glb']), derivation: 'idle GLB with only embedded animations removed; bind/rest skeleton retained' } },
    scene: { sourcePath: realpathSync(sceneGlb), sourceSha256: sha(sceneBytes), dataSha256: sha(dataBytes), nativeGenerator: sceneJson.asset.generator ?? null, license: 'unverified-fixture-source; not production approved', nodes: scene.nodes }, kettle: { ...kettle, sha256: sha(files['kettle.glb']) },
    assets: Object.fromEntries(assets.map(a => [a.id, { file: a.file, sha256: sha(files[a.file]) }])) };
  outputPath(outDir, sources); // Recheck after async geometry decoding; never overwrite a raced-in directory.
  if (!existsSync(output)) mkdirSync(output, { recursive: true });
  mkdirSync(join(output, 'public')); mkdirSync(join(output, 'public', 'fixtures'));
  for (const [file, bytes] of Object.entries(files)) writeFileSync(join(output, 'public', 'fixtures', file), bytes, { flag: 'wx' });
  writeFileSync(join(output, 'public', 'fixtures', 'index.json'), `${JSON.stringify(index, null, 2)}\n`, { flag: 'wx' });
  writeFileSync(join(output, 'fixture-inputs.json'), `${JSON.stringify(metadata, null, 2)}\n`, { flag: 'wx' });
  console.info(`[v1-fixtures] commit isolated bundle ${output}; assets=${assets.length}; productionApproved=false`);
  return { outDir: output, index, metadata };
}
