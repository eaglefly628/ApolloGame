import { describe, it, expect } from 'vitest';
import { clamp01, smoothstep, hangWarp, revealGlow, faceUpVisible, laneRevealProgress, encounterReveal, easeOutCubic } from './feel.js';

// design/15 手感曲线：纯表现函数（不进 hash），headless 可测其数学性质。
// 渲染器消费它演"命运一掷"：hangWarp=顶点滞空(屏息命门)、revealGlow=落地揭晓、faceUpVisible=金/石分支。
describe('Game G · 手感曲线 feel（design/15 · 纯表现 · 不进 hash）', () => {
  it('clamp01 钳位 [0,1]', () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(1.5)).toBe(1);
    expect(clamp01(0.3)).toBe(0.3);
  });

  it('smoothstep：端点 0/1、单调、中点 0.5、a===b 退化', () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 2)).toBe(1);
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5, 6);
    let prev = -1;
    for (let x = 0; x <= 1.0001; x += 0.05) { const y = smoothstep(0, 1, x); expect(y).toBeGreaterThanOrEqual(prev); prev = y; }
    expect(smoothstep(2, 2, 5)).toBe(1);
  });

  it('hangWarp（滞空命门）：端点保持(0/0.5/1 不变)、处处单调、apex 中段最慢', () => {
    expect(hangWarp(0)).toBeCloseTo(0, 6);
    expect(hangWarp(1)).toBeCloseTo(1, 6);
    expect(hangWarp(0.5)).toBeCloseTo(0.5, 6);
    let prev = -1;
    for (let t = 0; t <= 1.0001; t += 0.02) { const s = hangWarp(t); expect(s).toBeGreaterThanOrEqual(prev); prev = s; }
    // 滞空 = apex(0.5) 附近视觉进度变化 < 同宽端点附近（中段慢、两端快）
    const dMid = hangWarp(0.52) - hangWarp(0.48);
    const dEnd = hangWarp(0.04) - hangWarp(0);
    expect(dMid).toBeLessThan(dEnd);
  });

  it('hangWarp：k 越大滞空越明显（中段斜率更小），k<1 仍处处单调', () => {
    const slope = (k: number): number => hangWarp(0.52, k) - hangWarp(0.48, k);
    expect(slope(0.9)).toBeLessThan(slope(0.3));
    let prev = -1;
    for (let t = 0; t <= 1.0001; t += 0.02) { const s = hangWarp(t, 0.9); expect(s).toBeGreaterThanOrEqual(prev); prev = s; }
  });

  it('revealGlow：落地前(≤0.78)=0、落定(1)=1、之间单调上升', () => {
    expect(revealGlow(0.5)).toBe(0);
    expect(revealGlow(0.78)).toBe(0);
    expect(revealGlow(1)).toBeCloseTo(1, 6);
    expect(revealGlow(0.9)).toBeGreaterThan(0);
    expect(revealGlow(0.9)).toBeLessThan(1);
  });

  it('faceUpVisible：cos>0=正面(活)；0/2π·k=正、π/2π·k+π=反（含空翻圈数）', () => {
    expect(faceUpVisible(0)).toBe(true);
    expect(faceUpVisible(Math.PI)).toBe(false);
    expect(faceUpVisible(4 * Math.PI)).toBe(true); // 2 圈空翻落正面
    expect(faceUpVisible(4 * Math.PI + Math.PI)).toBe(false); // 落反面
  });

  it('laneRevealProgress（逐路揭晓）：上路(0)先翻、下路(2)后翻；prog=1 各路皆落定；每路单调', () => {
    // 中段：上路进度 > 下路（依次揭晓）
    expect(laneRevealProgress(0.5, 0)).toBeGreaterThan(laneRevealProgress(0.5, 2));
    expect(laneRevealProgress(0.5, 0)).toBeGreaterThan(laneRevealProgress(0.5, 1));
    // prog=1：三路都落定到 1（结束态一致）
    for (const L of [0, 1, 2]) expect(laneRevealProgress(1, L)).toBeCloseTo(1, 6);
    // 每路随 prog 单调不减
    for (const L of [0, 1, 2]) { let prev = -1; for (let p = 0; p <= 1.0001; p += 0.05) { const v = laneRevealProgress(p, L); expect(v).toBeGreaterThanOrEqual(prev); prev = v; } }
    expect(laneRevealProgress(0, 2)).toBe(0); // 起点
  });

  it('encounterReveal（接敌点揭晓，MARCH-2/design17§八）：行军前段≈面朝下(0)、接敌后段翻、逐路错开、随拍单调', () => {
    const F = 90;
    expect(encounterReveal(0, F, 1)).toBe(0); // 出发：面朝下
    expect(encounterReveal(F * 0.4, F, 1)).toBe(0); // 行军前段(<0.55F)仍面朝下
    expect(encounterReveal(F, F, 0)).toBeGreaterThan(0.5); // 接敌(≈flipDuration)已翻
    expect(encounterReveal(F * 1.1, F, 2)).toBeCloseTo(1, 6); // 越过即全揭晓
    expect(encounterReveal(F * 0.8, F, 0)).toBeGreaterThan(encounterReveal(F * 0.8, F, 2)); // 上路先翻 > 下路
    for (const L of [0, 1, 2]) { let prev = -1; for (let e = 0; e <= F * 1.2; e += F * 0.05) { const v = encounterReveal(e, F, L); expect(v).toBeGreaterThanOrEqual(prev); prev = v; } } // 随拍单调
  });

  it('easeOutCubic：端点 0/1、单调、缓出（前段快）', () => {
    expect(easeOutCubic(0)).toBeCloseTo(0, 6);
    expect(easeOutCubic(1)).toBeCloseTo(1, 6);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5); // 缓出：中点已过半
    let prev = -1; for (let x = 0; x <= 1.0001; x += 0.05) { const y = easeOutCubic(x); expect(y).toBeGreaterThanOrEqual(prev); prev = y; }
  });
});
