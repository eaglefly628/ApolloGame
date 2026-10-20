// Integration fixture encoder, not a production normalization or asset-approval API.
// Keeps the real Blender scene hierarchy and encodes its FLOAT32 attributes using
// the fixed Draco encoder already bundled in three. No downloads or mock bytes.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import vm from 'node:vm';
import { glb, unpack } from './glb-fixtures.mjs';

export function realDracoVariant(input) {
  const { json, binary: padded } = unpack(input), require = createRequire(import.meta.url), path = require.resolve('three/examples/jsm/libs/draco/gltf/draco_encoder.js');
  const sandbox = { module: { exports: {} }, exports: {}, require, console, process, Buffer, WebAssembly, TextDecoder, TextEncoder, setTimeout, clearTimeout, __filename: path, __dirname: dirname(path) };
  vm.runInNewContext(readFileSync(path, 'utf8'), sandbox, { filename: 'local-e5-fixture-draco-encoder.cjs' });
  const d = sandbox.module.exports(), blobs = [padded.subarray(0, json.buffers[0].byteLength)], encodedAccessors = new Set(); let offset = blobs[0].length;
  function values(index) {
    const a = json.accessors[index], b = json.bufferViews[a.bufferView], width = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
    assert(width && !a.sparse && !a.normalized, 'fixture encoder only supports dense raw values');
    const bytes = { 5126: 4, 5125: 4, 5123: 2, 5121: 1 }[a.componentType]; assert(bytes, 'fixture encoder componentType unsupported');
    const getter = { 5126: 'readFloatLE', 5125: 'readUInt32LE', 5123: 'readUInt16LE', 5121: 'readUInt8' }[a.componentType], start = (b.byteOffset || 0) + (a.byteOffset || 0), stride = b.byteStride || bytes * width;
    return Array.from({ length: a.count * width }, (_, i) => padded[getter](start + Math.floor(i / width) * stride + i % width * bytes));
  }
  function chunk(bytes) {
    const pad = Buffer.alloc((4 - offset % 4) % 4); blobs.push(pad); offset += pad.length;
    const index = json.bufferViews.length; json.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length }); blobs.push(bytes); offset += bytes.length; return index;
  }
  for (const mesh of json.meshes) for (const p of mesh.primitives) {
    assert((p.mode ?? 4) === 4 && p.indices !== undefined && !p.targets, 'fixture encoder expects indexed static triangles');
    const encodedMesh = new d.Mesh(), builder = new d.MeshBuilder(), encoder = new d.Encoder(), data = new d.DracoInt8Array();
    try {
      const attributes = {};
      for (const [name, index] of Object.entries(p.attributes)) {
        const a = json.accessors[index], width = { VEC2: 2, VEC3: 3, VEC4: 4 }[a.type]; assert(a.componentType === 5126 && width, 'fixture encoder expects float attributes');
        const kind = { POSITION: d.POSITION, NORMAL: d.NORMAL, TEXCOORD_0: d.TEX_COORD, COLOR_0: d.COLOR }[name] ?? d.GENERIC;
        attributes[name] = builder.AddFloatAttributeToMesh(encodedMesh, kind, a.count, width, Float32Array.from(values(index)));
        // Disable quantization so the final candidate's 1e-4 world coordinates
        // agree with the original real Blender geometry, including its parents.
        encoder.SetAttributeQuantization(kind, 0);
      }
      const indices = values(p.indices); builder.AddFacesToMesh(encodedMesh, indices.length / 3, Uint32Array.from(indices));
      encoder.SetEncodingMethod(d.MESH_SEQUENTIAL_ENCODING); const length = encoder.EncodeMeshToDracoBuffer(encodedMesh, data); assert(length > 0, 'real Draco encoder failed');
      const bytes = Buffer.alloc(length); for (let i = 0; i < length; i++) bytes[i] = data.GetValue(i);
      p.extensions = { ...p.extensions, KHR_draco_mesh_compression: { bufferView: chunk(bytes), attributes } };
      for (const index of [...Object.values(p.attributes), p.indices]) encodedAccessors.add(index);
    } finally { for (const item of [data, encoder, builder, encodedMesh]) d.destroy(item); }
  }
  // Blender may share NORMAL or index accessors between distinct meshes. Keep
  // every raw source intact until all compressed primitives have consumed it.
  for (const index of encodedAccessors) { delete json.accessors[index].bufferView; delete json.accessors[index].byteOffset; }
  json.extensionsUsed = [...new Set([...(json.extensionsUsed || []), 'KHR_draco_mesh_compression'])];
  json.extensionsRequired = [...new Set([...(json.extensionsRequired || []), 'KHR_draco_mesh_compression'])];
  json.buffers = [{ byteLength: offset }]; return glb(json, Buffer.concat(blobs));
}
function assert(condition, message) { if (!condition) throw new Error(message); }
