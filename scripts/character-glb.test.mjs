import { describe, expect, it } from 'vitest';
import { HUMANOID_BONES, HUMANOID_PROFILE, inspectCharacterGlb } from './lib/character-glb.mjs';
import { makeMockCharacterGlb } from './fixtures/character-pipeline/mock-character.mjs';

function unpack(bytes) {
  const length = bytes.readUInt32LE(12); const binHeader = 20 + length;
  return { json: JSON.parse(bytes.subarray(20, binHeader).toString()), bin: Buffer.from(bytes.subarray(binHeader + 8)) };
}
function pack({ json, bin }) {
  json.buffers[0].byteLength = bin.length;
  const text = Buffer.from(JSON.stringify(json)); const j = Buffer.alloc(Math.ceil(text.length / 4) * 4, 32); text.copy(j);
  const b = Buffer.alloc(Math.ceil(bin.length / 4) * 4); bin.copy(b);
  const out = Buffer.alloc(28 + j.length + b.length);
  out.writeUInt32LE(0x46546c67, 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(j.length, 12); out.writeUInt32LE(0x4e4f534a, 16); j.copy(out, 20);
  out.writeUInt32LE(b.length, 20 + j.length); out.writeUInt32LE(0x004e4942, 24 + j.length); b.copy(out, 28 + j.length);
  return out;
}
function edited(edit, options = { clipName: 'walk' }) { const parts = unpack(makeMockCharacterGlb(options)); edit(parts.json, parts.bin, parts); return pack(parts); }
function offset(json, index) { const a = json.accessors[index]; return (json.bufferViews[a.bufferView].byteOffset ?? 0) + (a.byteOffset ?? 0); }
const primitive = (json) => json.meshes[0].primitives[0];
const pos = (json) => primitive(json).attributes.POSITION;
const weights = (json) => primitive(json).attributes.WEIGHTS_0;
const joints = (json) => primitive(json).attributes.JOINTS_0;
const times = (json) => json.animations[0].samplers[0].input;
const output = (json) => json.animations[0].samplers[0].output;

describe('real character GLB fixture and inspection', () => {
  it('has real geometry, complete named skin, finite metre bounds and explicit mock provenance', () => {
    const bytes = makeMockCharacterGlb(); const { json } = unpack(bytes); const result = inspectCharacterGlb(bytes);
    expect(result.skeleton).toBe(HUMANOID_PROFILE); expect(result.bones).toEqual(HUMANOID_BONES);
    expect(result.vertices).toBe(3); expect(result.triangles).toBe(1); expect(result.skinnedPrimitives).toBe(1);
    expect(result.bounds[0][1]).toBeCloseTo(0, 6); expect(result.bounds[1][1]).toBeCloseTo(1.8, 6);
    expect(result.animations).toEqual([]); expect(result.mock).toBe(true); expect(json.extras.provenance).toContain('not ARP');
    expect(result.skeletonHash).toMatch(/^[a-f0-9]{64}$/);
    expect(inspectCharacterGlb(new Uint8Array(bytes)).skeletonHash).toBe(result.skeletonHash);
    expect(inspectCharacterGlb(Uint8Array.from(bytes).buffer).skeletonHash).toBe(result.skeletonHash);
  });
  it.each([[1, 2], [30, 31], [120, 241], [1, 36001]])('contains actual sampled motion at %i fps with %i inclusive endpoints', (fps, frames) => {
    const bytes = makeMockCharacterGlb({ clipName: 'walk', fps, frames }); const { json, bin } = unpack(bytes);
    const result = inspectCharacterGlb(bytes, { clipName: 'walk', fps, frames });
    expect(result.animations[0]).toMatchObject({ name: 'walk', channels: 1, frames });
    expect(result.animations[0].duration).toBeCloseTo((frames - 1) / fps, 4);
    expect(bin.readFloatLE(offset(json, output(json)))).not.toBe(bin.readFloatLE(offset(json, output(json)) + (frames - 1) * 12));
  });
  it('fingerprints skeleton rest state and IBM while excluding mesh/clip contents', () => {
    const original = inspectCharacterGlb(makeMockCharacterGlb()).skeletonHash;
    expect(inspectCharacterGlb(makeMockCharacterGlb({ clipName: 'run' })).skeletonHash).toBe(original);
    expect(inspectCharacterGlb(edited((j, b) => b.writeFloatLE(-0.4, offset(j, pos(j))))).skeletonHash).toBe(original);
    expect(inspectCharacterGlb(edited((j) => { j.nodes[4].translation[1] += 0.01; })).skeletonHash).not.toBe(original);
    expect(inspectCharacterGlb(edited((j, b) => b.writeFloatLE(0.1, offset(j, j.skins[0].inverseBindMatrices) + 48))).skeletonHash).not.toBe(original);
  });
  it('accepts additional named intermediary bones without requiring direct profile parent links', () => {
    const bytes = edited((j, b, parts) => {
      j.nodes.push({ name: 'UpperChest', children: [3] }); j.nodes[2].children = j.nodes[2].children.map((i) => i === 3 ? 18 : i);
      j.skins[0].joints.push(18);
      const a = j.accessors[j.skins[0].inverseBindMatrices]; const old = b.subarray(offset(j, j.skins[0].inverseBindMatrices), offset(j, j.skins[0].inverseBindMatrices) + a.count * 64);
      const next = Buffer.alloc((a.count + 1) * 64); old.copy(next); old.subarray(2 * 64, 3 * 64).copy(next, a.count * 64);
      j.bufferViews.push({ buffer: 0, byteOffset: b.length, byteLength: next.length }); a.bufferView = j.bufferViews.length - 1; a.count++;
      parts.bin = Buffer.concat([b, next]);
    });
    expect(inspectCharacterGlb(bytes).bones).toContain('UpperChest');
  });
  it('reads strided interleaved POSITION values rather than metadata bounds', () => {
    const bytes = edited((j, b, parts) => {
      const a = j.accessors[pos(j)]; const source = offset(j, pos(j)); const interleaved = Buffer.alloc(48);
      for (let i = 0; i < 3; i++) b.copy(interleaved, i * 16, source + i * 12, source + i * 12 + 12);
      j.bufferViews.push({ buffer: 0, byteOffset: b.length, byteLength: 48, byteStride: 16 }); a.bufferView = j.bufferViews.length - 1; a.max = [999, 999, 999];
      parts.bin = Buffer.concat([b, interleaved]);
    });
    expect(inspectCharacterGlb(bytes).bounds[1][1]).toBeCloseTo(1.8, 6);
  });
  it('supports normalized unsigned byte weights', () => {
    const bytes = edited((j, b, parts) => {
      const a = j.accessors[weights(j)]; const values = Buffer.from([255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0]);
      j.bufferViews.push({ buffer: 0, byteOffset: b.length, byteLength: values.length }); a.bufferView = j.bufferViews.length - 1; a.componentType = 5121; a.normalized = true;
      parts.bin = Buffer.concat([b, values]);
    });
    expect(inspectCharacterGlb(bytes).bounds[1][1]).toBeCloseTo(1.8, 6);
  });
  it('can explicitly inspect static geometry without a skin or humanoid requirement', () => {
    const bytes = edited((j) => { delete j.skins; delete j.nodes[17].skin; delete primitive(j).attributes.JOINTS_0; delete primitive(j).attributes.WEIGHTS_0; });
    expect(inspectCharacterGlb(bytes, { requireSkin: false, requireHumanoid: false }).triangles).toBe(1);
    expect(() => inspectCharacterGlb(bytes)).toThrow(/skin/);
  });
});

describe('GLB container and accessor rejection', () => {
  it.each([
    ['magic', (b) => b.writeUInt32LE(0, 0), /header/],
    ['version', (b) => b.writeUInt32LE(1, 4), /version/],
    ['declared length', (b) => b.writeUInt32LE(b.length + 4, 8), /length/],
    ['first chunk type', (b) => b.writeUInt32LE(0x004e4942, 16), /JSON/],
    ['chunk overrun', (b) => b.writeUInt32LE(b.length, 12), /chunk/],
    ['chunk alignment', (b) => b.writeUInt32LE(b.readUInt32LE(12) - 1, 12), /alignment/],
    ['JSON syntax', (b) => { b[20] = 0; }, /JSON/],
  ])('rejects corrupt %s', (_, edit, pattern) => { const bytes = makeMockCharacterGlb(); edit(bytes); expect(() => inspectCharacterGlb(bytes)).toThrow(pattern); });
  it('rejects truncation and trailing chunks', () => {
    expect(() => inspectCharacterGlb(Buffer.alloc(8))).toThrow(/truncated/);
    const valid = makeMockCharacterGlb(); const trailing = Buffer.concat([valid, Buffer.alloc(8)]); trailing.writeUInt32LE(trailing.length, 8);
    expect(() => inspectCharacterGlb(trailing)).toThrow(/one JSON/);
  });
  it.each([
    ['external buffer', (j) => { j.buffers[0].uri = 'https://invalid/mesh.bin'; }, /self-contained/],
    ['multiple buffers', (j) => { j.buffers.push({ byteLength: 1 }); }, /one self-contained/],
    ['external image', (j) => { j.images = [{ uri: '../texture.png' }]; }, /self-contained/],
    ['Draco', (j) => { j.extensionsUsed = ['KHR_draco_mesh_compression']; }, /decompress/],
    ['undeclared meshopt', (j) => { j.bufferViews[0].extensions = { EXT_meshopt_compression: {} }; }, /decompress/],
    ['sparse', (j) => { j.accessors[0].sparse = {}; }, /sparse/],
    ['invalid component', (j) => { j.accessors[0].componentType = 5130; }, /component/],
    ['zero count', (j) => { j.accessors[0].count = 0; }, /count/],
    ['fractional count', (j) => { j.accessors[0].count = 3.5; }, /count/],
    ['accessor count overrun', (j) => { j.accessors[0].count = 900; }, /range exceeds/],
    ['accessor offset', (j) => { j.accessors[0].byteOffset = 2; }, /alignment/],
    ['accessor reference', (j) => { j.accessors[0].bufferView = 999; }, /reference out of range/],
    ['bufferView range', (j) => { j.bufferViews[0].byteLength = 1e9; }, /range out of buffer/],
    ['bufferView offset', (j) => { j.bufferViews[0].byteOffset = -4; }, /range out of buffer/],
    ['bufferView stride', (j) => { j.bufferViews[0].byteStride = 8; }, /alignment invalid/],
    ['bufferView oversized stride', (j) => { j.bufferViews[0].byteStride = 256; }, /byteStride/],
    ['invalid normalized float', (j) => { j.accessors[0].normalized = true; }, /normalized component/],
    ['nonfinite POSITION', (j, b) => b.writeFloatLE(NaN, offset(j, pos(j))), /non-finite component/],
    ['nonfinite unused accessor', (j, b) => b.writeFloatLE(Infinity, offset(j, weights(j))), /non-finite component/],
  ])('rejects %s', (_, edit, pattern) => { expect(() => inspectCharacterGlb(edited(edit))).toThrow(pattern); });
});

describe('mesh and skeleton rejection', () => {
  it.each([
    ['only the skeleton is in the default scene', (j) => { j.scenes[0].nodes = [0]; }, /triangle geometry.*default scene/],
    ['empty default scene', (j) => { j.scenes[0].nodes = []; }, /default scene must not be empty/],
    ['mesh exists only in another scene', (j) => { j.scenes[0].nodes = [0]; j.scenes.push({ nodes: [17] }); }, /triangle geometry.*default scene/],
    ['all valid content exists only in another scene', (j) => { j.scenes.unshift({ nodes: [] }); }, /default scene must not be empty/],
    ['skeleton exists only outside the default scene', (j) => { j.scenes[0].nodes = [17]; }, /skin joint.*default scene/],
    ['one joint exists outside the default scene', (j) => { j.nodes[6].children = []; }, /skin joint.*default scene/],
    ['declared skeleton root exists outside the default scene', (j) => { j.nodes.push({ name: 'OutsideSkeleton' }); j.skins[0].skeleton = 18; }, /skin skeleton.*default scene/],
    ['multiple scenes without an explicit default scene', (j) => { delete j.scene; j.scenes.push({ nodes: [0] }); }, /explicit default scene/],
    ['animation targets a node outside the default scene', (j) => { j.nodes.push({ name: 'InvisibleMotionTarget' }); j.animations[0].channels[0].target.node = 18; }, /animation target.*default scene/],
    ['static default mesh with a skin mesh only in another scene', (j) => {
      j.meshes.push({ primitives: [{ attributes: { POSITION: pos(j) }, indices: primitive(j).indices }] });
      j.nodes.push({ name: 'StaticMesh', mesh: 1 }); j.scenes[0].nodes = [0, 18]; j.scenes.push({ nodes: [17] });
    }, /skin must be used.*default scene/],
  ])('rejects %s', (_, edit, pattern) => { expect(() => inspectCharacterGlb(edited(edit))).toThrow(pattern); });
  it('uses the explicitly selected scene and permits an unselected scene with no mesh', () => {
    const bytes = edited((j) => { j.scenes.unshift({ nodes: [0] }); j.scene = 1; });
    expect(inspectCharacterGlb(bytes).skinnedPrimitives).toBe(1);
  });
  it('accepts the sole scene as the default when glTF omits the optional scene index', () => {
    expect(inspectCharacterGlb(edited((j) => { delete j.scene; })).skinnedPrimitives).toBe(1);
  });
  it('rejects invisible joints even when optional skin.skeleton and all animations are absent', () => {
    const bytes = edited((j) => { j.scenes[0].nodes = [17]; delete j.skins[0].skeleton; }, {});
    expect(() => inspectCharacterGlb(bytes)).toThrow(/skin joint.*default scene/);
  });
  it.each([
    ['empty nodes instead of geometry', (j) => { delete j.meshes; delete j.nodes[17].mesh; delete j.nodes[17].skin; }, /triangle mesh/],
    ['unused skin', (j) => { delete j.nodes[17].skin; delete primitive(j).attributes.JOINTS_0; delete primitive(j).attributes.WEIGHTS_0; }, /skin must be used/],
    ['POSITION shape', (j) => { const a = j.accessors[pos(j)]; a.type = 'VEC2'; delete a.min; delete a.max; }, /POSITION/],
    ['out of bounds triangle index', (j, b) => b.writeUInt16LE(3, offset(j, primitive(j).indices)), /triangle indices/],
    ['degenerate geometry', (j, b) => b.fill(0, offset(j, pos(j)), offset(j, pos(j)) + 36), /nondegenerate/],
    ['missing JOINTS_0', (j) => { delete primitive(j).attributes.JOINTS_0; }, /JOINTS_0/],
    ['missing WEIGHTS_0', (j) => { delete primitive(j).attributes.WEIGHTS_0; }, /WEIGHTS_0/],
    ['mismatched skin vertex counts', (j) => { j.accessors[joints(j)].count = 2; }, /count differs/],
    ['out of bounds joint including zero weight', (j, b) => b.writeUInt16LE(17, offset(j, joints(j)) + 2), /joint index out of skin range/],
    ['negative weight', (j, b) => b.writeFloatLE(-1, offset(j, weights(j))), /weights must/],
    ['zero weights', (j, b) => b.writeFloatLE(0, offset(j, weights(j))), /sum to one/],
    ['weight sum over one', (j, b) => b.writeFloatLE(0.5, offset(j, weights(j)) + 4), /sum to one/],
    ['unnormalized integer weights', (j) => { j.accessors[weights(j)].componentType = 5123; }, /WEIGHTS_0 must/],
    ['duplicate joints', (j) => { j.skins[0].joints[1] = 0; }, /joints must/],
    ['joint reference', (j) => { j.skins[0].joints[0] = 900; }, /skin joint reference/],
    ['duplicate bone name', (j) => { j.nodes[1].name = 'Hips'; }, /names must be unique/],
    ['blank bone name', (j) => { j.nodes[1].name = ' '; }, /joint name/],
    ['missing profile bone', (j) => { j.nodes[1].name = 'OtherSpine'; }, /missing required/],
    ['wrong humanoid ancestry', (j) => { j.nodes[2].children = j.nodes[2].children.filter((n) => n !== 5); j.nodes[0].children.push(5); }, /humanoid hierarchy/],
    ['inverse bind count', (j) => { j.accessors[j.skins[0].inverseBindMatrices].count--; }, /joint count/],
    ['singular inverse bind', (j, b) => b.writeFloatLE(0, offset(j, j.skins[0].inverseBindMatrices)), /invertible/],
    ['missing inverse bind', (j) => { delete j.skins[0].inverseBindMatrices; }, /inverseBindMatrices reference/],
    ['nonancestor skeleton root', (j) => { j.skins[0].skeleton = 4; }, /ancestor/],
    ['cycle', (j) => { j.nodes[4].children = [0]; }, /cycle/],
    ['child reference', (j) => { j.nodes[4].children = [1000]; }, /reference out of range/],
    ['multiple parents', (j) => { j.nodes[0].children.push(4); }, /multiple parents/],
    ['mesh reference', (j) => { j.nodes[17].mesh = 999; }, /mesh reference/],
    ['scene reference', (j) => { j.scene = 9; }, /default scene/],
    ['nonfinite local transform', (j) => { j.nodes[0].scale = [1, null, 1]; }, /finite/],
    ['unnormalized node quaternion', (j) => { j.nodes[0].rotation = [0, 0, 0, 2]; }, /quaternion must be normalized/],
  ])('rejects %s', (_, edit, pattern) => { expect(() => inspectCharacterGlb(edited(edit))).toThrow(pattern); });
});

describe('animation contracts', () => {
  it('accepts normalized rotation outputs with actual motion', () => {
    const bytes = edited((j, b, parts) => {
      const count = j.accessors[times(j)].count; const values = Buffer.alloc(count * 16);
      for (let i = 0; i < count; i++) { values.writeFloatLE(Math.sin(i / 100), i * 16 + 8); values.writeFloatLE(Math.cos(i / 100), i * 16 + 12); }
      const a = j.accessors[output(j)]; a.type = 'VEC4';
      j.bufferViews.push({ buffer: 0, byteOffset: b.length, byteLength: values.length }); a.bufferView = j.bufferViews.length - 1;
      j.animations[0].channels[0].target.path = 'rotation'; parts.bin = Buffer.concat([b, values]);
    });
    expect(inspectCharacterGlb(bytes, { clipName: 'walk', fps: 30, frames: 31 }).animations[0].channels).toBe(1);
  });
  it('accepts CUBICSPLINE outputs with three tuples per time sample', () => {
    const bytes = edited((j, b, parts) => {
      const count = j.accessors[times(j)].count; const values = Buffer.alloc(count * 36);
      for (let i = 0; i < count; i++) b.copy(values, i * 36 + 12, offset(j, output(j)) + i * 12, offset(j, output(j)) + i * 12 + 12);
      const a = j.accessors[output(j)]; a.count *= 3;
      j.bufferViews.push({ buffer: 0, byteOffset: b.length, byteLength: values.length }); a.bufferView = j.bufferViews.length - 1;
      j.animations[0].samplers[0].interpolation = 'CUBICSPLINE'; parts.bin = Buffer.concat([b, values]);
    });
    expect(inspectCharacterGlb(bytes, { clipName: 'walk', fps: 30, frames: 31 }).animations[0].frames).toBe(31);
  });
  it('checks a named clip uniform timeline even without an explicit fps contract', () => {
    const bytes = edited((j, b) => b.writeFloatLE(0.04, offset(j, times(j)) + 4));
    expect(inspectCharacterGlb(bytes).animations).toHaveLength(1);
    expect(() => inspectCharacterGlb(bytes, { clipName: 'walk' })).toThrow(/uniformly/);
  });
  it('rejects a wrong endpoint-inclusive sample count even when the total duration matches', () => {
    const bytes = makeMockCharacterGlb({ clipName: 'walk', fps: 30, frames: 31 });
    expect(() => inspectCharacterGlb(bytes, { clipName: 'walk', fps: 60, frames: 61 })).toThrow(/match frames\/fps/);
  });
  it('rejects independently uniform samplers with different endpoint-inclusive timelines', () => {
    const bytes = edited((j, b, parts) => {
      const count = j.accessors[times(j)].count; const values = Buffer.alloc(count * 4);
      for (let i = 0; i < count; i++) values.writeFloatLE(i / 60, i * 4);
      j.bufferViews.push({ buffer: 0, byteOffset: b.length, byteLength: values.length });
      j.accessors.push({ bufferView: j.bufferViews.length - 1, componentType: 5126, type: 'SCALAR', count });
      j.animations[0].samplers.push({ input: j.accessors.length - 1, output: output(j) });
      j.animations[0].channels.push({ sampler: 1, target: { node: 1, path: 'translation' } }); parts.bin = Buffer.concat([b, values]);
    });
    expect(() => inspectCharacterGlb(bytes, { clipName: 'walk' })).toThrow(/common timeline/);
  });
  it.each([
    ['missing clip', (j) => { j.animations[0].name = 'run'; }, /exactly one/],
    ['ambiguous clip', (j) => { j.animations.push(structuredClone(j.animations[0])); }, /exactly one/],
    ['unknown channel', (j) => { j.animations[0].channels[0].target.path = 'teleport'; }, /target path/],
    ['target out of range', (j) => { j.animations[0].channels[0].target.node = 900; }, /target node reference/],
    ['sampler out of range', (j) => { j.animations[0].channels[0].sampler = 900; }, /sampler reference/],
    ['output dimensions', (j) => { j.accessors[output(j)].type = 'VEC2'; }, /output dimensions/],
    ['output sample count', (j) => { j.accessors[output(j)].count--; }, /output dimensions/],
    ['nonfinite animation time', (j, b) => b.writeFloatLE(Infinity, offset(j, times(j)) + 4), /non-finite/],
    ['decreasing time', (j, b) => b.writeFloatLE(0, offset(j, times(j)) + 4), /strictly increasing/],
    ['negative time', (j, b) => b.writeFloatLE(-1, offset(j, times(j))), /nonnegative/],
    ['nonzero first time', (j, b) => b.writeFloatLE(0.001, offset(j, times(j))), /start at zero/],
    ['uneven timeline', (j, b) => b.writeFloatLE(0.04, offset(j, times(j)) + 4), /uniformly/],
    ['wrong endpoint', (j, b) => b.writeFloatLE(1.1, offset(j, times(j)) + 30 * 4), /uniformly/],
    ['unknown interpolation', (j) => { j.animations[0].samplers[0].interpolation = 'BEZIER'; }, /interpolation/],
    ['duplicate target path', (j) => { j.animations[0].channels.push(structuredClone(j.animations[0].channels[0])); }, /duplicate animation/],
  ])('rejects %s', (_, edit, pattern) => { expect(() => inspectCharacterGlb(edited(edit), { clipName: 'walk', fps: 30, frames: 31 })).toThrow(pattern); });
  it('normalizes neither invalid quaternion values nor unknown target paths', () => {
    const bytes = edited((j, b, parts) => {
      const count = j.accessors[times(j)].count; const values = Buffer.alloc(count * 16);
      for (let i = 0; i < count; i++) values.writeFloatLE(2, i * 16 + 12);
      const a = j.accessors[output(j)]; a.type = 'VEC4';
      j.bufferViews.push({ buffer: 0, byteOffset: b.length, byteLength: values.length }); a.bufferView = j.bufferViews.length - 1;
      j.animations[0].channels[0].target.path = 'rotation'; parts.bin = Buffer.concat([b, values]);
    });
    expect(() => inspectCharacterGlb(bytes)).toThrow(/animation rotation quaternion must be normalized/);
  });
  it.each([{ fps: 0, frames: 31 }, { fps: 121, frames: 31 }, { fps: 30.5, frames: 31 }, { fps: 30, frames: 1 }, { fps: 30, frames: 36002 }, { fps: 30 }, { frames: 31 }])('rejects invalid sample contract %j', (options) => {
    expect(() => inspectCharacterGlb(makeMockCharacterGlb({ clipName: 'walk' }), options)).toThrow(/fps|frames/);
  });
});


describe('static skin texture transform compatibility', () => {
  const options = { allowSkinMaterialExtensions: true };
  function transformed(payload = { offset: [1, -1] }, edit = () => {}) {
    return edited((json, bin, parts) => {
      const uv = Buffer.alloc(24); [0,0,1,0,0,1].forEach((n,i) => uv.writeFloatLE(n,i*4));
      json.bufferViews.push({buffer:0,byteOffset:bin.length,byteLength:uv.length});
      json.accessors.push({bufferView:json.bufferViews.length-1,componentType:5126,count:3,type:'VEC2'});
      primitive(json).attributes.TEXCOORD_0=json.accessors.length-1;primitive(json).attributes.TEXCOORD_1=json.accessors.length-1;parts.bin=Buffer.concat([bin,uv]);
      json.extensionsUsed = ['KHR_texture_transform']; json.extensionsRequired = ['KHR_texture_transform'];
      json.images = [{ uri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==' }];
      json.textures = [{ source: 0 }];
      json.materials = [{ pbrMetallicRoughness: { baseColorTexture: { index: 0, extensions: { KHR_texture_transform: payload } } } }];
      primitive(json).material = 0; edit(json);
    }, {});
  }
  it('accepts a required UV transform only for static skins without changing input bytes', () => {
    const bytes = transformed({ offset: [1, -1], scale: [-2, 0.5], rotation: Math.PI, texCoord: 1 }), before = Buffer.from(bytes);
    expect(inspectCharacterGlb(bytes, options).bones).toEqual(HUMANOID_BONES); expect(bytes).toEqual(before);
    expect(() => inspectCharacterGlb(bytes)).toThrow(/extensions/);
  });
  it.each([{ offset: [1] }, { offset: [1, 'bad'] }, { scale: [1, 2, 3] }, { rotation: 'bad' }, { texCoord: -1 }, { texCoord: 0.5 }, { python: 'exec' }])('rejects invalid transform payload %j', payload => { expect(() => inspectCharacterGlb(transformed(payload), options)).toThrow(/KHR_texture_transform/); });
  it.each([
    json => { json.materials[0].pbrMetallicRoughness.baseColorTexture.index = 999; },
    json => { json.textures[0].source = 999; },
    json => { json.textures[0].sampler = 999; },
    json => { json.images[0].uri = 'https://invalid.example/texture.png'; },
    json => { json.materials[0].pbrMetallicRoughness.baseColorTexture.texCoord = -1; },
  ])('rejects invalid texture dependencies', edit => { expect(() => inspectCharacterGlb(transformed({}, edit), options)).toThrow(); });
  it.each([
    json => { json.materials[0].pbrMetallicRoughness.baseColorTexture.extensions.KHR_texture_transform.texCoord = 99; },
    json => { delete primitive(json).attributes.TEXCOORD_0; },
    json => { primitive(json).attributes.TEXCOORD_0 = primitive(json).attributes.POSITION; },
    json => { primitive(json).attributes.TEXCOORD_0 = 999; },
    json => { const second=structuredClone(primitive(json));delete second.attributes.TEXCOORD_0;json.meshes[0].primitives.push(second); },
  ])('rejects unavailable or invalid UV accessors on every material primitive', edit => { expect(() => inspectCharacterGlb(transformed({}, edit), options)).toThrow(/KHR_texture_transform/); });
  it.each(['node', 'primitive', 'material', 'nested'])('rejects texture transforms at unsupported %s locations', location => {
    expect(() => inspectCharacterGlb(transformed({}, json => {
      const extension = { KHR_texture_transform: { offset: [1, -1] } };
      if (location === 'node') json.nodes[0].extensions = extension;
      if (location === 'primitive') primitive(json).extensions = extension;
      if (location === 'material') json.materials[0].extensions = extension;
      if (location === 'nested') json.materials[0].pbrMetallicRoughness.baseColorTexture.extensions.KHR_texture_transform.extensions = extension;
    }), options)).toThrow(/extensions/);
  });
  it.each(['KHR_draco_mesh_compression', 'EXT_meshopt_compression', 'KHR_unknown'])('keeps %s rejected in skin opt-in', name => { expect(() => inspectCharacterGlb(transformed({}, json => { json.extensionsUsed.push(name); primitive(json).extensions = { [name]: {} }; }), options)).toThrow(/extensions/); });
  it('keeps animated skins rejected from material extension opt-in', () => { const bytes = edited(json => { const source = unpack(transformed()).json; for (const key of ['extensionsUsed', 'extensionsRequired', 'images', 'textures', 'materials']) json[key] = source[key]; }); expect(() => inspectCharacterGlb(bytes, options)).toThrow(/static skins/); });
});
