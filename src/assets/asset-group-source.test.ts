import { describe, expect, it, vi } from 'vitest';
import { AssetManager, StubAssetLoader } from './asset-manager.js';
import { createAssetGroupDataSource } from './asset-group-source.js';
import type { AssetLoader } from './asset-types.js';
import { World } from '@engine/core/world.js';
import { createWorldDataSource } from '@engine/host/ui-data-source.js';
import { resolveBindings } from '@ui/components/bindings.js';
import type { LayoutNode } from '@ui/components/types.js';

function fixture() {
  const pending: Array<{ resolve: (result: { handle: unknown; width: number; height: number }) => void; reject: (error: Error) => void }> = [];
  const m = new AssetManager({ load: () => new Promise((resolve, reject) => pending.push({ resolve, reject })) } satisfies AssetLoader);
  for (const key of ['a', 'b']) m.register({ kind: 'texture', key, src: `${key}.png` });
  m.registerGroups({ scene: ['a', 'b'], empty: [] });
  return { m, pending };
}
const finish = { handle: {}, width: 4, height: 4 };
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const loadingTree: LayoutNode = {
  type: 'Panel', id: 'loader', props: {}, children: [
    { type: 'ProgressBar', id: 'bar', props: { value: -1, max: 999, bind: 'asset-group:scene' } },
    { type: 'Label', id: 'count', props: { text: 'Loaded ', bind: 'asset-group:scene' } },
    { type: 'Label', id: 'loading', visibleWhen: 'asset-group:scene:loading', props: { text: 'Loading' } },
    { type: 'Label', id: 'ready', visibleWhen: 'asset-group:scene:ready', props: { text: 'Ready' } },
    { type: 'Label', id: 'failed', visibleWhen: 'asset-group:scene:failed', props: { text: 'Failed' } },
  ],
};

describe('asset group data source — existing UI bindings', () => {
  it('real resolveBindings maps successful keys to ProgressBar/Label and state flags through loading to ready', async () => {
    const { m, pending } = fixture(); const ds = createAssetGroupDataSource(m);
    expect(ds.resource?.('asset-group:scene')).toEqual({ current: 0, max: 2 });
    expect(ds.flag?.('asset-group:scene:ready')).toBe(false);
    const initial = resolveBindings(loadingTree, ds);
    expect(initial.children?.map((n) => n.id)).toEqual(['bar', 'count']);
    const observed: LayoutNode[] = [];
    const off = m.subscribeGroups(() => observed.push(resolveBindings(loadingTree, ds)));
    const p = m.preloadGroup('scene');
    expect(resolveBindings(loadingTree, ds).children?.map((n) => n.id)).toEqual(['bar', 'count', 'loading']);
    pending[0].resolve(finish); await flush();
    const partial = resolveBindings(loadingTree, ds);
    expect(partial.children?.[0].props).toMatchObject({ value: 1, max: 2 });
    expect(partial.children?.[1].props).toMatchObject({ text: 'Loaded 1' });
    pending[1].resolve(finish); await p;
    const ready = resolveBindings(loadingTree, ds);
    expect(ready.children?.map((n) => n.id)).toEqual(['bar', 'count', 'ready']);
    expect(ready.children?.[0].props).toMatchObject({ value: 2, max: 2 });
    expect(ready.children?.[1].props).toMatchObject({ text: 'Loaded 2' });
    expect(observed.some((tree) => (tree.children?.[0].props as { value: number }).value === 1)).toBe(true);
    off(); const count = observed.length; m.releaseGroup('scene'); expect(observed).toHaveLength(count);
    expect(loadingTree.children?.[0].props).toMatchObject({ value: -1, max: 999 });
  });

  it('failed groups expose successful count and failed visibility, then release resets flags and count', async () => {
    const { m, pending } = fixture(); const ds = createAssetGroupDataSource(m);
    const p = m.preloadGroup('scene'); const rejected = p.catch((error: unknown) => error);
    pending[0].resolve(finish); pending[1].reject(new Error('bad b'));
    expect(await rejected).toBeInstanceOf(AggregateError);
    expect(ds.resource?.('asset-group:scene')).toEqual({ current: 1, max: 2 });
    expect(resolveBindings(loadingTree, ds).children?.map((n) => n.id)).toEqual(['bar', 'count', 'failed']);
    m.releaseGroup('scene');
    expect(ds.resource?.('asset-group:scene')).toEqual({ current: 0, max: 2 });
    for (const state of ['loading', 'ready', 'failed']) expect(ds.flag?.(`asset-group:scene:${state}`)).toBe(false);
  });

  it('empty ready groups display 1/1 while the manager preserves zero statistical total', async () => {
    const m = new AssetManager(new StubAssetLoader()); m.registerGroups({ empty: [] });
    const ds = createAssetGroupDataSource(m);
    await m.preloadGroup('empty');
    expect(ds.resource?.('asset-group:empty')).toEqual({ current: 1, max: 1 });
    expect(m.groupProgress('empty')).toMatchObject({ status: 'ready', loaded: 0, total: 0 });
    const tree = resolveBindings({ type: 'ProgressBar', id: 'empty', props: { value: 0, bind: 'asset-group:empty' } }, ds);
    expect(tree.props).toMatchObject({ value: 1, max: 1 });
  });

  it('composes with real world resource/value/flag/list projection and preserves all existing bindings', () => {
    const { m } = fixture();
    const world = new World({ strict: false });
    world.createEntity('hud');
    world.addComponent('hud', { type: 'Resource', id: 'gold', current: 12, max: 99, min: 0 } as never);
    world.addComponent('hud', { type: 'StringVar', id: 'portrait', value: '/hero.png' } as never);
    world.addComponent('hud', { type: 'Flag', id: 'my-turn', active: true } as never);
    world.createEntity('card'); world.addComponent('card', { type: 'Text', text: 'A♠' } as never);
    const worldSource = createWorldDataSource(world, { hand: { query: ['Text'], fields: { face: { comp: 'Text', key: 'text' } } } });
    const ds = createAssetGroupDataSource(m, worldSource);
    expect(ds.resource?.('gold')).toEqual({ current: 12, max: 99 });
    expect(ds.value?.('portrait')).toBe('/hero.png'); expect(ds.flag?.('my-turn')).toBe(true);
    expect(ds.list?.('hand')).toEqual([{ id: 'card', face: 'A♠' }]);
    const tree: LayoutNode = { type: 'Panel', id: 'root', props: {}, children: [
      { type: 'Label', id: 'gold', props: { text: 'Gold ', bind: 'gold' } },
      { type: 'ProgressBar', id: 'wallet', props: { value: 0, bind: 'gold' } },
      { type: 'Image', id: 'portrait', visibleWhen: 'my-turn', props: { src: '', bind: 'portrait' } },
      { type: 'Panel', id: 'cards', props: {}, repeat: { source: 'hand', key: 'id', template: { type: 'Label', id: 'face', props: { text: '{{item.face}}' } } } },
    ] };
    const out = resolveBindings(tree, ds);
    expect(out.children?.[0].props).toMatchObject({ text: 'Gold 12' });
    expect(out.children?.[1].props).toMatchObject({ value: 12, max: 99 });
    expect(out.children?.[2].props).toMatchObject({ src: '/hero.png' });
    expect(out.children?.[3].children?.[0]).toMatchObject({ id: 'face#card', props: { text: 'A♠' } });
  });

  it('forwards prototype fallback readers with their original receiver and private state', () => {
    const { m } = fixture();
    class Fallback {
      #score = 23;
      resource(id: string) { return id === 'score' ? { current: this.#score, max: 50 } : undefined; }
      flag(id: string) { return id === 'turn' ? this.#score > 0 : undefined; }
      value(id: string) { return id === 'portrait' ? `/hero-${this.#score}.png` : undefined; }
      list(id: string) { return id === 'hand' ? [{ id: `card-${this.#score}` }] : undefined; }
    }
    const ds = createAssetGroupDataSource(m, new Fallback());
    expect(ds.resource?.('score')).toEqual({ current: 23, max: 50 });
    expect(ds.flag?.('turn')).toBe(true);
    expect(ds.value?.('portrait')).toBe('/hero-23.png');
    expect(ds.list?.('hand')).toEqual([{ id: 'card-23' }]);
    expect(ds.resource?.('asset-group:scene')).toEqual({ current: 0, max: 2 });
  });

  it('unknown group namespaces and unsupported flag suffixes delegate exactly to fallback without throwing', () => {
    const { m } = fixture();
    const fallback = { resource: vi.fn(() => ({ current: 7, max: 9 })), flag: vi.fn(() => true), value: vi.fn(() => 'value'), list: vi.fn(() => [{ id: 'one' }]) };
    const ds = createAssetGroupDataSource(m, fallback);
    expect(ds.resource?.('asset-group:unknown')).toEqual({ current: 7, max: 9 });
    expect(ds.flag?.('asset-group:unknown:ready')).toBe(true);
    expect(ds.flag?.('asset-group:scene:unloaded')).toBe(true);
    expect(fallback.resource).toHaveBeenCalledWith('asset-group:unknown');
    expect(fallback.flag).toHaveBeenCalledWith('asset-group:unknown:ready');
    expect(fallback.flag).toHaveBeenCalledWith('asset-group:scene:unloaded');
    expect(ds.value?.('asset-group:scene')).toBe('value'); expect(ds.list?.('asset-group:scene')).toEqual([{ id: 'one' }]);
    const alone = createAssetGroupDataSource(m);
    expect(alone.resource?.('asset-group:unknown')).toBeUndefined(); expect(alone.flag?.('asset-group:unknown:ready')).toBeUndefined();
  });
});
