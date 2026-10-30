// @vitest-environment happy-dom
// 外部平台入口（三平台合并 P0）：清单来自 /api/platforms；点按钮 → 同步开空窗 → POST launch → 导航到返回地址；
// 未配置不发请求只提示；失败关空窗并显示原因。fetch / window.open 全 mock，不依赖真 zerocraft.py。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { PlatformLauncher, type PlatformInfo } from './PlatformLauncher.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const LIST: PlatformInfo[] = [
  { id: 'motion', label: '动画平台', configured: true, mode: 'command', running: false, url: null },
  { id: 'asset3d', label: '3D 资产平台', configured: false, mode: null, running: false, url: null },
];

let container: HTMLElement; let root: Root;
let launchResp: Record<string, unknown>;
let fetchMock: ReturnType<typeof vi.fn>;
let fakeWin: { location: { href: string }; close: ReturnType<typeof vi.fn> };

async function flush() { for (let i = 0; i < 3; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); }
const btn = (id: string) => container.querySelector(`button[data-platform="${id}"]`) as HTMLButtonElement;

beforeEach(() => {
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  launchResp = { success: true, url: 'http://127.0.0.1:5891', started: true };
  fetchMock = vi.fn(async (url: string) => ({ ok: true, json: async () => (url.endsWith('/launch') ? launchResp : { success: true, platforms: LIST, configFile: '.zerocraft/platforms.json' }) }));
  vi.stubGlobal('fetch', fetchMock);
  fakeWin = { location: { href: 'about:blank' }, close: vi.fn() };
  vi.spyOn(window, 'open').mockImplementation(() => fakeWin as unknown as Window);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('PlatformLauncher · 从创作平台拉起独立平台', () => {
  it('按 /api/platforms 渲染入口；未配置的置灰提示配置文件', async () => {
    await act(async () => { root.render(<PlatformLauncher />); });
    await flush();
    expect(btn('motion').textContent).toContain('动画平台');
    expect(btn('asset3d').title).toContain('未配置');
  });

  it('点击：先同步开空窗，再 POST launch，导航到返回的本机地址', async () => {
    await act(async () => { root.render(<PlatformLauncher />); });
    await flush();
    await act(async () => { btn('motion').click(); });
    await flush();
    expect(window.open).toHaveBeenCalledWith('about:blank', 'zerocraft-motion');
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:4000/api/platforms/motion/launch', expect.objectContaining({ method: 'POST' }));
    expect(fakeWin.location.href).toBe('http://127.0.0.1:5891');
  });

  it('未配置：不开窗不发 launch，只提示', async () => {
    await act(async () => { root.render(<PlatformLauncher />); });
    await flush();
    await act(async () => { btn('asset3d').click(); });
    await flush();
    expect(window.open).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith('/launch'))).toBe(false);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('platforms.asset3d');
  });

  it('拉起失败：关掉空窗并显示服务端原因', async () => {
    launchResp = { success: false, error: '进程退出（code=1），详见终端输出' };
    await act(async () => { root.render(<PlatformLauncher />); });
    await flush();
    await act(async () => { btn('motion').click(); });
    await flush();
    expect(fakeWin.close).toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('code=1');
  });
});
