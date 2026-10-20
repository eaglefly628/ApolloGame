import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { World } from '@engine/core/world.js';
import type { Component } from '@engine/core/types.js';
import type { AnimGraph3D } from '@engine/protocol/components/anim-graph.js';
import { AnimationGraphController } from '@renderer/three/animation-graph.js';
import { readAnimGraphParams } from '@renderer/three/animation-graph-params.js';
import { hashSnapshot } from './determinism.js';
import { hashWorld } from './world-hash.js';

function graph(speed = 1): AnimGraph3D {
  return { type: 'AnimGraph3D', clips: { idle: { clip: 'idle', speed }, walk: { clip: 'walk', speed }, run: { clip: 'run', speed } },
    states: { locomotion: { blend: { param: 'move', points: [{ at: 0, clip: 'idle' }, { at: .05, clip: 'walk' }, { at: .15, clip: 'run' }] } },
      rest: { clip: 'idle' }, sprint: { clip: 'run' } },
    transitions: [
      { from: 'locomotion', to: 'rest', whenParam: 'paused', cmp: 'eq', value: true, fade: .15 },
      { from: 'rest', to: 'locomotion', whenParam: 'paused', cmp: 'eq', value: false, fade: .2 },
      { from: 'locomotion', to: 'sprint', whenParam: 'mode', cmp: 'eq', value: 'boost', fade: .07 },
      { from: 'sprint', to: 'locomotion', whenParam: 'mode', cmp: 'ne', value: 'boost', fade: .05 },
    ], params: { move: 'speed', paused: 'flag:paused', mode: 'state:locomotion' } };
}

function world(g = graph()): World {
  const result = new World(); result.createEntity('hero');
  result.addComponent('hero', { type: 'Transform', x: 2, y: 4, rotation: 0, scaleX: 1, scaleY: 1 });
  result.addComponent('hero', { type: 'Velocity', vx: .03, vy: .04, angular: 0 });
  result.addComponent('hero', { type: 'Flag', id: 'paused', active: false });
  result.addComponent('hero', { type: 'State', fsmId: 'locomotion', current: 'walk', previous: 'idle' });
  result.addComponent('hero', { type: 'Model3D', modelKey: 'local-character' });
  result.addComponent('hero', g);
  return result;
}

function rig() {
  const root = new THREE.Group(), bone = new THREE.Bone(); bone.name = 'Hips'; root.add(bone);
  return { root, bone };
}

function clips(): ReadonlyMap<string, { clip: THREE.AnimationClip; loop: boolean }> {
  return new Map(['idle', 'walk', 'run'].map((name, i) => {
    const angle = .1 + i * .35;
    return [name, { loop: true, clip: new THREE.AnimationClip(name, 1, [
      new THREE.VectorKeyframeTrack('Hips.position', [0, .5, 1], [0, i * .2, 0, .1 + i * .2, i * .2 + .1, 0, 0, i * .2, 0]),
      new THREE.QuaternionKeyframeTrack('Hips.quaternion', [0, .5, 1], [0, 0, 0, 1, 0, 0, Math.sin(angle), Math.cos(angle), 0, 0, 0, 1]),
    ]) }];
  }));
}

describe('AnimGraph3D simulation isolation', () => {
  it('excludes adding, changing and removing AnimGraph3D from the world hash', () => {
    const state = world(); state.removeComponent('hero', 'AnimGraph3D');
    const baseline = hashSnapshot(state.snapshot());
    state.addComponent('hero', graph());
    expect(hashSnapshot(state.snapshot())).toBe(baseline);
    state.addComponent('hero', graph(.25));
    expect(hashSnapshot(state.snapshot())).toBe(baseline);
    state.removeComponent('hero', 'AnimGraph3D');
    expect(hashSnapshot(state.snapshot())).toBe(baseline);
  });

  it.each([
    { type: 'Velocity', vx: .04, vy: .04, angular: 0 },
    { type: 'Flag', id: 'paused', active: true },
    { type: 'State', fsmId: 'locomotion', current: 'run', previous: 'walk' },
    { type: 'Transform', x: 3, y: 4, rotation: 0, scaleX: 1, scaleY: 1 },
  ])('still detects a real simulation change in $type', changed => {
    const state = world(), baseline = hashSnapshot(state.snapshot());
    expect(hashWorld(state)).toBe(baseline);
    state.addComponent('hero', changed as Component);
    expect(hashSnapshot(state.snapshot())).not.toBe(baseline);
    expect(hashWorld(state)).toBe(hashSnapshot(state.snapshot()));
  });

  it('keeps two worlds unchanged through 10,000 native animation updates each with different render clocks and blend inputs', () => {
    const ga = graph(1), gb = graph(.7), worlds = [world(ga), world(gb)], rigs = [rig(), rig()];
    const sourceClips = clips();
    const beforeClips = [...sourceClips].map(([alias, source]) => [alias, source.clip.toJSON()]);
    const controllers = [new AnimationGraphController(rigs[0].root, ga, sourceClips), new AnimationGraphController(rigs[1].root, gb, sourceClips)];
    const baselines = worlds.map(state => {
      state.drainDirty();
      const snapshot = state.snapshot();
      return { snapshot: JSON.stringify(snapshot), hash: hashSnapshot(snapshot), writeSequence: state.writeSequence };
    });
    expect(baselines[0].hash).toBe(baselines[1].hash); // Only the render-only graph configurations differ.
    const minimum = [Infinity, Infinity], maximum = [-Infinity, -Infinity];
    let maximumInstanceDifference = 0;
    try {
      for (let frame = 0; frame < 10_000; frame++) {
        for (let side = 0; side < 2; side++) {
          const state = worlds[side], g = side ? gb : ga;
          // Alternate the real World and its normal renderer view; both must remain pure reads.
          const projected = readAnimGraphParams(frame % 2 ? state.readView() : state, 'hero', g);
          const params = { ...projected,
            move: (projected.move as number) * (1.8 + 1.7 * Math.sin(frame / (side ? 29 : 41))),
            paused: frame % (side ? 89 : 137) < (side ? 7 : 19),
            mode: frame % (side ? 173 : 211) < (side ? 21 : 17) ? 'boost' : 'walk',
          };
          const dt = side ? (frame % 13 === 0 ? .08 : 1 / 144) : (frame % 17 === 0 ? 0 : 1 / 60);
          controllers[side].update(dt, params);
          rigs[side].root.updateMatrixWorld(true);
          const pose = rigs[side].bone.position.x;
          expect(Number.isFinite(pose)).toBe(true);
          minimum[side] = Math.min(minimum[side], pose); maximum[side] = Math.max(maximum[side], pose);
          const snapshot = state.snapshot();
          expect(JSON.stringify(snapshot), `world ${side} snapshot at render ${frame}`).toBe(baselines[side].snapshot);
          expect(hashSnapshot(snapshot), `world ${side} hash at render ${frame}`).toBe(baselines[side].hash);
          expect(hashWorld(state)).toBe(baselines[side].hash);
          expect(state.writeSequence).toBe(baselines[side].writeSequence);
          expect(state.drainDirty()).toEqual([]);
        }
        maximumInstanceDifference = Math.max(maximumInstanceDifference, rigs[0].bone.position.distanceTo(rigs[1].bone.position));
      }
      expect(maximum[0] - minimum[0]).toBeGreaterThan(.1);
      expect(maximum[1] - minimum[1]).toBeGreaterThan(.1);
      expect(maximumInstanceDifference).toBeGreaterThan(.1); // Distinct playback actually happened.
      expect([...sourceClips].map(([alias, source]) => [alias, source.clip.toJSON()])).toEqual(beforeClips);
    } finally { for (const controller of controllers) controller.dispose(); }
    for (let side = 0; side < 2; side++) {
      expect(JSON.stringify(worlds[side].snapshot())).toBe(baselines[side].snapshot);
      expect(worlds[side].writeSequence).toBe(baselines[side].writeSequence);
      expect(worlds[side].drainDirty()).toEqual([]);
    }
  }, 30_000);
});
