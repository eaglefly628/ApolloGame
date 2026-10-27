// M1 (GAP-MOTION-LIB): humanoid retarget lets one motion drive skins with different proportions / bone roll.
// Rigs are built from world-space T-poses so the expected answer is known in closed form.
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { bindSkeletalClip, captureSkeletonRest, extractSkeletalClip, retargetHumanoidClip, type SkeletalClip } from './skeletal-clips.js';
import { validateAnimGraph3D } from '@engine/protocol/components/anim-graph.js';

const NAMES = ['Hips', 'Spine', 'Chest', 'Neck', 'Head', 'LeftUpperArm', 'LeftLowerArm', 'LeftHand', 'RightUpperArm', 'RightLowerArm', 'RightHand', 'LeftUpperLeg', 'LeftLowerLeg', 'LeftFoot', 'RightUpperLeg', 'RightLowerLeg', 'RightFoot'];
const PARENT: Record<string, string | null> = { Hips: null, Spine: 'Hips', Chest: 'Spine', Neck: 'Chest', Head: 'Neck', LeftUpperArm: 'Chest', LeftLowerArm: 'LeftUpperArm', LeftHand: 'LeftLowerArm', RightUpperArm: 'Chest', RightLowerArm: 'RightUpperArm', RightHand: 'RightLowerArm', LeftUpperLeg: 'Hips', LeftLowerLeg: 'LeftUpperLeg', LeftFoot: 'LeftLowerLeg', RightUpperLeg: 'Hips', RightLowerLeg: 'RightUpperLeg', RightFoot: 'RightLowerLeg' };
const POS: Record<string, [number, number, number]> = { Hips: [0, 1, 0], Spine: [0, 1.1, 0], Chest: [0, 1.3, 0], Neck: [0, 1.5, 0], Head: [0, 1.6, 0], LeftUpperArm: [0.2, 1.45, 0], LeftLowerArm: [0.5, 1.45, 0], LeftHand: [0.75, 1.45, 0], RightUpperArm: [-0.2, 1.45, 0], RightLowerArm: [-0.5, 1.45, 0], RightHand: [-0.75, 1.45, 0], LeftUpperLeg: [0.1, 0.95, 0], LeftLowerLeg: [0.1, 0.5, 0], LeftFoot: [0.1, 0.05, 0], RightUpperLeg: [-0.1, 0.95, 0], RightLowerLeg: [-0.1, 0.5, 0], RightFoot: [-0.1, 0.05, 0] };
/** Deterministic per-bone roll: same joint positions, different bone-local axes. */
const ROLL = (i: number) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 1, 0.5).normalize(), 0.4 + 0.37 * i);

interface RigOptions { scale?: number; roll?: boolean; extra?: { name: string; parent: string; pos: [number, number, number]; adopt?: string }[] }
const scenes: THREE.Object3D[] = [];
function rig({ scale = 1, roll = false, extra = [] }: RigOptions = {}) {
  const parent: Record<string, string | null> = { ...PARENT }, pos: Record<string, [number, number, number]> = { ...POS }, names = [...NAMES];
  for (const e of extra) { names.push(e.name); parent[e.name] = e.parent; pos[e.name] = e.pos; if (e.adopt) parent[e.adopt] = e.name; }
  const worldQ = new Map(names.map((n, i) => [n, roll ? ROLL(i) : new THREE.Quaternion()]));
  const world = new Map(names.map(n => [n, new THREE.Matrix4().compose(new THREE.Vector3(...pos[n]).multiplyScalar(scale), worldQ.get(n)!, new THREE.Vector3(1, 1, 1))]));
  const scene = new THREE.Group(), armature = new THREE.Group(); armature.name = 'Armature'; scene.add(armature);
  const bones = new Map<string, THREE.Bone>();
  const depth = (n: string): number => parent[n] ? 1 + depth(parent[n]!) : 0;
  for (const name of [...names].sort((a, b) => depth(a) - depth(b))) {
    const bone = new THREE.Bone(); bone.name = name;
    const p = parent[name], local = p ? world.get(p)!.clone().invert().multiply(world.get(name)!) : world.get(name)!.clone();
    local.decompose(bone.position, bone.quaternion, bone.scale);
    (p ? bones.get(p)! : armature).add(bone); bones.set(name, bone);
  }
  scene.updateMatrixWorld(true);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.1, 0, 0, 0, 0.1, 0], 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial()), skeleton = new THREE.Skeleton(names.map(n => bones.get(n)!));
  scene.add(mesh); mesh.bind(skeleton); scenes.push(scene);
  return { scene, bones, worldQ, rest: captureSkeletonRest(scene) };
}
afterEach(() => { for (const s of scenes.splice(0)) s.traverse(o => { const m = o as THREE.SkinnedMesh; m.geometry?.dispose(); m.skeleton?.dispose(); }); vi.restoreAllMocks(); });

const TIMES = [0, 0.5, 1];
/** Source motion on an identity-rest rig: arm raise, spine bend, extra-bone wiggle, hips travel, plus a non-hip translation and a scale track that must be dropped. */
function motion(source: ReturnType<typeof rig>, extraBone?: string): SkeletalClip {
  const rot = (axis: THREE.Vector3, k: number) => TIMES.flatMap(t => new THREE.Quaternion().setFromAxisAngle(axis, k * t).toArray());
  const spec: [string, THREE.KeyframeTrack, string][] = [
    ['LeftUpperArm', new THREE.QuaternionKeyframeTrack('LeftUpperArm.quaternion', TIMES, rot(new THREE.Vector3(0, 0, 1), 1.1)), 'quaternion'],
    ['LeftLowerArm', new THREE.QuaternionKeyframeTrack('LeftLowerArm.quaternion', TIMES, rot(new THREE.Vector3(0, 1, 0), 0.8)), 'quaternion'],
    ['Spine', new THREE.QuaternionKeyframeTrack('Spine.quaternion', TIMES, rot(new THREE.Vector3(1, 0, 0), 0.35)), 'quaternion'],
    ['Hips', new THREE.QuaternionKeyframeTrack('Hips.quaternion', TIMES, rot(new THREE.Vector3(0, 1, 0), 0.5)), 'quaternion'],
    ['Hips', new THREE.VectorKeyframeTrack('Hips.position', TIMES, TIMES.flatMap(t => [0.3 * t, 1 - 0.2 * t, 0.1 * t])), 'position'],
    ['Head', new THREE.VectorKeyframeTrack('Head.position', TIMES, TIMES.flatMap(t => [0, 0.1 + t, 0])), 'position'],
    ['Chest', new THREE.VectorKeyframeTrack('Chest.scale', TIMES, TIMES.flatMap(t => [1 + t, 1, 1])), 'scale'],
  ];
  if (extraBone) spec.push([extraBone, new THREE.QuaternionKeyframeTrack(`${extraBone}.quaternion`, TIMES, rot(new THREE.Vector3(1, 0, 0), 2)), 'quaternion']);
  const clip = new THREE.AnimationClip('walk', 1, spec.map(([, track]) => track));
  return { clip, rest: source.rest, tracks: spec.map(([bone, track, property]) => ({ bone, track, property })), loop: true };
}
function pose(r: ReturnType<typeof rig>, clip: THREE.AnimationClip, t: number) {
  const mixer = new THREE.AnimationMixer(r.scene); mixer.clipAction(clip).play(); mixer.setTime(t); r.scene.updateMatrixWorld(true);
  const q = new Map<string, THREE.Quaternion>(), p = new Map<string, THREE.Vector3>();
  for (const [name, bone] of r.bones) { q.set(name, bone.getWorldQuaternion(new THREE.Quaternion())); p.set(name, bone.getWorldPosition(new THREE.Vector3())); }
  mixer.stopAllAction(); mixer.uncacheRoot(r.scene); return { q, p };
}
/** Well-conditioned angle (2·atan2(|v|,|w|)); Quaternion.angleTo's acos amplifies float32 track rounding to ~1e-4 rad near zero. */
const angle = (a: THREE.Quaternion, b: THREE.Quaternion) => { const r = a.clone().invert().multiply(b); return 2 * Math.atan2(Math.hypot(r.x, r.y, r.z), Math.abs(r.w)); };
/** Reference pose plays only what is meant to transfer (rotations + hips travel); dropped tracks would skew source world matrices. */
const transferable = (c: SkeletalClip) => new THREE.AnimationClip('ref', 1, c.tracks.filter(t => t.property === 'quaternion' || (t.bone === 'Hips' && t.property === 'position')).map(t => t.track));

describe('M1 humanoid retarget', () => {
  it('strict default is unchanged: a taller skin is still rejected without retarget', () => {
    const source = rig(), target = rig({ scale: 1.5 });
    expect(() => bindSkeletalClip(motion(source), 'walk', target.scene, target.rest)).toThrow('rest/bind differs');
    expect(() => bindSkeletalClip(motion(source), 'walk', target.scene, target.rest, 'mixamo' as never)).toThrow('unsupported retarget');
  });

  it('identical skins: retargeted pose equals the original pose', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const source = rig(), target = rig(), clip = motion(source);
    for (const t of [0, 0.25, 0.5, 1]) {
      const a = pose(source, transferable(clip), t), b = pose(target, bindSkeletalClip(clip, 'walk', target.scene, target.rest, 'humanoid'), t);
      for (const name of NAMES) expect(angle(a.q.get(name)!, b.q.get(name)!), `${name}@${t}`).toBeLessThan(1e-5);
      expect(b.p.get('Hips')!.distanceTo(a.p.get('Hips')!)).toBeLessThan(1e-5);
    }
  });

  it('taller skin with different bone roll: world rotations follow the source delta, bones keep target length, hips travel scales', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const source = rig(), target = rig({ scale: 1.5, roll: true }), clip = motion(source);
    const retargeted = retargetHumanoidClip(clip, target.scene, target.rest);
    for (const t of [0.5, 1]) {
      const a = pose(source, transferable(clip), t), b = pose(target, retargeted, t);
      // Source rest is identity, so expected target world = source world · target rest world.
      for (const name of NAMES) expect(angle(b.q.get(name)!, a.q.get(name)!.clone().multiply(target.worldQ.get(name)!)), `${name}@${t}`).toBeLessThan(1e-4);
      const segment = (p: Map<string, THREE.Vector3>) => p.get('LeftLowerArm')!.clone().sub(p.get('LeftUpperArm')!);
      expect(segment(b.p).length()).toBeCloseTo(0.3 * 1.5, 5);
      expect(segment(b.p).normalize().distanceTo(segment(a.p).normalize())).toBeLessThan(1e-4);
      const hipDelta = (p: Map<string, THREE.Vector3>, s: number) => p.get('Hips')!.clone().sub(new THREE.Vector3(0, s, 0));
      expect(hipDelta(b.p, 1.5).distanceTo(hipDelta(a.p, 1).multiplyScalar(1.5))).toBeLessThan(1e-5);
      // Head translation / chest scale tracks are dropped: target keeps its own neck length and unit scale.
      expect(b.p.get('Head')!.distanceTo(b.p.get('Neck')!)).toBeCloseTo(0.1 * 1.5, 5);
      expect(target.bones.get('Chest')!.scale.x).toBeCloseTo(1, 6);
    }
  });

  it('extra and missing bones: source-only tracks are dropped, a target-only intermediate bone keeps the chain correct', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const source = rig({ extra: [{ name: 'LeftThumb', parent: 'LeftHand', pos: [0.8, 1.45, 0.05] }] });
    const target = rig({ scale: 1.2, extra: [{ name: 'UpperChest', parent: 'Chest', pos: [0, 1.4, 0], adopt: 'Neck' }] });
    const clip = motion(source, 'LeftThumb');
    const a = pose(source, transferable(clip), 1), b = pose(target, bindSkeletalClip(clip, 'walk', target.scene, target.rest, 'humanoid'), 1);
    for (const name of NAMES) expect(angle(a.q.get(name)!, b.q.get(name)!), name).toBeLessThan(1e-4);
    expect(info.mock.calls.flat().join(' ')).toMatch(/humanoid retarget "walk" · 17 shared bones · hip scale 1\.200 · 3 source tracks dropped/);
  });

  it('preserves STEP rotations and hip holds between samples after validated import', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const source = rig(), target = rig({ scale: 1.5, roll: true }), raw = motion(source);
    for (const { track } of raw.tracks) track.setInterpolation(THREE.InterpolateDiscrete);
    const clip = extractSkeletalClip(source.scene, [raw.clip], { kind: 'skeletal-animation', key: 'motion/step', src: 'step.glb', skeleton: 'apollo-humanoid-v1', fps: 2, frames: 3, loop: false });
    const bound = bindSkeletalClip(clip, 'walk', target.scene, target.rest, 'humanoid');
    for (const t of [0.1, 0.25, 0.49, 0.5, 0.75, 0.99]) {
      const a = pose(source, transferable(clip), t), b = pose(target, bound, t);
      for (const name of NAMES) expect(angle(b.q.get(name)!, a.q.get(name)!.clone().multiply(target.worldQ.get(name)!)), `${name}@${t}`).toBeLessThan(1e-4);
      expect(b.p.get('Hips')!.distanceTo(a.p.get('Hips')!.clone().multiplyScalar(1.5))).toBeLessThan(1e-5);
    }
  });

  it('preserves independent LINEAR hip travel while STEP rotations hold', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const source = rig(), target = rig(), clip = motion(source);
    for (const entry of clip.tracks) if (entry.property === 'quaternion') entry.track.setInterpolation(THREE.InterpolateDiscrete);
    const a = pose(source, transferable(clip), 0.25), b = pose(target, retargetHumanoidClip(clip, target.scene, target.rest), 0.25);
    expect(angle(a.q.get('LeftUpperArm')!, b.q.get('LeftUpperArm')!)).toBeLessThan(1e-5);
    expect(a.p.get('Hips')!.distanceTo(b.p.get('Hips')!)).toBeLessThan(1e-5);
  });

  it('rejects cubic/smooth and mixed rotation interpolation before silently changing timing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const source = rig(), target = rig(), mixed = motion(source);
    mixed.tracks[0].track.setInterpolation(THREE.InterpolateDiscrete);
    expect(() => retargetHumanoidClip(mixed, target.scene, target.rest)).toThrow('cannot mix STEP and LINEAR');
    const smooth = motion(source);
    smooth.tracks.find(t => t.bone === 'Hips' && t.property === 'position')!.track.setInterpolation(THREE.InterpolateSmooth);
    expect(() => retargetHumanoidClip(smooth, target.scene, target.rest)).toThrow('normalize cubic/smooth');
    const cubic = motion(source);
    const factory = cubic.tracks[0].track as unknown as { createInterpolant: { isInterpolantFactoryMethodGLTFCubicSpline?: boolean } };
    factory.createInterpolant = Object.assign(() => { throw new Error('must reject before sampling'); }, { isInterpolantFactoryMethodGLTFCubicSpline: true });
    expect(() => retargetHumanoidClip(cubic, target.scene, target.rest)).toThrow('normalize cubic/smooth');
    expect(warn).toHaveBeenCalledTimes(3);
  });

  it('rejects a rest pose with hips at or below the model origin', () => {
    const source = rig(), target = rig({ scale: -1 });
    expect(() => retargetHumanoidClip(motion(source), target.scene, target.rest)).toThrow('Hips above the model origin');
  });
});

describe('M1 AnimGraph3D retarget field', () => {
  const graph = (clip: Record<string, unknown>) => ({ type: 'AnimGraph3D', clips: { a: clip }, states: { s: { clip: 'a' } }, params: { speed: 'speed' }, transitions: [] });
  it('accepts humanoid with an external asset; rejects other modes and retarget without asset', () => {
    expect(() => validateAnimGraph3D(graph({ asset: 'walk', clip: 'walk', retarget: 'humanoid' }))).not.toThrow();
    expect(() => validateAnimGraph3D(graph({ asset: 'walk', clip: 'walk', retarget: 'mixamo' }))).toThrow('retarget');
    expect(() => validateAnimGraph3D(graph({ clip: 'walk', retarget: 'humanoid' }))).toThrow('requires asset');
  });
});
