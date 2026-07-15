// @vitest-environment happy-dom
// 休闲 juice 五补（owner 2026-07-15）：UI 庆祝粒子 Particles / 退场动画 fadeOut·popOut·floatUp /
//   环形进度 ProgressBar.shape:'ring' / 全息箔 fx:'holo' / 描边字 Label.stroke。全 render-only·纯数据。
import { describe, it, expect } from 'vitest';
import { renderNode, validateLayoutNode } from './index.js';
import type { LayoutNode } from './index.js';

const P = (layout: LayoutNode['layout']): string => renderNode({ type: 'Panel', id: 'p', props: {}, layout, children: [] });

describe('休闲 juice 五补', () => {
  it('退场动画 fadeOut/popOut → 一次性 both（播完停末态·不循环）', () => {
    expect(P({ anim: 'fadeOut' })).toMatch(/animation:apollo-fadeOut \d+ms .*both/);
    expect(P({ anim: 'popOut' })).toMatch(/animation:apollo-popOut \d+ms .*both/);
    // floatUp=升冒·循环（+N 飘字）·不是一次性
    expect(P({ anim: 'floatUp' })).toMatch(/animation:apollo-floatUp \d+ms ease-in-out infinite/);
  });

  it('fx:holo → data-fx 含 holo（全息箔叠层·position:relative）', () => {
    const html = renderNode({ type: 'Panel', id: 'card', props: {}, layout: { fx: [{ kind: 'holo' }] }, children: [] });
    expect(html).toContain('data-fx="holo"');
    expect(html).toContain('position:relative'); // 叠层锚
    // 与 sheen 叠加不互斥
    const both = renderNode({ type: 'Panel', id: 'c2', props: {}, layout: { fx: [{ kind: 'holo' }, { kind: 'sheen' }] }, children: [] });
    expect(both).toContain('holo');
    expect(both).toContain('sheen');
  });

  it('Label.stroke → text-stroke 描边 + paint-order（填色在描边之上·可读）', () => {
    const html = renderNode({ type: 'Label', id: 'l', props: { text: 'GO', stroke: true, size: 'xl', color: 'gold' } });
    expect(html).toContain('-webkit-text-stroke:2px');
    expect(html).toContain('paint-order:stroke fill');
    // 无 stroke 不加（不回归）
    expect(renderNode({ type: 'Label', id: 'l2', props: { text: 'x' } })).not.toContain('text-stroke');
  });

  it('ProgressBar.shape:ring → conic-gradient 环 + 中心值（非线性条）', () => {
    const html = renderNode({ type: 'ProgressBar', id: 'r', props: { value: 0.75, shape: 'ring', showValue: true, tone: 'ok', size: 80 } });
    expect(html).toContain('conic-gradient');
    expect(html).toContain('border-radius:50%');
    expect(html).toContain('width:80px');
    expect(html).toContain('75%'); // 中心显值
    // 缺省 bar 仍是线性条（不回归）
    expect(renderNode({ type: 'ProgressBar', id: 'b', props: { value: 0.5 } })).not.toContain('conic-gradient');
  });

  it('Particles → 铺满叠层 + N 个确定式粒子（无 Math.random·pointer-events:none）', () => {
    const html = renderNode({ type: 'Particles', id: 'fx', props: { kind: 'confetti', count: 20 }, layout: { width: 200, height: 120 } });
    expect(html).toContain('pointer-events:none');
    expect(html).toContain('apollo-p-fall'); // 下落动画
    expect((html.match(/<span/g) ?? []).length).toBe(20); // 恰 20 片
    // 确定式：两次渲染逐字节一致（可回归·非随机）
    const again = renderNode({ type: 'Particles', id: 'fx', props: { kind: 'confetti', count: 20 }, layout: { width: 200, height: 120 } });
    expect(again).toBe(html);
    // 星光爆走径向 burst；微光走 twinkle
    expect(renderNode({ type: 'Particles', id: 's', props: { kind: 'stars' } })).toContain('apollo-p-burst');
    expect(renderNode({ type: 'Particles', id: 'k', props: { kind: 'sparkle' } })).toContain('apollo-p-twinkle');
    // count 上限 60 封顶
    expect((renderNode({ type: 'Particles', id: 'm', props: { kind: 'confetti', count: 999 } }).match(/<span/g) ?? []).length).toBe(60);
  });

  it('Particles/ProgressBar-ring/stroke 样例过校验器（零 issue·目录自洽）', () => {
    const nodes: LayoutNode[] = [
      { type: 'Particles', id: 'v1', props: { kind: 'coins' } },
      { type: 'ProgressBar', id: 'v2', props: { value: 0.4, shape: 'ring', size: 60 } },
      { type: 'Label', id: 'v3', props: { text: '标题', stroke: true } },
    ];
    for (const n of nodes) expect(validateLayoutNode(n)).toEqual([]);
  });
});
