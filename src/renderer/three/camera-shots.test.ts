import { afterEach, describe, expect, it, vi } from 'vitest';
import { World } from '@engine/core/world.js';
import type { Component, IWorld } from '@engine/core/types.js';
import type { CameraShot3D } from '@engine/protocol/components/camera-shot.js';
import { timelineCapability } from '@skills/tier3/timeline.js';
import { Recorder } from '../../debug/recorder.js';
import { CameraShots } from './camera-shots.js';

function config(offset = 0, duration = 1): CameraShot3D {
  return { type: 'CameraShot3D', shots: {
    intro: { keyframes: [{ at: 0, eye: [1 + offset, 2, 3], target: [0, 0, 0] }, { at: duration, eye: [11 + offset, 2, 3], target: [0, 0, 0] }] },
    close: { keyframes: [{ at: 0, eye: [21 + offset, 2, 3], target: [0, 0, 0] }] },
  }, onSignal: [{ signal: 'play', shot: 'intro' }, { signal: 'close', shot: 'close' }] };
}
function world(table: CameraShot3D | null = config()): World {
  const w = new World(); w.createEntity('camera'); w.addComponent('camera', { type: 'Camera3D', yaw: 0, pitch: .5 });
  if (table) w.addComponent('camera', table);
  w.createEntity('source'); return w;
}
function publish(w: World, name = 'play'): void { w.addComponent('source', { type: 'Signal', name, source: 'source', arg: 'same' }); }
afterEach(() => vi.restoreAllMocks());

describe('CameraShots presentation controller', () => {
  it('has no autoplay or initial Signal replay; cuts, samples, holds and has a stable final signature', () => {
    const w = world(), shots = new CameraShots(); publish(w);
    expect(shots.sync(w, 0)).toEqual({ signature: '', active: false });
    publish(w); expect(shots.sync(w.readView(), 10).frame?.eye).toEqual([1, 2, 3]);
    expect(shots.sync(w, 510).frame?.eye).toEqual([6, 2, 3]);
    const last = shots.sync(w, 1010); expect(last.frame?.eye).toEqual([11, 2, 3]); expect(last.active).toBe(false);
    expect(shots.sync(w, 10_000)).toEqual(last); shots.clear();
  });
  it.each([['linear', 3.5], ['cubicOut', 6.78125], ['inOut', 2.5625]] as const)('uses existing %s segment easing for both eye and target', (ease, x) => {
    const table = config(); const raw = structuredClone(table) as unknown as { shots: { intro: { keyframes: { ease?: string; target: number[] }[] } } };
    raw.shots.intro.keyframes[0]!.ease = ease; raw.shots.intro.keyframes[1]!.target = [4, 0, 0];
    const w = world(raw as unknown as CameraShot3D), shots = new CameraShots(); shots.sync(w, 0); publish(w); shots.sync(w, 100);
    const result = shots.sync(w, 350); expect(result.frame!.eye[0]).toBeCloseTo(x);
    expect(result.frame!.target[0]).toBeCloseTo((x - 1) / 10 * 4); shots.clear();
  });
  it('distinguishes actual identical publications and does not replay at 144Hz without a new notice', () => {
    const w = world(), shots = new CameraShots(); shots.sync(w, 0); publish(w); shots.sync(w, 0);
    for (let i = 1; i <= 144; i++) expect(shots.sync(i % 2 ? w : w.readView(), i * 1000 / 144).frame!.eye[0]).toBeCloseTo(1 + 10 * i / 144);
    const held = shots.sync(w, 1001); publish(w);
    const replay = shots.sync(w, 1001); expect(replay.frame!.eye[0]).toBe(1); expect(replay.signature).not.toBe(held.signature); shots.clear();
  });
  it('reduces pending decisions to the last matching publication with one diagnostic and interrupts an active shot', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {}), w = world(), shots = new CameraShots(); shots.sync(w, 0);
    publish(w); publish(w, 'ignored'); publish(w, 'close');
    expect(shots.sync(w, 100).frame!.eye[0]).toBe(21);
    publish(w); shots.sync(w, 200); expect(shots.sync(w, 700).frame!.eye[0]).toBe(6);
    publish(w); publish(w, 'close'); expect(shots.sync(w, 800).frame!.eye[0]).toBe(21);
    expect(warn).toHaveBeenCalledTimes(1); shots.clear();
  });
  it('selects the original first Camera3D, captures dynamic table installation before the next render and ignores other tables', () => {
    const w = world(null), shots = new CameraShots();
    w.createEntity('second'); w.addComponent('second', { type: 'Camera3D', yaw: 0, pitch: 0 }); w.addComponent('second', config(100));
    shots.sync(w, 0); publish(w); expect(shots.sync(w, 10).frame).toBeUndefined();
    w.addComponent('camera', config()); publish(w); expect(shots.sync(w, 20).frame!.eye[0]).toBe(1);
    w.removeComponent('camera', 'Camera3D'); publish(w); expect(shots.sync(w, 30).frame!.eye[0]).toBe(101);
    const snapshot = w.snapshot(); snapshot.camera!.Camera3D = null as unknown as Component; w.restore(snapshot);
    publish(w); expect(shots.sync(w, 40).frame!.eye[0]).toBe(101); shots.clear();
  });
  it('preserves playback and pending on content-equivalent replacements, including object key ordering and optional raw type', () => {
    const w = world(), shots = new CameraShots(); shots.sync(w, 0); publish(w); shots.sync(w, 10);
    const old = config(), reordered = { onSignal: old.onSignal, shots: { close: old.shots.close, intro: old.shots.intro } };
    w.addComponent('camera', { type: 'CameraShot3D', ...reordered }); expect(shots.sync(w, 510).frame!.eye[0]).toBe(6);
    publish(w); w.addComponent('camera', structuredClone(config())); expect(shots.sync(w, 600).frame!.eye[0]).toBe(1); shots.clear();
  });
  it('invalidates old decisions on changed data, deletion, camera removal and same-id recreation', () => {
    const w = world(), shots = new CameraShots(); shots.sync(w, 0); publish(w); w.addComponent('camera', config(100));
    expect(shots.sync(w, 0).frame).toBeUndefined(); publish(w); expect(shots.sync(w, 0).frame!.eye[0]).toBe(101);
    w.removeComponent('camera', 'CameraShot3D'); w.addComponent('camera', config()); expect(shots.sync(w, 100).frame).toBeUndefined();
    publish(w); w.removeComponent('camera', 'Camera3D'); w.addComponent('camera', { type: 'Camera3D', yaw: 0, pitch: .5 }); expect(shots.sync(w, 200).frame).toBeUndefined();
    publish(w); w.destroyEntity('camera'); w.createEntity('camera'); w.addComponent('camera', { type: 'Camera3D', yaw: 0, pitch: .5 }); w.addComponent('camera', config());
    expect(shots.sync(w, 300).frame).toBeUndefined(); publish(w); expect(shots.sync(w, 300).frame!.eye[0]).toBe(1); shots.clear();
  });
  it('clears active/pending on restore and World switch without replaying restored Signal baseline', () => {
    const a = world(), b = world(config(100)), shots = new CameraShots(); shots.sync(a, 0); publish(a); const snapshot = a.snapshot();
    shots.sync(a, 0); expect(shots.sync(a, 500).frame!.eye[0]).toBe(6);
    a.restore(snapshot); expect(shots.sync(a, 501).frame).toBeUndefined(); publish(a); a.restore(snapshot); expect(shots.sync(a, 502).frame).toBeUndefined();
    publish(a); publish(b); expect(shots.sync(b, 503).frame).toBeUndefined(); publish(b); expect(shots.sync(b, 503).frame!.eye[0]).toBe(101); shots.clear();
  });
  it('holds last valid view through a coincident sample, warns once and recovers', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {}), table: CameraShot3D = {
      type: 'CameraShot3D', shots: { crossing: { keyframes: [{ at: 0, eye: [1, 0, 0], target: [-1, 0, 0] }, { at: 1, eye: [-1, 0, 0], target: [1, 0, 0] }] } }, onSignal: [{ signal: 'play', shot: 'crossing' }],
    };
    const w = world(table), shots = new CameraShots(); shots.sync(w, 0); publish(w); shots.sync(w, 0);
    const valid = shots.sync(w, 250); expect(shots.sync(w, 500).frame).toEqual(valid.frame); expect(shots.sync(w, 500).active).toBe(true);
    expect(shots.sync(w, 750).frame!.eye[0]).toBe(-.5); expect(warn).toHaveBeenCalledTimes(1); shots.clear();
  });
  it('warns once and falls back for unsupported worlds or invalid direct-world configuration', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {}), w = world(), shots = new CameraShots();
    const custom = { ...w.readView(), root: undefined } as IWorld;
    expect(shots.sync(custom, 0).frame).toBeUndefined(); expect(shots.sync(custom, 1).frame).toBeUndefined(); expect(warn).toHaveBeenCalledTimes(1);
    w.addComponent('camera', { type: 'CameraShot3D', shots: null } as unknown as Component);
    expect(shots.sync(w, 0).frame).toBeUndefined(); publish(w); expect(shots.sync(w, 1).frame).toBeUndefined(); expect(warn).toHaveBeenCalledTimes(2); shots.clear();
  });
  it('rejects an invalid raw carrier during playback and recovers only after a new publication', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {}), w = world(), shots = new CameraShots(); shots.sync(w, 0); publish(w); shots.sync(w, 0);
    w.addComponent('camera', { type: 'Camera3D', yaw: NaN, pitch: .5 }); expect(shots.sync(w, 500).frame).toBeUndefined(); publish(w);
    w.addComponent('camera', { type: 'Camera3D', yaw: 0, pitch: .5 }); expect(shots.sync(w, 501).frame).toBeUndefined();
    publish(w); expect(shots.sync(w, 502).frame!.eye[0]).toBe(1); expect(warn).toHaveBeenCalledTimes(1); shots.clear();
  });
  it('captures instant add/remove/destroy/consumes without occupying Recorder observer and releases listeners', () => {
    const w = world(), shots = new CameraShots(), detached = vi.fn(), observe = w.observeComponents.bind(w);
    vi.spyOn(w, 'observeComponents').mockImplementation((types, listener) => { const cancel = observe(types, listener); return () => { detached(); cancel(); }; });
    shots.sync(w, 0); const recording = new Recorder(w);
    w.addSystem({ id: 'instant', reads: [], writes: ['Signal'], consumes: ['Signal'], execute(view) {
      view.addComponent('source', { type: 'Signal', name: 'play', source: 'source' });
      view.removeComponent('source', 'Signal'); view.addComponent('source', { type: 'Signal', name: 'play', source: 'source' });
      view.createEntity('ephemeral'); view.addComponent('ephemeral', { type: 'Signal', name: 'close', source: 'source' }); view.destroyEntity('ephemeral');
    } });
    vi.spyOn(console, 'warn').mockImplementation(() => {}); recording.tick(); expect(w.query('Signal')).toEqual([]);
    expect(shots.sync(w, 100).frame!.eye[0]).toBe(21); expect(recording.recording.frames[0]!.systemTraces[0]!.systemId).toBe('instant');
    recording.detach(); publish(w); expect(shots.sync(w, 200).frame!.eye[0]).toBe(1);
    shots.clear(); expect(detached).toHaveBeenCalledTimes(1); publish(w, 'close'); expect(shots.sync(w, 300).frame).toBeUndefined(); shots.clear(); expect(detached).toHaveBeenCalledTimes(2);
  });
  it('captures real Timeline catch-up and skip even when cue entities vanish before rendering', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const w = world(), shots = new CameraShots();
    for (const system of timelineCapability.systems) w.addSystem(system);
    w.createEntity('timeline'); w.addComponent('timeline', { type: 'Timeline', id: 'intro', playOnSignal: 'start', skipOnSignal: 'skip', cues: [
      { at: 0, do: { kind: 'signal', signal: 'play' } }, { at: 20, do: { kind: 'signal', signal: 'play' } }, { at: 40, do: { kind: 'signal', signal: 'close' } },
    ] });
    shots.sync(w, 0); publish(w, 'start'); w.tick(); w.removeComponent('source', 'Signal');
    for (let i = 0; i < 4; i++) w.tick();
    expect(w.query('Signal')).toEqual([]); expect(shots.sync(w, 100).frame!.eye[0]).toBe(1);
    publish(w, 'skip'); w.tick(); w.removeComponent('source', 'Signal'); w.tick();
    expect(w.query('Signal')).toEqual([]); expect(shots.sync(w, 200).frame!.eye[0]).toBe(21); shots.clear();
  });
});
