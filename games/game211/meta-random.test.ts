// 局外元层种子 PRNG（owner 2026-08-10 裁「把裸 Math.random 去掉」的落地件）。
// 钉三件事：① 真的走引擎 PRNG（同种子可复现·裸随机做不到）② 取值域正确 ③ 洗牌不丢牌不改原表。
import { describe, it, expect } from 'vitest';
import { __setMetaSeed, metaRandom, metaInt, metaPick, metaShuffle } from './meta-random.js';

describe('meta-random · 元层种子 PRNG', () => {
  it('同种子 → 同序列（可复现·这是换掉裸随机换来的关键性质）', () => {
    __setMetaSeed(12345);
    const a = Array.from({ length: 20 }, () => metaRandom());
    __setMetaSeed(12345);
    const b = Array.from({ length: 20 }, () => metaRandom());
    expect(a).toEqual(b);
  });

  it('不同种子 → 不同序列（没退化成常数）', () => {
    __setMetaSeed(1);
    const a = Array.from({ length: 20 }, () => metaRandom());
    __setMetaSeed(2);
    const b = Array.from({ length: 20 }, () => metaRandom());
    expect(a).not.toEqual(b);
  });

  it('metaRandom ∈ [0,1)', () => {
    __setMetaSeed(999);
    for (let i = 0; i < 500; i++) {
      const v = metaRandom();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('metaInt(n) ∈ [0,n) 且能取到两端（不是恒定值）', () => {
    __setMetaSeed(7);
    const seen = new Set<number>();
    for (let i = 0; i < 800; i++) {
      const v = metaInt(6);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
      seen.add(v);
    }
    expect(seen.size).toBe(6); // 6 面都出现过
  });

  it('metaPick 空表 → undefined；非空表恒落在表内', () => {
    expect(metaPick([])).toBeUndefined();
    __setMetaSeed(42);
    const xs = ['a', 'b', 'c'];
    for (let i = 0; i < 100; i++) expect(xs).toContain(metaPick(xs));
  });

  it('metaShuffle 不丢牌、不改原表', () => {
    const src = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8]);
    __setMetaSeed(2026);
    const out = metaShuffle(src);
    expect(out).toHaveLength(src.length);
    expect([...out].sort((x, y) => x - y)).toEqual([...src]);
    expect(src).toEqual([1, 2, 3, 4, 5, 6, 7, 8]); // 原表未被就地改动
  });

  it('metaShuffle 真的洗了（同种子下不恒等于原序）', () => {
    __setMetaSeed(5);
    const src = Array.from({ length: 30 }, (_, i) => i);
    expect(metaShuffle(src)).not.toEqual(src);
  });

  it('种子 0 被兜住（不退化成全零态）', () => {
    __setMetaSeed(0);
    const a = Array.from({ length: 10 }, () => metaRandom());
    expect(new Set(a).size).toBeGreaterThan(1);
  });
});
