// Game B ·《雀宴》对局 UI —— LayoutNode 校验 + 从 MatchState 投影正确性（UI 铁律·check-ui 门）。
import { describe, it, expect } from 'vitest';
import { validateLayoutNode, type LayoutNode } from '@ui/components/index.js';
import { startMatch, aiTurn, nextRound } from './core/game-state.js';
import { buildPlayHud, PLAY_TILE } from './play-ui.js';

const collect = (n: LayoutNode, out: LayoutNode[] = []): LayoutNode[] => {
  out.push(n);
  for (const c of n.children ?? []) collect(c, out);
  return out;
};

describe('game-b 对局 UI（play-ui·LayoutNode 纪律）', () => {
  it('对局中 HUD·validateLayoutNode 零 issue', () => {
    const m = startMatch(20260717);
    expect(validateLayoutNode(buildPlayHud(m, { logOpen: false }))).toEqual([]);
    expect(validateLayoutNode(buildPlayHud(m, { logOpen: true }))).toEqual([]); // 日志面板开
  });

  it('玩家手牌排：每张=可点按钮·action=play-tile·arg=牌码', () => {
    const m = startMatch(555); // 东1 庄=玩家·开局玩家有 drawn
    const nodes = collect(buildPlayHud(m, { logOpen: false }));
    const tiles = nodes.filter((n) => n.type === 'Button' && /^h-/.test(n.id ?? ''));
    // 13 手牌 + 1 摸牌 = 14
    expect(tiles).toHaveLength(14);
    for (const t of tiles) {
      const p = t.props as { action?: string; actionArg?: string };
      expect(p.action).toBe(PLAY_TILE);
      expect(Number(p.actionArg)).not.toBeNaN();
    }
  });

  it('四席位卡实时点数·当前玩家高亮·结算态弹 Modal', () => {
    const m = startMatch(42);
    let nodes = collect(buildPlayHud(m, { logOpen: false }));
    expect(nodes.filter((n) => /^seat-\d$/.test(n.id ?? ''))).toHaveLength(4);
    // 跑到本局终 → 应含结算 Modal
    let g = 0;
    while (m.cur.phase === 'playing' && g++ < 400) aiTurn(m);
    nodes = collect(buildPlayHud(m, { logOpen: false }));
    expect(nodes.some((n) => n.type === 'Modal' && n.id === 'result')).toBe(true);
    expect(validateLayoutNode(buildPlayHud(m, { logOpen: false }))).toEqual([]); // 结算态也零 issue
  });

  it('终局态：结算钮=返回主菜单', () => {
    const m = startMatch(3);
    let g = 0;
    while (!m.over && g++ < 60) {
      let sg = 0;
      while (m.cur.phase === 'playing' && sg++ < 400) aiTurn(m);
      nextRound(m);
    }
    expect(m.over).toBe(true);
    const nodes = collect(buildPlayHud(m, { logOpen: false }));
    const nextBtn = nodes.find((n) => n.id === 'res-next');
    expect((nextBtn?.props as { label: string }).label).toContain('主菜单');
  });
});
