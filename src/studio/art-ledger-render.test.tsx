// @vitest-environment happy-dom
// ArtLedgerPanel 可辨认性回归（owner 现场痛点：台账「看不出什么是什么·没占位图」）。
// 客户端渲染（跑 useEffect + mock fetch 注入台账行）→ 断言卡面显示 query 描述 + 未生成行画 SVG 色块占位图。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ArtLedgerPanel } from './ArtLedgerPanel.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// 两条 needs-art 行：enemy=皮肤槽回退 circle·#ff5c7a；track-seg=纯色块 box·#1c3a5c。
const LEDGER = {
  success: true, mode: 'requirements', game: 'game-q', count: 2,
  rows: [
    { no: 'art-12', kind: 'sprite', slot: { entity: 'prefab:enemy_basic:body', component: 'Sprite', field: 'textureKey' }, query: 'enemy basic body', skinKey: 'q/enemy-basic', prompt: 'top-down neon drone, pink #ff5c7a', placeholder: { current: '皮肤槽 q/enemy-basic（未填时回退 2D 色块 circle·#ff5c7a）', source: 'procedural', count: 1 }, spec: { w: 24, h: 24, transparent: true }, context: '美术需求：「enemy basic body」', status: 'needs-art', gen: null, provenance: null },
    { no: 'art-38', kind: 'sprite', slot: { entity: 'track-seg-0', component: 'Shape', field: 'art' }, query: 'track seg', placeholder: { current: '2D 色块（box·#1c3a5c）', source: 'procedural', count: 5 }, spec: { w: 210, h: 26, transparent: true }, context: '美术需求：「track seg」', status: 'needs-art', gen: null, provenance: null },
  ],
};
function mockFetch(): void {
  const fn = vi.fn(async (url: string) => {
    if (url.includes('/api/art/ledger')) return { ok: true, json: async () => LEDGER };
    if (url.includes('/api/art/style-packs')) return { ok: true, json: async () => ({ packs: [{ packId: 'neon-synthwave', name: '霓虹合成波' }] }) };
    return { ok: true, json: async () => ({}) };
  });
  vi.stubGlobal('fetch', fn);
}
async function flush(): Promise<void> {
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

let container: HTMLElement; let root: Root;
beforeEach(() => { mockFetch(); container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

describe('ArtLedgerPanel · 需求可辨认（卡面描述 + 占位色块图）', () => {
  it('卡面显示 query 人读描述 + 未生成行画 SVG 色块占位图（形状+色正确）', async () => {
    await act(async () => { root.render(<ArtLedgerPanel slug="game-q" onBack={() => {}} />); });
    await flush();
    const html = container.innerHTML;
    // C：卡面有人读描述（不再只有 art-NN → 一眼分得清）
    expect(html).toContain('enemy basic body');
    expect(html).toContain('track seg');
    // B：未生成行有 SVG 色块占位图（data-uri + 解析出的形状/色）
    expect(html).toContain('data:image/svg+xml');
    expect(html).toContain('circle');          // enemy=circle 色块
    expect(html).toContain('rect');            // track-seg=box→rect 色块
    expect(html).toContain('%23ff5c7a');       // encoded #ff5c7a（enemy 色被读进色块）
    expect(html).toContain('%231c3a5c');       // encoded #1c3a5c（track 色）
  });
});
