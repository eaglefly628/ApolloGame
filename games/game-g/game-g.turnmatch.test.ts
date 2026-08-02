// @vitest-environment happy-dom
// 集成冒烟（doc24 大转向回归守护）：mount() → 点「出征」→ 必须进【回合制】战斗屏(turn-battle-screen)，不是旧实时三路。
// owner 报「拉最新还是老的三路/老逻辑」——根因：startBattle 仍走旧 showMatch。本测钉死 startBattle → showTurnMatch，
// 并冒烟一回合（选放牌→选牌→落子→结束回合→AI→特写）全流程不抛错。
import { describe, it, expect, vi } from 'vitest';
import { mount } from './game-g.js';

const click = (el: Element | null): void => { if (!el) throw new Error('click target null'); el.dispatchEvent(new MouseEvent('click', { bubbles: true })); };
const press = (el: Element | null): void => { if (!el) throw new Error('press target null'); el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 })); };

describe('Game G · 集成：出征进【回合制】战斗屏（doc24·happy-dom）', () => {
  it('点出征 → 挂回合制战斗屏（三行为抽/打/换·结束回合·三路9格 齐），非旧实时三路', () => {
    localStorage.clear();
    const container = document.createElement('div'); document.body.appendChild(container);
    const cleanup = mount(container);
    // 大厅「出征」CTA
    const play = container.querySelector('[data-action="play"]');
    expect(play, '大厅出征按钮').not.toBeNull();
    expect(() => click(play)).not.toThrow();
    // 出征先放每关开局演出（doc27）→ 跳过进战斗
    const skip = container.querySelector('[data-act="story-skip"]');
    if (skip) click(skip);
    // 进回合制战斗屏：三行为顶钮(抽/打/换) + 结束回合 + 三路格（旧实时三路屏没有这些 data 钩子）。四选一互斥+机关门钮已退役（owner 2026-07-03）。
    for (const sel of ['[data-action="end"]', '[data-action="draw"]', '[data-action="play"]', '[data-action="swap"]', '[data-action="lane"][data-arg="0"]', '[data-action="lane"][data-arg="2"]']) {
      expect(container.querySelector(sel), sel).not.toBeNull();
    }
    cleanup();
    container.remove();
  });


  it('冒烟一回合：放牌(选牌→落子) + 结束回合(AI+特写) 全流程不抛错', () => {
    vi.useFakeTimers();
    try {
      localStorage.clear();
      const container = document.createElement('div'); document.body.appendChild(container);
      const cleanup = mount(container);
      click(container.querySelector('[data-action="play"]'));
      { const skip = container.querySelector('[data-act="story-skip"]'); if (skip) click(skip); } // 跳过开局演出 → 进战斗
      expect(() => {
        press(container.querySelector('[data-hand="0"]'));        // 选第一张手牌 → 进「打·部署」选中态（三行为·选牌即入打）
        press(container.querySelector('[data-action="lane"][data-arg="1"]'));        // 落子中路
        press(container.querySelector('[data-action="end"]'));       // 结束回合 → 推进 + AI
        let g = 0;                                                // 逐场掷命：前奏(2s)→看明白了→战胜硬币(我方点掷/敌方自动)落定→继续
        vi.runAllTimers();                                        // 冲掉「即将交战」前奏 → 现首个「看明白了」
        while (container.querySelector('[data-act="clash-ok"],[data-action="clash-ok"]') && g++ < 400) {
          press(container.querySelector('[data-act="clash-ok"],[data-action="clash-ok"]'));        // 看明白了 → 弹战胜硬币（钮迁数据驱动后挂 data-action·棋枰数据化①·双挂兼容）
          const thr = container.querySelector('.gg-coin-btn.throw'); if (thr) click(thr);          // 我方胜→玩家点掷；敌方→自动掷
          vi.runAllTimers();                                                                       // 硬币翻腾落定 → 现「继续」
          const cont = container.querySelector('.gg-coin-btn.cont'); if (cont) click(cont);        // 继续 → perfResume → 下一场
          vi.runAllTimers();                                                                       // 冲掉下一场前奏 → 现下一「看明白了」(或收场)
        }
        vi.runAllTimers();
      }).not.toThrow();
      // 流程后仍在战斗(回到我方回合)或已结算(结果面板)——两者皆合法、皆不应崩
      const stillBattle = container.querySelector('[data-action="end"]');
      const settled = container.querySelector('#gg-result-cont');
      expect(Boolean(stillBattle) || Boolean(settled)).toBe(true);
      cleanup();
      container.remove();
    } finally {
      vi.useRealTimers();
    }
  });
});
