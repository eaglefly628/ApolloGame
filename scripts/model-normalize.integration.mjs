// Real offline T4 acceptance, never skipped or replaced by mock:
// BLENDER_BIN=<pinned 4.5 LTS> node scripts/model-normalize.integration.mjs
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { Euler, Matrix3, Matrix4, Quaternion, Vector3 } from 'three';
import { normalizeModel, normalizedEntry } from './model-normalize.mjs';
import { encodePng } from './ai-gen.mjs';

if (!process.env.BLENDER_BIN) throw new Error('请设置固定 Blender 4.5 LTS 的 BLENDER_BIN；真实 T4 验收不能跳过或以 mock 替代');
const DEFAULT_SAMPLER = { wrapS: 10497, wrapT: 10497, magFilter: 9729, minFilter: 9987 };
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'apollo-normalize-real-'));
const close = (actual, expected, label, epsilon = 0.002) => assert(Math.abs(actual - expected) < epsilon, `${label}: ${actual} != ${expected}`);
const save = (file, value) => { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, typeof value === 'object' && !Buffer.isBuffer(value) ? JSON.stringify(value) : value); return file; };
function makeGlb(json, binary) {
  const raw = Buffer.from(JSON.stringify(json)), j = Buffer.concat([raw, Buffer.alloc((4 - raw.length % 4) % 4, 32)]);
  const bin = Buffer.concat([binary, Buffer.alloc((4 - binary.length % 4) % 4)]);
  const b = Buffer.alloc(28 + j.length + bin.length); b.write('glTF'); b.writeUInt32LE(2, 4); b.writeUInt32LE(b.length, 8);
  b.writeUInt32LE(j.length, 12); b.writeUInt32LE(0x4e4f534a, 16); j.copy(b, 20);
  b.writeUInt32LE(bin.length, 20 + j.length); b.writeUInt32LE(0x004e4942, 24 + j.length); bin.copy(b, 28 + j.length); return b;
}
function readGlb(file) {
  const bytes = readFileSync(file); assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  const length = bytes.readUInt32LE(12), json = JSON.parse(bytes.toString('utf8', 20, 20 + length));
  assert.equal(bytes.readUInt32LE(24 + length), 0x004e4942, 'real geometry must include a BIN chunk');
  return { bytes, json, binary: bytes.subarray(28 + length) };
}
// Build independent, self-contained raw glTF fixtures. Every fixture deliberately
// carries translation + nonuniform object scale, so local-space-only code fails.
function fixture(name, positions, indices, sourceUp, texture = false, special = null) {
  const blobs = [], bufferViews = [], accessors = []; let offset = 0;
  function chunk(bytes) {
    const pad = Buffer.alloc((4 - offset % 4) % 4); blobs.push(pad); offset += pad.length;
    const index = bufferViews.length; bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length }); blobs.push(bytes); offset += bytes.length; return index;
  }
  const vector = Buffer.alloc(positions.length * 4); positions.forEach((x, i) => vector.writeFloatLE(x, i * 4));
  const posView = chunk(vector), min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  positions.forEach((x, i) => { min[i % 3] = Math.min(min[i % 3], x); max[i % 3] = Math.max(max[i % 3], x); });
  accessors.push({ bufferView: posView, componentType: 5126, count: positions.length / 3, type: 'VEC3', min, max });
  const idx = Buffer.alloc(indices.length * 2); indices.forEach((x, i) => idx.writeUInt16LE(x, i * 2));
  accessors.push({ bufferView: chunk(idx), componentType: 5123, count: indices.length, type: 'SCALAR' });
  const primitive = { attributes: { POSITION: 0 }, indices: 1, mode: 4 };
  const doc = { asset: { version: '2.0', generator: 'Apollo explicit offline simulated fixture' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ name, mesh: 0, translation: [9, -4, 13], scale: [1.5, 0.75, 2] }], meshes: [{ primitives: [primitive] }], bufferViews, accessors };
  if (texture) {
    const uv = Buffer.alloc(positions.length / 3 * 2 * 4);
    for (let i = 0; i < positions.length / 3; i++) { uv.writeFloatLE(i % 2, i * 8); uv.writeFloatLE(Math.floor(i / 2) % 2, i * 8 + 4); }
    accessors.push({ bufferView: chunk(uv), componentType: 5126, count: positions.length / 3, type: 'VEC2' }); primitive.attributes.TEXCOORD_0 = 2;
    const pixels = Buffer.alloc(3072 * 768 * 3);
    for (let i = 0; i < pixels.length; i += 3) { pixels[i] = (i / 3) % 251; pixels[i + 1] = 90; pixels[i + 2] = 180; }
    const image = chunk(encodePng(3072, 768, pixels));
    doc.images = [{ name: 'oversize_diffuse', bufferView: image, mimeType: 'image/png' }]; doc.textures = [{ source: 0, sampler: 0 }]; doc.samplers = [{ ...DEFAULT_SAMPLER }];
    doc.materials = [{ name: 'preserved_diffuse', pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 0.8 } }]; primitive.material = 0;
  }
  if (special === 'authored-normals') {
    const normal = new Vector3(0.3, 0.8, 0.5).normalize(), values = Buffer.alloc(positions.length * 4);
    for (let i = 0; i < positions.length / 3; i++) normal.toArray().forEach((value, axis) => values.writeFloatLE(value, i * 12 + axis * 4));
    primitive.attributes.NORMAL = accessors.length;
    accessors.push({ bufferView: chunk(values), componentType: 5126, count: positions.length / 3, type: 'VEC3' });
    const rotation = new Quaternion().setFromEuler(new Euler(0.2, -0.4, 0.7));
    doc.nodes = [{ name: 'rotated_nonuniform_parent', translation: [4,-3,9], rotation: rotation.toArray(), scale: [1.2,0.8,1.1], children: [1] }, { name, mesh: 0, translation: [-2,4,1], scale: [-2,3,0.5] }];
  }
  if (special === 'animation') {
    const time = Buffer.alloc(8); time.writeFloatLE(0, 0); time.writeFloatLE(1, 4);
    const input = accessors.length; accessors.push({ bufferView: chunk(time), componentType: 5126, count: 2, type: 'SCALAR', min: [0], max: [1] });
    const translations = Buffer.alloc(24); [9,-4,13,10,-4,13].forEach((x,i) => translations.writeFloatLE(x, i*4));
    const output = accessors.length; accessors.push({ bufferView: chunk(translations), componentType: 5126, count: 2, type: 'VEC3' });
    doc.animations = [{ samplers: [{ input, output, interpolation: 'LINEAR' }], channels: [{ sampler: 0, target: { node: 0, path: 'translation' } }] }];
  }
  if (special === 'lines') {
    const lineIndices = Buffer.alloc(4); lineIndices.writeUInt16LE(0, 0); lineIndices.writeUInt16LE(2, 2);
    const lineAccessor = accessors.length;
    accessors.push({ bufferView: chunk(lineIndices), componentType: 5123, count: 2, type: 'SCALAR' });
    doc.meshes[0].primitives.push({ mode: 1, attributes: { POSITION: 0 }, indices: lineAccessor });
  }
  if (special === 'morph') {
    const deltas = Buffer.alloc(positions.length * 4);
    // A nonzero static weight changes the top vertex without any animation clip.
    deltas.writeFloatLE(2, (positions.length - 2) * 4);
    primitive.targets = [{ POSITION: accessors.length }];
    accessors.push({ bufferView: chunk(deltas), componentType: 5126, count: positions.length / 3, type: 'VEC3', min: [0,0,0], max: [0,2,0] });
    doc.meshes[0].weights = [0.5]; doc.meshes[0].extras = { targetNames: ['static_height'] };
  }
  if (special === 'skin') {
    doc.nodes.push({ name: 'fixture_joint' }); doc.nodes[0].skin = 0; doc.scenes[0].nodes.push(1); doc.skins = [{ joints: [1] }];
    const joints = Buffer.alloc(positions.length / 3 * 4 * 2), weights = Buffer.alloc(positions.length / 3 * 4 * 4);
    for(let i=0;i<positions.length/3;i++)weights.writeFloatLE(1,i*16);
    primitive.attributes.JOINTS_0 = accessors.length; accessors.push({ bufferView: chunk(joints), componentType: 5123, count: positions.length/3, type:'VEC4' });
    primitive.attributes.WEIGHTS_0 = accessors.length; accessors.push({ bufferView: chunk(weights), componentType: 5126, count: positions.length/3, type:'VEC4' });
  }
  doc.buffers = [{ byteLength: offset }];
  const file = save(join(dir, `${name}.glb`), makeGlb(doc, Buffer.concat(blobs)));
  const sourceSize = max.map((x, i) => (x - min[i]) * [1.5, 0.75, 2][i]);
  const mapped = sourceUp === 'Z' ? [sourceSize[0], sourceSize[2], sourceSize[1]] : sourceSize;
  return { name, file, sourceUp, triangles: indices.length / 3, mapped, texture };
}
async function decoder() {
  const library = join(root, 'node_modules/three/examples/jsm/libs/draco/gltf');
  const sandbox = { module: { exports: {} }, exports: {}, require: createRequire(import.meta.url), process, Buffer, console, WebAssembly, TextDecoder, TextEncoder, setTimeout, clearTimeout, __filename: join(library, 'draco_wasm_wrapper.js'), __dirname: library };
  vm.runInNewContext(readFileSync(join(library, 'draco_wasm_wrapper.js'), 'utf8'), sandbox, { filename: 'local-draco-decoder.cjs' });
  return await sandbox.module.exports({ wasmBinary: readFileSync(join(library, 'draco_decoder.wasm')) });
}
function decodeGeometry(d, parsed, { includeNormals = false } = {}) {
  const { json, binary } = parsed; const points = [], normals = []; let triangles = 0, primitives = 0;
  const hierarchy = new Map(); for (const [index, node] of (json.nodes || []).entries()) for (const child of node.children || []) hierarchy.set(child, index);
  const local = node => node.matrix ? new Matrix4().fromArray(node.matrix) : new Matrix4().compose(new Vector3(...(node.translation || [0, 0, 0])), new Quaternion(...(node.rotation || [0, 0, 0, 1])), new Vector3(...(node.scale || [1, 1, 1])));
  function world(index) { const matrix = local(json.nodes[index]); const parent = hierarchy.get(index); return parent === undefined ? matrix : world(parent).multiply(matrix); }
  for (const [nodeIndex, node] of json.nodes.entries()) {
    if (node.mesh === undefined) continue;
    const transform = world(nodeIndex);
    // Placement, rotation and units must all be baked into vertices, including parent transforms.
    const identity = new Matrix4().elements;
    local(node).elements.forEach((value, index) => close(value, identity[index], 'local transform baked into mesh', 1e-6));
    transform.elements.forEach((value, index) => close(value, identity[index], 'world transform baked into mesh', 1e-6));
    for (const primitive of json.meshes[node.mesh].primitives) {
      primitives++; assert.equal(primitive.mode ?? 4, 4); const ext = primitive.extensions?.KHR_draco_mesh_compression;
      assert(ext, 'every real primitive must actually contain Draco');
      const bv = json.bufferViews[ext.bufferView]; const encoded = binary.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
      const buffer = new d.DecoderBuffer(); const worker = new d.Decoder(); const mesh = new d.Mesh();
      try {
        buffer.Init(new Int8Array(encoded), encoded.length); const status = worker.DecodeBufferToMesh(buffer, mesh);
        assert(status.ok(), `local Draco decode failed: ${status.error_msg()}`); assert(mesh.num_points() > 0, 'Draco must decode real points');
        const attribute = worker.GetAttributeByUniqueId(mesh, ext.attributes.POSITION); assert(attribute && attribute.ptr, 'decoded POSITION missing');
        const values = new d.DracoFloat32Array();
        try {
          assert(worker.GetAttributeFloatForAllPoints(mesh, attribute, values));
          for (let i = 0; i < mesh.num_points(); i++) points.push(new Vector3(values.GetValue(i * 3), values.GetValue(i * 3 + 1), values.GetValue(i * 3 + 2)).applyMatrix4(transform).toArray());
        } finally { d.destroy(values); }
        if (includeNormals) {
          assert(Number.isInteger(ext.attributes.NORMAL), 'authored NORMAL must be present in actual Draco attributes');
          const normalAttribute = worker.GetAttributeByUniqueId(mesh, ext.attributes.NORMAL), values = new d.DracoFloat32Array();
          assert(normalAttribute && normalAttribute.ptr, 'authored NORMAL must decode');
          try {
            assert(worker.GetAttributeFloatForAllPoints(mesh, normalAttribute, values));
            for (let i = 0; i < mesh.num_points(); i++) {
              const normal = new Vector3(values.GetValue(i * 3), values.GetValue(i * 3 + 1), values.GetValue(i * 3 + 2));
              close(normal.length(), 1, 'decoded authored normal remains unit length');
              normals.push(normal.applyMatrix3(new Matrix3().getNormalMatrix(transform)).normalize().toArray());
            }
          } finally { d.destroy(values); }
        }
        const face = new d.DracoInt32Array();
        try { for (let i = 0; i < mesh.num_faces(); i++) { assert(worker.GetFaceFromMesh(mesh, i, face)); for (let k = 0; k < 3; k++) assert(face.GetValue(k) >= 0 && face.GetValue(k) < mesh.num_points()); } } finally { d.destroy(face); }
        triangles += mesh.num_faces();
      } finally { d.destroy(mesh); d.destroy(worker); d.destroy(buffer); }
    }
  }
  assert(primitives > 0); const min = [0, 1, 2].map(i => Math.min(...points.map(p => p[i]))), max = [0, 1, 2].map(i => Math.max(...points.map(p => p[i])));
  return { min, max, triangles, vertices: points.length, ...(includeNormals ? { normals } : {}), levelsY: [...new Set(points.map(p => Math.round(p[1] * 10000) / 10000))].sort((a,b)=>a-b) };
}
try {
  const d = await decoder();
  const cube = fixture('transformed_box', [-1,-2,-0.5, 1,-2,-0.5, 1,2,-0.5, -1,2,-0.5, -1,-2,0.5, 1,-2,0.5, 1,2,0.5, -1,2,0.5], [0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5], 'Y', true);
  const tetra = fixture('asymmetric_tetrahedron', [-1,0,-1, 2,0,-1, 0,0,2, 0,4,0], [0,2,1,0,1,3,1,2,3,2,0,3], 'Y');
  const octa = fixture('z_up_octahedron', [2,0,0,-2,0,0,0,3,0,0,-3,0,0,0,2,0,0,-1], [0,2,4,2,1,4,1,3,4,3,0,4,2,0,5,1,2,5,3,1,5,0,3,5], 'Z');
  const authored = fixture('authored_normals_hierarchy', [-1,0,-1, 2,0,-1, 0,0,2, 0,4,0], [0,2,1,0,1,3,1,2,3,2,0,3], 'Z', false, 'authored-normals');
  const authoredInput = readGlb(authored.file);
  const composeInput = node => new Matrix4().compose(new Vector3(...node.translation), new Quaternion(...(node.rotation || [0,0,0,1])), new Vector3(...node.scale));
  const inputWorld = composeInput(authoredInput.json.nodes[0]).multiply(composeInput(authoredInput.json.nodes[1]));
  assert(inputWorld.determinant() < 0, 'authored normal fixture must include a reflected nonuniform world transform');
  const authoredNormal = new Vector3(0.3,0.8,0.5).normalize();
  const expectedNormal = authoredNormal.clone().applyMatrix3(new Matrix3().getNormalMatrix(inputWorld)).normalize();
  expectedNormal.set(expectedNormal.x, expectedNormal.z, -expectedNormal.y); // Explicit source Z-up to final +Y.
  const authoredJob = { op: 'normalize', inputs: [`${authored.name}.glb`], params: { sourceUp: 'Z', targetHeightMeters: 2.3, maxTris: 20, maxTextureSize: 2048 }, outputs: [`out/${authored.name}.glb`, `out/${authored.name}.json`] };
  const authoredReport = normalizeModel(save(join(dir, `${authored.name}.json`), authoredJob));
  const authoredGeometry = decodeGeometry(d, readGlb(authoredReport.outputs[0].path), { includeNormals: true });
  assert.equal(authoredGeometry.triangles, 4); assert(authoredGeometry.normals.length >= 4);
  const dots = authoredGeometry.normals.map(normal => new Vector3(...normal).dot(expectedNormal));
  save(join(dir, 'authored-normal-measurements.json'), { expected: expectedNormal.toArray(), normals: authoredGeometry.normals, dots });
  assert(dots.every(dot => dot >= 0.999), `authored NORMAL must survive inverse-transpose world bake, not be replaced by face normals; measured dots=${JSON.stringify(dots)}`);
  assert(authoredGeometry.normals.every(normal => new Vector3(...normal).dot(new Vector3(...authoredGeometry.normals[0])) >= 0.999), 'the common authored normal must stay common across every decoded vertex');
  const summaries = [];
  for (const f of [cube, tetra, octa]) {
    const height = 2.4;
    const job = { op: 'normalize', inputs: [`${f.name}.glb`], params: { sourceUp: f.sourceUp, targetHeightMeters: height, maxTris: 30000, maxTextureSize: 2048 }, outputs: [`out/${f.name}.glb`, `out/${f.name}.json`] };
    const jobPath = save(join(dir, `${f.name}.json`), job);
    const a = normalizeModel(jobPath), b = normalizeModel(jobPath);
    assert.equal(a.mock, false); assert.equal(a.jobHash, b.jobHash); assert.notEqual(a.evidenceDir, b.evidenceDir);
    assert.deepEqual(a.outputs.map(o => o.sha256), b.outputs.map(o => o.sha256), 'identical job must reproduce both GLB and metadata byte hashes');
    const parsed = readGlb(a.outputs[0].path), geometry = decodeGeometry(d, parsed);
    assert.equal(geometry.triangles, f.triangles, 'normalization must preserve geometry, not silently decimate');
    assert.equal(a.spec.tris, geometry.triangles); assert.equal(a.spec.bytes, parsed.bytes.length);
    assert(geometry.triangles <= job.params.maxTris); close(geometry.min[1], 0, 'decoded bottom Y');
    close((geometry.min[0] + geometry.max[0]) / 2, 0, 'decoded center X'); close((geometry.min[2] + geometry.max[2]) / 2, 0, 'decoded center Z');
    for (let axis = 0; axis < 3; axis++) {
      close(geometry.max[axis] - geometry.min[axis], f.mapped[axis] / f.mapped[1] * height, `decoded axis ${axis} after explicit ${f.sourceUp}-up mapping`);
      close(a.normalization.bounds[0][axis], geometry.min[axis], 'metadata bounds min agrees with decoded geometry'); close(a.normalization.bounds[1][axis], geometry.max[axis], 'metadata bounds max agrees with decoded geometry');
    }
    if (f.sourceUp === 'Z') assert(geometry.levelsY.some(y => Math.abs(y - 0.8) < 0.002), 'source +Z must map to +Y, not upside down');
    close(geometry.max[1], height, 'decoded meter height'); assert.equal(a.normalization.compression, 'draco');
    assert.equal(a.spec.scale, 1); assert.equal(a.spec.up, 'Y'); assert.equal(a.spec.pivot, 'bottom-center');
    if (f.texture) {
      const inputSamplers = readGlb(f.file).json.samplers;
      assert.deepEqual(inputSamplers, [DEFAULT_SAMPLER], 'real successful fixture must exercise all explicit supported sampler defaults');
      for (const sampler of parsed.json.samplers || []) for (const [field, value] of Object.entries(DEFAULT_SAMPLER)) assert.equal(sampler[field] ?? value, value, `output must preserve supported sampler ${field}`);
      const material = parsed.json.materials.find(m => m.pbrMetallicRoughness?.baseColorTexture); assert(material, 'diffuse texture material must survive');
      const tex = parsed.json.textures[material.pbrMetallicRoughness.baseColorTexture.index]; const image = parsed.json.images[tex.source];
      assert.equal(image.uri, undefined, 'output texture must stay self-contained'); const view = parsed.json.bufferViews[image.bufferView];
      const png = parsed.binary.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
      assert.equal(png.subarray(1, 4).toString(), 'PNG'); const width = png.readUInt32BE(16), h = png.readUInt32BE(20);
      assert(width <= 2048 && h <= 2048, 'embedded texture really resized'); assert.equal(width, 2048); assert.equal(h, 512, 'texture aspect ratio preserved');
      assert(a.normalization.textureSizes.some(t => t.width === width && t.height === h), 'reported texture sizes agree with actual embedded PNG');
    }
    const entry = normalizedEntry({ id: `fixture/${f.name}`, type: 'mesh', path: '/raw.glb', license: 'CC0', source: 'offline simulated fixture', provenance: { mock: true } }, a, `/art/${f.name}.glb`);
    assert.equal(entry.provenance.mock, true, 'real execution must not erase simulated input provenance');
    summaries.push({ name: f.name, sourceUp: f.sourceUp, sha256: a.outputs[0].sha256, geometry });
  }
  const budget = { op: 'normalize', inputs: [`${cube.name}.glb`], params: { sourceUp: 'Y', targetHeightMeters: 1.8, maxTris: 1, maxTextureSize: 2048 }, outputs: ['out/rejected.glb', 'out/rejected.json'] };
  assert.throws(() => normalizeModel(save(join(dir, 'over-budget.json'), budget)), e => {
    assert.match(e.message, /Blender退出码/); assert(e.logPath); assert.match(readFileSync(e.logPath, 'utf8'), /triang|预算|maxTris/i); return true;
  }, 'real worker must explicitly reject excess triangles'); assert(!existsSync(join(dir, 'out/rejected.glb')));
  for (const special of ['animation', 'skin', 'morph', 'lines']) {
    const f = fixture(`rejected_${special}`, [-1,0,-1, 2,0,-1, 0,0,2, 0,4,0], [0,2,1,0,1,3,1,2,3,2,0,3], 'Y', false, special);
    if (special === 'lines') {
      const parsed = readGlb(f.file), input = parsed.json;
      assert(!input.animations?.length && !input.skins?.length, 'mixed topology must reach its own guard, not animation/armature rejection');
      assert(input.meshes.every(mesh => !mesh.weights?.length && mesh.primitives.every(p => !p.targets?.length)), 'mixed topology must not hide behind morph rejection');
      assert.deepEqual(input.meshes[0].primitives.map(p => p.mode ?? 4), [4, 1], 'fixture must contain both TRIANGLES and LINES primitives');
      const line = input.meshes[0].primitives[1], triangles = input.meshes[0].primitives[0];
      assert.equal(line.attributes.POSITION, triangles.attributes.POSITION, 'line must share real mesh positions');
      const accessor = input.accessors[line.indices], view = input.bufferViews[accessor.bufferView], start = (view.byteOffset || 0) + (accessor.byteOffset || 0);
      assert.equal(accessor.componentType, 5123); assert.equal(accessor.count, 2); assert.equal(accessor.type, 'SCALAR');
      assert.deepEqual([parsed.binary.readUInt16LE(start), parsed.binary.readUInt16LE(start + 2)], [0, 2], 'line indices must really address two existing vertices');
      assert(input.accessors[line.attributes.POSITION].count > 2);
    }
    if (special === 'morph') {
      const input = readGlb(f.file).json;
      assert(!input.animations?.length && !input.skins?.length, 'static morph must reach its own guard, not an animation/armature rejection');
      assert.equal(input.meshes[0].primitives[0].targets.length, 1, 'fixture must contain a real morph target accessor');
      assert.equal(input.meshes[0].weights[0], 0.5, 'fixture must contain a nonzero static morph weight');
      const target = input.accessors[input.meshes[0].primitives[0].targets[0].POSITION];
      assert.equal(target.count, 4); assert.equal(target.max[1], 2, 'target must actually deform geometry');
    }
    const data = structuredClone(budget); data.inputs = [`${f.name}.glb`]; data.params.maxTris = 30000; data.outputs = [`out/${f.name}.glb`, `out/${f.name}.json`];
    assert.throws(() => normalizeModel(save(join(dir, `${f.name}.json`), data)), e => {
      assert.match(e.message, /Blender退出码/); assert.match(readFileSync(e.logPath, 'utf8'), special === 'morph' ? /rejects morph targets\/shape keys.*static weights/ : special === 'lines' ? /rejects unsupported topology: primitive mode=1.*TRIANGLES.*mode=4/ : /rejects armature\/animation input.*T5/); return true;
    }, `real ${special} input must reject explicitly before data is discarded`); assert(!existsSync(join(dir, data.outputs[0]))); assert(!existsSync(join(dir, data.outputs[1])));
  }
  const samplerSource = readGlb(cube.file);
  assert(!samplerSource.json.animations?.length && !samplerSource.json.skins?.length);
  assert(samplerSource.json.meshes.every(mesh => !mesh.weights?.length && mesh.primitives.every(p => !p.targets?.length && (p.mode ?? 4) === 4)), 'sampler rejection fixture must be static triangle geometry without competing guards');
  for (const [name, patch, field] of [
    ['clamp_wrap_s', { wrapS: 33071 }, 'wrapS'],
    ['mirror_wrap_t', { wrapT: 33648 }, 'wrapT'],
    ['nearest_mag', { magFilter: 9728 }, 'magFilter'],
    ['linear_min', { minFilter: 9729 }, 'minFilter'],
    ['wrong_type', { wrapS: '10497' }, 'wrapS'],
  ]) {
    const input = structuredClone(samplerSource.json); Object.assign(input.samplers[0], patch);
    const nameBase = `rejected_sampler_${name}`;
    save(join(dir, `${nameBase}.glb`), makeGlb(input, samplerSource.binary));
    assert.equal(input.textures[0].sampler, 0, 'unsupported sampler must be used by a real texture');
    const data = structuredClone(budget); data.inputs = [`${nameBase}.glb`]; data.params.maxTris = 30000; data.outputs = [`out/${nameBase}.glb`, `out/${nameBase}.json`];
    assert.throws(() => normalizeModel(save(join(dir, `${nameBase}.json`), data)), e => {
      assert.match(e.message, /Blender退出码/); const log = readFileSync(e.logPath, 'utf8');
      assert.match(log, /rejects unsupported sampler: input samplers\[0\]/); assert(log.includes(`.${field}=`), `sampler rejection must identify the exact field ${field}`); return true;
    }, `real sampler ${name} must reject before Blender silently changes its semantics`);
    for (const output of data.outputs) assert(!existsSync(join(dir, output)));
  }
  const badAxis = structuredClone(budget); badAxis.params.sourceUp = 'auto'; badAxis.params.maxTris = 30000;
  assert.throws(() => normalizeModel(save(join(dir, 'bad-axis.json'), badAxis)), /sourceUp|Y.*Z|源轴/);
  assert.throws(() => normalizeModel(join(dir, `${cube.name}.json`), { blender: join(dir, 'missing-Blender') }), /找不到Blender|Blender.*--mock/);
  console.log(JSON.stringify({ ok: true, fixtureOrigin: 'offline simulated models; not real Tripo samples', summaries, artifactDir: dir }));
  console.log('T4-REAL: three distinct fixtures decoded with local Draco; meter height, explicit Y/Z up, baked transforms, bottom-center pivot, texture resize, triangle budget and deterministic double runs checked');
} finally {
  if (process.env.BLENDER_KEEP_EVIDENCE === '1') console.error(`[model-normalize-real] evidence retained: ${dir}`);
  else rmSync(dir, { recursive: true, force: true });
}
