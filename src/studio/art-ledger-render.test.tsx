// @vitest-environment happy-dom
// ArtLedgerPanel 可辨认性回归（owner 现场痛点：台账「看不出什么是什么·没占位图」）。
// 客户端渲染（跑 useEffect + mock fetch 注入台账行）→ 断言卡面显示 query 描述 + 未生成行画 SVG 色块占位图。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { ArtLedgerPanel, type LedgerRow } from './ArtLedgerPanel.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// 两条 needs-art 行：enemy=皮肤槽回退 circle·#ff5c7a；track-seg=纯色块 box·#1c3a5c。
const LEDGER = {
  success: true, mode: 'requirements', game: 'sample-game', count: 2,
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
    await act(async () => { root.render(<ArtLedgerPanel slug="sample-game" onBack={() => {}} />); });
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

// ═══ REQ-ARTLIB·fileless placeholder 行不空白（平台侧程序占位签 + onError 兜底）═══
// authored-inventory 台账（game-c 式·用 ref 非 slot）允许合法无文件行；素材屏对这些行必须渲占位签而非空白/破图。
function stubLedger(rows: LedgerRow[]): void {
  const L = { success: true, mode: 'requirements', game: 'game-c', count: rows.length, rows };
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/api/art/ledger')) return { ok: true, json: async () => L };
    if (url.includes('/api/art/style-packs')) return { ok: true, json: async () => ({ packs: [{ packId: 'p', name: 'P' }] }) };
    return { ok: true, json: async () => ({}) };
  }));
}
// ref-shaped（无 slot·game-c authored-inventory 真实形状）
const PH_NO_FILE: LedgerRow = {
  no: 'art-001', kind: 'texture', desc: '夜景背幕（落地窗+城市夜景）',
  ref: { mechanism: 'url', component: 'ThreeRenderer', field: 'setBackgroundTexture', servedPath: '/games/game-c/art/scene/backdrop.svg' },
  query: 'floor-to-ceiling window over a nocturnal city skyline',
  placeholder: { current: '素坯：声明式 SVG 夜景', source: 'procedural-placeholder', count: 1 },
  status: 'placeholder', gen: null, provenance: null,
};
const PH_WITH_FILE: LedgerRow = {
  no: 'art-002', kind: 'sprite', desc: '牌面精灵',
  ref: { component: 'Sprite', field: 'textureKey', servedPath: '/games/game-c/art/card.svg' },
  query: 'card face sprite',
  placeholder: { current: '素坯', count: 1 },
  status: 'placeholder',
  gen: { provider: 'procedural', model: 'x', servedPath: '/games/game-c/art/card.svg', localId: 'game-c/card' },
  provenance: null,
};

describe('ArtLedgerPanel · REQ-ARTLIB fileless placeholder 不空白', () => {
  it('无真图的 placeholder 行（gen=null·ref 形状无 slot）直渲程序占位签（desc+status·不空白·不崩溃）', async () => {
    stubLedger([PH_NO_FILE]);
    await act(async () => { root.render(<ArtLedgerPanel slug="game-c" onBack={() => {}} />); });
    await flush();
    const html = container.innerHTML;
    expect(html).toContain('data-placeholder-sign'); // 占位签存在（非空白/破图）
    expect(html).toContain('夜景背幕（落地窗+城市夜景）'); // desc 文案
    expect(html).toContain('占位·待产'); // status 标签
    // 该行无真图渲染：没有指向 backdrop.svg 的 <img>（本该空白的那格现在是签）
    expect(container.querySelector('img[src*="backdrop.svg"]')).toBeNull();
  });

  it('placeholder 行有 servedPath 时先渲真图；img 404 → onError 落占位签（免 fs 探测）', async () => {
    stubLedger([PH_WITH_FILE]);
    await act(async () => { root.render(<ArtLedgerPanel slug="game-c" onBack={() => {}} />); });
    await flush();
    // 初始：渲真图（保留 game-c 自救 SVG·不被占位签盖掉），尚无占位签
    const img = container.querySelector('img[src*="card.svg"]') as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(container.innerHTML).not.toContain('data-placeholder-sign');
    // 触发 404 → onError
    await act(async () => { img!.dispatchEvent(new Event('error')); });
    await flush();
    const html = container.innerHTML;
    expect(html).toContain('data-placeholder-sign'); // 破图 → 占位签兜底
    expect(html).toContain('缺图·占位'); // 404 专属标签
    expect(container.querySelector('img[src*="card.svg"]')).toBeNull(); // 破图已撤
  });

  it('game-c 真台账（ref 形状·authored-inventory）整屏渲染不崩溃 + 描述可辨认', async () => {
    const real = JSON.parse(readFileSync('public/games/game-c/art/art-ledger.json', 'utf-8'));
    stubLedger(real.rows as LedgerRow[]);
    await act(async () => { root.render(<ArtLedgerPanel slug="game-c" onBack={() => {}} />); });
    await flush();
    const html = container.innerHTML;
    expect(html).toContain('art-001'); // 编号墙渲出（旧代码在此崩于 r.slot.entity）
    expect(html).toContain('筹码'); // 人读 desc 可辨认（用**最稳定**关键词=筹码·免 game-c 场景/桌面文案反复演进误伤 studio 渲染回归）
    // 真台账非空即验渲染路径（**不硬编游戏侧行数**·免 game-c 台账演进——如扑克牌移出——误伤 studio 渲染回归）。
    expect(real.rows.length).toBeGreaterThan(0);
  });
});

// ═══ 一键提交推送按钮（owner 2026-08-06「内置游戏美术替换老是冲突」·方案A）═══
// 内置游戏（kind='builtin'）：渲「⤴ 提交推送」+ 待同步数角标（/api/art/sync/status）；library 卡带不渲（自带每卡带版本化）。
function stubLedgerWithSync(count: number): void {
  const L = { success: true, mode: 'requirements', game: 'game-c', count: 1, rows: [PH_NO_FILE] };
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/api/art/sync/status')) return { ok: true, json: async () => ({ success: true, count, files: [], branch: 'claude/mainbranch' }) };
    if (url.includes('/api/art/ledger')) return { ok: true, json: async () => L };
    if (url.includes('/api/art/style-packs')) return { ok: true, json: async () => ({ packs: [{ packId: 'p', name: 'P' }] }) };
    return { ok: true, json: async () => ({}) };
  }));
}

describe('ArtLedgerPanel · 内置游戏一键提交推送', () => {
  it('kind=builtin + 有待同步改动 → 渲「⤴ 提交推送」带数量角标', async () => {
    stubLedgerWithSync(3);
    await act(async () => { root.render(<ArtLedgerPanel slug="game-c" kind="builtin" onBack={() => {}} />); });
    await flush();
    expect(container.innerHTML).toContain('提交推送（3）');
  });

  it('kind=builtin + 无改动 → 按钮在但禁用（无角标）', async () => {
    stubLedgerWithSync(0);
    await act(async () => { root.render(<ArtLedgerPanel slug="game-c" kind="builtin" onBack={() => {}} />); });
    await flush();
    expect(container.innerHTML).toContain('提交推送');
    expect(container.innerHTML).not.toContain('提交推送（');
    const btn = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('提交推送'));
    expect(btn?.disabled).toBe(true);
  });

  it('library 卡带不渲此按钮（library/ 不入引擎仓·自带版本化）', async () => {
    stubLedgerWithSync(3);
    await act(async () => { root.render(<ArtLedgerPanel slug="some-cart" kind="library" onBack={() => {}} />); });
    await flush();
    expect(container.innerHTML).not.toContain('提交推送');
  });
});

// ═══ mock 当场说破（owner 2026-08-06 实战踩坑）═══
// 单槽「重新生成」在无 key 时服务端探针失败自动回退 mock，此前 toast 仍是「✓ 重生成 art-15」，
// 人以为拿到真图、实际是 gen/mock/ 下一张噪声占位。红线「静默顶替=假绿」此前只有一键全量守住。
function stubRegen(resp: Record<string, unknown>): void {
  const L = { success: true, mode: 'requirements', game: 'g', count: 1, rows: [PH_NO_FILE] };
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/api/art/regenerate')) return { ok: true, json: async () => resp };
    if (url.includes('/api/art/ledger')) return { ok: true, json: async () => L };
    if (url.includes('/api/art/style-packs')) return { ok: true, json: async () => ({ packs: [{ packId: 'p', name: 'P' }] }) };
    return { ok: true, json: async () => ({}) };
  }));
}
async function clickRegen(): Promise<void> {
  await act(async () => { root.render(<ArtLedgerPanel slug="g" onBack={() => {}} />); });
  await flush();
  // 点编号 span（React 事件委托会冒泡到卡片的 onClick·点外层 div 命不中）
  const noEl = [...container.querySelectorAll('span')].find((s) => s.textContent === 'art-001');
  await act(async () => { noEl!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await flush();
  const btn = [...container.querySelectorAll('button')].find((b) => b.textContent === '生成');
  await act(async () => { btn!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await flush();
}

describe('ArtLedgerPanel · mock 回退必须当场说破', () => {
  it('row.gen.mock=true（显式 mock·台账已记）→ 说是试跑产物·永不写回，绝不报「✓ 成功」', async () => {
    // 无 previewOnly ⇒ 不是「无 key 意外 mock」，只可能是人自己勾了 mock 试跑（意外 mock 不碰 row）。
    stubRegen({ success: true, no: 'art-001', row: { no: 'art-001', gen: { mock: true } } });
    await clickRegen();
    const html = container.innerHTML;
    expect(html).toContain('mock 试跑产物');
    expect(html).toContain('永不写回');
    expect(html).not.toContain('✓ 重生成');   // 不许伪装成功
  });

  it('无 key 意外 mock（summary.previewOnly 非空）→ 明说没 key + 台账未动 + 黑户属正常别去登记', async () => {
    // REQ-ARTTOOL-01 语义：无 key 时只落孤儿预览图、台账一个字节不碰 → 浏览器里必然显黑户。
    // owner 2026-08-06 正是在这一步被「⚠黑户·拖入登记补建 provenance」误导（照做=把 mock 钉进游戏）。
    stubRegen({ success: true, no: 'art-001', summary: { mock: 1, previewOnly: [{ no: 'art-001', previewPath: '/games/g/art/gen/mock/art-001.png' }] } });
    await clickRegen();
    const html = container.innerHTML;
    expect(html).toContain('没配 key');
    expect(html).toContain('台账未改动');
    expect(html).toContain('别去登记');
    expect(html).toContain('按供应商分');   // 真根因=选中的那家没 key，不是一个 key 都没有
    expect(html).not.toContain('✓ 重生成');
  });

  it('显式勾 mock 试跑（summary.mock>0·无 previewOnly）→ 说是试跑产物，不误报「没 key」', async () => {
    stubRegen({ success: true, no: 'art-001', summary: { mock: 1 } });
    await clickRegen();
    const html = container.innerHTML;
    expect(html).toContain('mock 试跑产物');
    expect(html).not.toContain('没配 key');   // 别把「你自己勾的」说成「没 key」
    expect(html).not.toContain('✓ 重生成');
  });

  it('真图（mock 假）→ 照旧报成功', async () => {
    stubRegen({ success: true, no: 'art-001', row: { no: 'art-001', gen: { mock: false, servedPath: '/x.png' } } });
    await clickRegen();
    const html = container.innerHTML;
    expect(html).toContain('✓ 重生成');
    expect(html).not.toContain('MOCK');
  });
});
