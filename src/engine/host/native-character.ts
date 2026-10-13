// Native 2D character bridge. Presentation only: no World, sim, snapshot or hash.
// The native renderer stays in an isolated frame; the host controls it with data.
import type { AssetIndex } from '../../assets/asset-index.js';

export const NATIVE_CHARACTER_CHANNEL = 'apollo-native-character-v1';
export type NativeCharacterCommand =
  | { type: 'load'; bytes: ArrayBuffer }
  | { type: 'play'; clipId: string; loop?: boolean; speed?: number }
  | { type: 'pause' }
  | { type: 'seek'; timeMs: number }
  | { type: 'parameters'; values: Readonly<Record<string, number>> }
  | { type: 'status' }
  | { type: 'capture' };

export interface NativeCharacterStatus {
  clips: readonly { id: string; name: string; duration: number }[];
  parameters: readonly { id: string; name?: string; min: number; max: number; default?: number }[];
  clipId: string | null;
  timeMs: number;
  playing: boolean;
}

/** Same local AssetIndex route as textures; the bundle retains native PNG layers. */
export function nativeCharacterAssetUrl(index: AssetIndex, key: string, baseUrl: string): string {
  const entry = index.assets.find(a => a.id === key);
  if (!entry || entry.status !== 'filled' || entry.type !== 'animation' || entry.spec?.format !== 'stretch' || !entry.path) {
    throw new Error(`native-character: unavailable animation asset ${key}`);
  }
  return new URL(entry.path, baseUrl).href;
}

export interface NativeCharacterPort {
  readonly frame: HTMLIFrameElement;
  readonly ready: Promise<void>;
  command<T = NativeCharacterStatus>(command: NativeCharacterCommand): Promise<T>;
  loadAsset(index: AssetIndex, key: string, baseUrl: string): Promise<NativeCharacterStatus>;
  destroy(): void;
}

/** Mount on the engine host's scene. Editor URL must be our own built runtime. */
export function mountNativeCharacter(container: HTMLElement, options: {
  runtimeUrl: string;
  timeoutMs?: number;
  onTrace?: (kind: 'decision' | 'reject' | 'commit', detail: string) => void;
}): NativeCharacterPort {
  const url = new URL(options.runtimeUrl, window.location.href);
  if (url.origin !== window.location.origin) throw new Error('native-character: runtime must use the host origin');
  url.searchParams.set('mode', 'player');
  const frame = document.createElement('iframe');
  frame.title = '二维角色动画';
  frame.allow = 'autoplay';
  frame.src = url.href;
  frame.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;background:transparent;pointer-events:none';
  const timeoutMs = options.timeoutMs ?? 30_000;
  let destroyed = false;
  let readySettled = false;
  let nextId = 0;
  let resolveReady!: () => void;
  let rejectReady!: (reason: Error) => void;
  const pending = new Map<number, { resolve: (value: unknown) => void; reject: (reason: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  const ready = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  // A caller may destroy before awaiting ready; still retain rejection for awaiters.
  void ready.catch(() => {});
  const readyTimer = setTimeout(() => {
    readySettled = true;
    options.onTrace?.('reject', 'native renderer readiness timed out');
    rejectReady(new Error('native-character: renderer readiness timed out'));
  }, timeoutMs);
  const onMessage = (event: MessageEvent): void => {
    if (destroyed || event.origin !== url.origin || event.source !== frame.contentWindow) return;
    const data = event.data;
    if (!data || data.channel !== NATIVE_CHARACTER_CHANNEL) return;
    if (data.type === 'ready' && !readySettled) {
      readySettled = true;
      clearTimeout(readyTimer);
      options.onTrace?.('commit', 'native renderer ready');
      resolveReady();
      return;
    }
    if (data.type !== 'reply' || !Number.isSafeInteger(data.id)) return;
    const request = pending.get(data.id);
    if (!request) return;
    pending.delete(data.id);
    clearTimeout(request.timer);
    if (data.ok === true) request.resolve(data.value);
    else {
      const reason = typeof data.error === 'string' ? data.error : 'native renderer rejected command';
      options.onTrace?.('reject', reason);
      request.reject(new Error(reason));
    }
  };
  window.addEventListener('message', onMessage);
  container.appendChild(frame);
  const abort = new AbortController();
  async function command<T = NativeCharacterStatus>(value: NativeCharacterCommand): Promise<T> {
    if (destroyed) throw new Error('native-character: destroyed');
    await ready;
    if (destroyed) throw new Error('native-character: destroyed');
    const id = ++nextId;
    options.onTrace?.('decision', `native command ${value.type}`);
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        options.onTrace?.('reject', `native command ${value.type} timed out`);
        reject(new Error(`native-character: ${value.type} timed out`));
      }, timeoutMs);
      pending.set(id, { resolve: result => resolve(result as T), reject, timer });
      try {
        frame.contentWindow!.postMessage({ channel: NATIVE_CHARACTER_CHANNEL, type: 'command', id, command: value }, url.origin);
      } catch (error) {
        clearTimeout(timer);
        pending.delete(id);
        reject(error);
      }
    });
  }
  return {
    frame, ready, command,
    async loadAsset(index, key, baseUrl) {
      if (destroyed) throw new Error('native-character: destroyed');
      const assetUrl = nativeCharacterAssetUrl(index, key, baseUrl);
      const response = await fetch(assetUrl, { signal: abort.signal });
      if (!response.ok) throw new Error(`native-character: asset ${key} HTTP ${response.status}`);
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > 100 * 1024 * 1024) throw new Error('native-character: asset exceeds 100 MiB');
      return command({ type: 'load', bytes });
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      abort.abort();
      window.removeEventListener('message', onMessage);
      clearTimeout(readyTimer);
      if (!readySettled) { readySettled = true; rejectReady(new Error('native-character: destroyed')); }
      for (const request of pending.values()) {
        clearTimeout(request.timer);
        request.reject(new Error('native-character: destroyed'));
      }
      pending.clear();
      frame.remove();
    },
  };
}
