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

  it('硬红线一票否决：total≥阈值但 Numeric=0 → 仍不通过（不被其他轴高分平均掉）', () => {
    // 在通过体检的 fixture 上加一个 Resource.current=NaN 的实体（Transform 有限，不伤 Visual/Structure）：
    // total 仍 ≥ 阈值，但 Numeric 挂 0 —— 修复前 passed 会假绿，修复后被一票否决。
    const withNanResource = (): WorldBlueprint => {
      const bp = buildFixtureBlueprint();
      (bp.entities as Record<string, unknown>)['__veto_probe'] = {
        Transform: { type: 'Transform', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        Resource: { type: 'Resource', current: NaN, max: 10 },
      };
      return bp;
    };
    const r = benchBlueprint('veto-probe', withNanResource);
    expect(r.axes.find((x) => x.name === 'Numeric')?.score).toBe(0);
    expect(r.total).toBeGreaterThanOrEqual(BENCH_PASS_THRESHOLD); // 隔离点：总分够高
    expect(r.passed).toBe(false); // 却因硬红线被否决
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
