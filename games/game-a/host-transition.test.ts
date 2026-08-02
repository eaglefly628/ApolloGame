// @vitest-environment happy-dom
// game-a 宿主集成测试（death-loop 回归护栏）——owner 2026-07-18 报「🏆X暂大 Y应对中…卡住·结算不出·菜单点不开」死机。
// 根因：UI reconciler 按**新根 id** 找元素打补丁，跨屏（牌桌 a-play → 结算 a-result）根 id 变→找不到→静默 no-op，
// 屏卡在旧树、后续每次 render 都重复 no-op（含菜单开合）。修法=宿主 paint() 跨屏重挂。
// 本测：驱动整盘 AI 至结算 → 断言 a-play 切到 a-result（转屏成功=死机已修）。
import { describe, it, expect, vi } from 'vitest';
import { mount } from './game-a.js';

describe('game-a 宿主 · 盘结算转屏（死机回归护栏）', () => {
  it('AI 走完一盘 → 牌桌屏 a-play 切到结算屏 a-result（不卡旧树）', () => {
    vi.useFakeTimers();
    try {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const teardown = mount(container);
      const $ = (id: string) => container.querySelector<HTMLElement>('#' + id);
      const click = (id: string): boolean => { const el = $(id); if (el) el.click(); return !!el; };

      expect(click('a-menu-start')).toBe(true); // 菜单 → 选桌
      expect(click('a-sel-seat')).toBe(true); // 选桌 → 入座（建 session·排 AI）
      expect($('a-play')).toBeTruthy(); // 牌桌屏就位

      // 驱动到某盘结算：轮到 hero（提示 或 过 可用）就 hint→出牌/过；否则推进定时器跑一步 AI（延迟上限 2000ms）。
      // 注：压不过时提示键禁用（must-pass 高亮「过」），故 hero 轮判定要看提示 OR 过任一可用。
      let reachedResult = false;
      for (let i = 0; i < 6000; i++) {
        if ($('a-result')) { reachedResult = true; break; }
        const hint = $('a-p-hint') as HTMLButtonElement | null;
        const passBtn = $('a-p-pass') as HTMLButtonElement | null;
        const heroTurn = (!!hint && !hint.disabled) || (!!passBtn && !passBtn.disabled);
        if (heroTurn) {
          if (hint && !hint.disabled) click('a-p-hint');
          const commit = $('a-p-commit') as HTMLButtonElement | null;
          if (commit && !commit.disabled) click('a-p-commit');
          else {
            const pass = $('a-p-pass') as HTMLButtonElement | null;
            if (pass && !pass.disabled) click('a-p-pass');
          }
        } else {
          vi.advanceTimersByTime(2100);
        }
      }
      expect(reachedResult).toBe(true); // 结算屏出现=转屏成功（死机根因已修）
      expect($('a-play')).toBeNull(); // 旧牌桌屏已被替换（非叠加）
      teardown();
    } finally {
      vi.useRealTimers();
    }
  });
});
