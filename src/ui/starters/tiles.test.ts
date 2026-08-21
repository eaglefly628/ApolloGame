// @vitest-environment happy-dom
// 组合瓦片 builder 验收（查缺补漏 #6）：产的是**合法闭集 LayoutNode**（validateLayoutNode 零 issue）+ 真渲染无崩，
// 且关键装配到位（稀有框/数量角标/冷却遮罩/选中光·大数染色）。不加新控件 = 纯组合。
import { describe, it, expect } from 'vitest';
import { validateLayoutNode, renderNode } from '@ui/components/index.js';
import { apolloToon } from '@ui/apollo-toon-theme.js';
import { buildItemSlot, buildStatTile } from './tiles.js';

const ok = (node: Parameters<typeof renderNode>[0]) => {
  expect(validateLayoutNode(node)).toEqual([]);              // 闭集合法
  expect(() => renderNode(node, apolloToon)).not.toThrow();  // 真渲染不崩
  return renderNode(node, apolloToon);
};

describe('buildItemSlot', () => {
  it('基础槽（图 + 稀有框）= 合法闭集 + 框色', () => {
    const html = ok(buildItemSlot({ id: 'slot1', icon: 'sword.png', edge: 'gold' }));
    expect(html).toContain('sword.png');
  });
  it('数量 >1 出角标·=1 不出', () => {
    expect(ok(buildItemSlot({ id: 's', icon: 'x.png', count: 5 }))).toContain('×5');
    expect(ok(buildItemSlot({ id: 's', icon: 'x.png', count: 1 }))).not.toContain('×1');
  });
  it('cooldown → 暗遮罩 + 居中读数', () => {
    const html = ok(buildItemSlot({ id: 's', icon: 'x.png', cooldown: '3' }));
    expect(html).toContain('rgba(0,0,0,0.55)');
    expect(html).toContain('>3<');
  });
  it('label → 底部名（竖排包一层）', () => {
    expect(ok(buildItemSlot({ id: 's', icon: 'x.png', label: '长剑' }))).toContain('长剑');
  });
  it('empty → 虚线空槽（无图）', () => {
    const html = ok(buildItemSlot({ id: 's', empty: true, icon: 'x.png' }));
    expect(html).not.toContain('x.png'); // empty 忽略 icon
  });
  it('selected → 金光 glow', () => {
    expect(ok(buildItemSlot({ id: 's', icon: 'x.png', selected: true }))).toContain('drop-shadow');
  });
});

describe('buildStatTile', () => {
  it('大数 + 副标 = 合法闭集·大数在前', () => {
    const html = ok(buildStatTile({ id: 't', value: '140', label: '伤害' }));
    expect(html).toContain('140');
    expect(html).toContain('伤害');
    expect(html.indexOf('140')).toBeLessThan(html.indexOf('伤害'));
  });
  it('tone → 大数染色', () => {
    expect(ok(buildStatTile({ id: 't', value: '9', label: '连击', tone: 'gold' }))).toContain(apolloToon.gold);
  });
  it('shadow → Panel 硬边浮空投影', () => {
    expect(ok(buildStatTile({ id: 't', value: '9', label: 'x', shadow: 4 }))).toContain('box-shadow:0 4px 0');
  });
});
