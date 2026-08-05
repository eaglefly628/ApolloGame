// @vitest-environment happy-dom
// 主题指针点名测试（REQ-STYLESET M0.6·沿 panelTexture 先例）：cursorCss 纯函数 + 主题令牌存在 + mountUI 落根 + 缺省零变化。
import { describe, it, expect } from 'vitest';
import { mountUI, cursorCss } from './server.js';
import type { LayoutNode, UICursor, UITheme } from './types.js';
import { apolloToon } from '../apollo-toon-theme.js';
import { SHELL } from '../shell-theme.js';

const TREE: LayoutNode = { type: 'Panel', id: 'r', props: {}, children: [{ type: 'Label', id: 'l', props: { text: 'hi' } }] };
const CUR: UICursor = { image: 'data:image/svg+xml,<svg/>', x: 3, y: 4, press: { image: 'data:image/svg+xml,<svg2/>', x: 1, y: 2 } };

describe('REQ-STYLESET M0.6 · 主题指针 cursor', () => {
  it('cursorCss：base/press 值格式 + 热点取整 + 去重键稳定', () => {
    const r = cursorCss(CUR);
    expect(r.value).toBe('url("data:image/svg+xml,<svg/>") 3 4, auto');
    expect(r.pressValue).toBe('url("data:image/svg+xml,<svg2/>") 1 2, auto');
    expect(cursorCss(CUR).key).toBe(r.key);                       // 同输入同键
    expect(cursorCss({ image: 'data:other' }).key).not.toBe(r.key); // 异输入异键
  });

  it('cursorCss：无 press → 无 pressValue；热点缺省 0,0', () => {
    const r = cursorCss({ image: 'data:x' });
    expect(r.value).toBe('url("data:x") 0 0, auto');
    expect(r.pressValue).toBeUndefined();
  });

  it('apollo-toon 配了墨笔尖指针（data-URI SVG + 热点 + 按下态）', () => {
    const c = apolloToon.cursor;
    expect(c).toBeTruthy();
    expect(c!.image.startsWith('data:image/svg+xml,')).toBe(true);
    expect(c!.x).toBe(3); expect(c!.y).toBe(3);
    expect(c!.press?.image.startsWith('data:image/svg+xml,')).toBe(true); // 按下态另有一图
  });

  it('SHELL 等老主题无 cursor 令牌（缺省零变化）', () => {
    expect((SHELL as UITheme).cursor).toBeUndefined();
  });

  it('mountUI：cursor 主题 → host.style.cursor 落 base + 注入按下态 scoped 规则 + 挂 class', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const t = { ...SHELL, cursor: CUR };
    const teardown = mountUI(host, TREE, {}, t);
    expect(host.style.cursor).toContain('url("data:image/svg+xml,<svg/>")');
    const cls = Array.from(host.classList).find((k) => k.startsWith('apollo-cur-'));
    expect(cls).toBeTruthy();
    const style = document.getElementById(`apollo-cursor-${cls!.replace('apollo-cur-', '')}`);
    expect(style?.textContent).toContain(':active');
    expect(style?.textContent).toContain('<svg2/>'); // 按下态图进了规则
    teardown(); host.remove();
  });

  it('mountUI：无 cursor 主题 → 不设 host.style.cursor（老主题零变化）', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const teardown = mountUI(host, TREE, {}, SHELL);
    expect(host.style.cursor).toBe('');
    teardown(); host.remove();
  });
});
