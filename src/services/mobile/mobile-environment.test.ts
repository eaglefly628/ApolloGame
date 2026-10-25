// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Engine } from '../../runtime/engine.js';
import { MemoryStoragePort } from '../storage/memory-storage.js';
import { SaveSystem } from '../storage/save-system.js';
import { mountMobileEnvironment, registerMobileAudio, type MobileEnvironment } from './index.js';
import { IDBFactory } from 'fake-indexeddb';
import { IndexedDbKV } from '../storage/indexeddb-kv.js';
import type { SaveGame } from '../storage/storage-port.js';
import type { Velocity } from '@engine/protocol/components.js';
import { SynthAudioPort } from '../audio/synth-audio.js';
import { KeyboardInputSource } from '@net/host/local-input.js';
let environment: MobileEnvironment | undefined;
let nextFrame = 1;
const frames = new Map<number, FrameRequestCallback>();
function native(active: boolean): void { window.dispatchEvent(new CustomEvent('apollo:app-state', { detail: { active } })); }
function engine(): Engine {
  const e = new Engine();
  e.world.createEntity('hero');
  e.world.addComponent('hero', { type: 'Controllable', playerId: 'p', speed: 3 });
  e.world.addComponent('hero', { type: 'Velocity', vx: 0, vy: 0 });
  return e;
}
beforeEach(() => {
  frames.clear(); nextFrame = 1;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { const id = nextFrame++; frames.set(id, cb); return id; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  localStorage.clear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { environment?.dispose(); environment = undefined; vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); delete (window as unknown as Record<string, unknown>).__APOLLO_NATIVE_STATE__; });
describe('mobile environment host lifecycle', () => {
  it('keeps default Engine behavior; opt-in pauses once and never restarts a manually stopped engine', async () => {
    const ordinary = engine(); ordinary.start(); native(false); expect(ordinary.isRunning).toBe(true); ordinary.stop();
    environment = mountMobileEnvironment({});
    const e = engine(); e.start(); await environment.settled(); expect(e.isRunning).toBe(true);
    native(false); expect(e.isRunning).toBe(false); native(false); native(true); expect(e.isRunning).toBe(true);
    native(false); e.stop(); native(true); expect(e.isRunning).toBe(false);
    environment.dispose(); e.start(); expect(e.isRunning).toBe(true); e.stop();
  });
  it('reads initial native state, rejects duplicate installation, and clears input when backgrounded', async () => {
    (window as unknown as Record<string, unknown>).__APOLLO_NATIVE_STATE__ = { active: false, audioInterrupted: false };
    environment = mountMobileEnvironment({ touch: { mode: 'drag' } });
    expect(() => mountMobileEnvironment({})).toThrow(/installed/);
    const e = engine(); e.start(); await environment.settled(); expect(e.isRunning).toBe(false);
    native(true); expect(e.isRunning).toBe(true);
    native(false); e.stop(); native(true); expect(e.isRunning).toBe(false);
  });
  it('loads saved state before first frame and refuses corrupt saves without overwriting them', async () => {
    const port = new MemoryStoragePort();
    const old = engine(); old.world.getComponent<Velocity>('hero', 'Velocity')!.vx = 42;
    await new SaveSystem(port).save('game-v1', old.world);
    environment = mountMobileEnvironment({ save: { slot: 'game-v1' } }, { storage: port });
    const e = engine(); e.start(); expect(e.isRunning).toBe(false); await environment.settled();
    expect(e.world.getComponent<Velocity>('hero', 'Velocity')!.vx).toBe(42); expect(e.isRunning).toBe(true);
    environment.dispose();
    const data = (await port.load('game-v1'))!; data.meta.hash = 'corrupt'; await port.save('game-v1', data);
    environment = mountMobileEnvironment({ save: { slot: 'game-v1' } }, { storage: port });
    const bad = engine(); bad.start(); await expect(environment.settled()).rejects.toThrow(/校验/);
    expect(bad.isRunning).toBe(false); expect(environment.errors).toHaveLength(1);
    await expect(environment.flush()).rejects.toThrow(); expect((await port.load('game-v1'))!.meta.hash).toBe('corrupt');
  });
  it('rejects malformed local JSON and reports storage failure without a memory fallback', async () => {
    localStorage.setItem('apollo-save:game-v1', '{bad');
    environment = mountMobileEnvironment({ save: { slot: 'game-v1' } });
    const e = engine(); e.start(); await expect(environment.settled()).rejects.toThrow(/corrupt/i);
    expect(localStorage.getItem('apollo-save:game-v1')).toBe('{bad');
  });
  it('serializes autosaves and rejects two engines claiming the same slot', async () => {
    vi.useFakeTimers();
    const port = new MemoryStoragePort();
    let release: (() => void) | undefined;
    const write = vi.spyOn(port, 'save').mockImplementationOnce(() => new Promise<void>((r) => { release = r; }));
    environment = mountMobileEnvironment({ save: { slot: 'game-v1', intervalMs: 100 } }, { storage: port });
    const e = engine(); e.start(); await environment.settled();
    vi.advanceTimersByTime(100); await Promise.resolve(); expect(write).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(500); native(false); await Promise.resolve(); expect(write).toHaveBeenCalledTimes(1);
    release!(); await environment.flush(); expect(write.mock.calls.length).toBeGreaterThan(1);
    const other = engine(); other.start(); await expect(environment.settled()).rejects.toThrow(/slot/);
    expect(other.isRunning).toBe(false);
  });
  it('does not restart during delayed load after stop or disposal, and surfaces autosave rejection', async () => {
    const port = new MemoryStoragePort();
    let release!: (value: SaveGame | null) => void;
    vi.spyOn(port, 'load').mockImplementation(() => new Promise((r) => { release = r; }));
    environment = mountMobileEnvironment({ save: { slot: 'game-v1' } }, { storage: port });
    const e = engine(); e.start(); e.stop(); release(null); await environment.settled(); expect(e.isRunning).toBe(false);
    e.start(); expect(e.isRunning).toBe(true);
    vi.spyOn(port, 'save').mockRejectedValue(new Error('disk full'));
    await expect(environment.flush()).rejects.toThrow('disk full'); expect(environment.errors.some((e) => e.message === 'disk full')).toBe(true);
    environment.dispose(); expect(e.isRunning).toBe(false);
  });
  it('keeps an engine without any input free of input entities and preserves keyboard alongside touch', async () => {
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    environment = mountMobileEnvironment({});
    const quiet = engine(); quiet.start(); await environment.settled();
    const frame = (): void => { const [id, callback] = [...frames][0]; frames.delete(id); now += 20; callback(now); };
    frame(); expect(quiet.world.query('InputQueue')).toHaveLength(0);
    environment.dispose();
    const keyboard = new KeyboardInputSource('p', window);
    environment = mountMobileEnvironment({ touch: { mode: 'drag', range: 40, deadZone: 0 } });
    const e = new Engine({ input: keyboard });
    e.world.createEntity('hero');
    e.world.addComponent('hero', { type: 'Controllable', playerId: 'p', speed: 3 });
    e.world.addComponent('hero', { type: 'Velocity', vx: 0, vy: 0 });
    e.start(); await environment.settled();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }));
    document.documentElement.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 0, clientY: 0 }));
    document.documentElement.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, pointerType: 'touch', clientX: 0, clientY: -40 }));
    frame(); expect(e.world.getComponent<Velocity>('hero', 'Velocity')).toMatchObject({ vx: 3, vy: -3 });
    native(false); native(true); frame();
    expect(e.world.getComponent<Velocity>('hero', 'Velocity')).toMatchObject({ vx: 0, vy: 0 });
    keyboard.dispose();
  });
  it('unlocks within a gesture, retries existing Sound, suspends for interruptions, and ignores late resume after disposal', async () => {
    let resolve!: () => void;
    const port = new SynthAudioPort({ ding: { partials: [] } });
    const resume = vi.spyOn(port, 'resume').mockResolvedValue();
    const suspend = vi.spyOn(port, 'suspend').mockResolvedValue();
    const play = vi.spyOn(port, 'play');
    environment = mountMobileEnvironment({ audio: { specs: { ding: { partials: [] } } } }, { audioFactory: () => port });
    const e = engine(); e.world.addComponent('hero', { type: 'Sound', clipId: 'ding', volume: 1, loop: false });
    e.start(); await environment.settled(); expect(play).not.toHaveBeenCalled();
    window.dispatchEvent(new Event('pointerdown')); expect(resume).toHaveBeenCalledTimes(1);
    await Promise.resolve(); expect(play).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new CustomEvent('apollo:audio-state', { detail: { interrupted: true } }));
    expect(suspend).toHaveBeenCalled(); expect(e.isRunning).toBe(true);
    window.dispatchEvent(new Event('pointerdown')); expect(resume).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new CustomEvent('apollo:audio-state', { detail: { interrupted: false } }));
    await Promise.resolve(); expect(play).toHaveBeenCalledTimes(2);
    resume.mockImplementationOnce(() => new Promise<void>((r) => { resolve = r; }));
    window.dispatchEvent(new Event('pointerdown')); environment.dispose(); resolve(); await Promise.resolve();
    expect(play).toHaveBeenCalledTimes(2); expect(e.isRunning).toBe(false);
  });
  it('pagehide and visibility compose with native background state; no restore races past disposal', async () => {
    environment = mountMobileEnvironment({});
    const e = engine(); e.start(); await environment.settled();
    window.dispatchEvent(new Event('pagehide')); native(true); expect(e.isRunning).toBe(false);
    window.dispatchEvent(new Event('pageshow')); expect(e.isRunning).toBe(true);
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange')); expect(e.isRunning).toBe(false);
    native(false);
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange')); expect(e.isRunning).toBe(false);
    native(true); expect(e.isRunning).toBe(true); environment.dispose();
    const port = new MemoryStoragePort();
    let release!: (save: SaveGame | null) => void;
    vi.spyOn(port, 'load').mockImplementation(() => new Promise((r) => { release = r; }));
    environment = mountMobileEnvironment({ save: { slot: 'delayed-v1' } }, { storage: port });
    const late = engine(); late.start(); const settled = environment.settled(); environment.dispose();
    release(null); await settled; native(false); native(true); expect(late.isRunning).toBe(false);
  });

  it('rejects null or structurally broken saves and absent persistent storage without changing the world', async () => {
    localStorage.setItem('apollo-save:null-v1', 'null');
    environment = mountMobileEnvironment({ save: { slot: 'null-v1' } });
    const e = engine(); e.start(); await expect(environment.settled()).rejects.toThrow(/corrupt/i);
    expect(e.world.query('Controllable')).toHaveLength(1); environment.dispose();
    const port = new MemoryStoragePort();
    vi.spyOn(port, 'load').mockResolvedValue({ meta: { slot: 'bad-v1', tick: 0, hash: '', timestamp: 1 }, snapshot: { broken: null } } as unknown as SaveGame);
    environment = mountMobileEnvironment({ save: { slot: 'bad-v1' } }, { storage: port });
    const bad = engine(); bad.start(); await expect(environment.settled()).rejects.toThrow(/corrupt/i);
    expect(bad.world.query('Controllable')).toHaveLength(1); environment.dispose();
    vi.stubGlobal('localStorage', undefined); vi.stubGlobal('indexedDB', undefined);
    environment = mountMobileEnvironment({ save: { slot: 'no-storage-v1' } });
    const none = engine(); none.start(); await expect(environment.settled()).rejects.toThrow(/Persistent save storage is unavailable/);
    expect(none.isRunning).toBe(false);
  });

  it('strictly reads IndexedDB checkpoints and never treats corrupt migrated or local data as an empty slot', async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    environment = mountMobileEnvironment({ save: { slot: 'db-v1' } });
    const e = engine(); e.start(); await environment.settled();
    e.world.getComponent<Velocity>('hero', 'Velocity')!.vx = 27;
    await environment.flush(); environment.dispose();
    environment = mountMobileEnvironment({ save: { slot: 'db-v1' } });
    const restored = engine(); restored.start(); await environment.settled();
    expect(restored.world.getComponent<Velocity>('hero', 'Velocity')!.vx).toBe(27); environment.dispose();
    await new IndexedDbKV().putMany([['snap:db-v1', '{broken']]);
    environment = mountMobileEnvironment({ save: { slot: 'db-v1' } });
    const corrupt = engine(); corrupt.start(); await expect(environment.settled()).rejects.toThrow(/corrupt/i); environment.dispose();
    localStorage.setItem('apollo-save:legacy-v1', '{broken');
    environment = mountMobileEnvironment({ save: { slot: 'legacy-v1' } });
    const legacy = engine(); legacy.start(); await expect(environment.settled()).rejects.toThrow(/corrupt|unmigrated/i);
    expect(localStorage.getItem('apollo-save:legacy-v1')).toBe('{broken');
  });
  it('adopts project audio registered before mount and shares gesture/interruption cleanup without native listeners per game', async () => {
    const port = { resume: vi.fn().mockResolvedValue(undefined), suspend: vi.fn().mockResolvedValue(undefined) };
    const unregister = registerMobileAudio(port);
    try {
      environment = mountMobileEnvironment({}); expect(port.suspend).toHaveBeenCalledTimes(1);
      window.dispatchEvent(new Event('pointerdown')); expect(port.resume).toHaveBeenCalledTimes(1);
      native(false); expect(port.suspend).toHaveBeenCalledTimes(2);
      native(true); expect(port.resume).toHaveBeenCalledTimes(2);
      window.dispatchEvent(new CustomEvent('apollo:audio-state', { detail: { interrupted: true } }));
      expect(port.suspend).toHaveBeenCalledTimes(3);
      environment.dispose(); const count = port.resume.mock.calls.length;
      window.dispatchEvent(new Event('pointerdown')); native(true); expect(port.resume).toHaveBeenCalledTimes(count);
      await Promise.resolve();
    } finally { unregister(); }
  });

  it('unlocks on the first gesture during pending load without consuming pre-load Sound', async () => {
    const storage = new MemoryStoragePort();
    let release!: (value: SaveGame | null) => void;
    vi.spyOn(storage, 'load').mockImplementation(() => new Promise((r) => { release = r; }));
    const port = new SynthAudioPort({ ding: { partials: [] } });
    const resume = vi.spyOn(port, 'resume').mockResolvedValue(); const play = vi.spyOn(port, 'play');
    environment = mountMobileEnvironment({ audio: { specs: { ding: { partials: [] } } }, save: { slot: 'audio-load-v1' } }, { storage, audioFactory: () => port });
    const e = engine(); e.world.addComponent('hero', { type: 'Sound', clipId: 'ding', volume: 1, loop: false });
    e.start(); window.dispatchEvent(new Event('pointerdown')); expect(resume).toHaveBeenCalledTimes(1);
    await Promise.resolve(); expect(play).not.toHaveBeenCalled();
    release(null); await environment.settled(); await Promise.resolve(); expect(play).toHaveBeenCalledTimes(1);
  });

  it('uses a reversible document touch-action lease when the caller omits touchTarget', async () => {
    const root = document.documentElement; const previous = root.style.getPropertyValue('touch-action');
    root.style.setProperty('touch-action', 'pan-x');
    try {
      environment = mountMobileEnvironment({ touch: { mode: 'drag' } }); const e = engine(); e.start(); await environment.settled();
      expect(root.style.getPropertyValue('touch-action')).toBe('none'); environment.dispose();
      expect(root.style.getPropertyValue('touch-action')).toBe('pan-x');
    } finally { if (previous) root.style.setProperty('touch-action', previous); else root.style.removeProperty('touch-action'); }
  });

});
