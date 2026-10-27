import * as THREE from 'three';
import type { GLTFParser } from 'three/addons/loaders/GLTFLoader.js';
import type { SkeletalAnimationDescriptor } from '@assets/index.js';

const PROFILE_BONES = ['Hips', 'Spine', 'Chest', 'Neck', 'Head', 'LeftUpperArm', 'LeftLowerArm', 'LeftHand', 'RightUpperArm', 'RightLowerArm', 'RightHand', 'LeftUpperLeg', 'LeftLowerLeg', 'LeftFoot', 'RightUpperLeg', 'RightLowerLeg', 'RightFoot'];
const PROFILE_PARENTS = [-1, 0, 1, 2, 3, 2, 5, 6, 2, 8, 9, 0, 11, 12, 0, 14, 15];
function check(value: unknown, message: string): asserts value { if (!value) throw new Error(`ModelPool skeletal-animation: ${message}`); }
const finite = (values: ArrayLike<number>): boolean => Array.from(values).every(Number.isFinite);
const near = (a: readonly number[], b: readonly number[]): boolean => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= 1e-5 * Math.max(1, Math.abs(v), Math.abs(b[i])));
interface BoneRest { readonly name: string; readonly local: readonly number[]; readonly world: readonly number[]; readonly inverse: readonly number[]; readonly ancestors: readonly { name: string; matrix: readonly number[] }[]; }
export interface SkeletonRest { readonly bones: ReadonlyMap<string, BoneRest>; readonly error?: string; }

/** New motion assets are bounded, self-contained GLB snapshots. No URL is
 * passed to GLTFLoader until this gate has ruled out hidden dependency loads. */
export function snapshotSkeletalGlb(input: ArrayBuffer): ArrayBuffer {
  check(input.byteLength >= 28 && input.byteLength <= 64 * 1024 * 1024, 'GLB byte budget exceeded or truncated');
  const snapshot = input.slice(0), view = new DataView(snapshot);
  check(view.getUint32(0, true) === 0x46546c67 && view.getUint32(4, true) === 2 && view.getUint32(8, true) === snapshot.byteLength, 'invalid GLB2 header/length');
  const jsonLength = view.getUint32(12, true), binHeader = 20 + jsonLength;
  check(view.getUint32(16, true) === 0x4e4f534a && jsonLength % 4 === 0 && jsonLength <= 4 * 1024 * 1024 && binHeader + 8 <= snapshot.byteLength, 'invalid JSON chunk or budget');
  const binLength = view.getUint32(binHeader, true);
  check(view.getUint32(binHeader + 4, true) === 0x004e4942 && binLength % 4 === 0 && binHeader + 8 + binLength === snapshot.byteLength, 'exactly one JSON and one BIN chunk are required');
  const json = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(snapshot, 20, jsonLength)));
  check(json?.asset?.version === '2.0', 'asset.version must be 2.0');
  const array = (value: unknown, max: number, label: string): any[] => { check(Array.isArray(value) && value.length <= max, `${label} count/budget`); return value; };
  const integer = (value: unknown, max = Number.MAX_SAFE_INTEGER): value is number => Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= max;
  const buffers = array(json.buffers, 1, 'buffers');
  check(buffers.length === 1 && buffers[0].uri === undefined && integer(buffers[0].byteLength, binLength) && buffers[0].byteLength > 0 && binLength - buffers[0].byteLength <= 3, 'one self-contained BIN buffer is required');
  // T5 motion exports are uncompressed; old model assets still use all E1 codecs.
  const pending: { value: unknown; depth: number }[] = [{ value: json, depth: 0 }]; let items = 0;
  while (pending.length) {
    const { value, depth } = pending.pop()!;
    check(++items <= 200000 && depth <= 64, 'JSON structure budget exceeded');
    if (!value || typeof value !== 'object') continue;
    for (const [key, child] of Object.entries(value)) {
      if (key === 'uri') check(typeof child === 'string' && child.startsWith('data:'), 'external URI is not self-contained');
      if (key === 'extensions') check(!child || Object.keys(child).length === 0, 'motion extensions/compression are unsupported');
      if (child && typeof child === 'object') pending.push({ value: child, depth: depth + 1 });
    }
  }
  check(!json.extensionsRequired?.length && !json.extensionsUsed?.length, 'motion extensions/compression are unsupported');
  const views = array(json.bufferViews, 16384, 'bufferViews');
  for (const bv of views) check(bv.buffer === 0 && integer(bv.byteOffset ?? 0) && integer(bv.byteLength, buffers[0].byteLength) && bv.byteLength > 0 && (bv.byteOffset ?? 0) + bv.byteLength <= buffers[0].byteLength && (bv.byteStride === undefined || integer(bv.byteStride, 252) && bv.byteStride >= 4 && bv.byteStride % 4 === 0), 'bufferView range/stride invalid');
  const accessors = array(json.accessors, 16384, 'accessors');
  const dimensions: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
  const sizes: Record<number, number> = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
  let components = 0;
  for (const a of accessors) {
    check(integer(a.bufferView, views.length - 1), 'accessor bufferView index invalid');
    const bv = views[a.bufferView], size = sizes[a.componentType], width = dimensions[a.type];
    check(bv && size && width && a.sparse === undefined && integer(a.count, 4000000) && a.count > 0 && integer(a.byteOffset ?? 0), 'accessor type/count/range invalid');
    const stride = bv.byteStride ?? size * width;
    check(stride >= size * width && stride % size === 0 && (a.byteOffset ?? 0) % size === 0 && (bv.byteOffset ?? 0) % size === 0 && (a.byteOffset ?? 0) + (a.count - 1) * stride + size * width <= bv.byteLength, 'accessor exceeds bufferView');
    components += a.count * width; check(components <= 16000000, 'decoded sample/geometry budget exceeded');
  }
  for (const image of array(json.images ?? [], 256, 'images')) check(image.bufferView === undefined ? typeof image.uri === 'string' && image.uri.startsWith('data:') : integer(image.bufferView, views.length - 1) && image.uri === undefined, 'image must be embedded');
  const nodes = array(json.nodes, 4096, 'nodes'), parents = new Array<number>(nodes.length).fill(-1);
  check(nodes.length > 0, 'nodes are required');
  const tuple = (value: unknown, count: number): value is number[] => Array.isArray(value) && value.length === count && value.every(Number.isFinite);
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.matrix !== undefined) check(tuple(node.matrix, 16) && node.translation === undefined && node.rotation === undefined && node.scale === undefined && Math.abs(node.matrix[3]) + Math.abs(node.matrix[7]) + Math.abs(node.matrix[11]) + Math.abs(node.matrix[15] - 1) < 1e-5, 'invalid node matrix');
    else check(tuple(node.translation ?? [0, 0, 0], 3) && tuple(node.scale ?? [1, 1, 1], 3) && tuple(node.rotation ?? [0, 0, 0, 1], 4) && Math.abs(Math.hypot(...(node.rotation ?? [0, 0, 0, 1])) - 1) <= 1e-3, 'invalid finite node TRS');
    for (const child of array(node.children ?? [], 4096, 'children')) { check(integer(child, nodes.length - 1) && child !== i && parents[child] === -1, 'node graph has multiple parents or cycle'); parents[child] = i; }
  }
  const roots = parents.flatMap((p, i) => p < 0 ? [i] : []), visited = new Set<number>(), queue = [...roots];
  for (let i = 0; i < queue.length; i++) { const node = queue[i]; check(!visited.has(node), 'node cycle'); visited.add(node); queue.push(...(nodes[node].children ?? [])); }
  check(visited.size === nodes.length, 'node cycle');
  const scenes = array(json.scenes, 64, 'scenes'); check(integer(json.scene ?? (scenes.length === 1 ? 0 : -1), scenes.length - 1), 'explicit default scene required');
  const active = new Set<number>(), activeQueue = array(scenes[json.scene ?? 0].nodes, 4096, 'scene roots').slice();
  for (const node of activeQueue) check(integer(node, nodes.length - 1) && parents[node] === -1, 'invalid scene root');
  for (let i = 0; i < activeQueue.length; i++) { const n = activeQueue[i]; check(!active.has(n), 'duplicate scene node'); active.add(n); activeQueue.push(...(nodes[n].children ?? [])); }
  const skins = array(json.skins, 64, 'skins'); check(skins.length > 0, 'skin is required');
  const activeJoints = new Set<number>();
  for (const [index, skin] of skins.entries()) {
    const joints = array(skin.joints, 512, 'joints'); check(joints.length >= 17 && new Set(joints).size === joints.length && nodes.some((n, i) => active.has(i) && n.skin === index && n.mesh !== undefined), 'skin must be used in the default scene');
    check(integer(skin.inverseBindMatrices, accessors.length - 1), 'inverse-bind accessor index invalid');
    const ibm = accessors[skin.inverseBindMatrices]; check(ibm?.type === 'MAT4' && ibm.componentType === 5126 && !ibm.normalized && ibm.count === joints.length, 'explicit inverse-bind matrices are required');
    for (const joint of joints) {
      check(integer(joint, nodes.length - 1) && active.has(joint), 'skin joint outside default scene'); activeJoints.add(joint);
      if (skin.skeleton !== undefined) {
        check(integer(skin.skeleton, nodes.length - 1) && active.has(skin.skeleton), 'skin root outside default scene');
        let ancestor = joint; while (ancestor !== skin.skeleton && ancestor >= 0) ancestor = parents[ancestor]; check(ancestor === skin.skeleton, 'skin root must be ancestor of every joint');
      }
    }
  }
  const clips = array(json.animations, 1, 'animations'); check(clips.length === 1, 'external GLB must contain exactly one clip');
  const samplers = array(clips[0].samplers, 1536, 'samplers'), channels = array(clips[0].channels, 1536, 'channels'); check(channels.length > 0, 'animation channels are required');
  const used = new Set<number>(), targets = new Set<string>();
  for (const channel of channels) {
    check(integer(channel.sampler, samplers.length - 1), 'sampler index invalid');
    const sampler = samplers[channel.sampler], target = channel.target;
    check(sampler && activeJoints.has(target?.node) && ['translation', 'rotation', 'scale'].includes(target.path) && nodes[target.node].matrix === undefined, 'channel must target a default-scene joint TRS');
    const key = `${target.node}:${target.path}`; check(!targets.has(key), 'duplicate channel target'); targets.add(key); used.add(channel.sampler);
    check(integer(sampler.input, accessors.length - 1) && integer(sampler.output, accessors.length - 1), 'animation accessor index invalid');
    const inputAccessor = accessors[sampler.input], output = accessors[sampler.output], interpolation = sampler.interpolation ?? 'LINEAR';
    check(['LINEAR', 'STEP', 'CUBICSPLINE'].includes(interpolation), 'unsupported animation interpolation');
    check(inputAccessor?.type === 'SCALAR' && inputAccessor.componentType === 5126 && !inputAccessor.normalized && output?.componentType === 5126 && !output.normalized && output.type === (target.path === 'rotation' ? 'VEC4' : 'VEC3') && output.count === inputAccessor.count * (interpolation === 'CUBICSPLINE' ? 3 : 1), 'animation accessor dimensions/type mismatch');
  }
  check(used.size === samplers.length, 'unused animation sampler');
  return snapshot;
}

/** Capture at parse time, before any mixer or entity transform can change a pose. */
export function captureSkeletonRest(scene: THREE.Object3D, parser?: GLTFParser): SkeletonRest {
  try {
    scene.updateWorldMatrix(true, true);
    const skeletons = new Set<THREE.Skeleton>();
    scene.traverse(node => { if ((node as THREE.SkinnedMesh).skeleton) skeletons.add((node as THREE.SkinnedMesh).skeleton); });
    check(skeletons.size > 0, 'a skinned skeleton is required');
    const bones = new Map<string, BoneRest>(), objects = new Map<string, THREE.Bone>(), roots = new Set<THREE.Object3D>();
    const originalNames = new Map<string, THREE.Bone>();
    const sceneInverse = scene.matrixWorld.clone().invert();
    for (const skeleton of skeletons) {
      check(skeleton.bones.length === skeleton.boneInverses.length, 'inverse-bind count differs from bone count');
      for (let i = 0; i < skeleton.bones.length; i++) {
        const bone = skeleton.bones[i];
        check(bone.isBone && bone.name.trim() === bone.name && bone.name.length > 0, 'bone name must be nonempty and trimmed');
        check(!objects.has(bone.name) || objects.get(bone.name) === bone, `duplicate bone name ${bone.name}`);
        objects.set(bone.name, bone);
        const index = parser?.associations.get(bone)?.nodes;
        const name: string = index === undefined ? bone.name : parser!.json.nodes[index].name;
        check(typeof name === 'string' && name.trim() === name && name.length > 0, 'original bone name must be nonempty and trimmed');
        check(!originalNames.has(name) || originalNames.get(name) === bone, `duplicate original bone name ${name}`);
        originalNames.set(name, bone);
        const inverse = skeleton.boneInverses[i];
        check(finite(inverse.elements) && Math.abs(inverse.determinant()) > 1e-12, `invalid inverse-bind for ${bone.name}`);
        check(Math.abs(inverse.elements[3]) + Math.abs(inverse.elements[7]) + Math.abs(inverse.elements[11]) + Math.abs(inverse.elements[15] - 1) < 1e-5, `non-affine inverse-bind for ${bone.name}`);
        const ancestors: { name: string; matrix: number[] }[] = [];
        let ancestor = bone.parent;
        while (ancestor && ancestor !== scene) { ancestors.push({ name: ancestor.name, matrix: ancestor.matrix.elements.slice() }); ancestor = ancestor.parent; }
        check(ancestor === scene, `bone ${bone.name} is outside the model scene`);
        let root: THREE.Object3D = bone; while (root.parent && root.parent !== scene) root = root.parent; roots.add(root);
        const rest: BoneRest = { name: bone.name, local: bone.matrix.elements.slice(), world: sceneInverse.clone().multiply(bone.matrixWorld).elements, inverse: inverse.elements.slice(), ancestors };
        check(finite(rest.local) && finite(rest.world) && ancestors.every(a => finite(a.matrix)), `nonfinite rest for ${bone.name}`);
        const previous = bones.get(bone.name);
        check(!previous || near(previous.inverse, rest.inverse), `inconsistent inverse-bind for ${bone.name}`);
        bones.set(bone.name, rest);
      }
    }
    check(roots.size === 1, 'all skin joints must form one connected skeleton');
    for (const name of PROFILE_BONES) check(bones.has(name), `missing apollo-humanoid-v1 bone ${name}`);
    for (let i = 1; i < PROFILE_BONES.length; i++) {
      const parent = objects.get(PROFILE_BONES[PROFILE_PARENTS[i]])!; let ancestor = objects.get(PROFILE_BONES[i])!.parent;
      while (ancestor && ancestor !== parent) ancestor = ancestor.parent;
      check(ancestor === parent, `invalid profile ancestry for ${PROFILE_BONES[i]}`);
    }
    return { bones };
  } catch (error) { return { bones: new Map(), error: String(error) }; }
}

function requireSkeleton(rest: SkeletonRest): void { check(!rest.error, rest.error ?? 'invalid skeleton'); }
export function assertSameSkeleton(source: SkeletonRest, target: SkeletonRest): void {
  requireSkeleton(source); requireSkeleton(target);
  check(source.bones.size === target.bones.size, 'bone sets differ');
  for (const [name, a] of source.bones) {
    const b = target.bones.get(name);
    check(b, `target is missing bone ${name}`);
    check(near(a.local, b.local) && near(a.world, b.world) && near(a.inverse, b.inverse), `rest/bind differs for ${name}`);
    check(a.ancestors.length === b.ancestors.length && a.ancestors.every((p, i) => p.name === b.ancestors[i].name && near(p.matrix, b.ancestors[i].matrix)), `parent chain differs for ${name}`);
  }
}

interface BoneTrack { readonly track: THREE.KeyframeTrack; readonly bone: string; readonly property: string; }
export interface SkeletalClip { readonly clip: THREE.AnimationClip; readonly rest: SkeletonRest; readonly tracks: readonly BoneTrack[]; readonly loop: boolean; }

/** Validate decoded data, including actual samples rather than duration metadata. */
export function extractSkeletalClip(scene: THREE.Object3D, clips: readonly THREE.AnimationClip[], descriptor: SkeletalAnimationDescriptor, parser?: GLTFParser): SkeletalClip {
  check(descriptor.skeleton === 'apollo-humanoid-v1', 'unsupported skeleton profile');
  check(Number.isInteger(descriptor.fps) && descriptor.fps >= 1 && descriptor.fps <= 120, 'fps out of range');
  check(Number.isInteger(descriptor.frames) && descriptor.frames >= 2 && descriptor.frames <= 36001 && typeof descriptor.loop === 'boolean', 'frames/loop out of range');
  check(clips.length === 1, 'external GLB must contain exactly one clip');
  const clip = clips[0], rest = captureSkeletonRest(scene, parser);
  requireSkeleton(rest);
  check(typeof clip.name === 'string' && clip.name.trim().length > 0 && clip.tracks.length > 0, 'clip must be named and contain tracks');
  const duration = (descriptor.frames - 1) / descriptor.fps;
  check(Number.isFinite(clip.duration) && Math.abs(clip.duration - duration) <= Math.max(2e-6, duration * 1e-6), 'clip duration differs from frames/fps');
  const names = new Map<string, THREE.Object3D[]>();
  scene.traverse(node => { for (const name of new Set([node.name, node.uuid])) names.set(name, [...(names.get(name) ?? []), node]); });
  const seen = new Set<string>();
  const tracks = clip.tracks.map(track => {
    const path = THREE.PropertyBinding.parseTrackName(track.name);
    check(!path.objectName && path.objectIndex === undefined && path.propertyIndex === undefined && ['position', 'quaternion', 'scale'].includes(path.propertyName), `only direct bone TRS tracks are allowed: ${track.name}`);
    const nodes = names.get(path.nodeName);
    check(nodes?.length === 1 && (nodes[0] as THREE.Bone).isBone && rest.bones.has(nodes[0].name), `track must target a unique named Bone: ${track.name}`);
    const bone = nodes[0].name, key = `${bone}.${path.propertyName}`;
    check(!seen.has(key), `duplicate track ${key}`); seen.add(key);
    check(track.times.length === descriptor.frames, `track sample count differs from frames: ${track.name}`);
    for (let i = 0; i < track.times.length; i++) check(Number.isFinite(track.times[i]) && Math.abs(track.times[i] - i / descriptor.fps) <= Math.max(2e-6, i / descriptor.fps * 1e-6) && (i === 0 || track.times[i] > track.times[i - 1]), `track timeline differs from fps: ${track.name}`);
    const cubic = !!((track as unknown as { createInterpolant: { isInterpolantFactoryMethodGLTFCubicSpline?: boolean } }).createInterpolant).isInterpolantFactoryMethodGLTFCubicSpline;
    const width = path.propertyName === 'quaternion' ? 4 : 3;
    check(track.getValueSize() === width * (cubic ? 3 : 1) && finite(track.values), `track values must be finite ${path.propertyName} samples`);
    check(path.propertyName === 'quaternion' ? track instanceof THREE.QuaternionKeyframeTrack : track instanceof THREE.VectorKeyframeTrack, 'track type differs from TRS property');
    if (path.propertyName === 'quaternion') for (let i = cubic ? 4 : 0; i < track.values.length; i += cubic ? 12 : 4) check(Math.abs(Math.hypot(...Array.from(track.values.slice(i, i + 4))) - 1) <= 1e-3, 'rotation quaternion must be normalized');
    return { track, bone, property: path.propertyName };
  });
  return { clip, rest, tracks, loop: descriptor.loop };
}

/** Opt-in retarget modes for AnimGraph3D clips. Absent = exact same skeleton (unchanged default). */
export type SkeletalRetarget = 'humanoid';

function uniqueBones(target: THREE.Object3D): Map<string, THREE.Bone[]> {
  const bones = new Map<string, THREE.Bone[]>();
  target.traverse(node => { if ((node as THREE.Bone).isBone) bones.set(node.name, [...(bones.get(node.name) ?? []), node as THREE.Bone]); });
  return bones;
}

/** Internal UUID paths prevent a mesh with the same name from taking a binding. */
export function bindSkeletalClip(source: SkeletalClip, clipName: string, target: THREE.Object3D, rest: SkeletonRest, retarget?: SkeletalRetarget): THREE.AnimationClip {
  check(source.clip.name === clipName, `clip name ${clipName} does not exactly match ${source.clip.name}`);
  if (retarget === 'humanoid') return retargetHumanoidClip(source, target, rest);
  check(retarget === undefined, `unsupported retarget ${String(retarget)}`);
  assertSameSkeleton(source.rest, rest);
  const bones = uniqueBones(target);
  const tracks = source.tracks.map(({ track, bone, property }) => {
    const targets = bones.get(bone);
    check(targets?.length === 1, `selected model must retain unique bone ${bone}`);
    const cloned = track.clone(); cloned.name = `${targets[0].uuid}.${property}`; return cloned;
  });
  return new THREE.AnimationClip(source.clip.name, source.clip.duration, tracks, source.clip.blendMode);
}

interface RestPose { readonly local: THREE.Matrix4; readonly localQ: THREE.Quaternion; readonly localP: THREE.Vector3; readonly worldQ: THREE.Quaternion; readonly parentWorld: THREE.Matrix4; readonly parentWorldQ: THREE.Quaternion; readonly parent?: string; readonly depth: number; }
function restPoses(rest: SkeletonRest): Map<string, RestPose> {
  const poses = new Map<string, RestPose>();
  for (const [name, bone] of rest.bones) {
    const local = new THREE.Matrix4().fromArray(bone.local as number[]), world = new THREE.Matrix4().fromArray(bone.world as number[]);
    const localP = new THREE.Vector3(), localQ = new THREE.Quaternion(), worldQ = new THREE.Quaternion(), tmpP = new THREE.Vector3(), tmpS = new THREE.Vector3();
    local.decompose(localP, localQ, tmpS); world.decompose(tmpP, worldQ, tmpS);
    // Constant parent frame at rest; for bone parents it is replaced by the animated parent world each frame.
    const parentWorld = world.clone().multiply(local.clone().invert()), parentWorldQ = new THREE.Quaternion();
    parentWorld.decompose(tmpP, parentWorldQ, tmpS);
    const parent = bone.ancestors[0]?.name;
    poses.set(name, { local, localQ, localP, worldQ, parentWorld, parentWorldQ, parent: parent && rest.bones.has(parent) ? parent : undefined, depth: bone.ancestors.length });
  }
  return poses;
}
// A retarget bake retains STEP holds or LINEAR playback. Cubic curves and mixed
// rotation modes need offline normalization first: sampling only their keys would
// silently change the motion between frames.
function retargetInterpolation(track: THREE.KeyframeTrack): THREE.InterpolationModes {
  const factory = (track as unknown as { createInterpolant: { isInterpolantFactoryMethodGLTFCubicSpline?: boolean } }).createInterpolant;
  const mode = track.getInterpolation();
  if (factory.isInterpolantFactoryMethodGLTFCubicSpline || (mode !== THREE.InterpolateDiscrete && mode !== THREE.InterpolateLinear)) {
    console.warn(`[ModelPool] reject: humanoid retarget interpolation on "${track.name}" needs offline LINEAR normalization`);
    check(false, 'humanoid retarget supports STEP or LINEAR tracks; normalize cubic/smooth curves offline');
  }
  return mode;
}
const interpolant = (track: THREE.KeyframeTrack): THREE.Interpolant => (track as unknown as { createInterpolant(): THREE.Interpolant }).createInterpolant();
const byDepth = (poses: Map<string, RestPose>): string[] => [...poses.keys()].sort((a, b) => poses.get(a)!.depth - poses.get(b)!.depth || (a < b ? -1 : a > b ? 1 : 0));

/**
 * M1 humanoid retarget: same apollo-humanoid-v1 bone names, different proportions or bone-local axes.
 * Rotations transfer as world-space deltas from rest (target world = source world · source rest⁻¹ · target rest),
 * so bone roll conventions may differ; bone lengths stay the target's own; only Hips translation transfers,
 * scaled by rest hip height. Assumes both rest poses are the same stance (T-pose to T-pose) facing the same way.
 */
export function retargetHumanoidClip(source: SkeletalClip, target: THREE.Object3D, targetRest: SkeletonRest): THREE.AnimationClip {
  requireSkeleton(source.rest); requireSkeleton(targetRest);
  const sPose = restPoses(source.rest), tPose = restPoses(targetRest);
  const sHipY = source.rest.bones.get('Hips')!.world[13], tHipY = targetRest.bones.get('Hips')!.world[13];
  check(sHipY > 1e-6 && tHipY > 1e-6, 'humanoid retarget needs Hips above the model origin in both rest poses');
  const ratio = tHipY / sHipY;
  const tracks = new Map(source.tracks.map(t => [`${t.bone}.${t.property}`, t.track]));
  const times = source.tracks[0].track.times;
  check(source.tracks.every(t => t.track.times.length === times.length && t.track.times.every((time, i) => time === times[i])), 'retarget needs one shared sample timeline');
  const rotationModes = new Set(source.tracks.filter(t => t.property === 'quaternion').map(t => retargetInterpolation(t.track)));
  if (rotationModes.size > 1) {
    console.warn('[ModelPool] reject: mixed rotation interpolation needs offline LINEAR normalization');
    check(false, 'humanoid retarget cannot mix STEP and LINEAR rotations; normalize offline');
  }
  const rotationMode = rotationModes.values().next().value ?? THREE.InterpolateLinear;
  const rotation = new Map<string, THREE.Interpolant>();
  for (const [key, track] of tracks) if (key.endsWith('.quaternion')) rotation.set(key.slice(0, -'.quaternion'.length), interpolant(track));
  const hip = tracks.get('Hips.position'), hipMode = hip ? retargetInterpolation(hip) : THREE.InterpolateLinear, hipTrack = hip ? interpolant(hip) : undefined;
  const bones = uniqueBones(target), sOrder = byDepth(sPose), tOrder = byDepth(tPose);
  const shared = tOrder.filter(name => sPose.has(name));
  for (const name of shared) check(bones.get(name)?.length === 1, `selected model must retain unique bone ${name}`);
  const values = new Map(shared.map(name => [name, new Float32Array(times.length * 4)]));
  const hipValues = hipTrack ? new Float32Array(times.length * 3) : null;
  const sParent3 = new THREE.Matrix3().setFromMatrix4(sPose.get('Hips')!.parentWorld), tParentInv3 = new THREE.Matrix3().setFromMatrix4(tPose.get('Hips')!.parentWorld).invert();
  const sWorld = new Map<string, THREE.Quaternion>(), tWorld = new Map<string, THREE.Quaternion>(), q = new THREE.Quaternion();
  for (let i = 0; i < times.length; i++) {
    sWorld.clear(); tWorld.clear();
    for (const name of sOrder) {
      const pose = sPose.get(name)!, sample = rotation.get(name)?.evaluate(times[i]);
      const local = sample ? q.fromArray(sample as unknown as number[]).normalize().clone() : pose.localQ.clone();
      sWorld.set(name, (pose.parent ? sWorld.get(pose.parent)! : pose.parentWorldQ).clone().multiply(local));
    }
    for (const name of tOrder) {
      const pose = tPose.get(name)!, parentWorld = pose.parent ? tWorld.get(pose.parent)! : pose.parentWorldQ;
      if (!sPose.has(name)) { tWorld.set(name, parentWorld.clone().multiply(pose.localQ)); continue; }
      const world = sWorld.get(name)!.clone().multiply(sPose.get(name)!.worldQ.clone().invert()).multiply(pose.worldQ);
      tWorld.set(name, world);
      parentWorld.clone().invert().multiply(world).normalize().toArray(values.get(name)!, i * 4);
    }
    if (hipTrack && hipValues) {
      const delta = new THREE.Vector3().fromArray(hipTrack.evaluate(times[i]) as unknown as number[]).sub(sPose.get('Hips')!.localP);
      delta.applyMatrix3(sParent3).multiplyScalar(ratio).applyMatrix3(tParentInv3).add(tPose.get('Hips')!.localP).toArray(hipValues, i * 3);
    }
  }
  const out: THREE.KeyframeTrack[] = shared.map(name => new THREE.QuaternionKeyframeTrack(`${bones.get(name)![0].uuid}.quaternion`, Array.from(times), Array.from(values.get(name)!), rotationMode));
  if (hipValues) out.push(new THREE.VectorKeyframeTrack(`${bones.get('Hips')![0].uuid}.position`, Array.from(times), Array.from(hipValues), hipMode));
  const dropped = source.tracks.filter(t => !tPose.has(t.bone) || t.property === 'scale' || (t.property === 'position' && t.bone !== 'Hips')).length;
  console.info(`[ModelPool] decision: humanoid retarget "${source.clip.name}" · ${shared.length} shared bones · hip scale ${ratio.toFixed(3)} · ${dropped} source tracks dropped (non-hip translation/scale or bones missing on target)`);
  return new THREE.AnimationClip(source.clip.name, source.clip.duration, out, source.clip.blendMode);
}
