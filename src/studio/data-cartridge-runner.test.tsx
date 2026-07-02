// @vitest-environment happy-dom
// 创作台 v1 · 卡带架前端无头挂载测试：空库欢迎态 + 数据卡带运行器纯运行不抛错。
// fetch 全部 vi.stubGlobal mock，不依赖真 apollo.py 服务。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { LibraryShelf, DataCartridgeRunner } from './DataCartridgeRunner.js';
import type { GameEntry } from './library-model.js';

// 告知 React 当前处于 act 测试环境（消除 "not configured to support act" 警告，保证 effect 冲刷）。
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// 按 URL 子串路由的最小 fetch mock（返回 { ok, json }）。
function mockFetch(routes: Array<[string, unknown]>) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
    ok: true,
    json: async () => {
      for (const [k, v] of routes) if (url.includes(k)) return v;
      return {};
    },
  })));
}

async function flush() {
  // 冲刷 fetch 微任务 + 后续 effect（RunOnly 引擎挂载）。
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

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
});

describe('LibraryShelf · 空库玩家模式', () => {
  it('GET /api/library 返回空列表 → 渲染欢迎语与「新建游戏」空卡位', async () => {
    mockFetch([['/api/library', []]]);
    await act(async () => {
      root.render(
        <LibraryShelf api="" onNewGame={() => {}} renderCarousel={() => null} />,
      );
    });
    await flush();
    expect(container.textContent).toContain('你的游戏架还是空的');
    expect(container.textContent).toContain('新建游戏');
    expect(container.textContent).toContain('装入官方示例卡带');
  });
});

describe('DataCartridgeRunner · 数据卡带纯运行', () => {
  const entry: GameEntry = {
    id: 'lib:mini', title: 'Mini', subtitle: '测试', description: '',
    color: '#1e3a5f', accentColor: '#38bdf8', icon: '🎮', status: 'playable',
  };

  it('最小合法 manifest → 点「开始游戏」无头挂载引擎不抛错（canvas 就位）', async () => {
    mockFetch([['/manifest', { capabilities: [], entities: {} }]]);
    await act(async () => {
      root.render(
        <DataCartridgeRunner
          slug="mini" entry={entry} api=""
          onBack={() => {}} onContinueCreate={() => {}}
        />,
      );
    });
    // 操作条渲染出「开始游戏」按钮。
    const startBtn = Array.from(container.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('开始游戏'));
    expect(startBtn).toBeTruthy();

    await act(async () => { startBtn!.click(); });
    await flush();

    // 进入纯运行态：CanvasRenderer 已把 canvas 挂进容器。
    expect(container.querySelector('canvas')).toBeTruthy();
    expect(container.textContent).toContain('返回架上');
  });
});
