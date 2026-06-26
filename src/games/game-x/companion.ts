// ════════════════════════════════════════════════════════════════════════
//  Game X《残响》—— 时间感知派生层（GDD §四 最重要的底层系统）
//
//  形态：纯函数解释器。读「角色日程表（数据）+ 一次时钟读数（注入）+ 会话记录」→
//        派生出 Desk Mode 当前一帧该呈现什么（活动/场景/状态台词/缺席痕迹/情感温度/见面第一句）。
//
//  关键设计（确定性 & 可测）：实时时钟不在这里读，而是**作为入参注入**（ClockReading）。
//    于是这层是纯函数：同样的输入永远得同样的输出 → headless 单测无需 mock 时间。
//    真正读 `new Date()` 的只有宿主 game-x.ts 的时钟服务（与天气 API 同侧：外部世界状态、outcome-first）。
//
//  这套「时刻 → 日程项」的查表选择是个通用「时钟驱动日程 FSM」，将来值得下沉成引擎 capability；
//  现作为框架基础先放游戏侧的派生层（数据是角色日程，代码是这台固定查表器）。
// ════════════════════════════════════════════════════════════════════════

import type { Companion, ScheduleEntry, AbsenceReaction } from './characters.js';

export type Weather = 'sunny' | 'cloudy' | 'rainy' | 'snowy';

// 注入式时钟读数（宿主从设备实时时钟算好后传入）。
export interface ClockReading {
  hour: number; // 0..23
  minute: number; // 0..59
  second?: number; // 0..59（VT323 秒位·可选）
  month?: number; // 1..12
  date?: number; // 1..31
  weekday: number; // 0=周日 .. 6=周六
  nowMs: number; // 绝对毫秒（算缺席/纪念日用）
}

// 跨会话持久的关系记录（宿主用 localStorage 存：缺席感知 + 纪念日 + 情感温度都靠它）。
export interface SessionRecord {
  lastSeenMs: number; // 上次拿起的时刻
  firstMetMs: number; // 第一次互动的时刻（纪念日）
  emotionTemp: number; // 情感温度 0..1（冷→暖），随互动升、随缺席降
  interactions: number; // 累计互动次数（关系阶段派生）
}

// 关系阶段（GDD §八：不是数值条，是行为变化）。
export type RelationStage = 'acquaint' | 'familiar' | 'deep';

// Desk Mode 一帧的呈现模型（全部派生自数据 + 时钟，UI 只读它铺 LayoutNode）。
export interface DeskView {
  entry: ScheduleEntry; // 当前日程项
  weather: Weather;
  /** 场景视觉 id（场景基调 × 天气，对应 GDD「12 场景 × 4 天气」组合的一格）。 */
  sceneId: string;
  sceneLabel: string; // 人读场景名（左下/调试用）
  statusText: string; // 右下「她在做什么」
  absenceNote: string | null; // 缺席痕迹（无则 null）
  emotionTemp: number; // 0..1 冷→暖（底部细线）
  stage: RelationStage;
  hoursAway: number; // 距上次拿起的小时数
  isAnniversary: boolean; // 今天是否纪念日（满整年）
}

// 拿起设备时的情境（决定第一句话）。
export interface GreetContext {
  firstLine: string;
  asleep: boolean;
}

// ── 时刻 → 当前日程项（支持跨夜段 from>to，如 23→7）────────────────────────
export function entryAt(c: Companion, hour: number): ScheduleEntry {
  for (const e of c.schedule) {
    const overnight = e.from > e.to; // 跨午夜
    const hit = overnight ? hour >= e.from || hour < e.to : hour >= e.from && hour < e.to;
    if (hit) return e;
  }
  // 兜底：返回第一段（日程理应覆盖全天，这里 fail-safe）。
  return c.schedule[0];
}

// ── 场景基调 × 天气 → 具体场景 id ───────────────────────────────────────
export function sceneOf(entry: ScheduleEntry, weather: Weather): { id: string; label: string } {
  const base = entry.scene;
  const id = `${base}_${weather}`;
  const baseLabel: Record<string, string> = {
    dawn: '清晨书桌', day: '上午', afternoon: '午后', evening: '黄昏', night: '深夜台灯',
  };
  const wxLabel: Record<Weather, string> = { sunny: '晴', cloudy: '阴', rainy: '雨', snowy: '雪' };
  return { id, label: `${baseLabel[base] ?? base}·${wxLabel[weather]}` };
}

// ── 缺席：距上次拿起多少小时 + 匹配的痕迹 ──────────────────────────────
export function hoursAway(now: number, lastSeenMs: number): number {
  if (!lastSeenMs) return 0;
  return Math.max(0, (now - lastSeenMs) / 3_600_000);
}
export function absenceFor(c: Companion, away: number): AbsenceReaction | null {
  // absence 已按 hours 由大到小排列：匹配第一个达到阈值的。
  for (const a of c.absence) if (away >= a.hours) return a;
  return null;
}

// ── 关系阶段（GDD §八，按累计互动 + 时长粗分）────────────────────────────
export function stageOf(rec: SessionRecord, now: number): RelationStage {
  const days = rec.firstMetMs ? (now - rec.firstMetMs) / 86_400_000 : 0;
  if (days >= 180 && rec.interactions >= 60) return 'deep'; // 深处期 6 个月+
  if (days >= 30 || rec.interactions >= 14) return 'familiar'; // 熟悉期 1 个月+
  return 'acquaint'; // 初识期
}

// ── 情感温度：存的值随缺席衰减后用于显示（暖意会因长时间不见慢慢退去）──────────
export function displayTemp(rec: SessionRecord, away: number): number {
  // 每超过 24h 退 0.06，夹在 [0,1]。互动时由宿主回写 emotionTemp 升温。
  const decay = Math.max(0, away - 24) / 24 * 0.06;
  return clamp01(rec.emotionTemp - decay);
}

// ── 纪念日：满整年（首次互动日的"这一天"）──────────────────────────────
export function isAnniversary(firstMetMs: number, clock: ClockReading): boolean {
  if (!firstMetMs) return false;
  const first = new Date(firstMetMs);
  const today = new Date(clock.nowMs);
  const years = today.getFullYear() - first.getFullYear();
  return years >= 1 && first.getMonth() === today.getMonth() && first.getDate() === today.getDate();
}

// ── 汇总：派生 Desk Mode 一帧 ─────────────────────────────────────────
export function deskView(c: Companion, clock: ClockReading, weather: Weather, rec: SessionRecord): DeskView {
  const entry = entryAt(c, clock.hour);
  const scene = sceneOf(entry, weather);
  const away = hoursAway(clock.nowMs, rec.lastSeenMs);
  const absence = absenceFor(c, away);
  return {
    entry,
    weather,
    sceneId: scene.id,
    sceneLabel: scene.label,
    statusText: entry.status,
    absenceNote: absence?.deskNote ?? null,
    emotionTemp: displayTemp(rec, away),
    stage: stageOf(rec, clock.nowMs),
    hoursAway: away,
    isAnniversary: isAnniversary(rec.firstMetMs, clock),
  };
}

// ── 拿起设备：按情境选第一句话（缺席优先 → 时段）──────────────────────────
export function greetOf(c: Companion, clock: ClockReading, rec: SessionRecord): GreetContext {
  const away = hoursAway(clock.nowMs, rec.lastSeenMs);
  const entry = entryAt(c, clock.hour);
  const asleep = entry.pose === 'sleep';
  let firstLine: string;
  if (rec.lastSeenMs && away >= 168) firstLine = c.firstLine.backLong; // >7 天
  else if (rec.lastSeenMs && away >= 24) firstLine = c.firstLine.back; // 24–72h
  else if (asleep) firstLine = c.firstLine.asleep;
  else if (clock.hour >= 23 || clock.hour < 6) firstLine = c.firstLine.night;
  else firstLine = c.firstLine.day;
  return { firstLine, asleep };
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
