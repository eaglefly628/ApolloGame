// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { mountUI } from './server.js';
import { mountParentAnchors } from './parent-anchor-dom.js';
import { renderNode } from './render.js';
import { solveLayout } from './layout-solver.js';
import type { LayoutConstraints, LayoutNode } from './types.js';

afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });
const pin = (): LayoutNode => ({ type: 'Label', id: 'pin', props: { text: 'pin' }, layout: { width: 20, height: 20, parentAnchor: { preset: 'bottom-right' } } });
const canvas = (layout: LayoutConstraints = {}): LayoutNode => ({ type: 'Panel', id: 'canvas', props: { bare: true }, layout: { direction: 'overlay', ...layout }, children: [pin()] });
const measure = () => ({ w: 40, h: 20 });

it('F3 最后一个根锚点移除即释放 host 定位所有权', () => {
  const host = document.createElement('div'); host.style.position = 'static'; document.body.append(host);
  const tree: LayoutNode = { type: 'Button', id: 'anchored', props: { label: 'anchor' }, layout: { width: 100, height: 40, parentAnchor: { preset: 'center' } } };
  const stop = mountUI(host, tree);
  expect(host.style.position).toBe('relative');
  stop.update({ type: 'Button', id: 'legacy', props: { label: 'legacy' }, layout: { x: 20, y: 10, width: 100, height: 40 } });
  expect(host.style.position).toBe('static');
  stop();
});

it('F3 释放时尊重外部修改后的 host 定位样式', () => {
  const host = document.createElement('div'); host.style.position = 'static'; document.body.append(host);
  const tree = pin(); const stop = mountUI(host, tree);
  host.style.position = 'fixed';
  stop.update({ type: 'Label', id: 'legacy', props: { text: 'legacy' } });
  expect(host.style.position).toBe('fixed'); stop();
  expect(host.style.position).toBe('fixed');
});

it('F4 有效→拒收→恢复会重新量自然高度，且保留 auto 尺寸语义', () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const tree = canvas(); tree.children![0] = { type: 'Label', id: 'text', props: { text: 'wrapping content' }, layout: { minWidth: 100, parentAnchor: { anchorMin: { x: 0, y: .5 }, anchorMax: { x: 1, y: .5 } } } };
  const host = document.createElement('div'); host.innerHTML = renderNode(tree); document.body.append(host);
  const parent = host.querySelector<HTMLElement>('#canvas')!, text = host.querySelector<HTMLElement>('#text')!;
  let width = 300;
  Object.defineProperties(parent, { clientWidth: { get: () => width }, clientHeight: { get: () => 200 } });
  Object.defineProperties(text, {
    offsetWidth: { get: () => Number.parseFloat(text.style.width) || width },
    offsetHeight: { get: () => Number.parseFloat(text.style.height) || (Number.parseFloat(text.style.width) < 200 ? 162 : 90) },
  });
  const runtime = mountParentAnchors(host, () => tree);
  expect(text.style.top).toBe('55px');
  width = 50; runtime.sync(); expect(text.dataset.parentAnchorError).toContain('小于最小尺寸');
  width = 150; runtime.sync();
  expect(text.style.height).toBe(''); expect(text.offsetHeight).toBe(162); expect(text.style.top).toBe('19px');
  expect(text.dataset.parentAnchorError).toBeUndefined(); runtime.dispose();
});

it('F5 可见且已连接的显式零尺寸画布必须拒收，恢复尺寸后重算', () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const tree = canvas({ width: 0, height: 0 });
  tree.children![0].layout = { height: 20, minWidth: 100, parentAnchor: { anchorMin: { x: 0, y: 0 }, anchorMax: { x: 1, y: 0 } } };
  const host = document.createElement('div'); host.innerHTML = renderNode(tree); document.body.append(host);
  const parent = host.querySelector<HTMLElement>('#canvas')!, child = host.querySelector<HTMLElement>('#pin')!;
  const runtime = mountParentAnchors(host, () => tree);
  expect(child.dataset.parentAnchorError).toContain('小于最小尺寸'); expect(child.style.visibility).toBe('hidden');
  parent.style.width = '240px'; parent.style.height = '100px'; runtime.sync();
  expect(child.dataset.parentAnchorError).toBeUndefined(); expect(child.style.visibility).toBe('');
  runtime.dispose();
});

it('F5 脱离文档或 display:none 的画布可延迟测量', () => {
  const tree = canvas({ width: 0, height: 0 }); tree.children![0].layout!.minWidth = 100;
  const host = document.createElement('div'); host.innerHTML = renderNode(tree);
  const runtime = mountParentAnchors(host, () => tree), child = host.querySelector<HTMLElement>('#pin')!;
  expect(child.dataset.parentAnchorError).toBeUndefined();
  host.style.display = 'none'; document.body.append(host); runtime.sync();
  expect(child.dataset.parentAnchorError).toBeUndefined(); runtime.dispose();
});

it.each([
  { name: 'minWidth', c: { width: 100, height: 100, minWidth: 220 }, root: { x: 0, y: 0, w: 220, h: 100 }, point: { x: 200, y: 80, w: 20, h: 20 } },
  { name: 'minHeight', c: { width: 100, height: 100, minHeight: 220 }, root: { x: 0, y: 0, w: 100, h: 220 }, point: { x: 80, y: 200, w: 20, h: 20 } },
  { name: 'maxHeight', c: { width: 100, height: 100, maxHeight: 60 }, root: { x: 0, y: 0, w: 100, h: 60 }, point: { x: 80, y: 40, w: 20, h: 20 } },
])('F6 根画布 $name 与实际 CSS 尺寸约束一致', ({ c, root, point }) => {
  const result = solveLayout(canvas(c), { w: 300, h: 300 }, measure);
  expect(result.get('canvas')).toEqual(root); expect(result.get('pin')).toEqual(point);
});

it('F6 intrinsic 和 arrange 均消费嵌套父画布约束', () => {
  const nested = canvas({ width: 100, height: 100, minHeight: 220, minWidth: 200, maxWidth: 240 });
  const root: LayoutNode = { type: 'Panel', id: 'root', props: { bare: true }, layout: { direction: 'column', padding: 0 }, children: [nested] };
  const result = solveLayout(root, { w: 300, h: 400 }, measure);
  expect(result.get('canvas')).toMatchObject({ w: 200, h: 220 }); expect(result.get('pin')).toMatchObject({ w: 20, h: 20, y: 200 });
});

it('F6 尺寸约束不改变显式 align:center 的溢出居中语义', () => {
  const root: LayoutNode = { type: 'Panel', id: 'root', props: { bare: true }, layout: { direction: 'column', align: 'center', width: 100, height: 100, padding: 0, gap: 0 }, children: [
    { type: 'Label', id: 'wide', props: { text: 'wide' }, layout: { width: 220, height: 20 } },
  ] };
  expect(solveLayout(root, { w: 300, h: 300 }, measure).get('wide')).toEqual({ x: -60, y: 0, w: 220, h: 20 });
});
