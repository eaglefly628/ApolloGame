import { mountNativeCharacter, nativeCharacterAssetUrl, nativeCharacterLocalUrl, type NativeCharacterPort, type NativeCharacterStatus } from '../../engine/host/native-character.js';
import type { AssetIndex } from '../../assets/asset-index.js';
import type { LayoutNode, NativeCharacterProps } from './types.js';

/** Host-wide, opt-in configuration. No per-node arbitrary player URL or asset index. */
export interface NativeCharactersOptions {
  index: AssetIndex;
  baseUrl: string;
  runtimeUrl: string;
  /** Deadline for the complete readiness + HTTP load + initial commands (100..60000 ms). */
  timeoutMs?: number;
}

interface Entry {
  el: HTMLElement;
  stage: HTMLElement;
  poster: HTMLElement;
  props: NativeCharacterProps;
  identity: string;
  port?: NativeCharacterPort;
  status?: NativeCharacterStatus;
  applied?: string;
  disposed: boolean;
  busy: boolean;
  timer?: ReturnType<typeof setTimeout>;
}
const requestKey = (p: NativeCharacterProps): string => JSON.stringify([p.clip, p.loop ?? true, p.speed ?? 1, Object.entries(p.parameters ?? {}).sort(([a], [b]) => a.localeCompare(b))]);

/** Centralized native lifecycle. Existing UI without the type does not create any player. */
export function mountNativeCharacters(host: HTMLElement, getRoot: () => LayoutNode, config?: NativeCharactersOptions): { sync(): void; dispose(): void } {
  const entries = new Map<string, Entry>();
  let disposed = false;
  const trace = (id: string, kind: 'decision' | 'reject' | 'commit', detail: string): void => {
    const message = `[NativeCharacter:${id}] ${kind}: ${detail}`;
    if (kind === 'reject') console.warn(message);
    else console.info(message);
  };
  const release = (e: Entry): void => {
    e.disposed = true;
    clearTimeout(e.timer);
    e.port?.destroy(); // aborts HTTP, pending ready and command listeners/timers
    e.port = undefined;
    e.stage.style.opacity = '0';
    e.poster.style.opacity = '1';
  };
  const live = (id: string, e: Entry): boolean => !disposed && !e.disposed && entries.get(id) === e && host.contains(e.el);
  const fail = (id: string, e: Entry, error: unknown): void => {
    if (!live(id, e)) return;
    trace(id, 'reject', error instanceof Error ? error.message : String(error));
    release(e);
    e.el.dataset['nativeState'] = 'fallback';
  };
  async function apply(id: string, e: Entry): Promise<void> {
    if (e.busy || !e.status || !e.port || !live(id, e)) return;
    e.busy = true;
    try {
      while (live(id, e)) {
        const props = e.props;
        const key = requestKey(props);
        if (e.applied === key) break;
        const clip = props.clip ?? e.status.clips[0]?.id;
        if (!clip || !e.status.clips.some(c => c.id === clip)) throw new Error(`unknown clip ${String(clip)}`);
        const values: Record<string, number> = Object.create(null) as Record<string, number>;
        const definitions = new Map(e.status.parameters.map(p => [p.id, p]));
        for (const name of Object.keys(props.parameters ?? {})) if (!definitions.has(name)) throw new Error(`unknown parameter ${name}`);
        for (const p of e.status.parameters) {
          if (!Number.isFinite(p.min) || !Number.isFinite(p.max) || p.min > p.max) throw new Error(`invalid model parameter range ${p.id}`);
          const raw = props.parameters?.[p.id] ?? p.default ?? 0;
          if (!Number.isFinite(raw)) throw new Error(`invalid model parameter ${p.id}`);
          values[p.id] = Math.max(p.min, Math.min(p.max, raw));
        }
        // Parameters do not override active animation tracks. Use a track-free controls clip.
        await e.port.command({ type: 'parameters', values });
        if (!live(id, e)) return;
        const playback = JSON.stringify([clip, props.loop ?? true, Math.max(.1, Math.min(4, props.speed ?? 1))]);
        if (e.el.dataset['nativePlayback'] !== playback) {
          await e.port.command({ type: 'play', clipId: clip, loop: props.loop ?? true, speed: Math.max(.1, Math.min(4, props.speed ?? 1)) });
          if (!live(id, e)) return;
          e.el.dataset['nativePlayback'] = playback;
        }
        e.applied = key;
      }
      if (live(id, e)) {
        clearTimeout(e.timer);
        e.stage.style.opacity = '1';
        e.poster.style.opacity = '0';
        if (e.el.dataset['nativeState'] !== 'playing') trace(id, 'commit', 'asset loaded; native presentation visible');
        e.el.dataset['nativeState'] = 'playing';
      }
    } catch (error) { fail(id, e, error); }
    finally { e.busy = false; }
  }
  const sync = (): void => {
    if (disposed) return;
    const nodes: LayoutNode[] = [];
    const walk = (n: LayoutNode): void => {
      if (n.type === 'NativeCharacter') nodes.push(n);
      n.children?.forEach(walk);
      for (const key of ['bubble', 'backFace']) {
        const child = (n.props as unknown as Record<string, unknown>)[key] as LayoutNode | undefined;
        if (child?.type) walk(child);
      }
    };
    walk(getRoot());
    const wanted = new Set<string>();
    for (const node of nodes) {
      // Avoid interpolating data ids into a CSS selector.
      const el = Array.from(host.querySelectorAll<HTMLElement>('[data-native-character]')).find(x => x.id === node.id);
      if (!el) continue;
      let hidden = false;
      for (let ancestor: HTMLElement | null = el; ancestor && ancestor !== host; ancestor = ancestor.parentElement) {
        if (ancestor.style.display === 'none' || ancestor.hidden) { hidden = true; break; }
      }
      if (hidden) continue;
      wanted.add(node.id);
      const props = node.props as NativeCharacterProps;
      let runtime = '', base = '', identity = props.assetKey;
      let invalid: unknown;
      try {
        if (!config) throw new Error('nativeCharacters host configuration absent; retaining poster');
        runtime = nativeCharacterLocalUrl(config.runtimeUrl, window.location.href);
        base = nativeCharacterLocalUrl(config.baseUrl, window.location.href);
        const url = nativeCharacterLocalUrl(nativeCharacterAssetUrl(config.index, props.assetKey, base), base);
        if (!new URL(url).pathname.toLowerCase().endsWith('.stretch')) throw new Error('asset path must be .stretch');
        nativeCharacterLocalUrl(props.poster, window.location.href);
        identity = JSON.stringify([props.assetKey, url, runtime]);
      } catch (error) { invalid = error; }
      const previous = entries.get(node.id);
      if (previous && previous.el === el && previous.identity === identity) {
        previous.props = props;
        void apply(node.id, previous);
        continue;
      }
      if (previous) release(previous);
      delete el.dataset['nativePlayback'];
      const e: Entry = { el, stage: el.querySelector<HTMLElement>('[data-native-stage]')!, poster: el.querySelector<HTMLElement>('[data-native-poster]')!, props, identity, disposed: false, busy: false };
      entries.set(node.id, e);
      e.el.dataset['nativeState'] = 'loading';
      if (invalid) { fail(node.id, e, invalid); continue; }
      const deadline = typeof config!.timeoutMs === 'number' && Number.isFinite(config!.timeoutMs) ? Math.max(100, Math.min(60000, config!.timeoutMs)) : 30000;
      e.timer = setTimeout(() => fail(node.id, e, new Error('readiness/load deadline exceeded')), deadline);
      try {
        trace(node.id, 'decision', 'mount local native runtime; retaining poster');
        e.port = mountNativeCharacter(e.stage, { runtimeUrl: runtime, timeoutMs: deadline, onTrace: (kind, detail) => trace(node.id, kind, detail) });
        // frame is never focusable or interactive; the outer LayoutNode action remains authoritative.
        e.port.frame.tabIndex = -1;
        void (async () => {
          try {
            await e.port!.ready;
            if (!live(node.id, e)) return;
            e.status = await e.port!.loadAsset(config!.index, props.assetKey, base);
            if (!live(node.id, e)) return;
            await apply(node.id, e);
          } catch (error) { fail(node.id, e, error); }
        })();
      } catch (error) { fail(node.id, e, error); }
    }
    for (const [id, e] of entries) if (!wanted.has(id)) { release(e); entries.delete(id); }
  };
  sync();
  return { sync, dispose() { disposed = true; for (const e of entries.values()) release(e); entries.clear(); } };
}
