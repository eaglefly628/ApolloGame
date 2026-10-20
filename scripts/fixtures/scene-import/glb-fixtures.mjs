// Independent authored binary fixtures: expected geometry is never read from min/max.
export function glb(json, binary = Buffer.alloc(0)) {
  const raw = Buffer.from(JSON.stringify(json)), text = Buffer.concat([raw, Buffer.alloc((4 - raw.length % 4) % 4, 32)]);
  const bin = Buffer.concat([binary, Buffer.alloc((4 - binary.length % 4) % 4)]), bytes = Buffer.alloc(20 + text.length + (bin.length ? 8 + bin.length : 0));
  bytes.write('glTF'); bytes.writeUInt32LE(2, 4); bytes.writeUInt32LE(bytes.length, 8); bytes.writeUInt32LE(text.length, 12); bytes.writeUInt32LE(0x4e4f534a, 16); text.copy(bytes, 20);
  if (bin.length) { bytes.writeUInt32LE(bin.length, 20 + text.length); bytes.writeUInt32LE(0x004e4942, 24 + text.length); bin.copy(bytes, 28 + text.length); }
  return bytes;
}
export function unpack(bytes) { const length = bytes.readUInt32LE(12); return { json: JSON.parse(bytes.toString('utf8', 20, 20 + length)), binary: bytes.subarray(28 + length) }; }
export function triangle({ positions = [0, 0, 0, 2, 0, 0, 0, 0, 3], indices = [2, 0, 1], stride = 12, componentType = 5126, normalized = false, indexed = true } = {}) {
  const position = Buffer.alloc(positions.length / 3 * stride, 0x5a), index = Buffer.alloc(indices.length * 2);
  positions.forEach((value, i) => { const offset = Math.floor(i / 3) * stride + (i % 3) * (componentType === 5126 ? 4 : 2); if (componentType === 5126) position.writeFloatLE(value, offset); else position.writeInt16LE(value, offset); });
  indices.forEach((value, i) => index.writeUInt16LE(value, i * 2));
  const binary = Buffer.concat([position, index]);
  const json = { asset: { version: '2.0', generator: 'Apollo explicitly authored offline E5 fixture' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ name: 'nav_floor', mesh: 0 }], meshes: [{ primitives: [{ attributes: { POSITION: 0 }, ...(indexed ? { indices: 1 } : {}) }] }], accessors: [{ bufferView: 0, componentType, count: positions.length / 3, type: 'VEC3', normalized, min: [-999, -999, -999], max: [999, 999, 999] }, { bufferView: 1, componentType: 5123, count: indices.length, type: 'SCALAR' }], bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: position.length, byteStride: stride }, { buffer: 0, byteOffset: position.length, byteLength: index.length }], buffers: [{ byteLength: binary.length }] };
  if (componentType !== 5126) { json.extensionsUsed = ['KHR_mesh_quantization']; json.extensionsRequired = [...json.extensionsUsed]; }
  return { json, binary, bytes: () => glb(json, binary) };
}
