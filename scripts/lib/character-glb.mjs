import { createHash } from 'node:crypto';

export const HUMANOID_PROFILE = 'apollo-humanoid-v1';
export const HUMANOID_BONES = Object.freeze([
  'Hips', 'Spine', 'Chest', 'Neck', 'Head',
  'LeftUpperArm', 'LeftLowerArm', 'LeftHand', 'RightUpperArm', 'RightLowerArm', 'RightHand',
  'LeftUpperLeg', 'LeftLowerLeg', 'LeftFoot', 'RightUpperLeg', 'RightLowerLeg', 'RightFoot',
]);
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const COMPONENTS = { 5120: [1, 'getInt8'], 5121: [1, 'getUint8'], 5122: [2, 'getInt16'], 5123: [2, 'getUint16'], 5125: [4, 'getUint32'], 5126: [4, 'getFloat32'] };
const TYPES = { SCALAR: [1, 1], VEC2: [1, 2], VEC3: [1, 3], VEC4: [1, 4], MAT2: [2, 2], MAT3: [3, 3], MAT4: [4, 4] };
function check(value, message) { if (!value) throw new Error(`Character GLB: ${message}`); }
function integer(value, min = 0, max = Number.MAX_SAFE_INTEGER) { return Number.isSafeInteger(value) && value >= min && value <= max; }
function ref(items, index, label) { check(Array.isArray(items) && integer(index, 0, items.length - 1), `${label} reference out of range`); return items[index]; }
function vector(value, count, label) { check(Array.isArray(value) && value.length === count && value.every(Number.isFinite), `${label} must contain ${count} finite components`); return value; }
function quaternion(value, label) { vector(value, 4, label); check(Math.abs(Math.hypot(...value) - 1) <= 1e-3, `${label} quaternion must be normalized`); }
function multiply(a, b) {
  const out = Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) out[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return out;
}
function localMatrix(node, label) {
  if (node.matrix !== undefined) {
    check(node.translation === undefined && node.rotation === undefined && node.scale === undefined, `${label} matrix and TRS are mutually exclusive`);
    const m = vector(node.matrix, 16, `${label} matrix`);
    check(Math.abs(m[3]) + Math.abs(m[7]) + Math.abs(m[11]) + Math.abs(m[15] - 1) < 1e-6, `${label} matrix must be affine`);
    return m;
  }
  const t = vector(node.translation ?? [0, 0, 0], 3, `${label} translation`);
  const s = vector(node.scale ?? [1, 1, 1], 3, `${label} scale`);
  const q = node.rotation ?? [0, 0, 0, 1]; quaternion(q, `${label} rotation`);
  const [x, y, z, w] = q;
  return [(1 - 2 * (y * y + z * z)) * s[0], 2 * (x * y + z * w) * s[0], 2 * (x * z - y * w) * s[0], 0,
    2 * (x * y - z * w) * s[1], (1 - 2 * (x * x + z * z)) * s[1], 2 * (y * z + x * w) * s[1], 0,
    2 * (x * z + y * w) * s[2], 2 * (y * z - x * w) * s[2], (1 - 2 * (x * x + y * y)) * s[2], 0, ...t, 1];
}
// Skin-only render metadata. Geometry/animation/compression extensions remain
// prohibited; defaults retain the original strict T5/motion contract.
export const SKIN_MATERIAL_EXTENSIONS = Object.freeze(['KHR_materials_specular', 'KHR_texture_transform']);
function specularMaterial(value, json) {
  check(value && typeof value === 'object' && !Array.isArray(value), 'KHR_materials_specular must be an object');
  const keys = ['specularFactor', 'specularColorFactor', 'specularTexture', 'specularColorTexture', 'extensions', 'extras'];
  check(Object.keys(value).every(key => keys.includes(key)), 'unsupported KHR_materials_specular field');
  if (value.specularFactor !== undefined) check(Number.isFinite(value.specularFactor) && value.specularFactor >= 0 && value.specularFactor <= 1, 'specularFactor must be in [0,1]');
  if (value.specularColorFactor !== undefined) check(vector(value.specularColorFactor, 3, 'specularColorFactor').every(n => n >= 0), 'specularColorFactor must be nonnegative');
  for (const key of ['specularTexture', 'specularColorTexture']) if (value[key] !== undefined) {
    const info = value[key];
    check(info && typeof info === 'object' && !Array.isArray(info) && Object.keys(info).every(k => ['index', 'texCoord', 'extensions', 'extras'].includes(k)), `${key} must be closed textureInfo`);
    const texture = ref(json.textures, info.index, `${key} texture`);
    check(info.texCoord === undefined || integer(info.texCoord), `${key} texCoord must be a nonnegative integer`);
    ref(json.images, texture.source, `${key} image`);
    if (texture.sampler !== undefined) ref(json.samplers, texture.sampler, `${key} sampler`);
  }
}
function textureTransform(value) {
  check(value && typeof value === 'object' && !Array.isArray(value), 'KHR_texture_transform must be an object');
  check(Object.keys(value).every(key => ['offset', 'rotation', 'scale', 'texCoord', 'extensions', 'extras'].includes(key)), 'unsupported KHR_texture_transform field');
  for (const key of ['offset', 'scale']) if (value[key] !== undefined) vector(value[key], 2, `KHR_texture_transform ${key}`);
  if (value.rotation !== undefined) check(Number.isFinite(value.rotation), 'KHR_texture_transform rotation must be finite');
  if (value.texCoord !== undefined) check(integer(value.texCoord), 'KHR_texture_transform texCoord must be a nonnegative integer');
}
function materialTextureInfos(materials) {
  const infos = new Map();
  for (const [materialIndex, material] of [...materials].entries()) {
    for (const key of ['normalTexture', 'occlusionTexture', 'emissiveTexture']) if (material[key]) infos.set(material[key], materialIndex);
    for (const key of ['baseColorTexture', 'metallicRoughnessTexture']) if (material.pbrMetallicRoughness?.[key]) infos.set(material.pbrMetallicRoughness[key], materialIndex);
    for (const key of ['specularTexture', 'specularColorTexture']) if (material.extensions?.KHR_materials_specular?.[key]) infos.set(material.extensions.KHR_materials_specular[key], materialIndex);
  }
  return infos;
}
function transformTextureInfo(info, json, materialIndex) {
  check(info && typeof info === 'object' && !Array.isArray(info), 'texture transform requires material textureInfo');
  const texture = ref(json.textures, info.index, 'texture transform texture');
  check(info.texCoord === undefined || integer(info.texCoord), 'textureInfo texCoord must be a nonnegative integer');
  ref(json.images, texture.source, 'texture transform image');
  if (texture.sampler !== undefined) ref(json.samplers, texture.sampler, 'texture transform sampler');
  const coordinate = info.extensions.KHR_texture_transform.texCoord ?? info.texCoord ?? 0;
  check(integer(coordinate), 'KHR_texture_transform texCoord must be a nonnegative integer');
  for (const mesh of json.meshes ?? []) for (const primitive of mesh.primitives ?? []) if (primitive.material === materialIndex) {
    const uv = ref(json.accessors, primitive.attributes?.[`TEXCOORD_${coordinate}`], `KHR_texture_transform TEXCOORD_${coordinate} accessor`);
    check(uv.type === 'VEC2' && (uv.componentType === 5126 && !uv.normalized || [5121, 5123].includes(uv.componentType) && uv.normalized === true), `KHR_texture_transform TEXCOORD_${coordinate} must use a valid UV accessor`);
  }
}
function extensionsFree(value, allowSkinMaterialExtensions = false) {
  const materials = new Set(allowSkinMaterialExtensions ? value.materials ?? [] : []);
  const textureInfos = materialTextureInfos(materials);
  const pending = [value];
  while (pending.length) {
    const item = pending.pop();
    if (!item || typeof item !== 'object') continue;
    if (item.extensions && Object.keys(item.extensions).length > 0) {
      for (const [name, extension] of Object.entries(item.extensions)) {
        const specular = materials.has(item) && name === 'KHR_materials_specular';
        const transform = textureInfos.has(item) && name === 'KHR_texture_transform';
        check(specular || transform, 'unsupported extensions/compression; decompress before character validation');
        check(value.extensionsUsed?.includes(name), `material extension ${name} must be declared in extensionsUsed`);
        if (specular) specularMaterial(extension, value);
        else { transformTextureInfo(item, value, textureInfos.get(item)); textureTransform(extension); }
      }
    }
    for (const [key, child] of Object.entries(item)) if (key !== 'extras' && child && typeof child === 'object') pending.push(child);
  }
}

/** Synchronous, dependency-free, uncompressed GLB 2 character inspection. Bounds are rest-pose world metres.
 * Inspects the explicit default scene, or the sole scene when `scene` is omitted; ambiguous multi-scene assets reject.
 */
export function inspectCharacterGlb(bytes, { clipName, fps, frames, requireSkin = true, requireHumanoid = true, allowSkinMaterialExtensions = false } = {}) {
  check(bytes instanceof Uint8Array || bytes instanceof ArrayBuffer, 'bytes must be a Uint8Array or ArrayBuffer');
  const input = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  check(view.byteLength >= 20, 'truncated header');
  check(view.getUint32(0, true) === 0x46546c67 && view.getUint32(4, true) === 2, 'header must identify GLB version 2');
  check(view.getUint32(8, true) === view.byteLength, 'header length mismatch');
  check(clipName === undefined || (typeof clipName === 'string' && clipName.trim().length > 0), 'clipName must be nonempty');
  check(fps === undefined || integer(fps, 1, 120), 'fps must be an integer in 1..120');
  check(frames === undefined || integer(frames, 2, 36001), 'frames must be an integer in 2..36001');
  check((fps === undefined) === (frames === undefined), 'fps and frames must be supplied together');
  let json; let binary; let cursor = 12; let chunkCount = 0;
  while (cursor < view.byteLength) {
    check(cursor + 8 <= view.byteLength, 'truncated chunk header');
    const length = view.getUint32(cursor, true); const type = view.getUint32(cursor + 4, true); cursor += 8;
    check(length % 4 === 0 && cursor + length <= view.byteLength, 'chunk length/alignment out of range');
    if (chunkCount === 0) {
      check(type === 0x4e4f534a, 'first chunk must be JSON');
      try { json = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(input.subarray(cursor, cursor + length))); }
      catch { throw new Error('Character GLB: invalid JSON chunk'); }
    } else {
      check(chunkCount === 1 && type === 0x004e4942, 'only one JSON and one BIN chunk are supported');
      binary = input.subarray(cursor, cursor + length);
    }
    cursor += length; chunkCount++;
  }
  check(json && typeof json === 'object' && json.asset?.version === '2.0', 'asset.version must be 2.0');
  check(typeof allowSkinMaterialExtensions === 'boolean', 'allowSkinMaterialExtensions must be boolean');
  check(!allowSkinMaterialExtensions || (requireSkin && clipName === undefined && fps === undefined && !(json.animations ?? []).length), 'material extension opt-in is only for static skins');
  for (const field of ['extensionsUsed', 'extensionsRequired']) {
    check(json[field] === undefined || Array.isArray(json[field]) && json[field].every(name => typeof name === 'string'), `${field} must be an array of names`);
    check(!json[field]?.length || allowSkinMaterialExtensions && json[field].every(name => SKIN_MATERIAL_EXTENSIONS.includes(name)), 'unsupported extensions/compression; decompress before character validation');
  }
  check(!json.extensionsRequired?.some(name => !json.extensionsUsed?.includes(name)), 'required extension must also be declared used');
  extensionsFree(json, allowSkinMaterialExtensions);
  check(Array.isArray(json.buffers) && json.buffers.length === 1 && binary, 'one self-contained BIN buffer is required');
  const buffer = json.buffers[0];
  check(buffer.uri === undefined && integer(buffer.byteLength, 1, binary.length) && binary.length - buffer.byteLength <= 3, 'buffer must be self-contained with a valid byteLength');
  const data = new DataView(binary.buffer, binary.byteOffset, buffer.byteLength);
  const views = json.bufferViews ?? [];
  check(Array.isArray(views), 'bufferViews must be an array');
  for (const [i, bv] of views.entries()) {
    check(bv.buffer === 0 && integer(bv.byteOffset ?? 0) && integer(bv.byteLength, 1) && (bv.byteOffset ?? 0) + bv.byteLength <= data.byteLength, `bufferView ${i} range out of buffer`);
    check(bv.byteStride === undefined || (integer(bv.byteStride, 4, 252) && bv.byteStride % 4 === 0), `bufferView ${i} invalid byteStride`);
    check(bv.target === undefined || [34962, 34963].includes(bv.target), `bufferView ${i} invalid target`);
  }
  for (const image of json.images ?? []) {
    check(image.uri === undefined || (typeof image.uri === 'string' && image.uri.startsWith('data:')), 'external image URI is not self-contained');
    if (image.bufferView !== undefined) ref(views, image.bufferView, 'image bufferView');
  }
  const accessors = json.accessors ?? [];
  check(Array.isArray(accessors), 'accessors must be an array');
  const decoded = accessors.map((a, i) => {
    const label = `accessor ${i}`;
    check(a.sparse === undefined, `${label} sparse accessors are unsupported`);
    const bv = ref(views, a.bufferView, `${label} bufferView`);
    const component = COMPONENTS[a.componentType]; const shape = TYPES[a.type];
    check(component && shape && integer(a.count, 1), `${label} invalid type/component/count`);
    check(a.normalized === undefined || typeof a.normalized === 'boolean', `${label} invalid normalized`);
    check(!a.normalized || [5120, 5121, 5122, 5123].includes(a.componentType), `${label} invalid normalized component type`);
    const [size, getter] = component; const [cols, rows] = shape;
    const columnBytes = cols === 1 ? rows * size : Math.ceil(rows * size / 4) * 4;
    const packed = columnBytes * cols; const stride = bv.byteStride ?? packed; const offset = a.byteOffset ?? 0;
    check(integer(offset) && offset % size === 0 && ((bv.byteOffset ?? 0) + offset) % size === 0 && stride >= packed && stride % size === 0, `${label} byteOffset/stride alignment invalid`);
    check(cols === 1 || ((bv.byteOffset ?? 0) + offset) % 4 === 0, `${label} matrix alignment invalid`);
    check(Number.isSafeInteger((a.count - 1) * stride + packed) && offset + (a.count - 1) * stride + packed <= bv.byteLength, `${label} range exceeds bufferView`);
    const values = [];
    for (let n = 0; n < a.count; n++) {
      const tuple = [];
      for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
        let value = data[getter]((bv.byteOffset ?? 0) + offset + n * stride + c * columnBytes + r * size, true);
        check(Number.isFinite(value), `${label} non-finite component`);
        if (a.normalized) value = a.componentType === 5120 ? Math.max(value / 127, -1) : a.componentType === 5122 ? Math.max(value / 32767, -1) : value / (a.componentType === 5121 ? 255 : 65535);
        tuple.push(value);
      }
      values.push(tuple);
    }
    for (const key of ['min', 'max']) if (a[key] !== undefined) vector(a[key], cols * rows, `${label} ${key}`);
    if (a.min && a.max) check(a.min.every((v, k) => v <= a.max[k]), `${label} min/max inverted`);
    return { ...a, values };
  });
  const nodes = json.nodes ?? []; check(Array.isArray(nodes) && nodes.length > 0, 'nodes are required');
  const parents = Array(nodes.length).fill(-1); const local = nodes.map((node, i) => localMatrix(node, `node ${i}`));
  for (const [i, node] of nodes.entries()) {
    check(node.children === undefined || Array.isArray(node.children), `node ${i} children must be an array`);
    for (const child of node.children ?? []) {
      ref(nodes, child, `node ${i} child`);
      check(child !== i && parents[child] === -1, 'node graph has cycle or multiple parents'); parents[child] = i;
    }
    if (node.mesh !== undefined) ref(json.meshes, node.mesh, `node ${i} mesh`);
    if (node.skin !== undefined) { ref(json.skins, node.skin, `node ${i} skin`); check(node.mesh !== undefined, `node ${i} skin requires mesh`); }
  }
  const roots = parents.flatMap((parent, i) => parent === -1 ? [i] : []); const world = Array(nodes.length); const queue = [...roots];
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q]; world[i] = parents[i] < 0 ? local[i] : multiply(world[parents[i]], local[i]);
    check(world[i].every(Number.isFinite), `node ${i} non-finite world transform`);
    queue.push(...(nodes[i].children ?? []));
  }
  check(queue.length === nodes.length, 'node graph contains a cycle');
  for (const scene of json.scenes ?? []) {
    check(Array.isArray(scene.nodes), 'scene nodes must be an array');
    check(new Set(scene.nodes).size === scene.nodes.length, 'scene root nodes must be unique');
    for (const root of scene.nodes) { ref(nodes, root, 'scene node'); check(parents[root] === -1, 'scene node must be a root'); }
  }
  check(json.scene !== undefined || json.scenes?.length === 1, 'multiple scenes require an explicit default scene');
  const activeScene = ref(json.scenes, json.scene ?? 0, 'default scene');
  check(activeScene.nodes.length > 0, 'default scene must not be empty');
  const activeNodes = new Set(activeScene.nodes); const activeQueue = [...activeNodes];
  for (let i = 0; i < activeQueue.length; i++) for (const child of nodes[activeQueue[i]].children ?? []) {
    if (!activeNodes.has(child)) { activeNodes.add(child); activeQueue.push(child); }
  }
  const skins = json.skins ?? []; check(Array.isArray(skins) && skins.length <= 1, 'only a single skin is supported');
  check(!requireSkin || skins.length === 1, 'a single skin is required');
  const skin = skins[0]; let bones = []; let inverseBinds = [];
  if (skin) {
    check(Array.isArray(skin.joints) && skin.joints.length > 0 && new Set(skin.joints).size === skin.joints.length, 'skin joints must be nonempty and unique');
    bones = skin.joints.map((joint) => {
      const node = ref(nodes, joint, 'skin joint');
      check(activeNodes.has(joint), 'skin joint must be reachable from the default scene');
      check(typeof node.name === 'string' && node.name.trim() === node.name && node.name.length > 0, 'skin joint name must be nonempty and trimmed');
      return node.name;
    });
    check(new Set(bones).size === bones.length, 'skin joint names must be unique');
    if (requireHumanoid) check(HUMANOID_BONES.every((name) => bones.includes(name)), `skin missing required ${HUMANOID_PROFILE} bones`);
    const ibm = ref(decoded, skin.inverseBindMatrices, 'skin inverseBindMatrices');
    check(ibm.type === 'MAT4' && ibm.componentType === 5126 && !ibm.normalized && ibm.count === skin.joints.length, 'skin inverseBindMatrices must be FLOAT MAT4 with joint count');
    inverseBinds = ibm.values;
    for (const matrix of inverseBinds) {
      check(Math.abs(matrix[3]) + Math.abs(matrix[7]) + Math.abs(matrix[11]) + Math.abs(matrix[15] - 1) < 1e-5, 'skin inverseBindMatrices must be affine');
      const determinant = matrix[0] * (matrix[5] * matrix[10] - matrix[9] * matrix[6]) - matrix[4] * (matrix[1] * matrix[10] - matrix[9] * matrix[2]) + matrix[8] * (matrix[1] * matrix[6] - matrix[5] * matrix[2]);
      check(Number.isFinite(determinant) && determinant !== 0, 'skin inverseBindMatrices must be invertible');
    }
    const ancestor = (child, root) => { for (let i = child; i >= 0; i = parents[i]) if (i === root) return true; return false; };
    if (skin.skeleton !== undefined) { ref(nodes, skin.skeleton, 'skin skeleton'); check(activeNodes.has(skin.skeleton), 'skin skeleton must be reachable from the default scene'); check(skin.joints.every((joint) => ancestor(joint, skin.skeleton)), 'skin skeleton must be ancestor of every joint'); }
    const treeRoot = (i) => { while (parents[i] !== -1) i = parents[i]; return i; };
    check(new Set(skin.joints.map(treeRoot)).size === 1, 'skin joints must belong to one connected skeleton');
    if (requireHumanoid) {
      const profileParents = [-1, 0, 1, 2, 3, 2, 5, 6, 2, 8, 9, 0, 11, 12, 0, 14, 15];
      for (let i = 1; i < HUMANOID_BONES.length; i++) check(ancestor(skin.joints[bones.indexOf(HUMANOID_BONES[i])], skin.joints[bones.indexOf(HUMANOID_BONES[profileParents[i]])]), `humanoid hierarchy invalid for ${HUMANOID_BONES[i]}`);
    }
  } else check(!requireHumanoid, 'humanoid profile requires a skin');
  const lower = [Infinity, Infinity, Infinity]; const upper = [-Infinity, -Infinity, -Infinity];
  const skinMatrices = skin ? skin.joints.map((joint, i) => multiply(world[joint], inverseBinds[i])) : [];
  let vertices = 0; let triangles = 0; let skinnedPrimitives = 0; let nondegenerate = false;
  check(Array.isArray(json.meshes) && json.meshes.length > 0, 'actual triangle mesh is required');
  for (const [meshIndex, mesh] of json.meshes.entries()) {
    check(Array.isArray(mesh.primitives) && mesh.primitives.length > 0, 'mesh primitives are required');
    const instances = nodes.flatMap((node, i) => node.mesh === meshIndex && activeNodes.has(i) ? [i] : []);
    if (instances.length === 0) continue;
    for (const primitive of mesh.primitives) {
      check((primitive.mode ?? 4) === 4, 'only triangle mesh primitives are supported');
      check(!primitive.targets?.length, 'morph targets are unsupported');
      const attrs = primitive.attributes ?? {}; const position = ref(decoded, attrs.POSITION, 'mesh POSITION');
      check(position.type === 'VEC3' && position.componentType === 5126 && !position.normalized && position.count >= 3, 'mesh POSITION must be FLOAT VEC3 with at least 3 vertices');
      for (const [name, index] of Object.entries(attrs)) { const attr = ref(decoded, index, `mesh ${name}`); check(attr.count === position.count, `mesh ${name} count differs from POSITION`); }
      const isSkinned = instances.some((i) => nodes[i].skin !== undefined);
      if (isSkinned) {
        const joints = ref(decoded, attrs.JOINTS_0, 'mesh JOINTS_0'); const weights = ref(decoded, attrs.WEIGHTS_0, 'mesh WEIGHTS_0');
        check(joints.type === 'VEC4' && [5121, 5123].includes(joints.componentType) && !joints.normalized, 'JOINTS_0 must be unsigned VEC4');
        check(weights.type === 'VEC4' && ((weights.componentType === 5126 && !weights.normalized) || ([5121, 5123].includes(weights.componentType) && weights.normalized)), 'WEIGHTS_0 must be FLOAT or normalized unsigned VEC4');
        check(attrs.JOINTS_1 === undefined && attrs.WEIGHTS_1 === undefined, 'additional skin influence sets are unsupported');
        for (let i = 0; i < position.count; i++) {
          check(joints.values[i].every((joint) => integer(joint, 0, skin.joints.length - 1)), 'JOINTS_0 joint index out of skin range');
          const w = weights.values[i];
          check(w.every((v) => v >= 0 && v <= 1) && Math.abs(w.reduce((a, b) => a + b, 0) - 1) <= (weights.normalized ? 0.008 : 0.001), 'WEIGHTS_0 weights must be in [0,1] and sum to one');
        }
        skinnedPrimitives++;
      } else check(attrs.JOINTS_0 === undefined && attrs.WEIGHTS_0 === undefined, 'skin attributes require a skinned mesh node');
      let indices = Array.from({ length: position.count }, (_, i) => i);
      if (primitive.indices !== undefined) {
        const index = ref(decoded, primitive.indices, 'mesh indices');
        check(index.type === 'SCALAR' && [5121, 5123, 5125].includes(index.componentType) && !index.normalized, 'indices must be unsigned SCALAR');
        indices = index.values.map(([value]) => value);
      }
      check(indices.length >= 3 && indices.length % 3 === 0 && indices.every((i) => integer(i, 0, position.count - 1)), 'triangle indices out of POSITION range or invalid count');
      for (let i = 0; i < indices.length; i += 3) {
        const [a, b, c] = indices.slice(i, i + 3).map((index) => position.values[index]);
        const u = b.map((v, k) => v - a[k]); const v = c.map((n, k) => n - a[k]);
        if (Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) > 1e-12) nondegenerate = true;
      }
      vertices += position.count; triangles += indices.length / 3;
      for (const instance of instances) for (let vertex = 0; vertex < position.count; vertex++) {
        const point = position.values[vertex]; let transformed;
        if (nodes[instance].skin !== undefined) {
          const joints = decoded[attrs.JOINTS_0].values[vertex]; const weights = decoded[attrs.WEIGHTS_0].values[vertex]; transformed = [0, 0, 0];
          for (let influence = 0; influence < 4; influence++) {
            const m = skinMatrices[joints[influence]];
            for (let k = 0; k < 3; k++) transformed[k] += weights[influence] * (m[k] * point[0] + m[4 + k] * point[1] + m[8 + k] * point[2] + m[12 + k]);
          }
        } else { const m = world[instance]; transformed = [0, 1, 2].map((k) => m[k] * point[0] + m[4 + k] * point[1] + m[8 + k] * point[2] + m[12 + k]); }
        check(transformed.every(Number.isFinite), 'mesh rest bounds are non-finite');
        for (let k = 0; k < 3; k++) { lower[k] = Math.min(lower[k], transformed[k]); upper[k] = Math.max(upper[k], transformed[k]); }
      }
    }
  }
  check(nondegenerate && vertices > 0, 'actual nondegenerate triangle geometry is required in the default scene');
  check(!requireSkin || skinnedPrimitives > 0, 'skin must be used by actual mesh geometry in the default scene');
  const clips = json.animations ?? []; check(Array.isArray(clips), 'animations must be an array');
  check(fps === undefined || clips.length > 0, 'fps/frames sampling contract requires an animation');
  if (clipName !== undefined) check(clips.filter((clip) => clip.name === clipName).length === 1, 'clipName must match exactly one animation');
  const animations = clips.map((clip, clipIndex) => {
    check(typeof clip.name === 'string' && clip.name.trim().length > 0, 'animation name must be nonempty');
    check(Array.isArray(clip.samplers) && clip.samplers.length > 0 && Array.isArray(clip.channels) && clip.channels.length > 0, 'animation samplers/channels must be nonempty');
    const selected = clipName === undefined || clip.name === clipName; let duration = 0; const targets = new Set(); const used = new Set(); let referenceTimes;
    for (const sampler of clip.samplers) {
      const times = ref(decoded, sampler.input, 'animation input'); ref(decoded, sampler.output, 'animation output');
      check(times.type === 'SCALAR' && times.componentType === 5126 && !times.normalized, 'animation times must be FLOAT SCALAR');
      check(['LINEAR', 'STEP', 'CUBICSPLINE'].includes(sampler.interpolation ?? 'LINEAR'), 'unsupported animation interpolation');
      check(times.values.every(([t], i) => t >= 0 && (i === 0 || t > times.values[i - 1][0])), 'animation times must be finite, nonnegative and strictly increasing');
      if (selected && clipName !== undefined) {
        const timeline = times.values.map(([t]) => t);
        check(timeline.length >= 2 && timeline[0] === 0, 'named animation sample times must start at zero with at least two samples');
        const step = timeline[1];
        check(timeline.every((t, i) => Math.abs(t - i * step) <= Math.max(2e-6, t * 1e-6)), 'named animation sample times must be uniformly spaced');
        if (referenceTimes) check(timeline.length === referenceTimes.length && timeline.every((t, i) => Math.abs(t - referenceTimes[i]) <= Math.max(2e-6, t * 1e-6)), 'named animation samplers must share a common timeline');
        else referenceTimes = timeline;
      }
      if (selected && fps !== undefined) check(times.count === frames && times.values.every(([t], i) => Math.abs(t - i / fps) <= Math.max(2e-6, i / fps * 1e-6)), 'animation sample times must start at zero and match frames/fps uniformly');
      duration = Math.max(duration, times.values.at(-1)[0]);
    }
    for (const channel of clip.channels) {
      const sampler = ref(clip.samplers, channel.sampler, 'animation channel sampler'); used.add(channel.sampler);
      const node = ref(nodes, channel.target?.node, 'animation target node'); const path = channel.target.path;
      check(activeNodes.has(channel.target.node), 'animation target must be reachable from the default scene');
      check(['translation', 'rotation', 'scale'].includes(path), 'unknown or unsupported animation target path');
      check(node.matrix === undefined, 'animation target cannot use matrix transform');
      const key = `${channel.target.node}:${path}`; check(!targets.has(key), 'duplicate animation target/path'); targets.add(key);
      const times = decoded[sampler.input]; const output = decoded[sampler.output]; const cubic = sampler.interpolation === 'CUBICSPLINE';
      check(output.componentType === 5126 && !output.normalized && output.type === (path === 'rotation' ? 'VEC4' : 'VEC3') && output.count === times.count * (cubic ? 3 : 1), 'animation output dimensions/component/count do not match target path');
      if (path === 'rotation') for (let i = cubic ? 1 : 0; i < output.count; i += cubic ? 3 : 1) quaternion(output.values[i], 'animation rotation');
    }
    check(used.size === clip.samplers.length, 'animation has unused samplers');
    if (selected && fps !== undefined) check(Math.abs(duration - (frames - 1) / fps) <= Math.max(2e-6, duration * 1e-6), 'animation duration must equal (frames-1)/fps');
    return { name: clip.name, duration, channels: clip.channels.length, ...(selected && frames !== undefined ? { frames } : {}), index: clipIndex };
  });
  const skeletonEntries = skin ? skin.joints.map((node, i) => {
    let parent = parents[node]; while (parent >= 0 && !skin.joints.includes(parent)) parent = parents[parent];
    return { name: bones[i], parent: parent < 0 ? null : nodes[parent].name, local: local[node], world: world[node], inverseBind: inverseBinds[i] };
  }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0) : [];
  return { skeleton: requireHumanoid ? HUMANOID_PROFILE : null, bones, bounds: [lower, upper], animations,
    skeletonHash: createHash('sha256').update(JSON.stringify(skeletonEntries)).digest('hex'), vertices, triangles, skinnedPrimitives, mock: json.extras?.mock === true };
}
