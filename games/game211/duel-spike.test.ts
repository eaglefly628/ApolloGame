// duel-spike 判词纯函数测试（物理表现不可测·但「朝上面 → 生死判词」这一步是纯函数·必须钉死）。
// 面序 [+X,-X,+Y,-Y,+Z,-Z]：+Z(index 4)=牌正面=活；其余=反面/立面=亡。
import { describe, it, expect } from 'vitest';
import { judgeDuel, upYOf, offsetUnder, type CardOutcome } from './duel-spike.js';

const c = (side: 'a' | 'b', upY: number): CardOutcome => ({ side, upY, front: upY > 0 });
// 绕 X 轴转 θ 的四元数（圆牌翻面就是绕水平轴翻）。
const qx = (t: number): [number, number, number, number] => [Math.sin(t / 2), 0, 0, Math.cos(t / 2)];

describe('judgeDuel · 抛掷定生死', () => {
  it('一正一反 → 正面者胜（我方正面=胜）', () => {
    expect(judgeDuel(c('a', 0.99), c('b', -0.99))).toBe('我方正面朝上 · 胜');
  });
  it('一正一反 → 正面者胜（敌方正面=负）', () => {
    expect(judgeDuel(c('a', -0.99), c('b', 0.99))).toBe('敌方正面朝上 · 负');
  });
  it('双正 → 同生（平）', () => {
    expect(judgeDuel(c('a', 0.99), c('b', 0.96))).toBe('双双正面 · 同生（平）');
  });
  it('双反 → 同归于尽（平）', () => {
    expect(judgeDuel(c('a', -0.99), c('b', -0.96))).toBe('双双反面 · 同归于尽（平）');
  });
});

describe('upYOf · 圆牌朝向读数', () => {
  it('不转 = 正面完全朝上（+1）', () => { expect(upYOf([0, 0, 0, 1])).toBeCloseTo(1, 6); });
  it('绕 X 翻 180° = 反面朝上（−1）', () => { expect(upYOf(qx(Math.PI))).toBeCloseTo(-1, 6); });
  it('绕 X 翻 90° = 立在边上（0）——圆牌的不稳定平衡·物理上落不住', () => { expect(upYOf(qx(Math.PI / 2))).toBeCloseTo(0, 6); });
  it('绕 Y 自旋不改变正反（仍是正面朝上）', () => { expect(upYOf([0, Math.sin(1), 0, Math.cos(1)])).toBeCloseTo(1, 6); });
});

describe('offsetUnder · 反面片跟随偏移', () => {
  it('不转 → 就在正下方', () => {
    const [x, y, z] = offsetUnder([0, 0, 0, 1], 0.05);
    expect(x).toBeCloseTo(0, 6); expect(y).toBeCloseTo(-0.05, 6); expect(z).toBeCloseTo(0, 6);
  });
  it('绕 X 翻 180° → 跑到正上方（这正是「翻过来看见反面」的几何）', () => {
    const [x, y, z] = offsetUnder(qx(Math.PI), 0.05);
    expect(x).toBeCloseTo(0, 6); expect(y).toBeCloseTo(0.05, 6); expect(z).toBeCloseTo(0, 6);
  });
  it('绕 X 翻 90° → 偏到侧面（y≈0）', () => {
    const [, y] = offsetUnder(qx(Math.PI / 2), 0.05);
    expect(y).toBeCloseTo(0, 6);
  });
  it('偏移模长恒等于 d（旋转不改变距离）', () => {
    const q = [0.3, 0.5, 0.2, Math.sqrt(1 - 0.09 - 0.25 - 0.04)];
    const [x, y, z] = offsetUnder(q, 0.07);
    expect(Math.hypot(x, y, z)).toBeCloseTo(0.07, 6);
  });
});
