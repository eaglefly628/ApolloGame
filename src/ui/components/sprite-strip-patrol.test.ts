// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mountUI, renderNode } from './index.js';
import type { LayoutNode } from './index.js';

describe('Image.sprite 横向序列帧 + layout.anim:patrol', () => {
  const node: LayoutNode = {
    type: 'Image', id: 'cat-walk',
    props: { src: '/cat-walk-right.png', alt: '猫散步', sprite: { frames: 4, fps: 5, frameAspect: 0.75, directedPatrol: { backwardSrc: '/cat-walk-left.png', turnSrc: '/cat-turn.png' } } },
    layout: { width: 180, height: 160, anim: 'patrol', animDist: 96, animMs: 12000 },
  };

  it('序列条只由闭集数字数据驱动，渲染为裁切视口与 steps 循环', () => {
    const html = renderNode(node);
    expect(html).toContain('data-sprite-strip="4"');
    expect(html).toContain('aspect-ratio:0.75');
    expect(html).toContain('width:400%');
    expect(html).toContain('apollo-sprite-strip 800ms steps(4,end) infinite');
    expect(html).toContain('data-sprite-directed="patrol"');
    expect(html).toContain('/cat-walk-left.png');
    expect(html).toContain('/cat-turn.png');
    expect(html).toContain('data-sprite-phase="turn-out"');
    expect(html).toContain('data-sprite-phase="turn-home"');
  });

  it('patrol 复用 animDist 作行程并按数据周期往返', () => {
    const html = renderNode(node);
    expect(html).toContain('--anim-dist:96px');
    expect(html).toContain('animation:apollo-patrol 12000ms linear infinite');
  });

  it('挂载时注入序列帧和巡游关键帧', () => {
    const host = document.createElement('div'); document.body.appendChild(host);
    const teardown = mountUI(host, node);
    const css = document.getElementById('apollo-ui-keyframes')?.textContent ?? '';
    expect(css).toContain('apollo-sprite-strip');
    expect(css).toContain('apollo-patrol');
    expect(css).toContain('apollo-sprite-turn-out');
    expect(css).toContain('apollo-sprite-turn-home');
    expect(css).not.toContain('scaleX(-1)');
    teardown(); host.remove();
  });

  it('异常帧数/帧率被数值收敛，不可注入样式', () => {
    const html = renderNode({
      type: 'Image', id: 'safe',
      props: { src: '/x.png', sprite: { frames: '999;bad' as never, fps: 999, frameAspect: -2 } },
    });
    expect(html).toContain('data-sprite-strip="2"');
    expect(html).toContain('aspect-ratio:0.1');
    expect(html).not.toContain(';bad');
  });
});
