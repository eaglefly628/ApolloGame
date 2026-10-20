import { describe, expect, it, vi } from 'vitest';
import { validateCameraShot3D, validateCameraShotCarrier } from './camera-shot.js';

const frame = (at = 0) => ({ at, eye: [1, 2, 3], target: [0, 0, 0] });
const table = () => ({ shots: { intro: { keyframes: [frame(), frame(1)] } }, onSignal: [{ signal: 'play', shot: 'intro' }] });

describe('CameraShot3D closed data', () => {
  it('accepts raw/typed/frozen/null-prototype data without normalization', () => {
    for (const value of [table(), { type: 'CameraShot3D', ...table() }, Object.freeze(table()), Object.assign(Object.create(null), table())]) {
      const before = JSON.stringify(value); expect(validateCameraShot3D(value)).toBe(value); expect(JSON.stringify(value)).toBe(before);
    }
    for (const ease of ['linear', 'cubicOut', 'inOut']) expect(() => validateCameraShot3D({ shots: { cut: { keyframes: [{ ...frame(), ease }] } }, onSignal: [{ signal: 'cut', shot: 'cut' }] })).not.toThrow();
  });
  it.each([null, [], new Date(0), {}, { ...table(), type: 'Camera3D' }, { ...table(), type: undefined }, { ...table(), extra: true },
    { ...table(), shots: {} }, { ...table(), onSignal: [] }, { ...table(), onSignal: [{ signal: '', shot: 'intro' }] },
    { ...table(), onSignal: [{ signal: 'x'.repeat(257), shot: 'intro' }] }, { ...table(), onSignal: [{ signal: 'play', shot: 'missing' }] },
    { ...table(), onSignal: [{ signal: 'play', shot: 'intro' }, { signal: 'play', shot: 'intro' }] },
    { ...table(), onSignal: [{ signal: 'play', shot: 'intro', expr: 'x' }] },
  ])('rejects malformed records and bindings %s', value => expect(() => validateCameraShot3D(value)).toThrow(/CameraShot3D/));
  it.each([
    [], [frame(1)], [frame(), frame(0)], [frame(), frame(-1)], [frame(), frame(601)], [frame(), frame(NaN)],
    [{ ...frame(), eye: [0, 0] }], [{ ...frame(), eye: [Infinity, 0, 0] }], [{ ...frame(), eye: [1e6 + 1, 0, 0] }],
    [{ ...frame(), target: [1, 2, 3] }], [{ ...frame(), ease: 'easeOut' }], [{ ...frame(), ease: undefined }], [{ ...frame(), unknown: 1 }],
  ].map(value => [value]))('rejects malformed keyframes %s', keyframes => expect(() => validateCameraShot3D({ ...table(), shots: { intro: { keyframes } } })).toThrow(/CameraShot3D/));
  it('enforces every independent table budget and includes coordinate/time boundaries', () => {
    const frames = Array.from({ length: 64 }, (_, i) => frame(i ? i * 600 / 63 : 0));
    const value = { shots: Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`s${i}`, { keyframes: frames }])), onSignal: [{ signal: 'play', shot: 's0' }] };
    expect(() => validateCameraShot3D(value)).not.toThrow();
    expect(() => validateCameraShot3D({ ...value, shots: { ...value.shots, extra: { keyframes: [frame()] } } })).toThrow(/512/);
    expect(() => validateCameraShot3D({ shots: Object.fromEntries(Array.from({ length: 33 }, (_, i) => [`s${i}`, { keyframes: [frame()] }])), onSignal: [{ signal: 'play', shot: 's0' }] })).toThrow(/32/);
    expect(() => validateCameraShot3D({ ...table(), shots: { intro: { keyframes: Array.from({ length: 65 }, (_, i) => frame(i)) } } })).toThrow(/64/);
    expect(() => validateCameraShot3D({ ...table(), onSignal: Array.from({ length: 65 }, (_, i) => ({ signal: `s${i}`, shot: 'intro' })) })).toThrow(/64/);
    expect(() => validateCameraShot3D({ ...table(), shots: { [' '.repeat(2)]: { keyframes: [frame()] } } })).toThrow(/shot name/);
    expect(() => validateCameraShot3D({ ...table(), shots: { ['s'.repeat(257)]: { keyframes: [frame()] } } })).toThrow(/shot name/);
    expect(() => validateCameraShot3D({ ...table(), shots: { intro: { keyframes: [{ ...frame(), eye: [-1e6, 1e6, 0] }] } } })).not.toThrow();
    expect(() => validateCameraShot3D({ shots: Object.fromEntries(Array.from({ length: 32 }, (_, i) => [`s${i}`, { keyframes: Array.from({ length: 16 }, (_, i) => frame(i)) }])),
      onSignal: Array.from({ length: 64 }, (_, i) => ({ signal: `signal${i}`, shot: `s${i % 32}` })) })).not.toThrow();
  });
  it('rejects accessors without invoking them, holes, symbols, array extras and cycles', () => {
    const getter = vi.fn(() => table().shots), accessor = { ...table() }; Object.defineProperty(accessor, 'shots', { get: getter });
    const items: unknown[] = [accessor, { ...table(), [Symbol('extra')]: 1 }];
    for (const key of ['keyframes', 'onSignal']) {
      const value = table();
      if (key === 'keyframes') value.shots.intro.keyframes = new Array(1);
      else value.onSignal = new Array(1);
      items.push(value);
    }
    const extra = table(); Object.assign(extra.shots.intro.keyframes, { extra: true }); items.push(extra);
    const hidden = table(); Object.defineProperty(hidden.shots, 'hidden', { value: { keyframes: [frame()] } }); items.push(hidden);
    const tupleHole = table(); tupleHole.shots.intro.keyframes[0]!.eye = new Array(3); items.push(tupleHole);
    const tupleAccessor = table(); Object.defineProperty(tupleAccessor.shots.intro.keyframes[0]!.eye, '0', { get: getter }); items.push(tupleAccessor);
    const cycle = table() as unknown as Record<string, unknown>; cycle.shots = cycle; items.push(cycle);
    for (const item of items) expect(() => validateCameraShot3D(item)).toThrow(/CameraShot3D/);
    expect(getter).not.toHaveBeenCalled();
  });
  it('shares carrier safety checks without invoking raw carrier accessors', () => {
    const getter = vi.fn(() => 0), accessor = { yaw: 0, pitch: .5 }; Object.defineProperty(accessor, 'yaw', { get: getter });
    for (const camera of [accessor, { yaw: NaN, pitch: 0 }, { yaw: 0, pitch: 0, fov: 180 }, { yaw: 0, pitch: 0, far: 1 },
      { yaw: 0, pitch: 0, near: -1 }, { yaw: 0, pitch: 0, distance: Infinity }, { yaw: 0, pitch: 0, type: 'Camera' }]) expect(() => validateCameraShotCarrier(camera)).toThrow(/CameraShot3D/);
    expect(getter).not.toHaveBeenCalled();
    expect(() => validateCameraShotCarrier({ yaw: 0, pitch: .5, near: .1, far: 10, fov: 45, projection: 'ortho', orthoSize: 1 })).not.toThrow();
  });
});
