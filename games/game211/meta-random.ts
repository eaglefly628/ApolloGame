// game211 · 局外元层随机（owner 2026-08-10 裁「把那个裸的 Math.random 去掉」）。
//
// 为什么存在：CLAUDE.md 硬红线「游戏层禁裸 `Math.random`（用引擎种子 PRNG）」。
// 这里覆盖的 8 处全在**局外元层**（今日卦象 / 抽卡池 / 生肖 / 战斗种子 / UI 延时 / 增益洗牌 / 牌组 id / Boss 抽取）——
// 它们本来就不进 sim、不进 hash、不参与 lockstep，所以「非确定性」不是问题；
// 问题是**裸 `Math.random` 绕开了引擎的随机通路**，于是这些抽取既不可复现、也不可被录放/审计。
// 走 `nextRandom` 之后：同一进程内的抽取序列由下面这颗种子完全决定，出 bug 时把种子打出来就能重放。
//
// ⚠ 种子取 `Date.now()` 是**有意的**：元层要的就是「每次启动不一样」。硬红线卡的是 `Math.random`，
// 墙钟在审计里只是 ⚠ 建议档（不阻断），且 `newDeckId` 本来就在用 `Date.now()`。
// 真需要复现时：`__setMetaSeed(n)` 钉死种子（测试/排障用·生产不调）。
import { nextRandom } from '@zerocraft/engine/atom-skills/index.js';
import type { RandomSeed } from '@zerocraft/engine/engine/protocol/components.js';

// `| 0` 收进 int32；`|| 1` 兜掉 seed=0（xorshift 家族在全零态会退化）。
const state: RandomSeed = { type: 'RandomSeed', seed: ((Date.now() ^ 0x9e3779b9) | 0) || 1, sequence: 0 };

/** 钉死种子（仅测试/排障·让元层抽取可复现）。 */
export function __setMetaSeed(seed: number): void {
  state.seed = (seed | 0) || 1;
  state.sequence = 0;
}

/** 元层随机 [0,1)。语义等价于原先的裸随机调用，但走引擎种子 PRNG。 */
export function metaRandom(): number { return nextRandom(state); }

/** 元层随机整数 [0, maxExclusive)。即原先 `floor(裸随机 * n)` 的替代。 */
export function metaInt(maxExclusive: number): number { return Math.floor(metaRandom() * maxExclusive); }

/** 元层等概率取一个元素（空表返回 undefined）。 */
export function metaPick<T>(xs: readonly T[]): T | undefined {
  return xs.length ? xs[metaInt(xs.length)] : undefined;
}

/** 元层洗牌（Fisher–Yates·返回新数组·不改原表）。 */
export function metaShuffle<T>(xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = metaInt(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
