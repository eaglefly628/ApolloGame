import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadLocalToyArtOverrides, LOCAL_TOY_INDEX_URL } from './local-toy-art.js';

afterEach(() => vi.unstubAllGlobals());

describe('本机百件缩图的可选覆盖', () => {
  it('只接收 game112 的 T 货号图片，不覆盖其它皮肤', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ assets: [
      { id: 'game112/prop/T001', path: '/games/game112/art/local-candidates/T001.png', tags: ['skin'] },
      { id: 'game112/scene/hall', path: '/wrong-room.png', tags: ['skin'] },
      { id: 'game113/prop/T001', path: '/wrong-game.png', tags: ['skin'] },
    ] }) });
    vi.stubGlobal('fetch', fetchMock);
    expect(await loadLocalToyArtOverrides()).toEqual({ 'game112/prop/T001': '/games/game112/art/local-candidates/T001.png' });
    expect(fetchMock).toHaveBeenCalledWith(LOCAL_TOY_INDEX_URL, { cache: 'no-cache' });
  });

  it('索引不存在时静默回退，不产生断图路径', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    expect(await loadLocalToyArtOverrides()).toEqual({});
  });
});
