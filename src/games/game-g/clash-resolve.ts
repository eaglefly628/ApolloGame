// clash-resolve.ts —— doc 19 §三「对决解算核」（统一战斗 · 谁赢谁输的单一真相）。
// 取代 18/01 的 per-card `decideFaceUp`，收编为 pairwise 形式：两张牌一碰 → P_eff 聚合 → logistic 胜率(留爆冷缝)
// → 种子骰 → 谁正(活·前进) 谁反(亡)。**纯确定性函数、种子化、可回放、可直接当平衡回归测**（仿真台 §十）。
//
// 公平骨架（doc 19 §四，owner 拍板）：base = 点数（双方同副标准 54、军衔=点数 → 公平）；强弱全来自**经营** buff
//   （天罡/附魔/相邻协同/士气/路 buff/主动干涉，各自 bounded ±Δ 进 P_eff）。退役"强化全军 favor 泵点数"。
// game-side 薄解算核：就地读扁平 buff 数、只复用 `{op,target,value}` 心智，**不建统一 Buff 引擎**（守 Lead 窄边界）。
// 复用引擎 PRNG `nextRandom`（同 decideFaceUp → lockstep 安全、镜像同步/回放不裂）。零新引擎能力。
import type { RandomSeed } from '@engine/protocol/components.js';
import { nextRandom } from '@atom-skills/index.js';

// ── 三个平衡旋钮（doc 19 §三.4；初值，仿真台 §十 扫 + 入 14）──
export const CLASH_K = 5;            // 点数差软硬度：小=点数为王 / 大=buff 为王
export const P_MIN = 0, P_MAX = 30;  // P_eff 夹界（防膨胀）
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

// 有效战力：基础点数 + Σbuff（各源已自带 ±Δ bounded）→ [×mul·擎天最强单张] → floor(仅 mul 时·防小数) → 夹 [P_min,P_max]。
// apply 顺序铁律（doc20 §二「实装细则」）：add → mul → floor → clamp。mul 缺省 1 → 与旧行为逐字一致（不引入 floor·不动既有非整 buff）。
export function pEff(base: number, buffSum: number, mul = 1): number { return clamp(mul === 1 ? base + buffSum : Math.floor((base + buffSum) * mul), P_MIN, P_MAX); }

// A 对 B 的胜率：clamp( logistic((Pa−Pb)/k), 爆冷缝 )。点数差大 → 趋碾压但永不 0/100%。
export function winrate(pa: number, pb: number, k: number = CLASH_K): number {
  return clamp(logistic((pa - pb) / k), WR_MIN, WR_MAX);
}

// 对决解算：种子骰 < winrate(A) → A 胜(true)，否则 B 胜(false)。消费 rng 一次（确定性、可回放）。
export function clashResolve(pa: number, pb: number, rng: RandomSeed): boolean {
  return nextRandom(rng) < winrate(pa, pb);
}
