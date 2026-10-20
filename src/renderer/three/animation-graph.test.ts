import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { AnimGraph3D } from '@engine/protocol/components.js';
import { AnimationGraphController } from './animation-graph.js';

type Rule = AnimGraph3D['transitions'][number];
function rig() {
  const root = new THREE.Group(), bone = new THREE.Bone();
  bone.name = 'Joint';
  bone.position.x = 3;
  root.add(bone);
  return { root, bone };
}
function clip(name: string, x: number, end = x) {
  return new THREE.AnimationClip(name, 1, [new THREE.VectorKeyframeTrack('Joint.position', [0, 1], [x, 0, 0, end, 0, 0])]);
}
function graph(overrides: Partial<AnimGraph3D> = {}): AnimGraph3D {
  return {
    type: 'AnimGraph3D',
    clips: { idle: { clip: 'idle', speed: 0 }, walk: { clip: 'walk', speed: 0 }, run: { clip: 'run', speed: 0 } },
    states: { locomotion: { blend: { param: 'move', points: [{ at: 0, clip: 'idle' }, { at: 1, clip: 'walk' }, { at: 2, clip: 'run' }] } }, rest: { clip: 'idle' }, sprint: { clip: 'run' } },
    transitions: [], params: { move: 'speed', paused: 'flag:paused', mode: 'state:mode' },
    ...overrides,
  };
}
function clips() {
  return new Map(['idle', 'walk', 'run'].map((alias, i) => [alias, { clip: clip(alias, i * 10), loop: true }]));
}
function rule(from: string, to: string, fade = 0, value: Rule['value'] = true, cmp: Rule['cmp'] = 'eq'): Rule {
  return { from, to, whenParam: 'paused', value, cmp, fade };
}

describe('AnimationGraphController native sampling and closed graph semantics', () => {
  it('uses first declared state and native bone tracks; adjacent blend weights sum to one, with clamped endpoints', () => {
    const { root, bone } = rig();
    const controller = new AnimationGraphController(root, graph(), clips());
    for (const [move, expected, weights] of [
      [-10, 0, [1, 0, 0]], [0, 0, [1, 0, 0]], [0.25, 2.5, [0.75, 0.25, 0]],
      [1, 10, [0, 1, 0]], [1.5, 15, [0, 0.5, 0.5]], [2, 20, [0, 0, 1]], [99, 20, [0, 0, 1]],
    ] as const) {
      controller.update(0, { move });
      expect(controller.debug.state).toBe('locomotion');
      expect(Object.values(controller.debug.weights)).toEqual(weights);
      expect(Object.values(controller.debug.weights).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
      expect(bone.position.x).toBeCloseTo(expected);
    }
    expect(controller.update(0.1, { move: 99 })).toEqual({ live: false, changed: false });
    controller.dispose();
  });

  it('counts duplicate aliases once in a blend', () => {
    const { root, bone } = rig();
    const g = graph({ states: { only: { blend: { param: 'move', points: [{ at: 0, clip: 'walk' }, { at: 1, clip: 'walk' }] } } } });
    const controller = new AnimationGraphController(root, g, clips());
    controller.update(0, { move: 0.3 });
    expect(controller.debug.weights.walk).toBe(1);
    expect(bone.position.x).toBeCloseTo(10);
    controller.dispose();
  });

  it.each([
    [-Number.MAX_VALUE, Number.MAX_VALUE, 0, .5],
    [-Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE / 2, .75],
    [0, Number.MIN_VALUE * 2, Number.MIN_VALUE, .5],
    [1e-300, 3e-300, 2e-300, .5],
  ])('keeps finite blend weights accurate for interval [%s,%s] at %s', (left, right, value, expectedRight) => {
    const { root, bone } = rig();
    const controller = new AnimationGraphController(root, graph({ states: { only: { blend: { param: 'move', points: [{ at: left, clip: 'idle' }, { at: right, clip: 'walk' }] } } } }), clips());
    controller.update(0, { move: value });
    const { weights } = controller.debug;
    expect(Object.values(weights).every(Number.isFinite)).toBe(true);
    expect(weights.idle).toBeCloseTo(1 - expectedRight, 12);
    expect(weights.walk).toBeCloseTo(expectedRight, 12);
    expect(weights.idle + weights.walk).toBeCloseTo(1, 12);
    expect(bone.position.x).toBeCloseTo(expectedRight * 10, 6);
    controller.dispose();
  });

  it('keeps bind pose for an initially missing blend source, then holds its last valid target and warns only once', () => {
    const { root, bone } = rig();
    const controller = new AnimationGraphController(root, graph(), clips());
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(controller.update(0, Object.freeze({}))).toEqual({ live: false, changed: true });
    expect(bone.position.x).toBe(3);
    expect(controller.debug.weights).toEqual({ idle: 0, walk: 0, run: 0 });
    controller.update(0, Object.freeze({ move: 1.5 }));
    expect(bone.position.x).toBeCloseTo(15);
    expect(controller.update(0.1, {})).toEqual({ live: false, changed: false });
    controller.update(0, { move: NaN });
    expect(controller.debug.weights).toEqual({ idle: 0, walk: 0.5, run: 0.5 });
    expect(bone.position.x).toBeCloseTo(15);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('move'));
    warn.mockRestore();
    controller.dispose();
  });

  it('uses the first matching transition and makes at most one transition per update', () => {
    const { root } = rig();
    const controller = new AnimationGraphController(root, graph({ transitions: [rule('locomotion', 'rest'), rule('locomotion', 'sprint'), rule('rest', 'sprint')] }), clips());
    controller.update(0, { paused: true, move: 0 });
    expect(controller.debug.state).toBe('rest');
    controller.update(0, { paused: true });
    expect(controller.debug.state).toBe('sprint');
    controller.dispose();
  });

  it.each(['eq', 'ne'] as const)('does not treat a missing source as false for %s', cmp => {
    const { root } = rig();
    const controller = new AnimationGraphController(root, graph({ transitions: [rule('locomotion', 'rest', 0, false, cmp)] }), clips());
    controller.update(0, { move: 0 });
    expect(controller.debug.state).toBe('locomotion');
    controller.dispose();
  });

  it.each([
    ['eq', false, false, true], ['eq', false, 0, false], ['eq', 'false', false, false],
    ['eq', 'walk', 'walk', true], ['ne', 'walk', 'run', true], ['ne', 'walk', 1, false],
    ['gt', 1, 2, true], ['gte', 1, 1, true], ['lt', 1, 0, true], ['lte', 1, 1, true],
    ['ne', 1, NaN, false],
  ] as const)('compares %s %s with %s without coercion', (cmp, expected, actual, matches) => {
    const { root } = rig();
    const source = typeof expected === 'number' ? 'speed' : typeof expected === 'boolean' ? 'flag:paused' : 'state:mode';
    const controller = new AnimationGraphController(root, graph({ params: { move: 'speed', paused: source }, transitions: [rule('locomotion', 'rest', 0, expected, cmp)] }), clips());
    controller.update(0, { paused: actual, move: 0 });
    expect(controller.debug.state).toBe(matches ? 'rest' : 'locomotion');
    controller.dispose();
  });

  it('fades paused actions through native bone weights, ends dirty once, and then converges', () => {
    const { root, bone } = rig();
    const controller = new AnimationGraphController(root, graph({ transitions: [rule('locomotion', 'rest', 1)] }), clips());
    expect(controller.update(0, { move: 2 })).toEqual({ live: false, changed: true });
    expect(bone.position.x).toBeCloseTo(20);
    expect(controller.update(0.25, { paused: true })).toEqual({ live: true, changed: true });
    expect(bone.position.x).toBeCloseTo(15);
    expect(controller.debug.weights).toEqual({ idle: 0.25, walk: 0, run: 0.75 });
    expect(controller.update(0.75, {})).toEqual({ live: false, changed: true });
    expect(bone.position.x).toBeCloseTo(0);
    expect(controller.update(0.1, {})).toEqual({ live: false, changed: false });
    expect(controller.debug.resources.interpolants).toBe(0);
    expect(controller.debug.actions.run.scheduled).toBe(false);
    controller.dispose();
  });

  it('interrupts a fade from its current weights and follows the new target blend each frame', () => {
    const { root, bone } = rig();
    const controller = new AnimationGraphController(root, graph({ transitions: [rule('locomotion', 'rest', 1), rule('rest', 'locomotion', 1, false)] }), clips());
    controller.update(0, { move: 2 });
    controller.update(0.25, { paused: true }); // idle .25 + run .75
    controller.update(0.5, { paused: false, move: 1 });
    expect(controller.debug.weights).toEqual({ idle: 0.125, walk: 0.5, run: 0.375 });
    expect(bone.position.x).toBeCloseTo(12.5);
    controller.update(0.25, { move: 0.5 }); // original snapshot -> current target
    expect(controller.debug.weights).toEqual({ idle: 0.4375, walk: 0.375, run: 0.1875 });
    expect(bone.position.x).toBeCloseTo(7.5);
    controller.update(0.25, { move: 0.5 });
    expect(controller.debug.weights).toEqual({ idle: 0.5, walk: 0.5, run: 0 });
    controller.dispose();
  });

  it('initializes a fade with the first state pose even when its transition matches on the first frame', () => {
    const { root, bone } = rig();
    const controller = new AnimationGraphController(root, graph({ transitions: [rule('locomotion', 'rest', 1)] }), clips());
    controller.update(0.5, { move: 2, paused: true });
    expect(controller.debug.weights).toEqual({ idle: 0.5, walk: 0, run: 0.5 });
    expect(bone.position.x).toBeCloseTo(10);
    controller.dispose();
  });

  it('keeps same-source aliases independent and applies native loop/speed defaults and overrides without changing the source', () => {
    const { root, bone } = rig();
    const source = clip('shared', 0, 10);
    const g = graph({ clips: { once: { clip: 'shared', speed: 2 }, forever: { clip: 'shared', speed: 1, loop: true } }, states: { both: { blend: { param: 'move', points: [{ at: 0, clip: 'once' }, { at: 1, clip: 'forever' }] } } } });
    const controller = new AnimationGraphController(root, g, new Map([['once', { clip: source, loop: false }], ['forever', { clip: source, loop: false }]]));
    controller.update(0.25, { move: 0.5 });
    expect(controller.debug.actions.once).toMatchObject({ time: 0.5, speed: 2, loop: false });
    expect(controller.debug.actions.forever).toMatchObject({ time: 0.25, speed: 1, loop: true });
    expect(bone.position.x).toBeCloseTo(3.75);
    expect(source.name).toBe('shared');
    expect([...source.tracks[0].values]).toEqual([0, 0, 0, 10, 0, 0]);
    expect(controller.debug.resources.actions).toBe(2);
    controller.dispose();
  });

  it('keeps the LoopOnce final native pose dirty once, then sleeps despite other zero-weight looping aliases', () => {
    const { root, bone } = rig();
    const g = graph({ clips: { idle: { clip: 'idle', loop: false }, walk: { clip: 'walk' }, run: { clip: 'run' } }, states: { only: { clip: 'idle' } } });
    const c = clips(); c.set('idle', { clip: clip('idle', 0, 10), loop: true });
    const controller = new AnimationGraphController(root, g, c);
    expect(controller.update(0.5, {})).toEqual({ live: true, changed: true });
    expect(bone.position.x).toBeCloseTo(5);
    expect(controller.update(0.5, {})).toEqual({ live: false, changed: true });
    expect(bone.position.x).toBeCloseTo(10);
    expect(controller.update(0.5, {})).toEqual({ live: false, changed: false });
    expect(controller.debug.resources.activeActions).toBe(1);
    expect(controller.debug.actions.walk.scheduled).toBe(false);
    controller.dispose();
  });

  it('restarts a once action when reentered, and does not restart it on repeated frames of the same state', () => {
    const { root, bone } = rig();
    const g = graph({ clips: { idle: { clip: 'idle', loop: false }, walk: { clip: 'walk', speed: 0 }, run: { clip: 'run', speed: 0 } }, states: { only: { clip: 'idle' }, rest: { clip: 'walk' } }, transitions: [rule('only', 'rest'), rule('rest', 'only', 0, false)] });
    const c = clips(); c.set('idle', { clip: clip('idle', 0, 10), loop: false });
    const controller = new AnimationGraphController(root, g, c);
    controller.update(2, {});
    expect(bone.position.x).toBeCloseTo(10);
    controller.update(0, { paused: true });
    controller.update(0.25, { paused: false });
    expect(bone.position.x).toBeCloseTo(2.5);
    controller.update(0.25, { paused: false });
    expect(bone.position.x).toBeCloseTo(5);
    controller.dispose();
  });

  it('keeps action/binding/interpolant allocation bounded over 20,000 repeated state frames', () => {
    const { root } = rig();
    const controller = new AnimationGraphController(root, graph({ transitions: [rule('locomotion', 'rest', 0.02), rule('rest', 'locomotion', 0.02, false)] }), clips());
    for (let frame = 0; frame < 20_000; frame++) controller.update(0.01, { move: (frame % 200) / 100, paused: frame % 2 === 0 });
    expect(controller.debug.resources).toMatchObject({ actions: 3, bindings: 1, interpolants: 0 });
    expect(controller.debug.resources.activeActions).toBeLessThanOrEqual(3);
    controller.dispose();
    expect(controller.debug.resources).toEqual({ actions: 0, activeActions: 0, bindings: 0, activeBindings: 0, interpolants: 0 });
  });

  it('isolates two controllers using the same graph/source and restores bind pose on dispose', () => {
    const a = rig(), b = rig(), g = graph(), source = clips();
    const one = new AnimationGraphController(a.root, g, source), two = new AnimationGraphController(b.root, g, source);
    one.update(0, { move: 0.5 }); two.update(0, { move: 1.5 });
    expect(a.bone.position.x).toBeCloseTo(5);
    expect(b.bone.position.x).toBeCloseTo(15);
    const snapshot = one.debug;
    // Even casts cannot write through the returned debug copy.
    (snapshot.weights as Record<string, number>).idle = 100;
    expect(one.debug.weights.idle).toBe(0.5);
    const stop = vi.spyOn(THREE.AnimationMixer.prototype, 'stopAllAction');
    const uncache = vi.spyOn(THREE.AnimationMixer.prototype, 'uncacheRoot');
    one.dispose(); one.dispose();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(uncache).toHaveBeenCalledWith(a.root);
    expect(a.bone.position.x).toBe(3);
    expect(b.bone.position.x).toBeCloseTo(15);
    expect(one.update(1, { move: 2 })).toEqual({ live: false, changed: false });
    stop.mockRestore(); uncache.mockRestore();
    two.dispose();
    expect(b.bone.position.x).toBe(3);
  });

  it('accepts zero and unclamped finite positive deltas, but rejects invalid deltas and clip speeds', () => {
    const { root } = rig();
    const controller = new AnimationGraphController(root, graph(), clips());
    for (const delta of [-1, NaN, Infinity]) expect(() => controller.update(delta, {})).toThrow('delta');
    expect(() => controller.update(0, { move: 0 })).not.toThrow();
    expect(() => controller.update(100, { move: 0 })).not.toThrow();
    controller.dispose();
    for (const speed of [-1, NaN, Infinity, 16.1]) expect(() => new AnimationGraphController(root, graph({ clips: { idle: { clip: 'idle', speed } } }), clips())).toThrow('speed');
    expect(() => new AnimationGraphController(root, graph(), new Map())).toThrow('missing clip alias');
  });

  it('validates direct-world graphs before allocating a mixer, including malformed comparisons and fades', () => {
    const { root } = rig();
    const allocate = vi.spyOn(THREE.AnimationMixer.prototype, 'clipAction');
    const invalid = [
      graph({ transitions: [rule('locomotion', 'rest', 0, true, 'gt')] }),
      graph({ params: { move: 'speed', paused: 'state:mode' }, transitions: [rule('locomotion', 'rest', 0, 'a', 'lt')] }),
      graph({ transitions: [rule('locomotion', 'rest', 61)] }),
      graph({ transitions: [rule('locomotion', 'rest', NaN)] }),
    ];
    for (const data of invalid) expect(() => new AnimationGraphController(root, data, clips())).toThrow('AnimGraph3D');
    expect(allocate).not.toHaveBeenCalled();
    allocate.mockRestore();
  });
});
