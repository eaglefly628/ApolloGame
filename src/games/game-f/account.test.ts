import { describe, it, expect } from 'vitest';
import { warfundsFor, getWarfunds, addWarfunds, settleRun, memoryKV } from './account.js';

describe('经济 v1 · 账号层战功（warfunds；服务层、与 ECS 解耦）', () => {
  it('战功公式：贡献/胜利/波深单调增，钳非负取整', () => {
    const base = warfundsFor({ contribution: 0, victory: false, wave: 0 });
    expect(base).toBe(20);
    expect(warfundsFor({ contribution: 10, victory: false, wave: 0 })).toBeGreaterThan(base); // 贡献↑
    expect(warfundsFor({ contribution: 0, victory: true, wave: 0 })).toBe(base + 50); // 胜利奖
    expect(warfundsFor({ contribution: 0, victory: false, wave: 5 })).toBe(base + 50); // 波深 ×10
    expect(warfundsFor({ contribution: -999, victory: false, wave: -3 })).toBeGreaterThanOrEqual(0); // 钳非负
    expect(Number.isInteger(warfundsFor({ contribution: 3.7, victory: true, wave: 2 }))).toBe(true); // 取整
  });

  it('持久化：addWarfunds 累加并读回（注入内存 KV）', () => {
    const kv = memoryKV();
    expect(getWarfunds(kv)).toBe(0);
    expect(addWarfunds(100, kv)).toBe(100);
    expect(addWarfunds(50, kv)).toBe(150);
    expect(getWarfunds(kv)).toBe(150);
    expect(addWarfunds(-9, kv)).toBe(150); // 负数不减
  });

  it('settleRun：算战功 + 入账 + 返回余额', () => {
    const kv = memoryKV();
    const r1 = settleRun({ contribution: 20, victory: true, wave: 5 }, kv); // 20+40+50+50=160
    expect(r1.earned).toBe(160);
    expect(r1.balance).toBe(160);
    const r2 = settleRun({ contribution: 0, victory: false, wave: 1 }, kv); // 20+10=30
    expect(r2.earned).toBe(30);
    expect(r2.balance).toBe(190);
  });
});
