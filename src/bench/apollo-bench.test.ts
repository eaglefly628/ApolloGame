import { describe, it, expect } from 'vitest';
import { benchBlueprint, BENCH_PASS_THRESHOLD } from './apollo-bench.js';
import { BENCH_GAMES } from './games.js';
import { buildGameABlueprint, LEVEL_SCROLL } from '../games/game-a/index.js';
import type { WorldBlueprint } from '../assembly/demo.assembly.js';

describe('ApolloBench · 执行落地体检', () => {
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

  it('游戏类型感知：game-a/c 空间(有 Transform) / game-b 非空间(VN)，且都通过', () => {
    const byId = (id: string) => BENCH_GAMES.find((g) => g.id === id)!;
    const a = benchBlueprint('game-a', byId('game-a').build);
    const b = benchBlueprint('game-b', byId('game-b').build);
    const c = benchBlueprint('game-c', byId('game-c').build);
    expect(a.spatial).toBe(true);
    expect(b.spatial).toBe(false);
    expect(c.spatial).toBe(true); // v0.3 三消棋盘格子带 Transform → 空间游戏
    expect(b.passed && c.passed).toBe(true);
  });

  it('能识别坏游戏：NaN 炸裂(物理失稳) → Numeric 0 → 不通过', () => {
    const broken = (): WorldBlueprint => {
      const bp = buildGameABlueprint(LEVEL_SCROLL);
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
