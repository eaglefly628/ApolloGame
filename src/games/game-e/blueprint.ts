import type { WorldBlueprint, EntityBlueprint } from '../../assembly/demo.assembly.js';
import { resourceCapability } from '@atom-skills/index.js';

// ═══════════════════════════════════════════════════════════════
//  Game E —— Balatro-like 卡牌构建 PoC。**纯数据装配**，零游戏专属代码。
//
//  卡牌数据模型：
//    Tag.flags 编码花色（bits 0-1）+ 点数（bits 2-5）+ 类型标记（bits 8-9）
//    Resource{ id:'selected' } 追踪选中状态
//
//  小丑牌数据：Tag(JOKER_FLAG) + Resource{ id:'mult_bonus'|'chip_bonus', current:效果值 }
//  得分追踪：Resource{ id:'score' } / Resource{ id:'round_chips' } / Resource{ id:'round_mult' }
//
//  手牌评估（Pair/Two Pair/Flush/…）和小丑效果由 UI 层从 world 读数据纯函数计算，
//  不需要专属 system——这是卡牌类游戏「离散事件驱动」与「连续 tick 驱动」的本质差异。
// ═══════════════════════════════════════════════════════════════

// ── 花色编码 ──
export const SUIT_SPADES   = 0;  // ♠
export const SUIT_HEARTS   = 1;  // ♥
export const SUIT_DIAMONDS = 2;  // ♦
export const SUIT_CLUBS    = 3;  // ♣
export const SUIT_MASK     = 0b11;
export const RANK_SHIFT    = 2;
export const RANK_MASK     = 0xF;  // 4 bits, rank 1-13

// ── 实体类型位 ──
export const CARD_FLAG     = 1 << 8;
export const JOKER_FLAG    = 1 << 9;

export function suitOf(flags: number): number { return flags & SUIT_MASK; }
export function rankOf(flags: number): number { return (flags >> RANK_SHIFT) & RANK_MASK; }
export function isCard(flags: number): boolean { return !!(flags & CARD_FLAG); }
export function isJoker(flags: number): boolean { return !!(flags & JOKER_FLAG); }

export const SUIT_SYMBOL = ['♠', '♥', '♦', '♣'] as const;
export const SUIT_COLOR  = ['#94a3b8', '#f87171', '#fb923c', '#4ade80'] as const;
export const RANK_LABEL  = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;

// 基础筹码值（Balatro 原版：A=11, 2-9=2-9, 10/J/Q/K=10）
export const RANK_CHIPS  = [0, 11, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10] as const;

function card(suit: number, rank: number): EntityBlueprint {
  const flags = CARD_FLAG | (suit & SUIT_MASK) | ((rank & RANK_MASK) << RANK_SHIFT);
  return {
    Tag: { flags },
    Resource: { id: 'selected', current: 0, min: 0, max: 1 },
  } as unknown as EntityBlueprint;
}

// 预设演示手牌：可凑出 Flush、Pair、Two Pair 等多种牌型的 8 张。
// 顺序即视觉排列顺序（UI 层按 query 顺序读）。
export function buildGameEBlueprint(): WorldBlueprint {
  return {
    capabilities: [resourceCapability],
    entities: {
      // ── 手牌（8 张）──
      c0: card(SUIT_SPADES,   1),   // A♠
      c1: card(SUIT_SPADES,  13),   // K♠
      c2: card(SUIT_SPADES,  12),   // Q♠  （可凑 ♠ Flush）
      c3: card(SUIT_HEARTS,   1),   // A♥  （可凑 Pair of Aces）
      c4: card(SUIT_HEARTS,  13),   // K♥  （可凑 Two Pair）
      c5: card(SUIT_DIAMONDS, 7),   // 7♦
      c6: card(SUIT_CLUBS,    7),   // 7♣  （可凑 Pair of 7s）
      c7: card(SUIT_SPADES,   3),   // 3♠  （凑牌数）

      // ── 得分追踪 ──
      score_total: { Resource: { id: 'score', current: 0, min: 0, max: 9999999 } } as unknown as EntityBlueprint,
      round_chips: { Resource: { id: 'chips', current: 0, min: 0, max: 9999 } } as unknown as EntityBlueprint,
      round_mult:  { Resource: { id: 'mult',  current: 0, min: 0, max: 9999 } } as unknown as EntityBlueprint,

      // ── 小丑牌（纯数据：id = 小丑名，效果值放 Resource）──
      joker_jolly:   {
        Tag: { flags: JOKER_FLAG },
        Resource: { id: 'mult_bonus', current: 8, min: 0, max: 99 },
      } as unknown as EntityBlueprint,
      joker_scholar: {
        Tag: { flags: JOKER_FLAG },
        Resource: { id: 'chip_bonus', current: 20, min: 0, max: 999 },
      } as unknown as EntityBlueprint,
    },
  };
}
