// 精锐/替身/血量层 · 纯函数测试 + **数值旋钮的胜率标定**。
//
// 这份测试有两个身份：
//  ① 回归护栏（配额/扣血/胜负/确定性）
//  ② **数值设计表**——把每个旋钮的实际胜率曲线跑出来打在 console 上，
//     回答 owner「只给单卡上血量 buff 太单调了」：证明这一层能撑起**多个互不重合**的维度。
import { describe, it, expect } from 'vitest';
import {
  makeElites, aliveElites, totalHp, winnerOfRoster, spawnProxies, applyProxyLosses, resolveProxyDuel,
  type Elite,
} from './elite-roster.js';
import { __setMetaSeed, metaRandom } from './meta-random.js';

/** 跑一整场「精锐战」：双方每轮各派替身对决，直到一方总血量归零。 */
function battle(red: Elite[], blue: Elite[], perElite = 2, maxRounds = 4000): 'red' | 'blue' | 'draw' {
  let elites = [...red, ...blue];
  const flip = (): boolean => metaRandom() < 0.5;    // 物理层：恒公平 50/50
  const roll = (): number => metaRandom();           // 数值层：韧性/锐气
  for (let r = 0; r < maxRounds; r++) {
    const w = winnerOfRoster(elites);
    if (w !== null) return w;
    const ap = spawnProxies(elites.filter((e) => e.side === 'red'), perElite, r);
    const bp = spawnProxies(elites.filter((e) => e.side === 'blue'), perElite, r);
    if (!ap.length || !bp.length) return winnerOfRoster(elites) ?? 'draw';
    const { aDead, bDead } = resolveProxyDuel(ap, bp, flip);
    elites = applyProxyLosses(elites, [...aDead, ...bDead], roll);
  }
  throw new Error('战役打不完');
}

/** 胜率标定：跑 N 场，返回 red 的胜率（平局各算半场）。 */
function winRate(mkRed: () => Elite[], mkBlue: () => Elite[], n = 1500): number {
  let s = 0;
  for (let i = 0; i < n; i++) {
    __setMetaSeed(90001 + i * 131);
    const w = battle(mkRed(), mkBlue());
    s += w === 'red' ? 1 : w === 'draw' ? 0.5 : 0;
  }
  return s / n;
}
const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;

describe('替身/血量 · 基本语义', () => {
  it('替身派出数受血量钳制（血 1 只能同时派 1 个·否则血量旋钮会漏）', () => {
    const es = [{ id: 'r0', side: 'red' as const, hp: 1, maxHp: 5 }];
    expect(spawnProxies(es, 3, 0)).toHaveLength(1);
  });
  it('替身阵亡 → 主人扣血；血量下限 0', () => {
    const es = makeElites('red', [2]);
    const p = spawnProxies(es, 2, 0);
    const after = applyProxyLosses(es, p);         // 两个替身全死
    expect(after[0]!.hp).toBe(0);
    expect(applyProxyLosses(after, p)[0]!.hp).toBe(0); // 不会扣成负数
  });
  it('物理层与数值无关：flip 不看血量/韧性（这就是「不作弊」的落点）', () => {
    // 血量悬殊（9 vs 3）但都派得出 2 个替身 → 配对数相等，物理不因血厚而偏袒。
    const a = spawnProxies([{ id: 'r0', side: 'red', hp: 9, maxHp: 9, toughness: 0.9 }], 2, 0);
    const b = spawnProxies(makeElites('blue', [3]), 2, 0);
    expect(a).toHaveLength(2);
    expect(b).toHaveLength(2);
    const r = resolveProxyDuel(a, b, () => false);   // 全反面 → 双方替身全灭
    expect(r.aDead).toHaveLength(2);
    expect(r.bDead).toHaveLength(2);
  });
  it('一方总血归零 → 另一方胜；同时归零 → 平', () => {
    expect(winnerOfRoster([...makeElites('red', [1]), ...makeElites('blue', [0])])).toBe('red');
    expect(winnerOfRoster([...makeElites('red', [0]), ...makeElites('blue', [0])])).toBe('draw');
    expect(winnerOfRoster([...makeElites('red', [1]), ...makeElites('blue', [1])])).toBeNull();
  });
  it('确定性：同种子同输入 → 同结果（可回放）', () => {
    const mk = (): Elite[] => makeElites('red', [4, 4]);
    const mb = (): Elite[] => makeElites('blue', [4, 4]);
    __setMetaSeed(555); const a = battle(mk(), mb());
    __setMetaSeed(555); const b = battle(mk(), mb());
    expect(a).toBe(b);
  });
  it('韧性 = 1 → 永不扣血（旋钮上限自洽）', () => {
    const es: Elite[] = [{ id: 'r0', side: 'red', hp: 3, maxHp: 3, toughness: 1 }];
    expect(applyProxyLosses(es, spawnProxies(es, 3, 0), () => 0)[0]!.hp).toBe(3);
  });
  it('锐气命中 → 对面也扣血（改交换比）', () => {
    const red: Elite[] = [{ id: 'r0', side: 'red', hp: 2, maxHp: 2, riposte: 1 }];
    const blue = makeElites('blue', [5]);
    const out = applyProxyLosses([...red, ...blue], spawnProxies(red, 1, 0), () => 0);
    expect(out.find((e) => e.id === 'r0')!.hp).toBe(1);        // 自己扣 1
    expect(out.find((e) => e.side === 'blue')!.hp).toBe(4);    // 对面也扣 1
  });
});

describe('数值旋钮标定（回答「只给血量太单调」）', () => {
  it('① 血量差 → 胜率（基准维度）', () => {
    const base = 6;
    const rows: string[] = [];
    for (const d of [0, 1, 2, 4, 6]) {
      rows.push(`  红 ${base + d} : 蓝 ${base}  →  ${pct(winRate(() => makeElites('red', [base + d]), () => makeElites('blue', [base])))}`);
    }
    console.info('[elite/血量]\n%s', rows.join('\n'));
    // 单调 + 等血持平
    expect(winRate(() => makeElites('red', [6]), () => makeElites('blue', [6]))).toBeGreaterThan(0.42);
    expect(winRate(() => makeElites('red', [6]), () => makeElites('blue', [6]))).toBeLessThan(0.58);
    expect(winRate(() => makeElites('red', [12]), () => makeElites('blue', [6]))).toBeGreaterThan(0.8);
  });

  it('② 韧性 → 胜率（等血量下·独立于血量的第二维）', () => {
    const rows: string[] = [];
    for (const t of [0, 0.15, 0.3, 0.5]) {
      const r = winRate(() => [{ id: 'r0', side: 'red', hp: 6, maxHp: 6, toughness: t }], () => makeElites('blue', [6]));
      rows.push(`  韧性 ${t.toFixed(2)}（双方均 6 血） →  ${pct(r)}`);
    }
    console.info('[elite/韧性]\n%s', rows.join('\n'));
    expect(winRate(() => [{ id: 'r0', side: 'red', hp: 6, maxHp: 6, toughness: 0.5 }], () => makeElites('blue', [6]))).toBeGreaterThan(0.7);
  });

  it('③ 锐气/反伤 → 胜率（改交换比·第三维）', () => {
    const rows: string[] = [];
    for (const rp of [0, 0.15, 0.3, 0.5]) {
      const r = winRate(() => [{ id: 'r0', side: 'red', hp: 6, maxHp: 6, riposte: rp }], () => makeElites('blue', [6]));
      rows.push(`  锐气 ${rp.toFixed(2)}（双方均 6 血） →  ${pct(r)}`);
    }
    console.info('[elite/锐气]\n%s', rows.join('\n'));
    expect(winRate(() => [{ id: 'r0', side: 'red', hp: 6, maxHp: 6, riposte: 0.5 }], () => makeElites('blue', [6]))).toBeGreaterThan(0.6);
  });

  it('④ ⚠ 投放数是**中性**的 —— 钉死这条，别再拿它当强度旋钮', () => {
    const a = winRate(() => makeElites('red', [8]), () => makeElites('blue', [8]));
    const rows = [`  每精锐派 2 个替身 → ${pct(a)}`];
    // 直接对拍：同样 8v8，只改投放数，胜率应当都在 50% 附近
    let s = 0;
    const N = 1200;
    for (let i = 0; i < N; i++) {
      __setMetaSeed(90001 + i * 131);
      const w = battle(makeElites('red', [8]), makeElites('blue', [8]), 6);   // 红蓝都派 6 个
      s += w === 'red' ? 1 : w === 'draw' ? 0.5 : 0;
    }
    rows.push(`  每精锐派 6 个替身 → ${pct(s / N)}`);
    console.info('[elite/投放数·中性]\n%s', rows.join('\n'));
    expect(Math.abs(s / N - 0.5)).toBeLessThan(0.08);
    expect(Math.abs(a - 0.5)).toBeLessThan(0.08);
  });
});
