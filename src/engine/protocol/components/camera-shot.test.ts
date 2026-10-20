import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { validateCameraShot3D, validateCameraShotCarrier, validateCameraShotProjection, type CameraShotProjection } from './camera-shot.js';

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

const projection = (overrides: Partial<CameraShotProjection> = {}): CameraShotProjection => ({ projection: 'perspective', near: 1, far: 10000, fov: 50, orthoSize: 1, aspect: 1, ...overrides });
function nativeProjection(value: CameraShotProjection): THREE.PerspectiveCamera | THREE.OrthographicCamera {
  if (value.projection === 'perspective') return new THREE.PerspectiveCamera(value.fov, value.aspect, value.near, value.far);
  const halfH = Math.max(value.orthoSize, 1e-3), halfW = halfH * Math.max(value.aspect, 1e-6);
  return new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, value.near, value.far);
}
const finite = (values: Iterable<number>) => [...values].every(Number.isFinite);

describe('CameraShot3D native projection admission', () => {
  it.each([
    { fov: Number.MIN_VALUE }, { fov: 1e-300 }, { near: 1e308, far: 1.7e308 }, { near: Number.MIN_VALUE, far: Number.MIN_VALUE * 2 },
  ])('rejects reported unsafe authored lens and proves native CPU/Float32 failure %s', fields => {
    const camera = { yaw: 0, pitch: .5, ...fields }, context = projection(fields), native = nativeProjection(context);
    expect(finite(native.projectionMatrix.elements) && finite(new Float32Array(native.projectionMatrix.elements))
      && finite(native.projectionMatrixInverse.elements) && finite(new Float32Array(native.projectionMatrixInverse.elements))).toBe(false);
    expect(() => validateCameraShotCarrier(camera)).toThrow(/CameraShot3D.*projection/);
    expect(() => validateCameraShotProjection(context)).toThrow(/CameraShot3D.*projection/);
  });

  it('rejects a finite forward projection whose inverse cannot be uploaded as Float32', () => {
    for (const context of [projection({ near: 1e-39, far: 1e-36 }), projection({ projection: 'ortho', orthoSize: 1e39 })]) {
      const native = nativeProjection(context);
      expect(finite(native.projectionMatrix.elements)).toBe(true); expect(finite(new Float32Array(native.projectionMatrix.elements))).toBe(true);
      expect(finite(native.projectionMatrixInverse.elements)).toBe(true); expect(finite(new Float32Array(native.projectionMatrixInverse.elements))).toBe(false);
      expect(() => validateCameraShotProjection(context)).toThrow(/projection.*inverse/);
    }
  });

  it('rejects unsafe authored orthographic dimensions through shared carrier validation', () => {
    expect(() => validateCameraShotCarrier({ yaw: 0, pitch: 0, projection: 'ortho', orthoSize: 1e39 })).toThrow(/projection.*inverse/);
  });

  it.each([
    [1.4715303e-39, 1e-36, true, false],
    [1.4696764e-39, 7e-36, false, true],
  ] as const)('checks native and uploaded-matrix inverses independently at Float32 reciprocal boundaries %s %s', (near, far, cpuSafe, gpuSafe) => {
    const context = projection({ near, far }), native = nativeProjection(context);
    const uploaded = new THREE.Matrix4().fromArray(Array.from(new Float32Array(native.projectionMatrix.elements)));
    expect(finite(new Float32Array(native.projectionMatrix.elements))).toBe(true);
    expect(finite(new Float32Array(native.projectionMatrixInverse.elements))).toBe(cpuSafe);
    expect(finite(new Float32Array(uploaded.invert().elements))).toBe(gpuSafe);
    expect(() => validateCameraShotProjection(context)).toThrow(/projection.*inverse/);
  });

  it('rejects malformed resolved contexts before native projection arithmetic', () => {
    expect(() => validateCameraShotProjection(projection({ projection: 'invalid' as 'ortho' }))).toThrow(/projection kind/);
    expect(() => validateCameraShotProjection(projection({ fov: -50 }))).toThrow(/projection perspective/);
    expect(() => validateCameraShotProjection(projection({ projection: 'ortho', orthoSize: -Infinity }))).toThrow(/projection orthographic/);
  });

  it('rejects Float32-zero projection scales', () => {
    const large = projection({ projection: 'ortho', orthoSize: 1e100 }), native = nativeProjection(large);
    expect(native.projectionMatrix.elements[0]).not.toBe(0); expect(new Float32Array(native.projectionMatrix.elements)[0]).toBe(0);
    expect(() => validateCameraShotProjection(large)).toThrow(/projection x/);
  });

  it.each([
    projection(), projection({ aspect: 16 / 9, near: .1, far: 5000 }), projection({ fov: 1e-8 }), projection({ near: 1e-20, far: 1e-18 }),
    projection({ near: 1, far: 1.000001 }), projection({ near: 40, far: 40 + 7e-15 }), projection({ far: 1e307 }), projection({ projection: 'ortho', near: .01, far: 100, orthoSize: 25, aspect: 9 / 16 }),
    projection({ projection: 'ortho', orthoSize: Number.MIN_VALUE, aspect: 0 }), projection({ near: 3000, far: 7000, fov: 70, aspect: 2 }),
  ])('accepts native renderable perspective/ortho contexts without blanket ranges %s', context => {
    const before = JSON.stringify(context); expect(() => validateCameraShotProjection(context)).not.toThrow(); expect(JSON.stringify(context)).toBe(before);
    const native = nativeProjection(context), uploaded = new THREE.Matrix4().fromArray(Array.from(new Float32Array(native.projectionMatrix.elements)));
    for (const matrix of [native.projectionMatrix, native.projectionMatrixInverse, uploaded.clone().invert()]) {
      expect(finite(matrix.elements)).toBe(true); expect(finite(new Float32Array(matrix.elements))).toBe(true); expect(matrix.determinant()).not.toBe(0);
    }
  });

  it('keeps authored-field admission separate from resolved custom defaults and rejects unsafe actual context', () => {
    expect(() => validateCameraShotCarrier({ yaw: 0, pitch: 0 })).not.toThrow();
    expect(() => validateCameraShotCarrier({ yaw: 0, pitch: 0, near: 3000 })).not.toThrow();
    expect(() => validateCameraShotCarrier({ yaw: 0, pitch: 0, far: 1e307 })).not.toThrow();
    expect(() => validateCameraShotCarrier({ yaw: 0, pitch: 0, near: 40, far: 40 + 7e-15 })).not.toThrow();
    expect(() => validateCameraShotCarrier({ yaw: 0, pitch: 0, orthoSize: Number.MIN_VALUE })).not.toThrow();
    for (const context of [projection({ near: 3000, far: 2203 }), projection({ fov: Number.MIN_VALUE }), projection({ aspect: 1e-300 }),
      projection({ projection: 'ortho', orthoSize: 1e308 }), projection({ projection: 'ortho', near: 1e308, far: 1.7e308 })]) {
      expect(() => validateCameraShotProjection(context)).toThrow(/CameraShot3D.*projection/);
    }
  });
});
