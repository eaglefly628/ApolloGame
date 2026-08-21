// @vitest-environment happy-dom
// 2D UI 查缺补漏（owner 2026-08-21）验收：Badge.icon · Avatar.ring · Label.color {custom} 三态 ·
//   fx:wobble · anim:flyIn 方向/幅度。每条含「不填=零回归」+ 注入净化守卫。
import { describe, it, expect } from 'vitest';
import { renderNode } from './index.js';
import { apolloOnyx } from './apollo-kit.js';

const T = apolloOnyx;
const r = (node: Parameters<typeof renderNode>[0]) => renderNode(node, T);

describe('Badge.icon（REQ-UI-Badge图标·补齐 Tag/Button 一致性）', () => {
  it('icon → 内联 img 居 text 前', () => {
    const html = r({ type: 'Badge', id: 'b', props: { text: '稀有', icon: 'x.png', tone: 'ok' } });
    expect(html).toContain('<img src="x.png"');
    expect(html.indexOf('<img')).toBeLessThan(html.indexOf('稀有')); // 图在字前
  });
  it('不填 icon → 无 img（零回归）', () => {
    expect(r({ type: 'Badge', id: 'b', props: { text: '稀有' } })).not.toContain('<img');
  });
});

describe('Avatar.ring（REQ-UI-Avatar环·conic 进度描边）', () => {
  it('ring → conic-gradient 环到 value/max 比例', () => {
    const html = r({ type: 'Avatar', id: 'a', props: { name: '关', size: 40, ring: { value: 0.75, tone: 'gold' } } });
    expect(html).toContain('conic-gradient');
    expect(html).toContain('75%');
    expect(html).toContain(T.gold); // tone=gold 取金
  });
  it('value/max 比例正确（3/4=75%）', () => {
    expect(r({ type: 'Avatar', id: 'a', props: { name: '关', ring: { value: 3, max: 4 } } })).toContain('75%');
  });
  it('不填 ring → 无 conic（字节不变·零回归）', () => {
    expect(r({ type: 'Avatar', id: 'a', props: { name: '关', size: 40 } })).not.toContain('conic-gradient');
  });
});

describe('Label.color {custom} 三态（REQ-UI-Label色三态·同 Panel.bg 口径）', () => {
  it('令牌照旧解主题色', () => {
    expect(r({ type: 'Label', id: 'l', props: { text: 'x', color: 'gold' } })).toContain(`color:${T.gold}`);
  });
  it('{custom} 逃生 → 原样自由色（稿子精确色）', () => {
    expect(r({ type: 'Label', id: 'l', props: { text: 'x', color: { custom: '#c93a3a' } } })).toContain('color:#c93a3a');
  });
  it('spans 段色也吃 {custom}（花色/蓝数字）', () => {
    const html = r({ type: 'Label', id: 'l', props: { spans: [{ text: '♠', color: { custom: '#556' } }, { text: '13', color: 'gold' }] } });
    expect(html).toContain('color:#556');
    expect(html).toContain(`color:${T.gold}`);
  });
  it('{custom} 注入净化：剥引号/分号/花括号（防逃出 style 值）', () => {
    const html = r({ type: 'Label', id: 'l', props: { text: 'x', color: { custom: 'red;}</style><script>' } } });
    expect(html).not.toContain(';}');
    expect(html).not.toContain('<script'); // esc 后尖括号成实体·且危险字符已剥
    expect(html).not.toContain('</style>');
  });
});

describe('fx:wobble（REQ-108-UI-02·循环 rotate+scale 摇摆）', () => {
  it('wobble → apollo-fx-wobble 动画 + --fx-wob 摆幅变量', () => {
    const html = r({ type: 'Label', id: 'l', props: { text: '✊' }, layout: { fx: [{ kind: 'wobble', intensity: 1.5 }] } });
    expect(html).toContain('apollo-fx-wobble');
    expect(html).toContain('--fx-wob:12deg'); // 1.5*8
  });
  it('once → both（单次·不 infinite）', () => {
    expect(r({ type: 'Label', id: 'l', props: { text: 'x' }, layout: { fx: [{ kind: 'wobble', once: true }] } })).toContain('apollo-fx-wobble 1400ms ease-in-out both');
  });
});

describe('anim:flyIn 方向/幅度（REQ-UI-入场方向·A-017 + 108 大幅伸入）', () => {
  it('animFrom:right + animDist:120 → --anim-dx 正向大位移', () => {
    const html = r({ type: 'Panel', id: 'p', props: {}, layout: { anim: 'flyIn', animFrom: 'right', animDist: 120 }, children: [] });
    expect(html).toContain('--anim-dx:120px');
    expect(html).toContain('--anim-dy:0px');
  });
  it('animFrom:top → 纵向负位移', () => {
    const html = r({ type: 'Panel', id: 'p', props: {}, layout: { anim: 'flyIn', animFrom: 'top', animDist: 40 }, children: [] });
    expect(html).toContain('--anim-dx:0px');
    expect(html).toContain('--anim-dy:-40px');
  });
  it('裸 flyIn（无 animFrom/animDist）→ 不推变量（落关键帧默认 -24px·零回归）', () => {
    const html = r({ type: 'Panel', id: 'p', props: {}, layout: { anim: 'flyIn' }, children: [] });
    expect(html).not.toContain('--anim-dx');
    expect(html).toContain('animation:apollo-flyIn');
  });
});
