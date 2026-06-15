// Game F · 经济 v1 — 局外账号层（软币「战功」）。承 game-f-economy-spec-v1.md 〇/一/九（owner 2026-06-15 锁定）。
// ⛔ 铁律：服务/账号层与确定性 ECS **单向解耦**——本模块只消费引擎回吐的「攻岛结算」，绝不进 sim、不被 world.hash 触及。
// v1 仅一种局外软币 warfunds（战功）：攻岛按贡献+胜负+波深产出 → 持久化（localStorage；测试注入内存 KV）。
// 收藏/抽卡已接（earn→spend 闭合）；附魔/天梯随后切片；市场/充值押后 phase3。
import { ROSTER, WU_ROSTER } from './heroes.js';

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

// 扣软币（抽卡/附魔出口）：余额够才扣，返回是否成功。addWarfunds 只进不出，spend 专管出。
export function spendWarfunds(amount: number, kv: KV = defaultKV()): boolean {
  const bal = getWarfunds(kv);
  if (amount <= 0 || bal < amount) return false;
  kv.setItem(KEY, String(bal - Math.round(amount)));
  return true;
}

// ── 收藏 + 软币抽卡（spec §二/§五；闭合 earn→spend；account 层、与 ECS 解耦）──
// 卡池=三国全武将（id→收藏 count）。weight=出率（均权占位；rarity 真表由 designer 定，本模块只管机制）。
export interface GachaEntry { id: string; name: string; weight: number }
export const GACHA_COST = 100; // 单抽战功价（占位，待 designer 平衡）
// 卡池：蜀6+魏6（ROSTER）+ 吴6（WU_ROSTER），按 id 去重，均权。
export const GACHA_POOL: GachaEntry[] = (() => {
  const seen = new Set<string>();
  const out: GachaEntry[] = [];
  for (const h of [...ROSTER, ...WU_ROSTER]) {
    if (seen.has(h.id)) continue;
    seen.add(h.id);
    out.push({ id: h.id, name: h.name, weight: 1 });
  }
  return out;
})();

const COLL_KEY = 'gamef.account.collection';
export function getCollection(kv: KV = defaultKV()): Record<string, number> {
  try {
    const o = JSON.parse(kv.getItem(COLL_KEY) ?? '{}') as Record<string, number>;
    return o && typeof o === 'object' ? o : {};
  } catch { return {}; }
}
function addCard(id: string, kv: KV): void {
  const c = getCollection(kv);
  c[id] = (c[id] ?? 0) + 1;
  kv.setItem(COLL_KEY, JSON.stringify(c));
}

// 概率公示（spec §二「概率公示」铁律）：每张牌的出率（weight / 总权）。
export function gachaRates(pool: GachaEntry[] = GACHA_POOL): { id: string; name: string; rate: number }[] {
  const total = pool.reduce((s, e) => s + e.weight, 0) || 1;
  return pool.map((e) => ({ id: e.id, name: e.name, rate: e.weight / total }));
}

// 单抽：扣战功 → 加权随机出一张入收藏 → 返回。rng 注入（测试可定种；账号层非 sim，用 Math.random 不破确定性）。
export function gachaPull(kv: KV = defaultKV(), rng: () => number = Math.random, pool: GachaEntry[] = GACHA_POOL): { ok: boolean; card?: GachaEntry; balance: number } {
  if (!spendWarfunds(GACHA_COST, kv)) return { ok: false, balance: getWarfunds(kv) };
  const total = pool.reduce((s, e) => s + e.weight, 0);
  let r = rng() * total;
  let card = pool[pool.length - 1];
  for (const e of pool) { if (r < e.weight) { card = e; break; } r -= e.weight; }
  addCard(card.id, kv);
  return { ok: true, card, balance: getWarfunds(kv) };
}
