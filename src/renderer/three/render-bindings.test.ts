import { afterEach, describe, expect, it, vi } from 'vitest';
import { World } from '@engine/core/world.js';
import type { Component } from '@engine/core/types.js';
import type { Glow3D, Light3D, Material3D, Vfx3D } from '@engine/protocol/components.js';
import type { RenderBinding, RenderBinding3D } from '@engine/protocol/components/render-binding.js';
import { hashWorld } from '@net/world-hash.js';
import { hashSnapshot } from '@net/determinism.js';
import { Recorder } from '../../debug/recorder.js';
import { timelineCapability } from '@skills/tier3/timeline.js';
import { RenderBindings } from './render-bindings.js';

const resource: RenderBinding = { target: 'Light3D.intensity', source: { kind: 'resource-ratio', id: 'fuel' }, range: [0, 20], transition: { duration: 1 } };
function fixture(bindings: readonly RenderBinding[] = [resource]) {
  const world = new World(); world.createEntity('lamp'); world.createEntity('vars');
  world.addComponent('lamp', { type: 'Light3D', kind: 'point', intensity: 9, color: 0xffffff });
  world.addComponent('lamp', { type: 'Glow3D', scale: 3, color: 0xff8800, opacity: .3 });
  world.addComponent('lamp', { type: 'Mesh3D', shape: 'box', width: 1, height: 1, frontTint: 0xffffff });
  world.addComponent('lamp', { type: 'Material3D', preset: 'matte', dissolve: { progress: .2 } });
  world.addComponent('lamp', { type: 'Vfx3D', rate: 3 });
  world.addComponent('lamp', { type: 'Pickable3D', signal: 'click' });
  world.addComponent('lamp', { type: 'Resource', id: 'fuel', current: 25, min: 0, max: 100 });
  world.addComponent('vars', { type: 'Flag', id: 'lit', active: false });
  world.addComponent<RenderBinding3D>('lamp', { type: 'RenderBinding3D', bindings });
  return { world, controller: new RenderBindings() };
}
function publish(world: World, name: string, arg?: string) { world.addComponent('vars', { type: 'Signal', name, source: 'vars', ...(arg === undefined ? {} : { arg }) }); }
const value = (controller: RenderBindings, world: World, time: number) => controller.sync(world, time).world.getComponent<Light3D>('lamp', 'Light3D')!.intensity;
afterEach(() => vi.restoreAllMocks());

describe('RenderBinding3D read-only numeric projection', () => {
  it('samples bounded ratios and absolute elapsed time, repeats the same frame, catches up, reverses and rebases a backward clock', () => {
    const { world, controller } = fixture(); expect(value(controller, world, 100)).toBe(5);
    world.addComponent('lamp', { type: 'Resource', id: 'fuel', current: 100, min: 0, max: 100 });
    expect(value(controller, world, 200)).toBe(5); expect(value(controller, world, 450)).toBe(8.75);
    expect(value(controller, world, 450)).toBe(8.75); expect(value(controller, world, 5000)).toBe(20);
    world.addComponent('lamp', { type: 'Resource', id: 'fuel', current: -4, min: 0, max: 100 });
    expect(value(controller, world, 5000)).toBe(20); expect(value(controller, world, 5500)).toBe(10);
    expect(value(controller, world, 1)).toBe(0); expect(controller.sync(world, 1).active).toBe(false); controller.clear();
  });
  it.each([['linear', .25], ['cubicOut', .578125], ['inOut', .15625]] as const)('reuses %s easing and keeps the final signature stable', (ease, fraction) => {
    const { world, controller } = fixture([{ ...resource, transition: { duration: 1, ease } }]); value(controller, world, 0);
    world.addComponent('lamp', { type: 'Resource', id: 'fuel', current: 100, min: 0, max: 100 }); value(controller, world, 10);
    expect(value(controller, world, 260)).toBeCloseTo(5 + 15 * fraction);
    const final = controller.sync(world, 1010); expect(final.active).toBe(false); expect(controller.sync(world, 9000).signature).toBe(final.signature); controller.clear();
  });
  it('projects all four closed outputs, leaves raw components intact and accepts inverse ranges', () => {
    const { world, controller } = fixture([
      resource, { target: 'Vfx3D.rate', source: { kind: 'flag', id: 'lit' }, range: [0, 200] },
      { target: 'Material3D.dissolve.progress', source: { kind: 'flag', id: 'lit' }, range: [1, 0] },
      { target: 'Glow3D.opacity', source: { kind: 'hover' }, range: [0, 1] },
    ]);
    world.addComponent('vars', { type: 'Flag', id: 'lit', active: true });
    const raw = world.snapshot(), projected = controller.sync(world, 0, 'lamp');
    expect(projected.world.getComponent<Vfx3D>('lamp', 'Vfx3D')!.rate).toBe(200);
    expect(projected.world.getComponent<Material3D>('lamp', 'Material3D')!.dissolve!.progress).toBe(0);
    expect(projected.world.getComponent<Glow3D>('lamp', 'Glow3D')!.opacity).toBe(1);
    expect(world.snapshot()).toEqual(raw); expect(controller.sync(world, 1, null).signature).not.toBe(projected.signature); controller.clear();
  });
  it('uses creation-order semantic ids, diagnoses invalid/missing resources once and recovers', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {}), { world, controller } = fixture();
    world.addComponent('vars', { type: 'Resource', id: 'fuel', current: 100, min: 0, max: 100 }); expect(value(controller, world, 0)).toBe(5);
    world.addComponent('lamp', { type: 'Resource', id: 'fuel', current: NaN, min: 0, max: 0 });
    expect(value(controller, world, 1)).toBe(9); expect(value(controller, world, 2)).toBe(9); expect(warn).toHaveBeenCalledTimes(1);
    world.removeComponent('lamp', 'Resource'); expect(value(controller, world, 3)).toBe(20);
    world.removeComponent('vars', 'Resource'); expect(value(controller, world, 4)).toBe(9); controller.clear();
  });
  it('returns exactly the original world without components and rejects malformed direct runtime data', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {}), world = new World(), controller = new RenderBindings();
    expect(controller.sync(world, NaN)).toEqual({ world, signature: '', active: false, hover: false });
    world.createEntity('bad'); world.addComponent('bad', { type: 'RenderBinding3D', bindings: [{ target: '__proto__.x' }] } as unknown as Component);
    expect(controller.sync(world, 1).world).toBe(world); expect(controller.sync(world, 2).world).toBe(world); expect(warn).toHaveBeenCalledTimes(1); controller.clear();
  });
});

describe('RenderBinding3D signal observation and simulation isolation', () => {
  const signal: RenderBinding = { target: 'Light3D.intensity', source: { kind: 'signal', on: 'on', off: 'off', arg: 'self' }, range: [0, 20], transition: { duration: 1 } };
  it('does not replay an initial Signal, catches publish/remove/consume, uses last matching decision and does not restart on repeated renders', () => {
    const { world, controller } = fixture([signal]); publish(world, 'on', 'lamp'); expect(value(controller, world, 0)).toBe(0);
    publish(world, 'on', 'other'); expect(value(controller, world, 1)).toBe(0);
    publish(world, 'on', 'lamp'); world.removeComponent('vars', 'Signal'); value(controller, world, 10);
    for (let i = 1; i <= 144; i++) expect(value(controller, world, 10 + i * 1000 / 144)).toBeCloseTo(20 * i / 144);
    publish(world, 'off', 'lamp'); publish(world, 'on', 'lamp'); publish(world, 'off', 'lamp'); value(controller, world, 1010);
    expect(value(controller, world, 1510)).toBe(10); expect(world.query('Signal')).toHaveLength(1); controller.clear();
  });
  it('resets on restore, changed configurations, deletion/recreation and world switch; equivalent replacement preserves state', () => {
    const { world, controller } = fixture([signal]); value(controller, world, 0); publish(world, 'on', 'lamp'); value(controller, world, 1);
    world.addComponent('lamp', { type: 'RenderBinding3D', bindings: structuredClone([signal]) }); expect(value(controller, world, 501)).toBe(10);
    const saved = world.snapshot(); world.restore(saved); expect(value(controller, world, 502)).toBe(0);
    publish(world, 'on', 'lamp'); world.removeComponent('lamp', 'RenderBinding3D'); world.addComponent('lamp', { type: 'RenderBinding3D', bindings: [signal] }); expect(value(controller, world, 503)).toBe(0);
    publish(world, 'on', 'lamp'); world.destroyEntity('lamp'); world.restore(saved); expect(value(controller, world, 504)).toBe(0);
    const other = fixture([signal]).world; publish(other, 'on', 'lamp'); expect(value(controller, other, 505)).toBe(0); controller.clear();
  });
  it('captures real Timeline catch-up while Recorder remains attached', () => {
    const { world, controller } = fixture([{ ...signal, source: { kind: 'signal', on: 'on', off: 'off' }, transition: { duration: 0 } }]);
    timelineCapability.systems.forEach(system => world.addSystem(system));
    world.createEntity('timeline'); world.addComponent('timeline', { type: 'Timeline', id: 'scene', playOnSignal: 'start', skipOnSignal: 'skip', cues: [{ at: 0, do: { kind: 'signal', signal: 'on' } }, { at: 30, do: { kind: 'signal', signal: 'off' } }] });
    value(controller, world, 0); const recorder = new Recorder(world); publish(world, 'start');
    recorder.tick(); world.removeComponent('vars', 'Signal'); for (let i = 0; i < 3; i++) recorder.tick();
    expect(world.query('Signal')).toEqual([]); expect(value(controller, world, 10)).toBe(20);
    publish(world, 'skip'); recorder.tick(); world.removeComponent('vars', 'Signal'); recorder.tick();
    expect(value(controller, world, 20)).toBe(0); expect(recorder.recording.frames.length).toBe(6); recorder.detach(); controller.clear();
  });
  it('captures dynamic installation before a publication, resets changed content and diagnoses unsupported signal worlds', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {}), { world, controller } = fixture([{ ...signal, transition: { duration: 0 } }]);
    world.removeComponent('lamp', 'RenderBinding3D'); controller.sync(world, 0);
    world.addComponent('lamp', { type: 'RenderBinding3D', bindings: [{ ...signal, transition: { duration: 0 } }] }); publish(world, 'on', 'lamp');
    expect(value(controller, world, 1)).toBe(20);
    world.addComponent('lamp', { type: 'RenderBinding3D', bindings: [{ ...signal, range: [0, 40], transition: { duration: 0 } }] }); expect(value(controller, world, 2)).toBe(0);
    publish(world, 'on', 'lamp'); expect(value(controller, world, 3)).toBe(40);
    const custom = { ...world.readView(), root: undefined }; expect(controller.sync(custom, 4).world.getComponent<Light3D>('lamp', 'Light3D')!.intensity).toBe(9);
    expect(controller.sync(custom, 5).signature).toBe(''); expect(warn).toHaveBeenCalledOnce(); controller.clear();
  });
  it('keeps snapshots/full and incremental hashes/write sequence/dirty stable across different render rates and frees observers', () => {
    const { world, controller } = fixture([resource, { target: 'Glow3D.opacity', source: { kind: 'hover' }, range: [0, 1] }]);
    value(controller, world, 0); world.drainDirty(); const before = JSON.stringify(world.snapshot()), hash = hashWorld(world), seq = world.writeSequence;
    for (let i = 0; i < 1200; i++) {
      controller.sync(i % 2 ? world : world.readView(), i * 1000 / (i % 2 ? 144 : 60), i % 3 ? 'lamp' : null);
      expect(hashWorld(world)).toBe(hash); expect(hashSnapshot(world.snapshot())).toBe(hash); expect(world.writeSequence).toBe(seq); expect(world.drainDirty()).toEqual([]);
    }
    expect(JSON.stringify(world.snapshot())).toBe(before); controller.clear(); expect((world as unknown as { componentObservers?: unknown }).componentObservers).toBeUndefined();
    world.removeComponent('lamp', 'RenderBinding3D'); expect(hashWorld(world)).toBe(hash);
    world.addComponent('vars', { type: 'Flag', id: 'lit', active: true }); expect(hashWorld(world)).not.toBe(hash);
  });
});
