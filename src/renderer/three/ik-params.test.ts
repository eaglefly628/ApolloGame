import { afterEach, describe, expect, it, vi } from 'vitest';
import { World } from '@engine/core/world.js';
import type { Component } from '@engine/core/types.js';
import { hashSnapshot } from '@net/determinism.js';
import { readIKParams } from './ik-params.js';
import * as graphParams from './animation-graph-params.js';

const graph = () => ({ type: 'AnimGraph3D' as const, clips: { idle: { clip: 'idle' } }, states: { idle: { clip: 'idle' } }, transitions: [],
  params: { move: 'speed', grip: 'flag:grip', mode: 'state:motion', absent: 'flag:future' } });
function world(): World {
  const state = new World(); state.createEntity('hero'); state.createEntity('other');
  state.addComponent('hero', { type: 'Velocity', vx: .03, vy: .04, angular: 0 });
  state.addComponent('other', { type: 'Flag', id: 'grip', active: false });
  state.addComponent('other', { type: 'State', fsmId: 'motion', current: 'walk', previous: 'idle' });
  return state;
}
afterEach(() => vi.restoreAllMocks());

describe('readIKParams E2 bridge', () => {
  it('delegates exact existing E2 semantics without requiring graph playback', () => {
    const state = world(); state.addComponent('hero', graph());
    const read = vi.spyOn(graphParams, 'readAnimGraphParams');
    expect(readIKParams(state, 'hero')).toEqual({ move: .05, grip: false, mode: 'walk', absent: undefined });
    expect(read).toHaveBeenCalledTimes(1); expect(read.mock.calls[0][1]).toBe('hero');
    expect(Object.isFrozen(readIKParams(state.readView(), 'hero'))).toBe(true);
  });

  it('returns frozen empty parameters when only another entity has a graph', () => {
    const state = world(); state.addComponent('other', graph());
    expect(Object.keys(readIKParams(state, 'hero'))).toEqual([]); expect(Object.isFrozen(readIKParams(state, 'hero'))).toBe(true);
  });

  it.each([
    { type: 'AnimGraph3D', params: null }, { type: 'AnimGraph3D', params: { move: 'speed' } },
    { ...graph(), states: { idle: { clip: 'missing' } } }, { ...graph(), params: { move: 'script:velocity' } },
    Object.assign([], { type: 'AnimGraph3D' }), Object.assign(new Map(), { type: 'AnimGraph3D' }),
  ])('quietly rejects malformed raw graph %s without reading any simulation parameter', raw => {
    const state = world(); state.addComponent('hero', raw as unknown as Component); state.drainDirty();
    const read = vi.spyOn(state, 'peek'), delegate = vi.spyOn(graphParams, 'readAnimGraphParams'), sequence = state.writeSequence;
    expect(Object.keys(readIKParams(state, 'hero'))).toEqual([]);
    expect(delegate).not.toHaveBeenCalled(); expect(read.mock.calls.every(([, type]) => type === 'AnimGraph3D')).toBe(true);
    expect(state.writeSequence).toBe(sequence); expect(state.drainDirty()).toEqual([]);
  });

  it('does not invoke throwing getters and rejects cyclic raw graphs before delegation', () => {
    const state = world(), delegate = vi.spyOn(graphParams, 'readAnimGraphParams');
    let calls = 0;
    const raw = Object.defineProperty(graph(), 'params', { get() { calls++; throw new Error('bad params'); } });
    state.addComponent('hero', raw as Component);
    expect(Object.keys(readIKParams(state, 'hero'))).toEqual([]); expect(calls).toBe(0);
    const nested = { ...graph(), params: Object.defineProperty({}, 'move', { get() { calls++; throw new Error('bad source'); }, enumerable: true }) };
    state.addComponent('hero', nested as Component);
    expect(Object.keys(readIKParams(state, 'hero'))).toEqual([]); expect(calls).toBe(0);
    const cyclic: Record<string, unknown> = graph(); cyclic.clips = cyclic;
    state.addComponent('hero', cyclic as unknown as Component);
    expect(Object.keys(readIKParams(state, 'hero'))).toEqual([]); expect(delegate).not.toHaveBeenCalled();
  });

  it('preserves full snapshots, hash, write sequence and dirty state for raw worlds and renderer views', () => {
    const state = world(); state.addComponent('hero', graph()); state.drainDirty();
    const snapshot = state.snapshot(), hash = hashSnapshot(snapshot), sequence = state.writeSequence;
    for (let i = 0; i < 1000; i++) readIKParams(i % 2 ? state.readView() : state, 'hero');
    expect(state.snapshot()).toEqual(snapshot); expect(hashSnapshot(state.snapshot())).toBe(hash);
    expect(state.writeSequence).toBe(sequence); expect(state.drainDirty()).toEqual([]);
  });
});
