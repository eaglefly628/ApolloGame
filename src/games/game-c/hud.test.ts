import { describe, it, expect } from 'vitest';
import { validateLayoutNode } from '@ui/components/validate.js';
import type { Card } from '@engine/protocol/components.js';
import { buildTable, buildMenu, type TableView } from './hud.js';
import { CLOTHING_ITEMS } from './wardrobe.js';
import { OPPONENT_ANCHORS } from './theme.js';

const H = (suit: number, rank: number): Card => ({ suit, rank });

function baseView(over: Partial<TableView> = {}): TableView {
  return {
    lang: 'en', playerCount: 6,
    blindLabel: '25 / 50',
    handNo: 1,
    pot: 300,
    board: [H(0, 14), H(1, 13), H(2, 5)],
    heroHole: [H(0, 12), H(0, 11)],
    heroHandName: '高牌',
    seats: [0, 1, 2, 3, 4, 5].map((seat) => ({
      seat, name: seat === 0 ? '主角' : `姨太${seat}`, chips: 950, committed: 0,
      clothes: 6, folded: false, allIn: false, out: false,
      isActor: seat === 0, isHero: seat === 0, isButton: seat === 0,
    })),
    toCall: 0, canRaise: true, minRaise: 50, maxRaise: 950, raiseValue: 50,
    muted: false, openWardrobe: null,
    showLog: false, log: [],
    phase: 'betting', isHeroTurn: true,
    ...over,
  };
}

describe('game-c hud — LayoutNode 合法性（UI 铁律·闭集控件零发明）', () => {
  it('牌桌主屏 validateLayoutNode 零 issue', () => {
    expect(validateLayoutNode(buildTable(baseView()))).toEqual([]);
  });

  it('衣柜面板打开（主角·带换筹码按钮）零 issue', () => {
    const wardrobe = {
      seat: 0, name: '主角', isHero: true,
      rows: CLOTHING_ITEMS.map((it) => ({ id: it.id, name: it.name, value: it.value, pawned: false })),
    };
    expect(validateLayoutNode(buildTable(baseView({ openWardrobe: 0, wardrobe })))).toEqual([]);
  });

  it('对手衣柜（只读·无换筹码按钮）+ 部分典当置灰 零 issue', () => {
    const wardrobe = {
      seat: 2, name: '二姨太', isHero: false,
      rows: CLOTHING_ITEMS.map((it, i) => ({ id: it.id, name: it.name, value: it.value, pawned: i < 2 })),
    };
    expect(validateLayoutNode(buildTable(baseView({ openWardrobe: 2, wardrobe })))).toEqual([]);
  });

  it('各下注/弃牌/全下/出局状态 + 无加注权 均零 issue', () => {
    const v = baseView({ toCall: 100, canRaise: false });
    v.seats[1] = { ...v.seats[1], committed: 100, folded: false, isActor: false };
    v.seats[2] = { ...v.seats[2], folded: true };
    v.seats[3] = { ...v.seats[3], allIn: true, committed: 950, chips: 0 };
    v.seats[4] = { ...v.seats[4], out: true, chips: 0, clothes: 0 };
    expect(validateLayoutNode(buildTable(v))).toEqual([]);
  });

  it('翻牌前（公共牌空）与河牌（5 张）边界零 issue', () => {
    expect(validateLayoutNode(buildTable(baseView({ board: [] })))).toEqual([]);
    const river = [H(0, 14), H(1, 13), H(2, 5), H(3, 9), H(0, 2)];
    expect(validateLayoutNode(buildTable(baseView({ board: river, heroHandName: '一对' })))).toEqual([]);
  });

  it('六席覆盖：主角=左立绘框 + 五姨太席卡锚点实名（owner 2026-07-20 左立绘框）', () => {
    const table = buildTable(baseView());
    const ids = new Set<string>();
    const walk = (n: { id?: string; children?: unknown[] }): void => {
      if (n.id) ids.add(n.id);
      for (const c of (n.children ?? []) as { id?: string; children?: unknown[] }[]) walk(c);
    };
    walk(table);
    expect(ids.has('c-hero-portrait')).toBe(true); // 主角=左侧立绘框（非小席卡）
    expect(ids.has('c-seat-0')).toBe(false);       // 主角不再是小席卡
    for (const seat of [1, 2, 3, 4, 5]) expect(ids.has(`c-seat-${seat}`)).toBe(true); // 五姨太=席卡
    expect(OPPONENT_ANCHORS.map((a) => a.name)).toEqual(['大姨太', '二姨太', '三姨太', '四姨太', '五姨太']);
  });

  it('公共牌浮层在（2D HUD·盖 3D 呢面桌心）', () => {
    const table = buildTable(baseView());
    const ids = new Set<string>();
    const walk = (n: { id?: string; children?: unknown[] }): void => {
      if (n.id) ids.add(n.id);
      for (const c of (n.children ?? []) as { id?: string; children?: unknown[] }[]) walk(c);
    };
    walk(table);
    expect(ids.has('c-community')).toBe(true);
  });

  it('游戏日志面板打开（事件流渲染）零 issue', () => {
    const log = [
      { seq: 0, tag: 'deal' as const, text: '🎲 发牌 · seed 42' },
      { seq: 1, tag: 'action' as const, text: '主角(座0) 跟注 50' },
      { seq: 2, tag: 'street' as const, text: '🃏 翻牌 · A♠ K♥ 5♦' },
    ];
    expect(validateLayoutNode(buildTable(baseView({ showLog: true, log })))).toEqual([]);
  });

  it('主菜单屏 SC-1 零 issue（标题/立绘/按钮/角色卡）', () => {
    expect(validateLayoutNode(buildMenu({ lang: 'en', playerCount: 6, playerName: '夜阑君', playerChips: 12860, blindLabel: '25 / 50' }))).toEqual([]);
  });

  it('非主角轮=等待提示（行动条隐）零 issue', () => {
    expect(validateLayoutNode(buildTable(baseView({ isHeroTurn: false })))).toEqual([]);
  });

  it('摊牌屏（6 家全摊·公共牌板 + 各家最优五张 + 确认键钉底）零 issue·防 freeze', () => {
    // 旧版 6 人时确认键掉出 720 视口按不到=freeze；重设计=定高卡 + 组合滚动 + 确认键钉底常驻。
    const showdown = {
      rows: [0, 1, 2, 3, 4, 5].map((i) => ({
        name: i === 0 ? '主角' : `姨太${i}`, type: i === 0 ? '葫芦' : '高牌',
        best: [H(0, 14), H(1, 14), H(2, 14), H(3, 13), H(0, 13)], hole: [H(0, 14), H(1, 14)],
        won: i === 0 ? 1800 : 0, isWinner: i === 0,
      })),
      potTotal: 1800,
    };
    const river = [H(0, 14), H(1, 13), H(2, 5), H(3, 9), H(0, 2)];
    const table = buildTable(baseView({ phase: 'showdown', board: river, showdown }));
    expect(validateLayoutNode(table)).toEqual([]);
    // 确认键必须在树里（钉底 → 6 人也点得到，不再 freeze）。
    const ids = new Set<string>();
    const walk = (n: { id?: string; children?: unknown[] }): void => {
      if (n.id) ids.add(n.id);
      for (const c of (n.children ?? []) as { id?: string; children?: unknown[] }[]) walk(c);
    };
    walk(table);
    expect(ids.has('c-sd-next')).toBe(true);
    expect(ids.has('c-sd-board')).toBe(true); // 公共牌板在
  });

  it('摊牌屏·盖牌收池（best 空·无摊）零 issue', () => {
    const showdown = {
      rows: [{ name: '主角', type: '收池', best: [] as Card[], hole: [] as Card[], won: 300, isWinner: true }],
      potTotal: 300,
    };
    expect(validateLayoutNode(buildTable(baseView({ phase: 'showdown', showdown })))).toEqual([]);
  });

  it('局终屏（胜/负）零 issue', () => {
    const win = { win: true, hands: 42, heroChips: 18650, heroPawned: 0 };
    const lose = { win: false, hands: 28, heroChips: 0, heroPawned: 6 };
    expect(validateLayoutNode(buildTable(baseView({ phase: 'gameover', finale: win })))).toEqual([]);
    expect(validateLayoutNode(buildTable(baseView({ phase: 'gameover', finale: lose })))).toEqual([]);
  });

  it('中英双语（owner 2026-07-20）：EN/ZH 牌桌+菜单均零 issue + 语言段控在树 + 文案真随语言变', () => {
    const idsOf = (n: { id?: string; children?: unknown[] }): Set<string> => {
      const ids = new Set<string>();
      const walk = (x: { id?: string; children?: unknown[] }): void => { if (x.id) ids.add(x.id); for (const c of (x.children ?? []) as { id?: string }[]) walk(c); };
      walk(n); return ids;
    };
    for (const lang of ['en', 'zh'] as const) {
      const table = buildTable(baseView({ lang }));
      expect(validateLayoutNode(table)).toEqual([]);
      const menu = buildMenu({ lang, playerCount: 6, playerName: '夜阑君', playerChips: 12860, blindLabel: '25 / 50' });
      expect(validateLayoutNode(menu)).toEqual([]);
      for (const id of ['c-lang-en', 'c-lang-zh']) expect(idsOf(table).has(id)).toBe(true); // 顶栏语言段控
      for (const id of ['c-menu-lang-seg-en', 'c-menu-lang-seg-zh']) expect(idsOf(menu).has(id)).toBe(true); // 菜单语言段控
    }
    // 文案真随语言变：EN 弃牌键=Fold；ZH=弃牌。
    expect(JSON.stringify(buildTable(baseView({ lang: 'en' }))).includes('Fold')).toBe(true);
    expect(JSON.stringify(buildTable(baseView({ lang: 'zh' }))).includes('弃牌')).toBe(true);
  });

  it('结构化 lastMove 气泡（加注/跟注/过牌·中英）零 issue', () => {
    const withMoves = (lang: 'en' | 'zh'): TableView => {
      const v = baseView({ lang, toCall: 100, canRaise: false });
      v.seats[1] = { ...v.seats[1], lastMove: { kind: 'raise', amount: 200 } };
      v.seats[2] = { ...v.seats[2], lastMove: { kind: 'call', amount: 100 } };
      v.seats[3] = { ...v.seats[3], lastMove: { kind: 'check' } };
      return v;
    };
    expect(validateLayoutNode(buildTable(withMoves('en')))).toEqual([]);
    expect(validateLayoutNode(buildTable(withMoves('zh')))).toEqual([]);
  });

  it('入局人数 2~6（owner 2026-07-20）：只渲染在场座 + 菜单人数段控 + 各人数零 issue', () => {
    const idsOf = (n: { id?: string; children?: unknown[] }): Set<string> => {
      const ids = new Set<string>();
      const walk = (x: { id?: string; children?: unknown[] }): void => { if (x.id) ids.add(x.id); for (const c of (x.children ?? []) as { id?: string }[]) walk(c); };
      walk(n); return ids;
    };
    for (const pc of [2, 3, 4, 5, 6]) {
      const seats = [0, 1, 2, 3, 4, 5].map((seat) => ({
        seat, name: `S${seat}`, chips: 950, committed: 0, clothes: 6,
        folded: false, allIn: false, out: false, isActor: seat === 0, isHero: seat === 0, isButton: seat === 0,
      })).slice(0, pc);
      const table = buildTable(baseView({ playerCount: pc, seats }));
      expect(validateLayoutNode(table)).toEqual([]);
      const ids = idsOf(table);
      expect(ids.has('c-hero-portrait')).toBe(true); // 主角=左立绘框（各人数恒在）
      for (let s = 1; s < pc; s++) expect(ids.has(`c-seat-${s}`)).toBe(true); // 在场对手席卡都在
      for (let s = pc; s < 6; s++) expect(ids.has(`c-seat-${s}`)).toBe(false); // 不在场座不渲染
    }
    // 菜单人数段控 2~6 全在。
    const menu = buildMenu({ lang: 'en', playerCount: 4, playerName: '夜阑君', playerChips: 100, blindLabel: '25 / 50' });
    expect(validateLayoutNode(menu)).toEqual([]);
    const mids = idsOf(menu);
    for (const n of [2, 3, 4, 5, 6]) expect(mids.has(`c-menu-players-${n}`)).toBe(true);
  });
});
