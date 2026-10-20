import { afterEach, describe, expect, it, vi } from 'vitest';
import { Engine } from '@runtime/engine.js';
import type { EntityBlueprint } from './demo.assembly.js';
import { validateSkeletalAttachments } from './skeletal-attachments.js';
import * as attachmentValidation from './skeletal-attachments.js';
import { expandSceneImports } from './scene-import.js';
import { parseManifest } from './manifest.js';
import { parseManifestAsync } from './manifest-async.js';
import { validateComponentData } from './validate-manifest.js';

const attach = (parentId = 'future') => ({ parentId, bone: 'RightHand', offset: [0, 0, 0], rot: [0, 0, 0] });
const cast = (raw: Record<string, unknown>) => raw as Record<string, EntityBlueprint>;
afterEach(() => vi.restoreAllMocks());

describe('skeletal attachment load boundaries', () => {
  it('allows missing/dynamic parents and entities without a drawable carrier, without rewriting inputs', () => {
    const entities = { child: { Attach3D: attach() }, grandchild: { Attach3D: attach('child') }, plain: {} };
    const before = JSON.stringify(entities);
    expect(() => validateSkeletalAttachments(entities)).not.toThrow();
    expect(expandSceneImports(entities)).toBe(entities);
    expect(JSON.stringify(entities)).toBe(before);
  });

  it.each([null, undefined, {}, { ...attach(), offset: [NaN, 0, 0] }])('checks every explicit Attach3D, including %s', value => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => validateSkeletalAttachments({ child: { Attach3D: value } })).toThrow(/child.*Attach3D/);
  });

  it('rejects self, two-node and longer cycles while preserving all source data', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const entities of [
      { a: { Attach3D: attach('a') } },
      { a: { Attach3D: attach('b') }, b: { Attach3D: attach('a') } },
      { a: { Attach3D: attach('b') }, b: { Attach3D: attach('c') }, c: { Attach3D: attach('a') } },
    ]) {
      const before = JSON.stringify(entities);
      expect(() => validateSkeletalAttachments(entities)).toThrow(/self|cycle/);
      expect(JSON.stringify(entities)).toBe(before);
    }
  });

  it('handles a deep acyclic parent chain iteratively without imposing an undocumented chain limit', () => {
    const entities = Object.fromEntries(Array.from({ length: 12_000 }, (_, i) => [`child-${i}`, { Attach3D: attach(`child-${i + 1}`) }]));
    expect(() => validateSkeletalAttachments(entities)).not.toThrow();
  });

  it('returns contextual SchemaIssues without a provider instead of silently skipping data', () => {
    expect(validateComponentData([], cast({ prop: { Attach3D: null } })).errors).toEqual([
      expect.objectContaining({ entity: 'prop', component: 'Attach3D', message: expect.stringContaining('Attach3D') }),
    ]);
    expect(validateComponentData([], cast({ prop: { Attach3D: attach() } }))).toEqual({ errors: [], warnings: [] });
  });

  it('rejects malformed template data through both manifest entrances before mutating the source', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const source = { templates: { prop: { Attach3D: { ...attach(), rot: [0, 0] } } }, entities: { cup: { $template: 'prop' } } };
    const before = JSON.stringify(source);
    expect(() => parseManifest(source)).toThrow(/rot/);
    await expect(parseManifestAsync(source)).rejects.toThrow(/rot/);
    expect(JSON.stringify(source)).toBe(before);
  });

  it('rejects invalid/cyclic direct Engine.load atomically before tick rate, systems or entities change', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const engine = new Engine({ tickRate: 30 }); engine.world.createEntity('kept'); engine.world.drainDirty();
    const snapshot = engine.world.snapshot(), hash = engine.hash(), sequence = engine.world.writeSequence;
    const addSystem = vi.spyOn(engine.world, 'addSystem');
    for (const entities of [
      { prop: { Attach3D: null } }, { prop: { Attach3D: attach('prop') } },
      { a: { Attach3D: attach('b') }, b: { Attach3D: attach('a') } },
    ]) {
      expect(() => engine.load({ entities: cast(entities), capabilities: [], meta: { tickRate: 90 } })).toThrow(/skeletal-attachments/);
      expect(engine.world.snapshot()).toEqual(snapshot); expect(engine.hash()).toBe(hash);
      expect(engine.tickRate).toBe(30); expect(engine.world.writeSequence).toBe(sequence); expect(engine.world.drainDirty()).toEqual([]);
      expect(addSystem).not.toHaveBeenCalled();
    }
  });

  it('checks both the input and completed E5 set while allowing a dynamically supplied parent model', () => {
    const validation = vi.spyOn(attachmentValidation, 'validateSkeletalAttachments');
    const input = { prop: { Attach3D: attach('level') }, level: { SceneImport3D: { modelKey: 'level', rules: 'default' } } };
    const out = expandSceneImports(input, { level: { version: 1, sourceSha256: 'a'.repeat(64), nodes: [{
      index: 0, path: [0], name: 'display', kind: 'display', worldMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    }] } });
    expect(out).not.toBe(input); expect(validation).toHaveBeenNthCalledWith(1, input); expect(validation).toHaveBeenNthCalledWith(2, out);
    expect(JSON.stringify(out.prop)).toBe(JSON.stringify(input.prop));
  });
});
