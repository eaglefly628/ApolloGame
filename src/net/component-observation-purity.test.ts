import { describe, expect, it } from 'vitest';
import { World } from '@engine/core/world.js';
import type { Component } from '@engine/core/types.js';
import { hashSnapshot } from './determinism.js';
import { WorldHasher } from './world-hash.js';

interface State extends Component { type: 'State'; value: number; nested: { values: number[] } }

function makeWorld(): World {
  const world = new World({ strict: true });
  world.createEntity('publisher');
  world.addComponent('publisher', { type: 'State', value: 0, nested: { values: [] } } as State);
  world.addSystem({ id: 'publisher', reads: ['State'], writes: ['State', 'Signal'], consumes: ['Signal'], execute(view) {
    const state = view.getComponent<State>('publisher', 'State')!;
    state.value++;
    view.addComponent('publisher', { type: 'Signal', name: 'same', data: [state.value] } as Component);
    view.addComponent('publisher', { type: 'Signal', name: 'same', data: [state.value] } as Component);
    if (state.value % 3 === 0) view.removeComponent('publisher', 'Signal');
  } });
  return world;
}

describe('component observation is outside simulation state', () => {
  it('long dual-world run preserves full/incremental hash, write sequences, delta, versions, dirty order and query order', () => {
    const plain = makeWorld();
    const observed = makeWorld();
    const plainHash = new WorldHasher(plain);
    const observedHash = new WorldHasher(observed);
    const counts = { add: 0, remove: 0, destroy: 0, reset: 0 };
    const cancel = observed.observeComponents(['Signal', 'State'], notice => {
      counts[notice.kind]++;
      if (notice.kind === 'add' && !Object.isFrozen(notice.component)) throw new Error('unfrozen publication');
    });
    let base = 0;
    for (let step = 0; step < 2_000; step++) {
      for (const world of [plain, observed]) {
        const id = ['10', '2', 'hero', '1', 'extra'][step % 5]!;
        switch (step % 10) {
          case 0:
          case 1:
            if (!world.getAllEntities().includes(id)) world.createEntity(id);
            world.addComponent(id, { type: 'State', value: step, nested: { values: [step, step + 1] } } as State);
            break;
          case 2:
            world.addComponent('publisher', { type: 'Signal', name: 'cut', source: 'same' } as Component);
            world.addComponent('publisher', { type: 'Signal', name: 'cut', source: 'same' } as Component);
            break;
          case 3: {
            const state = world.getComponent<State>('publisher', 'State')!;
            state.nested.values = [step];
            break;
          }
          case 4: world.removeComponent(id, 'State'); break;
          case 5: world.destroyEntity(id); break;
          case 6: world.tick(); break;
          case 7: world.restore(world.snapshot(), world.snapshotOrder()); break;
          case 8:
            world.applyDelta({ base: 0, seq: 0, removed: ['extra'], changed: {
              '2': { Signal: { type: 'Signal', name: `cue-${step}` } as Component },
            } });
            break;
          case 9: world.tick(); world.tick(); break;
        }
      }
      const tag = `operation ${step}`;
      expect(observed.snapshot(), tag).toEqual(plain.snapshot());
      const full = hashSnapshot(plain.snapshot());
      expect(hashSnapshot(observed.snapshot()), tag).toBe(full);
      expect(plainHash.hash(), tag).toBe(full);
      expect(observedHash.hash(), tag).toBe(full);
      expect(observedHash.stats.recomputed, tag).toBe(plainHash.stats.recomputed);
      expect(observed.writeSequence, tag).toBe(plain.writeSequence);
      expect(observed.getVersion(), tag).toBe(plain.getVersion());
      expect(observed.snapshotDelta(base), tag).toEqual(plain.snapshotDelta(base));
      expect(observed.snapshotOrder(), tag).toEqual(plain.snapshotOrder());
      for (const type of ['State', 'Signal']) {
        expect(observed.typeVersion(type), tag).toBe(plain.typeVersion(type));
        expect(observed.queryEntities(type), tag).toEqual(plain.queryEntities(type));
      }
      for (const id of plain.getAllEntities()) expect(observed.entityVersion(id), tag).toBe(plain.entityVersion(id));
      expect(observed.dirtyCount, tag).toBe(plain.dirtyCount);
      expect(observed.drainDirty(), tag).toEqual(plain.drainDirty());
      base = plain.writeSequence;
    }
    expect(counts.add).toBeGreaterThan(2_000);
    expect(counts.remove).toBeGreaterThan(600);
    expect(counts.destroy).toBeGreaterThan(0);
    expect(counts.reset).toBe(200);
    cancel();
    const before = { ...counts };
    observed.tick();
    expect(counts).toEqual(before);
  });

  it('Signal remains in deterministic hashes and does not become excluded presentation state', () => {
    const world = new World();
    world.createEntity('cue');
    const hasher = new WorldHasher(world);
    const empty = hasher.hash();
    const cancel = world.observeComponents(['Signal'], () => {});
    world.addComponent('cue', { type: 'Signal', name: 'one' } as Component);
    const one = hasher.hash();
    world.addComponent('cue', { type: 'Signal', name: 'two' } as Component);
    const two = hasher.hash();
    expect(one).not.toBe(empty);
    expect(two).not.toBe(one);
    expect(two).toBe(hashSnapshot(world.snapshot()));
    cancel();
  });
});
