import { describe, expect, it, vi } from 'vitest';
import { World } from '@engine/core/world.js';
import { hashSnapshot } from '@net/index.js';
import type { AnimGraph3D } from '@engine/protocol/components/anim-graph.js';
import { readAnimGraphParams } from './animation-graph-params.js';

const graph: AnimGraph3D = { type: 'AnimGraph3D', clips: { idle: { clip: 'idle' } }, states: { idle: { clip: 'idle' } },
  transitions: [], params: { speed: 'speed', paused: 'flag:paused', mode: 'state:mode', missingFlag: 'flag:missing', missingState: 'state:missing' } };
const velocity = (vx: number, vy: number) => ({ type: 'Velocity' as const, vx, vy, angular: 7 });

describe('readAnimGraphParams', () => {
  it.each([null, [], 3, 'speed', new Date(0), Object.assign(Object.create({}), { move: 'speed' }),
    { move: null }, { move: 3 }, { move: 'script:any' }, { move: 'flag:' }, { move: 'state: ' }])('returns frozen empty parameters for malformed raw params %s without touching the world', params => {
    const world = new World(), read = vi.spyOn(world, 'readView');
    const result = readAnimGraphParams(world, 'hero', { ...graph, params } as unknown as AnimGraph3D);
    expect(Object.keys(result)).toEqual([]); expect(Object.isFrozen(result)).toBe(true); expect(read).not.toHaveBeenCalled();
  });

  it('quietly isolates cyclic source values and throwing raw parameter accessors', () => {
    const world = new World(), cyclic: Record<string, unknown> = {}; cyclic.source = cyclic;
    expect(Object.keys(readAnimGraphParams(world, 'hero', { ...graph, params: cyclic } as unknown as AnimGraph3D))).toEqual([]);
    const raw = Object.defineProperty({}, 'params', { get() { throw new Error('bad accessor'); } });
    expect(Object.keys(readAnimGraphParams(world, 'hero', raw as AnimGraph3D))).toEqual([]);
  });

  it('reads exact global semantic fields using query-first precedence and a per-entity speed', () => {
    const world = new World();
    for (const id of ['z-first', 'a-second', 'hero', 'other']) world.createEntity(id);
    world.addComponent('z-first', { type: 'Flag', id: 'paused', active: false });
    world.addComponent('a-second', { type: 'Flag', id: 'paused', active: true });
    world.addComponent('z-first', { type: 'State', fsmId: 'mode', current: 'walking', previous: 'idle' });
    world.addComponent('a-second', { type: 'State', fsmId: 'mode', current: 'running', previous: 'walking' });
    world.addComponent('hero', velocity(-3, 4)); world.addComponent('other', velocity(30, 40));
    expect(readAnimGraphParams(world.readView(), 'hero', graph)).toEqual({
      speed: 5, paused: false, mode: 'walking', missingFlag: undefined, missingState: undefined,
    });
  });

  it('preserves missing values and observes a flag spawned after a prior read', () => {
    const world = new World(); world.createEntity('hero');
    expect(readAnimGraphParams(world, 'hero', graph).speed).toBeUndefined();
    expect(readAnimGraphParams(world, 'hero', graph).paused).toBeUndefined();
    world.createEntity('later'); world.addComponent('later', { type: 'Flag', id: 'paused', active: true });
    expect(readAnimGraphParams(world, 'hero', graph).paused).toBe(true);
    world.addComponent('hero', velocity(0, 0));
    expect(readAnimGraphParams(world, 'hero', graph).speed).toBe(0);
  });

  it.each([[NaN, 1], [1, Infinity], [-Infinity, 0], [Number.MAX_VALUE, Number.MAX_VALUE]])('rejects nonfinite/overflow speed (%s, %s)', (vx, vy) => {
    const world = new World(); world.createEntity('hero'); world.addComponent('hero', velocity(vx, vy));
    expect(readAnimGraphParams(world, 'hero', graph).speed).toBeUndefined();
  });

  it('projects tiny finite speeds without squaring underflow', () => {
    const world = new World(); world.createEntity('hero'); world.addComponent('hero', velocity(3e-200, 4e-200));
    expect(readAnimGraphParams(world, 'hero', graph).speed).toBe(5e-200);
  });

  it('leaves snapshots, write sequence, dirty tracking, graph data and hash untouched over repeated reads', () => {
    const world = new World(); world.createEntity('hero'); world.createEntity('flags');
    world.addComponent('hero', velocity(.03, .04));
    world.addComponent('flags', { type: 'Flag', id: 'paused', active: false });
    world.addComponent('flags', { type: 'State', fsmId: 'mode', current: 'idle', previous: 'idle' });
    world.drainDirty();
    const snapshot = world.snapshot(), hash = hashSnapshot(snapshot), sequence = world.writeSequence, beforeGraph = JSON.stringify(graph);
    for (let i = 0; i < 100; i++) readAnimGraphParams(i % 2 ? world.readView() : world, 'hero', graph);
    expect(world.snapshot()).toEqual(snapshot); expect(hashSnapshot(world.snapshot())).toBe(hash);
    expect(world.writeSequence).toBe(sequence); expect(world.drainDirty()).toEqual([]);
    expect(JSON.stringify(graph)).toBe(beforeGraph); expect(Object.isFrozen(readAnimGraphParams(world, 'hero', graph))).toBe(true);
  });
});
