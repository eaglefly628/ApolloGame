// Game B ·《雀宴》对局 UI —— LayoutNode 校验 + 从 MatchState 投影正确性（UI 铁律·check-ui 门）。
import { describe, it, expect } from 'vitest';
import { validateLayoutNode, type LayoutNode } from '@ui/components/index.js';
import { startMatch, aiTurn, nextRound } from './core/game-state.js';
import type { Meld } from './core/meld.js';
import { buildPlayHud, PLAY_TILE, TOGGLE_LOG } from './play-ui.js';

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

  it('玩家手牌排：每张=可点按钮·action=play-tile·arg=手牌位 key（两步打牌）', () => {
    const m = startMatch(555); // 东1 庄=玩家·开局玩家有 drawn
    const nodes = collect(buildPlayHud(m, { logOpen: false }));
    const tiles = nodes.filter((n) => n.type === 'Button' && /^h-/.test(n.id ?? ''));
    // 13 暗手（h-0..h-12）+ 1 摸牌（h-d）= 14
    expect(tiles).toHaveLength(14);
    for (const t of tiles) {
      const p = t.props as { action?: string; actionArg?: string };
      expect(p.action).toBe(PLAY_TILE);
      // actionArg=手牌位 key：'0'..'12' 暗手位 / 'd' 摸牌（非牌码·两步打牌 handler 映射回码）
      expect(p.actionArg === 'd' || /^\d+$/.test(p.actionArg ?? '')).toBe(true);
    }
    // 选中态：某张抬升（y 更小）+ 余张压暗（opacity<1）——两步打牌视觉
    const selNodes = collect(buildPlayHud(m, { logOpen: false, selectedKey: '0' }));
    const sel = selNodes.find((n) => n.id === 'h-0');
    const other = selNodes.find((n) => n.id === 'h-1');
    expect((sel?.layout as { y: number }).y).toBeLessThan((other?.layout as { y: number }).y); // 选中张站起
    expect((other?.layout as { opacity?: number }).opacity).toBeLessThan(1); // 余张压暗
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

  it('鸣牌态（P4）：副露展示 + 鸣牌按钮条·validateLayoutNode 零 issue + 按钮齐全', () => {
    const m = startMatch(20260717);
    m.interactiveCalls = true;
    // 注入四家副露 + 玩家待鸣窗口（碰 + 两吃 + 荣 全亮）。
    m.cur.melds[0] = [{ kind: 'pon', tiles: [33, 33, 33], from: 1, called: 33 }] as Meld[];
    m.cur.melds[2] = [{ kind: 'ankan', tiles: [9, 9, 9, 9], from: 2, called: 9 }] as Meld[]; // 暗杠 4 张
    m.cur.callWindow = {
      discarder: 3, tile: 2,
      options: { ron: true, pon: true, minkan: true, chi: [{ consume: [1, 3] }, { consume: [3, 4] }] },
      pending: [],
    };
    const hud = buildPlayHud(m, { logOpen: false });
    expect(validateLayoutNode(hud)).toEqual([]);
    const ids = collect(hud).map((n) => n.id);
    expect(ids).toContain('melds-0'); // 玩家副露块
    expect(ids).toContain('melds-2'); // 他家副露块（暗杠 4 张）
    expect(collect(hud).filter((n) => /^meld-2-0-\d$/.test(n.id ?? ''))).toHaveLength(4); // 杠=4 张牌面
    expect(ids).toContain('callbar');
    expect(ids).toContain('call-ron');
    expect(ids).toContain('call-pon');
    expect(ids).toContain('call-kan'); // 大明杠钮
    expect(ids).toContain('call-chi-0'); // 两吃候选
    expect(ids).toContain('call-chi-1');
    expect(ids).toContain('call-pass');
    // 鸣牌窗口时手牌全禁点（不是玩家的打牌回合）
    const tiles = collect(hud).filter((n) => n.type === 'Button' && /^h-/.test(n.id ?? ''));
    expect(tiles.every((t) => (t.props as { disabled?: boolean }).disabled === true)).toBe(true);
  });

  it('日志面板可关（✕ 关闭钮）+ 行动条渲染在日志之上（owner「log 关不掉」修复）', () => {
    const m = startMatch(20260717);
    const root = buildPlayHud(m, { logOpen: true }); // 无鸣牌窗口·日志开
    const ids = collect(root).map((n) => n.id);
    expect(ids).toContain('logpanel');
    expect(ids).toContain('log-close'); // ✕ 关闭钮存在
    const closeBtn = collect(root).find((n) => n.id === 'log-close');
    expect((closeBtn?.props as { action?: string }).action).toBe(TOGGLE_LOG); // 关闭钮走 TOGGLE_LOG
    // 行动条(acts) 在日志(logpanel) 之后=渲染在上·永远可点（不被日志遮）
    const childIds = root.children!.map((c) => c.id);
    expect(childIds.indexOf('logpanel')).toBeLessThan(childIds.indexOf('acts'));
  });

  it('鸣牌窗口时日志自动收起（决策不被日志遮·owner 冻结修复）', () => {
    const m = startMatch(20260717);
    m.interactiveCalls = true;
    m.cur.callWindow = { discarder: 3, tile: 2, options: { ron: false, pon: true, minkan: false, chi: [] }, pending: [] };
    const ids = collect(buildPlayHud(m, { logOpen: true })).map((n) => n.id); // 请求开日志·但有鸣牌窗口
    expect(ids).not.toContain('logpanel'); // 鸣牌窗口时日志强制收起（不遮碰/过按钮）
    expect(ids).toContain('callbar'); // 鸣牌按钮条在
    expect(ids).toContain('call-pon');
  });

  it('结算面板重设计（owner）：役种逐行 + 暗手/副露分开展示 + 合计行·validateLayoutNode 零 issue', () => {
    const m = startMatch(20260717);
    m.cur.phase = 'win';
    m.cur.melds[0] = [{ kind: 'pon', tiles: [33, 33, 33], from: 2, called: 33 }] as Meld[];
    m.cur.result = {
      type: 'ron', winner: 0, loser: 2, winTile: 20, delta: [8000, 0, -8000, 0],
      handSnapshot: [0, 1, 2, 9, 10, 11, 18, 19, 20, 23, 23],
      meldsSnapshot: [{ kind: 'pon', tiles: [33, 33, 33], from: 2, called: 33 }] as Meld[],
      yakuList: [{ name: '断幺九', han: 1 }, { name: '三色同順', han: 1 }, { name: '宝牌', han: 2 }],
      han: 4, fu: 40, yakuman: 0, scoreLabel: '満貫',
    };
    const hud = buildPlayHud(m, { logOpen: false });
    expect(validateLayoutNode(hud)).toEqual([]);
    const ids = collect(hud).map((n) => n.id);
    expect(ids).toContain('res-cc'); // 暗手行
    expect(ids).toContain('res-md-0'); // 副露分开展示
    expect(ids).toContain('res-md-0-s'); // 副露来源标签（吃/碰/杠◄谁）
    expect(ids).toContain('res-yk-0'); expect(ids).toContain('res-yk-2'); // 役种逐行
    expect(ids).toContain('res-yk-total'); // 合计行
    const ykRows = collect(hud).filter((n) => /^res-yk-\d+$/.test(n.id ?? ''));
    expect(ykRows).toHaveLength(3); // 3 役各一行（不挤一行）
  });

  it('回合流向指示：中央指向条显当前家 + 方向箭头', () => {
    const m = startMatch(20260717);
    m.interactiveCalls = true;
    m.cur.turn = 2; // 北家出牌中
    const ids = collect(buildPlayHud(m, { logOpen: false })).map((n) => n.id);
    expect(ids).toContain('turnbanner');
    expect(ids).toContain('tb-head');
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
    const nodes = collect(buildPlayHud(m, { logOpen: false, lang: 'zh' }));
    const nextBtn = nodes.find((n) => n.id === 'res-next');
    expect((nextBtn?.props as { label: string }).label).toContain('主菜单'); // zh
    // 默认日文：同按钮出「タイトルへ」（i18n 生效·默认 ja）。
    const nodesJa = collect(buildPlayHud(m, { logOpen: false }));
    expect((nodesJa.find((n) => n.id === 'res-next')?.props as { label: string }).label).toContain('タイトルへ');
  });
});
