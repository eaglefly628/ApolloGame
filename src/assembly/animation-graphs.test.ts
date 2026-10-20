import { afterEach, describe, expect, it, vi } from 'vitest';
import { Engine } from '@runtime/engine.js';
import type { EntityBlueprint } from './demo.assembly.js';
import { validateAnimationGraphs } from './animation-graphs.js';
import * as graphValidation from './animation-graphs.js';
import { expandSceneImports } from './scene-import.js';
import { parseManifest } from './manifest.js';
import { parseManifestAsync } from './manifest-async.js';
import { validateAssetRefs, validateComponentData } from './validate-manifest.js';

const graph = () => ({ clips: { idle: { clip: 'builtin-idle' }, walk: { asset: 'motion/walk', clip: 'walk' } },
  states: { idle: { clip: 'idle' } }, transitions: [], params: { moving: 'speed', paused: 'flag:future' } });
const entities = () => ({ hero: { Model3D: { modelKey: 'hero' }, AnimGraph3D: graph() } });
const cast = (raw: Record<string, unknown>) => raw as Record<string, EntityBlueprint>;
afterEach(() => vi.restoreAllMocks());

describe('animation graph load boundaries', () => {
  it('validates graph/model together without rewriting data or requiring future flag entities', () => {
    const input = { hero: { ...entities().hero, AnimState3D: { clip: 'old' } } };
    const withLegacy = JSON.stringify(input);
    expect(() => validateAnimationGraphs(input)).not.toThrow();
    expect(JSON.stringify(input)).toBe(withLegacy);
    expect(expandSceneImports(input)).toBe(input);
  });

  it.each([undefined, null, {}, { modelKey: '' }, { modelKey: '  ' }, { modelKey: 3 }])('rejects missing or malformed skeletal model %s', model => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => validateAnimationGraphs({ hero: { AnimGraph3D: graph(), Model3D: model } })).toThrow(/hero.*requires Model3D/);
  });

  it('validates graph data even without any capability provider and returns contextual SchemaIssues', () => {
    const bad = entities(); bad.hero.AnimGraph3D.states.idle.clip = 'not-an-alias';
    expect(validateComponentData([], cast(bad)).errors).toEqual([expect.objectContaining({ entity: 'hero', component: 'AnimGraph3D', message: expect.stringMatching(/missing alias/) })]);
    expect(validateComponentData([], cast(entities()))).toEqual({ errors: [], warnings: [] });
    expect(validateComponentData([], cast({ hero: { AnimGraph3D: null } })).errors).toHaveLength(1);
  });

  it('checks explicit external asset keys only when opted in, never internal clip names', () => {
    const input = cast(entities());
    expect(validateAssetRefs([], input)).toEqual([]);
    expect(validateAssetRefs([], input, new Set(['motion/walk']))).toEqual([]);
    expect(validateAssetRefs([], input, new Set(['walk', 'builtin-idle']))).toEqual([
      expect.objectContaining({ entity: 'hero', component: 'AnimGraph3D', field: 'clips.walk.asset', message: expect.stringContaining('motion/walk') }),
    ]);
  });

  it('sync, async and template entrances reject a malformed graph consistently', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bad = graph(); bad.states.idle.clip = 'bad';
    const source = { templates: { actor: { Model3D: { modelKey: 'hero' }, AnimGraph3D: bad } }, entities: { actor: { $template: 'actor' } } };
    const before = JSON.stringify(source);
    expect(() => parseManifest(source)).toThrow(/missing alias/);
    await expect(parseManifestAsync(source)).rejects.toThrow(/missing alias/);
    expect(JSON.stringify(source)).toBe(before);
  });

  it('rejects direct Engine.load atomically before systems, entities or tick rate change', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const engine = new Engine({ tickRate: 30 }); engine.world.createEntity('kept');
    const snapshot = engine.world.snapshot(), hash = engine.hash();
    const addSystem = vi.spyOn(engine.world, 'addSystem');
    const cases = [ { hero: { AnimGraph3D: graph() } }, { hero: { Model3D: { modelKey: 'hero' }, AnimGraph3D: null } } ];
    for (const input of cases) {
      expect(() => engine.load({ entities: cast(input), capabilities: [], meta: { tickRate: 90 } })).toThrow(/animation-graphs/);
      expect(engine.world.snapshot()).toEqual(snapshot); expect(engine.hash()).toBe(hash); expect(engine.tickRate).toBe(30);
      expect(addSystem).not.toHaveBeenCalled();
    }
  });

  it('checks graph ownership before a SceneImport3D could implicitly supply Model3D', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => expandSceneImports({ scene: { SceneImport3D: { modelKey: 'scene', rules: 'default' }, AnimGraph3D: graph() } })).toThrow(/requires Model3D/);
  });

  it('validates the completed E5 entity set as well as its input', () => {
    const validation = vi.spyOn(graphValidation, 'validateAnimationGraphs');
    const input = { ...entities(), scene: { SceneImport3D: { modelKey: 'scene', rules: 'default' } } };
    const out = expandSceneImports(input, { scene: { version: 1, sourceSha256: 'a'.repeat(64), nodes: [{
      index: 0, path: [0], name: 'display', kind: 'display', worldMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    }] } });
    expect(out).not.toBe(input);
    expect(validation).toHaveBeenNthCalledWith(1, input);
    expect(validation).toHaveBeenNthCalledWith(2, out);
    expect(out.hero.AnimGraph3D).toBe(input.hero.AnimGraph3D);
  });
});
