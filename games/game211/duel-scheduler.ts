// game211 · 小队遭遇调度器（owner 2026-08-07「写个算法让他们不要互相同时开始」）。
//
// 场景：红蓝各 5 个小队（每队 36 人）在大地图上以群组自由运动；两队靠得够近就打一场
// **36:36 抛牌对决**；打完互相免疫、继续运动。
//
// 为什么需要调度：对决那一刻每张牌是**真刚体**——36:36 = 72 个刚体。实测（scripts/cannon-army-bench.mjs
// 稳态肉搏·纯 world.step）72 体 ≈ 2.9~3.3ms、100 体 ≈ 4.8ms、150 体 ≈ 7.7ms。若放任多对同时开打：
// 3 对 = 216 体 ≈ 15ms+，物理单项就吃光整帧。**故必须限并发 + 错峰**。
// 行军中的 360 个单位不是刚体（sim 侧 Transform + 群组转向 + 实例化渲染），不占这个预算。
//
// 本模块是**纯函数**：不碰世界、不碰物理、不用壁钟、不用 Math.random —— 只做「这一 tick 该开哪几对」的判断，
// 因此可以完全单测。真正的生成/物理由消费方按返回结果去做。
//
// 确定性：所有排序都有全序 tie-break（先距离、后 pairKey 字典序），同输入必得同输出 → 可回放、可对拍。

/** 一对候选遭遇：两个小队 id + 当前距离。 */
export interface Encounter { a: string; b: string; dist: number }

/** 调度输入。 */
export interface SchedulerState {
  /** 本 tick 距离已进入交战阈值的候选对。 */
  candidates: readonly Encounter[];
  /** 正在打的对（pairKey 集合）——其成员小队本 tick 不可再接新战。 */
  active: ReadonlySet<string>;
  /** 已互免的对（pairKey 集合）——打过一次就不再打。 */
  immune: ReadonlySet<string>;
  /** 上一次有对决**开始**的 tick（用于错峰）；从未开始过传 -Infinity。 */
  lastStartTick: number;
  /** 当前 tick。 */
  tick: number;
}

/** 调度参数。 */
export interface SchedulerConfig {
  /** 同时最多几对在打。72 体/对 → 建议 ≤2（144 体·实测仍在帧预算内）。 */
  maxConcurrent: number;
  /** 两次「开战」之间至少隔几 tick —— 这就是 owner 要的「不要互相同时开始」。 */
  startGapTicks: number;
  /** 每 tick 最多开几对（即使并发额度还够，也不允许同一 tick 齐开）。 */
  maxStartsPerTick: number;
}

export const DEFAULT_SCHEDULER: SchedulerConfig = { maxConcurrent: 2, startGapTicks: 45, maxStartsPerTick: 1 };

/** 无序对的稳定键（与传入顺序无关）——immune/active 都用它索引。 */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** 从 pairKey 还原两个小队 id。 */
export function pairMembers(key: string): [string, string] {
  const i = key.indexOf('|');
  return [key.slice(0, i), key.slice(i + 1)];
}

/** 某小队此刻是否已被占用（正在别的对决里）。 */
function busySquads(active: ReadonlySet<string>): Set<string> {
  const s = new Set<string>();
  for (const k of active) { const [x, y] = pairMembers(k); s.add(x); s.add(y); }
  return s;
}

/**
 * 决定本 tick 开哪几对（**纯函数**）。规则按序：
 *  ① 错峰闸：距上次开战不足 `startGapTicks` → 本 tick 一对都不开（这条直接实现「不要互相同时开始」）；
 *  ② 并发闸：`active.size` 已达 `maxConcurrent` → 不开；
 *  ③ 逐个候选按「距离近优先，同距按 pairKey 字典序」检查：
 *     已免疫 / 已在打 / 任一方正忙 → 跳过；否则开战，并把两方标记为忙（同一 tick 内不得再被选中）；
 *  ④ 每 tick 开战数不超过 `maxStartsPerTick`，且总并发不超过 `maxConcurrent`。
 * 返回要开战的 pairKey 列表（已去重、确定序）。
 */
export function planDuelStarts(state: SchedulerState, cfg: SchedulerConfig = DEFAULT_SCHEDULER): string[] {
  if (state.tick - state.lastStartTick < cfg.startGapTicks) return []; // ① 错峰
  let slots = Math.min(cfg.maxConcurrent - state.active.size, cfg.maxStartsPerTick); // ②④
  if (slots <= 0) return [];
  const busy = busySquads(state.active);
  const sorted = [...state.candidates].sort((p, q) => {
    if (p.dist !== q.dist) return p.dist - q.dist;                 // 近的先打
    return pairKey(p.a, p.b) < pairKey(q.a, q.b) ? -1 : 1;         // 全序 tie-break → 确定性
  });
  const out: string[] = [];
  for (const e of sorted) {
    if (slots <= 0) break;
    if (e.a === e.b) continue;                                     // 自己不打自己
    const k = pairKey(e.a, e.b);
    if (state.immune.has(k) || state.active.has(k)) continue;      // 打过 / 正在打
    if (busy.has(e.a) || busy.has(e.b)) continue;                  // 任一方另有战事（含本 tick 刚安排的）
    out.push(k);
    busy.add(e.a); busy.add(e.b);
    slots -= 1;
  }
  return out;
}

/** 本 tick 处于对决中的刚体数（= 对数 × 2 × 每队人数）——给消费方做预算护栏用。 */
export function activeBodyCount(activeCount: number, squadSize: number): number {
  return activeCount * 2 * squadSize;
}

/** 给定每队人数与刚体预算，算出安全的最大并发对数（向下取整·至少 1）。
 *  实测口径：cannon 稳态肉搏 72 体 ≈3ms / 100 体 ≈4.8ms / 150 体 ≈7.7ms → 预算取 150 体较稳。 */
export function safeMaxConcurrent(squadSize: number, bodyBudget = 150): number {
  return Math.max(1, Math.floor(bodyBudget / (2 * Math.max(1, squadSize))));
}
