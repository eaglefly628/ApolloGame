import { describe, it, expect } from 'vitest';
import {
  computeFrameStats,
  frameTimeDelta,
  measureFrameTime,
  FRAME_BUDGET_MS,
  type FrameTimePrior,
} from './apollo-bench.js';
import { BENCH_GAMES } from './games.js';

// 帧时轴（REQ-QA-测试审计强化三件）——统计/判定/delta 用**合成数组**测，不依赖墙钟（可复现）。
describe('ApolloBench 帧时轴 · p99/max 判定 + delta 回归', () => {
  it('全部帧在预算内 → PASS，无超标帧', () => {
    const times = Array.from({ length: 100 }, () => 0.5); // 全 0.5ms，远低于 16.67ms 预算
    const s = computeFrameStats('t', times);
    expect(s.verdict).toBe('PASS');
    expect(s.spikeFrames).toHaveLength(0);
    expect(s.maxMs).toBeCloseTo(0.5);
    expect(s.meanMs).toBeCloseTo(0.5);
  });

  it('均值绿但单帧尖峰超预算 → CONCERNS，超标帧按帧号点名', () => {
    const times = Array.from({ length: 100 }, () => 1); // 均值 1ms（绿）
    times[42] = 50; // 第 42 帧尖峰 50ms（> 16.67ms 预算）
    const s = computeFrameStats('spikey', times);
    expect(s.verdict).toBe('CONCERNS');
    // 均值仍在预算内（尖峰摊薄后 ~1.5ms），坐实「均值绿、尖峰红」
    expect(s.meanMs).toBeLessThan(FRAME_BUDGET_MS);
    expect(s.spikeFrames).toHaveLength(1);
    expect(s.spikeFrames[0].frame).toBe(42);
    expect(s.spikeFrames[0].ms).toBe(50);
    expect(s.maxMs).toBe(50);
  });

  it('p99 计算：100 帧里 99 帧 1ms + 1 帧 40ms → p99=1（尾部单点不抬 p99），max=40', () => {
    const times = Array.from({ length: 100 }, () => 1);
    times[99] = 40;
    const s = computeFrameStats('p99', times);
    // 最近秩 p99 = 排序后第 ceil(0.99*100)=99 个（1-based）= index 98 = 1ms
    expect(s.p99Ms).toBe(1);
    expect(s.maxMs).toBe(40);
    expect(s.verdict).toBe('CONCERNS'); // max 超预算仍判 CONCERNS
  });

  it('自定义预算：p99 超小预算即 CONCERNS', () => {
    const times = Array.from({ length: 10 }, (_, i) => i + 1); // 1..10ms
    const s = computeFrameStats('b', times, 3); // 预算 3ms
    expect(s.verdict).toBe('CONCERNS');
    expect(s.spikeFrames.map((f) => f.frame)).toEqual([3, 4, 5, 6, 7, 8, 9]); // >3ms 的帧（4..10ms）
  });

  it('空输入不炸 → PASS 全零', () => {
    const s = computeFrameStats('empty', []);
    expect(s.verdict).toBe('PASS');
    expect(s.ticks).toBe(0);
    expect(s.maxMs).toBe(0);
  });

  it('delta 回归：变慢=退化 / 变快=改善 / 容差内=持平', () => {
    const prior: FrameTimePrior = { meanMs: 1, p99Ms: 2, maxMs: 3, ticks: 100, budgetMs: FRAME_BUDGET_MS, ts: 'x' };
    const current = computeFrameStats('d', [
      ...Array.from({ length: 99 }, () => 2), // mean≈2（相对 prior 1ms → +100% 退化）
      2,
    ]);
    const deltas = frameTimeDelta(prior, current);
    const mean = deltas.find((d) => d.metric === 'mean')!;
    expect(mean.direction).toBe('regressed');
    expect(mean.deltaMs).toBeCloseTo(1); // 2 - 1

    // 改善方向
    const prior2: FrameTimePrior = { meanMs: 10, p99Ms: 10, maxMs: 10, ticks: 100, budgetMs: FRAME_BUDGET_MS, ts: 'x' };
    const faster = computeFrameStats('d', Array.from({ length: 100 }, () => 1));
    expect(frameTimeDelta(prior2, faster).every((d) => d.direction === 'improved')).toBe(true);

    // 容差内持平（±5%）
    const prior3: FrameTimePrior = { meanMs: 1, p99Ms: 1, maxMs: 1, ticks: 100, budgetMs: FRAME_BUDGET_MS, ts: 'x' };
    const same = computeFrameStats('d', Array.from({ length: 100 }, () => 1.02)); // +2% < 5% 容差
    expect(frameTimeDelta(prior3, same).every((d) => d.direction === 'stable')).toBe(true);
  });

  it('measureFrameTime 跑真引擎 headless 每 tick 应 << 一帧预算（PASS）', () => {
    const g = BENCH_GAMES[0];
    const s = measureFrameTime(g.id, g.build, { ticks: 60, warmup: 4 });
    expect(s.ticks).toBe(60);
    expect(s.meanMs).toBeLessThan(FRAME_BUDGET_MS); // 数据级 headless 每 tick 微秒级，均值远低于 16.67ms
    expect(['PASS', 'CONCERNS']).toContain(s.verdict); // 墙钟不断言精确值，只断言不炸
  });
});
