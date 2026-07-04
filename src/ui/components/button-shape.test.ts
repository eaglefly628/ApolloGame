// @vitest-environment happy-dom
// 异形按钮（owner 2026-07-04「异形 UI」需求下沉）：Button.shape 闭集 ShapeToken → 引擎预置 clip-path/border-radius。
//   铁律：只收枚举名（弱 LLM 选得出），绝不收自由 clip-path 坐标。validate 经 catalog 自动拦非法值。
import { describe, it, expect } from 'vitest';
import { renderNode } from './index.js';
import { validateLayoutNode } from './validate.js';
import type { LayoutNode } from './index.js';

describe('Button.shape · 异形轮廓（闭集 clip-path）', () => {
  it('hexagon → clip-path 六边形多边形', () => {
    const html = renderNode({ type: 'Button', id: 'b', props: { label: '技能', shape: 'hexagon' } });
    expect(html).toContain('clip-path:polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)');
  });
  it('diamond / shield / ribbon / chevron / tag / cut 各出对应 clip-path', () => {
    const has = (shape: string) => renderNode({ type: 'Button', id: 'b', props: { label: 'x', shape: shape as never } });
    expect(has('diamond')).toContain('clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%)');
    expect(has('shield')).toContain('clip-path:polygon(0 0,100% 0,100% 62%,50% 100%,0 62%)');
    expect(has('ribbon')).toContain('92% 50%');
    expect(has('chevron')).toContain('88% 0');
    expect(has('tag')).toContain('12% 0');
    expect(has('cut')).toContain('calc(100% - 10px)');
  });
  it('pill → 全圆 border-radius（非 clip-path）', () => {
    const html = renderNode({ type: 'Button', id: 'b', props: { label: '确定', shape: 'pill' } });
    expect(html).toContain('border-radius:999px');
    expect(html).not.toContain('clip-path');
  });
  it('hero 键异形：shape 覆盖 hero 自带切角（后写 clip-path 生效）', () => {
    const html = renderNode({ type: 'Button', id: 'b', props: { label: '出征', kind: 'hero', shape: 'diamond' } });
    // hero 仍渲染（金底 sheen），末尾追加 diamond clip-path 覆盖 13px 切角
    expect(html).toContain('clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%)');
    expect(html.lastIndexOf('clip-path:polygon(50% 0')).toBeGreaterThan(html.indexOf('clip-path:polygon(13px'));
  });
  it('不填 shape → 矩形（既有 border-radius:7px·不回归）', () => {
    const html = renderNode({ type: 'Button', id: 'b', props: { label: 'x' } });
    expect(html).toContain('border-radius:7px');
    expect(html).not.toContain('clip-path');
  });
  it('validate 拦非法 shape（闭集外的自由值报 bad-enum）', () => {
    const bad: LayoutNode = { type: 'Button', id: 'b', props: { label: 'x', shape: 'star' as never } };
    const issues = validateLayoutNode(bad);
    expect(issues.some((i) => i.kind === 'bad-enum' && i.detail.includes('shape'))).toBe(true);
  });
  it('validate 放行合法 shape', () => {
    const ok: LayoutNode = { type: 'Button', id: 'b', props: { label: 'x', shape: 'hexagon' } };
    expect(validateLayoutNode(ok).length).toBe(0);
  });
});
