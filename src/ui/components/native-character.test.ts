// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssetIndex } from '../../assets/asset-index.js';
import type { NativeCharacterCommand, NativeCharacterStatus, NativeCharacterPort } from '../../engine/host/native-character.js';
import { mountNativeCharacter } from '../../engine/host/native-character.js';
import { mountUI, type MountHandle, type MountOptions } from './server.js';
import { renderNode } from './render.js';
import { validateLayoutNode } from './validate.js';
import { catalogSpec } from './catalog.js';
import type { LayoutNode, NativeCharacterProps } from './types.js';

vi.mock('../../engine/host/native-character.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../../engine/host/native-character.js')>();
  return { ...actual, mountNativeCharacter: vi.fn() };
});
const index: AssetIndex = { version: 1, assets: ['cat-a', 'cat-b'].map(id => ({ id, description: id, type: 'animation', status: 'filled', path: `${id}.stretch`, spec: { format: 'stretch' } })) };
const config: MountOptions = { nativeCharacters: { index, baseUrl: '/characters/', runtimeUrl: '/native-runtime/index.html', timeoutMs: 1000 } };
const status: NativeCharacterStatus = { clips: [{ id: 'idle', name: 'Idle', duration: 12000 }, { id: 'controls', name: 'Controls', duration: 1000 }], parameters: [{ id: 'EyeOpen', min: 0, max: 1, default: 1 }, { id: 'Tail', min: -1, max: 1, default: 0 }], clipId: null, playing: false, timeMs: 0 };
const cat = (props: Partial<NativeCharacterProps> = {}): LayoutNode => ({ type: 'NativeCharacter', id: 'cat', props: { assetKey: 'cat-a', poster: '/cat.png', ...props }, layout: { width: 200, height: 200 } });
const panel = (children: LayoutNode[]): LayoutNode => ({ type: 'Panel', id: 'root', props: { bare: true, action: 'pet' }, children });
function deferred<T>() { let resolve!: (v: T) => void; let reject!: (reason: Error) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
let handles: MountHandle[] = [];
let host: HTMLDivElement;
let ready = deferred<void>();
let load = deferred<NativeCharacterStatus>();
let ports: Array<{ frame: HTMLIFrameElement; ready: Promise<void>; loadAsset: ReturnType<typeof vi.fn>; command: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> }>;
const mount = (root: LayoutNode = panel([cat()]), options: MountOptions = config, handlers = {}): MountHandle => { const h = mountUI(host, root, handlers, undefined, undefined, options); handles.push(h); return h; };
const state = () => host.querySelector<HTMLElement>('#cat')!.dataset['nativeState'];
const poster = () => host.querySelector<HTMLElement>('[data-native-poster]')!;
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  ready = deferred<void>(); load = deferred<NativeCharacterStatus>(); ports = [];
  host = document.createElement('div'); document.body.appendChild(host);
  vi.mocked(mountNativeCharacter).mockImplementation(container => {
    const frame = document.createElement('iframe'); frame.style.pointerEvents = 'none'; container.appendChild(frame);
    const port = { frame, ready: ready.promise, loadAsset: vi.fn(() => load.promise), command: vi.fn((_value: NativeCharacterCommand) => Promise.resolve(status)), destroy: vi.fn(() => frame.remove()) };
    ports.push(port); return port as unknown as NativeCharacterPort;
  });
});
afterEach(() => { handles.forEach(h => h()); handles = []; host.remove(); vi.useRealTimers(); vi.restoreAllMocks(); vi.mocked(mountNativeCharacter).mockReset(); });
async function loaded() { ready.resolve(); await flush(); load.resolve(status); await flush(); }

describe('NativeCharacter closed LayoutNode vocabulary', () => {
  it('path-style AssetIndex ids are opaque ids, not arbitrary source URLs', async () => {
    const key = 'game112/character/xuetuan-native-v2';
    expect(validateLayoutNode(cat({ assetKey: key }))).toEqual([]);
    const entry = { ...index.assets[0]!, id: key };
    mount(panel([cat({ assetKey: key })]), { nativeCharacters: { ...config.nativeCharacters!, index: { version: 1, assets: [entry] } } });
    await loaded(); expect(state()).toBe('playing'); expect(ports[0]!.loadAsset).toHaveBeenCalledWith(expect.anything(), key, expect.any(String));
  });
  it('catalog sample validates, render remains only contain poster and stage (no iframe/URL serialized)', () => {
    expect(validateLayoutNode(catalogSpec('NativeCharacter')!.sample)).toEqual([]);
    const html = renderNode(cat({ alt: '<cat "one">' }));
    expect(html).toContain('data-native-character'); expect(html).toContain('object-fit:contain');
    expect(html).toContain('&lt;cat &quot;one&quot;&gt;'); expect(html).not.toContain('<iframe'); expect(html).not.toContain('runtimeUrl');
  });
  it.each([
    { poster: 'javascript:alert(1)' }, { poster: '//evil.test/x.png' }, { poster: 'https://evil.test/x.png' },
    { poster: '/x.png" onerror="evil' }, { poster: '/%5cevil' }, { assetKey: '../x' }, { clip: '<script>' },
    { parameters: { Tail: NaN } }, { parameters: { Tail: '1' } }, { parameters: [] }, { speed: Infinity }, { speed: 0 },
    { loop: 'true' }, { fit: 'cover' }, { runtimeUrl: '/escape.html' },
  ])('rejects malformed new data before DOM mutation: %j', bad => {
    host.innerHTML = '<span id="unchanged">old</span>';
    const root = cat(bad as never);
    expect(validateLayoutNode(root).length).toBeGreaterThan(0);
    expect(() => mount(root)).toThrow(); expect(host.textContent).toBe('old'); expect(mountNativeCharacter).not.toHaveBeenCalled();
  });
  it('duplicate native ids are rejected in either order; old UI validation remains opt-in', () => {
    const label: LayoutNode = { type: 'Label', id: 'cat', props: { text: 'x' } };
    expect(() => mount(panel([cat(), label]))).toThrow(/duplicate/);
    expect(() => mount(panel([label, cat()]))).toThrow(/duplicate/);
    const old = panel([{ type: 'Label', id: 'first', props: { text: 'unchanged' } }]);
    mount(old); expect(host.innerHTML).toBe(renderNode(old)); expect(mountNativeCharacter).not.toHaveBeenCalled();
  });
});

describe('NativeCharacter centralized lifecycle (stub, not GPU evidence)', () => {
  it('retains poster through readiness and load, then plays first clip and shows frame', async () => {
    mount(); expect(state()).toBe('loading'); expect(poster().style.opacity).not.toBe('0');
    expect(ports[0]!.loadAsset).not.toHaveBeenCalled();
    ready.resolve(); await flush(); expect(ports[0]!.loadAsset).toHaveBeenCalledTimes(1); expect(ports[0]!.loadAsset).toHaveBeenCalledWith(index, 'cat-a', new URL('/characters/', window.location.href).href);
    expect(poster().style.opacity).not.toBe('0'); load.resolve(status); await flush();
    expect(state()).toBe('playing'); expect(poster().style.opacity).toBe('0');
    expect(ports[0]!.command).toHaveBeenCalledWith({ type: 'play', clipId: 'idle', loop: true, speed: 1 });
    expect(ports[0]!.frame.tabIndex).toBe(-1);
  });
  it('same asset prop/layout updates preserve shell/frame and HTTP; parameters clamp/reset, playback does not restart', async () => {
    const h = mount(panel([cat({ clip: 'controls', parameters: { Tail: 9 } })])); await loaded();
    const el = host.querySelector('#cat'), frame = ports[0]!.frame;
    expect(ports[0]!.command).toHaveBeenCalledWith({ type: 'parameters', values: { EyeOpen: 1, Tail: 1 } });
    h.update(panel([{ ...cat({ clip: 'controls', parameters: { EyeOpen: -3 }, poster: '/other.png', alt: 'changed' }), layout: { width: 100, height: 100 } }])); await flush();
    expect(host.querySelector('#cat')).toBe(el); expect(host.querySelector('iframe')).toBe(frame);
    expect(mountNativeCharacter).toHaveBeenCalledTimes(1); expect(ports[0]!.loadAsset).toHaveBeenCalledTimes(1);
    expect(ports[0]!.command).toHaveBeenCalledWith({ type: 'parameters', values: { EyeOpen: 0, Tail: 0 } });
    expect(ports[0]!.command.mock.calls.filter(([x]) => x.type === 'play')).toHaveLength(1);
    expect(poster().getAttribute('src')).toBe('/other.png'); expect(el!.getAttribute('aria-label')).toBe('changed');
    h.update(panel([cat({ clip: 'controls', speed: 50, loop: false })])); await flush();
    expect(ports[0]!.command).toHaveBeenLastCalledWith({ type: 'play', clipId: 'controls', speed: 4, loop: false });
  });
  it('queued updates use newest props after pending ready/load', async () => {
    const h = mount(); h.update(panel([cat({ clip: 'controls', parameters: { Tail: -.5 } })])); await loaded();
    expect(ports[0]!.command).toHaveBeenCalledWith({ type: 'play', clipId: 'controls', loop: true, speed: 1 });
    expect(ports[0]!.command).toHaveBeenCalledWith({ type: 'parameters', values: { EyeOpen: 1, Tail: -.5 } });
  });
  it('asset replacement destroys pending port; late completion cannot reveal or command old frame', async () => {
    const h = mount(); ready.resolve(); await flush(); const old = ports[0]!;
    h.update(panel([cat({ assetKey: 'cat-b' })])); expect(old.destroy).toHaveBeenCalledTimes(1);
    expect(mountNativeCharacter).toHaveBeenCalledTimes(2); load.resolve(status); await flush();
    expect(old.command).not.toHaveBeenCalled(); expect(old.frame.isConnected).toBe(false); expect(state()).toBe('playing');
  });
  it.each(['remove', 'teardown', 'parent-replaced'] as const)('%s prevents late readiness/load resurrection', async change => {
    const h = mount(); const old = ports[0]!;
    if (change === 'remove') h.update(panel([]));
    else if (change === 'parent-replaced') h.update({ type: 'Label', id: 'new-root', props: { text: 'away' } });
    else h();
    ready.resolve(); load.resolve(status); await flush();
    expect(old.destroy).toHaveBeenCalledTimes(1); expect(old.loadAsset).not.toHaveBeenCalled(); expect(old.command).not.toHaveBeenCalled(); expect(host.querySelector('iframe')).toBeNull();
  });
  it('load failure (including WebGL/HTTP rejection) restores poster, records reject once, no retry on same update', async () => {
    const h = mount(); ready.resolve(); await flush(); load.reject(new Error('HTTP 404 / WebGL unavailable')); await flush();
    expect(state()).toBe('fallback'); expect(poster().style.opacity).toBe('1'); expect(ports[0]!.destroy).toHaveBeenCalledOnce();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('reject: HTTP 404 / WebGL unavailable'));
    h.update(panel([cat()])); await flush(); expect(mountNativeCharacter).toHaveBeenCalledTimes(1);
  });
  it('whole-load deadline aborts stalled HTTP and late data cannot revive', async () => {
    mount(); ready.resolve(); await flush(); await vi.advanceTimersByTimeAsync(1001);
    expect(state()).toBe('fallback'); expect(ports[0]!.destroy).toHaveBeenCalledOnce(); load.resolve(status); await flush();
    expect(state()).toBe('fallback'); expect(ports[0]!.command).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('deadline exceeded'));
  });
  it.each([{ clip: 'missing' }, { parameters: { Missing: 1 } }])('unknown loaded model ids fallback rather than silently no-op: %j', async props => {
    mount(panel([cat(props)])); await loaded(); expect(state()).toBe('fallback'); expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('unknown'));
  });
  it.each([
    {}, { nativeCharacters: { ...config.nativeCharacters!, runtimeUrl: 'https://evil.test/player' } },
    { nativeCharacters: { ...config.nativeCharacters!, runtimeUrl: 'javascript:evil' } },
    { nativeCharacters: { ...config.nativeCharacters!, baseUrl: 'https://evil.test/' } },
    { nativeCharacters: { ...config.nativeCharacters!, index: { version: 1, assets: [] } } },
    { nativeCharacters: { ...config.nativeCharacters!, index: { version: 1, assets: [{ ...index.assets[0]!, status: 'tbf' }] } } },
    { nativeCharacters: { ...config.nativeCharacters!, index: { version: 1, assets: [{ ...index.assets[0]!, path: 'https://evil.test/cat.stretch' }] } } },
  ] as MountOptions[])('bad/missing host configuration keeps poster and never mounts a foreign player', async options => {
    mount(undefined, options); await flush(); expect(state()).toBe('fallback'); expect(mountNativeCharacter).not.toHaveBeenCalled(); expect(console.warn).toHaveBeenCalled();
  });
  it('outer action remains authoritative (no click handler/player focus); hidden tabs release and remount', async () => {
    const pet = vi.fn(); const first = mount(undefined, config, { pet }); await loaded();
    expect(host.querySelector<HTMLElement>('#cat')!.style.pointerEvents).toBe('none'); expect(ports[0]!.frame.style.pointerEvents).toBe('none');
    host.querySelector<HTMLElement>('#root')!.click(); expect(pet).toHaveBeenCalledOnce();
    first();
    const h = mount({ type: 'Tabs', id: 'tabs', props: { tabs: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], active: 'b' }, children: [panel([cat()]), { type: 'Label', id: 'b', props: { text: 'B' } }] });
    const count = ports.length; host.querySelector<HTMLElement>('[data-tab="a"]')!.click(); await flush(); expect(ports).toHaveLength(count + 1);
    host.querySelector<HTMLElement>('[data-tab="b"]')!.click(); expect(ports.at(-1)!.destroy).toHaveBeenCalledOnce(); h();
  });
});

describe('NativeCharacter display-only container lifecycle', () => {
  const accordion = (open: boolean): LayoutNode => ({ type: 'Accordion', id: 'fold', props: { title: 'Cat', open }, children: [cat()] });
  const clickAccordion = () => host.querySelector<HTMLElement>('[data-accordion-head]')!.click();
  const tooltip = (bubble: LayoutNode = cat()): LayoutNode => ({ type: 'Tooltip', id: 'tip', props: { bubble }, children: [{ type: 'Label', id: 'trigger', props: { text: 'Cat' } }] });

  it('collapsed Accordion does not mount; opening loads; closing releases; reopening mounts a fresh port', async () => {
    mount(accordion(false)); expect(ports).toHaveLength(0);
    clickAccordion(); expect(ports).toHaveLength(1); await loaded(); expect(state()).toBe('playing');
    const old = ports[0]!; clickAccordion(); expect(old.destroy).toHaveBeenCalledOnce(); expect(host.querySelector('iframe')).toBeNull();
    clickAccordion(); await flush(); expect(ports).toHaveLength(2); expect(state()).toBe('playing');
    expect(host.querySelector('iframe')).toBe(ports[1]!.frame); expect(old.frame.isConnected).toBe(false);
  });
  it.each(['ready', 'load'] as const)('closing open Accordion while %s is pending blocks late resurrection', async pending => {
    mount(accordion(true));
    if (pending === 'load') { ready.resolve(); await flush(); expect(ports[0]!.loadAsset).toHaveBeenCalledOnce(); }
    const old = ports[0]!; clickAccordion(); expect(old.destroy).toHaveBeenCalledOnce();
    ready.resolve(); load.resolve(status); await flush();
    expect(old.command).not.toHaveBeenCalled(); expect(host.querySelector('iframe')).toBeNull();
    if (pending === 'ready') expect(old.loadAsset).not.toHaveBeenCalled();
  });
  it('rich Tooltip hover/focus mounts its bubble only while shown; internal movement preserves the port', async () => {
    mount(tooltip()); expect(ports).toHaveLength(0);
    const trigger = host.querySelector<HTMLElement>('#trigger')!;
    trigger.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); expect(ports).toHaveLength(1); await loaded();
    trigger.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: host.querySelector('[data-tooltip-bubble]')! }));
    expect(ports[0]!.destroy).not.toHaveBeenCalled(); expect(state()).toBe('playing');
    trigger.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }));
    expect(ports[0]!.destroy).toHaveBeenCalledOnce(); expect(host.querySelector('iframe')).toBeNull();
    trigger.dispatchEvent(new FocusEvent('focusin', { bubbles: true })); await flush(); expect(ports).toHaveLength(2);
    trigger.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }));
    expect(ports[1]!.destroy).toHaveBeenCalledOnce();
  });
  it('Tooltip hiding during load prevents late data revealing or commanding its removed player', async () => {
    mount(tooltip()); const trigger = host.querySelector<HTMLElement>('#trigger')!;
    trigger.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); ready.resolve(); await flush();
    expect(ports[0]!.loadAsset).toHaveBeenCalledOnce();
    trigger.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }));
    load.resolve(status); await flush(); expect(ports[0]!.destroy).toHaveBeenCalledOnce();
    expect(ports[0]!.command).not.toHaveBeenCalled(); expect(host.querySelector('iframe')).toBeNull();
  });
  it('nested Accordion/Tooltip requires both ancestors visible; hiding outer container releases inner player', async () => {
    mount(tooltip(accordion(false))); expect(ports).toHaveLength(0);
    const trigger = host.querySelector<HTMLElement>('#trigger')!;
    trigger.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); expect(ports).toHaveLength(0);
    clickAccordion(); await loaded(); expect(ports).toHaveLength(1); expect(state()).toBe('playing');
    trigger.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }));
    expect(ports[0]!.destroy).toHaveBeenCalledOnce(); expect(host.querySelector('iframe')).toBeNull();
  });
  it('ContextMenu popup display toggles do not release its always-visible native trigger subtree', async () => {
    mount({ type: 'ContextMenu', id: 'menu', props: { items: [{ id: 'a', label: 'A', action: 'pet' }] }, children: [cat()] }); await loaded();
    const trigger = host.querySelector<HTMLElement>('#menu')!;
    trigger.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 20, clientY: 20 }));
    expect(host.querySelector<HTMLElement>('[data-ctxmenu-pop]')!.style.display).toBe('block');
    trigger.click(); expect(host.querySelector<HTMLElement>('[data-ctxmenu-pop]')!.style.display).toBe('none');
    expect(ports).toHaveLength(1); expect(ports[0]!.destroy).not.toHaveBeenCalled(); expect(state()).toBe('playing');
  });
});
