// game-103《幸存者》本地排行榜 —— **纯函数 + localStorage**（host 表现层·非 sim·零确定性影响）。
// owner 2026-07-26：死亡/通关后展示排行榜 + 本局成绩。成绩=累计击杀(score) 为主排序键，存活时长/等级为次；
// 榜存 localStorage（跨局保留）。名次高亮本局那一行。

export interface ScoreEntry {
  score: number; // 累计击杀（主排序键）
  time: number;  // 存活秒
  level: number; // 到达等级
  win: boolean;  // 是否通关
  at: number;    // 记录时刻（ms·并列时的稳定次序 + 显示）
}

export const BOARD_MAX = 10;   // 榜最多存 10 条
export const BOARD_SHOW = 8;   // 结算屏最多展示 8 行

// 纯插入：把本局并入旧榜 → 按「击杀↓·存活↓·较新↓」排序 → 截前 BOARD_MAX。返回新榜 + 本局名次（1 基·0=未进榜）。
export function recordScore(entry: ScoreEntry, prev: readonly ScoreEntry[]): { board: ScoreEntry[]; rank: number } {
  const all = [...prev, entry].sort((a, b) => (b.score - a.score) || (b.time - a.time) || (b.at - a.at));
  const board = all.slice(0, BOARD_MAX);
  const idx = board.indexOf(entry);
  return { board, rank: idx >= 0 ? idx + 1 : 0 };
}

// ── 持久化（localStorage·无则降级空榜·不炸）──────────────────────────────────
const KEY = 'game103-leaderboard-v1';
export function loadBoard(): ScoreEntry[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as ScoreEntry[];
    return Array.isArray(arr) ? arr.filter((e) => e && typeof e.score === 'number') : [];
  } catch { return []; }
}
export function saveBoard(board: readonly ScoreEntry[]): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(KEY, JSON.stringify(board.slice(0, BOARD_MAX)));
  } catch { /* 隐私模式/配额满 → 忽略 */ }
}
