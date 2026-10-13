// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { mountNativeCharacter, nativeCharacterAssetUrl, NATIVE_CHARACTER_CHANNEL } from './native-character.js';
import { parseAssetIndex } from '../../assets/asset-index.js';

const ports: ReturnType<typeof mountNativeCharacter>[] = [];
const index = parseAssetIndex({ version: 1, assets: [{ id: 'anim/alice', type: 'animation', status: 'filled', description: 'Native character', path: 'art/alice.stretch', spec: { format: 'stretch' } }] });
function mount() {
  const create = document.createElement.bind(document);
  const iframe = create('iframe');
  // Transport is mocked; real frame rendering/loading is covered by audit.mjs.
  Object.defineProperty(iframe, 'src', { get: () => 'about:blank', set: () => {} });
  Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: vi.fn() } });
  const factory = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => tag === 'iframe' ? iframe : create(tag));
  const port = mountNativeCharacter(document.body, { runtimeUrl: '/character/index.html' });
  factory.mockRestore();
  ports.push(port);
  return port;
}
function message(port: ReturnType<typeof mount>, data: object, source: Window | null = port.frame.contentWindow, origin = window.location.origin) {
  window.dispatchEvent(new MessageEvent('message', { data: { channel: NATIVE_CHARACTER_CHANNEL, ...data }, source, origin }));
}
afterEach(() => { for (const port of ports.splice(0)) port.destroy(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe('native character host port', () => {
  it('consumes the local animation AssetIndex and rejects incompatible/missing assets', () => {
    expect(nativeCharacterAssetUrl(index, 'anim/alice', 'https://example.test/games/a/')).toBe('https://example.test/games/a/art/alice.stretch');
    expect(() => nativeCharacterAssetUrl(index, 'missing', 'https://example.test/')).toThrow('unavailable');
    expect(() => nativeCharacterAssetUrl({ version: 1, assets: [{ ...index.assets[0], type: 'texture' }] }, 'anim/alice', 'https://example.test/')).toThrow('unavailable');
  });
  it('rejects a runtime outside the host origin', () => {
    expect(() => mountNativeCharacter(document.body, { runtimeUrl: 'https://other.test/player' })).toThrow('host origin');
  });
  it('accepts replies only from its own frame and origin, then surfaces native rejection', async () => {
    const port = mount();
    const post = vi.spyOn(port.frame.contentWindow!, 'postMessage').mockImplementation(() => {});
    message(port, { type: 'ready' });
    await port.ready;
    const promise = port.command({ type: 'play', clipId: 'unknown' });
    await Promise.resolve();
    const request = post.mock.calls[0][0] as { id: number };
    message(port, { type: 'reply', id: request.id, ok: true, value: 'forged' }, window);
    message(port, { type: 'reply', id: request.id, ok: true, value: 'forged' }, port.frame.contentWindow, 'https://other.test');
    message(port, { type: 'reply', id: request.id, ok: false, error: 'Unknown animation unknown' });
    await expect(promise).rejects.toThrow('Unknown animation');
  });
  it('cancels pending commands and rejects future commands on teardown', async () => {
    const port = mount();
    vi.spyOn(port.frame.contentWindow!, 'postMessage').mockImplementation(() => {});
    message(port, { type: 'ready' });
    const pending = port.command({ type: 'status' });
    await Promise.resolve();
    port.destroy();
    await expect(pending).rejects.toThrow('destroyed');
    await expect(port.command({ type: 'pause' })).rejects.toThrow('destroyed');
    expect(port.frame.isConnected).toBe(false);
  });
  it('rejects HTTP asset failures instead of silently presenting an empty character', async () => {
    const port = mount();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 404 } as Response);
    await expect(port.loadAsset(index, 'anim/alice', 'https://example.test/')).rejects.toThrow('HTTP 404');
  });
  it('times out an unanswered native command', async () => {
    vi.useFakeTimers();
    const port = mount();
    vi.spyOn(port.frame.contentWindow!, 'postMessage').mockImplementation(() => {});
    message(port, { type: 'ready' });
    const pending = port.command({ type: 'pause' });
    const assertion = expect(pending).rejects.toThrow('pause timed out');
    await vi.advanceTimersByTimeAsync(30_000);
    await assertion;
  });
});
