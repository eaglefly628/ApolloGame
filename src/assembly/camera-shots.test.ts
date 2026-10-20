import { afterEach, describe, expect, it, vi } from 'vitest';
import { Engine } from '@runtime/engine.js';
import type { EntityBlueprint } from './demo.assembly.js';
import { validateCameraShots } from './camera-shots.js';
import * as validation from './camera-shots.js';
import { expandSceneImports } from './scene-import.js';
import { validateComponentData } from './validate-manifest.js';
import { parseManifest } from './manifest.js';
import { parseManifestAsync } from './manifest-async.js';

const table = () => ({ shots: { intro: { keyframes: [{ at: 0, eye: [1, 2, 3], target: [0, 0, 0] }] } }, onSignal: [{ signal: 'play', shot: 'intro' }] });
const carrier = () => ({ Camera3D: { yaw: 0, pitch: .5 }, CameraShot3D: table() });
const cast = (value: Record<string, unknown>) => value as Record<string, EntityBlueprint>;
afterEach(() => vi.restoreAllMocks());

describe('CameraShot3D load boundaries', () => {
  it('accepts multiple valid camera carriers without changing or selecting their tables', () => {
    const entities = { first: carrier(), second: carrier() }, before = JSON.stringify(entities);
    expect(() => validateCameraShots(entities)).not.toThrow(); expect(expandSceneImports(entities)).toBe(entities);
    expect(JSON.stringify(entities)).toBe(before);
    expect(() => validateCameraShots({ legacy: { Camera3D: null } })).not.toThrow();
  });
  it.each([undefined, null, {}, { yaw: NaN, pitch: 0 }, { yaw: 0, pitch: Infinity }, { yaw: 0, pitch: 0, fov: 180 },
    { yaw: 0, pitch: 0, near: 2, far: 1 }, { yaw: 0, pitch: 0, orthoSize: 0 }, { yaw: 0, pitch: 0, projection: 'bad' },
  ])('rejects invalid carrier %s', Camera3D => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => validateCameraShots({ camera: { Camera3D, CameraShot3D: table() } })).toThrow(/camera-shots.*camera/);
  });
  it('validates explicit null/undefined tables including unselected cameras', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const CameraShot3D of [null, undefined, {}]) expect(() => expandSceneImports({ first: carrier(), second: { ...carrier(), CameraShot3D } })).toThrow(/camera-shots.*second/);
    expect(validateComponentData([], cast({ camera: { CameraShot3D: null } })).errors).toEqual([expect.objectContaining({ entity: 'camera', component: 'CameraShot3D' })]);
    expect(validateComponentData([], cast({ camera: carrier() })).errors).toEqual([]);
  });
  it('rejects template data through sync/async parsing before changing input', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const source = { templates: { camera: { ...carrier(), CameraShot3D: { ...table(), onSignal: [{ signal: 'play', shot: 'missing' }] } } }, entities: { camera: { $template: 'camera' } } }, before = JSON.stringify(source);
    expect(() => parseManifest(source)).toThrow(/missing/); await expect(parseManifestAsync(source)).rejects.toThrow(/missing/);
    expect(JSON.stringify(source)).toBe(before);
  });
  it('rejects direct load atomically before systems, tick rate, entities or write sequence change', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const engine = new Engine({ tickRate: 30 }); engine.world.createEntity('kept'); engine.world.drainDirty();
    const before = engine.world.snapshot(), hash = engine.hash(), seq = engine.world.writeSequence, add = vi.spyOn(engine.world, 'addSystem');
    for (const entities of [{ camera: { CameraShot3D: table() } }, { camera: { ...carrier(), CameraShot3D: null } }]) {
      expect(() => engine.load({ entities: cast(entities), capabilities: [], meta: { tickRate: 90 } })).toThrow(/camera-shots/);
      expect(engine.world.snapshot()).toEqual(before); expect(engine.hash()).toBe(hash); expect(engine.tickRate).toBe(30);
      expect(engine.world.writeSequence).toBe(seq); expect(engine.world.drainDirty()).toEqual([]); expect(add).not.toHaveBeenCalled();
    }
  });
  it('checks both sides of scene expansion', () => {
    const check = vi.spyOn(validation, 'validateCameraShots');
    const entities = { camera: carrier(), level: { SceneImport3D: { modelKey: 'level', rules: 'default' } } };
    const out = expandSceneImports(entities, { level: { version: 1, sourceSha256: 'a'.repeat(64), nodes: [{ index: 0, path: [0], name: 'display', kind: 'display', worldMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] }] } });
    expect(check).toHaveBeenNthCalledWith(1, entities); expect(check).toHaveBeenNthCalledWith(2, out);
  });
});
