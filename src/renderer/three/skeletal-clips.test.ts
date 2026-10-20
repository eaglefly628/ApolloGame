import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import type { SkeletalAnimationDescriptor } from '@assets/index.js';
// @ts-expect-error The offline fixture intentionally has no production TS API.
import { makeMockCharacterGlb } from '../../../scripts/fixtures/character-pipeline/mock-character.mjs';
import { assertSameSkeleton, bindSkeletalClip, captureSkeletonRest, extractSkeletalClip, snapshotSkeletalGlb } from './skeletal-clips.js';

const descriptor: SkeletalAnimationDescriptor = { kind: 'skeletal-animation', key: 'walk', src: '/walk.glb', skeleton: 'apollo-humanoid-v1', fps: 30, frames: 31, loop: true };
const scenes: THREE.Object3D[] = [];
function glb(options: Record<string, unknown> = { clipName: 'walk' }, edit?: (json: any, bin: Buffer) => void): ArrayBuffer {
  let bytes: Buffer = makeMockCharacterGlb(options);
  if (edit) {
    const length = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + length).toString()), bin = Buffer.from(bytes.subarray(28 + length)); edit(json, bin);
    const text = Buffer.from(JSON.stringify(json)), padded = Buffer.alloc(Math.ceil(text.length / 4) * 4, 32); text.copy(padded);
    bytes = Buffer.alloc(28 + padded.length + bin.length);
    bytes.writeUInt32LE(0x46546c67, 0); bytes.writeUInt32LE(2, 4); bytes.writeUInt32LE(bytes.length, 8);
    bytes.writeUInt32LE(padded.length, 12); bytes.writeUInt32LE(0x4e4f534a, 16); padded.copy(bytes, 20);
    bytes.writeUInt32LE(bin.length, 20 + padded.length); bytes.writeUInt32LE(0x004e4942, 24 + padded.length); bin.copy(bytes, 28 + padded.length);
  }
  return Uint8Array.from(bytes).buffer;
}
async function parsed(options: Record<string, unknown> = { clipName: 'walk' }, edit?: (json: any, bin: Buffer) => void): Promise<GLTF> {
  const result = await new GLTFLoader().parseAsync(glb(options, edit), ''); scenes.push(result.scene); return result;
}
function extract(gltf: GLTF, spec = descriptor) { return extractSkeletalClip(gltf.scene, gltf.animations, spec, gltf.parser); }
afterEach(() => {
  const disposed = new Set<object>();
  for (const scene of scenes.splice(0)) scene.traverse(o => {
    const mesh = o as THREE.SkinnedMesh;
    for (const resource of [mesh.geometry, mesh.skeleton, ...(Array.isArray(mesh.material) ? mesh.material : [mesh.material])]) if (resource && !disposed.has(resource)) { disposed.add(resource); resource.dispose(); }
  });
});

describe('external skeletal clip decoded validation', () => {
  it('extracts actual inclusive uniform samples and preserves the source while binding UUID tracks to unique bones', async () => {
    const gltf = await parsed(), source = extract(gltf), target = clone(gltf.scene), rest = captureSkeletonRest(gltf.scene, gltf.parser);
    scenes.push(target);
    const sourceName = gltf.animations[0].tracks[0].name;
    const mesh = target.getObjectByName('MockCharacterMesh')!; mesh.name = 'Hips';
    const bone = (() => { let result!: THREE.Bone; target.traverse(n => { if ((n as THREE.Bone).isBone && n.name === 'Hips') result = n as THREE.Bone; }); return result; })();
    target.position.set(30, 40, 50); bone.position.x = 8;
    const rebound = bindSkeletalClip(source, 'walk', target, rest);
    expect(rebound.tracks[0].name).toBe(`${bone.uuid}.position`); expect(source.clip.tracks[0].name).toBe(sourceName); expect(rebound.tracks[0]).not.toBe(source.clip.tracks[0]);
    const mixer = new THREE.AnimationMixer(target); mixer.clipAction(rebound).play(); mixer.update(.5);
    expect(bone.position.x).toBeCloseTo(.025, 5); expect(mesh.position.x).toBe(0); expect(target.position.toArray()).toEqual([30, 40, 50]);
    mixer.stopAllAction(); mixer.uncacheRoot(target);
  });

  it.each([
    ['no clip', {}], ['two clips', { clipName: 'walk' }],
  ])('requires exactly one clip: %s', async (_, options) => {
    const gltf = await parsed(options); if (gltf.animations.length) gltf.animations.push(gltf.animations[0].clone());
    expect(() => extract(gltf)).toThrow(/exactly one/);
  });

  it('requires an exact requested clip name and a typed profile', async () => {
    const gltf = await parsed(), source = extract(gltf);
    expect(() => bindSkeletalClip(source, 'Walk', gltf.scene, source.rest)).toThrow(/exactly match/);
    expect(() => extract(gltf, { ...descriptor, skeleton: 'other' } as unknown as SkeletalAnimationDescriptor)).toThrow(/profile/);
    expect(() => extract(gltf, { ...descriptor, fps: 29 })).toThrow(/duration|fps/);
    expect(() => extract(gltf, { ...descriptor, frames: 32 })).toThrow(/duration|frames/);
  });

  it.each([
    ['nonuniform timeline', (track: THREE.KeyframeTrack) => { track.times[3] += .01; }, /timeline/],
    ['NaN timeline', (track: THREE.KeyframeTrack) => { track.times[4] = NaN; }, /timeline/],
    ['nonfinite values', (track: THREE.KeyframeTrack) => { track.values[2] = Infinity; }, /finite/],
    ['root target', (track: THREE.KeyframeTrack) => { track.name = '.position'; }, /unique named Bone/],
    ['mesh target', (track: THREE.KeyframeTrack) => { track.name = 'MockCharacterMesh.position'; }, /unique named Bone/],
    ['material target', (track: THREE.KeyframeTrack) => { track.name = 'MockCharacterMesh.material.opacity'; }, /TRS/],
    ['indexed property', (track: THREE.KeyframeTrack) => { track.name = 'Hips.position[x]'; }, /TRS/],
    ['wrong dimensions', (track: THREE.KeyframeTrack) => { track.values = track.values.slice(0, 31); }, /finite/],
  ])('rejects %s', async (_, mutate, error) => {
    const gltf = await parsed(); mutate(gltf.animations[0].tracks[0]); expect(() => extract(gltf)).toThrow(error);
  });

  it('rejects duplicate TRS channels and invalid rotation samples', async () => {
    const gltf = await parsed(); gltf.animations[0].tracks.push(gltf.animations[0].tracks[0].clone()); expect(() => extract(gltf)).toThrow(/duplicate track/);
    gltf.animations[0].tracks = [new THREE.QuaternionKeyframeTrack('Hips.quaternion', Array.from({ length: 31 }, (_, i) => i / 30), Array.from({ length: 31 }, () => [0, 0, 0, 2]).flat())];
    expect(() => extract(gltf)).toThrow(/normalized/);
  });

  it('rejects missing profile bones and original duplicate joint names despite loader renaming', async () => {
    const missing = await parsed({ clipName: 'walk' }, json => { json.nodes[16].name = 'Unknown'; }); expect(() => extract(missing)).toThrow(/missing.*RightFoot/);
    const duplicate = await parsed({ clipName: 'walk' }, json => { json.nodes[16].name = 'Hips'; }); expect(() => extract(duplicate)).toThrow(/duplicate original bone name/);
  });

  it('rejects disconnected extra joints rather than trusting a complete profile name subset', async () => {
    const gltf = await parsed(), extra = new THREE.Bone(); extra.name = 'Detached'; gltf.scene.add(extra);
    let skeleton!: THREE.Skeleton; gltf.scene.traverse(n => { if ((n as THREE.SkinnedMesh).skeleton) skeleton = (n as THREE.SkinnedMesh).skeleton; }); skeleton.bones.push(extra); skeleton.boneInverses.push(new THREE.Matrix4());
    expect(() => extract(gltf)).toThrow(/connected skeleton/);
  });

  it.each([
    ['rest local', (json: any) => { json.nodes[4].translation[1] += .01; }],
    ['ancestor transform', (json: any) => { json.nodes.push({ name: 'ExtraRoot', translation: [1, 0, 0], children: [0] }); json.scenes[0].nodes[0] = 18; }],
    ['inverse-bind', (json: any, bin: Buffer) => { const a = json.accessors[json.skins[0].inverseBindMatrices]; bin.writeFloatLE(.2, json.bufferViews[a.bufferView].byteOffset + 48); }],
  ])('compares stored %s instead of profile tags or current pose', async (_, edit) => {
    const target = await parsed({}), source = await parsed({ clipName: 'walk' }, edit);
    expect(() => assertSameSkeleton(captureSkeletonRest(source.scene, source.parser), captureSkeletonRest(target.scene, target.parser))).toThrow(/rest\/bind|parent chain/);
  });

  it('rejects a target selection that discarded required animated bones', async () => {
    const gltf = await parsed(), source = extract(gltf), target = clone(gltf.scene); scenes.push(target); target.getObjectByName('Hips')!.removeFromParent();
    expect(() => bindSkeletalClip(source, 'walk', target, source.rest)).toThrow(/retain unique bone/);
  });
});


describe('motion GLB snapshot and pre-parser dependency gate', () => {
  it('accepts the real fixture and freezes a separate byte generation', () => {
    const input = glb(), snapshot = snapshotSkeletalGlb(input); expect(snapshot).not.toBe(input); expect(new Uint8Array(snapshot)).toEqual(new Uint8Array(input)); new Uint8Array(input).fill(0); expect(new DataView(snapshot).getUint32(0, true)).toBe(0x46546c67);
  });
  it.each([
    ['external buffer', (json: any) => { json.buffers[0].uri = 'http://invalid/motion.bin'; }],
    ['data buffer', (json: any) => { json.buffers[0].uri = 'data:application/octet-stream;base64,AAAA'; }],
    ['external image', (json: any) => { json.images = [{ uri: 'https://invalid/image.png' }]; }],
    ['relative image', (json: any) => { json.images = [{ uri: '../image.png' }]; }],
    ['hidden dependency extension', (json: any) => { json.extensions = { unknown: { source: 'http://invalid' } }; }],
    ['cycle', (json: any) => { json.nodes[4].children = [0]; }],
    ['dormant default scene', (json: any) => { json.scenes.push({ nodes: [17] }); json.scene = 1; }],
    ['missing explicit default', (json: any) => { json.scenes.push({ nodes: [17] }); delete json.scene; }],
    ['animation nonjoint', (json: any) => { json.animations[0].channels[0].target.node = 17; }],
    ['matrix animated target', (json: any) => { delete json.nodes[0].translation; json.nodes[0].matrix = [1,0,0,0,0,1,0,0,0,0,1,0,0,.95,0,1]; }],
    ['unknown interpolation', (json: any) => { json.animations[0].samplers[0].interpolation = 'MAGIC'; }],
    ['string sampler reference', (json: any) => { json.animations[0].channels[0].sampler = '0'; }],
    ['unused sampler', (json: any) => { json.animations[0].samplers.push({ ...json.animations[0].samplers[0] }); }],
    ['mismatched output type', (json: any) => { json.accessors[json.animations[0].samplers[0].output].type = 'SCALAR'; }],
    ['nonancestor skin root', (json: any) => { json.skins[0].skeleton = 4; }],
    ['missing inverse bind', (json: any) => { delete json.skins[0].inverseBindMatrices; }],
    ['accessor sample budget', (json: any) => { json.accessors[0].count = 1e9; }],
    ['node budget', (json: any) => { json.nodes.push(...Array.from({ length: 4096 }, () => ({}))); }],
  ])('rejects %s before GLTFLoader can fetch or allocate', (_, edit) => { expect(() => snapshotSkeletalGlb(glb({ clipName: 'walk' }, edit))).toThrow(); });
  it('rejects oversized and malformed container bytes', () => {
    expect(() => snapshotSkeletalGlb(new ArrayBuffer(64 * 1024 * 1024 + 1))).toThrow(/budget/);
    const bad = glb(); new DataView(bad).setUint32(8, bad.byteLength + 4, true); expect(() => snapshotSkeletalGlb(bad)).toThrow(/header/);
  });
});
