// @vitest-environment happy-dom
// 创作台 v1 · launcher 层集成测试（返修 Lead 缺陷 #1 的防复发闸）：
// 不直挂子组件，而是渲染整个 <Launcher /> 走真实接线——玩家模式 → 库卡带上架 →
// 点操作条「▶ 开始游戏」→ DataCartridgeRunner 挂载 canvas → 返回架上。
// 此前的断线（shelf 自拉 + launcher 另存一份空 libEntries → LAUNCH 静默无反应）单元测试全绿
// 却在浏览器里坏——本文件专门在 launcher 层把这条整线钉死。fetch 全 mock，不依赖真服务。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Launcher } from './launcher.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// 按 URL 子串路由的 fetch mock。routes 顺序=优先级：具体路径（/manifest、/history）放在
// 宽前缀（/api/library）之前，否则列表路由会吞掉 manifest 请求。
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

async function flush(times = 3) {
  for (let i = 0; i < times; i++) {
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  }
}

function findButton(host: HTMLElement, text: string): HTMLButtonElement | undefined {
  return Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.includes(text));
}

const SAMPLE_ENTRY = {
  slug: 'sample-platformer',
  meta: { name: '样例平台跳跃', subtitle: '官方示例', icon: '🕹️', color: '#1e3a5f', accentColor: '#38bdf8' },
  valid: true,
};

let container: HTMLElement;
let root: Root;

beforeEach(() => {
  window.history.replaceState(null, '', '/?mode=player');
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

describe('Launcher · 玩家模式整线集成', () => {
  it('空库 → 欢迎语 +「新建游戏」空卡位 + 装入示例按钮；内置卡带与 DevTools 不出现', async () => {
    mockFetch([
      ['/api/library', []],
      ['/api/generate/providers', []],
      ['/api/generate/presets', {}],
      ['/assets/FreeArtLib', {}],
    ]);
    await act(async () => { root.render(<Launcher />); });
    await flush();

    expect(container.textContent).toContain('你的游戏架还是空的');
    expect(container.textContent).toContain('新建游戏');
    expect(container.textContent).toContain('装入官方示例卡带');
    // 玩家模式纯净：内置卡带（Balatro/Fateflip…）与 dev 工具不可见。
    expect(container.textContent).not.toContain('Balatro');
    expect(container.textContent).not.toContain('Dev Tools');
    expect(container.textContent).not.toContain('数据透视器');
  });

  it('有库卡带 → 轮播上架 + 四键操作条 → ▶ 开始游戏 → canvas 挂载 → 返回架上', async () => {
    mockFetch([
      ['/manifest', { capabilities: ['a1-transform'], entities: { e: { Transform: { x: 1, y: 2 } } } }],
      ['/history', { mode: 'git', entries: [] }],
      ['/api/library', [SAMPLE_ENTRY]],
      ['/api/generate/providers', []],
      ['/api/generate/presets', {}],
      ['/assets/FreeArtLib', {}],
    ]);
    await act(async () => { root.render(<Launcher />); });
    await flush();

    // 卡带上架（meta.name 上牌面）+ 操作条四键齐全（spec ③），且不是单个 LAUNCH 大按钮。
    expect(container.textContent).toContain('样例平台跳跃');
    expect(findButton(container, '开始游戏')).toBeTruthy();
    expect(findButton(container, '继续创作')).toBeTruthy();
    expect(findButton(container, '版本历史')).toBeTruthy();
    const exportBtn = findButton(container, '导出');
    expect(exportBtn).toBeTruthy();
    expect(exportBtn!.disabled).toBe(false); // REQ-WORKSHOP A：⤓ 导出=真下载包（/api/library/<slug>/export）
    expect(findButton(container, '生产板')).toBeTruthy(); // 🏭 全模式可达（REQ-WORKSHOP C1 ⑦ 导流）
    expect(findButton(container, 'LAUNCH')).toBeUndefined();

    // ▶ 开始游戏 → 数据卡带运行器全屏纯运行：引擎 canvas 挂载 + 左上返回。
    await act(async () => { findButton(container, '开始游戏')!.click(); });
    await flush();
    expect(container.querySelector('canvas')).toBeTruthy();
    expect(findButton(container, '返回架上')).toBeTruthy();

    // ← 返回架上 → 回到卡带架（canvas 卸载，卡带仍在）。
    await act(async () => { findButton(container, '返回架上')!.click(); });
    await flush();
    expect(container.querySelector('canvas')).toBeFalsy();
    expect(container.textContent).toContain('样例平台跳跃');
  });

  it('⟲ 版本历史 → 浮层出现（从架上可达·缺陷 #2 防复发）', async () => {
    mockFetch([
      ['/history', { mode: 'git', entries: [{ rev: 'abc1234', subject: 'create', date: '2026-07-02' }] }],
      ['/api/library', [SAMPLE_ENTRY]],
      ['/api/generate/providers', []],
      ['/api/generate/presets', {}],
      ['/assets/FreeArtLib', {}],
    ]);
    await act(async () => { root.render(<Launcher />); });
    await flush();

    await act(async () => { findButton(container, '版本历史')!.click(); });
    await flush();
    expect(container.textContent).toContain('create');
    expect(findButton(container, '回滚')).toBeTruthy();
  });

  it('状态灯：仅 local(Ollama) available → 琥珀「未配置」；云 provider 配 key → 绿「已连接」', async () => {
    mockFetch([
      ['/api/library', []],
      ['/api/generate/providers', [{ id: 'local', name: 'Local (Ollama)', models: [], available: true }]],
      ['/api/generate/presets', {}],
      ['/assets/FreeArtLib', {}],
    ]);
    await act(async () => { root.render(<Launcher />); });
    await flush();
    expect(container.textContent).toContain('未配置 API Key');
    expect(container.textContent).not.toContain('已连接');

    act(() => root.unmount());
    root = createRoot(container);
    mockFetch([
      ['/api/library', []],
      ['/api/generate/providers', [
        { id: 'local', name: 'Local (Ollama)', models: [], available: true },
        { id: 'anthropic', name: 'Claude (Anthropic)', models: [], available: true },
      ]],
      ['/api/generate/presets', {}],
      ['/assets/FreeArtLib', {}],
    ]);
    await act(async () => { root.render(<Launcher />); });
    await flush();
    expect(container.textContent).toContain('已连接 · Claude (Anthropic)');
  });
});
