// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { mountNativeCharacter, nativeCharacterAssetUrl, NATIVE_CHARACTER_CHANNEL } from './native-character.js';
import { parseAssetIndex } from '../../assets/asset-index.js';

const ports: ReturnType<typeof mountNativeCharacter>[] = [];
const index = parseAssetIndex({ version: 1, assets: [{ id: 'anim/alice', type: 'animation', status: 'filled', description: 'Native character', path: 'art/alice.stretch', spec: { format: 'stretch' } }] });
function mount(runtimeUrl = '/character/index.html') {
  const create = document.createElement.bind(document);
  const iframe = create('iframe');
  // Transport is mocked; real frame rendering/loading is covered by audit.mjs.
  Object.defineProperty(iframe, 'src', { get: () => 'about:blank', set: () => {} });
  Object.defineProperty(iframe, 'contentWindow', { configurable: true, value: { postMessage: vi.fn() } });
  const factory = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => tag === 'iframe' ? iframe : create(tag));
  const port = mountNativeCharacter(document.body, { runtimeUrl });
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
    await expect(port.loadAsset(index, 'anim/alice', window.location.href)).rejects.toThrow('HTTP 404');
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

function hostLocation(href: string, origin = new URL(href).origin) {
  vi.spyOn(window, 'location', 'get').mockReturnValue({ href, origin } as Location);
}

describe('native character local container boundary', () => {
  it.each(['null', 'apollo://app'])('supports fixed apollo host with serialized origin %s and the existing v1 protocol', async origin => {
    hostLocation('apollo://app/index.html', origin);
    const port = mount();
    const post = vi.mocked(port.frame.contentWindow!.postMessage);
    let settled = false;
    void port.ready.then(() => { settled = true; });
    message(port, { type: 'ready' }, window, origin);
    message(port, { type: 'ready' }, null, origin);
    message(port, { type: 'ready' }, port.frame.contentWindow, origin === 'null' ? 'apollo://other' : 'null');
    await Promise.resolve(); expect(settled).toBe(false);
    message(port, { type: 'ready' }, port.frame.contentWindow, origin);
    await port.ready;
    const command = port.command({ type: 'status' });
    await Promise.resolve();
    expect(post).toHaveBeenCalledWith(expect.objectContaining({ channel: NATIVE_CHARACTER_CHANNEL, type: 'command' }), origin === 'null' ? '*' : 'apollo://app');
    const request = post.mock.calls[0]![0] as { id: number };
    message(port, { type: 'reply', id: request.id, ok: true, value: 'legacy-v1' }, port.frame.contentWindow, origin);
    await expect(command).resolves.toBe('legacy-v1');
  });
  it.each([
    'file:///player.html', 'data:text/html,player', 'javascript:void(0)', 'other://app/player',
    'apollo://other/player', 'apollo://app.evil/player', 'apollo://app:80/player',
    'apollo://user@app/player', 'apollo://user:secret@app/player', 'apollo://@app/player',
    '/a/%2e%2e/player', '/a/.%2E/player', '/a/%252e%252e/player', '/a/%2fplayer', '/a/%5cplayer',
  ])('rejects foreign/opaque/credential/traversal runtime %s from the apollo host', runtimeUrl => {
    hostLocation('apollo://app/index.html');
    expect(() => mountNativeCharacter(document.body, { runtimeUrl })).toThrow(/host origin|traversal/);
  });
  it.each(['file:///index.html', 'other://app/index.html', 'apollo://other/index.html', 'apollo://app:80/index.html', 'apollo://user@app/index.html'])('does not opt in for other opaque host %s', href => {
    hostLocation(href);
    expect(() => mountNativeCharacter(document.body, { runtimeUrl: 'apollo://app/player' })).toThrow(/host origin/);
  });
  it('keeps the HTTP bridge exact and rejects opaque messages even from the player window', async () => {
    const port = mount(); const post = vi.mocked(port.frame.contentWindow!.postMessage);
    message(port, { type: 'ready' }); await port.ready;
    const pending = port.command({ type: 'status' }); await Promise.resolve();
    expect(post.mock.calls[0]![1]).toBe(window.location.origin);
    const request = post.mock.calls[0]![0] as { id: number };
    let settled = false; void pending.then(() => { settled = true; });
    message(port, { type: 'reply', id: request.id, ok: true, value: 'forged' }, port.frame.contentWindow, 'null');
    await Promise.resolve(); expect(settled).toBe(false);
    message(port, { type: 'reply', id: request.id, ok: true, value: 'web' });
    await expect(pending).resolves.toBe('web');
  });
  it('rejects HTTP credentials and custom scheme from an ordinary Web host', () => {
    const current = new URL(window.location.href);
    for (const runtimeUrl of [`${current.protocol}//user:secret@${current.host}/player`, 'apollo://app/player', 'file:///player']) {
      expect(() => mountNativeCharacter(document.body, { runtimeUrl })).toThrow(/host origin/);
    }
  });
  it('preserves HTTPS scheme and port matching for normal Web hosts', async () => {
    hostLocation('https://example.test:8443/app/index.html');
    for (const runtimeUrl of ['http://example.test:8443/player', 'https://example.test/player', 'https://example.test:8444/player']) {
      expect(() => mountNativeCharacter(document.body, { runtimeUrl })).toThrow(/host origin/);
    }
    const port = mount('/player'); const post = vi.mocked(port.frame.contentWindow!.postMessage);
    message(port, { type: 'ready' }); await port.ready;
    const pending = port.command({ type: 'status' }); await Promise.resolve();
    expect(post.mock.calls[0]![1]).toBe('https://example.test:8443');
    const request = post.mock.calls[0]![0] as { id: number };
    message(port, { type: 'reply', id: request.id, ok: true, value: 'https' });
    await expect(pending).resolves.toBe('https');
  });
  it('never treats a null contentWindow and null source as its player', async () => {
    vi.useFakeTimers(); const port = mount();
    Object.defineProperty(port.frame, 'contentWindow', { configurable: true, value: null });
    message(port, { type: 'ready' }, null);
    const assertion = expect(port.ready).rejects.toThrow('readiness timed out');
    await vi.advanceTimersByTimeAsync(30_000); await assertion;
  });
  it('validates assets before fetch, including encoded traversal before URL normalization', async () => {
    hostLocation('apollo://app/index.html'); const port = mount();
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 404 } as Response);
    for (const path of ['file:///cat.stretch', 'data:text/plain,cat', 'apollo://other/cat.stretch', 'apollo://user@app/cat.stretch', 'art/%2e%2e/cat.stretch', 'art/%252e%252e/cat.stretch']) {
      await expect(port.loadAsset({ version: 1, assets: [{ ...index.assets[0]!, path }] }, 'anim/alice', 'apollo://app/')).rejects.toThrow(/host origin|traversal/);
    }
    expect(fetcher).not.toHaveBeenCalled();
    await expect(port.loadAsset(index, 'anim/alice', 'apollo://app/')).rejects.toThrow('HTTP 404');
    expect(fetcher).toHaveBeenCalledWith('apollo://app/art/alice.stretch', expect.objectContaining({ redirect: 'error', signal: expect.any(AbortSignal) }));
  });
});
