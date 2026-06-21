// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mountDiceRoll } from './dice-roll.js';
import { clashDiceRoll } from './turn-combat.js';

describe('Game G · 掷命骰 3D 表现（dice-roll · 纯表现）', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ''; document.head.innerHTML = ''; });

  it('mount → 10 颗骰 + 门槛线；点投掷 → 滚 → 揭晓(我胜=绿) → 继续=onDone·浮层移除', () => {
    const host = document.createElement('div'); document.body.appendChild(host);
    const data = clashDiceRoll(0.2, 0.7, true); // 我胜
    const onDone = vi.fn();
    mountDiceRoll(host, { data, mine: { rank: 'A', suit: 's', pEff: 20 }, foe: { rank: '9', suit: 'h', pEff: 12 }, winPct: 70, laneName: '上路' }, onDone);
    const ov = host.querySelector('.gg-dice-ov')!;
    expect(ov).toBeTruthy();
    expect(ov.querySelectorAll('.gg-die')).toHaveLength(10);   // 10 颗骰
    expect(ov.querySelector('.gg-bar-mark')!.getAttribute('data-l')).toContain(String(data.threshold)); // 门槛线标注
    (ov.querySelector('.gg-dice-btn.throw') as HTMLButtonElement).click();
    vi.runAllTimers();                                         // 跑完滚动+入槽+揭晓
    expect(ov.querySelector('.gg-bar-fill')!.classList.contains('win')).toBe(true); // 我胜 → 绿槽
    const cont = ov.querySelector('.gg-dice-btn.cont') as HTMLButtonElement;
    expect(cont).toBeTruthy();
    cont.click();
    expect(onDone).toHaveBeenCalledOnce();
    expect(host.querySelector('.gg-dice-ov')).toBeNull();      // 继续后浮层移除
  });

  it('我负 → 红槽·继续仍回调', () => {
    const host = document.createElement('div'); document.body.appendChild(host);
    const onDone = vi.fn();
    mountDiceRoll(host, { data: clashDiceRoll(0.9, 0.3, false), mine: { rank: '2', suit: 'c', pEff: 4 }, foe: { rank: 'K', suit: 'd', pEff: 16 }, winPct: 30, laneName: '中路' }, onDone);
    (host.querySelector('.gg-dice-btn.throw') as HTMLButtonElement).click();
    vi.runAllTimers();
    expect(host.querySelector('.gg-bar-fill')!.classList.contains('lose')).toBe(true);
    (host.querySelector('.gg-dice-btn.cont') as HTMLButtonElement).click();
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('destroy 提前离场：清计时器 + 移除浮层·onDone 不被调用', () => {
    const host = document.createElement('div'); document.body.appendChild(host);
    const onDone = vi.fn();
    const fx = mountDiceRoll(host, { data: clashDiceRoll(0.5, 0.5, true), mine: { rank: 'A', suit: 's', pEff: 14 }, foe: { rank: 'A', suit: 'h', pEff: 14 }, winPct: 50, laneName: '下路' }, onDone);
    (host.querySelector('.gg-dice-btn.throw') as HTMLButtonElement).click();
    fx.destroy();                                             // 动画中途离场
    vi.runAllTimers();
    expect(host.querySelector('.gg-dice-ov')).toBeNull();
    expect(onDone).not.toHaveBeenCalled();
  });
});
