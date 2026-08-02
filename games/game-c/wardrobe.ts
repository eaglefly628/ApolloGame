import type { EntityBlueprint } from '@zerocraft/engine/assembly/demo.assembly.js';

// ═══════════════════════════════════════════════════════════════
//  game-c ·《六人德州》衣物典当接线（GDD §3.5·capability-plan §2 craft-recipe 行）
//
//  机制=零新代码：每件衣物一条 `t2-craft-recipe` 配方（纯数据），引擎解释——
//    信号 pawn_p<seat>_<item> 在场 && 该件在身（衣物 Resource current=1）
//    → 原子扣衣物(1→0) + 加筹码(+面值)。二次典当同件=costs 不可负担 → 整单不动（引擎原子性，免游戏层判重）。
//  本文件只有：数据表 + id 约定 + 蓝图片段生成（纯转换零逻辑·game-t blueprint 同款明许形态）。
//  筹码 Resource（chipsResourceId）是全局装配件（betting/典当共写一份），由装配层建——此处只引不建。
// ═══════════════════════════════════════════════════════════════

export interface ClothingItem {
  id: string;
  name: string;
  nameEn: string; // 英文名（owner 2026-07-20 中英切换·衣柜显示用）
  value: number; // 典当面值（筹码）
}

/** 衣物表（owner 拍板数值 GDD §11.5-12：总值 2450·数值 M2 万手 sim 后可调——只改此表）。 */
export const CLOTHING_ITEMS: readonly ClothingItem[] = [
  { id: 'earrings', name: '耳环', nameEn: 'Earrings', value: 100 },
  { id: 'gloves', name: '手套', nameEn: 'Gloves', value: 150 },
  { id: 'socks', name: '袜子', nameEn: 'Socks', value: 200 },
  { id: 'top', name: '上衣', nameEn: 'Top', value: 500 },
  { id: 'skirt', name: '裙子', nameEn: 'Skirt', value: 500 },
  { id: 'lingerie', name: '内衣', nameEn: 'Lingerie', value: 1000 },
];

/** 全套典当总值（=续命上限；测试钉死 2450 防手滑改表）。 */
export const WARDROBE_TOTAL = CLOTHING_ITEMS.reduce((s, c) => s + c.value, 0);

// ── id 约定（UI 信号/条件/结算共用的单一真相）─────────────────────────────
export const chipsResourceId = (seat: number): string => `p${seat}_chips`;
export const clothingResourceId = (seat: number, itemId: string): string => `p${seat}_item_${itemId}`;
export const pawnSignal = (seat: number, itemId: string): string => `pawn_p${seat}_${itemId}`;

/** 某席剩余衣物件数（引擎侧读衣物 Resource 求和的口径；UI 徽章/AI 压力线共用）。 */
export const wardrobeItemIds = (seat: number): string[] => CLOTHING_ITEMS.map((c) => clothingResourceId(seat, c.id));

/** 生成一批座位的典当蓝图片段：每席每件 = 衣物 Resource 实体 + CraftRecipe 实体（纯数据，可 JSON 序列化）。
 *  与装配层约定：chipsResourceId(seat) 的 Resource 由牌局装配建（max 须容纳典当收益，建议 Infinity→JSON 化用大数）。 */
export function buildPawnEntities(seats: readonly number[]): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  for (const seat of seats) {
    for (const item of CLOTHING_ITEMS) {
      out[`c:p${seat}:wardrobe:${item.id}`] = {
        Resource: { id: clothingResourceId(seat, item.id), current: 1, min: 0, max: 1 },
      };
      out[`c:p${seat}:pawn:${item.id}`] = {
        CraftRecipe: {
          onSignal: pawnSignal(seat, item.id),
          costs: [{ id: clothingResourceId(seat, item.id), amount: 1 }],
          gains: [{ id: chipsResourceId(seat), amount: item.value }],
        },
      };
    }
  }
  return out;
}
