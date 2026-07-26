// game-103《幸存者》成就层 —— **纯数据表 + 纯判定函数**（数据驱动·最弱 LLM 也能产出这张阈值表）。
// owner 2026-07-26：连杀不接倍率、改「解锁成就」。成就=对一组具名局内统计量的阈值门（stat ≥ gte），
// 命中即首次解锁→弹横幅（host 表现层·非 sim·零确定性/碰撞开销）。解锁集持久化 localStorage（跨局保留=真「解锁」）。

// 局内统计量（host 每帧从 sim 资源 + 连杀窗派生）：峰值连杀 / 累计击杀 / 存活秒 / 等级。
export interface RunStats {
  peakCombo: number; // 本局最高连杀数
  kills: number;     // 累计击杀（sim score）
  elapsed: number;   // 存活秒
  level: number;     // 当前等级
}
export type AchStat = keyof RunStats;

export interface Achievement {
  id: string;
  name: string;   // 横幅主名
  icon: string;   // 前缀 emoji
  stat: AchStat;  // 监视哪个统计量
  gte: number;    // ≥ 此值即解锁
}

// 成就表（改数字/加条=改这张表·零代码）。阈值先给试玩基线（owner「要试了才知道」·连杀尤其待调）。
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'combo10', name: '小试锋芒 · 10 连杀', icon: '🔥', stat: 'peakCombo', gte: 10 },
  { id: 'combo20', name: '杀意奔涌 · 20 连杀', icon: '⚔️', stat: 'peakCombo', gte: 20 },
  { id: 'combo40', name: '血色狂潮 · 40 连杀', icon: '💥', stat: 'peakCombo', gte: 40 },
  { id: 'kills100', name: '百人斩', icon: '💀', stat: 'kills', gte: 100 },
  { id: 'kills500', name: '尸山血海 · 500 击杀', icon: '🩸', stat: 'kills', gte: 500 },
  { id: 'level10', name: '成长之路 · 10 级', icon: '⭐', stat: 'level', gte: 10 },
  { id: 'survive300', name: '幸存者 · 存活 5 分钟', icon: '🏆', stat: 'elapsed', gte: 300 },
];

// 纯判定：给定局内统计 + 已解锁集 → 返回本次新达成（尚未解锁）的成就（按表序·稳定）。不改入参。
export function newlyUnlocked(stats: RunStats, unlocked: ReadonlySet<string>): Achievement[] {
  return ACHIEVEMENTS.filter((a) => !unlocked.has(a.id) && stats[a.stat] >= a.gte);
}

// ── 持久化（localStorage·无则优雅降级为局内内存·不炸）───────────────────────────
const ACH_KEY = 'game103-ach-v1';
export function loadUnlocked(): Set<string> {
  try {
    if (typeof localStorage === 'undefined') return new Set();
    const raw = localStorage.getItem(ACH_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch { return new Set(); }
}
export function saveUnlocked(set: ReadonlySet<string>): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(ACH_KEY, JSON.stringify([...set]));
  } catch { /* 隐私模式/配额满 → 忽略·退化为局内内存 */ }
}
