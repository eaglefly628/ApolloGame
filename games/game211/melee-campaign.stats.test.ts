// 大混战战役 · 无头统计验证（在写任何渲染之前回答「这个 demo 成不成立」）。
//
// 为什么这是测试而不是脚本：战役核心是 TS 纯函数，vitest 是唯一能直接吃它的跑法（不必把逻辑
// 抄一份到 .mjs 里——`scripts/game211-throw-lab.mjs` 那种镜像是给物理台不得已用的，逻辑面不该重复真相）。
// 这里既是**回归护栏**（终止性/守恒/对称性），也是**设计验证**（打多少场、多长、会不会一边倒）。
//
// 生死概率取实测值：`scripts/game211-throw-lab.mjs` 8000 张 → 正面率 50.50%，CI [49.40%, 51.60%]，
// 与 0.5 不可区分 → 本模型用 p=0.5 的引擎种子 PRNG，与真物理同分布。
import { describe, it, expect } from 'vitest';
import {
  initialGroups, nextEncounter, resolveDuel, applyDuel, regroup, winnerOf, countBySide,
  TOTAL_CARDS, type Group, type Side,
} from './melee-campaign.js';
import { __setMetaSeed, metaRandom } from './meta-random.js';

/** 跑完整一场战役 → 统计。位置固定（движение 抽象掉）：每轮打「当下最近的一对」。 */
function runCampaign(seed: number, maxDuels = 500): {
  winner: Side | 'draw'; duels: number; cardsLeft: number; maxConcurrentNeeded: number;
} {
  __setMetaSeed(seed);
  const flip = (): boolean => metaRandom() < 0.5;
  let groups: Group[] = initialGroups(40, 12);
  let duels = 0;
  let biggest = 0;
  for (;;) {
    const w = winnerOf(groups);
    if (w !== null) return { winner: w, duels, cardsLeft: countBySide(groups)[w === 'draw' ? 'red' : w], maxConcurrentNeeded: biggest };
    const enc = nextEncounter(groups);
    if (!enc) return { winner: winnerOf(groups) ?? 'draw', duels, cardsLeft: 0, maxConcurrentNeeded: biggest };
    const r = resolveDuel(enc.a.cards, enc.b.cards, flip);
    biggest = Math.max(biggest, r.pairs * 2);          // 该场同时在场的刚体数
    groups = regroup(applyDuel(groups, enc.a.id, enc.b.id, r));
    duels += 1;
    if (duels > maxDuels) throw new Error(`战役打不完：${maxDuels} 场后仍未分胜负`);
  }
}

describe('战役统计 · 这个 demo 成不成立', () => {
  const N = 2000;
  const runs = Array.from({ length: N }, (_, i) => runCampaign(1000 + i * 31));

  it('① 一定打得完（不会无限循环·不会卡在僵局）', () => {
    // runCampaign 打不完会抛；跑到这里就说明 2000 场全部收敛。
    expect(runs).toHaveLength(N);
    for (const r of runs) expect(['red', 'blue', 'draw']).toContain(r.winner);
  });

  it('② 红蓝胜率对称（无系统性偏袒·这是每对存活期望 1.0 的直接后果）', () => {
    const red = runs.filter((r) => r.winner === 'red').length;
    const blue = runs.filter((r) => r.winner === 'blue').length;
    const draw = runs.filter((r) => r.winner === 'draw').length;
    // 双尾正态近似：|red−blue| 不该超过 ~4σ
    const n = red + blue;
    const sigma = Math.sqrt(n) / 2;
    expect(Math.abs(red - blue)).toBeLessThan(4 * sigma);
    console.info('[melee/stats] %d 场：红胜 %d · 蓝胜 %d · 平 %d（同归于尽）', N, red, blue, draw);
  });

  it('③ 场次落在可演示的范围（不是打两场就完、也不是打上百场）', () => {
    const ds = runs.map((r) => r.duels).sort((a, b) => a - b);
    const med = ds[Math.floor(ds.length / 2)]!;
    const p95 = ds[Math.floor(ds.length * 0.95)]!;
    console.info('[melee/stats] 每场战役对决数：中位 %d · p95 %d · 最多 %d', med, p95, ds[ds.length - 1]);
    expect(med).toBeGreaterThan(3);    // 太少 = 没得看
    expect(p95).toBeLessThan(120);     // 太多 = 演示看不到头
  });

  it('④ 单场对决的刚体峰值 ≤ 48（24v24·物理预算的输入）', () => {
    for (const r of runs) expect(r.maxConcurrentNeeded).toBeLessThanOrEqual(48);
    console.info('[melee/stats] 单场对决刚体峰值 ≤ %d（24v24 = 48 体·实测 40 体 1.54ms/步）',
      Math.max(...runs.map((r) => r.maxConcurrentNeeded)));
  });

  it('⑤ 牌只会变少、从不凭空多出来（守恒）', () => {
    __setMetaSeed(4242);
    const flip = (): boolean => metaRandom() < 0.5;
    let groups: Group[] = initialGroups(40, 12);
    let prev = TOTAL_CARDS;
    expect(countBySide(groups).red + countBySide(groups).blue).toBe(TOTAL_CARDS);
    for (let i = 0; i < 40 && winnerOf(groups) === null; i++) {
      const enc = nextEncounter(groups)!;
      groups = regroup(applyDuel(groups, enc.a.id, enc.b.id, resolveDuel(enc.a.cards, enc.b.cards, flip)));
      const now = countBySide(groups).red + countBySide(groups).blue;
      expect(now).toBeLessThanOrEqual(prev);
      prev = now;
    }
  });

  it('⑥ 同种子可复现（可回放·排障时能重放同一场战役）', () => {
    expect(runCampaign(777)).toEqual(runCampaign(777));
  });
});
