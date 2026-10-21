// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { ANCHOR_PRESETS, normalizeParentAnchor, solveParentAnchor } from './parent-anchor.js';
import { solveLayout } from './layout-solver.js';
import { validateLayoutNode } from './validate.js';
import { mountUI } from './server.js';
import { mountParentAnchors } from './parent-anchor-dom.js';
import { renderNode } from './render.js';
import type { LayoutConstraints, LayoutNode, ParentAnchor } from './types.js';

const leaf = (id: string, layout: LayoutConstraints): LayoutNode => ({ type: 'Label', id, props: { text: id }, layout });
const canvas = (children: LayoutNode[]): LayoutNode => ({ type: 'Panel', id: 'root', props: { bare: true }, layout: { direction: 'overlay', padding: 0 }, children });
const measure = () => ({ w: 40, h: 20 });
describe('父矩形锚点合同', () => {
  it.each(Object.entries(ANCHOR_PRESETS))('九点 %s 相对父矩形，自身同名点对齐', (preset, p) => {
    const c = { parentAnchor: { preset: preset as keyof typeof ANCHOR_PRESETS } };
    expect(solveParentAnchor({ x: 50, y: 30, w: 300, h: 200 }, measure(), c)).toEqual({ x: 50 + 260 * p.x, y: 30 + 180 * p.y, w: 40, h: 20 });
  });
  it('独立 pivot 与父锚点不同；定点偏移右/下为正', () => {
    expect(solveParentAnchor({ x: 0, y: 0, w: 300, h: 200 }, measure(), { parentAnchor: { preset: 'bottom-right', pivot: { x: 0, y: .5 }, offset: { x: -12, y: -8 } } })).toEqual({ x: 288, y: 182, w: 40, h: 20 });
  });
  it('锚定 bare 分组的默认 padding 与 HTML 都是零', () => {
    const group: LayoutNode = { type: 'Panel', id: 'group', props: { bare: true }, layout: { parentAnchor: { preset: 'top-right' } }, children: [leaf('content', {})] };
    expect(solveLayout(canvas([group]), { w: 300, h: 200 }, measure).get('group')).toEqual({ x: 260, y: 0, w: 40, h: 20 });
  });
  it('横伸缩纵定点，边距与 maxWidth 封顶后的 pivot 都生效', () => {
    const c: LayoutConstraints = { height: 44, maxWidth: 120, parentAnchor: { anchorMin: { x: .1, y: 1 }, anchorMax: { x: .9, y: 1 }, pivot: { x: .5, y: 1 }, insets: { left: 10, right: 10 }, offset: { y: -8 } } };
    expect(solveParentAnchor({ x: 20, y: 30, w: 300, h: 200 }, measure(), c)).toEqual({ x: 110, y: 178, w: 120, h: 44 });
  });
  it('双轴伸缩与嵌套父锚点，窗口往返不累积漂移', () => {
    const child = canvas([leaf('pin', { width: 40, height: 20, parentAnchor: { preset: 'bottom-right', offset: { x: -6, y: -8 } } })]);
    child.id = 'nested'; child.layout = { direction: 'overlay', padding: 0, parentAnchor: { anchorMin: { x: 0, y: 0 }, anchorMax: { x: 1, y: 1 }, insets: { left: 10, right: 20, top: 30, bottom: 40 } } };
    const tree = canvas([child]);
    for (const w of [300, 740, 300]) {
      const result = solveLayout(tree, { w, h: 200 }, measure);
      expect(result.get('nested')).toEqual({ x: 10, y: 30, w: w - 30, h: 130 });
      expect(result.get('pin')).toEqual({ x: w - 66, y: 132, w: 40, h: 20 });
    }
  });
  it('伸缩长度不足拒收，不能生成负尺寸或静默缩小', () => {
    expect(() => solveParentAnchor({ x: 0, y: 0, w: 30, h: 50 }, measure(), { minWidth: 20, parentAnchor: { anchorMin: { x: 0, y: 0 }, anchorMax: { x: 1, y: 0 }, insets: { left: 10, right: 10 } } })).toThrow('小于最小尺寸');
  });
  it.each([
    { preset: 'unknown' }, { preset: 'center', anchorMin: { x: 0, y: 0 } },
    { anchorMin: { x: 1, y: 0 }, anchorMax: { x: 0, y: 0 } },
    { preset: 'center', pivot: { x: 2, y: 0 } }, { preset: 'center', offset: { x: NaN } },
    { preset: 'center', insets: { top: 2 } }, { preset: 'center', offset: '12' },
    { preset: 'center', extra: 1 },
    { preset: 'center', offset: { x: null } }, { preset: 'center', pivot: null }, { preset: 'center', insets: { top: null } },
  ])('非法合同拒收 %j', (value) => expect(() => normalizeParentAnchor(value as ParentAnchor)).toThrow());
  it('校验流布局争夺、伸缩显式尺寸争夺、重复实例 id', () => {
    const node = leaf('pin', { width: 20, parentAnchor: { anchorMin: { x: 0, y: 0 }, anchorMax: { x: 1, y: 0 } } });
    expect(validateLayoutNode(canvas([node])).some(i => i.kind === 'bad-parent-anchor')).toBe(true);
    expect(validateLayoutNode({ ...canvas([leaf('pin', { parentAnchor: { preset: 'center' } })]), layout: { direction: 'row' } }).some(i => i.detail.includes('直接父节点'))).toBe(true);
    expect(validateLayoutNode(canvas([leaf('same', { x: 0 }), leaf('same', { x: 20 })])).some(i => i.kind === 'duplicate-id')).toBe(true);
  });
  it('控件专用 props 内部布局不能静默吞掉父锚点', () => {
    const tree: LayoutNode = { type: 'Tooltip', id: 'tip', props: { bubble: canvas([leaf('pin', { parentAnchor: { preset: 'center' } })]) }, children: [leaf('trigger', {})] };
    expect(validateLayoutNode(tree).some(i => i.detail.includes('props.bubble'))).toBe(true);
    expect(() => mountUI(document.createElement('div'), tree)).toThrow('props.bubble');
  });
  it('旧引导 anchor 不改变布局行为', () => {
    const n = leaf('old', { x: 12, y: 8, anchor: 'tutorial' });
    expect(solveLayout(canvas([n]), { w: 100, h: 100 }, measure).get('old')).toEqual({ x: 12, y: 8, w: 40, h: 20 });
  });
  it('含父锚点的重复 id 在 mount 前拒收；流光不覆盖 absolute', () => {
    const host = document.createElement('div');
    const pin = leaf('pin', { width: 40, height: 20, parentAnchor: { preset: 'center' }, fx: [{ kind: 'sheen-hover' }] });
    expect(() => mountUI(host, canvas([pin, { ...pin }]))).toThrow('duplicate');
    expect(host.innerHTML).toBe('');
    const stop = mountUI(host, canvas([pin]));
    expect(host.querySelector<HTMLElement>('#pin')!.style.position).toBe('absolute');
    stop();
  });
  it('固定 cols、justify、根 maxWidth 在独立求解器生效', () => {
    const tree: LayoutNode = { type: 'Panel', id: 'root', props: { bare: true }, layout: { direction: 'grid', cols: 1, gap: 0, padding: 0 }, children: [leaf('a', {}), leaf('b', {})] };
    expect(solveLayout(tree, { w: 300, h: 100 }, measure).get('b')).toEqual({ x: 0, y: 20, w: 300, h: 20 });
    tree.layout = { direction: 'row', gap: 0, padding: 0, justify: 'center' };
    expect(solveLayout(tree, { w: 300, h: 100 }, measure).get('a')!.x).toBe(110);
    tree.layout.maxWidth = 100;
    expect(solveLayout(tree, { w: 300, h: 100 }, measure).get('root')).toEqual({ x: 100, y: 0, w: 100, h: 100 });
  });
});

describe('浏览器父锚点接线', () => {
  it('负空间跨子树替换仍保留上次有效矩形，并可恢复', () => {
    const tree = canvas([leaf('stretch', { height: 20, minWidth: 100, parentAnchor: { anchorMin: { x: 0, y: 0 }, anchorMax: { x: 1, y: 0 }, insets: { left: 10, right: 10 } } })]);
    const host = document.createElement('div'); document.body.append(host);
    let width = 300;
    const replace = (): void => {
      host.innerHTML = renderNode(tree);
      Object.defineProperties(host.querySelector('#root')!, { clientWidth: { get: () => width }, clientHeight: { get: () => 200 } });
    };
    replace();
    const runtime = mountParentAnchors(host, () => tree);
    expect(host.querySelector<HTMLElement>('#stretch')!.style.width).toBe('280px');
    width = 50; replace(); runtime.sync();
    const el = host.querySelector<HTMLElement>('#stretch')!;
    expect(el.style.width).toBe('280px'); expect(el.style.left).toBe('10px');
    expect(el.dataset.parentAnchorError).toContain('小于最小尺寸');
    width = 400; runtime.sync();
    expect(el.style.width).toBe('380px'); expect(el.style.minWidth).toBe('100px');
    expect(el.hasAttribute('data-parent-anchor-error')).toBe(false);
    runtime.dispose(); host.remove();
  });
  it('首次几何无解不显示无效结果，空间恢复后可见', () => {
    const tree = canvas([leaf('stretch', { height: 20, minWidth: 100, parentAnchor: { anchorMin: { x: 0, y: 0 }, anchorMax: { x: 1, y: 0 } } })]);
    const host = document.createElement('div'); host.innerHTML = renderNode(tree); document.body.append(host);
    let width = 40;
    Object.defineProperties(host.querySelector('#root')!, { clientWidth: { get: () => width }, clientHeight: { get: () => 200 } });
    const runtime = mountParentAnchors(host, () => tree);
    const el = host.querySelector<HTMLElement>('#stretch')!;
    expect(el.style.visibility).toBe('hidden');
    width = 400; runtime.sync();
    expect(el.style.visibility).toBe(''); expect(el.style.width).toBe('400px');
    runtime.dispose(); host.remove();
  });
  it('父尺寸更新重算、更新后新节点接线、非法更新保留旧 DOM、释放后移除', () => {
    const host = document.createElement('div'); document.body.append(host);
    const tree = canvas([leaf('pin', { width: 40, height: 20, parentAnchor: { preset: 'bottom-right', offset: { x: -12, y: -8 } } })]);
    const handle = mountUI(host, tree);
    const root = host.querySelector<HTMLElement>('#root')!;
    let width = 300;
    Object.defineProperties(root, { clientWidth: { get: () => width }, clientHeight: { get: () => 200 } });
    const anchors = mountParentAnchors(host, () => tree);
    const pin = host.querySelector<HTMLElement>('#pin')!;
    expect(pin.style.left).toBe('248px'); expect(pin.style.top).toBe('172px');
    width = 500; anchors.sync(); expect(pin.style.left).toBe('448px');
    const before = host.innerHTML;
    expect(() => handle.update(canvas([leaf('bad', { parentAnchor: { preset: 'center' }, flex: 1 })]))).toThrow('混用');
    expect(host.innerHTML).toBe(before);
    anchors.dispose(); handle(); host.remove();
  });
});
