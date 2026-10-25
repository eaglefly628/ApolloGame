import { registerEngineHost, type EngineHost } from '../../runtime/host-lifecycle.js';
import type { Engine, FrameService } from '../../runtime/engine.js';
import type { Command } from '@net/commands.js';
import type { Controllable } from '@engine/protocol/components.js';
import { TouchInputSource, type TouchInputConfig } from '@net/host/touch-input.js';
import { SaveSystem } from '../storage/save-system.js';
import { LocalStorageStoragePort } from '../storage/local-storage.js';
import { IndexedDbStoragePort } from '../storage/indexeddb-storage.js';
import { IndexedDbKV, indexedDbAvailable } from '../storage/indexeddb-kv.js';
import type { StoragePort, SaveGame } from '../storage/storage-port.js';
import { CorruptSaveError } from '../save/envelope.js';
import { SynthAudioPort, type SfxSpec } from '../audio/synth-audio.js';
import { AudioSync } from '../audio/audio-sync.js';
import { claimMobileAudio, completeMobileAudioResume, connectMobileAudio, releaseMobileAudio, type MobileAudioLifecycle } from './audio-lifecycle.js';

export interface MobileRuntimeConfig {
  touch?: TouchInputConfig;
  save?: { slot: string; intervalMs?: number };
  /** Wires only declarative Sound components; custom project music must retain its own adapter. */
  audio?: { specs: Record<string, SfxSpec> };
}
export interface MobileEnvironmentOptions {
  /** Explicit game surface; the host temporarily disables native pan gestures only here. */
  touchTarget?: HTMLElement;
  storage?: StoragePort;
  onError?: (error: Error) => void;
  audioFactory?: (specs: Record<string, SfxSpec>) => SynthAudioPort;
}
export interface MobileEnvironment {
  readonly errors: readonly Error[];
  /** Resolves once all engines registered so far have loaded; rejects if any initialization failed. */
  settled(): Promise<void>;
  /** Explicitly await this for a confirmed checkpoint. Background/pagehide cannot guarantee completion. */
  flush(): Promise<void>;
  /** Synchronous cancellation. Call flush first when a final durable checkpoint is required. */
  dispose(): void;
}
interface NativeState { active?: boolean; audioInterrupted?: boolean; }
interface EngineState {
  engine: Engine;
  requested: boolean;
  ready: boolean;
  failed: boolean;
  preparation: Promise<void>;
  touch?: TouchInputSource;
  timer?: ReturnType<typeof setInterval>;
  audio?: SynthAudioPort;
  audioSync?: AudioSync;
  audioReady: boolean;
  detachAudio?: () => void;
  saveQueued: boolean;
  lastSave?: Promise<void>;
}

/** Existing browser port + strict read policy. Never reinterpret malformed player data as a new game. */
class StrictLocalStoragePort extends LocalStorageStoragePort {
  override async load(slot: string): Promise<SaveGame | null> {
    const raw = localStorage.getItem(`apollo-save:${slot}`);
    if (raw !== null) {
      try { if (JSON.parse(raw) === null) throw new Error('null save'); } catch { throw new CorruptSaveError(`Corrupt save JSON in slot "${slot}"`); }
    }
    return super.load(slot);
  }
}
class StrictIndexedDbStoragePort extends IndexedDbStoragePort {
  constructor(private readonly mobileKV = new IndexedDbKV()) { super({ kv: mobileKV }); }
  override async load(slot: string): Promise<SaveGame | null> {
    const data = await super.load(slot);
    if (data === null) {
      const raw = await this.mobileKV.get(`snap:${slot}`);
      const legacy = typeof localStorage === 'undefined' ? null : localStorage.getItem(`apollo-save:${slot}`);
      if (raw !== null || legacy !== null) throw new CorruptSaveError(`Corrupt or unmigrated save in slot "${slot}"`);
    }
    return data;
  }
}
function persistentStorage(): StoragePort {
  if (indexedDbAvailable()) return new StrictIndexedDbStoragePort();
  if (typeof localStorage !== 'undefined') return new StrictLocalStoragePort();
  throw new Error('Persistent save storage is unavailable; refusing a volatile save fallback');
}
function checkedStorage(port: StoragePort): StoragePort {
  return {
    save: (slot, data) => port.save(slot, data), list: () => port.list(), delete: (slot) => port.delete(slot),
    async load(slot) {
      const data = await port.load(slot);
      if (data === null) return null;
      // SaveSystem verifies the exact snapshot/order hash before restore. Validate the envelope before it touches either.
      if (!data || typeof data !== 'object' || !data.meta || data.meta.slot !== slot || typeof data.meta.hash !== 'string'
        || !Number.isFinite(data.meta.tick) || !Number.isFinite(data.meta.timestamp)
        || !data.snapshot || typeof data.snapshot !== 'object' || Array.isArray(data.snapshot)
        || (data.order !== undefined && (!Array.isArray(data.order) || data.order.some((id) => typeof id !== 'string')))) {
        throw new CorruptSaveError(`Corrupt save structure in slot "${slot}"`);
      }
      for (const components of Object.values(data.snapshot)) {
        if (!components || typeof components !== 'object' || Array.isArray(components)) throw new CorruptSaveError(`Corrupt entity in slot "${slot}"`);
        for (const [type, component] of Object.entries(components)) {
          if (!component || typeof component !== 'object' || Array.isArray(component) || component.type !== type) {
            throw new CorruptSaveError(`Corrupt component in slot "${slot}"`);
          }
        }
      }
      return data;
    },
  };
}
export function mergeMobileCommands(original: Command[], extra: Command[]): Command[] {
  if (!extra.length) return original;
  const all = new Map<string, Command>();
  for (const c of [...original, ...extra]) {
    const old = all.get(c.playerId);
    if (!old) { all.set(c.playerId, c); continue; }
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    all.set(c.playerId, { playerId: c.playerId, tick: c.tick,
      move: { dx: clamp(old.move.dx + c.move.dx), dy: clamp(old.move.dy + c.move.dy) },
      ...(old.jump || c.jump ? { jump: true } : {}),
      ...((old.actions?.length || c.actions?.length) ? { actions: [...(old.actions ?? []), ...(c.actions ?? [])] } : {}),
    });
  }
  return [...all.values()];
}

/** Install before mounting a project. Existing synchronous mounts remain valid; first start waits for load. */
export function mountMobileEnvironment(config: MobileRuntimeConfig = {}, options: MobileEnvironmentOptions = {}): MobileEnvironment {
  if (typeof window === 'undefined' || typeof document === 'undefined') throw new Error('Mobile environment requires a browser host');
  if (config.save && (!config.save.slot.trim() || !Number.isFinite(config.save.intervalMs ?? 15000) || (config.save.intervalMs ?? 15000) <= 0)) {
    throw new Error('save requires a versioned slot and positive intervalMs');
  }
  const initial = (window as unknown as { __APOLLO_NATIVE_STATE__?: NativeState }).__APOLLO_NATIVE_STATE__;
  let nativeActive = initial?.active !== false;
  let audioInterrupted = initial?.audioInterrupted === true;
  let pageHidden = false;
  let disposed = false;
  let gestureSeen = false;
  let saveOwner: Engine | undefined;
  let saves: SaveSystem | undefined;
  const pendingLoads = new AbortController();
  let tail: Promise<void> = Promise.resolve();
  const errors: Error[] = [];
  const states = new Map<Engine, EngineState>();
  const externalAudio = new Set<MobileAudioLifecycle>();
  const audioOwnerEpoch = {};
  const removals: Array<() => void> = [];
  const active = () => nativeActive && !pageHidden && document.visibilityState !== 'hidden';
  const report = (reason: unknown): Error => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    if (disposed) return error; // A disposed host must never fail a replacement via the shared error event.
    errors.push(error);
    console.error('[mobile] reject:', error);
    window.dispatchEvent(new CustomEvent('apollo:mobile-error', { detail: { error } }));
    options.onError?.(error);
    return error;
  };
  const save = (state: EngineState): Promise<void> => {
    if (!config.save || !state.ready || state.failed || disposed) return Promise.resolve();
    if (state.saveQueued) return state.lastSave!;
    state.saveQueued = true;
    const job = tail.then(async () => {
      state.saveQueued = false;
      if (!disposed && !state.failed) await saves!.save(config.save!.slot, state.engine.world);
    });
    // Maintain a recovered queue so one I/O failure cannot permanently poison subsequent checkpoints.
    tail = job.catch((error: unknown) => { report(error); });
    state.lastSave = job;
    return job;
  };
  const syncAudio = (state: EngineState): void => {
    if (!disposed && state.ready && state.audioReady && state.requested && active() && !audioInterrupted) state.audioSync?.sync(state.engine.world.readView());
  };
  const unlock = (state: EngineState): void => {
    if (!state.audio || disposed || !gestureSeen || !active() || audioInterrupted || !state.requested) return;
    // resume() is invoked synchronously inside the gesture callback, before its promise is awaited.
    void state.audio.resume().then(() => {
      if (disposed || !state.requested || !active() || audioInterrupted) {
        void state.audio?.suspend().catch(report); return;
      }
      state.audioReady = true;
      syncAudio(state);
    }).catch((error: unknown) => { state.audioReady = false; report(error); });
  };
  const suspendAudio = (state: EngineState): void => {
    state.audioReady = false;
    state.audioSync?.reset();
    if (state.audio) void state.audio.suspend().catch(report);
  };
  const updateExternalAudio = (port: MobileAudioLifecycle): void => {
    try {
      const shouldResume = !disposed && active() && !audioInterrupted && gestureSeen;
      const result = shouldResume ? port.resume() : port.suspend();
      void Promise.resolve(result).then(() => {
        if (shouldResume && !completeMobileAudioResume(port, audioOwnerEpoch)) return;
        // A late asynchronous unlock must not revive audio after background/disposal.
        if (shouldResume && (disposed || !active() || audioInterrupted || !externalAudio.has(port))) {
          try { void Promise.resolve(port.suspend()).catch(report); } catch (error) { report(error); }
        }
      }).catch(report);
    } catch (error) { report(error); }
  };
  const reconcile = (): void => {
    for (const port of externalAudio) updateExternalAudio(port);
    for (const state of states.values()) {
      if (!active()) {
        state.touch?.reset();
        state.engine.pauseForHost();
        suspendAudio(state);
        void save(state).catch(() => { /* reported by queue */ });
      } else {
        if (state.requested && state.ready && !state.failed) state.engine.start();
        if (audioInterrupted) suspendAudio(state); else unlock(state);
      }
    }
    if (!active()) window.dispatchEvent(new Event('blur')); // Existing keyboard sources release held keys too.
  };
  const prepare = async (state: EngineState): Promise<void> => {
    if (config.audio) {
      state.audio = options.audioFactory?.(config.audio.specs) ?? new SynthAudioPort(config.audio.specs);
      state.audioSync = new AudioSync(state.audio);
      const service: FrameService = { sync: () => syncAudio(state) };
      state.detachAudio = state.engine.attachService(service);
    }
    if (config.save) {
      if (saveOwner && saveOwner !== state.engine) throw new Error(`Save slot "${config.save.slot}" is already claimed by another engine`);
      saveOwner = state.engine;
      saves ??= new SaveSystem(checkedStorage(options.storage ?? persistentStorage()));
      await saves.load(config.save.slot, state.engine.world, { signal: pendingLoads.signal });
    }
    if (disposed) return;
    if (config.touch) {
      const player = state.engine.world.query('Controllable').map(([id]) => state.engine.world.getComponent<Controllable>(id, 'Controllable')?.playerId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0).sort()[0];
      // A touch declaration with no controllable entity is invalid, rather than a successful but inert product.
      if (!player) throw new Error('Touch drag requires a Controllable player');
      if ([...states.values()].some((other) => other !== state && other.touch)) throw new Error('Touch surface is already claimed by another engine');
      state.touch = new TouchInputSource(player, options.touchTarget ?? document.documentElement, config.touch, window);
    }
    state.ready = true;
    if (config.save) state.timer = setInterval(() => {
      if (state.requested && active()) void save(state).catch(() => { /* reported by queue */ });
    }, config.save.intervalMs ?? 15000);
    if (state.requested && active()) state.engine.start();
    unlock(state);
  };
  const host: EngineHost = {
    beforeStart(engine) {
      if (disposed) return true;
      let state = states.get(engine);
      if (!state) {
        state = { engine, requested: true, ready: false, failed: false, preparation: Promise.resolve(), audioReady: false, saveQueued: false };
        states.set(engine, state);
        state.preparation = prepare(state).catch((error: unknown) => {
          if (disposed) return;
          state!.failed = true; state!.touch?.dispose(); state!.detachAudio?.(); suspendAudio(state!); report(error); throw error;
        });
        // start remains void; retain rejection for settled() while preventing an unhandled rejection.
        void state.preparation.catch(() => {});
        return false;
      }
      state.requested = true;
      return state.ready && !state.failed && active();
    },
    stopped(engine) {
      const state = states.get(engine);
      if (!state) return;
      state.requested = false;
      state.touch?.reset();
      suspendAudio(state);
    },
    commandsForTick(engine, tick, original) {
      const state = states.get(engine);
      return state?.touch ? mergeMobileCommands(original ?? [], state.touch.commandsForTick(tick)) : original;
    },
  };
  const unregister = registerEngineHost(host); // Guard before installing any DOM listeners.
  const disconnectAudio = connectMobileAudio(
    (port) => {
      externalAudio.add(port);
      claimMobileAudio(port, audioOwnerEpoch, () => {
        if (disposed || !active() || audioInterrupted || !gestureSeen) updateExternalAudio(port);
      });
      updateExternalAudio(port);
    },
    (port) => { externalAudio.delete(port); releaseMobileAudio(port, audioOwnerEpoch); },
  );
  const listen = (target: EventTarget, name: string, callback: EventListener): void => {
    target.addEventListener(name, callback); removals.push(() => target.removeEventListener(name, callback));
  };
  listen(window, 'apollo:app-state', ((e: CustomEvent<NativeState>) => {
    if (typeof e.detail?.active !== 'boolean') return;
    nativeActive = e.detail.active; reconcile();
  }) as EventListener);
  listen(window, 'apollo:audio-state', ((e: CustomEvent<{ interrupted: boolean }>) => {
    if (typeof e.detail?.interrupted !== 'boolean') return;
    audioInterrupted = e.detail.interrupted; reconcile();
  }) as EventListener);
  listen(document, 'visibilitychange', reconcile);
  listen(window, 'pagehide', () => { pageHidden = true; reconcile(); });
  listen(window, 'pageshow', () => { pageHidden = false; reconcile(); });
  listen(window, 'blur', () => { for (const state of states.values()) state.touch?.reset(); });
  const gesture = (): void => { gestureSeen = true; for (const port of externalAudio) updateExternalAudio(port); for (const state of states.values()) unlock(state); };
  listen(window, 'pointerdown', gesture);
  listen(window, 'keydown', gesture);
  return {
    errors,
    async settled() {
      await Promise.all([...states.values()].map((state) => state.preparation));
      if (errors.length) throw errors[0];
    },
    async flush() {
      await Promise.all([...states.values()].map((state) => state.preparation));
      await Promise.all([...states.values()].map(save));
    },
    dispose() {
      if (disposed) return;
      disposed = true; pendingLoads.abort(); unregister(); disconnectAudio();
      for (const port of externalAudio) { updateExternalAudio(port); releaseMobileAudio(port, audioOwnerEpoch); }
      externalAudio.clear();
      for (const remove of removals.splice(0)) remove();
      for (const state of states.values()) {
        state.requested = false;
        state.engine.pauseForHost(); state.touch?.dispose();
        if (state.timer) clearInterval(state.timer);
        state.detachAudio?.(); suspendAudio(state);
      }
      states.clear();
    },
  };
}

export { mountMobileBlueprint } from './blueprint.js';
export { registerMobileAudio, type MobileAudioLifecycle } from './audio-lifecycle.js';
