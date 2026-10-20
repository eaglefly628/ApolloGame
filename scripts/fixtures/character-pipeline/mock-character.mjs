import { HUMANOID_BONES, HUMANOID_PROFILE } from '../../lib/character-glb.mjs';

/** Deliberately tiny test fixture; never an Auto-Rig Pro or provider output. */
export function makeMockCharacterGlb({ clipName, fps = 30, frames = 31 } = {}) {
  if (!Number.isInteger(fps) || fps < 1 || fps > 120 || !Number.isInteger(frames) || frames < 2 || frames > 36001) throw new Error('Mock fixture fps/frames out of range');
  if (clipName !== undefined && (typeof clipName !== 'string' || !clipName.trim())) throw new Error('Mock fixture clipName must be nonempty');
  const parent = [-1, 0, 1, 2, 3, 2, 5, 6, 2, 8, 9, 0, 11, 12, 0, 14, 15];
  const positions = [[0, 0.95, 0], [0, 1.15, 0], [0, 1.4, 0], [0, 1.55, 0], [0, 1.68, 0],
    [-0.2, 1.4, 0], [-0.48, 1.4, 0], [-0.7, 1.4, 0], [0.2, 1.4, 0], [0.48, 1.4, 0], [0.7, 1.4, 0],
    [-0.13, 0.9, 0], [-0.13, 0.5, 0], [-0.13, 0.08, 0], [0.13, 0.9, 0], [0.13, 0.5, 0], [0.13, 0.08, 0]];
  const nodes = HUMANOID_BONES.map((name, i) => ({ name,
    translation: positions[i].map((v, k) => v - (parent[i] < 0 ? 0 : positions[parent[i]][k])),
    ...(parent.includes(i) ? { children: parent.flatMap((p, j) => p === i ? [j] : []) } : {}),
  }));
  nodes.push({ name: 'MockCharacterMesh', mesh: 0, skin: 0 });
  const binaryParts = []; const bufferViews = []; const accessors = []; let byteLength = 0;
  function accessor(values, componentType, type, count, extra = {}) {
    const pad = (4 - byteLength % 4) % 4;
    if (pad) { binaryParts.push(Buffer.alloc(pad)); byteLength += pad; }
    const bytes = Buffer.alloc(values.length * (componentType === 5126 ? 4 : 2));
    values.forEach((value, i) => componentType === 5126 ? bytes.writeFloatLE(value, i * 4) : bytes.writeUInt16LE(value, i * 2));
    bufferViews.push({ buffer: 0, byteOffset: byteLength, byteLength: bytes.length }); binaryParts.push(bytes); byteLength += bytes.length;
    accessors.push({ bufferView: bufferViews.length - 1, componentType, type, count, ...extra }); return accessors.length - 1;
  }
  const position = accessor([-0.3, 0, 0, 0.3, 0, 0, 0, 1.8, 0.05], 5126, 'VEC3', 3, { min: [-0.3, 0, 0], max: [0.3, 1.8, 0.05] });
  const joints = accessor([0, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0], 5123, 'VEC4', 3);
  const weights = accessor([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 5126, 'VEC4', 3);
  const indices = accessor([0, 1, 2], 5123, 'SCALAR', 3);
  const inverseBindMatrices = accessor(positions.flatMap(([x, y, z]) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -x, -y, -z, 1]), 5126, 'MAT4', HUMANOID_BONES.length);
  const animations = [];
  if (clipName !== undefined) {
    const times = Array.from({ length: frames }, (_, i) => i / fps);
    // The endpoint changes even for a two-sample clip; the skin really moves.
    const motion = times.flatMap((_, i) => [0.05 * i / (frames - 1), 0.95, 0]);
    const input = accessor(times, 5126, 'SCALAR', frames, { min: [0], max: [(frames - 1) / fps] });
    const output = accessor(motion, 5126, 'VEC3', frames);
    animations.push({ name: clipName, samplers: [{ input, output, interpolation: 'LINEAR' }], channels: [{ sampler: 0, target: { node: 0, path: 'translation' } }] });
  }
  const document = { asset: { version: '2.0', generator: 'Apollo character unit-test fixture' },
    extras: { mock: true, fixture: true, skeleton: HUMANOID_PROFILE, provenance: 'Synthetic test triangle; not ARP, Blender or provider evidence' },
    scene: 0, scenes: [{ nodes: [0, nodes.length - 1] }], nodes,
    meshes: [{ primitives: [{ attributes: { POSITION: position, JOINTS_0: joints, WEIGHTS_0: weights }, indices }] }],
    skins: [{ skeleton: 0, joints: HUMANOID_BONES.map((_, i) => i), inverseBindMatrices }],
    animations, accessors, bufferViews, buffers: [{ byteLength }],
  };
  const jsonBytes = Buffer.from(JSON.stringify(document)); const jsonPadded = Buffer.alloc(Math.ceil(jsonBytes.length / 4) * 4, 0x20); jsonBytes.copy(jsonPadded);
  const binPadded = Buffer.alloc(Math.ceil(byteLength / 4) * 4); Buffer.concat(binaryParts).copy(binPadded);
  const glb = Buffer.alloc(12 + 8 + jsonPadded.length + 8 + binPadded.length);
  glb.writeUInt32LE(0x46546c67, 0); glb.writeUInt32LE(2, 4); glb.writeUInt32LE(glb.length, 8);
  glb.writeUInt32LE(jsonPadded.length, 12); glb.writeUInt32LE(0x4e4f534a, 16); jsonPadded.copy(glb, 20);
  const binHeader = 20 + jsonPadded.length;
  glb.writeUInt32LE(binPadded.length, binHeader); glb.writeUInt32LE(0x004e4942, binHeader + 4); binPadded.copy(glb, binHeader + 8);
  return glb;
}
