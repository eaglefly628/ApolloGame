// @vitest-environment happy-dom
// Workshop ▶ 直达回归闸（owner 07-11 报「?game=lib:<slug> 弹出页没游戏」）：
// URL 带 ?game=lib:<slug>&from=workshop → launcher 库列表就绪后自动进 DataCartridgeRunner（canvas 挂载）。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Launcher } from './launcher.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mockFetch(routes: Array<[string, unknown]>) {
  const calls: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    calls.push(String(url));
    return {
      ok: true,
      json: async () => {
        for (const [k, v] of routes) if (String(url).includes(k)) return v;
        return {};
      },
    };
  }));
  return calls;
}

async function flush(times = 4) {
  for (let i = 0; i < times; i++) {
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  }
}

const CART = {
  slug: 'game001',
  meta: { name: '编号卡带', subtitle: '', icon: '🎮', color: '#1e3a5f', accentColor: '#38bdf8' },
  valid: true,
};

let container: HTMLElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

describe('Workshop ▶ URL 直启卡带', () => {
  it('?game=lib:game001 → 库列表就绪后自动进运行器（canvas 挂载·非停留货架）', async () => {
    window.history.replaceState(null, '', '/?game=lib%3Agame001&from=workshop');
    mockFetch([
      ['/manifest', { capabilities: ['a1-transform'], entities: { e: { Transform: { x: 1, y: 2 } } } }],
      ['/history', { mode: 'git', entries: [] }],
      ['/api/library', [CART]],
      ['/api/generate/providers', []],
      ['/api/generate/presets', {}],
      ['/assets/FreeArtLib', {}],
    ]);
    await act(async () => { root.render(<Launcher />); });
    await flush();
    expect(container.querySelector('canvas')).toBeTruthy();
    expect(container.textContent).toContain('返回');
  });

  it('bare=1 纯运行模式：装载期不闪货架 chrome → runner 挂载（owner「直接启动游戏」）', async () => {
    window.history.replaceState(null, '', '/?game=lib%3Agame001&from=workshop&bare=1');
    mockFetch([
      ['/manifest', { capabilities: ['a1-transform'], entities: { e: { Transform: { x: 1, y: 2 } } } }],
      ['/history', { mode: 'git', entries: [] }],
      ['/api/library', [CART]],
      ['/api/generate/providers', []],
      ['/api/generate/presets', {}],
      ['/assets/FreeArtLib', {}],
    ]);
    await act(async () => { root.render(<Launcher />); });
    expect(container.textContent).not.toContain('ZEROCRAFT'); // 装载期无旧工作台铭牌
    await flush();
    expect(container.querySelector('canvas')).toBeTruthy();
  });

  it('dev 模式（无 mode=player）同样直启', async () => {
    window.history.replaceState(null, '', '/?game=lib%3Agame001');
    mockFetch([
      ['/manifest', { capabilities: ['a1-transform'], entities: { e: { Transform: { x: 1, y: 2 } } } }],
      ['/history', { mode: 'git', entries: [] }],
      ['/api/library', [CART]],
      ['/api/generate/providers', []],
      ['/api/generate/presets', {}],
      ['/assets/FreeArtLib', {}],
    ]);
    await act(async () => { root.render(<Launcher />); });
    await flush();
    expect(container.querySelector('canvas')).toBeTruthy();
  });
});
