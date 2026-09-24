// @vitest-environment happy-dom
// REQ-112-ENG-11 · Video 控件的 UI 面：**换片不黑帧**（就地复用元素）+ **播完发信号**（ended 不冒泡）+ bind/fit。
// 纯核（选片/回退链/预载）在 src/engine/host/video-clips.test.ts 钉，这里只钉「播放器这一半」。
import { describe, it, expect } from 'vitest';
import { mountUI } from './server.js';
import { renderNode } from './render.js';
import { SHELL } from '../shell-theme.js';
import { resolveBindings } from './bindings.js';
import type { LayoutNode, VideoProps } from './types.js';

const vid = (props: VideoProps): LayoutNode => ({ type: 'Video', id: 'v1', props });

describe('★ 换片不黑帧：src 变了要复用同一个 <video> 元素，不许重建', () => {
  it('update 换 src → **还是原来那个元素**（identity 不变），src 已更新', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const h = mountUI(host, vid({ src: '/clip-a.mp4', controls: false }));

    const before = host.querySelector('video') as HTMLVideoElement;
    expect(before.getAttribute('src')).toBe('/clip-a.mp4');

    h.update(vid({ src: '/clip-b.mp4', controls: false }));
    const after = host.querySelector('video') as HTMLVideoElement;

    expect(after).toBe(before);                      // ← 同一个 DOM 对象 = 没重建 = 不黑帧
    expect(after.getAttribute('src')).toBe('/clip-b.mp4');
    h();
  });

  it('★ src **没变**时绝不重设（重设同一 src 在部分浏览器会重头播）', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const h = mountUI(host, vid({ src: '/same.mp4', loop: false }));
    const el = host.querySelector('video') as HTMLVideoElement;

    let setCount = 0;
    const realSet = el.setAttribute.bind(el);
    el.setAttribute = (n: string, v: string): void => { if (n === 'src') setCount++; realSet(n, v); };

    h.update(vid({ src: '/same.mp4', loop: true }));  // 只有 loop 变
    expect(setCount).toBe(0);                          // src 一次都没被重设
    expect(el.loop).toBe(true);                        // 别的属性照样跟上
    h();
  });

  it('poster / controls / muted / fit 都能就地跟上；autoplay 强制 muted（浏览器策略）', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const h = mountUI(host, vid({ src: '/a.mp4' }));
    const el = host.querySelector('video') as HTMLVideoElement;

    h.update(vid({ src: '/a.mp4', poster: '/p.jpg', controls: false, fit: 'cover', autoplay: true }));
    expect(el.getAttribute('poster')).toBe('/p.jpg');
    expect(el.controls).toBe(false);
    expect(el.style.objectFit).toBe('cover');
    expect(el.muted).toBe(true);                       // autoplay ⇒ muted
    h();
  });
});

describe('★ 播完发信号：ended 不冒泡，委托必须 capture', () => {
  it('video 触发 ended → 调到 handler', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    let fired = 0;
    const h = mountUI(host, vid({ src: '/a.mp4', onEnded: 'clip.done' }), { 'clip.done': () => { fired++; } });

    const el = host.querySelector('video') as HTMLVideoElement;
    expect(el.dataset['videoEnded']).toBe('clip.done');
    el.dispatchEvent(new Event('ended'));              // ← 默认 bubbles:false，正是真实语义
    expect(fired).toBe(1);
    h();
  });

  it('无 handler + 有 sink → 落成 action 信号（纯信号游戏也收得到）', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const got: string[] = [];
    // mountUI(host, root, handlers, theme, input) —— sink 是第 5 个参（theme 用 SHELL 缺省）
    const h = mountUI(host, vid({ src: '/a.mp4', onEnded: 'clip.done' }), {}, SHELL,
      { enqueueAction: (a: string) => { got.push(a); } });

    (host.querySelector('video') as HTMLVideoElement).dispatchEvent(new Event('ended'));
    expect(got).toEqual(['clip.done']);
    h();
  });

  it('没写 onEnded 的视频播完 → 什么都不发（不误触别人的信号）', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    let fired = 0;
    const h = mountUI(host, vid({ src: '/a.mp4' }), { 'clip.done': () => { fired++; } });
    (host.querySelector('video') as HTMLVideoElement).dispatchEvent(new Event('ended'));
    expect(fired).toBe(0);
    h();
  });

  it('teardown 后再触发 ended → 不再调（capture 监听摘得干净）', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    let fired = 0;
    const h = mountUI(host, vid({ src: '/a.mp4', onEnded: 'clip.done' }), { 'clip.done': () => { fired++; } });
    const el = host.querySelector('video') as HTMLVideoElement;
    h();
    el.dispatchEvent(new Event('ended'));
    expect(fired).toBe(0);
  });
});

describe('bind（同 Image.bind）+ fit 渲染', () => {
  it('bind → ds.value 取出的字符串当 src（按 sim 状态换片的接法）', () => {
    const out = resolveBindings(vid({ bind: 'cat.clip' }), { value: (k) => (k === 'cat.clip' ? '/rest.mp4' : undefined) });
    expect((out.props as VideoProps).src).toBe('/rest.mp4');
  });

  it('bind 未命中 → src 保持原样（不拿 undefined 盖掉已有的）', () => {
    const out = resolveBindings(vid({ bind: 'nope', src: '/fallback.mp4' }), { value: () => undefined });
    expect((out.props as VideoProps).src).toBe('/fallback.mp4');
  });

  it('fit 不填 → HTML 里根本没有 object-fit（既有屏零回归）', () => {
    expect(renderNode(vid({ src: '/a.mp4' }))).not.toContain('object-fit');
    expect(renderNode(vid({ src: '/a.mp4', fit: 'contain' }))).toContain('object-fit:contain');
  });

  it('onEnded 不填 → 不出 data-video-ended 属性', () => {
    expect(renderNode(vid({ src: '/a.mp4' }))).not.toContain('data-video-ended');
  });
});
