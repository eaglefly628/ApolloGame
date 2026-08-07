// @vitest-environment happy-dom
// 临时·流程走查（owner 2026-06-20「整个流程走一遍找 bug」）：mount → 出征 → 打到结算 → 点继续 → 看转场，全程不抛错。
import { describe, it, expect, vi } from 'vitest';
import { mount } from './game211.js';

const press = (el: Element | null): void => { if (el) el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 })); };
const click = (el: Element | null): void => { if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true })); };

describe('Game G · 流程走查（出征→结算→继续·happy-dom）', () => {
  it('打满一局到结算 + 继续转场 全程不抛错', () => {
    vi.useFakeTimers();
    try {
      localStorage.clear();
      (window as unknown as { __ggFastPerf?: boolean }).__ggFastPerf = true; // 演出快进（Lead·BUG-G-flow-walk）：走查把演出节奏折成最小 tick·移出 sim 测试预算·并发下不再超时
      const c = document.createElement('div'); document.body.appendChild(c);
      const cleanup = mount(c);
      click(c.querySelector('[data-action="play"]'));
      const skipStory = (): void => { const s = c.querySelector('[data-act="story-skip"]'); if (s) click(s); }; // doc27 每关开局演出 → 跳过进战斗
      skipStory();
      expect(c.querySelector('[data-action="end"]'), '进战斗屏').not.toBeNull();

      let settled = false;
      expect(() => {
        for (let turn = 0; turn < 160 && !settled; turn++) {
          // 有手牌→放牌(轮转三路)；手空→抽牌补；再结束回合→冲特写计时（智能些·能赢→也走三选一）
          if (c.querySelector('[data-hand="0"]')) {
            press(c.querySelector('[data-action="deploy"]'));
            press(c.querySelector('[data-hand="0"]'));
            press(c.querySelector(`[data-action="lane"][data-arg="${turn % 3}"]`));
          } else {
            press(c.querySelector('[data-action="draw"]'));
            press(c.querySelector('[data-action="draw-poker"]'));
          }
          press(c.querySelector('[data-action="end"]'));
          // 逐场掷命（owner 2026-06-21）：前奏→点🎲掷骰揭晓→看明白了→战胜硬币(我方点掷/敌方自动)落定→继续，推进直到无对决
          let g = 0;
          vi.runAllTimers();                                                                  // 冲掉「即将交战」前奏 → 现首个掷骰/看明白了
          while ((c.querySelector('[data-act="clash-roll"],[data-action="clash-roll"]') || c.querySelector('[data-act="clash-ok"],[data-action="clash-ok"]')) && g++ < 600) {
            const roll = c.querySelector('[data-act="clash-roll"],[data-action="clash-roll"]'); // 掷命钮迁数据驱动后挂 data-action（棋枰数据化①）·选择器双挂兼容
            if (roll) { press(roll); vi.runAllTimers(); continue; }                            // 先点🎲掷骰 → 揭晓胜负 → 现「看明白了」
            press(c.querySelector('[data-act="clash-ok"],[data-action="clash-ok"]'));          // 看明白了 → 弹战胜硬币
            const thr = c.querySelector('.gg-coin-btn.throw'); if (thr) click(thr);            // 我方胜→玩家点掷；敌方→自动掷
            vi.runAllTimers();                                                                 // 硬币翻腾落定 → 现「继续」
            const cont = c.querySelector('.gg-coin-btn.cont'); if (cont) click(cont);          // 继续 → perfResume → 下一场
            vi.runAllTimers();                                                                 // 冲掉下一场前奏 → 现下一掷骰/看明白了(或收场)
          }
          vi.runAllTimers();
          if (c.querySelector('#gg-result-cont')) settled = true;
        }
      }, '战斗循环').not.toThrow();

      expect(settled, '120 回合内分出胜负进结算').toBe(true);
      // 结算面板 → 点继续（→ 三选一/重整/大厅）不抛错
      expect(() => { click(c.querySelector('#gg-result-cont')); vi.runAllTimers(); }, '结算继续转场').not.toThrow();
      // 转场后应落在某个合法屏（大厅出征 / 三选一 / 开局演出 / 又一场战斗）
      const onLobby = c.querySelector('[data-action="play"]');
      const onBetween = c.textContent?.includes('三选一') || c.querySelector('[data-between]');
      const onStory = c.querySelector('[data-act="story-skip"]');
      const onBattle = c.querySelector('[data-action="end"]');
      expect(Boolean(onLobby) || Boolean(onBetween) || Boolean(onStory) || Boolean(onBattle), '转到合法屏').toBe(true);

      cleanup(); c.remove();
    } finally { vi.useRealTimers(); }
  });
});
