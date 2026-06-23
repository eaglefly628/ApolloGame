// 世界绑定解析（收编 GameShell stat/bar/image-bind 入 LayoutNode）：resolveBindings 用注入的
// UIDataSource 把 bind 节点填成字面值，纯函数、不改原树、未命中原样透传。
import { describe, it, expect } from 'vitest';
import { resolveBindings, type UIDataSource } from './bindings.js';
import { renderNode } from './render.js';
import type { LayoutNode } from './types.js';

const ds: UIDataSource = {
  resource: (id) => ({ hp: { current: 30, max: 120 }, score: { current: 1450 } }[id]),
  value: (id) => ({ portrait: 'guanyu.png' }[id]),
};

describe('UI Components · resolveBindings 世界绑定', () => {
  it('Label.bind → text 接 Resource.current（text 作前缀）', () => {
    const out = resolveBindings({ type: 'Label', id: 'l', props: { text: '战功 ', bind: 'score' } }, ds);
    expect((out.props as { text: string }).text).toBe('战功 1450');
  });

  it('ProgressBar.bind → value/max 取自 Resource', () => {
    const out = resolveBindings({ type: 'ProgressBar', id: 'b', props: { value: 0, bind: 'hp', tone: 'danger' } }, ds);
    const p = out.props as { value: number; max?: number };
    expect(p.value).toBe(30); expect(p.max).toBe(120);
    expect(renderNode(out)).toContain('width:25%'); // 30/120 渲染成 25%
  });

  it('Image.bind → src 取自 value（StringVar）', () => {
    const out = resolveBindings({ type: 'Image', id: 'i', props: { src: '', bind: 'portrait' } }, ds);
    expect((out.props as { src: string }).src).toBe('guanyu.png');
  });

  it('无 bind / 未命中 → 原样透传；递归子节点；不改原树', () => {
    const tree: LayoutNode = {
      type: 'Panel', id: 'p', props: {}, children: [
        { type: 'Label', id: 'a', props: { text: '纯文本' } },               // 无 bind
        { type: 'Label', id: 'b', props: { text: 'X', bind: '不存在' } },     // 未命中
        { type: 'ProgressBar', id: 'c', props: { value: 5, bind: 'hp' } },    // 命中（递归到子）
      ],
    };
    const out = resolveBindings(tree, ds);
    const kids = out.children!;
    expect((kids[0]!.props as { text: string }).text).toBe('纯文本');        // 无 bind 不动
    expect((kids[1]!.props as { text: string }).text).toBe('X');             // 未命中不动
    expect((kids[2]!.props as { value: number }).value).toBe(30);            // 子节点也解析
    expect((tree.children![2]!.props as { value: number }).value).toBe(5);   // 原树未被改（纯函数）
  });
});
