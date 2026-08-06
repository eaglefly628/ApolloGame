// 伴侣在场件展台守卫：合法 LayoutNode + 四 event 在场件在位（portrait+dialog）。
import { describe, it, expect } from 'vitest';
import { validateLayoutNode, type LayoutNode } from '@zerocraft/engine/ui/components/index.js';
import { buildPresenceDemo } from './presence-demo.js';

function ids(n: LayoutNode, acc: string[] = []): string[] { acc.push(n.id); for (const c of n.children ?? []) ids(c, acc); return acc; }

describe('Game I · 剧情 · 伴侣在场件展台', () => {
  it('合法 LayoutNode（validate 零 issue）', () => {
    expect(validateLayoutNode(buildPresenceDemo())).toEqual([]);
  });
  it('四 event 在场件齐（win/bigPlay/lose/idle 各一立绘）', () => {
    const id = ids(buildPresenceDemo());
    for (const e of ['win', 'bigPlay', 'lose', 'idle']) expect(id).toContain(`pres-${e}-por`);
  });
});
