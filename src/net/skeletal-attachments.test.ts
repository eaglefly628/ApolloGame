import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { World } from '@engine/core/world.js';
import type { Component } from '@engine/core/types.js';
import type { Attach3D } from '@engine/protocol/components/attach3d.js';
import type { Transform, Velocity, Flag, State } from '@engine/protocol/components.js';
import { SkeletalAttachments } from '@renderer/three/skeletal-attachments.js';
import { hashSnapshot } from './determinism.js';
import { hashWorld } from './world-hash.js';

const attachment = (parentId = 'actor'): Attach3D => ({ type: 'Attach3D', parentId, bone: 'RightHand', offset: [0, 0, 0], rot: [0, 0, 0] });
function world(): World {
  const state = new World(); state.createEntity('prop');
  state.addComponent('prop', { type: 'Transform', x: 1, y: 2, rotation: 0, scaleX: 1, scaleY: 1 });
  return state;
}

describe('Attach3D simulation hash isolation', () => {
  it('excludes adding, replacing and deleting attachment data from both full and incremental hashes', () => {
    const state = world(), baseline = hashSnapshot(state.snapshot());
    expect(hashWorld(state)).toBe(baseline);
    state.addComponent('prop', attachment());
    expect(hashSnapshot(state.snapshot())).toBe(baseline); expect(hashWorld(state)).toBe(baseline);
    state.addComponent('prop', { ...attachment('another-actor'), bone: 'LeftHand', offset: [1, 2, 3], rot: [.1, .2, .3] });
    expect(hashSnapshot(state.snapshot())).toBe(baseline); expect(hashWorld(state)).toBe(baseline);
    state.removeComponent('prop', 'Attach3D');
    expect(hashSnapshot(state.snapshot())).toBe(baseline); expect(hashWorld(state)).toBe(baseline);
  });

  it.each([
    { type: 'Transform', x: 3, y: 2, rotation: 0, scaleX: 1, scaleY: 1 },
    { type: 'Velocity', vx: .1, vy: 0, angular: 0 },
    { type: 'Flag', id: 'held', active: true },
    { type: 'State', fsmId: 'carrying', current: 'held', previous: 'idle' },
  ])('still detects gameplay changes in $type while Attach3D is present', changed => {
    const state = world(); state.addComponent('prop', attachment());
    const before = hashSnapshot(state.snapshot()); expect(hashWorld(state)).toBe(before);
    state.addComponent('prop', changed as Component);
    expect(hashSnapshot(state.snapshot())).not.toBe(before); expect(hashWorld(state)).toBe(hashSnapshot(state.snapshot()));
  });

  it('keeps two worlds unchanged across 20k real CPU bone/attachment updates using readonly renderer inputs', () => {
    // This exercises the native animation + attachment helper boundary, not ThreeRenderer/GPU integration.
    const states = [world(), world()];
    const helpers = states.map(() => new SkeletalAttachments());
    const rigs = states.map((state, side) => {
      state.createEntity('actor');
      state.addComponent('actor', { type: 'Transform', x: 2, y: 3, rotation: 0, scaleX: 1, scaleY: 1 });
      state.addComponent('prop', { ...attachment(), offset: side ? [-.15, .3, .1] : [.2, 0, 0] } as Attach3D);
      state.addComponent('actor', { type: 'Velocity', vx: .03, vy: .04, angular: 0 });
      state.addComponent('actor', { type: 'Flag', id: 'animating', active: true });
      state.addComponent('actor', { type: 'State', fsmId: 'motion', current: 'walk', previous: 'idle' });
      const root = new THREE.Group(), hand = new THREE.Bone(), prop = new THREE.Group();
      hand.name = 'RightHand'; root.add(hand); root.scale.set(1.2, .8, 1.1);
      const mixer = new THREE.AnimationMixer(root);
      const clip = new THREE.AnimationClip('hand-motion', 1, [
        new THREE.VectorKeyframeTrack('RightHand.position', [0, .5, 1], [0, 1, 0, .6, 1.2, .2, 0, 1, 0]),
        new THREE.QuaternionKeyframeTrack('RightHand.quaternion', [0, .5, 1], [0, 0, 0, 1, 0, 0, Math.sin(.4), Math.cos(.4), 0, 0, 0, 1]),
      ]);
      mixer.clipAction(clip).play();
      return { root, hand, prop, mixer, models: new Map([['actor', root]]) };
    });
    const views = states.map(state => state.readView());
    const baselines = states.map(state => {
      state.drainDirty();
      const snapshot = state.snapshot();
      return { snapshot: JSON.stringify(snapshot), hash: hashSnapshot(snapshot), sequence: state.writeSequence };
    });
    expect(baselines[0].hash).toBe(baselines[1].hash); // Different local attachment offsets do not enter sim hash.
    const minimum = [Infinity, Infinity], maximum = [-Infinity, -Infinity];
    let maximumDifference = 0;
    try {
      for (let frame = 0; frame < 10_000; frame++) {
        for (let side = 0; side < 2; side++) {
          const state = states[side], view = views[side], rig = rigs[side], helper = helpers[side];
          const config = view.getComponent<Attach3D>('prop', 'Attach3D')!;
          const input = view.getComponent<Velocity>('actor', 'Velocity')!;
          const flag = view.getComponent<Flag>('actor', 'Flag')!, mode = view.getComponent<State>('actor', 'State')!;
          const transform = view.getComponent<Transform>('actor', 'Transform')!;
          helper.beginFrame();
          rig.root.position.set(transform.x, 0, transform.y);
          const dt = side ? (frame % 23 === 0 ? .06 : 1 / 144) : (frame % 17 === 0 ? 0 : 1 / 60);
          rig.mixer.update(flag.active && mode.current === 'walk' ? dt * Math.hypot(input.vx, input.vy) * 20 : 0);
          const result = helper.sync([{ id: 'prop', config, object: rig.prop }], rig.models);
          expect(result.hidden.size).toBe(0); expect(result.poses.has('prop')).toBe(true);
          const x = rig.prop.matrixWorld.elements[12]; expect(Number.isFinite(x)).toBe(true);
          minimum[side] = Math.min(minimum[side], x); maximum[side] = Math.max(maximum[side], x);
          if (frame % 257 === 0) {
            const local = new THREE.Matrix4().compose(new THREE.Vector3(...config.offset),
              new THREE.Quaternion().setFromEuler(new THREE.Euler(...config.rot, 'XYZ')), rig.prop.scale);
            const expected = new THREE.Matrix4().multiplyMatrices(rig.hand.matrixWorld, local);
            expect(rig.prop.matrixWorld.elements.every((value, i) => Math.abs(value - expected.elements[i]) < 1e-10)).toBe(true);
          }
          const snapshot = state.snapshot();
          expect(JSON.stringify(snapshot), `world ${side} snapshot at attachment frame ${frame}`).toBe(baselines[side].snapshot);
          expect(hashSnapshot(snapshot)).toBe(baselines[side].hash); expect(hashWorld(state)).toBe(baselines[side].hash);
          expect(state.writeSequence).toBe(baselines[side].sequence); expect(state.drainDirty()).toEqual([]);
        }
        maximumDifference = Math.max(maximumDifference, new THREE.Vector3().setFromMatrixPosition(rigs[0].prop.matrixWorld)
          .distanceTo(new THREE.Vector3().setFromMatrixPosition(rigs[1].prop.matrixWorld)));
      }
      expect(maximum[0] - minimum[0]).toBeGreaterThan(.1); expect(maximum[1] - minimum[1]).toBeGreaterThan(.1);
      expect(maximumDifference).toBeGreaterThan(.1);
    } finally {
      for (let side = 0; side < 2; side++) { helpers[side].clear(); rigs[side].mixer.stopAllAction(); rigs[side].mixer.uncacheRoot(rigs[side].root); }
    }
    for (let side = 0; side < 2; side++) {
      expect(JSON.stringify(states[side].snapshot())).toBe(baselines[side].snapshot);
      expect(states[side].writeSequence).toBe(baselines[side].sequence); expect(states[side].drainDirty()).toEqual([]);
    }
  }, 30_000);
});
