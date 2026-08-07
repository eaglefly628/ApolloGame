// @vitest-environment happy-dom
// 面填充三态（owner 2026-07-04 色库化需求下沉）：Panel.bg / Screen.bg = PanelFill。
//   ① SurfaceToken 语义令牌 → 映射 UITheme（换皮自适应）② FillPreset 预设配色 → 引擎内建渐变（固定观感）
//   ③ {custom} → 显式逃生（创作者特别指定才用自由 hex）④ 遗留裸串 → 原样透传（back-compat）
import { describe, it, expect } from 'vitest';
import { renderNode } from './index.js';
import { apolloOnyx, apolloBrocade } from './apollo-kit.js';

describe('Panel.bg · 面填充三态（色库化）', () => {
  it('SurfaceToken raised → 映射主题 bg2（换皮自适应：两主题解析出各自的 bg2）', () => {
    const onyx = renderNode({ type: 'Panel', id: 'p', props: { bg: 'raised' }, children: [] }, apolloOnyx);
    const brocade = renderNode({ type: 'Panel', id: 'p', props: { bg: 'raised' }, children: [] }, apolloBrocade);
    expect(onyx).toContain(`background:${apolloOnyx.bg2}`);
    expect(brocade).toContain(`background:${apolloBrocade.bg2}`);
    // 换皮自适应铁证：同一 'raised' 令牌在两主题下解析成不同真色
    expect(apolloOnyx.bg2).not.toBe(apolloBrocade.bg2);
  });
  it('SurfaceToken sunken/jade/gold 各映射对应主题令牌', () => {
    const has = (bg: string) => renderNode({ type: 'Panel', id: 'p', props: { bg: bg as never }, children: [] }, apolloOnyx);
    expect(has('sunken')).toContain(`background:${apolloOnyx.bg0}`);
    expect(has('jade')).toContain(`background:${apolloOnyx.jadeWash}`);
    expect(has('gold')).toContain(`background:${apolloOnyx.gold}`);
  });
  it('FillPreset jade-sheen → 引擎内建渐变（固定·不随主题变）', () => {
    const onyx = renderNode({ type: 'Panel', id: 'p', props: { bg: 'jade-sheen' }, children: [] }, apolloOnyx);
    const brocade = renderNode({ type: 'Panel', id: 'p', props: { bg: 'jade-sheen' }, children: [] }, apolloBrocade);
    expect(onyx).toContain('linear-gradient(180deg,#1f4a3a,#123528)');
    expect(brocade).toContain('linear-gradient(180deg,#1f4a3a,#123528)'); // 固定观感：两主题同渐变
  });
  it('全 8 预设配色都解析出渐变', () => {
    for (const p of ['jade-sheen', 'gold-sheen', 'ink-deep', 'steel', 'blood', 'frost', 'ember', 'void']) {
      const html = renderNode({ type: 'Panel', id: 'p', props: { bg: p as never }, children: [] }, apolloOnyx);
      expect(html).toContain('gradient(');
    }
  });
  it('{custom} → 显式逃生·原样用自由串', () => {
    const html = renderNode({ type: 'Panel', id: 'p', props: { bg: { custom: '#abc123' } }, children: [] }, apolloOnyx);
    expect(html).toContain('background:#abc123');
  });
  it('遗留裸串 → back-compat 原样透传（不破坏存量）', () => {
    const html = renderNode({ type: 'Panel', id: 'p', props: { bg: '#141b27' }, children: [] }, apolloOnyx);
    expect(html).toContain('background:#141b27');
  });
  it('缺省 bg → 主题 bg1（不回归）', () => {
    const html = renderNode({ type: 'Panel', id: 'p', props: {}, children: [] }, apolloOnyx);
    expect(html).toContain(`background:${apolloOnyx.bg1}`);
  });
  it("SurfaceToken 'transparent' → 透明底（带透明色贴图 UI·see-through·仍保边框）", () => {
    // 透明底：贴图透明处透见身后。框面基色=transparent（非 bg1 不透明底）。
    const tex = renderNode({ type: 'Panel', id: 'p', props: { bg: 'transparent', bgTexture: 'data:image/svg+xml,%3Csvg%3E%3C/svg%3E' }, children: [] }, apolloOnyx);
    expect(tex).toContain('repeat, transparent'); // 贴图层叠在透明底上（透明处 see-through）
    expect(tex).not.toContain(`, ${apolloOnyx.bg1}`); // 不再落不透明底（对照默认吃透明）
    expect(tex).toContain('border:1px solid'); // 仍保边框（区别 bare）
    // 默认框面（对照）：贴图叠在不透明 bg1 上 → 透明处显面色（吃掉透明）。
    const opaque = renderNode({ type: 'Panel', id: 'p', props: { bgTexture: 'data:image/svg+xml,%3Csvg%3E%3C/svg%3E' }, children: [] }, apolloOnyx);
    expect(opaque).toContain(`, ${apolloOnyx.bg1}`);
  });
  it('Screen.bg 同三态：preset 解析渐变·{custom} 逃生', () => {
    const pre = renderNode({ type: 'Screen', id: 's', props: { bg: 'void' }, children: [] }, apolloOnyx);
    expect(pre).toContain('linear-gradient(160deg,#2a1a3a,#170f28)');
    const cus = renderNode({ type: 'Screen', id: 's', props: { bg: { custom: '#0a0a0a' } }, children: [] }, apolloOnyx);
    expect(cus).toContain('#0a0a0a');
  });
});

describe('Panel.shadow · 硬边平移投影（REQ-108-UI-03·卡通浮空基件）', () => {
  const panel = (props: Record<string, unknown>, theme = apolloOnyx) =>
    renderNode({ type: 'Panel', id: 'p', props, children: [] }, theme);

  it('shadow:{y} 渲出硬边偏移投影 `0 <y>px 0`（缺省色=深墨 ink/bg0·验收核心）', () => {
    const ink = apolloOnyx.ink ?? apolloOnyx.bg0;
    expect(panel({ shadow: { y: 4 } })).toContain(`box-shadow:0 4px 0 ${ink}`);
    expect(panel({ shadow: { y: 8 } })).toContain(`box-shadow:0 8px 0 ${ink}`); // 主 CTA 稿子 y=8
  });
  it('color=SurfaceToken → 主题解析·换皮自适应（同一 jade 两主题不同真色）', () => {
    expect(panel({ shadow: { y: 4, color: 'jade' } })).toContain(`0 4px 0 ${apolloOnyx.jadeWash}`);
    expect(panel({ shadow: { y: 4, color: 'jade' } }, apolloBrocade)).toContain(`0 4px 0 ${apolloBrocade.jadeWash}`);
    expect(apolloOnyx.jadeWash).not.toBe(apolloBrocade.jadeWash); // 换皮自适应铁证
  });
  it('color=裸色串 → 原样透传（稿子精确墨色 #14776a）', () => {
    expect(panel({ shadow: { y: 4, color: '#14776a' } })).toContain('0 4px 0 #14776a');
  });
  it('与 accent 柔光共存（逗号合成·两层都在·不互斥）', () => {
    const html = panel({ accent: true, shadow: { y: 5, color: 'gold' } });
    expect(html).toContain(`box-shadow:0 0 0 1px ${apolloOnyx.jadeWash},0 10px 34px rgba(0,0,0,.4),0 5px 0 ${apolloOnyx.gold}`);
  });
  it('也作用于 skin 框皮面（plate-art 可删投影那一支·改用本字段）', () => {
    const html = panel({ skin: 'data:image/svg+xml,%3Csvg%3E%3C/svg%3E', shadow: { y: 7, color: '#3f2b1e' } });
    expect(html).toContain('0 7px 0 #3f2b1e');
  });
  it('bare 面板忽略 shadow（无 chrome·同 accent 口径）', () => {
    expect(panel({ bare: true, shadow: { y: 4 } })).not.toContain('box-shadow');
  });
  it('非法 y → num() 退化 0px·绝不 NaN', () => {
    const html = panel({ shadow: { y: 'x' as unknown as number } });
    expect(html).toContain('box-shadow:0 0px 0 ');
    expect(html).not.toContain('NaN');
  });
  it('不填 shadow → 无 box-shadow（零回归）', () => {
    expect(panel({})).not.toContain('box-shadow');
  });
});
