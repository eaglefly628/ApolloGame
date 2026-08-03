import { describe, it, expect } from 'vitest';
import { benchBlueprint, BENCH_PASS_THRESHOLD } from './zerocraft-bench.js';
import { BENCH_GAMES } from './games.js';
import { buildFixtureBlueprint } from '../test-fixtures/engine-fixture.js';
import type { WorldBlueprint } from '../assembly/demo.assembly.js';

describe('ZeroCraftBench · 执行落地体检', () => {
  for (const g of BENCH_GAMES) {
    it(`${g.id}: 通过体检(total>=${BENCH_PASS_THRESHOLD})且分数可复现`, () => {
      const r1 = benchBlueprint(g.id, g.build);
      const r2 = benchBlueprint(g.id, g.build);
      expect(r1.axes).toHaveLength(5);
      expect(r1.total).toBeLessThanOrEqual(100);
      expect(r1.passed, `${g.id} 详情 ${JSON.stringify(r1.axes)}`).toBe(true);
      expect(r2.total).toBe(r1.total); // 体检本身确定可复现
    });
  }

  it('游戏类型感知：fixture 空间(有 Transform) 且通过体检', () => {
    const byId = (id: string) => BENCH_GAMES.find((g) => g.id === id)!;
    const a = benchBlueprint('fixture', byId('fixture').build);
    expect(a.spatial).toBe(true);
    expect(a.passed).toBe(true);
  });

  it('能识别坏游戏：NaN 炸裂(物理失稳) → Numeric 0 → 不通过', () => {
    const broken = (): WorldBlueprint => {
      const bp = buildFixtureBlueprint();
      for (const comps of Object.values(bp.entities)) {
        const t = (comps as Record<string, { x?: number } | undefined>).Transform;
        if (t) t.x = NaN;
      }
      return bp;
    };
    const r = benchBlueprint('broken-nan', broken);
    expect(r.axes.find((x) => x.name === 'Numeric')?.score).toBe(0);
    expect(r.passed).toBe(false);
    expect(r.total).toBeLessThan(BENCH_PASS_THRESHOLD);
  });
});
