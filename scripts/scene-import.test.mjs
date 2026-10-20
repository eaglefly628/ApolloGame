import { describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync, linkSync, symlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { Matrix4, Euler, Quaternion, Vector3 } from 'three';
import { bakeSceneImport, importScene } from './scene-import.mjs';
import { parseGlb } from './lib/scene-geometry.mjs';
import { parseSceneImportData, verifySceneImportBytes } from '../src/assets/scene-import-data';
import { glb, unpack, triangle } from './fixtures/scene-import/glb-fixtures.mjs';
import { realDracoVariant } from './fixtures/scene-import/draco-variant.mjs';

const here = dirname(fileURLToPath(import.meta.url)), hash = b => createHash('sha256').update(b).digest('hex');
const semantic = (data, kind = 'navigation') => data.nodes.find(n => n.kind === kind);
const canonicalTriangles = node => Array.from({ length: node.indices.length / 3 }, (_, i) => node.indices.slice(i * 3, i * 3 + 3).map(v => node.positions.slice(v * 3, v * 3 + 3).join(',')).sort().join('|')).sort();

describe('E5 real CPU geometry and strict candidate', () => {
  it('reads actual indexed bytes, ignores lying accessor bounds, and emits validator-compatible SHA-bound data', async () => {
    const f = triangle(), bytes = f.bytes(), data = await bakeSceneImport(bytes), n = semantic(data);
    expect(n.positions).toEqual([0, 0, 0, 2, 0, 0, 0, 0, 3]); expect(n.indices).toEqual([2, 0, 1]);
    expect(n.bounds).toEqual({ min: [0, 0, 0], max: [2, 0, 3] }); expect(data.sourceSha256).toBe(hash(bytes));
    expect(parseSceneImportData(data)).toEqual(data);
    const array = Uint8Array.from(bytes).buffer; expect(await verifySceneImportBytes(data, array)).toEqual(data);
    new Uint8Array(array)[array.byteLength - 1] ^= 1;
    await expect(verifySceneImportBytes(data, array)).rejects.toThrow(/SHA256 mismatch/);
  });
  it('supports byteStride, normalized signed quantized POSITION, sparse overlays, and non-indexed triangles', async () => {
    const interleaved = triangle({ stride: 20 }); expect(semantic(await bakeSceneImport(interleaved.bytes())).positions).toEqual([0, 0, 0, 2, 0, 0, 0, 0, 3]);
    const normalized = triangle({ positions: [-32768, 0, 0, 32767, 0, 0, 0, 32767, 0], componentType: 5122, stride: 8, normalized: true });
    expect(semantic(await bakeSceneImport(normalized.bytes())).positions).toEqual([-1, 0, 0, 1, 0, 0, 0, 1, 0]);
    const nonIndexed = triangle({ indexed: false }); expect(semantic(await bakeSceneImport(nonIndexed.bytes())).indices).toEqual([0, 1, 2]);
    const sparse = triangle(); sparse.json.accessors[0].sparse = { count: 1, indices: { bufferView: 2, componentType: 5121 }, values: { bufferView: 3 } };
    sparse.json.bufferViews.push({ buffer: 0, byteOffset: 44, byteLength: 1 }, { buffer: 0, byteOffset: 48, byteLength: 12 });
    const values = Buffer.alloc(16); values[0] = 1; values.writeFloatLE(7.12506, 4); values.writeFloatLE(1, 8); values.writeFloatLE(-2, 12);
    const binary = Buffer.concat([sparse.binary, Buffer.alloc(2), values]); sparse.json.buffers[0].byteLength = binary.length;
    expect(semantic(await bakeSceneImport(glb(sparse.json, binary))).positions).toEqual([0, 0, 0, 7.1251, 1, -2, 0, 0, 3]);
    delete sparse.json.accessors[0].bufferView;
    expect(semantic(await bakeSceneImport(glb(sparse.json, binary))).positions).toEqual([0, 0, 0, 7.1251, 1, -2, 0, 0, 0]);
  });
  it('bakes full parent affine matrices, scene filtering, real triangle offsets and duplicate names with original paths', async () => {
    const f = triangle(), q = new Quaternion().setFromEuler(new Euler(0.2, 0.4, -0.3)).toArray(), parent = [1, 0, 0, 0, 0.3, 2, 0, 0, 0, 0, -1, 0, 4, 5, 6, 1];
    f.json.nodes = [{ name: 'parent', matrix: parent, children: [1, 4] }, { name: 'col_group', translation: [1, 2, 3], rotation: q, children: [2, 3] }, { name: 'same', mesh: 0 }, { name: 'same', mesh: 0, translation: [3, 0, 0] }, { name: 'spawn_hero', translation: [-1, 0, 1] }, { name: 'nav_outside_without_triangles' }];
    f.json.scenes.push({ nodes: [5] });
    const data = await bakeSceneImport(f.bytes()), c = semantic(data, 'collision'); expect(data.nodes.map(n => n.index)).toEqual([0, 1, 2, 3, 4]);
    expect(data.nodes[3].path).toEqual([0, 1, 3]); expect(data.nodes.filter(n => n.name === 'same')).toHaveLength(2);
    const expected = new Matrix4().fromArray(parent).multiply(new Matrix4().compose(new Vector3(1, 2, 3), new Quaternion(...q), new Vector3(1, 1, 1)));
    expect(c.worldMatrix).toEqual(expected.toArray());
    const positions = [new Vector3(0, 0, 0), new Vector3(2, 0, 0), new Vector3(0, 0, 3)].flatMap(p => p.applyMatrix4(expected).toArray().map(v => Math.round(v * 10000) / 10000));
    expect(c.positions.slice(0, 9)).toEqual(positions); expect(c.indices).toEqual([2, 0, 1, 5, 3, 4]);
    expect(data.nodes[2].positions).toBeUndefined(); expect(semantic(data, 'spawn').positions).toBeUndefined(); expect(parseSceneImportData(data)).toEqual(data);
  });
  it('decodes real raw / Draco / meshopt / KTX2 fixture geometry identically without image decoding', async () => {
    const decoded = [];
    for (const compression of ['raw', 'draco', 'meshopt', 'ktx2']) {
      const { json, binary } = unpack(readFileSync(join(here, 'fixtures/compressed-models', `cube-${compression}.glb`)));
      json.nodes[0].name = 'pick_cube'; json.nodes[0].translation = [3, 2, -4]; json.nodes[0].scale = [2, 0.5, 3];
      const bytes = glb(json, binary.subarray(0, json.buffers[0].byteLength)), a = await bakeSceneImport(bytes), b = await bakeSceneImport(bytes), n = semantic(a, 'pick');
      expect(JSON.stringify(a)).toBe(JSON.stringify(b)); expect(parseSceneImportData(a)).toEqual(a); expect(a.sourceSha256).toBe(hash(bytes));
      expect(n.indices).toHaveLength(36); expect(n.bounds).toEqual({ min: [1, 1.5, -7], max: [5, 2.5, -1] }); decoded.push(canonicalTriangles(n));
    }
    for (const triangles of decoded.slice(1)) expect(triangles).toEqual(decoded[0]);
  });
  it('accepts untagged required-meshopt placeholder buffers and applies sparse overlays after real Draco decode', async () => {
    const m = unpack(readFileSync(join(here, 'fixtures/compressed-models/cube-meshopt.glb'))); delete m.json.buffers[1].extensions; m.json.nodes[0].name = 'nav_cube';
    expect(semantic(await bakeSceneImport(glb(m.json, m.binary))).indices).toHaveLength(36);
    const d = unpack(readFileSync(join(here, 'fixtures/compressed-models/cube-draco.glb'))); d.json.nodes[0].name = 'pick_cube';
    const start = Math.ceil(d.json.buffers[0].byteLength / 4) * 4, overlay = Buffer.alloc(16); overlay.writeFloatLE(4, 4); overlay.writeFloatLE(5, 8); overlay.writeFloatLE(6, 12);
    const iv = d.json.bufferViews.length; d.json.bufferViews.push({ buffer: 0, byteOffset: start, byteLength: 1 }, { buffer: 0, byteOffset: start + 4, byteLength: 12 });
    d.json.accessors[0].sparse = { count: 1, indices: { bufferView: iv, componentType: 5121 }, values: { bufferView: iv + 1 } };
    const binary = Buffer.concat([d.binary.subarray(0, d.json.buffers[0].byteLength), Buffer.alloc(start - d.json.buffers[0].byteLength), overlay]); d.json.buffers[0].byteLength = binary.length;
    expect(semantic(await bakeSceneImport(glb(d.json, binary)), 'pick').positions.slice(0, 3)).toEqual([4, 5, 6]);
  });
  it('owns the exact input snapshot across async decoder yields', async () => {
    const bytes = triangle().bytes(), original = hash(bytes), pending = bakeSceneImport(bytes); bytes.fill(0);
    const data = await pending; expect(data.sourceSha256).toBe(original); expect(semantic(data).positions).toEqual([0, 0, 0, 2, 0, 0, 0, 0, 3]);
  });
  it('real Draco fixture encoding preserves accessors shared by different Blender meshes', async () => {
    const f = triangle(); f.json.meshes.push(structuredClone(f.json.meshes[0])); f.json.nodes.push({ name: 'col_second', mesh: 1, translation: [4, 0, 0] }); f.json.scenes[0].nodes.push(1);
    const input = f.bytes(), raw = await bakeSceneImport(input), compressed = await bakeSceneImport(realDracoVariant(input));
    expect(compressed.nodes).toEqual(raw.nodes); expect(compressed.sourceSha256).not.toBe(raw.sourceSha256);
  });
});

describe('E5 malformed bytes and semantic ambiguity reject', () => {
  it.each([
    ['bufferView range', f => { f.json.bufferViews[0].byteLength = 9999; }, /range|exceed/],
    ['accessor stride', f => { f.json.bufferViews[0].byteStride = 8; }, /byteStride|range/],
    ['accessor alignment', f => { f.json.accessors[0].byteOffset = 2; }, /alignment/],
    ['accessor count', f => { f.json.accessors[0].count = 5; }, /range/],
    ['unbounded accessor allocation', f => { f.json.accessors[0].count = 1e12; }, /budget/],
    ['explicit null accessor offset', f => { f.json.accessors[0].byteOffset = null; }, /integer/],
    ['explicit null view offset', f => { f.json.bufferViews[0].byteOffset = null; }, /integer/],
    ['normalized float', f => { f.json.accessors[0].normalized = true; }, /normalize/],
    ['index out of range', f => { f.binary.writeUInt16LE(3, 36); }, /index.*range/],
    ['partial triangle', f => { f.json.accessors[1].count = 2; }, /multiple of 3/],
    ['nonfinite POSITION', f => { f.binary.writeFloatLE(NaN, 0); }, /finite/],
    ['non-triangle primitive', f => { f.json.meshes[0].primitives[0].mode = 1; }, /TRIANGLES/],
    ['explicit null primitive mode', f => { f.json.meshes[0].primitives[0].mode = null; }, /TRIANGLES/],
    ['missing POSITION', f => { delete f.json.meshes[0].primitives[0].attributes.POSITION; }, /accessor/],
    ['external buffer', f => { f.json.buffers[0].uri = 'https://example.invalid/b.bin'; }, /external buffer/],
    ['external image', f => { f.json.images = [{ uri: 'https://example.invalid/x.png' }]; }, /external image/],
    ['unknown required extension', f => { f.json.extensionsRequired = ['VENDOR_geometry_unknown']; f.json.extensionsUsed = [...f.json.extensionsRequired]; }, /unknown required geometry/],
    ['missing default scene', f => { delete f.json.scene; f.json.scenes.push({ nodes: [] }); }, /default scene/],
    ['explicit null scene', f => { f.json.scene = null; }, /integer/],
    ['cycle', f => { f.json.nodes[0].children = [1]; f.json.nodes.push({ children: [0] }); }, /cycle/],
    ['multi-parent', f => { f.json.nodes[0].children = [2]; f.json.nodes.push({ children: [2] }, {}); }, /multiple parents/],
    ['duplicate child', f => { f.json.nodes[0].children = [1, 1]; f.json.nodes.push({}); }, /multiple parents/],
    ['child out of range', f => { f.json.nodes[0].children = [44]; }, /out of range/],
    ['nested semantics', f => { f.json.nodes[0].children = [1]; f.json.nodes.push({ name: 'spawn_nested' }); }, /nested semantic/],
    ['spawn mesh', f => { f.json.nodes[0].name = 'spawn_bad'; }, /spawn.*no geometry/],
    ['empty collision', f => { delete f.json.nodes[0].mesh; f.json.nodes[0].name = 'col_empty'; }, /needs triangles/],
    ['empty semantic suffix', f => { f.json.nodes[0].name = 'nav_'; }, /empty semantic/],
    ['bad quaternion', f => { f.json.nodes[0].rotation = [0, 0, 0, 2]; }, /quaternion/],
    ['matrix and TRS', f => { f.json.nodes[0].matrix = new Matrix4().toArray(); f.json.nodes[0].translation = [1, 2, 3]; }, /coexist/],
    ['non-affine matrix', f => { f.json.nodes[0].matrix = new Matrix4().toArray(); f.json.nodes[0].matrix[3] = 1; }, /affine/],
    ['malformed transform', f => { f.json.nodes[0].translation = [0, 0]; }, /length/],
    ['explicit null transform', f => { f.json.nodes[0].translation = null; }, /array/],
    ['explicit null quaternion', f => { f.json.nodes[0].rotation = null; }, /array/],
    ['explicit null scale', f => { f.json.nodes[0].scale = null; }, /array/],
    ['explicit null children', f => { f.json.nodes[0].children = null; }, /array/],
    ['explicit null name', f => { f.json.nodes[0].name = null; }, /string/],
    ['world position budget', f => { f.json.nodes[0].translation = [1000001, 0, 0]; }, /world budget/],
    ['skin', f => { f.json.nodes[0].skin = 0; }, /dynamic/],
    ['morph target', f => { f.json.meshes[0].primitives[0].targets = [{ POSITION: 0 }]; }, /morph/],
    ['static morph weight', f => { f.json.meshes[0].weights = [0.5]; }, /morph/],
    ['animated node', f => { f.json.animations = [{ channels: [{ target: { node: 0, path: 'translation' } }] }]; }, /dynamic/],
    ['animated ancestor', f => { f.json.nodes.push({ children: [0] }); f.json.scenes[0].nodes = [1]; f.json.animations = [{ channels: [{ target: { node: 1, path: 'translation' } }] }]; }, /dynamic ancestor/],
    ['animated display descendant', f => { f.json.nodes[0].children = [1]; f.json.nodes.push({ name: 'display' }); f.json.animations = [{ channels: [{ target: { node: 1, path: 'translation' } }] }]; }, /dynamic/],
  ])('rejects %s', async (_name, patch, pattern) => { const f = triangle(); patch(f); await expect(bakeSceneImport(f.bytes())).rejects.toThrow(pattern); });
  it('rejects duplicate/out-of-range sparse indices and truncated sparse values', async () => {
    const f = triangle(), binary = Buffer.concat([f.binary, Buffer.alloc(2), Buffer.from([1, 1, 0, 0]), Buffer.alloc(24)]);
    f.json.buffers[0].byteLength = binary.length; f.json.bufferViews.push({ buffer: 0, byteOffset: 44, byteLength: 2 }, { buffer: 0, byteOffset: 48, byteLength: 24 });
    f.json.accessors[0].sparse = { count: 2, indices: { bufferView: 2, componentType: 5121 }, values: { bufferView: 3 } };
    await expect(bakeSceneImport(glb(f.json, binary))).rejects.toThrow(/strictly increasing/);
    binary[45] = 3; await expect(bakeSceneImport(glb(f.json, binary))).rejects.toThrow(/in range/);
    binary[45] = 2; f.json.bufferViews[3].byteLength = 12; await expect(bakeSceneImport(glb(f.json, binary))).rejects.toThrow(/range/);
  });
  it('rejects corrupted compressed data and mismatched decoded lengths', async () => {
    for (const kind of ['draco', 'meshopt']) {
      const original = readFileSync(join(here, 'fixtures/compressed-models', `cube-${kind}.glb`)), { json, binary } = unpack(original); json.nodes[0].name = 'nav_bad';
      const corrupt = Buffer.from(binary); corrupt.fill(0, 0, kind === 'draco' ? 207 : 104);
      await expect(bakeSceneImport(glb(json, corrupt))).rejects.toThrow(/Draco|meshopt/);
      json.accessors[0].count = 25; await expect(bakeSceneImport(glb(json, binary))).rejects.toThrow(/count|range/);
    }
  });
  it('rejects malformed meshopt mode/stride/filter/length and Draco component metadata', async () => {
    for (const [field, value, pattern] of [['mode', 'UNKNOWN', /mode/], ['byteStride', 8, /stride/], ['filter', null, /filter/], ['filter', 'QUATERNION', /stride/], ['count', 25, /byteLength/], ['byteOffset', -1, /integer/]]) {
      const { json, binary } = unpack(readFileSync(join(here, 'fixtures/compressed-models/cube-meshopt.glb'))); json.nodes[0].name = 'nav_cube'; json.bufferViews[0].extensions.EXT_meshopt_compression[field] = value;
      await expect(bakeSceneImport(glb(json, binary))).rejects.toThrow(pattern);
    }
    const { json, binary } = unpack(readFileSync(join(here, 'fixtures/compressed-models/cube-draco.glb'))); json.nodes[0].name = 'nav_cube'; json.accessors[0].componentType = 5122; json.extensionsUsed.push('KHR_mesh_quantization'); json.extensionsRequired.push('KHR_mesh_quantization');
    await expect(bakeSceneImport(glb(json, binary))).rejects.toThrow(/componentType mismatch/);
  });
  it('rejects GLB truncation, wrong total length, and illegal chunk bounds', () => {
    const bytes = triangle().bytes(); expect(() => parseGlb(bytes.subarray(0, -1))).toThrow(/header/);
    const wrong = Buffer.from(bytes); wrong.writeUInt32LE(bytes.length * 2, 12); expect(() => parseGlb(wrong)).toThrow(/chunk/);
    const trailing = Buffer.concat([bytes, Buffer.from([0])]); trailing.writeUInt32LE(trailing.length, 8); expect(() => parseGlb(trailing)).toThrow(/chunk/);
  });
});

describe('E5 candidate-only filesystem boundary', () => {
  it('writes only the requested JSON, is deterministic, and keeps an old candidate intact on rejection', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'apollo-scene-import-test-'));
    try {
      const input = join(dir, 'final.glb'), out = join(dir, 'out/scene.json'), bytes = triangle().bytes(); writeFileSync(input, bytes);
      const a = await importScene(input, { out }), text = readFileSync(out, 'utf8'); expect(JSON.parse(text)).toEqual(a);
      await importScene(input, { out }); expect(readFileSync(out, 'utf8')).toBe(text); expect(readFileSync(input)).toEqual(bytes);
      expect(existsSync(join(dir, 'index.json'))).toBe(false); await expect(importScene(input, { out: input })).rejects.toThrow(/overwrite/);
      const alias = join(dir, 'hardlink.json'), symlink = join(dir, 'symlink.json'); linkSync(input, alias); symlinkSync(input, symlink);
      await expect(importScene(input, { out: alias })).rejects.toThrow(/overwrite/); await expect(importScene(input, { out: symlink })).rejects.toThrow(/overwrite/); expect(readFileSync(input)).toEqual(bytes);
      writeFileSync(input, 'bad'); await expect(importScene(input, { out })).rejects.toThrow(); expect(readFileSync(out, 'utf8')).toBe(text);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it('CLI accepts the fixed input/output shape and refuses mock/extra options', () => {
    const dir = mkdtempSync(join(tmpdir(), 'apollo-scene-import-cli-'));
    try {
      const input = join(dir, 'scene.glb'), out = join(dir, 'scene.json'); writeFileSync(input, triangle().bytes());
      const run = args => spawnSync(process.execPath, [join(here, 'scene-import.mjs'), ...args], { encoding: 'utf8' });
      const ok = run([input, '--out', out]); expect(ok.status, ok.stderr).toBe(0); expect(JSON.parse(ok.stdout).sourceSha256).toBe(hash(readFileSync(input)));
      for (const args of [[input], [input, '--out', out, '--mock'], [input, '--unknown', out]]) { const bad = run(args); expect(bad.status).toBe(1); expect(bad.stderr).toMatch(/Usage:/); }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
