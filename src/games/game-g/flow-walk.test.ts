// @vitest-environment happy-dom
// 临时·流程走查（owner 2026-06-20「整个流程走一遍找 bug」）：mount → 出征 → 打到结算 → 点继续 → 看转场，全程不抛错。
import { describe, it, expect, vi } from 'vitest';
import { mount } from './game-g.js';

const press = (el: Element | null): void => { if (el) el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 })); };
const click = (el: Element | null): void => { if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true })); };

describe('Game G · 流程走查（出征→结算→继续·happy-dom）', () => {
  it('打满一局到结算 + 继续转场 全程不抛错', () => {
    vi.useFakeTimers();
    try {
      localStorage.clear();
      const c = document.createElement('div'); document.body.appendChild(c);
      const cleanup = mount(c);
      click(c.querySelector('[data-act="play"]'));
      const skipStory = (): void => { const s = c.querySelector('[data-act="story-skip"]'); if (s) click(s); }; // doc27 每关开局演出 → 跳过进战斗
      skipStory();
      expect(c.querySelector('[data-act="end"]'), '进战斗屏').not.toBeNull();

      let settled = false;
      expect(() => {
        for (let turn = 0; turn < 120 && !settled; turn++) {
          // 放牌：选放牌→第一张手牌→落子(轮转三路)→结束回合→冲特写计时
          press(c.querySelector('[data-act="deploy"]'));
          press(c.querySelector('[data-hand="0"]'));
          press(c.querySelector(`[data-lane="${turn % 3}"]`));
          press(c.querySelector('[data-act="end"]'));
          vi.runAllTimers();
          if (c.querySelector('#gg-result-cont')) settled = true;
        }
      }, '战斗循环').not.toThrow();

      expect(settled, '120 回合内分出胜负进结算').toBe(true);
      // 结算面板 → 点继续（→ 三选一/重整/大厅）不抛错
      expect(() => { click(c.querySelector('#gg-result-cont')); vi.runAllTimers(); }, '结算继续转场').not.toThrow();
      // 转场后应落在某个合法屏（大厅出征 / 三选一 / 开局演出 / 又一场战斗）
      const onLobby = c.querySelector('[data-act="play"]');
      const onBetween = c.textContent?.includes('三选一') || c.querySelector('[data-between]');
      const onStory = c.querySelector('[data-act="story-skip"]');
      const onBattle = c.querySelector('[data-act="end"]');
      expect(Boolean(onLobby) || Boolean(onBetween) || Boolean(onStory) || Boolean(onBattle), '转到合法屏').toBe(true);

      cleanup(); c.remove();
    } finally { vi.useRealTimers(); }
  });
});
