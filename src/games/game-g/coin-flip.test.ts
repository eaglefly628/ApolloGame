// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mountCoinFlip } from './coin-flip.js';

describe('Game G · 战胜硬币 3D 表现（coin-flip · 纯表现）', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ''; document.head.innerHTML = ''; });

  it('我方胜：出【掷硬币】钮 → 点掷 → 人头(留场)揭晓 → 继续=onDone·浮层移除', () => {
    const host = document.createElement('div'); document.body.appendChild(host);
    const onDone = vi.fn();
    mountCoinFlip(host, { winnerName: '黑桃A', winnerMine: true, heads: true }, onDone);
    const ov = host.querySelector('.gg-coin-ov')!;
    expect(ov.textContent).toContain('黑桃A 战胜');
    const throwBtn = ov.querySelector('.gg-coin-btn.throw') as HTMLButtonElement;
    expect(throwBtn).toBeTruthy();                       // 我方 → 有掷钮
    throwBtn.click();
    vi.runAllTimers();
    expect((ov.querySelector('.gg-coin') as HTMLElement).style.getPropertyValue('--end')).toContain('1800'); // 人头落定 5*360+0
    expect(ov.textContent).toContain('人头');
    const cont = ov.querySelector('.gg-coin-btn.cont') as HTMLButtonElement;
    expect(cont).toBeTruthy();
    cont.click();
    expect(onDone).toHaveBeenCalledOnce();
    expect(host.querySelector('.gg-coin-ov')).toBeNull();
  });

  it('敌方胜：无掷钮·自动掷 → 人面(回库)揭晓 → 继续=onDone', () => {
    const host = document.createElement('div'); document.body.appendChild(host);
    const onDone = vi.fn();
    mountCoinFlip(host, { winnerName: '红桃K', winnerMine: false, heads: false }, onDone);
    expect(host.querySelector('.gg-coin-btn.throw')).toBeNull(); // 敌方 → 无掷钮(自动)
    vi.runAllTimers();
    expect((host.querySelector('.gg-coin') as HTMLElement).style.getPropertyValue('--end')).toContain('1980'); // 人面落定 5*360+180
    expect(host.querySelector('.gg-coin-ov')!.textContent).toContain('人面');
    (host.querySelector('.gg-coin-btn.cont') as HTMLButtonElement).click();
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('destroy 提前离场：移除浮层·onDone 不调用', () => {
    const host = document.createElement('div'); document.body.appendChild(host);
    const onDone = vi.fn();
    const fx = mountCoinFlip(host, { winnerName: 'X', winnerMine: false, heads: true }, onDone);
    fx.destroy();
    vi.runAllTimers();
    expect(host.querySelector('.gg-coin-ov')).toBeNull();
    expect(onDone).not.toHaveBeenCalled();
  });
});
