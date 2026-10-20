import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { Camera3D } from '@engine/protocol/components.js';
import { CameraRig, easeTween } from './camera-rig.js';
import { orbitCamera, orthoFrustum } from '../three-projection.js';

const base: Camera3D = { type: 'Camera3D', yaw: .7, pitch: .4, fov: 53, near: .1, far: 500 };
const eye = [4, 3, 5] as const, target = [.2, 1.1, -.3] as const;
function close(actual: ArrayLike<number>, expected: ArrayLike<number>) {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < actual.length; i++) expect(Math.abs(actual[i] - expected[i])).toBeLessThan(1e-10);
}
function nativePose<T extends THREE.Camera>(camera: T, position: readonly [number, number, number], aim: readonly [number, number, number]): T {
  camera.position.set(...position); camera.lookAt(...aim); camera.updateMatrixWorld(true); return camera;
}

describe('E6 native camera pose and legacy compatibility', () => {
  it('uses the exact current perspective camera with the base lens and native lookAt', () => {
    const rig = new CameraRig(48, 1), actual = rig.applyView(base, eye, target, 1.6, 3, 48, 2000);
    actual.updateMatrixWorld(true);
    const expected = nativePose(new THREE.PerspectiveCamera(53, 1.6, .1, 500), eye, target);
    expect(actual).toBe(rig.current); expect(actual).toBeInstanceOf(THREE.PerspectiveCamera);
    close(actual.matrixWorld.elements, expected.matrixWorld.elements);
    close(actual.matrixWorldInverse.elements, expected.matrixWorldInverse.elements);
    close(actual.projectionMatrix.elements, expected.projectionMatrix.elements);
    const center = new THREE.Vector3(...target).project(actual);
    expect(Math.abs(center.x)).toBeLessThan(1e-10); expect(Math.abs(center.y)).toBeLessThan(1e-10);
  });

  it('retains orthographic bounds and explicit lens while overriding orbit angles', () => {
    const rig = new CameraRig(48, 1), camera = { ...base, projection: 'ortho' as const, orthoSize: 2.3 };
    const actual = rig.applyView(camera, eye, target, 1.5, 8, 48, 2000); actual.updateMatrixWorld(true);
    const frustum = orthoFrustum(2.3, 1.5);
    const expected = nativePose(new THREE.OrthographicCamera(frustum.left, frustum.right, frustum.top, frustum.bottom, .1, 500), eye, target);
    expect(actual).toBeInstanceOf(THREE.OrthographicCamera); expect(actual).toBe(rig.current);
    close(actual.projectionMatrix.elements, expected.projectionMatrix.elements); close(actual.matrixWorld.elements, expected.matrixWorld.elements);
    const again = rig.applyView({ ...camera, yaw: 99, pitch: -.2 }, eye, target, 1.5, 8, 48, 2000);
    expect(again).toBe(actual); close(again.position.toArray(), eye);
  });

  it('uses existing default projection ranges and reuses native camera objects across switches', () => {
    const rig = new CameraRig(48, 1), camera: Camera3D = { type: 'Camera3D', yaw: 0, pitch: .6 };
    const perspective = rig.applyView(camera, eye, target, 1.2, 3, 48, 2000) as THREE.PerspectiveCamera;
    expect(perspective.fov).toBe(48); expect(perspective.near).toBe(1);
    expect(perspective.far).toBeCloseTo(new THREE.Vector3(...eye).distanceTo(new THREE.Vector3(...target)) + 2200, 10);
    const ortho = rig.applyView({ ...camera, projection: 'ortho' }, eye, target, 1.2, 3, 48, 2000);
    expect(ortho).not.toBe(perspective); expect(rig.applyView(camera, eye, target, 1.2, 3, 48, 2000)).toBe(perspective);
  });

  it('applies the original camera-local shake basis to a direct shot', () => {
    const rig = new CameraRig(48, 1), native = nativePose(new THREE.PerspectiveCamera(53, 1.6, .1, 500), eye, target);
    const right = new THREE.Vector3().setFromMatrixColumn(native.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(native.matrixWorld, 1);
    const expected = new THREE.Vector3(...eye).addScaledVector(right, .2).addScaledVector(up, -.13);
    const actual = rig.applyView(base, eye, target, 1.6, 3, 48, 2000, { active: true, rx: .2, uy: -.13 });
    close(actual.position.toArray(), expected.toArray()); close(actual.quaternion.toArray(), native.quaternion.toArray());
  });

  it('does not apply a pending legacy tween to shot positions and restores ordinary orbit afterward', () => {
    const rig = new CameraRig(48, 1), center = { x: 2, y: 1, z: -2 };
    rig.applyOrbit(base, center, 6, 1.5, 4, 48, 2000);
    rig.tickTween({ trigger: 1, dur: 2, ease: 'linear' }, 1000);
    rig.applyOrbit({ ...base, yaw: 2 }, center, 6, 1.5, 4, 48, 2000);
    rig.disposeTween(); const actual = rig.applyView(base, eye, target, 1.5, 4, 48, 2000);
    close(actual.position.toArray(), eye);
    rig.tickTween(base.tween, 1500); const restored = rig.applyOrbit(base, center, 6, 1.5, 4, 48, 2000);
    const expected = orbitCamera(center, 6, base.yaw, base.pitch);
    close(restored.position.toArray(), [expected.x, expected.y, expected.z]);
  });

  it.each([[0, 10, 0], [0, -10, 0], [1e6, -1e6, 1e6]] as const)('keeps native vertical and boundary views finite %s', (x, y, z) => {
    const rig = new CameraRig(48, 1), actual = rig.applyView(base, [x, y, z], [0, 0, 0], 1.5, 4, 48, 2000);
    actual.updateMatrixWorld(true);
    expect([...actual.matrixWorld.elements, ...actual.matrixWorldInverse.elements, ...actual.projectionMatrix.elements].every(Number.isFinite)).toBe(true);
  });

  it('retains exact legacy orbit world poses and separate camera ownership', () => {
    const first = new CameraRig(48, 1), second = new CameraRig(48, 1), center = { x: -2, y: 3, z: .5 };
    const actual = first.applyOrbit(base, center, 7, 1.4, 4, 48, 2000); actual.updateMatrixWorld(true);
    const position = orbitCamera(center, 7, base.yaw, base.pitch);
    const expected = nativePose(new THREE.PerspectiveCamera(53, 1.4, .1, 500), [position.x, position.y, position.z], [center.x, center.y, center.z]);
    close(actual.matrixWorld.elements, expected.matrixWorld.elements); close(actual.projectionMatrix.elements, expected.projectionMatrix.elements);
    second.applyView(base, eye, target, 1.4, 4, 48, 2000); expect(second.current).not.toBe(actual);
    close(actual.position.toArray(), [position.x, position.y, position.z]);
  });

  it.each([
    { origin: [0, 0, 0], aim: [1e-170, 0, 0], direction: [1, 0, 0] },
    { origin: [0, 0, 0], aim: [-1e-170, 0, 0], direction: [-1, 0, 0] },
    { origin: [0, 0, 0], aim: [0, 0, Number.MIN_VALUE], direction: [0, 0, 1] },
    { origin: [0, 0, 0], aim: [Number.MIN_VALUE, 2 * Number.MIN_VALUE, 0], direction: [1, 2, 0] },
    { origin: [1e6, 0, 0], aim: [1e6, 1e-170, 0], direction: [0, 1, 0] },
    { origin: [0, 0, 0], aim: [1e-151, 2e-151, -3e-151], direction: [1, 2, -3] },
  ])('keeps the actual native viewing direction for accepted near-point data %s', ({ origin, aim, direction }) => {
    const position = origin as [number, number, number], point = aim as [number, number, number];
    const before = JSON.stringify([position, point]), expected = new THREE.Vector3(...direction).normalize();
    const rig = new CameraRig(48, 1), camera = rig.applyView(base, position, point, 1.5, 4, 48, 2000);
    camera.updateMatrixWorld(true);
    expect(camera.getWorldDirection(new THREE.Vector3()).dot(expected)).toBeGreaterThan(.9999);
    const reference = nativePose(new THREE.PerspectiveCamera(53, 1.5, .1, 500), position,
      [position[0] + expected.x, position[1] + expected.y, position[2] + expected.z]);
    close(camera.matrixWorld.elements, reference.matrixWorld.elements);
    expect([...camera.matrixWorld.elements, ...camera.matrixWorldInverse.elements].every(Number.isFinite)).toBe(true);
    expect(JSON.stringify([position, point])).toBe(before);
  });

  it.each(['linear', 'cubicOut', 'inOut'] as const)('shares the original bounded endpoint easing curve %s', ease => {
    expect(easeTween(0, ease)).toBe(0); expect(easeTween(1, ease)).toBe(1);
    let before = 0;
    for (let i = 0; i <= 100; i++) { const value = easeTween(i / 100, ease); expect(value).toBeGreaterThanOrEqual(before); expect(value).toBeLessThanOrEqual(1); before = value; }
    expect(easeTween(.25, ease)).toBeCloseTo(ease === 'linear' ? .25 : ease === 'inOut' ? .15625 : .578125, 12);
  });

  it.each([
    { camera: { ...base, fov: Number.MIN_VALUE }, aspect: 1, defaultFov: 48, sky: 2000 },
    { camera: { ...base, fov: 1e-300 }, aspect: 1, defaultFov: 48, sky: 2000 },
    { camera: { ...base, near: 1e308, far: 1.7e308 }, aspect: 1, defaultFov: 48, sky: 2000 },
    { camera: { ...base, near: Number.MIN_VALUE, far: 2 * Number.MIN_VALUE }, aspect: 1, defaultFov: 48, sky: 2000 },
    { camera: { ...base, fov: undefined }, aspect: 1, defaultFov: 1e-300, sky: 2000 },
    { camera: base, aspect: 1e-300, defaultFov: 48, sky: 2000 },
    { camera: { ...base, near: 3000, far: undefined }, aspect: 1, defaultFov: 48, sky: 2000 },
  ])('rejects unsafe resolved shot projection before mutating the current native camera %s', ({ camera, aspect, defaultFov, sky }) => {
    const rig = new CameraRig(48, 1), current = rig.applyView(base, eye, target, 1.5, 4, 48, 2000);
    current.updateMatrixWorld(true);
    const before = [...current.position.toArray(), ...current.quaternion.toArray(), ...current.projectionMatrix.elements];
    expect(() => rig.applyView(camera, [0, 0, 3], [0, 0, 0], aspect, 4, defaultFov, sky)).toThrow(/CameraShot3D.*projection/);
    expect(rig.current).toBe(current);
    expect([...current.position.toArray(), ...current.quaternion.toArray(), ...current.projectionMatrix.elements]).toEqual(before);
  });
});
