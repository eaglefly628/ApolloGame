// clash-resolve.ts —— doc 19 §三「对决解算核」（统一战斗 · 谁赢谁输的单一真相）。
// 取代 18/01 的 per-card `decideFaceUp`，收编为 pairwise 形式：两张牌一碰 → P_eff 聚合 → logistic 胜率(留爆冷缝)
// → 种子骰 → 谁正(活·前进) 谁反(亡)。**纯确定性函数、种子化、可回放、可直接当平衡回归测**（仿真台 §十）。
//
// 公平骨架（doc 19 §四，owner 拍板）：base = 点数（双方同副标准 54、军衔=点数 → 公平）；强弱全来自**经营** buff
//   （天罡/附魔/相邻协同/士气/路 buff/主动干涉，各自 bounded ±Δ 进 P_eff）。退役"强化全军 favor 泵点数"。
// game-side 薄解算核：就地读扁平 buff 数、只复用 `{op,target,value}` 心智，**不建统一 Buff 引擎**（守 Lead 窄边界）。
// 复用引擎 PRNG `nextRandom`（同 decideFaceUp → lockstep 安全、镜像同步/回放不裂）。零新引擎能力。
import type { RandomSeed } from '@zerocraft/engine/engine/protocol/components.js';
import { nextRandom } from '@zerocraft/engine/atom-skills/index.js';

// ── 三个平衡旋钮（doc 19 §三.4；初值，仿真台 §十 扫 + 入 14）──
export const CLASH_K = 5;            // 点数差软硬度：小=点数为王 / 大=buff 为王
export const P_MIN = 1, P_MAX = 30;  // P_eff 夹界（防膨胀）·下限 1（owner/GD 2026-07-04·对折+溃散可把战力压到 0 → 掷骰区间退化非法 [1~0]；钳 ≥1 保区间合法·至少能掷 [1~1]）
export const WR_MIN = 0.03, WR_MAX = 0.97; // 爆冷缝：胜率永不 0/100% → 留博弈悬念、防死局

const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x);
export const logistic = (x: number): number => 1 / (1 + Math.exp(-x));

// 牌点数（公平骨架 · 军衔=点数，doc 06）：王/JOKER=15、A=14、K=13、Q=12、J=11、10..2=10..2。双方同副 → 公平。
export function cardPoints(rank: string): number {
  if (rank === 'JOKER' || rank === '★' || rank === '王') return 15;
  const face: Record<string, number> = { A: 14, K: 13, Q: 12, J: 11 };
  if (rank in face) return face[rank];
  const n = parseInt(rank, 10);
  return Number.isFinite(n) ? Math.max(2, Math.min(15, n)) : 2;
}

// 有效战力：基础点数 + Σbuff（各源已自带 ±Δ bounded）→ [×mul·擎天最强单张] → [×(1000−fatiguePm)/1000·疲劳] → floor → 夹 [P_min,P_max]。
// apply 顺序铁律（doc20 §二「实装细则」）：add → mul → floor → clamp。mul 缺省 1 + fatiguePm 缺省 0 → 与旧行为逐字一致（不引入 floor·不动既有非整 buff）。
// fatiguePm=疲劳千分比（战力损失量·owner 2026-07-06 连续疲劳条替离散 0.5^wins）：有效战力 ×(1000−fatiguePm)/1000。**整数运算保确定性**（回放/lockstep·无浮点漂移）。
export function pEff(base: number, buffSum: number, mul = 1, fatiguePm = 0): number {
  const raw = mul === 1 ? base + buffSum : Math.floor((base + buffSum) * mul);
  const fat = fatiguePm > 0 ? Math.floor((raw * (1000 - fatiguePm)) / 1000) : raw; // 整数千分比·再取整
  return clamp(fat, P_MIN, P_MAX);
}

// A 对 B 的胜率：clamp( logistic((Pa−Pb)/k), 爆冷缝 )。点数差大 → 趋碾压但永不 0/100%。
// ⚠ 已退役（owner 2026-07-01「各自掷战力骰」）：对决改为各自掷 [1,战力] 比大小 → rollWinProb。留存供参考/回归。
export function winrate(pa: number, pb: number, k: number = CLASH_K): number {
  return clamp(logistic((pa - pb) / k), WR_MIN, WR_MAX);
}

// 对决解算：种子骰 < winrate(A) → A 胜(true)，否则 B 胜(false)。消费 rng 一次（确定性、可回放）。
export function clashResolve(pa: number, pb: number, rng: RandomSeed): boolean {
  return nextRandom(rng) < winrate(pa, pb);
}

// ── 各自掷战力骰（owner 2026-07-01·爽感核）：双方各在 [1, 自己战力] 内掷一个整数，比大小、大者胜。 ──
// 战力越高 → 掷出高值的期望/地板越高，但弱者仍有翻盘缝（真悬念）。掷不出 0（owner「1~17·1~9」）→ 下界恒 1。
// 单掷：`[1, max(1,power)]`（种子化·消费 rng 一次·lockstep 安全）。
export function rollDie(power: number, rng: RandomSeed): number {
  const P = Math.max(1, Math.round(power));
  return 1 + Math.floor(nextRandom(rng) * P);
}
// 两独立均匀掷的胜负概率（离散精确·供 UI「掷命预报」显真实胜率·非 100/0）：
//   a~U{1..A}, b~U{1..B} → pGreater=P(a>b)、pEqual=P(a==b)。A/B≤P_MAX 小 → 直接枚举求和（确定·可回放）。
export function rollWinProb(A: number, B: number): { pGreater: number; pEqual: number } {
  const a = Math.max(1, Math.round(A)), b = Math.max(1, Math.round(B));
  let g = 0; for (let x = 1; x <= a; x++) g += Math.min(x - 1, b); // 对每个 a=x：b∈[1,min(x-1,b)] 时 a 赢
  const e = Math.min(a, b); // a==b 的组合数（每个公共值一对）
  return { pGreater: g / (a * b), pEqual: e / (a * b) };
}

// ── 改掷层（REQ-G-天罡原生重构 §四.2·掷骰系天罡）：临掷修饰持方的战力骰。确定性·消费 rng 次数固定于 mods → lockstep 安全。 ──
//   bonus=改掷+N（掷后加·鬼手）· floor=掷下界抬 N（掷 [1+N,P] 而非 [1,P]·磐石·收窄下风）· twice=多掷 N 次取最高（灌铅骰=1·偏高端）。
//   占优必胜（铁骰 autoWinGE·前锋战力≥敌→免掷直接胜）不在此层：由 resolveClash 短路（不掷·省 rng）。
export interface RollMods { bonus: number; floor: number; twice: number }
export const NO_ROLL_MODS: RollMods = { bonus: 0, floor: 0, twice: 0 };

// 改掷实掷（消费 rng：1+twice 次·顺序固定→lockstep 安全）：掷 [lo,P] 的 (1+twice) 次取最高 + bonus。
export function rollWithMods(power: number, rng: RandomSeed, m: RollMods): number {
  const P = Math.max(1, Math.round(power));
  const lo = Math.min(P, 1 + Math.max(0, m.floor)); // 下界抬升（不越过 P·退化则恒 P）
  const n = P - lo + 1;
  const draws = 1 + Math.max(0, m.twice);
  let best = 0;
  for (let i = 0; i < draws; i++) { const r = lo + Math.floor(nextRandom(rng) * n); if (r > best) best = r; } // 取最高
  return best + Math.max(0, m.bonus);
}

// 改掷后掷值的精确概率分布（key=掷值·value=概率）：[lo,P] 上 (1+twice) 次取最高 → 平移 bonus。供预报/AI EV 精算。
export function rollDist(power: number, m: RollMods): Map<number, number> {
  const P = Math.max(1, Math.round(power));
  const lo = Math.min(P, 1 + Math.max(0, m.floor));
  const n = P - lo + 1;
  const draws = 1 + Math.max(0, m.twice);
  const bonus = Math.max(0, m.bonus);
  const dist = new Map<number, number>();
  for (let v = lo; v <= P; v++) {
    const k = v - lo + 1;
    const p = (Math.pow(k, draws) - Math.pow(k - 1, draws)) / Math.pow(n, draws); // P(max of `draws` uniforms on [lo,P] = v)
    dist.set(v + bonus, (dist.get(v + bonus) ?? 0) + p);
  }
  return dist;
}

// 两方改掷分布 → P(a>b)/P(a==b)（离散精确·供预报/EV·非 100/0）。mods 全零时逐字等于 rollWinProb。
export function rollWinProbMods(A: number, B: number, mA: RollMods, mB: RollMods): { pGreater: number; pEqual: number } {
  const dA = rollDist(A, mA), dB = rollDist(B, mB);
  let g = 0, e = 0;
  for (const [av, pa] of dA) for (const [bv, pb] of dB) { if (av > bv) g += pa * pb; else if (av === bv) e += pa * pb; }
  return { pGreater: g, pEqual: e };
}
