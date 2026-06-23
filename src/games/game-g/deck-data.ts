// Game G · 牌组构筑 / 牌池数据（doc14 §九/§十·拆分自 blueprint.ts·纯数据+小helper叶子·只 import 更底层叶子）。

import { HERO_CARDS } from './hero-codex.js'; // isHeroOwned 本地引用（读 HERO_CARDS.own）

// === 牌组构筑：16 选 + 放牌费用 + 自动构筑（doc14 §九/§十 · DEV-CHECKLIST 契约 A/B + 乙3）===
// 出战扑克牌库 = 从 52 收藏池自选 16 张（owner 2026-06-21：13→16·别太少）。结构同收藏：花色♠♥♦♣ × 点 A K Q J 10..2·与 deckGrid/inlays 同序·单一真相。
export const POKER_PICK_SIZE = 16;
const POOL_SUIT_LETTERS = ['S', 'H', 'D', 'C']; // ♠♥♦♣（与大厅 deckGrid 同序）
const POOL_RANK_ORDER = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2']; // favor 索引内点序（与大厅一致）
/** 收藏池 52 卡 id（index 即 favor/inlays 索引：suit*13 + rank）。id = 点+花色字母，如 'AS'/'10D'/'2C'。 */
export const POOL_CARD_IDS: string[] = POOL_SUIT_LETTERS.flatMap((su) => POOL_RANK_ORDER.map((rank) => rank + su));
const POOL_ID_SET = new Set(POOL_CARD_IDS);
export const isPoolCardId = (id: string): boolean => POOL_ID_SET.has(id);
/** 卡 id → favor 索引（0..51·与 save.deck/inlays 同序）；非法 id → -1。 */
export function cardFavorIndex(id: string): number {
  const i = POOL_CARD_IDS.indexOf(id);
  return i;
}
// 放牌费用（契约 B·doc14 §九 4 档·单一真相在此·甲 turn-combat 与乙 UI 都读这里）：点 2-4=0 / 5-7=1 / 8-10=2 / J Q K A=3。
const RANK_POINT: Record<string, number> = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14 };
/** 放牌召唤源泉费用（按点数 4 档）。rank 取牌点（'A'/'2'..'10'/'J'/'Q'/'K'）。 */
export function deployCost(rank: string): number {
  const p = RANK_POINT[rank] ?? 14; // 未知（JOKER/★）按最高档
  return p <= 4 ? 0 : p <= 7 ? 1 : p <= 10 ? 2 : 3;
}
/** 卡 id → 点 rank（'10S'→'10'·'AS'→'A'）。 */
export const rankOfCardId = (id: string): string => id.slice(0, -1);
/** 一键自动构筑（乙3·纯函数·确定性·零随机）：16 张铺开费用曲线(各档 [4,4,4,4]·不全大点) + 偏好已拥有/已养成(favor 高)。
 *  favors=effectiveDeckFavors(52·按 favor 索引)；isOwned(id)=该卡是否已解锁(偏好·非硬门)。同输入恒同输出。 */
export function autoBuildPokerPicks(opts: { favors: number[]; isOwned: (id: string) => boolean; size?: number }): string[] {
  const size = opts.size ?? POKER_PICK_SIZE;
  const cands = POOL_CARD_IDS.map((id, idx) => ({ id, idx, cost: deployCost(rankOfCardId(id)), favor: opts.favors[idx] ?? 50, owned: opts.isOwned(id) }));
  const score = (c: { owned: boolean; favor: number }): number => (c.owned ? 1000 : 0) + c.favor; // 已拥有优先·再比 favor
  const byScore = (a: { idx: number } & { owned: boolean; favor: number }, b: { idx: number } & { owned: boolean; favor: number }): number => score(b) - score(a) || a.idx - b.idx;
  const target = [4, 4, 4, 4]; // 4 档目标张数（铺开曲线·别全大点）→ 16
  const picks: string[] = [];
  for (let t = 0; t < 4; t++) {
    const tier = cands.filter((c) => c.cost === t).sort(byScore);
    for (let i = 0; i < target[t] && i < tier.length; i++) picks.push(tier[i].id);
  }
  if (picks.length < size) { // 某档不足 → 从剩余全局最高分补满
    const have = new Set(picks);
    for (const c of cands.filter((c) => !have.has(c.id)).sort(byScore)) { if (picks.length >= size) break; picks.push(c.id); }
  }
  return picks.slice(0, size);
}
/** 该收藏卡是否已解锁（读 HERO_CARDS.own·自动构筑偏好用·非战斗硬门·懒查 HERO_CARDS）。 */
export const isHeroOwned = (id: string): boolean => (HERO_CARDS.find((h) => h.id === id)?.own ?? 0) > 0;
