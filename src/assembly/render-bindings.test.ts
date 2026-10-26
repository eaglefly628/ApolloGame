import { afterEach, describe, expect, it, vi } from 'vitest';
import { Engine } from '@runtime/engine.js';
import type { EntityBlueprint } from './demo.assembly.js';
import { validateRenderBinding3D } from '@engine/protocol/components/render-binding.js';
import { validateRenderBindings } from './render-bindings.js';
import { parseManifest } from './manifest.js';
import { parseManifestAsync } from './manifest-async.js';
import { validateComponentData } from './validate-manifest.js';

const config = () => ({ bindings: [{ target: 'Light3D.intensity', source: { kind: 'resource-ratio', id: 'fuel' }, range: [0, 10] }] });
const entities = () => ({ lamp: { Light3D: { kind: 'point', intensity: 5, color: 0xffffff }, RenderBinding3D: config() } });
afterEach(() => vi.restoreAllMocks());
describe('RenderBinding3D strict admission and load atomicity', () => {
  it('accepts pure data without normalization, including inverse endpoints and all source/target variants', () => {
    const data = { bindings: [
      { target: 'Light3D.intensity', source: { kind: 'resource-ratio', id: 'fuel' }, range: [0, 10] },
      { target: 'Vfx3D.rate', source: { kind: 'signal', on: 'light', off: 'out', arg: 'self' }, range: [0, 40] },
      { target: 'Material3D.dissolve.progress', source: { kind: 'flag', id: 'active' }, range: [1, 0], transition: { duration: 2, ease: 'cubicOut' } },
      { target: 'Glow3D.opacity', source: { kind: 'hover' }, range: [0, 1] },
    ] }, before = JSON.stringify(data);
    expect(validateRenderBinding3D(data)).toBe(data); expect(JSON.stringify(data)).toBe(before);
    expect(validateComponentData([], entities() as Record<string, EntityBlueprint>)).toEqual({ errors: [], warnings: [] });
  });
  it.each([null, undefined, {}, { bindings: [] }, { ...config(), script: 'anything' },
    { bindings: [{ ...config().bindings[0], target: 'Transform.x' }] },
    { bindings: [config().bindings[0], config().bindings[0]] },
    { bindings: [{ ...config().bindings[0], source: { kind: 'hover', id: 'extra' } }] },
    { bindings: [{ ...config().bindings[0], range: [0, Infinity] }] },
    { bindings: [{ ...config().bindings[0], transition: { duration: -1 } }] },
    { bindings: [{ ...config().bindings[0], transition: { duration: 1, ease: 'script' } }] },
    { bindings: [{ ...config().bindings[0], source: { kind: 'signal', on: 'same', off: 'same' } }] },
    { bindings: [{ target: 'Glow3D.opacity', source: { kind: 'hover' }, range: [0, 2] }] },
  ])('rejects malformed closed data %j', bad => { expect(() => validateRenderBinding3D(bad)).toThrow(/RenderBinding3D/); });
  it('rejects accessors, symbols, sparse arrays and mismatched carriers without invoking getters', () => {
    const getter = vi.fn(() => config().bindings), accessor = Object.defineProperty({}, 'bindings', { enumerable: true, get: getter });
    expect(() => validateRenderBinding3D(accessor)).toThrow(); expect(getter).not.toHaveBeenCalled();
    expect(() => validateRenderBinding3D({ ...config(), [Symbol('extra')]: true })).toThrow();
    expect(() => validateRenderBinding3D({ bindings: Array(1) })).toThrow();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => validateRenderBindings({ lamp: { RenderBinding3D: config() } })).toThrow(/requires Light3D/);
    const d = { bindings: [{ target: 'Material3D.dissolve.progress', source: { kind: 'flag', id: 'lit' }, range: [1, 0] }] };
    expect(() => validateRenderBindings({ lamp: { RenderBinding3D: d, Material3D: { dissolve: { trigger: 1 } }, Model3D: {} } })).toThrow(/trigger/);
  });
  it('rejects sync/async/template and Engine.load before world, systems or tickRate changes', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const raw = { templates: { lamp: { RenderBinding3D: config() } }, entities: { lamp: { $template: 'lamp' } } }, before = JSON.stringify(raw);
    expect(() => parseManifest(raw)).toThrow(/requires Light3D/); await expect(parseManifestAsync(raw)).rejects.toThrow(/requires Light3D/); expect(JSON.stringify(raw)).toBe(before);
    const engine = new Engine({ tickRate: 30 }); engine.world.createEntity('kept'); engine.world.drainDirty();
    const snapshot = engine.world.snapshot(), hash = engine.hash(), seq = engine.world.writeSequence, add = vi.spyOn(engine.world, 'addSystem');
    expect(() => engine.load({ entities: { bad: { RenderBinding3D: config() } } as Record<string, EntityBlueprint>, capabilities: [], meta: { tickRate: 90 } })).toThrow(/requires Light3D/);
    expect(engine.world.snapshot()).toEqual(snapshot); expect(engine.hash()).toBe(hash); expect(engine.tickRate).toBe(30); expect(engine.world.writeSequence).toBe(seq); expect(engine.world.drainDirty()).toEqual([]); expect(add).not.toHaveBeenCalled();
  });
});
