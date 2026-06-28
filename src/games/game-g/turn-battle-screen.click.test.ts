// @vitest-environment happy-dom
// 回合制战斗屏 live mount 交互测试：DOM 真按下(pointerdown) → turn-combat 动作回调验证（doc24「运转逻辑」）。
// 同 battle-screen.click.test.ts 守护：驱动层重渲会吃掉 click → 必须 pointerdown（按下即派发到当下 DOM）。固定四选一/选牌/落子/翻门/结束回合/换皮 钩子。
import { describe, it, expect, vi } from 'vitest';
import { initTurnBattle } from './turn-combat.js';
import { mountTurnBattle, buildTurnBattleView, buildTurnFrameHTML, type TurnBattleActions, type TurnViewOpts } from './turn-battle-screen.js';

const press = (el: Element | null, button = 0): void => { if (!el) throw new Error('press target null'); el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button })); };

const makeActions = (): { [K in keyof TurnBattleActions]-?: ReturnType<typeof vi.fn> } => ({
  pickAction: vi.fn(), drawFrom: vi.fn(), selectHand: vi.fn(), playLane: vi.fn(), toggleGate: vi.fn(), endTurn: vi.fn(), setTheme: vi.fn(), clashConfirm: vi.fn(), clashRoll: vi.fn(),
  goBack: vi.fn(), bossInfo: vi.fn(), toggleSfx: vi.fn(), toggleSettings: vi.fn(), toggleBgm: vi.fn(), toggleGuide: vi.fn(), selectBgm: vi.fn(), setBgmVol: vi.fn(),
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
    for (const sel of ['[data-action="draw"]', '[data-action="deploy"]', '[data-action="cast"]', '[data-action="discard"]', // 四选一已迁数据驱动动作菜单 → data-action
      '[data-action="end"]', '[data-action="settings-toggle"]', '[data-action="theme"][data-arg="onyx"]', '[data-action="theme"][data-arg="brocade"]', // end/settings-toggle/theme 均迁 LayoutNode（设置浮层 Segmented）→ data-action[+data-arg]
      '[data-action="go-back"]',
      '[data-hand="0"]', '[data-hand="1"]', '[data-lane="0"]', '[data-lane="1"]', '[data-lane="2"]',
      '[data-gate="0"]', '[data-gate="7"]']) {
      expect(host.querySelector(sel), sel).not.toBeNull();
    }
  });

  it('按下数据驱动顶栏（LayoutNode·data-action）→ goBack / toggleSettings（统一委托接 data-action）', () => {
    const { host, actions } = setup();
    press(host.querySelector('[data-action="go-back"]'));
    press(host.querySelector('[data-action="settings-toggle"]'));
    expect(actions.goBack).toHaveBeenCalledTimes(1);
    expect(actions.toggleSettings).toHaveBeenCalledTimes(1);
  });

  it('按下四选一动作 → pickAction(类别)', () => {
    const { host, actions } = setup();
    press(host.querySelector('[data-action="deploy"]'));
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
    press(host.querySelector('[data-action="end"]'));
    press(host.querySelector('[data-action="theme"][data-arg="brocade"]'));
    expect(actions.endTurn).toHaveBeenCalledTimes(1);
    expect(actions.setTheme).toHaveBeenCalledWith('brocade');
  });

  it('按下敌方大本营 → bossInfo（弹 Boss 名号+战役故事·owner 2026-06-21）', () => {
    const { host, actions } = setup();
    const fort = host.querySelector('[data-act="boss-info"]');
    expect(fort, '敌方大本营应可点（boss-info 钩子）').not.toBeNull();
    press(fort);
    expect(actions.bossInfo).toHaveBeenCalledTimes(1);
  });

  it('抽牌模式 → 渲两库钮，按下 → drawFrom(poker/tengang)', () => {
    const { host, actions } = setup({ selMode: 'draw' });
    press(host.querySelector('[data-action="draw-poker"]'));
    press(host.querySelector('[data-action="draw-tengang"]'));
    expect(actions.drawFrom.mock.calls.map((c) => c[0])).toEqual(['poker', 'tengang']);
  });

  it('教学钩子（doc28·纯表现层）：tutorial 旁白横幅 + 抽牌钮可被 coachmark 锚点高亮', () => {
    const { host } = setup({ tutorial: { narration: '每回合只能选一类，先【抽牌】。', highlight: 'act:draw' } });
    expect(host.textContent).toContain('每回合只能选一类'); // 教官旁白横幅（仍手写覆盖层·tutorial.narration）
    expect(host.innerHTML).toContain('🎓');
    // 动作钮迁 LayoutNode 后，高亮不再走内联 g-hl 描边，而由 coachmark overlay 经 data-anchor spotlight；锚点即高亮目标。
    expect(host.querySelector('[data-anchor="combat-draw"]'), 'combat-draw 锚点').not.toBeNull();
  });

  it('放牌待落点：渲手指 👆 +「放这里」轻点指示（owner 2026-06-21）', () => {
    const b = initTurnBattle({ seed: 1, a: { pokerDeck: [] } });
    b.a.mana = 4; b.a.hand.push({ kind: 'poker', id: 'h0', rank: 'K', suit: 'S', general: false, buff: 0 });
    const html = buildTurnFrameHTML(buildTurnBattleView(b, { selMode: 'deploy', selHand: 0 })); // 选中兵牌待放 → 落点高亮+手指
    expect(html).toContain('👆'); // 指示手指
    expect(html).toContain('放这里'); // 文案
    expect(html).toContain('g-tap'); // 手指轻点动画
    expect(html).toContain('g-ripple'); // 点击涟漪
  });

  it('召唤源泉消耗：drain 透传 → 底部横条格「往后退」收退动效（owner 2026-06-21·别 biang 剪掉·徽标已回滚）', () => {
    const b = initTurnBattle({ seed: 1, a: { pokerDeck: [] } });
    b.a.mana = 2;
    const drained = buildTurnFrameHTML(buildTurnBattleView(b), { from: 2, count: 2 }); // 刚花掉 2 格
    expect(drained).toContain('召唤源泉 · SUMMON FONT'); // 旧版底部横条（owner 要回来·挺好看）
    expect(drained).toContain('animation:g-drain'); // 收退鬼影
    expect(drained).toContain('animation:g-drainspark'); // 升腾火花
    const still = buildTurnFrameHTML(buildTurnBattleView(b)); // 无消耗：不渲收退
    expect(still).not.toContain('animation:g-drain');
  });
});
