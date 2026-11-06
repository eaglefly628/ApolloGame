// @vitest-environment happy-dom
// 引擎编辑器无头测试：Hub 列表 → 打开项目 → 资产树/层级/属性；乙档手调发出正确指针；UI 结构键只读；AI 指认上下文。
// fetch 全 mock（不依赖真 zerocraft.py）；场景预览替身（引擎渲染不在本测范围，真渲染已用浏览器目击）。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

vi.mock('../DataCartridgeRunner.js', () => ({ ManifestPreview: () => <div data-testid="scene-preview" /> }));
const { EditorApp, linkTypeFor, platformDeepLink } = await import('./EditorApp.js');

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PROJECT = {
  schema: 1, id: 'new1', name: '雨夜猫咖', entry: 'scenes/main',
  assets: [
    { id: 'scenes/main', type: 'scene', name: '主关卡', path: 'manifest.json' },
    { id: 'ui/hud', type: 'ui', name: '战斗 HUD', path: 'ui/hud.json' },
  ],
};
const FILES: Record<string, unknown> = {
  'manifest.json': { capabilities: ['a'], entities: { player: { Transform: { x: 120, y: 100 } }, ground: { Shape: { kind: 'box' } } } },
  'ui/hud.json': { type: 'Panel', id: 'hud', props: { title: 'T' }, children: [{ type: 'Label', id: 'score', props: { text: '分数 0' } }] },
};

let container: HTMLElement; let root: Root; let fetchMock: ReturnType<typeof vi.fn>;
let motionRunning = false; let linked: { type: string; ref: { platform: string; id: string } } | null = null;
async function flush() { for (let i = 0; i < 4; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); }
const $ = (sel: string) => container.querySelector(sel) as HTMLElement;

beforeEach(() => {
  motionRunning = false; linked = null; PROJECT.assets.splice(2);
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const u = new URL(url);
    let body: unknown = { success: false };
    if (u.pathname === '/api/editor/projects') body = { success: true, projects: [{ id: 'new1', name: '雨夜猫咖', assets: 2, updated: 0 }] };
    else if (u.pathname === '/api/editor/projects/new1') body = { success: true, project: PROJECT };
    else if (u.pathname.endsWith('/file')) body = { success: true, json: FILES[u.searchParams.get('path')!] };
    else if (u.pathname.endsWith('/changes')) body = { success: true, changes: [] };
    else if (u.pathname.endsWith('/edit')) body = { success: true, change: { by: 'human', ...JSON.parse(String(init?.body)) } };
    else if (u.pathname === '/api/platforms') body = { success: true, platforms: [{ id: 'motion', label: '动画平台', configured: true, running: motionRunning, url: null }] };
    else if (u.pathname === '/api/platforms/motion/launch') { motionRunning = true; body = { success: true, url: 'http://127.0.0.1:5891' }; }
    else if (u.pathname === '/api/platforms/motion/catalog') body = motionRunning
      ? { success: true, total: 2, items: [{ key: 'library:walk', id: 'walk', type: 'motion', title: 'Walking', status: 'ready' }, { key: 'capability:press', id: 'press', type: 'capability', title: '按压', status: 'planned' }] }
      : { success: false, running: false, error: '平台未运行：先启动它再搜索' };
    else if (u.pathname.endsWith('/link')) { const req = JSON.parse(String(init?.body)); linked = req; PROJECT.assets.push({ id: 'motion/walk', type: 'motion', name: 'Walking', ref: req.ref } as never); body = { success: true, asset: { id: 'motion/walk' } }; }
    return { ok: true, json: async () => body };
  });
  vi.stubGlobal('fetch', fetchMock);
  window.history.replaceState(null, '', '/');
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

describe('EditorApp · AI 原生引擎编辑器', () => {
  it('Hub 列出 new<n> 项目，点击进入编辑器并默认打开入口场景', async () => {
    const onLegacy = vi.fn();
    await act(async () => { root.render(<EditorApp onLegacy={onLegacy} />); });
    await flush();
    expect($('[data-project="new1"]').textContent).toContain('雨夜猫咖');
    await act(async () => { $('[data-project="new1"]').click(); });
    await flush();
    expect(window.location.search).toBe('?project=new1');
    expect($('[data-asset="scenes/main"]')).toBeTruthy();
    expect($('[data-testid="scene-preview"]')).toBeTruthy();
    expect($('[data-entity="player"]').textContent).toContain('player');
    expect($('[data-testid="ai-context"]').textContent).toContain('scenes/main');
  });

  it('选实体 → 属性面板手调数值，按原指针提交；AI 上下文带上实体', async () => {
    window.history.replaceState(null, '', '/?project=new1');
    await act(async () => { root.render(<EditorApp onLegacy={() => {}} />); });
    await flush();
    await act(async () => { $('[data-entity="player"]').click(); });
    await flush();
    expect($('[data-testid="ai-context"]').textContent).toContain('【选中实体】player');
    const input = $('input[aria-label="Transform.x"]') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    await act(async () => { setter.call(input, '260'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    await act(async () => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
    await flush();
    const edit = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/edit'));
    expect(JSON.parse(String(edit![1].body))).toEqual({ path: 'manifest.json', pointer: ['entities', 'player', 'Transform', 'x'], value: 260 });
  });

  it('非法输入不发请求（数字字段填字母）', async () => {
    window.history.replaceState(null, '', '/?project=new1');
    await act(async () => { root.render(<EditorApp onLegacy={() => {}} />); });
    await flush();
    await act(async () => { $('[data-entity="player"]').click(); });
    await flush();
    const input = $('input[aria-label="Transform.y"]') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    await act(async () => { setter.call(input, 'abc'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    await act(async () => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
    await flush();
    expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith('/edit'))).toBe(false);
    expect(container.textContent).toContain('须为数字');
  });

  it('UI 屏：层级列控件，type / id 只读、文案可调', async () => {
    window.history.replaceState(null, '', '/?project=new1');
    await act(async () => { root.render(<EditorApp onLegacy={() => {}} />); });
    await flush();
    await act(async () => { $('[data-asset="ui/hud"]').click(); });
    await flush();
    await act(async () => { $('[data-entity="score"]').click(); });
    await flush();
    expect($('input[aria-label="props.text"]')).toBeTruthy();
    expect($('input[aria-label="type"]')).toBeNull();
    expect($('input[aria-label="id"]')).toBeNull();
  });

  it('旧版创作台入口回调', async () => {
    const onLegacy = vi.fn();
    await act(async () => { root.render(<EditorApp onLegacy={onLegacy} />); });
    await flush();
    const legacy = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === '旧版创作台')!;
    await act(async () => { legacy.click(); });
    expect(onLegacy).toHaveBeenCalled();
  });
  it('链接素材：平台未运行 → 一键启动 → 搜索 → 以引用链接；规划中的能力不可链接', async () => {
    window.history.replaceState(null, '', '/?project=new1');
    await act(async () => { root.render(<EditorApp onLegacy={() => {}} />); });
    await flush();
    await act(async () => { $('[data-testid="link-open"]').click(); });
    await flush();
    const btnByText = (t: string) => Array.from(container.querySelectorAll('[role="dialog"] button')).find((b) => b.textContent === t) as HTMLButtonElement;
    await act(async () => { btnByText('搜索').click(); });
    await flush();
    expect($('[role="dialog"] [role="alert"]').textContent).toContain('平台未运行');
    await act(async () => { btnByText('启动动画平台').click(); });
    await flush();
    expect($('[data-catalog="walk"]').textContent).toContain('Walking');
    expect(($('[data-catalog="press"] button') as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { ($('[data-catalog="walk"] button') as HTMLButtonElement).click(); });
    await flush();
    expect(linked).toEqual({ type: 'motion', ref: { platform: 'motion', id: 'walk' }, name: 'Walking' });
    expect($('[role="dialog"]')).toBeNull();
    expect($('[data-asset="motion/walk"]')).toBeTruthy();
  });

  it('外部素材直达地址：动作进动作库、角色进交互页、只取源站根', () => {
    const m = { id: 'motion/a', type: 'motion' as const, ref: { platform: 'motion', id: 'Sitting Idle' } };
    expect(platformDeepLink('http://127.0.0.1:5891/driver/', m)).toBe('http://127.0.0.1:5891/library/?clip=Sitting%20Idle');
    expect(platformDeepLink('http://127.0.0.1:5891', { ...m, type: 'model' })).toBe('http://127.0.0.1:5891/interaction/?skin=Sitting%20Idle');
    expect(platformDeepLink('http://127.0.0.1:7000/', { ...m, ref: { platform: 'asset3d', id: 'x' } })).toBe('http://127.0.0.1:7000/');
  });

  it('目录条目类型 → 资产类型映射', () => {
    expect(linkTypeFor('motion', 'generated-motion')).toBe('motion');
    expect(linkTypeFor('motion', 'runtime-profile')).toBe('model');
    expect(linkTypeFor('motion', 'capability')).toBeNull();
    expect(linkTypeFor('asset3d', undefined)).toBe('model');
    expect(linkTypeFor('other', 'weird')).toBeNull();
  });
});
