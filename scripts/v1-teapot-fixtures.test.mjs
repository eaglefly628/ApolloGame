import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, readdirSync, existsSync, symlinkSync, realpathSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { prepareV1TeapotFixtures, createV1KettleFixture } from './lib/v1-teapot-fixtures.mjs';
import { makeMockCharacterGlb } from './fixtures/character-pipeline/mock-character.mjs';
import { triangle, glb } from './fixtures/scene-import/glb-fixtures.mjs';
import { bakeSceneImport, parseGlb } from './lib/scene-geometry.mjs';
import { inspectCharacterGlb } from './lib/character-glb.mjs';
import { parseAssetIndex, registerAssetIndex } from '../src/assets/asset-index';
import { AssetManager } from '../src/assets/asset-manager';
import { ModelAssetLoader } from '../src/assets/model-loader';

const roots = [], hash = bytes => createHash('sha256').update(bytes).digest('hex');
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
async function inputs() {
  const root = mkdtempSync(join(tmpdir(), 'apollo-v1-fixture-unit-')); roots.push(root);
  const characterDir = join(root, 'character'); mkdirSync(characterDir);
  const source = { source: 'unit-synthetic-character-fixture', realArpValidated: false, realMixamoValidated: false, fps: 30, sampleCount: 31, clips: ['idle', 'walk', 'reach'] };
  writeFileSync(join(characterDir, 'fixture-source.json'), JSON.stringify(source));
  for (const clipName of source.clips) writeFileSync(join(characterDir, `${clipName}.glb`), makeMockCharacterGlb({ clipName }));
  const f = triangle(); f.json.nodes.push({ name: 'col_floor', mesh: 0 }, { name: 'spawn_hero', translation: [0, 0, 0] }); f.json.scenes[0].nodes.push(1, 2);
  const bytes = f.bytes(), sceneGlb = join(root, 'scene.glb'), sceneData = join(root, 'scene.json');
  writeFileSync(sceneGlb, bytes); writeFileSync(sceneData, JSON.stringify(await bakeSceneImport(bytes)));
  return { root, source, outDir: join(root, 'bundle'), characterDir, sceneGlb, sceneData };
}
function rewrite(file, edit) { const parsed = parseGlb(readFileSync(file)); edit(parsed.json, parsed.binary); writeFileSync(file, glb(parsed.json, parsed.binary)); }
const options = input => ({ outDir: input.outDir, characterDir: input.characterDir, sceneGlb: input.sceneGlb, sceneData: input.sceneData });

describe('V1 isolated offline fixture assets', () => {
  it('exports an actual native handle vertex, complete teapot topology and metre/foot-center bounds without globals', () => {
    const reader = Object.getOwnPropertyDescriptor(globalThis, 'FileReader'), a = createV1KettleFixture(), b = createV1KettleFixture();
    expect(a.bytes.equals(b.bytes)).toBe(true); expect(Object.getOwnPropertyDescriptor(globalThis, 'FileReader')).toEqual(reader);
    const { json, binary } = parseGlb(a.bytes), p = json.meshes[0].primitives[0], accessor = json.accessors[p.attributes.POSITION], view = json.bufferViews[accessor.bufferView];
    const vertex = a.metadata.handleVertex.vertex, offset = (view.byteOffset ?? 0) + vertex * 12;
    expect([0, 1, 2].map(axis => binary.readFloatLE(offset + axis * 4))).toEqual(a.metadata.handleLocal);
    expect(vertex).toBeGreaterThanOrEqual(12 * 81); expect(vertex).toBeLessThan(16 * 81); expect(a.metadata.handleLocal[0]).toBeLessThan(-.3);
    expect(a.metadata.handleLocal[1]).toBeCloseTo(.2); expect(a.metadata.height).toBeCloseTo(.35, 6);
    expect(a.metadata.bounds.min[1]).toBe(0); expect(a.metadata.bounds.min[0] + a.metadata.bounds.max[0]).toBeCloseTo(0);
    expect(json.accessors[p.indices].count / 3).toBe(4032); expect(accessor.count).toBe(2592); expect(p.attributes.NORMAL).toBeDefined();
    expect(a.metadata.license).toBe('MIT'); expect(a.metadata.licenseText).toContain('three.js authors'); expect(a.metadata.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
    const require = createRequire(import.meta.url);
    expect(a.metadata.sourceSha256).toBe(hash(readFileSync(require.resolve('three/examples/jsm/geometries/TeapotGeometry.js'))));
    expect(a.metadata.licenseSha256).toBe(hash(readFileSync(resolve(dirname(require.resolve('three')), '../LICENSE'))));
  });

  it('produces a hermetic true index loaded through actual AssetManager/ModelAssetLoader bytes and group eviction', async () => {
    const input = await inputs(), result = await prepareV1TeapotFixtures(options(input)), index = parseAssetIndex(result.index);
    const fetch = vi.fn(async url => new Response(readFileSync(join(result.outDir, 'public', String(url))), { status: 200 })); vi.stubGlobal('fetch', fetch);
    const manager = new AssetManager(new ModelAssetLoader()); registerAssetIndex(manager, index); await manager.preloadGroup('v1');
    expect(index.groups.v1).toEqual(['scene', 'model/hero', 'motion/idle', 'motion/walk', 'motion/reach', 'model/kettle']);
    for (const key of index.groups.v1) {
      const loaded = manager.get(key); expect(loaded.handle).toBeInstanceOf(ArrayBuffer); expect(loaded.width).toBe(0); expect(loaded.height).toBe(0);
      expect(hash(Buffer.from(loaded.handle))).toBe(result.metadata.assets[key].sha256);
      expect(loaded.descriptor.kind).toBe(key.startsWith('motion/') ? 'skeletal-animation' : 'model');
    }
    expect(manager.get('scene').scene.sourceSha256).toBe(hash(readFileSync(input.sceneGlb)));
    manager.releaseGroup('v1'); for (const key of index.groups.v1) expect(manager.get(key)).toBeUndefined();
    await manager.preloadGroup('v1'); expect(fetch).toHaveBeenCalledTimes(12); manager.releaseGroup('v1');
  });

  it('retains original external clips, exact skeleton, truthful synthetic provenance and only strips hero animations', async () => {
    const input = await inputs(), result = await prepareV1TeapotFixtures(options(input)), folder = join(result.outDir, 'public', 'fixtures');
    for (const clip of ['idle', 'walk', 'reach']) {
      expect(readFileSync(join(folder, `${clip}.glb`)).equals(readFileSync(join(input.characterDir, `${clip}.glb`)))).toBe(true);
      const entry = result.index.assets.find(a => a.id === `motion/${clip}`);
      expect(entry.spec).toEqual({ skeleton: 'apollo-humanoid-v1', fps: 30, frames: 31, loop: clip !== 'reach' });
    }
    const idle = parseGlb(readFileSync(join(input.characterDir, 'idle.glb'))), hero = parseGlb(readFileSync(join(folder, 'hero.glb'))); delete idle.json.animations;
    expect(hero.json).toEqual(idle.json); expect(hero.binary.equals(idle.binary)).toBe(true);
    expect(inspectCharacterGlb(readFileSync(join(folder, 'hero.glb'))).skeletonHash).toBe(result.metadata.character.skeletonHash);
    expect(hero.json.animations).toBeUndefined(); expect(result.metadata.character.source).toBe('unit-synthetic-character-fixture');
    for (const field of ['realArpValidated', 'realMixamoValidated', 'realTripoValidated', 'productionApproved']) {
      expect(result.metadata[field]).toBe(false); for (const entry of result.index.assets) expect(entry.provenance[field]).toBe(false);
    }
    expect(result.metadata.scene.dataSha256).toBe(hash(readFileSync(input.sceneData))); expect(result.metadata.kettle.licenseSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(readdirSync(folder).sort()).toEqual(['hero.glb', 'idle.glb', 'index.json', 'kettle.glb', 'reach.glb', 'scene.glb', 'walk.glb']);
  });

  it('refuses unsafe output, nonempty directories, symlinks and source overlap without overwriting', async () => {
    const input = await inputs(), nonempty = join(input.root, 'kept'), empty = join(input.root, 'empty'); mkdirSync(nonempty); mkdirSync(empty); writeFileSync(join(nonempty, 'keep.txt'), 'kept');
    const link = join(input.root, 'link'); symlinkSync(empty, link, 'dir');
    const otherRepo = join(input.root, 'repository'); mkdirSync(otherRepo); writeFileSync(join(otherRepo, '.git'), 'fixture repository marker');
    for (const outDir of [input.characterDir, join(input.characterDir, 'output'), input.root, '/', homedir(), resolve('.'), join(otherRepo, 'out'), nonempty, link]) await expect(prepareV1TeapotFixtures({ ...options(input), outDir })).rejects.toThrow(/unsafe|empty/);
    expect(readFileSync(join(nonempty, 'keep.txt'), 'utf8')).toBe('kept'); expect(readdirSync(empty)).toEqual([]);
    expect((await prepareV1TeapotFixtures({ ...options(input), outDir: empty })).outDir).toBe(realpathSync(empty));
  });

  it('rechecks output reservation after async scene decode and preserves a raced-in file', async () => {
    const input = await inputs(), pending = prepareV1TeapotFixtures(options(input));
    mkdirSync(input.outDir); writeFileSync(join(input.outDir, 'raced.txt'), 'keep');
    await expect(pending).rejects.toThrow(/empty/); expect(readdirSync(input.outDir)).toEqual(['raced.txt']); expect(readFileSync(join(input.outDir, 'raced.txt'), 'utf8')).toBe('keep');
  });

  it.each(['sha', 'geometry', 'mock'])('rejects invalid actual scene %s before writing output', async mode => {
    const input = await inputs();
    if (mode === 'mock') { rewrite(input.sceneGlb, json => { json.extras = { mock: true }; }); writeFileSync(input.sceneData, JSON.stringify(await bakeSceneImport(readFileSync(input.sceneGlb)))); }
    else { const data = JSON.parse(readFileSync(input.sceneData)); if (mode === 'sha') data.sourceSha256 = '0'.repeat(64); else data.nodes[0].positions[0] += .25; writeFileSync(input.sceneData, JSON.stringify(data)); }
    await expect(prepareV1TeapotFixtures(options(input))).rejects.toThrow(/scene/); expect(existsSync(input.outDir)).toBe(false);
  });

  it.each(['approval', 'source', 'sampling', 'mock-label', 'clip', 'skeleton'])('rejects incompatible or misleading character %s before output creation', async mode => {
    const input = await inputs(), source = { ...input.source };
    if (mode === 'approval') source.productionApproved = true;
    if (mode === 'source') source.source = 'paid-arp';
    if (mode === 'sampling') source.sampleCount = 61;
    if (mode === 'mock-label') source.source = 'generic-blender-fixture';
    writeFileSync(join(input.characterDir, 'fixture-source.json'), JSON.stringify(source));
    if (mode === 'clip') rewrite(join(input.characterDir, 'walk.glb'), json => { json.animations.push({ ...structuredClone(json.animations[0]), name: 'extra' }); });
    if (mode === 'skeleton') rewrite(join(input.characterDir, 'walk.glb'), json => { json.nodes[4].translation[1] += .01; });
    await expect(prepareV1TeapotFixtures(options(input))).rejects.toThrow(/fixture|clip|skeleton|provenance/); expect(existsSync(input.outDir)).toBe(false);
  });

  it('accepts an explicit raw normalized kettle, observes its actual vertex and refuses wrongly sized/compressed inputs', async () => {
    const input = await inputs(), kettleGlb = join(input.root, 'kettle.glb'), raw = createV1KettleFixture(); writeFileSync(kettleGlb, raw.bytes);
    const result = await prepareV1TeapotFixtures({ ...options(input), kettleGlb });
    expect(readFileSync(join(result.outDir, 'public', 'fixtures', 'kettle.glb')).equals(raw.bytes)).toBe(true);
    expect(result.metadata.kettle.handleLocal).toEqual(raw.metadata.handleLocal); expect(result.metadata.kettle.license).toContain('unverified');
    rewrite(kettleGlb, (json, bin) => { const a = json.accessors[json.meshes[0].primitives[0].attributes.POSITION], v = json.bufferViews[a.bufferView]; for (let i = 0; i < a.count; i++) bin.writeFloatLE(bin.readFloatLE(v.byteOffset + i * 12 + 4) * 2, v.byteOffset + i * 12 + 4); });
    await expect(prepareV1TeapotFixtures({ ...options(input), outDir: join(input.root, 'wrong-size'), kettleGlb })).rejects.toThrow(/.35m/);
    const parsed = parseGlb(raw.bytes); parsed.json.extensionsUsed = ['KHR_draco_mesh_compression']; parsed.json.extensionsRequired = [...parsed.json.extensionsUsed]; writeFileSync(kettleGlb, glb(parsed.json, parsed.binary));
    await expect(prepareV1TeapotFixtures({ ...options(input), outDir: join(input.root, 'compressed'), kettleGlb })).rejects.toThrow(/extensions\/compression/);
  });

  it('imports without IO/CLI execution and the CLI consumes explicit isolated paths offline', async () => {
    const input = await inputs(), script = join(dirname(fileURLToPath(import.meta.url)), 'prepare-v1-teapot-fixtures.mjs');
    const imported = await import('./prepare-v1-teapot-fixtures.mjs'); expect(imported.prepareV1TeapotFixtures).toBe(prepareV1TeapotFixtures); expect(existsSync(input.outDir)).toBe(false);
    const result = spawnSync(process.execPath, [script, '--out', input.outDir, '--character-dir', input.characterDir, '--scene-glb', input.sceneGlb, '--scene-data', input.sceneData], { encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0); expect(JSON.parse(readFileSync(join(input.outDir, 'fixture-inputs.json'))).productionApproved).toBe(false);
    const bad = spawnSync(process.execPath, [script, '--unknown', 'x'], { encoding: 'utf8' }); expect(bad.status).toBe(1); expect(bad.stderr).toContain('Usage');
  });
});
