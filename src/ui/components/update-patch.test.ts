// @vitest-environment happy-dom
// mountUI().update —— 局部更新（diff/patch）：只替换真变了的子树，其余 DOM 原样保留。
// 标准 UI 做法；替代整树 innerHTML 重挂（后者丢 Tab/滚动/native 输入态 + 触发合成层陈旧重绘）。
import { describe, it, expect } from 'vitest';
import { mountUI } from './server.js';
import { SHELL } from '../shell-theme.js';
import type { LayoutNode } from './types.js';

const tree = (label: string, n: number): LayoutNode => ({
  type: 'Panel', id: 'root', props: {}, layout: { direction: 'column' },
  children: [
    { type: 'Label', id: 'a', props: { text: label } },
    { type: 'Panel', id: 'mid', props: {}, layout: { direction: 'row' }, children: [
      { type: 'Badge', id: 'b', props: { text: `n=${n}` } },
    ] },
  ],
});

describe('UI Components · mountUI().update 局部更新', () => {
  it('只替换变了的节点·未变节点保持同一 DOM 实例（身份不丢）', () => {
    const host = document.createElement('div');
    const handle = mountUI(host, tree('hi', 1));
    const aBefore = host.querySelector('#a') as HTMLElement;
    aBefore.dataset['mark'] = 'keep'; // 标记未变节点，验证 update 后仍是同一元素

    handle.update(tree('hi', 2)); // 只有 #b 文本变

    const aAfter = host.querySelector('#a') as HTMLElement;
    const bAfter = host.querySelector('#b') as HTMLElement;
    expect(aAfter.dataset['mark']).toBe('keep');     // #a 未被替换（身份保留）
    expect(bAfter.textContent).toContain('n=2');      // #b 已更新
  });

  it('换皮（theme 变）整树按新主题重渲·内容在', () => {
    const host = document.createElement('div');
    const handle = mountUI(host, tree('hi', 1));
    handle.update(tree('hi', 1), { ...SHELL, text: '#ff0000' });
    expect(host.querySelector('#a')).toBeTruthy();
    expect(host.innerHTML).toContain('#ff0000');
  });

  it('焦点保护：update 改聚焦 Input 的 value 时不销毁重建（保焦点/光标）', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const tree = (v: string): LayoutNode => ({
      type: 'Panel', id: 'root', props: {}, children: [
        { type: 'Input', id: 'in', props: { value: v, action: 'set' } },
      ],
    });
    const handle = mountUI(host, tree('a'));
    const inp = host.querySelector('#in') as HTMLInputElement;
    (inp as HTMLElement & { _mark?: string })._mark = 'keep';
    inp.focus();
    expect(document.activeElement).toBe(inp);

    handle.update(tree('ab')); // value 变（受控输入·像每次按键）

    const after = host.querySelector('#in') as HTMLInputElement & { _mark?: string };
    expect(after._mark).toBe('keep');           // 同一 DOM 实例（未重建）
    expect(after.value).toBe('ab');             // 值已就地覆写
    expect(document.activeElement).toBe(after);  // 焦点仍在
    host.remove();
  });

  it('teardown 仍可直接调用（向后兼容）', () => {
    const host = document.createElement('div');
    const handle = mountUI(host, tree('x', 1));
    handle();                       // 作为函数调用 = teardown
    expect(host.innerHTML).toBe('');
  });
});
