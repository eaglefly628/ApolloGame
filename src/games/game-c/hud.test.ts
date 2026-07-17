import { describe, it, expect } from 'vitest';
import { validateLayoutNode } from '@ui/components/validate.js';
import type { Card } from '@engine/protocol/components.js';
import { buildTable, buildMenu, type TableView } from './hud.js';
import { CLOTHING_ITEMS } from './wardrobe.js';
import { OPPONENT_ANCHORS } from './theme.js';

const H = (suit: number, rank: number): Card => ({ suit, rank });

function baseView(over: Partial<TableView> = {}): TableView {
  return {
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

  it('座位卡覆盖全部六席（主角 + 五姨太锚点实名）', () => {
    const table = buildTable(baseView());
    const ids = new Set<string>();
    const walk = (n: { id?: string; children?: unknown[] }): void => {
      if (n.id) ids.add(n.id);
      for (const c of (n.children ?? []) as { id?: string; children?: unknown[] }[]) walk(c);
    };
    walk(table);
    for (const seat of [0, 1, 2, 3, 4, 5]) expect(ids.has(`c-seat-${seat}`)).toBe(true);
    expect(OPPONENT_ANCHORS.map((a) => a.name)).toEqual(['大姨太', '二姨太', '三姨太', '四姨太', '五姨太']);
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
    expect(validateLayoutNode(buildMenu({ playerName: '夜阑君', playerChips: 12860, blindLabel: '25 / 50' }))).toEqual([]);
  });
});
