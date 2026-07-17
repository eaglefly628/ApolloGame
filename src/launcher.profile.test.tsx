// @vitest-environment happy-dom
// REQ-C-104·玩家档案卡：ProfileCard 渲染 + UI 往返写入 localStorage（getPlayerProfile 读回）；
// 并验证 👤 档案入口已接进整个 <Launcher />（点开即出档案卡）。fetch 全 mock，不依赖真服务。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ProfileCard } from './launcher/profile-card.js';
import { Launcher } from './launcher.js';
import { getPlayerProfile } from './services/profile/index.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function setInput(el: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
  setter.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}
function findButton(host: HTMLElement, label: string): HTMLButtonElement | undefined {
  return Array.from(host.querySelectorAll('button')).find(
    (b) => b.getAttribute('aria-label') === label || b.textContent?.includes(label),
  );
}
async function flush(times = 3): Promise<void> {
  for (let i = 0; i < times; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

let container: HTMLElement;
let root: Root;

beforeEach(() => {
  localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  localStorage.clear();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

describe('ProfileCard · 档案卡渲染 + 往返', () => {
  it('渲染名字输入 + 十枚预设头像', async () => {
    await act(async () => { root.render(<ProfileCard onClose={() => {}} />); });
    expect(container.querySelector('input[aria-label="玩家名字"]')).toBeTruthy();
    expect(container.textContent).toContain('玩家档案');
    expect(findButton(container, '头像 🦊')).toBeTruthy();
    expect(findButton(container, '头像 👤')).toBeTruthy();
  });

  it('往返：填名字 + 选头像 + 保存 → getPlayerProfile 读回 {name, avatarUrl}', async () => {
    await act(async () => { root.render(<ProfileCard onClose={() => {}} />); });
    const nameEl = container.querySelector('input[aria-label="玩家名字"]') as HTMLInputElement;
    await act(async () => { setInput(nameEl, '夜華'); });
    await act(async () => { findButton(container, '头像 🦊')!.click(); });
    await act(async () => { findButton(container, '保存档案')!.click(); });

    expect(getPlayerProfile()).toEqual({ name: '夜華', avatarUrl: '🦊' });
    expect(container.textContent).toContain('已保存');
  });

  it('预填现有档案；清除 → 移除档案（getPlayerProfile 归 null）', async () => {
    localStorage.setItem('apollo.playerProfile', JSON.stringify({ name: '主角甲', avatarUrl: '🐼' }));
    await act(async () => { root.render(<ProfileCard onClose={() => {}} />); });
    const nameEl = container.querySelector('input[aria-label="玩家名字"]') as HTMLInputElement;
    expect(nameEl.value).toBe('主角甲');

    await act(async () => { findButton(container, '清除')!.click(); });
    expect(getPlayerProfile()).toBeNull();
  });

  it('空名字 → 保存禁用（不写档）', async () => {
    await act(async () => { root.render(<ProfileCard onClose={() => {}} />); });
    const save = findButton(container, '保存档案')!;
    expect(save.disabled).toBe(true);
    await act(async () => { save.click(); });
    expect(getPlayerProfile()).toBeNull();
  });
});

describe('Launcher · 👤 档案入口接线', () => {
  function mockFetch() {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
      ok: true,
      json: async () => (String(url).includes('/api/library') ? [] : {}),
    })));
  }
  it('点 👤 档案 → 档案卡出现（名字输入可见）', async () => {
    window.history.replaceState(null, '', '/?mode=player');
    mockFetch();
    await act(async () => { root.render(<Launcher />); });
    await flush();

    const btn = findButton(container, '玩家档案');
    expect(btn).toBeTruthy();
    await act(async () => { btn!.click(); });
    await flush();
    expect(container.querySelector('input[aria-label="玩家名字"]')).toBeTruthy();
  });
});
