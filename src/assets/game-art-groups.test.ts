import { afterEach, describe, expect, it, vi } from 'vitest';
import { AssetManager } from './asset-manager.js';
import { parseAssetIndex, registerAssetIndex } from './asset-index.js';
import { loadGameArtInto } from './game-art-load.js';
import type { AssetLoader } from './asset-types.js';

const assets = [
  { id: 'title', type: 'texture', description: 'title', status: 'filled', path: '/title.png' },
  { id: 'house', type: 'mesh', description: 'house', status: 'filled', path: '/house.glb' },
  { id: 'unused', type: 'texture', description: 'unused', status: 'filled', path: '/unused.png' },
];
const grouped = { version: 1, assets, groups: { menu: ['title'], yard: ['house'] }, initialGroup: 'menu' };
function setup(raw: unknown, rejectKey?: string) {
  const requested: string[] = [];
  const loader: AssetLoader = { async load(d) { requested.push(d.key); if (d.key === rejectKey) throw new Error(`failed ${d.key}`); return { handle: { key: d.key }, width: 1, height: 1 }; } };
  const manager = new AssetManager(loader);
  const fetcher = vi.fn(async () => ({ ok: true, json: async () => raw }));
  vi.stubGlobal('fetch', fetcher);
  return { manager, requested, fetcher };
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('game art groups — index to actual loader boundary', () => {
  it('parse/register preserves groups and initialGroup, registers all descriptors, and performs no asset I/O', () => {
    const { manager: m, requested } = setup(grouped);
    const parsed = parseAssetIndex(grouped);
    expect(parsed.groups).toEqual(grouped.groups); expect(parsed.initialGroup).toBe('menu');
    registerAssetIndex(m, parsed);
    expect(['title', 'house', 'unused'].map((key) => m.has(key))).toEqual([true, true, true]);
    expect(m.groupProgress('menu')).toMatchObject({ status: 'unloaded', total: 1 });
    expect(m.groupProgress('yard')).toMatchObject({ status: 'unloaded', total: 1 });
    expect(requested).toEqual([]);
  });

  it('initialGroup fetches only its members and leaves other groups and ungrouped assets unloaded', async () => {
    const { manager: m, requested, fetcher } = setup(grouped);
    expect(await loadGameArtInto(m, 'sample')).toBe(true);
    expect(fetcher).toHaveBeenCalledWith('/games/sample/art/index.json', { cache: 'no-store' });
    expect(requested).toEqual(['title']); expect(m.isLoaded('house')).toBe(false); expect(m.isLoaded('unused')).toBe(false);
    expect(m.groupProgress('menu')).toMatchObject({ status: 'ready' });
    m.releaseGroup('menu'); expect(m.isLoaded('title')).toBe(false);
  });

  it('explicit option group overrides index initialGroup and keeps cache options', async () => {
    const { manager: m, requested, fetcher } = setup(grouped);
    expect(await loadGameArtInto(m, 'sample', { group: 'yard', cache: 'reload' })).toBe(true);
    expect(requested).toEqual(['house']); expect(m.isLoaded('title')).toBe(false);
    expect(fetcher).toHaveBeenCalledWith('/games/sample/art/index.json', { cache: 'reload' });
    expect(m.groupProgress('yard')).toMatchObject({ status: 'ready' });
  });

  it('groups with no initial selection only register and make zero asset requests', async () => {
    const { manager: m, requested } = setup({ version: 1, assets, groups: grouped.groups });
    expect(await loadGameArtInto(m, 'sample')).toBe(true);
    expect(m.has('title')).toBe(true); expect(m.groupProgress('menu')).toMatchObject({ status: 'unloaded' });
    expect(requested).toEqual([]);
  });

  it('explicit group selects from an index with no initialGroup', async () => {
    const { manager: m, requested } = setup({ version: 1, assets, groups: grouped.groups });
    expect(await loadGameArtInto(m, 'sample', { group: 'yard' })).toBe(true);
    expect(requested).toEqual(['house']);
  });

  it('legacy indexes keep loadAll and permanent residency until explicit unload', async () => {
    const { manager: m, requested } = setup({ version: 1, assets });
    expect(await loadGameArtInto(m, 'sample')).toBe(true);
    expect(requested).toEqual(['title', 'house', 'unused']);
    m.registerGroups({ scene: ['title'] }); await m.preloadGroup('scene'); m.releaseGroup('scene');
    expect(m.isLoaded('title')).toBe(true); m.unload('title'); expect(m.isLoaded('title')).toBe(false);
  });

  it.each([
    { groups: { 'bad/id': ['title'] }, initialGroup: 'bad/id' },
    { groups: { menu: ['missing'] }, initialGroup: 'menu' },
    { groups: { menu: ['title'] }, initialGroup: 'absent' },
    { initialGroup: 'menu' },
    { groups: [] },
    { groups: { menu: 'title' } },
    { groups: { menu: [17] } },
  ])('invalid group configuration returns false before any asset load: %j', async (invalid) => {
    const { manager: m, requested } = setup({ version: 1, assets, ...invalid });
    expect(await loadGameArtInto(m, 'sample')).toBe(false);
    expect(requested).toEqual([]);
  });

  it('unknown explicit group returns false without loading the default initialGroup', async () => {
    const { manager: m, requested } = setup(grouped);
    expect(await loadGameArtInto(m, 'sample', { group: 'missing' })).toBe(false);
    expect(requested).toEqual([]);
  });

  it('selected group failure remains fail-soft and never triggers unrelated fallback loads', async () => {
    const { manager: m, requested } = setup(grouped, 'title');
    await expect(loadGameArtInto(m, 'sample')).resolves.toBe(false);
    expect(requested).toEqual(['title']); expect(m.groupProgress('menu')).toMatchObject({ status: 'failed', failed: 1 });
    expect(m.isLoaded('house')).toBe(false);
  });

  it('empty initial group succeeds without loader work', async () => {
    const { manager: m, requested } = setup({ version: 1, assets, groups: { empty: [] }, initialGroup: 'empty' });
    expect(await loadGameArtInto(m, 'sample')).toBe(true); expect(requested).toEqual([]);
    expect(m.groupProgress('empty')).toMatchObject({ status: 'ready', total: 0 });
  });

  it('an aborted index request that still resolves cannot register descriptors or start asset I/O', async () => {
    const { manager: m, requested } = setup(grouped);
    let resolveFetch!: (value: { ok: boolean; json: () => Promise<unknown> }) => void;
    const fetcher = vi.fn(() => new Promise<{ ok: boolean; json: () => Promise<unknown> }>((resolve) => { resolveFetch = resolve; }));
    vi.stubGlobal('fetch', fetcher);
    const controller = new AbortController();
    const loading = loadGameArtInto(m, 'sample', { indexSignal: controller.signal });
    expect(fetcher).toHaveBeenCalledWith('/games/sample/art/index.json', { cache: 'no-store', signal: controller.signal });
    controller.abort(); m.clear();
    resolveFetch({ ok: true, json: async () => grouped });
    expect(await loading).toBe(false);
    expect(m.has('title')).toBe(false); expect(m.has('house')).toBe(false);
    expect(m.groupProgress('menu')).toBeUndefined(); expect(requested).toEqual([]);
  });

  it('groups cannot reference tbf or nonphysical material entries', async () => {
    const { manager: m, requested } = setup({ version: 1, assets: [
      { id: 'pending', type: 'texture', description: '', status: 'tbf' },
      { id: 'mat', type: 'material', description: '', status: 'filled', spec: {} },
    ], groups: { scene: ['mat', 'pending'] }, initialGroup: 'scene' });
    expect(await loadGameArtInto(m, 'sample')).toBe(false); expect(requested).toEqual([]);
  });
});
