import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { WebGLLights } from 'three/src/renderers/webgl/WebGLLights.js';
import { World } from '@engine/core/world.js';
import { getLights3D } from '@engine/protocol/camera-view.js';
import type { Light3D } from '@engine/protocol/components.js';
import { hashSnapshot } from '@net/determinism.js';
import { hashWorld } from '@net/world-hash.js';
import { LightRig } from './lights.js';

type Tuple = readonly [number, number, number];
type Mode = 'primary' | 'extra' | 'spot';
const unit: Tuple = [-6 / Math.sqrt(61), -5 / Math.sqrt(61), 0];
const fixtures: { name: string; direction: Tuple; expected: Tuple }[] = [
  { name: 'unit', direction: unit, expected: unit },
  { name: 'eight times', direction: unit.map(value => value * 8) as unknown as Tuple, expected: unit },
  { name: 'tiny finite', direction: [-6e-300, -5e-300, 0], expected: unit },
  { name: 'MIN subnormal', direction: [-Number.MIN_VALUE, -2 * Number.MIN_VALUE, 0], expected: [-1 / Math.sqrt(5), -2 / Math.sqrt(5), 0] },
  { name: 'near MAX finite', direction: [-Number.MAX_VALUE, -Number.MAX_VALUE / 2, Number.MAX_VALUE / 4], expected: [-4 / Math.sqrt(21), -2 / Math.sqrt(21), 1 / Math.sqrt(21)] },
];
function component(direction?: Tuple, extra: Partial<Light3D> = {}): Light3D {
  return { type: 'Light3D', kind: 'directional', color: 0x123456, intensity: 7, castShadow: true,
    ...(direction ? { dirX: direction[0], dirY: direction[1], dirZ: direction[2] } : {}), ...extra };
}
function lightFixture(mode: Mode, source: Light3D) {
  const scene = new THREE.Scene(), rig = new LightRig(scene), world = new World();
  const config = Object.freeze({ ...source, ...(mode === 'spot' ? { kind: 'spot' as const, x: 2, y: 4, z: 3, range: 20, angle: .6 } : {}), castShadow: mode !== 'extra' });
  rig.sync(scene, [['lamp', config]], world.readView()); rig.placeShadow({ x: 0, y: 0, z: 0 }, 1);
  const light = mode === 'primary' ? rig.key : scene.children.find(object => mode === 'extra'
    ? object instanceof THREE.DirectionalLight && object !== rig.key : object instanceof THREE.SpotLight) as THREE.DirectionalLight | THREE.SpotLight;
  scene.updateMatrixWorld(true);
  if (mode !== 'extra') light.shadow.updateMatrices(light);
  return { scene, rig, world, config, light };
}
function nativeDirection(light: THREE.DirectionalLight | THREE.SpotLight): THREE.Vector3 {
  const native = new WebGLLights({ has: () => false } as unknown as ConstructorParameters<typeof WebGLLights>[0]);
  native.setup([light]); native.setupView([light], new THREE.PerspectiveCamera());
  const uniforms = (light instanceof THREE.SpotLight ? native.state.spot[0] : native.state.directional[0]) as { direction: THREE.Vector3 };
  return uniforms.direction.clone();
}
function close(actual: readonly number[], expected: readonly number[], tolerance = 1e-12) {
  expect(actual).toHaveLength(expected.length);
  for (let i = 0; i < actual.length; i++) expect(Math.abs(actual[i]! - expected[i]!)).toBeLessThan(tolerance);
}
function nativeFinite(light: THREE.DirectionalLight | THREE.SpotLight) {
  expect(light.position.toArray().every(Number.isFinite)).toBe(true);
  expect(light.target.position.toArray().every(Number.isFinite)).toBe(true);
  expect(light.shadow.camera.matrixWorldInverse.elements.every(Number.isFinite)).toBe(true);
  expect([...new Float32Array(light.shadow.camera.matrixWorldInverse.elements)].every(Number.isFinite)).toBe(true);
}
beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); });

describe('Light3D finite nonzero direction normalization (native CPU light/shadow/uniform evidence)', () => {
  for (const mode of ['primary', 'extra', 'spot'] as const) {
    it.each(fixtures)(`${mode}: keeps $name direction finite, unit length and physically aimed`, ({ direction, expected }) => {
      const source = component(direction), before = structuredClone(source), { rig, scene, light, config } = lightFixture(mode, source);
      close(nativeDirection(light).toArray(), expected.map(value => -value));
      expect(nativeDirection(light).length()).toBeCloseTo(1, 14);
      expect(light.intensity).toBe(7); expect(light.color.getHex()).toBe(0x123456);
      if (mode === 'primary') {
        nativeFinite(light); expect(light.position.length()).toBeCloseTo(3.2, 14);
        expect(light.shadow.getFrustum().containsPoint(new THREE.Vector3())).toBe(true);
        expect(new THREE.Vector3().project(light.shadow.camera).z).toBeCloseTo(-.4414414414414416, 13);
        expect(light.shadow.camera.far).toBeCloseTo(11.2, 13);
      } else if (mode === 'extra') {
        expect(light.position.length()).toBeCloseTo(100, 12); expect(light.castShadow).toBe(false);
      } else {
        nativeFinite(light); close(light.position.toArray(), [2, 4, 3]);
        close(light.target.position.clone().sub(light.position).toArray(), expected);
        const target = light.position.clone().addScaledVector(new THREE.Vector3(...expected), 2);
        expect(light.shadow.getFrustum().containsPoint(target)).toBe(true);
        close(light.shadow.camera.getWorldDirection(new THREE.Vector3()).toArray(), expected);
        expect((light as THREE.SpotLight).distance).toBe(20); expect((light as THREE.SpotLight).angle).toBe(.6);
      }
      expect(source).toEqual(before); expect(Object.isFrozen(config)).toBe(true); expect(console.warn).not.toHaveBeenCalled();
      rig.dispose(scene);
    });
  }

  it.each(['primary', 'spot'] as const)('%s native shadow view and clipping stay equal for unit versus eight-times input', mode => {
    const a = lightFixture(mode, component(unit)), b = lightFixture(mode, component(fixtures[1]!.direction));
    close(a.light.shadow.camera.matrixWorldInverse.elements, b.light.shadow.camera.matrixWorldInverse.elements);
    close(a.light.shadow.camera.projectionMatrix.elements, b.light.shadow.camera.projectionMatrix.elements);
    close(a.light.shadow.matrix.elements, b.light.shadow.matrix.elements);
    a.rig.dispose(a.scene); b.rig.dispose(b.scene);
  });

  it.each(['primary', 'extra', 'spot'] as const)('%s fills the original missing/partial components before normalization', mode => {
    for (const partial of [false, true]) {
      const source = component(undefined, partial ? { dirX: 3 } : {}), { rig, scene, light } = lightFixture(mode, source);
      const raw = mode === 'spot' ? [partial ? 3 : 0, -1, 0] : [partial ? 3 : -.78, -.62, -.5];
      const length = Math.hypot(...raw), expected = raw.map(value => -value / length);
      close(nativeDirection(light).toArray(), expected);
      if (mode === 'primary') expect(light.position.length()).toBeCloseTo(3.2, 14);
      rig.dispose(scene);
    }
  });

  it('preserves the exact native no-Light default matrices, light colors and intensities even after data-driven lighting', () => {
    const scene = new THREE.Scene(), rig = new LightRig(scene), world = new World();
    rig.sync(scene, [['previous', component([9, -4, 1])]], world.readView());
    rig.sync(scene, [], world.readView()); rig.placeShadow({ x: 1, y: 2, z: 3 }, 2); scene.updateMatrixWorld(true); rig.key.shadow.updateMatrices(rig.key);
    expect(rig.key.position.toArray()).toEqual([5.992000000000001, 5.968, 6.2]);
    expect(rig.key.target.position.toArray()).toEqual([1, 2, 3]); expect(rig.shadowDir).toBeUndefined(); expect(rig.lightSig).toBe('default');
    expect(rig.key.color.getHex()).toBe(0xfff1d6); expect(rig.key.intensity).toBe(1.5);
    const ambient = scene.children.find(object => object instanceof THREE.AmbientLight) as THREE.AmbientLight;
    expect(ambient.color.getHex()).toBe(0xbfd2ff); expect(ambient.intensity).toBe(.4);
    expect(rig.key.shadow.camera.matrixWorldInverse.elements).toEqual([
      .539666114720432, -.46821014050165405, .699671172018667, 0,
      5.551115123125784e-17, .8310826811551283, .55614888032253, 0,
      -.841879138963874, -.30013470544977827, .4485071615504277, 0,
      1.9859713021711882, -.29355110545926827, -10.292270582113364, 1,
    ]);
    expect(rig.key.shadow.camera.projectionMatrix.elements).toEqual([
      .1923076923076923, 0, 0, 0, 0, .1923076923076923, 0, 0,
      0, 0, -.08968609865470852, 0, -0, -0, -1.0089686098654709, 1,
    ]);
    rig.dispose(scene);
  });
});

describe('invalid direction legacy policy and bounded diagnostics', () => {
  for (const mode of ['primary', 'extra', 'spot'] as const) {
    it.each([
      { name: 'signed zero', direction: [0, -0, 0] as Tuple },
      { name: 'NaN', direction: [NaN, -1, 0] as Tuple },
      { name: 'positive infinity', direction: [Infinity, -1, 0] as Tuple },
      { name: 'negative infinity', direction: [-Infinity, -1, 0] as Tuple },
    ])(`${mode}: retains $name raw values and native behavior without a new fallback`, ({ direction }) => {
      const { rig, scene, light } = lightFixture(mode, component(direction));
      const raw = mode === 'spot' ? [2 + direction[0], 4 + direction[1], 3 + direction[2]]
        : direction.map(value => -value * (mode === 'primary' ? 3.2 : 100));
      const actual = mode === 'spot' ? light.target.position.toArray() : light.position.toArray();
      for (let i = 0; i < raw.length; i++) expect(Object.is(actual[i], raw[i]) || (actual[i] === 0 && raw[i] === 0)).toBe(true);
      if (mode === 'primary') {
        const stored = rig.shadowDir!;
        expect(Object.is(stored.x, -direction[0])).toBe(true); expect(Object.is(stored.y, -direction[1])).toBe(true); expect(Object.is(stored.z, -direction[2])).toBe(true);
      }
      const uniform = nativeDirection(light);
      if (direction.every(value => value === 0)) {
        expect(uniform.toArray().every(value => value === 0)).toBe(true);
        if (mode !== 'extra') expect(light.shadow.camera.getWorldDirection(new THREE.Vector3()).toArray()).toEqual([-0, -0, -1]);
      } else expect(uniform.toArray().some(Number.isNaN)).toBe(true);
      expect(console.warn).toHaveBeenCalledOnce(); expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('preserving legacy values'));
      rig.dispose(scene);
    });
  }

  it('warns once per current entity/value state and clears on valid recovery, removal, no-Light, scene switch and dispose', () => {
    const scene = new THREE.Scene(), rig = new LightRig(scene), world = new World(), view = world.readView();
    const cache = rig as unknown as { directionWarnings: Map<string, string> };
    const sync = (source: Light3D, id = 'bad', target = scene) => rig.sync(target, [[id, source]], view);
    const invalid = component([NaN, -1, 0]);
    for (let i = 0; i < 100; i++) sync(invalid); expect(console.warn).toHaveBeenCalledOnce(); expect(cache.directionWarnings.size).toBe(1);
    sync(component([Infinity, -1, 0])); expect(console.warn).toHaveBeenCalledTimes(2); expect(cache.directionWarnings.size).toBe(1);
    sync(component([1, -1, 0])); expect(cache.directionWarnings.size).toBe(0);
    sync(invalid); expect(console.warn).toHaveBeenCalledTimes(3);
    sync(component(undefined, { kind: 'ambient' }), 'other'); expect(cache.directionWarnings.size).toBe(0);
    sync(invalid); expect(console.warn).toHaveBeenCalledTimes(4);
    rig.sync(scene, [], view); expect(cache.directionWarnings.size).toBe(0);
    sync(invalid); expect(console.warn).toHaveBeenCalledTimes(5);
    sync(invalid, 'bad', new THREE.Scene()); expect(console.warn).toHaveBeenCalledTimes(6); expect(cache.directionWarnings.size).toBe(1);
    rig.dispose(scene); expect(cache.directionWarnings.size).toBe(0);
    sync(invalid); expect(console.warn).toHaveBeenCalledTimes(7); rig.dispose(scene);
  });

  it('keeps diagnostics bounded by live processed lights during entity and invalid-value churn', () => {
    const scene = new THREE.Scene(), rig = new LightRig(scene), view = new World().readView();
    const cache = rig as unknown as { directionWarnings: Map<string, string> };
    for (let i = 0; i < 300; i++) {
      rig.sync(scene, [[`invalid-${i}`, component([0, 0, 0])]], view); expect(cache.directionWarnings.size).toBe(1);
      for (let state = 0; state < 4; state++) rig.sync(scene, [[`invalid-${i}`, component([NaN, state, 0])]], view);
      expect(cache.directionWarnings.size).toBe(1);
    }
    expect(console.warn).toHaveBeenCalledTimes(1500); rig.dispose(scene); expect(cache.directionWarnings.size).toBe(0);
  });

  it('ignores direction fields for point/ambient and retains local light/shadow budgets', () => {
    const scene = new THREE.Scene(), rig = new LightRig(scene), view = new World().readView();
    const lights: [string, Light3D][] = [['ambient', component([NaN, Infinity, 0], { kind: 'ambient', intensity: .25 })]];
    for (let i = 0; i < 6; i++) lights.push([`point-${i}`, component([Infinity, NaN, 0], { kind: 'point', x: i, y: 5, z: 2, range: 40, decay: 1.5 })]);
    rig.sync(scene, lights, view);
    const points = scene.children.filter(object => object instanceof THREE.PointLight) as THREE.PointLight[];
    expect(points).toHaveLength(4); expect(points.filter(light => light.castShadow)).toHaveLength(2);
    expect(points.map(light => light.position.toArray())).toEqual([[0, 5, 2], [1, 5, 2], [2, 5, 2], [3, 5, 2]]);
    for (const point of points) { expect(point.intensity).toBe(7); expect(point.distance).toBe(40); expect(point.decay).toBe(1.5); }
    expect((scene.children.find(object => object instanceof THREE.AmbientLight) as THREE.AmbientLight).intensity).toBe(.25);
    expect(console.warn).not.toHaveBeenCalled(); rig.dispose(scene);
  });
});

it('keeps two actual Worlds and their input components pure for 20k native CPU light/shadow updates', () => {
  const states = [new World(), new World()];
  const rigs = states.map((world, index) => {
    world.createEntity('sim'); world.addComponent('sim', { type: 'Transform', x: 1, y: 2, rotation: 0, scaleX: 1, scaleY: 1 });
    const directions: Tuple[] = index ? [[-Number.MIN_VALUE, -2 * Number.MIN_VALUE, 0], [-Number.MAX_VALUE, -Number.MAX_VALUE / 2, 0]] : [[-6e-300, -5e-300, 0], [-48, -40, 0]];
    world.createEntity('sun'); world.addComponent('sun', component(directions[0]));
    world.createEntity('extra'); world.addComponent('extra', component(directions[1], { castShadow: false }));
    world.createEntity('spot'); world.addComponent('spot', component(directions[0], { kind: 'spot', x: 2, y: 4, z: 3, range: 20 }));
    const before = world.snapshot(), hash = hashSnapshot(before), incremental = hashWorld(world); world.drainDirty();
    const scene = new THREE.Scene(); return { world, view: world.readView(), scene, rig: new LightRig(scene), before, hash, incremental, seq: world.writeSequence };
  });
  expect(rigs[0]!.hash).toBe(rigs[1]!.hash);
  for (let step = 0; step < 10000; step++) for (const row of rigs) {
    row.rig.sync(row.scene, getLights3D(row.view), row.view); row.rig.placeShadow({ x: 0, y: 0, z: 0 }, 1); row.scene.updateMatrixWorld(true); row.rig.key.shadow.updateMatrices(row.rig.key);
    if (step % 1000 === 0) { expect(row.rig.key.shadow.getFrustum().containsPoint(new THREE.Vector3())).toBe(true); nativeFinite(row.rig.key); }
  }
  for (const row of rigs) {
    expect(row.world.snapshot()).toEqual(row.before); expect(row.world.writeSequence).toBe(row.seq); expect(row.world.drainDirty()).toEqual([]);
    expect(hashWorld(row.world)).toBe(row.incremental); expect(hashSnapshot(row.world.snapshot())).toBe(row.hash);
    row.rig.dispose(row.scene);
  }
  expect(console.warn).not.toHaveBeenCalled();
});
