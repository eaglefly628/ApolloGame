import { describe, it, expect } from 'vitest';
import { randomCapability, nextRandom, randomInt } from './index.js';
import type { RandomSeed } from '@engine/protocol/components.js';

function seed(s: number): RandomSeed {
  return { type: 'RandomSeed', seed: s, sequence: 0 };
}

describe('random atom', () => {
  it('is a world-service atom with no per-tick system', () => {
    expect(randomCapability.systems).toHaveLength(0);
  });

  it('produces a deterministic sequence for the same seed', () => {
    const a = seed(42);
    const b = seed(42);
    const seqA = [nextRandom(a), nextRandom(a), nextRandom(a)];
    const seqB = [nextRandom(b), nextRandom(b), nextRandom(b)];
    expect(seqA).toEqual(seqB);
  });

  it('different seeds diverge', () => {
    expect(nextRandom(seed(1))).not.toBe(nextRandom(seed(2)));
  });

  it('returns values in [0, 1) and advances sequence', () => {
    const s = seed(7);
    for (let i = 0; i < 100; i++) {
      const v = nextRandom(s);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(s.sequence).toBe(100);
  });

  it('sequence 缺省（蓝图只给 {seed}）→ 首次取数后为 1 而非 NaN（深审 A1 探针带出）', () => {
    const s = { type: 'RandomSeed', seed: 108 } as never as ReturnType<typeof seed>;
    nextRandom(s);
    expect(s.sequence).toBe(1); // 撤修（sequence += 1）→ NaN，本断言红
  });

  it('randomInt stays within [min, max)', () => {
    const s = seed(123);
    for (let i = 0; i < 200; i++) {
      const n = randomInt(s, 5, 10);
      expect(n).toBeGreaterThanOrEqual(5);
      expect(n).toBeLessThan(10);
    }
  });
});

describe('deriveSeed（B-7）', () => {
  it('同 seed 同 label 同结果；不同 label / 不同 seed 分流；返回 int32；派生流可照常 nextRandom', async () => {
    const { deriveSeed, nextRandom } = await import('./index.js');
    expect(deriveSeed(42, 'ai:p1')).toBe(deriveSeed(42, 'ai:p1'));
    expect(deriveSeed(42, 'ai:p1')).not.toBe(deriveSeed(42, 'ai:p2'));
    expect(deriveSeed(42, 'ai:p1')).not.toBe(deriveSeed(43, 'ai:p1'));
    const s = deriveSeed(7, 'meta');
    expect(Number.isInteger(s) && s >= -2147483648 && s <= 2147483647).toBe(true);
    const a = { type: 'RandomSeed', seed: s, sequence: 0 } as { type: 'RandomSeed'; seed: number; sequence: number };
    const b = { type: 'RandomSeed', seed: s, sequence: 0 } as { type: 'RandomSeed'; seed: number; sequence: number };
    expect([nextRandom(a), nextRandom(a)]).toEqual([nextRandom(b), nextRandom(b)]);
  });
});
