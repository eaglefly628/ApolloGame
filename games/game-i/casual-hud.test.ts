// 超休闲对局屏守卫：合法 LayoutNode（validate 零 issue）+ 用上成熟华丽件 + 控件全闭集内。
import { describe, it, expect } from 'vitest';
import { validateLayoutNode, type LayoutNode } from '@zerocraft/engine/ui/components/index.js';
import { buildCasualHud } from './casual-hud.js';

function types(node: LayoutNode, acc = new Set<string>()): Set<string> {
  acc.add(node.type);
  for (const c of node.children ?? []) types(c, acc);
  return acc;
}
function ids(node: LayoutNode, acc: string[] = []): string[] {
  acc.push(node.id);
  for (const c of node.children ?? []) ids(c, acc);
  return acc;
}
const CLOSED = new Set(['Panel', 'Label', 'Button', 'Badge', 'Tag', 'ProgressBar', 'Rating', 'Particles']);

describe('Game I · 组合 · 超休闲对局屏', () => {
  it('合法 LayoutNode（validate 零 issue）', () => {
    expect(validateLayoutNode(buildCasualHud())).toEqual([]);
  });
  it('用上成熟华丽件（糖果棋盘 + 星级 + 庆祝/环境粒子 + 道具钮 + 进度）', () => {
    const t = types(buildCasualHud());
    for (const ty of ['Rating', 'Particles', 'ProgressBar', 'Button', 'Tag', 'Badge']) expect(t.has(ty)).toBe(true);
  });
  it('7×7 糖果棋盘 49 格齐 + 选中格/特殊格在位', () => {
    const id = ids(buildCasualHud());
    let cells = 0;
    for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) if (id.includes(`cc-${r}-${c}`)) cells++;
    expect(cells).toBe(49);
    expect(id).toContain('bo-hammer-b'); // 道具钮
    expect(id).toContain('ch-rating');   // 星级
  });
  it('控件全落闭集（零手写逃生）', () => {
    for (const ty of types(buildCasualHud())) expect(CLOSED.has(ty)).toBe(true);
  });
});
