import { afterEach, describe, expect, it, vi } from 'vitest';
import { World } from './world.js';
import type { Component, ComponentNotice, SystemDeclaration } from './types.js';
import { timelineCapability } from '@skills/tier3/timeline.js';
import { Tracer } from '../../debug/tracer.js';
import { Recorder } from '../../debug/recorder.js';

interface SignalData extends Component { type: 'Signal'; name: string; nested?: { values: number[] } }
const signal = (name = 'cut'): SignalData => ({ type: 'Signal', name });
const system = (partial: Partial<SystemDeclaration>): SystemDeclaration => ({
  id: 'probe', reads: [], writes: [], consumes: [], execute() {}, ...partial,
});
const registry = (world: World): unknown => (world as unknown as { componentObservers?: unknown }).componentObservers;

afterEach(() => vi.restoreAllMocks());

describe('World passive component observations', () => {
  it('publishes each same-payload add after writes and indexes, with independent deeply frozen snapshots', () => {
    const world = new World({ strict: true });
    world.createEntity('cue');
    const notices: ComponentNotice[] = [];
    const indexStates: unknown[] = [];
    const live: SignalData = { ...signal(), nested: { values: [1, 2] } };
    world.observeComponents(['Signal'], notice => {
      indexStates.push([world.queryEntities('Signal'), world.singleton('Signal'), world.peek('cue', 'Signal') === live]);
      notices.push(notice);
    });
    const before = world.writeSequence;
    world.addComponent('cue', live);
    world.addComponent('cue', live);
    world.addComponent('cue', live);
    expect(notices).toHaveLength(3);
    expect(indexStates).toEqual(Array.from({ length: 3 }, () => [['cue'], 'cue', true]));
    expect(world.writeSequence).toBe(before + 3);
    const first = notices[0]!;
    const second = notices[1]!;
    if (first.kind !== 'add' || second.kind !== 'add') throw new Error('missing publication');
    const snapshot = first.component as SignalData;
    expect(first).not.toBe(second);
    expect(first.component).not.toBe(second.component);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.nested)).toBe(true);
    expect(Object.isFrozen(snapshot.nested!.values)).toBe(true);
    expect(() => snapshot.nested!.values.push(3)).toThrow(TypeError);
    live.nested!.values.push(9);
    live.name = 'changed';
    expect(snapshot).toEqual({ type: 'Signal', name: 'cut', nested: { values: [1, 2] } });
    expect(Object.isFrozen(live)).toBe(false);
  });

  it('observes same-system immediate deletion and consume after the type index is cleared', () => {
    const world = new World({ strict: true });
    world.createEntity('cue');
    world.createEntity('other');
    const events: string[] = [];
    const removedStates: unknown[] = [];
    world.observeComponents(['Signal'], notice => {
      events.push(`${notice.kind}:${'entityId' in notice ? notice.entityId : ''}`);
      if (notice.kind === 'remove') {
        removedStates.push([world.hasComponent(notice.entityId, 'Signal'), world.queryEntities('Signal'), world.singleton('Signal')]);
      }
    });
    world.addSystem(system({ writes: ['Signal'], consumes: ['Signal'], execute(view) {
      view.addComponent('cue', signal());
      view.removeComponent('cue', 'Signal');
      view.addComponent('cue', signal());
      view.addComponent('other', signal());
    } }));
    world.tick();
    expect(events).toEqual(['add:cue', 'remove:cue', 'add:cue', 'add:other', 'remove:cue', 'remove:other']);
    expect(removedStates).toEqual(Array.from({ length: 3 }, () => [false, [], undefined]));
    expect(world.queryEntities('Signal')).toEqual([]);
  });

  it.each([2, 3, 4, 5])('captures real timeline publications across %i catch-up ticks before one render read', ticks => {
    const world = new World({ strict: true });
    for (const declaration of timelineCapability.systems) world.addSystem(declaration);
    world.createEntity('timeline');
    world.addComponent('timeline', { type: 'Timeline', id: 'intro', playOnSignal: 'play', cues: [
      { at: 0, do: { kind: 'signal', signal: 'first' } },
      { at: 0, do: { kind: 'signal', signal: 'second' } },
    ] } as Component);
    world.createEntity('start');
    const captures: string[] = [];
    world.observeComponents(['Signal'], notice => {
      if (notice.kind === 'add') captures.push((notice.component as SignalData).name);
    });
    world.addComponent('start', signal('play'));
    world.tick();
    world.destroyEntity('start');
    for (let tick = 1; tick < ticks; tick++) world.tick();
    expect(world.queryEntities('Signal')).toEqual([]);
    expect(captures).toEqual(['play', 'first', 'second', 'timeline:done:intro']);
  });

  it('captures every remaining real timeline fast-forward cue in publication order', () => {
    const world = new World({ strict: true });
    for (const declaration of timelineCapability.systems) world.addSystem(declaration);
    world.createEntity('timeline');
    world.addComponent('timeline', { type: 'Timeline', id: 'skip', playOnSignal: 'play', skipOnSignal: 'skip', cues: [
      { at: 0, do: { kind: 'signal', signal: 'a' } },
      { at: 12, do: { kind: 'signal', signal: 'b' } },
      { at: 24, do: { kind: 'signal', signal: 'c' } },
    ] } as Component);
    world.createEntity('start');
    const captures: string[] = [];
    world.observeComponents(['Signal'], notice => {
      if (notice.kind === 'add' && notice.entityId.startsWith('tl:')) captures.push((notice.component as SignalData).name);
    });
    world.addComponent('start', signal('play'));
    world.tick();
    world.addComponent('start', signal('skip'));
    world.tick();
    world.destroyEntity('start');
    world.tick();
    expect(captures).toEqual(['a', 'b', 'c', 'timeline:done:skip']);
    expect(world.queryEntities('Signal')).toEqual([]);
  });

  it('filters component notices and broadcasts real destruction and completed restore without replaying old Signals', () => {
    const world = new World();
    world.createEntity('cue');
    world.addComponent('cue', signal('baseline'));
    const events: ComponentNotice[] = [];
    const lifecycleStates: unknown[] = [];
    world.observeComponents(['Signal'], notice => {
      events.push(notice);
      if (notice.kind === 'destroy') lifecycleStates.push(world.getAllEntities().includes(notice.entityId));
      if (notice.kind === 'reset') lifecycleStates.push(world.peek<SignalData>('cue', 'Signal')?.name);
    });
    expect(events).toEqual([]);
    const snapshot = world.snapshot();
    world.addComponent('cue', { type: 'Unrelated' });
    world.removeComponent('cue', 'Unrelated');
    world.removeComponent('cue', 'Missing');
    world.destroyEntity('missing');
    world.destroyEntity('cue');
    world.restore(snapshot);
    expect(events).toEqual([{ kind: 'destroy', entityId: 'cue' }, { kind: 'reset' }]);
    expect(lifecycleStates).toEqual([false, 'baseline']);
    world.addComponent('cue', signal('baseline'));
    expect(events.at(-1)?.kind).toBe('add');
  });

  it('applyDelta uses normal replacement, removal and actual-destruction notices', () => {
    const world = new World();
    for (const id of ['a', 'b']) { world.createEntity(id); world.addComponent(id, signal()); }
    const events: ComponentNotice[] = [];
    world.observeComponents(['Signal'], notice => events.push(notice));
    world.applyDelta({ base: 0, seq: 1, removed: ['b', 'missing'], changed: {
      a: { Other: { type: 'Other' } },
      c: { Signal: signal('new') },
    } });
    expect(events).toEqual([
      { kind: 'destroy', entityId: 'b' },
      { kind: 'remove', entityId: 'a', componentType: 'Signal' },
      { kind: 'add', entityId: 'c', component: signal('new') },
    ]);
  });

  it('Tracer and Recorder keep their original tick slot while component listeners attach and detach', () => {
    const world = new World();
    world.createEntity('cue');
    world.addSystem(system({ writes: ['Signal'], execute(view) { view.addComponent('cue', signal()); } }));
    const tracer = new Tracer(world).attach();
    const seen: ComponentNotice[] = [];
    const cancel = world.observeComponents(['Signal'], notice => seen.push(notice));
    world.tick();
    expect(tracer.traces).toHaveLength(1);
    cancel();
    world.tick();
    expect(tracer.traces).toHaveLength(2);
    expect(seen).toHaveLength(1);
    const cancelAgain = world.observeComponents(['Signal'], notice => seen.push(notice));
    tracer.detach();
    world.tick();
    expect(tracer.traces).toHaveLength(2);
    expect(seen).toHaveLength(2);
    const recorder = new Recorder(world);
    recorder.tick();
    expect(recorder.recording.frames[0]!.systemTraces).toHaveLength(1);
    expect(seen).toHaveLength(3);
    cancelAgain();
    recorder.tick();
    expect(recorder.recording.frames[1]!.systemTraces).toHaveLength(1);
    const third = world.observeComponents(['Signal'], notice => seen.push(notice));
    recorder.detach();
    world.tick();
    expect(seen).toHaveLength(4);
    third();
  });

  it('subscription changes do not duplicate a publication or skip unrelated listeners', () => {
    const world = new World();
    world.createEntity('cue');
    const calls: string[] = [];
    let cancelSelf = () => {};
    let cancelOther = () => {};
    cancelSelf = world.observeComponents(['Signal'], () => {
      calls.push('self');
      cancelSelf(); cancelOther();
      world.observeComponents(['Signal'], () => calls.push('new'));
    });
    cancelOther = world.observeComponents(['Signal'], () => calls.push('cancelled'));
    const filters = ['Signal', 'Signal'];
    world.observeComponents(filters, () => calls.push('unrelated'));
    filters.length = 0;
    world.addComponent('cue', signal());
    expect(calls).toEqual(['self', 'unrelated']);
    world.addComponent('cue', signal());
    expect(calls).toEqual(['self', 'unrelated', 'unrelated', 'new']);
  });

  it('isolates repeated throwing listeners with one diagnostic per subscription and continues ticking', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const world = new World();
    world.createEntity('cue');
    world.addSystem(system({ writes: ['Signal'], consumes: ['Signal'], execute(view) { view.addComponent('cue', signal()); } }));
    const good = vi.fn();
    const bad = vi.fn(() => { throw new Error('listener error'); });
    world.observeComponents(['Signal'], bad);
    world.observeComponents(['Signal'], good);
    expect(() => { world.tick(); world.tick(); }).not.toThrow();
    expect(world.getVersion()).toBe(2);
    expect(bad).toHaveBeenCalledTimes(4);
    expect(good).toHaveBeenCalledTimes(4);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain('listener threw');
  });

  it('rejects accessor and non-POD snapshots without invoking getters or changing successful writes', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const world = new World();
    world.createEntity('cue');
    const seen = vi.fn();
    world.observeComponents(['Signal'], seen);
    const getter = vi.fn(() => { throw new Error('must not run'); });
    const accessor = { type: 'Signal', nested: Object.defineProperty({}, 'hostile', { enumerable: true, get: getter }) };
    expect(() => world.addComponent('cue', accessor)).not.toThrow();
    expect(world.peek('cue', 'Signal')).toBe(accessor);
    const uncloneable = { type: 'Signal', callback() {} };
    expect(() => world.addComponent('cue', uncloneable)).not.toThrow();
    expect(world.peek('cue', 'Signal')).toBe(uncloneable);
    expect(getter).not.toHaveBeenCalled();
    expect(seen).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    world.addComponent('cue', signal('recovered'));
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it('does not add component.type getter reads and does not inspect payloads without a matching subscriber', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const counts: number[] = [];
    for (const observed of [false, true]) {
      const world = new World();
      world.createEntity('cue');
      if (observed) world.observeComponents(['Signal'], () => {});
      let count = 0;
      world.addComponent('cue', { get type() { count++; return 'Signal'; } });
      counts.push(count);
    }
    expect(counts[1]).toBe(counts[0]);
    expect(warn).toHaveBeenCalledTimes(1);
    const world = new World();
    world.createEntity('cue');
    const ownKeys = vi.fn(() => { throw new Error('unneeded clone'); });
    const payload = new Proxy({}, { ownKeys });
    world.addComponent('cue', { type: 'Signal', payload } as Component);
    expect(registry(world)).toBeUndefined();
    const cancel = world.observeComponents(['Other'], () => {});
    world.addComponent('cue', { type: 'Signal', payload } as Component);
    cancel();
    expect(ownKeys).not.toHaveBeenCalled();
  });

  it('10k mount-cancel cycles release the lazy registry and leave no stale delivery', () => {
    const world = new World();
    world.createEntity('cue');
    let calls = 0;
    const cancellations: Array<() => void> = [];
    for (let i = 0; i < 10_000; i++) {
      const cancel = world.observeComponents(['Signal', `unused-${i}`], () => { calls++; });
      cancellations.push(cancel);
      world.addComponent('cue', signal());
      cancel(); cancel();
      expect(registry(world)).toBeUndefined();
    }
    expect(calls).toBe(10_000);
    for (const cancel of cancellations) cancel();
    world.addComponent('cue', signal());
    expect(calls).toBe(10_000);
    const cancel = world.observeComponents(['Signal'], () => { calls++; });
    world.addComponent('cue', signal());
    expect(calls).toBe(10_001);
    cancel();
    expect(registry(world)).toBeUndefined();
  });
});
