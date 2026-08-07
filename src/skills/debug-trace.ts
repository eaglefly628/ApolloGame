import type { IWorld } from '@engine/core/types.js';
import type { DebugTrace, TraceEvent } from '@engine/protocol/components.js';

// ═══════════════════════════════════════════════════════════════
//  debug-trace 工具（owner 2026-08-06 立·全库日志基准守则）——「逻辑写到哪，trace 记到哪」的共享接缝。
//
//  **opt-in**：世界里挂了 `DebugTrace` 单例才记，没挂 **全程 no-op**（零开销·零污染），
//  形状照抄已验证过的 `ScoreTrace` 先例（score-trace.ts）。默认不开；出 bug 时挂上它跑一遍，
//  只读 trace 就能重建「为什么是这个结果」。
//
//  ── 密度规格（守则写死·CLAUDE.md「日志基准守则」同源）────────────────────
//  只记四类，每个点**恰好一条**：
//    decision   若干条路里选了哪一条（查表命中 / 条件真假 / 优先级裁决 / 随机抽取结果）
//    transition 状态跳转（FSM/相位/回合）：what 写 "from→to"
//    reject     拒收或降级 —— **凡是「什么都没发生」的分支必须记**（外部完全不可见的那一类）
//    commit     对世界的实际写入摘要（哪个 id、增量多少、落在哪个实体）
//  **不记**：每帧心跳 · 循环内逐次迭代（只记聚合）· 纯读取/中间量 · 已可由上一条推出的事实 · 大对象 dump。
//  强度：每 system 每 tick 正常路径 ≤ 3 条，无事发生 **0 条**；每条一行五字段，值全是标量。
//  验收判据（可证伪）：**开 trace 跑一回合，人只读 trace 就能重建出「为什么是这个结果」**——
//    重建不出 = 密度不够；要跳过大段无关行 = 密度过头。
//
//  ── 三条红线 ──────────────────────────────────────────────────────────
//  ① `DebugTrace` **排除出 hashSnapshot**（determinism.ts 的 NON_DETERMINISTIC）——否则开日志就改 hash、
//     lockstep 当场误报 desync。守卫 `debug-trace.test.ts` 钉死这条。
//  ② **禁墙钟**：`tick` 由调用方传世界当前拍号，绝不 `Date.now()`（回放要对得上）。
//  ③ **关时真 no-op**：`if (!t) return` 在最外层；**禁止先拼好字符串再判断要不要记**
//     （隐藏开销，且格式化本身可能引入副作用）。要拼串就用 `traceOn()` 先问。
// ═══════════════════════════════════════════════════════════════

/** 环形上限缺省值：长跑（几万拍）时防内存无限涨。 */
export const TRACE_DEFAULT_MAX = 2000;

/** 取世界里的 DebugTrace 单例（无 = 未开启 → 调用方据此整段跳过）。 */
export function findDebugTrace(world: IWorld): DebugTrace | undefined {
  for (const [eid] of world.query('DebugTrace')) {
    const t = world.getComponent<DebugTrace>(eid, 'DebugTrace');
    if (t) return t;
  }
  return undefined;
}

/** trace 开着吗（要拼开销大的字符串前先问这句，别白拼）。 */
export function traceOn(world: IWorld): boolean {
  return findDebugTrace(world) !== undefined;
}

/**
 * append 一条。`trace` 为 undefined（未开启）时 **no-op**。
 * `seq` 自动递增；超过 `max` 丢最旧的（环形）。
 */
export function appendTrace(
  trace: DebugTrace | undefined,
  tick: number,
  system: string,
  kind: TraceEvent['kind'],
  what: string,
  why?: string,
): void {
  if (!trace) return;
  const seq = trace.events.length === 0 ? 0 : trace.events[trace.events.length - 1].seq + 1;
  trace.events.push(why === undefined ? { seq, tick, system, kind, what } : { seq, tick, system, kind, what, why });
  const max = trace.max ?? TRACE_DEFAULT_MAX;
  if (trace.events.length > max) trace.events.splice(0, trace.events.length - max);
}

/**
 * 推进拍号（宿主 run loop 每帧调一次·**禁墙钟**）。未开启时 no-op。
 * 不设专职系统来做这件事：相位内先后无法保证，专职系统会让同一拍的记录拿到错位的号；
 * 宿主才真正知道帧号。宿主不调也无妨——全为 0，只是失去按拍分组，`seq` 仍给出全序。
 */
export function bumpTraceTick(world: IWorld): void {
  const t = findDebugTrace(world);
  if (t) t.tick = (t.tick ?? 0) + 1;
}

/** 清空（长跑里手动分段用；系统不该自己清——一次跑完整段才读得出因果）。 */
export function clearDebugTrace(world: IWorld): DebugTrace | undefined {
  const t = findDebugTrace(world);
  if (t) t.events = [];
  return t;
}

/** 人可读的一行（复现问题时贴给人看/写进报告）。 */
export function formatTrace(t: DebugTrace | undefined): string {
  if (!t) return '(trace 未开启)';
  return t.events.map((e) => `#${e.seq} t${e.tick} [${e.system}] ${e.kind}: ${e.what}${e.why ? ` ← ${e.why}` : ''}`).join('\n');
}
