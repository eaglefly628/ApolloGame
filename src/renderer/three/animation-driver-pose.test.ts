import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { AnimationDriverPoseSampler } from './animation-driver-pose.js';
function rig() { const root = new THREE.Group(), bone = new THREE.Bone(); bone.name = 'Joint'; bone.position.x = 3; root.add(bone); return { root, bone }; }
function clip() { return new THREE.AnimationClip('move', 2, [new THREE.VectorKeyframeTrack('Joint.position', [0, 2], [0, 0, 0, 20, 0, 0])]); }
function sampler(root: THREE.Object3D) { const c = clip(); return new AnimationDriverPoseSampler(root, 30, new Map([['a', { clip: c, durationTicks: 60 }], ['b', { clip: c, durationTicks: 60 }]])); }
describe('fixed-tick driver absolute native pose sampler', () => {
  it('samples exact first/intermediate/end frames and seeks backward without a mixer clock', () => {
    const { root, bone } = rig(), s = sampler(root);
    for (const [tick, x] of [[0, 0], [30, 10], [60, 20], [6, 2], [0, 0]]) { s.sample([{ clip: 'a', timeSeconds: tick / 30, weight: 1 }]); expect(bone.position.x).toBeCloseTo(x); }
    s.dispose(); expect(bone.position.x).toBe(3);
  });
  it('keeps aliases and model instances independent, with absolute weighted times', () => {
    const a = rig(), b = rig(), sa = sampler(a.root), sb = sampler(b.root);
    sa.sample([{ clip: 'a', timeSeconds: .4, weight: .25 }, { clip: 'b', timeSeconds: 2, weight: .75 }]);
    sb.sample([{ clip: 'a', timeSeconds: 1, weight: 1 }]); expect(a.bone.position.x).toBeCloseTo(16); expect(b.bone.position.x).toBeCloseTo(10);
    sa.sample([{ clip: 'a', timeSeconds: 0, weight: 1 }]); expect(b.bone.position.x).toBeCloseTo(10); sa.dispose(); sb.dispose();
  });
  it('reapplies identical frozen pose after IK mutation without claiming a changed snapshot', () => {
    const { root, bone } = rig(), s = sampler(root), samples = Object.freeze([Object.freeze({ clip: 'a', timeSeconds: 1, weight: 1 })]);
    expect(s.sample(samples).changed).toBe(true); bone.position.x = 999;
    expect(s.sample(samples).changed).toBe(false); expect(bone.position.x).toBeCloseTo(10); expect(samples[0].timeSeconds).toBe(1); s.dispose();
  });
  it('keeps native bind-pose contribution for partial weights and zero-weight projections', () => {
    const { root, bone } = rig(), s = sampler(root);
    s.sample([{ clip: 'a', timeSeconds: 1, weight: .5 }]); expect(bone.position.x).toBeCloseTo(6.5);
    s.sample([{ clip: 'a', timeSeconds: 1, weight: 0 }, { clip: 'b', timeSeconds: 2, weight: 0 }]); expect(bone.position.x).toBe(3); s.dispose();
  });
  it('rejects actual duration mismatches before creating animation bindings, allows float32 storage error', () => {
    const { root, bone } = rig(); expect(() => new AnimationDriverPoseSampler(root, 30, new Map([['x', { clip: clip(), durationTicks: 58 }]]))).toThrow(/duration mismatch/); expect(bone.position.x).toBe(3);
    new AnimationDriverPoseSampler(root, 30, new Map([['x', { clip: clip(), durationTicks: 61 }]])).dispose();
    const c = clip(); c.duration += 1e-7; new AnimationDriverPoseSampler(root, 30, new Map([['x', { clip: c, durationTicks: 60 }]])).dispose();
  });
  it('validates every sample before any pose write and restores rest on an empty projection', () => {
    const { root, bone } = rig(), s = sampler(root); s.sample([{ clip: 'a', timeSeconds: 1, weight: 1 }]);
    for (const sample of [[{ clip: 'a', timeSeconds: 3, weight: 1 }], [{ clip: 'missing', timeSeconds: 1, weight: 1 }], [{ clip: 'a', timeSeconds: 0, weight: 1.1 }], [{ clip: 'a', timeSeconds: NaN, weight: 1 }], [{ clip: 'a', timeSeconds: 0, weight: .5 }, { clip: 'a', timeSeconds: 1, weight: .5 }]]) expect(() => s.sample(sample)).toThrow();
    expect(bone.position.x).toBeCloseTo(10); s.sample([]); expect(bone.position.x).toBe(3); s.dispose(); s.dispose(); expect(() => s.sample([])).toThrow(/disposed/);
  });
});
