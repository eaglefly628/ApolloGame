import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { IK3D, IKTarget, IKWeight } from '@engine/protocol/components/ik3d.js';
import { InverseKinematics } from './inverse-kinematics.js';
import { SkeletalAttachments } from './skeletal-attachments.js';
const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
function rig() { const model = new THREE.Group(), root = new THREE.Bone(), mid = new THREE.Bone(), end = new THREE.Bone(); root.name = 'Root'; mid.name = 'Mid'; end.name = 'End'; mid.position.x = 1; end.position.x = 1; model.add(root); root.add(mid); mid.add(end); model.updateMatrixWorld(true); return { model, root, mid, end }; }
function config(weight: IKWeight = 1, more: Partial<IK3D> = {}): IK3D { return { type: 'IK3D', chains: [{ kind: 'two-bone', root: 'Root', mid: 'Mid', end: 'End', target: { entity: 'goal', offset: [0, 0, 0] }, pole: [0, 0, 2], weight }], ...more }; }
function fixture() { const r = rig(), controller = new InverseKinematics(), goal = v(1, 1), refresh = vi.fn(), targets = new Map([['goal', { position: goal, dependencies: [] as THREE.Object3D[] }]]); return { ...r, controller, goal, targets, refresh, context: { resolveTarget: (target: IKTarget) => targets.get(target.entity), refreshAttachments: refresh } }; }
function run(f: ReturnType<typeof fixture>, data: unknown = config(), params: Readonly<Record<string, number | string | boolean | undefined>> = {}, dt = 0) { return f.controller.sync([{ id: 'actor', config: data, model: f.model, params }], f.context, dt); }
function position(bone: THREE.Object3D) { return new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld); }
function tuple(r: ReturnType<typeof rig>) { return [r.root, r.mid, r.end].map(b => ({ position: b.position.toArray(), scale: b.scale.toArray(), quaternion: b.quaternion.toArray() })); }
afterEach(() => { vi.restoreAllMocks(); });

describe('InverseKinematics actual native Bone adapter', () => {
  it('reaches within 1cm and changes only instance root/mid quaternions', () => {
    const f = fixture(), before = tuple(f), other = rig(); run(f); expect(position(f.end).distanceTo(f.goal)).toBeLessThan(.000001); expect(f.refresh).toHaveBeenCalledOnce();
    expect(f.root.quaternion.toArray()).not.toEqual(before[0].quaternion); expect(f.mid.quaternion.toArray()).not.toEqual(before[1].quaternion); [f.root, f.mid, f.end].forEach((b, i) => { expect(b.position.toArray()).toEqual(before[i].position); expect(b.scale.toArray()).toEqual(before[i].scale); }); expect(f.end.quaternion.toArray()).toEqual(before[2].quaternion); expect(tuple(other)).toEqual(before); f.controller.clear(); expect(tuple(f)).toEqual(before);
  });
  it('constant weight zero leaves every quaternion component unchanged, including deliberately non-unit source values', () => {
    const f = fixture(); f.root.quaternion.set(.1, .2, .3, .7); f.mid.quaternion.set(-.2, .4, .1, .8); const before = tuple(f); run(f, config(0)); expect(tuple(f)).toEqual(before); expect(f.refresh).not.toHaveBeenCalled(); expect((f.controller as any).originals.size).toBe(0); f.controller.clear(); expect(tuple(f)).toEqual(before);
  });
  it('is exact under nonuniform rotated/sheared common model transforms', () => {
    const f = fixture(); f.model.matrixAutoUpdate = false; f.model.matrix.set(3, .7, .3, 10, .2, .6, -.1, 5, 0, .4, 2, -4, 0, 0, 0, 1); f.model.updateMatrixWorld(true); f.goal.copy(v(1, .8, .2).applyMatrix4(f.model.matrixWorld)); run(f); expect(position(f.end).distanceTo(f.goal)).toBeLessThan(.000001); f.controller.clear();
  });
  it('supports positive uniform bone scales and static intermediary ancestor transforms', () => {
    const f = fixture(), first = new THREE.Group(), second = new THREE.Group(); f.root.remove(f.mid); first.position.set(.1, .2, 0); first.rotation.z = .2; first.scale.setScalar(.8); f.root.add(first); first.add(f.mid); f.mid.remove(f.end); second.position.set(.2, 0, .1); second.rotation.y = -.2; second.scale.setScalar(.9); f.mid.add(second); second.add(f.end); f.root.scale.setScalar(1.2); f.mid.scale.setScalar(.7); second.updateMatrix(); second.matrixAutoUpdate = false;
    run(f); expect(position(f.end).distanceTo(f.goal)).toBeLessThan(.000001); f.controller.clear();
  });
  it.each(['root', 'mid', 'end'])('rejects nonuniform local %s scale once rather than claiming an exact solve', key => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {}), f = fixture(); f[key as 'root' | 'mid' | 'end'].scale.set(1, 2, 1); const before = tuple(f);
    for (let i = 0; i < 5; i++) { f.controller.beginFrame(); run(f); expect(tuple(f)).toEqual(before); } expect(warn).toHaveBeenCalledOnce(); f.controller.clear();
  });
  it('rejects static intermediary shear and zero-length chains', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {}), f = fixture(), spacer = new THREE.Group(); f.root.remove(f.mid); f.root.add(spacer); spacer.add(f.mid); spacer.matrixAutoUpdate = false; spacer.matrix.set(1, .2, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1); const before = tuple(f); run(f); expect(tuple(f)).toEqual(before); expect(warn).toHaveBeenCalledOnce();
    f.controller.clear(); spacer.matrix.identity(); f.mid.position.set(0, 0, 0); run(f); expect(warn).toHaveBeenCalledTimes(2); expect(f.root.quaternion.toArray().every(Number.isFinite)).toBe(true); f.controller.clear();
  });
  it('takes the nearest outer/inner reachable endpoint and preserves pole side across reach limits', () => {
    const f = fixture(); f.goal.set(20, 0, 0); run(f); expect(position(f.end).x).toBeCloseTo(2); expect(position(f.mid).z).toBeGreaterThanOrEqual(0); f.controller.beginFrame(); f.mid.position.x = 2; f.goal.set(.1, 0, 0); run(f); expect(position(f.end).x).toBeCloseTo(1); expect(position(f.mid).x).toBeCloseTo(2); expect(position(f.end).toArray().every(Number.isFinite)).toBe(true); f.controller.clear();
  });
  it('restores before actual Mixer sampling, preserves weight-zero animation and never accumulates paused IK', () => {
    const f = fixture(), baseline = rig(), a = new THREE.AnimationMixer(f.model), b = new THREE.AnimationMixer(baseline.model), q = new THREE.Quaternion().setFromAxisAngle(v(0, 0, 1), .4), clip = new THREE.AnimationClip('pose', 1, [new THREE.QuaternionKeyframeTrack('Root.quaternion', [0, 1], [0, 0, 0, 1, ...q.toArray()])]); a.clipAction(clip).play(); b.clipAction(clip).play(); a.update(.3); b.update(.3); const original = tuple(f);
    const first = run(f).signature; for (let i = 0; i < 20; i++) { f.controller.beginFrame(); expect(tuple(f)).toEqual(original); expect(run(f).signature).toBe(first); }
    f.controller.beginFrame(); a.update(.2); b.update(.2); run(f, config(0)); expect(tuple(f)).toEqual(tuple(baseline)); f.controller.clear(); a.stopAllAction(); b.stopAllAction(); a.uncacheRoot(f.model); b.uncacheRoot(baseline.model);
  });
  it('uses linear parameter envelopes, interrupts from the current value and treats invalid inputs as effective zero', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {}), full = fixture(); run(full); const solved = full.root.quaternion.clone(); full.controller.clear(); const f = fixture(), data = config({ param: 'reach', fade: 1 }), initial = f.root.quaternion.clone();
    run(f, data, { reach: true }, 0); expect(f.root.quaternion.toArray()).toEqual(initial.toArray()); f.controller.beginFrame(); run(f, data, { reach: 1 }, .25); expect(f.root.quaternion.angleTo(initial.clone().slerp(solved, .25))).toBeLessThan(1e-7);
    f.controller.beginFrame(); run(f, data, { reach: false }, .25); expect(f.root.quaternion.angleTo(initial.clone().slerp(solved, .1875))).toBeLessThan(1e-7);
    f.controller.beginFrame(); run(f, data, { reach: 4 }, .5); expect(f.root.quaternion.angleTo(initial.clone().slerp(solved, .59375))).toBeLessThan(1e-7);
    for (let i = 0; i < 3; i++) { f.controller.beginFrame(); run(f, data, { reach: '1' }, .1); expect(f.root.quaternion.toArray()).toEqual(initial.toArray()); } expect(warn).toHaveBeenCalledOnce(); f.controller.clear();
  });
  it('restores current source pose on target invalidation, removal, model replacement and clear', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {}), f = fixture(), before = tuple(f); const active = run(f).signature; f.controller.beginFrame(); f.targets.clear(); const missing = run(f).signature; expect(tuple(f)).toEqual(before); expect(missing).not.toBe(active); expect(warn).toHaveBeenCalledOnce();
    const next = rig(); f.controller.beginFrame(); f.targets.set('goal', { position: f.goal, dependencies: [] }); f.controller.sync([{ id: 'actor', model: next.model, config: config(), params: {} }], f.context, 0); expect(tuple(f)).toEqual(before); expect(position(next.end).distanceTo(f.goal)).toBeLessThan(.000001);
    f.controller.beginFrame(); const removed = f.controller.sync([], f.context, 0); expect(removed.signature).toBe('[]'); expect(tuple(next)).toEqual(before); expect((f.controller as any).states.size).toBe(0); f.controller.clear();
  });
  it('waits for a model once and safely rejects malformed/cyclic direct data before stringification', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {}), f = fixture(), raw: any = { chains: [] }; raw.extra = raw;
    for (let i = 0; i < 5; i++) f.controller.sync([{ id: 'actor', config: raw, params: {} }], f.context, 0); expect(warn).toHaveBeenCalledOnce();
    for (let i = 0; i < 5; i++) f.controller.sync([{ id: 'actor', config: config(), params: {} }], f.context, 0); expect(warn).toHaveBeenCalledTimes(2); run(f); expect(position(f.end).distanceTo(f.goal)).toBeLessThan(.000001); f.controller.clear();
  });
  it('rejects self-dependent descendants but allows another branch of the same model', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {}), f = fixture(), before = tuple(f); f.targets.set('goal', { position: f.goal, dependencies: [f.end] }); run(f); expect(tuple(f)).toEqual(before); expect(warn).toHaveBeenCalledOnce();
    const other = new THREE.Bone(); other.position.copy(f.goal); f.model.add(other); f.targets.set('goal', { position: f.goal, dependencies: [other] }); f.controller.beginFrame(); run(f); expect(position(f.end).distanceTo(f.goal)).toBeLessThan(.000001); f.controller.clear();
  });
  it('updates E3 targets between ordered chains, allowing the second hand to follow the first hand prop', () => {
    const f = fixture(), second = rig(), cup = new THREE.Group(), scene = new THREE.Scene(), attachments = new SkeletalAttachments(); second.root.name = 'RootB'; second.mid.name = 'MidB'; second.end.name = 'EndB'; second.root.position.y = -.1; second.model.remove(second.root); f.model.add(second.root); scene.add(f.model, cup);
    const data: IK3D = { ...config(), chains: [...config().chains, { kind: 'two-bone', root: 'RootB', mid: 'MidB', end: 'EndB', target: { entity: 'cup', offset: [0, 0, 0] }, weight: 1 }] };
    const refresh = vi.fn(() => { attachments.sync([{ id: 'cup', object: cup, config: { parentId: 'actor', bone: 'End', offset: [0, -1, 0], rot: [0, 0, 0] } }], new Map([['actor', f.model]])); });
    f.controller.sync([{ id: 'actor', model: f.model, config: data, params: {} }], { refreshAttachments: refresh, resolveTarget: target => target.entity === 'cup' ? { position: position(cup), dependencies: [f.end] } : { position: f.goal, dependencies: [] } }, 0);
    expect(refresh).toHaveBeenCalledTimes(2); expect(position(f.end).distanceTo(f.goal)).toBeLessThan(.000001); refresh(); expect(position(second.end).distanceTo(position(cup))).toBeLessThan(.000001); expect(position(cup).distanceTo(v(2, -1, 0))).toBeGreaterThan(.1); attachments.clear(); f.controller.clear();
  });
  it('aims local +Z under a nonuniform parent, skips coincidence, and gives subsequent chains final priority', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {}), f = fixture(); f.model.scale.set(2, .5, 3); f.goal.set(1, 2, 4);
    const look: IK3D = { type: 'IK3D', chains: [], lookAt: { bone: 'Root', target: { entity: 'goal', offset: [0, 0, 0] }, weight: 1 } }; run(f, look); const origin = position(f.root), forward = v(0, 0, 1).applyMatrix4(f.root.matrixWorld).sub(origin).normalize(); expect(forward.angleTo(f.goal.clone().sub(origin).normalize())).toBeLessThan(1e-7);
    f.controller.beginFrame(); f.goal.set(0, 0, 0); const before = tuple(f); run(f, look); expect(tuple(f)).toEqual(before); expect(warn).toHaveBeenCalledOnce();
    f.controller.beginFrame(); f.goal.copy(v(1, 1, 0).applyMatrix4(f.model.matrixWorld)); run(f, config(1, { lookAt: look.lookAt })); expect(position(f.end).distanceTo(f.goal)).toBeLessThan(.000001); f.controller.clear();
  });
  it('keeps 10,000 static solves/signatures and 17 parameter envelopes bounded, then releases cached generations', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {}), f = fixture(), data = config({ param: 'reach', fade: 0 }), first = run(f, data, { reach: 1 }).signature;
    for (let i = 0; i < 10000; i++) { f.controller.beginFrame(); expect(run(f, data, { reach: 1 }, .016).signature).toBe(first); }
    expect(position(f.end).distanceTo(f.goal)).toBeLessThan(.000001); expect(f.model.children).toEqual([f.root]); expect(f.root.children).toEqual([f.mid]); expect((f.controller as any).states.size).toBe(1); expect((f.controller as any).states.get('actor').weights.size).toBe(1); expect((f.controller as any).originals.size).toBe(2); expect(warn).not.toHaveBeenCalled(); f.controller.clear(); expect((f.controller as any).states.size).toBe(0); expect((f.controller as any).originals.size).toBe(0);
  });
});
