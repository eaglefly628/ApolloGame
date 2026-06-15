// Game F · 经济 v1 — 局外账号层（软币「战功」）。承 game-f-economy-spec-v1.md 〇/一/九（owner 2026-06-15 锁定）。
// ⛔ 铁律：服务/账号层与确定性 ECS **单向解耦**——本模块只消费引擎回吐的「攻岛结算」，绝不进 sim、不被 world.hash 触及。
// v1 仅一种局外软币 warfunds（战功）：攻岛按贡献+胜负+波深产出 → 持久化（localStorage；测试注入内存 KV）。
// 收藏/抽卡/附魔/天梯随后切片接上；市场/充值押后 phase3。

export interface Settlement {
  contribution: number; // 本局累计贡献度（引擎 contribution 资源）
  victory: boolean;     // 是否攻陷岛（单机「名次」退化为胜负）
  wave: number;         // 打到第几波（深度奖；攻得越深越多）
}

// 战功公式（§一：按贡献 + 名次产出）：基础 20 + 贡献×2 + 胜利 +50 + 波深×10。钳非负、取整（软币离散）。
export function warfundsFor(s: Settlement): number {
  return Math.max(0, Math.round(20 + s.contribution * 2 + (s.victory ? 50 : 0) + Math.max(0, s.wave) * 10));
}

// 极小持久化抽象：浏览器用 localStorage，node/测试注入内存 KV（账号层不依赖具体存储）。
export interface KV { getItem(k: string): string | null; setItem(k: string, v: string): void }
export function memoryKV(): KV {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); } };
}
function defaultKV(): KV {
  try {
    const ls = (globalThis as { localStorage?: KV }).localStorage;
    if (ls) return ls;
  } catch { /* SSR/无 DOM：退内存 */ }
  return memoryKV();
}

const KEY = 'gamef.account.warfunds';

export function getWarfunds(kv: KV = defaultKV()): number {
  const n = Number(kv.getItem(KEY) ?? '0');
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function addWarfunds(amount: number, kv: KV = defaultKV()): number {
  const next = getWarfunds(kv) + Math.max(0, Math.round(amount));
  kv.setItem(KEY, String(next));
  return next;
}

// 一局结束结算：算战功 → 累加余额 → 返回（用于大厅飘字 + 余额刷新）。纯账号层，单向消费结算。
export function settleRun(s: Settlement, kv: KV = defaultKV()): { earned: number; balance: number } {
  const earned = warfundsFor(s);
  return { earned, balance: addWarfunds(earned, kv) };
}
