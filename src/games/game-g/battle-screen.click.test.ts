// @vitest-environment happy-dom
// 战斗出牌坞交互测试：DOM 真按下(pointerdown) → 回调验证。
// 回归守护 owner 报的「打仗时圣水摸牌/出牌/部署按键摁了都无效」——根因：驱动层 rAF 每 ~33ms 整片
// host.innerHTML 重建，一次「按下→抬起」期间按钮节点被销毁，click 找不到落点。改 pointerdown（单次离散
// 事件、按下即派发到当下 DOM）后必中。本测固定 pointerdown 路径，防回退到会被重渲吃掉的 click。

import { describe, it, expect, vi } from 'vitest';
import { mountBattle, type BattleView, type BattleActions } from './battle-screen.js';

const makeView = (o: Partial<BattleView> = {}): BattleView => ({
  homeA: 3, homeAMax: 3, homeB: 3, homeBMax: 3,
  oppName: '敌将', oppPersona: '稳健', oppSuit: 'h',
  energy: 0, energyMax: 0, materials: 12,
  phaseText: '行军', timeText: '00:30',
  levers: [],
  lanes: [
    { name: '上路', mine: 1, enemy: 0, lead: 'a', state: '推进', mineText: '1', enemyText: '0' },
    { name: '中路', mine: 0, enemy: 0, lead: 'n', state: '相持', mineText: '0', enemyText: '0' },
    { name: '下路', mine: 0, enemy: 1, lead: 'b', state: '受压', mineText: '0', enemyText: '1' },
  ],
  units: [],
  hand: [{ id: 'h1', rank: 'A', suit: 's', general: true }, { id: 'h2', rank: '7', suit: 'h', general: false }],
  selectedCard: -1, deckCount: 5,
  tengang: [{ id: 't1', name: '巧手' }],
  selectedTengang: -1, tengangDeckCount: 3,
  points: 6, pointsMax: 10,
  normalDrawCost: 1, tengangDrawCost: 2, canDrawNormal: true, canDrawTengang: true,
  migrateSource: -1,
  clash: null, fx: [],
  ...o,
});

const makeActions = (): { [K in keyof BattleActions]: ReturnType<typeof vi.fn> } => ({
  selectCard: vi.fn(), selectTengang: vi.fn(), playLane: vi.fn(), drawNormal: vi.fn(), drawTengang: vi.fn(),
});

function setup(viewOverrides: Partial<BattleView> = {}) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const actions = makeActions();
  mountBattle(host, () => makeView(viewOverrides), actions);
  return { host, actions };
}

function press(el: Element | null, button = 0): void {
  if (!el) throw new Error('press target is null');
  el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button }));
}
function click(el: Element | null): void {
  if (!el) throw new Error('click target is null');
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

describe('Game G · battle-screen 出牌坞交互（DOM · happy-dom）', () => {
  it('坞渲染齐全的 data-act 钩子（手牌/天罡/三路/摸牌）', () => {
    const { host } = setup();
    for (const sel of ['[data-act="hand"][data-i="0"]', '[data-act="tengang"][data-i="0"]',
      '[data-act="play"][data-k="top"]', '[data-act="play"][data-k="mid"]', '[data-act="play"][data-k="bot"]',
      '[data-act="draw-normal"]', '[data-act="draw-tengang"]']) {
      expect(host.querySelector(sel), sel).not.toBeNull();
    }
  });

  it('按下手牌 → selectCard(该牌序号)', () => {
    const { host, actions } = setup();
    press(host.querySelector('[data-act="hand"][data-i="1"]'));
    expect(actions.selectCard).toHaveBeenCalledWith(1);
  });

  it('按下天罡牌 → selectTengang(序号)', () => {
    const { host, actions } = setup();
    press(host.querySelector('[data-act="tengang"][data-i="0"]'));
    expect(actions.selectTengang).toHaveBeenCalledWith(0);
  });

  it('按下三路按钮 → playLane(top=0/mid=1/bot=2)', () => {
    const { host, actions } = setup();
    press(host.querySelector('[data-act="play"][data-k="top"]'));
    press(host.querySelector('[data-act="play"][data-k="mid"]'));
    press(host.querySelector('[data-act="play"][data-k="bot"]'));
    expect(actions.playLane.mock.calls.map((c) => c[0])).toEqual([0, 1, 2]);
  });

  it('按下「摸普通/摸天罡」→ drawNormal / drawTengang（圣水摸牌生效）', () => {
    const { host, actions } = setup();
    press(host.querySelector('[data-act="draw-normal"]'));
    press(host.querySelector('[data-act="draw-tengang"]'));
    expect(actions.drawNormal).toHaveBeenCalledTimes(1);
    expect(actions.drawTengang).toHaveBeenCalledTimes(1);
  });

  it('回归：click（非 pointerdown）不再触发 —— 因 rAF 重渲会吃掉 click', () => {
    const { host, actions } = setup();
    click(host.querySelector('[data-act="draw-normal"]'));
    click(host.querySelector('[data-act="hand"][data-i="0"]'));
    expect(actions.drawNormal).not.toHaveBeenCalled();
    expect(actions.selectCard).not.toHaveBeenCalled();
  });

  it('仅主键触发：右键(button=2)按下不出牌', () => {
    const { host, actions } = setup();
    press(host.querySelector('[data-act="draw-normal"]'), 2);
    expect(actions.drawNormal).not.toHaveBeenCalled();
  });
});
