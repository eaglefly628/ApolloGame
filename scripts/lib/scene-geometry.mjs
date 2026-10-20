// CPU-only glTF geometry reader. No GLTFLoader, DOM, image codecs, fetch or GPU.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const own = (x, k) => Object.prototype.hasOwnProperty.call(x, k);
const optional = (value, fallback) => value === undefined ? fallback : value;
const fail = message => { throw new Error(`Scene import reject: ${message}`); };
const object = (x, label) => { if (!x || typeof x !== 'object' || Array.isArray(x)) fail(`${label} must be an object`); return x; };
const array = (x, label) => { if (!Array.isArray(x)) fail(`${label} must be an array`); return x; };
const integer = (x, label, min = 0) => { if (!Number.isSafeInteger(x) || x < min) fail(`${label} must be an integer >= ${min}`); return x; };
const finite = (x, label) => { if (typeof x !== 'number' || !Number.isFinite(x)) fail(`${label} must be finite`); return x; };
const vector = (x, n, label) => { array(x, label); if (x.length !== n) fail(`${label} must have length ${n}`); return x.map((v, i) => finite(v, `${label}[${i}]`)); };
const at = (xs, index, label) => { integer(index, label); if (!Array.isArray(xs) || index >= xs.length) fail(`${label} index ${index} out of range`); return object(xs[index], label); };
const checkedProduct = (a, b, label) => { const n = a * b; if (!Number.isSafeInteger(n)) fail(`${label} exceeds safe range`); return n; };
const quantize = value => { finite(value, 'world POSITION'); const q = Math.round(value * 1e4) / 1e4; if (!Number.isFinite(q) || Math.abs(q) > 1_000_000) fail('world POSITION exceeds world budget'); return Object.is(q, -0) ? 0 : q; };
const COMPONENT = new Map([[5120, [1, 'getInt8', 127]], [5121, [1, 'getUint8', 255]], [5122, [2, 'getInt16', 32767]], [5123, [2, 'getUint16', 65535]], [5125, [4, 'getUint32', 4294967295]], [5126, [4, 'getFloat32', null]]]);
// Required rendering extensions do not change geometry and can be skipped here.
// An unknown required extension is never assumed to be cosmetic.
const SUPPORTED_REQUIRED = new Set(['KHR_draco_mesh_compression', 'EXT_meshopt_compression', 'KHR_mesh_quantization', 'KHR_texture_basisu', 'EXT_texture_webp', 'EXT_texture_avif', 'KHR_texture_transform', 'KHR_lights_punctual', 'KHR_materials_unlit', 'KHR_materials_clearcoat', 'KHR_materials_transmission', 'KHR_materials_volume', 'KHR_materials_ior', 'KHR_materials_specular', 'KHR_materials_sheen', 'KHR_materials_iridescence', 'KHR_materials_anisotropy', 'KHR_materials_emissive_strength', 'KHR_materials_pbrSpecularGlossiness', 'KHR_materials_dispersion']);

export function parseGlb(input) {
  if (!(input instanceof Uint8Array)) fail('input must be GLB bytes');
  // Own the bytes before any async decoder yield, so SHA and geometry cannot diverge.
  const bytes = Buffer.from(input);
  if (bytes.length < 20 || bytes.toString('ascii', 0, 4) !== 'glTF' || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) fail('invalid GLB header/version/length');
  let json, binary = Buffer.alloc(0), offset = 12, chunks = 0, hasBin = false;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) fail('truncated GLB chunk header');
    const length = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4); offset += 8;
    if (length % 4 || offset + length > bytes.length) fail('GLB chunk length/alignment out of range');
    if (chunks++ === 0 && type !== 0x4e4f534a) fail('first GLB chunk must be JSON');
    if (type === 0x4e4f534a) {
      if (json !== undefined || chunks !== 1) fail('duplicate/misplaced GLB JSON');
      try { json = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(offset, offset + length))); } catch { fail('invalid GLB JSON'); }
    } else if (type === 0x004e4942) {
      if (hasBin) fail('duplicate GLB BIN'); hasBin = true; binary = bytes.subarray(offset, offset + length);
    } // glTF requires readers to ignore unknown chunk types.
    offset += length;
  }
  object(json, 'glTF'); if (json.asset?.version !== '2.0') fail('glTF asset.version must be 2.0');
  for (const key of ['nodes', 'scenes', 'meshes', 'accessors', 'bufferViews', 'buffers', 'animations']) if (json[key] !== undefined) array(json[key], key);
  for (const key of ['extensionsRequired', 'extensionsUsed']) if (json[key] !== undefined) { array(json[key], key); if (json[key].some(x => typeof x !== 'string') || new Set(json[key]).size !== json[key].length) fail(`${key} must contain unique strings`); }
  for (const name of json.extensionsRequired || []) { if (!SUPPORTED_REQUIRED.has(name)) fail(`unknown required geometry extension ${name}`); if (!json.extensionsUsed?.includes(name)) fail(`required extension ${name} missing from extensionsUsed`); }
  for (const [i, b] of (json.buffers || []).entries()) {
    object(b, `buffers[${i}]`); integer(b.byteLength, `buffers[${i}].byteLength`, 1);
    if (own(b, 'uri')) fail(`external buffer/URI buffers[${i}] is not self-contained GLB`);
    if (i === 0) { if (!hasBin || b.byteLength > binary.length || binary.length - b.byteLength > 3) fail('BIN byteLength does not match buffer 0'); }
    else {
      // The meshopt fallback tag is optional; the placeholder's references prove it.
      const refs = (json.bufferViews || []).filter(v => v.buffer === i);
      if (!json.extensionsRequired?.includes('EXT_meshopt_compression') || !refs.length || refs.some(v => !v.extensions?.EXT_meshopt_compression) || (json.bufferViews || []).some(v => v.extensions?.EXT_meshopt_compression?.buffer === i)) fail(`buffer ${i} is not a required-meshopt fallback placeholder`);
    }
  }
  if (binary.length && !json.buffers?.length) fail('BIN without buffers');
  for (const image of json.images || []) if (image.uri !== undefined && (typeof image.uri !== 'string' || !image.uri.startsWith('data:'))) fail('external image URI is not self-contained GLB');
  return { json, binary: binary.subarray(0, json.buffers?.[0]?.byteLength ?? 0), sourceSha256: createHash('sha256').update(bytes).digest('hex') };
}

let dracoPromise;
async function dracoDecoder() {
  if (!dracoPromise) dracoPromise = (async () => {
    const require = createRequire(import.meta.url), library = dirname(require.resolve('three/examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js'));
    const sandbox = { module: { exports: {} }, exports: {}, require, process, Buffer, console, WebAssembly, TextDecoder, TextEncoder, setTimeout, clearTimeout, __filename: join(library, 'draco_wasm_wrapper.js'), __dirname: library };
    vm.runInNewContext(readFileSync(join(library, 'draco_wasm_wrapper.js'), 'utf8'), sandbox, { filename: 'local-scene-draco.cjs' });
    return await sandbox.module.exports({ wasmBinary: readFileSync(join(library, 'draco_decoder.wasm')) });
  })();
  return dracoPromise;
}

function geometryReader(json, binary) {
  const views = new Map();
  function source(buffer, offset, length, label) {
    if (integer(buffer, `${label}.buffer`) !== 0) fail(`${label} must reference embedded buffer 0`);
    integer(offset, `${label}.byteOffset`); integer(length, `${label}.byteLength`, 1);
    if (offset > binary.length || length > binary.length - offset) fail(`${label} bytes out of range`);
    return binary.subarray(offset, offset + length);
  }
  async function view(index) {
    if (views.has(index)) return views.get(index);
    const b = at(json.bufferViews, index, 'bufferView'); integer(b.byteLength, 'bufferView.byteLength', 1); integer(optional(b.byteOffset, 0), 'bufferView.byteOffset');
    const buffer = at(json.buffers, b.buffer, 'bufferView.buffer');
    if (optional(b.byteOffset, 0) + b.byteLength > buffer.byteLength) fail('bufferView bytes exceed declared buffer');
    if (b.byteStride !== undefined && (integer(b.byteStride, 'bufferView.byteStride', 4) > 252 || b.byteStride % 4)) fail('bufferView.byteStride must be 4..252 and multiple of 4');
    const ext = b.extensions?.EXT_meshopt_compression;
    let bytes;
    if (ext !== undefined) {
      object(ext, 'EXT_meshopt_compression'); integer(ext.count, 'meshopt.count', 1); integer(ext.byteStride, 'meshopt.byteStride', 1);
      if (!['ATTRIBUTES', 'TRIANGLES', 'INDICES'].includes(ext.mode)) fail('unsupported meshopt mode');
      const filter = optional(ext.filter, 'NONE'); if (!['NONE', 'OCTAHEDRAL', 'QUATERNION', 'EXPONENTIAL'].includes(filter)) fail('unsupported meshopt filter');
      if (ext.mode === 'ATTRIBUTES') {
        if (ext.byteStride > 256 || ext.byteStride % 4 || (b.byteStride !== undefined && b.byteStride !== ext.byteStride)) fail('meshopt ATTRIBUTES stride mismatch');
        if ((filter === 'OCTAHEDRAL' && ![4, 8].includes(ext.byteStride)) || (filter === 'QUATERNION' && ext.byteStride !== 8)) fail('meshopt filter stride mismatch');
      } else if (![2, 4].includes(ext.byteStride) || filter !== 'NONE' || (ext.mode === 'TRIANGLES' && ext.count % 3)) fail('meshopt index mode/stride/filter mismatch');
      const size = checkedProduct(ext.count, ext.byteStride, 'meshopt decoded bytes'); if (size !== b.byteLength) fail('meshopt decoded byteLength mismatch');
      const encoded = source(ext.buffer, optional(ext.byteOffset, 0), ext.byteLength, 'meshopt source');
      await MeshoptDecoder.ready; bytes = new Uint8Array(size);
      try { MeshoptDecoder.decodeGltfBuffer(bytes, ext.count, ext.byteStride, encoded, ext.mode, filter); } catch (e) { fail(`meshopt decode failed: ${e.message}`); }
    } else bytes = source(b.buffer, optional(b.byteOffset, 0), b.byteLength, 'bufferView');
    const result = { bytes, spec: b }; views.set(index, result); return result;
  }
  function metadata(index, role) {
    const a = at(json.accessors, index, `${role} accessor`); integer(a.count, `${role}.count`, 1);
    if (a.count > 6_000_000 / (role === 'POSITION' ? 3 : 1)) fail(`${role} accessor exceeds geometry component budget`);
    const info = COMPONENT.get(a.componentType); if (!info) fail(`${role} unsupported componentType`);
    if (a.normalized !== undefined && typeof a.normalized !== 'boolean') fail(`${role}.normalized must be boolean`);
    if (a.normalized && [5125, 5126].includes(a.componentType)) fail(`${role} cannot normalize uint32/float`);
    if (role === 'POSITION') {
      if (a.type !== 'VEC3' || ![5120, 5121, 5122, 5123, 5126].includes(a.componentType)) fail('POSITION must be VEC3 float or quantized byte/short');
      if (a.componentType !== 5126 && !json.extensionsRequired?.includes('KHR_mesh_quantization')) fail('integer POSITION requires KHR_mesh_quantization');
    } else if (a.type !== 'SCALAR' || ![5121, 5123, 5125].includes(a.componentType) || a.normalized) fail('indices must be unsigned non-normalized SCALAR');
    integer(optional(a.byteOffset, 0), `${role}.byteOffset`);
    if (optional(a.byteOffset, 0) % info[0]) fail(`${role}.byteOffset alignment`);
    return { a, info, width: role === 'POSITION' ? 3 : 1 };
  }
  async function accessor(index, role, decoded) {
    const { a, info: [size, getter, divisor], width } = metadata(index, role), values = decoded === undefined ? new Array(checkedProduct(a.count, width, 'accessor length')).fill(0) : [...decoded], elementSize = size * width;
    if (values.length !== checkedProduct(a.count, width, 'accessor length')) fail(`${role} decoded accessor length mismatch`);
    const read = (data, start, count, stride, label, callback) => {
      if (stride < elementSize || stride % size || (start + (count - 1) * stride + elementSize) > data.byteLength) fail(`${label} byteStride/range invalid`);
      const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
      for (let i = 0; i < count; i++) for (let c = 0; c < width; c++) { let value = dv[getter](start + i * stride + c * size, true); if (a.normalized) value = Math.max(value / divisor, -1); finite(value, label); callback(i, c, value); }
    };
    if (decoded === undefined && a.bufferView !== undefined) {
      const { bytes, spec } = await view(a.bufferView), start = optional(a.byteOffset, 0);
      if ((optional(spec.byteOffset, 0) + start) % size) fail(`${role} absolute alignment`);
      if (role === 'POSITION' && ((optional(spec.byteOffset, 0) + start) % 4 || optional(spec.byteStride, elementSize) % 4)) fail('POSITION vertex alignment must be multiple of 4');
      if (role === 'indices' && spec.byteStride !== undefined) fail('indices cannot use byteStride');
      const mode = spec.extensions?.EXT_meshopt_compression?.mode; if (mode && (role === 'POSITION' ? mode !== 'ATTRIBUTES' : mode === 'ATTRIBUTES')) fail(`${role} meshopt mode mismatch`);
      read(bytes, start, a.count, optional(spec.byteStride, elementSize), role, (i, c, v) => { values[i * width + c] = v; });
    } else if (decoded === undefined && optional(a.byteOffset, 0) !== 0) fail(`${role} byteOffset without bufferView`);
    if (a.sparse !== undefined) {
      const s = object(a.sparse, 'sparse'); integer(s.count, 'sparse.count', 1); if (s.count > a.count) fail('sparse.count exceeds accessor.count');
      const si = object(s.indices, 'sparse.indices'), sv = object(s.values, 'sparse.values'), indexInfo = COMPONENT.get(si.componentType);
      if (![5121, 5123, 5125].includes(si.componentType)) fail('sparse index componentType invalid');
      const iv = await view(si.bufferView), vv = await view(sv.bufferView), start = optional(si.byteOffset, 0), vstart = optional(sv.byteOffset, 0);
      integer(start, 'sparse.indices.byteOffset'); integer(vstart, 'sparse.values.byteOffset');
      if (iv.spec.byteStride !== undefined || vv.spec.byteStride !== undefined || start % indexInfo[0] || (optional(iv.spec.byteOffset, 0) + start) % indexInfo[0] || vstart % size || (optional(vv.spec.byteOffset, 0) + vstart) % size) fail('sparse stride/alignment invalid');
      if (start + s.count * indexInfo[0] > iv.bytes.length) fail('sparse indices out of range');
      const dv = new DataView(iv.bytes.buffer, iv.bytes.byteOffset, iv.bytes.byteLength), sparseIndices = []; let previous = -1;
      for (let i = 0; i < s.count; i++) { const n = dv[indexInfo[1]](start + i * indexInfo[0], true); if (n <= previous || n >= a.count) fail('sparse indices must be strictly increasing and in range'); sparseIndices.push(n); previous = n; }
      read(vv.bytes, vstart, s.count, elementSize, 'sparse values', (i, c, v) => { values[sparseIndices[i] * width + c] = v; });
    }
    return values;
  }
  async function primitive(p) {
    object(p, 'primitive'); if (optional(p.mode, 4) !== 4) fail(`semantic geometry requires TRIANGLES mode=4, received ${p.mode}`);
    object(p.attributes, 'primitive.attributes'); const meta = metadata(p.attributes.POSITION, 'POSITION');
    let positions, indices;
    const ext = p.extensions?.KHR_draco_mesh_compression;
    if (ext !== undefined) {
      object(ext, 'KHR_draco_mesh_compression'); object(ext.attributes, 'Draco attributes');
      for (const [name, id] of Object.entries(ext.attributes)) { if (!own(p.attributes, name)) fail(`Draco attribute ${name} missing from primitive`); integer(id, `Draco ${name} unique id`); }
      const encoded = (await view(ext.bufferView)).bytes, d = await dracoDecoder(), buffer = new d.DecoderBuffer(), worker = new d.Decoder(), mesh = new d.Mesh();
      try {
        buffer.Init(new Int8Array(encoded), encoded.length);
        if (worker.GetEncodedGeometryType(buffer) !== d.TRIANGULAR_MESH) fail('Draco geometry must be triangular mesh');
        const status = worker.DecodeBufferToMesh(buffer, mesh); if (!status.ok()) fail(`Draco decode failed: ${status.error_msg()}`);
        if (mesh.num_points() !== meta.a.count || mesh.num_points() < 1) fail('Draco POSITION count mismatch');
        const values = new d.DracoFloat32Array(), faces = new d.DracoInt32Array();
        try {
          if (ext.attributes.POSITION === undefined) positions = await accessor(p.attributes.POSITION, 'POSITION');
          else {
            const attribute = worker.GetAttributeByUniqueId(mesh, ext.attributes.POSITION); if (!attribute?.ptr || attribute.num_components() !== 3) fail('Draco POSITION missing or not VEC3');
            const types = new Map([[5120, d.DT_INT8], [5121, d.DT_UINT8], [5122, d.DT_INT16], [5123, d.DT_UINT16], [5126, d.DT_FLOAT32]]);
            if (attribute.data_type() !== types.get(meta.a.componentType)) fail('Draco POSITION componentType mismatch');
            if (!worker.GetAttributeFloatForAllPoints(mesh, attribute, values) || values.size() !== meta.a.count * 3) fail('Draco POSITION decode/length invalid');
            positions = Array.from({ length: values.size() }, (_, i) => finite(values.GetValue(i), 'Draco POSITION'));
            if (meta.a.normalized) positions = positions.map(v => Math.max(v / meta.info[2], -1));
            positions = await accessor(p.attributes.POSITION, 'POSITION', positions);
          }
          indices = []; for (let i = 0; i < mesh.num_faces(); i++) { if (!worker.GetFaceFromMesh(mesh, i, faces)) fail('Draco face decode failed'); for (let k = 0; k < 3; k++) indices.push(faces.GetValue(k)); }
        } finally { d.destroy(values); d.destroy(faces); }
        if (p.indices !== undefined) {
          if (metadata(p.indices, 'indices').a.count !== indices.length) fail('Draco indices count mismatch');
          indices = await accessor(p.indices, 'indices', indices);
        }
      } finally { d.destroy(mesh); d.destroy(worker); d.destroy(buffer); }
    } else {
      positions = await accessor(p.attributes.POSITION, 'POSITION');
      indices = p.indices === undefined ? Array.from({ length: positions.length / 3 }, (_, i) => i) : await accessor(p.indices, 'indices');
    }
    if (!indices.length || indices.length % 3) fail('triangle indices length must be positive multiple of 3');
    for (const index of indices) if (!Number.isSafeInteger(index) || index < 0 || index >= positions.length / 3) fail('triangle index out of POSITION range');
    if (p.indices !== undefined) { const max = metadata(p.indices, 'indices').info[2]; if (indices.some(i => i >= max)) fail('triangle index exceeds componentType domain/primitive restart limit'); }
    return { positions, indices };
  }
  return { primitive };
}

export function sceneNodeKind(name) {
  if (['col_', 'nav_', 'pick_', 'spawn_'].includes(name)) fail(`empty semantic suffix ${name}`);
  if (name.startsWith('col_')) return 'collision'; if (name.startsWith('nav_')) return 'navigation'; if (name.startsWith('pick_')) return 'pick'; if (name.startsWith('spawn_')) return 'spawn'; return 'display';
}

export async function bakeSceneImport(input) {
  const { json, binary, sourceSha256 } = parseGlb(input), nodes = json.nodes || [], scenes = json.scenes || [];
  if (!scenes.length) fail('default scene is missing');
  const selected = optional(json.scene, scenes.length === 1 ? 0 : undefined); if (selected === undefined) fail('multiple scenes require explicit default scene');
  const scene = at(scenes, selected, 'scene'), roots = array(optional(scene.nodes, []), 'scene.nodes'), parents = new Map(), children = [], colors = new Map();
  for (const [i, node] of nodes.entries()) {
    object(node, `nodes[${i}]`); children[i] = array(optional(node.children, []), `nodes[${i}].children`);
    for (const child of children[i]) { at(nodes, child, 'child'); if (parents.has(child)) fail(`multiple parents/duplicate child for node ${child}`); parents.set(child, i); }
  }
  const checkCycle = index => { if (colors.get(index) === 1) fail(`cycle at node ${index}`); if (colors.get(index) === 2) return; colors.set(index, 1); for (const child of children[index]) checkCycle(child); colors.set(index, 2); };
  for (let i = 0; i < nodes.length; i++) checkCycle(i);
  const animated = new Set();
  for (const anim of json.animations || []) for (const channel of array(anim.channels, 'animation.channels')) { const target = object(channel.target, 'animation.target'); if (target.node !== undefined) { at(nodes, target.node, 'animation target'); animated.add(target.node); } }
  const local = (node, index) => {
    if (node.matrix !== undefined) {
      if (['translation', 'rotation', 'scale'].some(k => own(node, k))) fail(`node ${index} matrix cannot coexist with TRS`);
      const values = vector(node.matrix, 16, `node ${index}.matrix`); if (values[3] !== 0 || values[7] !== 0 || values[11] !== 0 || values[15] !== 1) fail('node matrix must be affine'); return new Matrix4().fromArray(values);
    }
    const t = vector(optional(node.translation, [0, 0, 0]), 3, 'translation'), s = vector(optional(node.scale, [1, 1, 1]), 3, 'scale'), q = vector(optional(node.rotation, [0, 0, 0, 1]), 4, 'rotation');
    if (Math.abs(q.reduce((sum, v) => sum + v * v, 0) - 1) > 1e-5) fail(`node ${index} quaternion must be unit length`);
    return new Matrix4().compose(new Vector3(...t), new Quaternion(...q), new Vector3(...s));
  };
  const records = [], recordByIndex = new Map(), seenRoots = new Set();
  function walk(index, path, parentWorld, semantic) {
    const node = at(nodes, index, 'node'), name = optional(node.name, ''); if (typeof name !== 'string') fail('node.name must be a string');
    if (name.length > 1024 || /[\x00-\x1f]/.test(name)) fail('node.name length/control characters invalid');
    if (path.length >= 256 || records.length >= 4096) fail('scene node/path budget exceeded');
    const kind = sceneNodeKind(name); if (semantic !== undefined && kind !== 'display') fail(`nested semantic prefix node ${index} under ${semantic}`);
    const world = parentWorld.clone().multiply(local(node, index)); world.elements.forEach(v => finite(v, 'worldMatrix'));
    const record = { index, path: [...path, index], name, kind, worldMatrix: world.toArray() }; records.push(record); recordByIndex.set(index, record);
    for (const child of children[index]) walk(child, record.path, world, kind === 'display' ? semantic : index);
  }
  for (const index of roots) { at(nodes, index, 'scene root'); if (seenRoots.has(index) || parents.has(index)) fail(`scene root ${index} is duplicated or has a parent`); seenRoots.add(index); walk(index, [], new Matrix4(), undefined); }
  if (!records.length) fail('selected scene has no nodes');
  const reader = geometryReader(json, binary);
  let components = 0;
  for (const record of records) {
    if (record.kind === 'display') continue;
    const positions = [], indices = [], ancestors = record.path.slice(0, -1);
    if (ancestors.some(i => animated.has(i) || nodes[i].skin !== undefined || nodes[i].weights !== undefined || nodes[i].extensions?.EXT_mesh_gpu_instancing !== undefined)) fail(`dynamic ancestor (animation/skin/morph/instancing) of semantic node ${record.index}`);
    async function gather(index) {
      const node = nodes[index];
      if (animated.has(index) || node.skin !== undefined || node.weights !== undefined) fail(`dynamic animation/skin/morph semantic node ${index}`);
      if (node.extensions?.EXT_mesh_gpu_instancing !== undefined) fail(`unsupported instanced semantic geometry node ${index}`);
      if (node.mesh !== undefined) {
        if (record.kind === 'spawn') fail(`spawn node ${record.index} must have no geometry`);
        const mesh = at(json.meshes, node.mesh, 'mesh'); if (mesh.weights !== undefined) fail(`morph weights in semantic mesh ${node.mesh}`);
        const primitives = array(mesh.primitives, 'mesh.primitives'); if (!primitives.length) fail('semantic mesh has no primitives');
        const matrix = new Matrix4().fromArray(recordByIndex.get(index).worldMatrix);
        for (const p of primitives) {
          if (p.targets !== undefined && array(p.targets, 'morph targets').length) fail('morph targets in semantic geometry');
          const decoded = await reader.primitive(p), base = positions.length / 3;
          components += decoded.positions.length + decoded.indices.length; if (components > 6_000_000) fail('scene geometry component budget exceeded');
          for (let i = 0; i < decoded.positions.length; i += 3) { const xyz = new Vector3(decoded.positions[i], decoded.positions[i + 1], decoded.positions[i + 2]).applyMatrix4(matrix); positions.push(quantize(xyz.x), quantize(xyz.y), quantize(xyz.z)); }
          for (const i of decoded.indices) indices.push(base + i);
        }
      }
      for (const child of children[index]) await gather(child);
    }
    await gather(record.index);
    if (record.kind === 'spawn') continue;
    if (!indices.length) fail(`${record.kind} node ${record.index} needs triangles`);
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < positions.length; i++) { const axis = i % 3; min[axis] = Math.min(min[axis], positions[i]); max[axis] = Math.max(max[axis], positions[i]); }
    Object.assign(record, { positions, indices, bounds: { min, max } });
  }
  return { version: 1, sourceSha256, nodes: records };
}
