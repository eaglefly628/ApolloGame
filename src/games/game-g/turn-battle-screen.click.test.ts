// @vitest-environment happy-dom
// 回合制战斗屏 live mount 交互测试：DOM 真按下(pointerdown) → turn-combat 动作回调验证（doc24「运转逻辑」）。
// 同 battle-screen.click.test.ts 守护：驱动层重渲会吃掉 click → 必须 pointerdown（按下即派发到当下 DOM）。固定四选一/选牌/落子/翻门/结束回合/换皮 钩子。
import { describe, it, expect, vi } from 'vitest';
import { initTurnBattle } from './turn-combat.js';
import { mountTurnBattle, buildTurnBattleView, type TurnBattleActions, type TurnViewOpts } from './turn-battle-screen.js';

const press = (el: Element | null, button = 0): void => { if (!el) throw new Error('press target null'); el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button })); };

const makeActions = (): { [K in keyof TurnBattleActions]-?: ReturnType<typeof vi.fn> } => ({
  pickAction: vi.fn(), drawFrom: vi.fn(), selectHand: vi.fn(), playLane: vi.fn(), toggleGate: vi.fn(), endTurn: vi.fn(), setTheme: vi.fn(), clashConfirm: vi.fn(),
  goBack: vi.fn(), toggleSfx: vi.fn(), toggleSettings: vi.fn(),
});

function setup(opts: TurnViewOpts = {}) {
  const b = initTurnBattle({ seed: 1, a: { pokerDeck: [{ kind: 'poker', id: 'p0', rank: '7', suit: 'S', general: false, buff: 0 }] } });
  b.a.mana = 4; b.a.hand.push({ kind: 'poker', id: 'h0', rank: 'K', suit: 'S', general: false, buff: 0 }, { kind: 'tengang', id: 'hufu' });
  const host = document.createElement('div'); document.body.appendChild(host);
  const actions = makeActions();
  const handle = mountTurnBattle(host, () => buildTurnBattleView(b, opts), actions);
  return { host, actions, handle };
}

describe('Game G · turn-battle-screen live mount 交互（doc24 回合制 · DOM · happy-dom）', () => {
  it('画框渲齐 data 钩子：四选一/结束回合/换皮/手牌/三路格/8 门钮', () => {
    const { host } = setup({ settingsOpen: true }); // 换皮(主题)按钮现归 ⚙ 设置面板（topbar 重组 bfa0fd69）→ 开面板才渲
    for (const sel of ['[data-act="draw"]', '[data-act="deploy"]', '[data-act="cast"]', '[data-act="discard"]',
      '[data-act="end"]', '[data-act="settings-toggle"]', '[data-act="theme"][data-k="onyx"]', '[data-act="theme"][data-k="brocade"]',
      '[data-hand="0"]', '[data-hand="1"]', '[data-lane="0"]', '[data-lane="1"]', '[data-lane="2"]',
      '[data-gate="0"]', '[data-gate="7"]']) {
      expect(host.querySelector(sel), sel).not.toBeNull();
    }
  });

  it('按下四选一动作 → pickAction(类别)', () => {
    const { host, actions } = setup();
    press(host.querySelector('[data-act="deploy"]'));
    expect(actions.pickAction).toHaveBeenCalledWith('deploy');
  });

  it('按下手牌 → selectHand(序号)', () => {
    const { host, actions } = setup();
    press(host.querySelector('[data-hand="1"]'));
    expect(actions.selectHand).toHaveBeenCalledWith(1);
  });

  it('按下三路格 → playLane(0/1/2)', () => {
    const { host, actions } = setup();
    press(host.querySelector('[data-lane="0"]'));
    press(host.querySelector('[data-lane="2"]'));
    expect(actions.playLane.mock.calls.map((c) => c[0])).toEqual([0, 2]);
  });

  it('按下捷径门钮 → toggleGate(门号)', () => {
    const { host, actions } = setup();
    press(host.querySelector('[data-gate="0"]'));
    expect(actions.toggleGate).toHaveBeenCalledWith(0);
  });

  it('按下结束回合 / 换皮 → endTurn / setTheme', () => {
    const { host, actions } = setup({ settingsOpen: true }); // 主题钮在 ⚙ 设置面板内
    press(host.querySelector('[data-act="end"]'));
    press(host.querySelector('[data-act="theme"][data-k="brocade"]'));
    expect(actions.endTurn).toHaveBeenCalledTimes(1);
    expect(actions.setTheme).toHaveBeenCalledWith('brocade');
  });

  it('抽牌模式 → 渲两库钮，按下 → drawFrom(poker/tengang)', () => {
    const { host, actions } = setup({ selMode: 'draw' });
    press(host.querySelector('[data-act="draw-poker"]'));
    press(host.querySelector('[data-act="draw-tengang"]'));
    expect(actions.drawFrom.mock.calls.map((c) => c[0])).toEqual(['poker', 'tengang']);
  });

  it('教学钩子（doc28·纯表现层）：tutorial 旁白横幅 + 高亮被强制元素', () => {
    const { host } = setup({ tutorial: { narration: '每回合只能选一类，先【抽牌】。', highlight: 'act:draw' } });
    expect(host.textContent).toContain('每回合只能选一类'); // 教官旁白横幅
    expect(host.innerHTML).toContain('🎓');
    expect(host.innerHTML).toContain('g-hl'); // 金描边脉冲高亮（套在抽牌钮上）
  });
});
