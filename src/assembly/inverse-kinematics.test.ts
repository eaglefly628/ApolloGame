import { afterEach, describe, expect, it, vi } from 'vitest';
import { Engine } from '@runtime/engine.js';
import type { EntityBlueprint } from './demo.assembly.js';
import { validateInverseKinematics } from './inverse-kinematics.js';
import * as ikValidation from './inverse-kinematics.js';
import { expandSceneImports } from './scene-import.js';
import { validateComponentData } from './validate-manifest.js';
import { parseManifest } from './manifest.js';
import { parseManifestAsync } from './manifest-async.js';

const target = () => ({ entity: 'future-target', offset: [0, 0, 0] });
const ik = (weight: unknown = 1) => ({ chains: [{ kind: 'two-bone', root: 'Root', mid: 'Mid', end: 'End', target: target(), weight }] });
const graph = () => ({ clips: { idle: { clip: 'idle' } }, states: { idle: { clip: 'idle' } }, transitions: [], params: { move: 'speed', grip: 'flag:future', mode: 'state:motion' } });
const actor = (weight: unknown = 1) => ({ Model3D: { modelKey: 'hero' }, IK3D: ik(weight) });
const cast = (raw: Record<string, unknown>) => raw as Record<string, EntityBlueprint>;
afterEach(() => vi.restoreAllMocks());

describe('IK3D load boundaries', () => {
  it('allows constants without a graph, missing dynamic targets and targets on other bones of the same entity', () => {
    const entities = { hero: actor(), second: { ...actor(0), IK3D: { chains: [], lookAt: { bone: 'Head', target: { entity: 'second', bone: 'OtherHand', offset: [0, 0, 0] }, weight: .5 } } } };
    const before = JSON.stringify(entities);
    expect(() => validateInverseKinematics(entities)).not.toThrow(); expect(expandSceneImports(entities)).toBe(entities);
    expect(JSON.stringify(entities)).toBe(before);
  });

  it.each([undefined, null, {}, { modelKey: '' }, { modelKey: ' ' }, { modelKey: 7 }])('requires a valid carrier Model3D %s', Model3D => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => validateInverseKinematics({ hero: { IK3D: ik(), Model3D } })).toThrow(/hero.*requires Model3D/);
  });

  it('validates every explicit IK3D including null and undefined', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const value of [null, undefined, {}]) expect(() => validateInverseKinematics({ hero: { Model3D: { modelKey: 'hero' }, IK3D: value } })).toThrow(/hero.*IK3D/);
  });

  it('resolves only declared same-entity speed/flag bindings and preserves their data', () => {
    for (const param of ['move', 'grip']) {
      const entities = { hero: { ...actor({ param, fade: .2 }), AnimGraph3D: graph() } }, before = JSON.stringify(entities);
      expect(() => validateInverseKinematics(entities)).not.toThrow(); expect(JSON.stringify(entities)).toBe(before);
    }
    const entities = { hero: { ...actor(), AnimGraph3D: graph(), IK3D: { chains: [], lookAt: { bone: 'Head', target: target(), weight: { param: 'grip', fade: 0 } } } } };
    expect(() => validateInverseKinematics(entities)).not.toThrow();
  });

  it('rejects missing graphs, undeclared parameters, another entity graph and string state bindings', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const binding = actor({ param: 'grip', fade: .2 });
    for (const entities of [
      { hero: binding }, { hero: binding, other: { AnimGraph3D: graph() } },
      { hero: { ...actor({ param: 'missing', fade: .2 }), AnimGraph3D: graph() } },
      { hero: { ...actor({ param: 'mode', fade: .2 }), AnimGraph3D: graph() } },
      { hero: { ...actor(), AnimGraph3D: graph(), IK3D: { chains: [], lookAt: { bone: 'Head', target: target(), weight: { param: 'mode', fade: 0 } } } } },
    ]) expect(() => validateInverseKinematics(entities)).toThrow(/inverse-kinematics/);
  });

  it('returns SchemaIssues with no provider instead of silently skipping malformed IK', () => {
    expect(validateComponentData([], cast({ hero: { IK3D: null } })).errors).toEqual([
      expect.objectContaining({ entity: 'hero', component: 'IK3D', message: expect.stringContaining('IK3D') }),
    ]);
    expect(validateComponentData([], cast({ hero: actor() }))).toEqual({ errors: [], warnings: [] });
  });

  it('rejects template data through sync and async entrances before source/world mutation', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const source = { templates: { actor: { ...actor(), IK3D: { ...ik(), chains: [{ ...ik().chains[0], target: { ...target(), offset: [0, 0] } }] } } }, entities: { hero: { $template: 'actor' } } };
    const before = JSON.stringify(source);
    expect(() => parseManifest(source)).toThrow(/offset/); await expect(parseManifestAsync(source)).rejects.toThrow(/offset/);
    expect(JSON.stringify(source)).toBe(before);
  });

  it('rejects direct Engine.load atomically before tick rate, systems or entities change', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const engine = new Engine({ tickRate: 30 }); engine.world.createEntity('kept'); engine.world.drainDirty();
    const snapshot = engine.world.snapshot(), hash = engine.hash(), sequence = engine.world.writeSequence;
    const addSystem = vi.spyOn(engine.world, 'addSystem');
    for (const entities of [{ hero: { IK3D: ik() } }, { hero: { ...actor(), IK3D: null } }, { hero: actor(2) }, { hero: actor({ param: 'missing', fade: 0 }) }]) {
      expect(() => engine.load({ entities: cast(entities), capabilities: [], meta: { tickRate: 90 } })).toThrow(/inverse-kinematics/);
      expect(engine.world.snapshot()).toEqual(snapshot); expect(engine.hash()).toBe(hash); expect(engine.tickRate).toBe(30);
      expect(engine.world.writeSequence).toBe(sequence); expect(engine.world.drainDirty()).toEqual([]); expect(addSystem).not.toHaveBeenCalled();
    }
  });

  it('checks before and after E5 expansion without disturbing existing graph/attachment validation', () => {
    const validation = vi.spyOn(ikValidation, 'validateInverseKinematics');
    const entities = { hero: actor(), level: { SceneImport3D: { modelKey: 'level', rules: 'default' } } };
    const out = expandSceneImports(entities, { level: { version: 1, sourceSha256: 'a'.repeat(64), nodes: [{
      index: 0, path: [0], name: 'display', kind: 'display', worldMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    }] } });
    expect(out).not.toBe(entities); expect(validation).toHaveBeenNthCalledWith(1, entities); expect(validation).toHaveBeenNthCalledWith(2, out);
  });
});
