// @vitest-environment happy-dom
// Label 字体槽/磷光/字距 下沉验收（render-only·不进 sim hash）：
//   · font：具名字体槽 ui/mono/pixel/display → 取 UITheme 对应槽（pixel/display 缺省回退 ui/mono）。
//   · glow：text-shadow 柔光（琥珀时钟磷光）。
//   · tracking：letter-spacing（Silkscreen 全大写微标）。
// 折进 Label 扩字段而非新建控件（manifesto：扩字段优先于加控件类型）。下沉自 game-x《残响》像素 UI。
import { describe, it, expect } from 'vitest';
import { renderNode } from './index.js';
import { apolloOnyx } from './apollo-kit.js';
import type { UITheme } from './types.js';

const theme: UITheme = { ...apolloOnyx, fontPixel: "'Silkscreen'", fontDisplay: "'VT323'" };

describe('UI Components · Label.font 具名字体槽', () => {
  it('font:display → 取 UITheme.fontDisplay（VT323）', () => {
    const html = renderNode({ type: 'Label', id: 'clk', props: { text: '21:47', font: 'display' } }, theme);
    expect(html).toContain("font-family:'VT323'");
  });
  it('font:pixel → 取 UITheme.fontPixel（Silkscreen）', () => {
    const html = renderNode({ type: 'Label', id: 'lb', props: { text: 'NOW', font: 'pixel' } }, theme);
    expect(html).toContain("font-family:'Silkscreen'");
  });
  it('pixel/display 槽缺省回退 fontUi/fontMono（旧主题无新槽不崩）', () => {
    const html = renderNode({ type: 'Label', id: 'lb', props: { text: 'x', font: 'pixel' } }, apolloOnyx);
    expect(html).toContain(`font-family:${apolloOnyx.fontUi}`);
  });
  it('未填 font 时按 mono 布尔回退（旧调用方行为不变）', () => {
    const mono = renderNode({ type: 'Label', id: 'a', props: { text: 'x', mono: true } }, theme);
    expect(mono).toContain(`font-family:${theme.fontMono}`);
    const ui = renderNode({ type: 'Label', id: 'b', props: { text: 'x' } }, theme);
    expect(ui).toContain(`font-family:${theme.fontUi}`);
  });
});

describe('UI Components · Label.glow / tracking', () => {
  it('glow → text-shadow 柔光（按当前 color）', () => {
    const html = renderNode({ type: 'Label', id: 'g', props: { text: '21:47', color: 'gold', glow: true } }, theme);
    expect(html).toContain('text-shadow:');
    expect(html).toContain(theme.gold); // 柔光取 gold 色
  });
  it('tracking → letter-spacing px', () => {
    const html = renderNode({ type: 'Label', id: 'tk', props: { text: 'REMNANT', tracking: 4 } }, theme);
    expect(html).toContain('letter-spacing:4px');
  });
  it('不填则无 text-shadow / letter-spacing（不污染旧 Label）', () => {
    const html = renderNode({ type: 'Label', id: 'p', props: { text: 'x' } }, theme);
    expect(html).not.toContain('text-shadow');
    expect(html).not.toContain('letter-spacing');
  });
});
