import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { World } from '@engine/core/world.js';
import type { Component } from '@engine/core/types.js';
import type { IK3D } from '@engine/protocol/components/ik3d.js';
import { InverseKinematics } from '@renderer/three/inverse-kinematics.js';
import { createIKTargetResolver } from '@renderer/three/ik-targets.js';
import { readIKParams } from '@renderer/three/ik-params.js';
import { hashSnapshot } from './determinism.js';
import { hashWorld } from './world-hash.js';

const config = (): IK3D => ({ type: 'IK3D', chains: [{ kind: 'two-bone', root: 'Root', mid: 'Mid', end: 'End', target: { entity: 'future', offset: [0, 0, 0] }, weight: 1 }] });
function world(): World {
  const state = new World(); state.createEntity('hero');
  state.addComponent('hero', { type: 'Transform', x: 1, y: 2, rotation: 0, scaleX: 1, scaleY: 1 });
  state.addComponent('hero', { type: 'Velocity', vx: .1, vy: 0, angular: 0 });
  state.addComponent('hero', { type: 'Flag', id: 'grip', active: false });
  state.addComponent('hero', { type: 'State', fsmId: 'motion', current: 'idle', previous: 'idle' });
  return state;
}

describe('IK3D simulation hash isolation', () => {
  it('excludes IK configuration addition, replacement and removal from full and incremental hashes', () => {
    const state = world(), before = hashSnapshot(state.snapshot()); expect(hashWorld(state)).toBe(before);
    state.addComponent('hero', config()); expect(hashSnapshot(state.snapshot())).toBe(before); expect(hashWorld(state)).toBe(before);
    state.addComponent('hero', { type: 'IK3D', chains: [], lookAt: { bone: 'Head', target: { entity: 'another', offset: [1, 2, 3] }, weight: { param: 'grip', fade: 1 } } } as IK3D);
    expect(hashSnapshot(state.snapshot())).toBe(before); expect(hashWorld(state)).toBe(before);
    state.removeComponent('hero', 'IK3D'); expect(hashSnapshot(state.snapshot())).toBe(before); expect(hashWorld(state)).toBe(before);
  });

  it.each([
    { type: 'Transform', x: 3, y: 2, rotation: 0, scaleX: 1, scaleY: 1 },
    { type: 'Velocity', vx: .2, vy: 0, angular: 0 },
    { type: 'Flag', id: 'grip', active: true },
    { type: 'State', fsmId: 'motion', current: 'walk', previous: 'idle' },
  ])('still detects a real simulation change in $type with IK present', changed => {
    const state = world(); state.addComponent('hero', config()); const before = hashSnapshot(state.snapshot()); expect(hashWorld(state)).toBe(before);
    state.addComponent('hero', changed as Component);
    expect(hashSnapshot(state.snapshot())).not.toBe(before); expect(hashWorld(state)).toBe(hashSnapshot(state.snapshot()));
  });

  it('keeps two worlds pure over 20k native Bone/Mixer/IK CPU updates with E2 weight inputs and different render clocks', () => {
    // CPU adapters only: official ModelPool/ThreeRenderer/GPU integration is a separate gate.
    const states = [world(), world()], controllers = states.map(() => new InverseKinematics());
    const rigs = states.map((state, side) => {
      state.createEntity('goal');
      state.addComponent('hero', { type: 'Flag', id: 'grip', active: true });
      state.addComponent('hero', { type: 'AnimGraph3D', clips: { idle: { clip: 'idle' } }, states: { idle: { clip: 'idle' } }, transitions: [], params: { grip: 'flag:grip', move: 'speed' } });
      state.addComponent('hero', { type: 'Model3D', modelKey: 'cpu-character' });
      state.addComponent('hero', { ...config(), chains: [{ ...config().chains[0], target: { entity: 'goal', offset: [0, 0, 0] },
        weight: { param: 'grip', fade: side ? .16 : .08 }, pole: [0, 0, 1] }] } as IK3D);
      const model = new THREE.Group(), root = new THREE.Bone(), mid = new THREE.Bone(), end = new THREE.Bone(), goal = new THREE.Group();
      root.name = 'Root'; mid.name = 'Mid'; end.name = 'End';
      mid.position.y = 1; end.position.y = 1; model.add(root); root.add(mid); mid.add(end); model.scale.set(1.3, .9, 1.1);
      const mixer = new THREE.AnimationMixer(model);
      mixer.clipAction(new THREE.AnimationClip('source-arm', 1, [new THREE.QuaternionKeyframeTrack('Root.quaternion', [0, .5, 1],
        [0, 0, -Math.sin(.1), Math.cos(.1), 0, 0, Math.sin(.1), Math.cos(.1), 0, 0, -Math.sin(.1), Math.cos(.1)])])).play();
      const models = new Map([['hero', model]]), drawables = new Map([['goal', goal]]);
      const resolveTarget = createIKTargetResolver(side ? state.readView() : state, models, drawables, new Map(), () => new Set());
      return { model, root, mid, end, goal, mixer, resolveTarget };
    });
    const views = states.map(state => state.readView());
    const baselines = states.map(state => {
      state.drainDirty(); const snapshot = state.snapshot();
      return { snapshot: JSON.stringify(snapshot), hash: hashSnapshot(snapshot), sequence: state.writeSequence };
    });
    expect(baselines[0].hash).toBe(baselines[1].hash);
    let maximumError = 0, maximumInstanceDifference = 0;
    const minimum = [Infinity, Infinity], maximum = [-Infinity, -Infinity];
    try {
      for (let frame = 0; frame < 10_000; frame++) {
        for (let side = 0; side < 2; side++) {
          const rig = rigs[side], state = states[side], controller = controllers[side];
          const dt = side ? (frame % 23 === 0 ? 0 : 1 / 144) : (frame % 17 === 0 ? .04 : 1 / 60);
          controller.beginFrame(); rig.mixer.update(dt); rig.model.updateWorldMatrix(true, true);
          const phase = frame / (side ? 53 : 37) + side * .5;
          rig.goal.position.copy(new THREE.Vector3(.4 + .5 * Math.sin(phase), 1 + .3 * Math.cos(phase), .15 * Math.sin(phase * 2)).applyMatrix4(rig.model.matrixWorld));
          const params = readIKParams(frame % 2 ? views[side] : state, 'hero');
          controller.sync([{ id: 'hero', config: views[side].getComponent<IK3D>('hero', 'IK3D'), model: rig.model, params }],
            { resolveTarget: rig.resolveTarget, refreshAttachments: () => {} }, dt);
          const position = rig.end.getWorldPosition(new THREE.Vector3());
          expect(position.toArray().every(Number.isFinite)).toBe(true);
          minimum[side] = Math.min(minimum[side], position.x); maximum[side] = Math.max(maximum[side], position.x);
          if (frame > 100) maximumError = Math.max(maximumError, position.distanceTo(rig.goal.position));
          const snapshot = state.snapshot();
          expect(JSON.stringify(snapshot), `world ${side} snapshot at IK frame ${frame}`).toBe(baselines[side].snapshot);
          expect(hashSnapshot(snapshot)).toBe(baselines[side].hash); expect(hashWorld(state)).toBe(baselines[side].hash);
          expect(state.writeSequence).toBe(baselines[side].sequence); expect(state.drainDirty()).toEqual([]);
        }
        maximumInstanceDifference = Math.max(maximumInstanceDifference, rigs[0].end.getWorldPosition(new THREE.Vector3()).distanceTo(rigs[1].end.getWorldPosition(new THREE.Vector3())));
      }
      expect(maximumError).toBeLessThan(.01);
      expect(maximum[0] - minimum[0]).toBeGreaterThan(.1); expect(maximum[1] - minimum[1]).toBeGreaterThan(.1);
      expect(maximumInstanceDifference).toBeGreaterThan(.1);
    } finally {
      for (let side = 0; side < 2; side++) { controllers[side].clear(); rigs[side].mixer.stopAllAction(); rigs[side].mixer.uncacheRoot(rigs[side].model); }
    }
    for (let side = 0; side < 2; side++) {
      expect(JSON.stringify(states[side].snapshot())).toBe(baselines[side].snapshot);
      expect(states[side].writeSequence).toBe(baselines[side].sequence); expect(states[side].drainDirty()).toEqual([]);
    }
  }, 30_000);
});
