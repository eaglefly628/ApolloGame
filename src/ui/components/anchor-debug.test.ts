// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LayoutNode } from './types.js';
import { renderNode } from './render.js';
import { mountAnchorDebug } from './anchor-debug.js';

const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function scene(): LayoutNode {
  return { type: 'Panel', id: 'canvas', props: { bare: true }, layout: { direction: 'overlay' }, children: [
    { type: 'Panel', id: 'group', props: { bare: true }, layout: { parentAnchor: { preset: 'top-right', offset: { x: -20, y: 10 } }, width: 160, height: 80 }, children: [
      { type: 'Button', id: 'buy', props: { label: 'Buy', action: 'buy' } },
    ] },
  ] };
}
function mount(tree = scene()) {
  const host = document.createElement('div');
  document.body.append(host);
  host.innerHTML = renderNode(tree);
  let current = tree;
  const api = mountAnchorDebug(host, () => current);
  cleanups.push(() => api.dispose());
  const chrome = document.body.lastElementChild as HTMLElement;
  const toggle = chrome.querySelector<HTMLButtonElement>('[data-anchor-debug-toggle]')!;
  const details = chrome.querySelector<HTMLElement>('[data-anchor-debug-details]')!;
  const overlay = chrome.querySelector<SVGElement>('[data-anchor-debug-overlay]')!;
  const get = (id: string) => [...host.querySelectorAll<HTMLElement>('[id]')].find(el => el.id === id)!;
  return { host, chrome, toggle, details, overlay, get, api, update: (next: LayoutNode) => { current = next; host.innerHTML = renderNode(next); api.sync(); } };
}
function geometry(el: HTMLElement, x: number, y: number, w: number, h: number, scale = 1) {
  vi.spyOn(el, 'getBoundingClientRect').mockImplementation(() => ({ x, y, left: x, top: y, width: w, height: h, right: x + w, bottom: y + h, toJSON() {} }));
  for (const [key, value] of Object.entries({ offsetWidth: w / scale, offsetHeight: h / scale, clientWidth: w / scale - 4, clientHeight: h / scale - 4, clientLeft: 2, clientTop: 2 })) {
    Object.defineProperty(el, key, { configurable: true, value });
  }
}

describe('parent anchor inspector', () => {
  it('starts closed, blocks business pointer/click/key activation while inspecting, Escape restores interaction', () => {
    const m = mount();
    const buy = m.get('buy');
    const action = vi.fn();
    const key = vi.fn();
    const down = vi.fn();
    m.host.addEventListener('click', action);
    buy.addEventListener('keydown', key);
    buy.addEventListener('pointerdown', down);
    expect(m.toggle.getAttribute('aria-pressed')).toBe('false');
    buy.click();
    expect(action).toHaveBeenCalledTimes(1);
    m.toggle.click();
    expect(m.toggle.getAttribute('aria-pressed')).toBe('true');
    for (const type of ['pointerdown', 'click']) buy.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    buy.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
    expect(action).toHaveBeenCalledTimes(1);
    expect(key).not.toHaveBeenCalled();
    expect(down).not.toHaveBeenCalled();
    expect(m.details.textContent).toContain('id: buy');
    buy.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(m.toggle.getAttribute('aria-pressed')).toBe('false');
    expect(m.overlay.childElementCount).toBe(0);
    buy.click();
    buy.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(action).toHaveBeenCalledTimes(2);
    expect(key).toHaveBeenCalledTimes(1);
    m.toggle.click();
    m.toggle.click();
    expect(m.toggle.getAttribute('aria-pressed')).toBe('false');
    buy.click();
    expect(action).toHaveBeenCalledTimes(3);
  });

  it('shows explicit normalized anchors and draws against the declared parent padding box under scale', () => {
    const m = mount();
    geometry(m.get('canvas'), 20, 30, 800, 400, 2);
    geometry(m.get('group'), 450, 50, 320, 160, 2);
    // A coincidental offsetParent must never replace the contract's direct parent.
    Object.defineProperty(m.get('group'), 'offsetParent', { configurable: true, value: document.body });
    m.get('group').setAttribute('data-parent-anchor-error', 'container too small');
    m.toggle.click();
    m.get('group').click();
    expect(m.details.textContent).toContain('几何父 id: canvas');
    expect(m.details.textContent).toContain('Panel / overlay');
    expect(m.details.textContent).toContain('显式 parentAnchor');
    expect(m.details.textContent).toContain('Anchor Min: (1, 0)');
    expect(m.details.textContent).toContain('Anchor Max: (1, 0)');
    expect(m.details.textContent).toContain('Pivot: (1, 0)');
    expect(m.details.textContent).toContain('Offset: (-20, 10)');
    expect(m.details.textContent).toContain('Insets: 上 0 / 右 0 / 下 0 / 左 0');
    expect(m.details.textContent).toContain('container too small');
    const range = m.overlay.querySelector('[data-debug-anchor="range"]')!;
    expect(range.getAttribute('x')).toBe('816'); // left=24, width=792, anchor x=1
    expect(range.getAttribute('y')).toBe('34');
    expect(m.overlay.querySelector('[data-debug-anchor="pivot"]')?.getAttribute('cx')).toBe('770');
    expect(m.overlay.querySelectorAll('[data-debug-box]')).toHaveLength(2);
  });

  it('reports flow itself separately from its nearest outer anchored group', () => {
    const m = mount();
    m.toggle.click();
    m.get('buy').click();
    expect(m.details.textContent).toContain('自身模式: flow（自身未声明 parentAnchor）');
    expect(m.details.textContent).toContain('几何父 id: group');
    expect(m.details.textContent).toContain('最近外层显式锚点组: group');
    expect(m.details.textContent).toContain('自身 parentAnchor: 未声明');
    expect(m.overlay.querySelector('[data-debug-anchor="pivot"]')).toBeNull();
  });

  it('keeps instances scoped and disposes listeners and all debug DOM', () => {
    const a = mount();
    const b = mount(); // Deliberately duplicate node ids across hosts.
    const action = vi.fn();
    b.host.addEventListener('click', action);
    a.toggle.click();
    a.get('buy').click();
    b.get('buy').click();
    expect(action).toHaveBeenCalledTimes(1);
    expect(b.toggle.getAttribute('aria-pressed')).toBe('false');
    expect(b.details.textContent).toBe('');
    a.api.dispose();
    expect(a.chrome.isConnected).toBe(false);
    expect(b.chrome.isConnected).toBe(true);
    const restored = vi.fn();
    a.host.addEventListener('click', restored);
    a.get('buy').click();
    expect(restored).toHaveBeenCalledOnce();
    expect(() => { a.api.sync(); a.api.dispose(); window.dispatchEvent(new Event('resize')); document.dispatchEvent(new Event('scroll')); }).not.toThrow();
  });

  it('collapses the opaque details panel for access to covered controls and can expand it again', () => {
    const m = mount();
    m.toggle.click(); m.get('group').click();
    const fold = m.chrome.querySelector<HTMLButtonElement>('[data-anchor-debug-fold]')!;
    const panel = m.chrome.querySelector<HTMLElement>('[data-anchor-debug-panel]')!;
    expect(m.details.hidden).toBe(false);
    fold.click();
    expect(m.details.hidden).toBe(true);
    expect(panel.style.width).toContain('210px');
    expect(fold.getAttribute('aria-expanded')).toBe('false');
    m.get('buy').click();
    expect(m.details.textContent).toContain('id: buy');
    fold.click();
    expect(m.details.hidden).toBe(false);
    expect(fold.getAttribute('aria-expanded')).toBe('true');
  });

  it('never inspects its own chrome even when the mount host is the document body', () => {
    document.body.innerHTML = renderNode(scene());
    const api = mountAnchorDebug(document.body, scene);
    cleanups.push(() => api.dispose());
    const toggle = document.querySelector<HTMLButtonElement>('[data-anchor-debug-toggle]')!;
    const fold = document.querySelector<HTMLButtonElement>('[data-anchor-debug-fold]')!;
    toggle.click();
    fold.click();
    expect(fold.getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelector('[data-anchor-debug-details]')?.textContent).toBe('尚未选中控件。');
    toggle.click();
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
  });

  it('refreshes on host/selection/parent resize without observing its own chrome or re-observe loops', () => {
    let notify: () => void = () => {};
    const observe = vi.fn();
    const unobserve = vi.fn();
    const disconnect = vi.fn();
    const original = window.ResizeObserver;
    window.ResizeObserver = class {
      constructor(callback: () => void) { notify = callback; }
      observe = observe;
      unobserve = unobserve;
      disconnect = disconnect;
    } as unknown as typeof ResizeObserver;
    cleanups.push(() => { window.ResizeObserver = original; });
    const m = mount();
    const el = m.get('group');
    let x = 10;
    vi.spyOn(el, 'getBoundingClientRect').mockImplementation(() => ({ x, left: x, top: 0, y: 0, right: x + 100, bottom: 50, width: 100, height: 50, toJSON() {} }));
    m.toggle.click(); el.click();
    expect(observe.mock.calls.map(([target]) => target)).toEqual([m.host, el, m.get('canvas')]);
    x = 25; notify();
    expect(m.details.textContent).toContain('x=25');
    expect(observe).toHaveBeenCalledTimes(3);
    notify(); expect(observe).toHaveBeenCalledTimes(3);
    m.toggle.click(); expect(unobserve).toHaveBeenCalledTimes(3);
    m.api.dispose(); expect(disconnect).toHaveBeenCalledOnce();
  });

  it('refreshes selected geometry on sync/resize/scroll and reports removal after an update', () => {
    const m = mount();
    const el = m.get('group');
    let x = 10;
    vi.spyOn(el, 'getBoundingClientRect').mockImplementation(() => ({ x, left: x, top: 0, y: 0, right: x + 100, bottom: 50, width: 100, height: 50, toJSON() {} }));
    m.toggle.click();
    el.click();
    expect(m.details.textContent).toContain('x=10');
    x = 20; window.dispatchEvent(new Event('resize'));
    expect(m.details.textContent).toContain('x=20');
    x = 30; document.dispatchEvent(new Event('scroll'));
    expect(m.details.textContent).toContain('x=30');
    x = 40; m.api.sync();
    expect(m.details.textContent).toContain('x=40');
    m.update({ type: 'Label', id: 'other', props: { text: 'Other' } });
    expect(m.details.textContent).toContain('节点当前未渲染或已移除');
    expect(m.overlay.childElementCount).toBe(0);
  });

  it('treats unknown DOM ids and rejected declarations as text, without HTML injection or guessed anchors', () => {
    const m = mount();
    const unknown = document.createElement('button');
    unknown.id = '<img src=x onerror="window.hacked=1">';
    m.host.append(unknown);
    m.toggle.click(); unknown.click();
    expect(m.details.textContent).toContain(unknown.id);
    expect(m.details.textContent).toContain('未知 DOM 节点');
    expect(m.details.querySelector('img')).toBeNull();
    expect(m.overlay.querySelector('[data-debug-anchor]')).toBeNull();
    const invalid = scene();
    invalid.children![0].layout!.parentAnchor!.preset = '<svg/onload=alert(1)>' as never;
    // Rejected data can enter from development tools; the inspector must remain usable.
    const api = mountAnchorDebug(m.host, () => invalid);
    cleanups.push(() => api.dispose());
    const chrome = document.body.lastElementChild!;
    (chrome.querySelector('[data-anchor-debug-toggle]') as HTMLElement).click();
    // Close first instance so its capture listener doesn't consume this selection.
    m.toggle.click();
    m.get('group').click();
    const details = chrome.querySelector('[data-anchor-debug-details]')!;
    expect(details.textContent).toContain('锚点声明错误');
    expect(details.textContent).toContain('<svg/onload=alert(1)>');
    expect(details.querySelector('svg')).toBeNull();
  });
});
