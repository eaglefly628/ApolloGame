// Game B ·《雀宴》麻将核 —— 牌种/牌码单一真相（纯数据·零逻辑·headless 逻辑核基座）。
// 牌码方案（业界标准 34 种 0-33·赤5=种码+100·同 game-c suit*100 风格·t2-card-pile 契约=整数牌码数组）：
//   man 1-9 → 0-8 · pin 1-9 → 9-17 · sou 1-9 → 18-26 · 東南西北 → 27-30 · 白發中 → 31-33
//   赤5：man5红=104 · pin5红=113 · sou5红=122（code%100=种索引·code≥100=赤枚）
// 与 render 层 tiles.ts 的 TileKind 字符串目录一一对应（一致性由 wall.test 钉死·物理独立防跨层耦合）。
import type { TileKind } from '../tiles.js';

/** 34 牌种码 → TileKind 字符串（顺序=牌码 0-33·单一真相）。 */
export const CODE_TO_KIND: readonly TileKind[] = [
  'man-1', 'man-2', 'man-3', 'man-4', 'man-5', 'man-6', 'man-7', 'man-8', 'man-9',
  'pin-1', 'pin-2', 'pin-3', 'pin-4', 'pin-5', 'pin-6', 'pin-7', 'pin-8', 'pin-9',
  'sou-1', 'sou-2', 'sou-3', 'sou-4', 'sou-5', 'sou-6', 'sou-7', 'sou-8', 'sou-9',
  'ton', 'nan', 'shaa', 'pei', 'haku', 'hatsu', 'chun',
];

/** 赤5 的种索引（每色 5 的位置）。 */
export const RED_FIVE_KINDS = { man: 4, pin: 13, sou: 22 } as const;
export const RED_OFFSET = 100; // 赤枚 = 种码 + 100

export const NUM_KINDS = 34; // 牌种总数
export const TILES_PER_KIND = 4; // 每种 4 枚
export const FULL_WALL = NUM_KINDS * TILES_PER_KIND; // 136

/** 牌码 → 种索引（0-33·剥赤标记）。 */
export const kindOf = (code: number): number => code % RED_OFFSET;

/** 是否赤枚。 */
export const isRed = (code: number): boolean => code >= RED_OFFSET;

/** 牌码 → TileKind 字符串（赤5 归其普5 种；贴面另有 -red 资产·render 层判 isRed 取）。 */
export const kindStr = (code: number): TileKind => CODE_TO_KIND[kindOf(code)]!;

/** 是否幺九牌（老头牌 1/9 + 字牌·役/符判定基元·后续切片消费）。 */
export function isTerminalOrHonor(code: number): boolean {
  const k = kindOf(code);
  if (k >= 27) return true; // 字牌
  const num = (k % 9) + 1; // 数牌点数 1-9
  return num === 1 || num === 9;
}

/** 数牌点数（1-9）；字牌返回 0。 */
export function tileNumber(code: number): number {
  const k = kindOf(code);
  return k >= 27 ? 0 : (k % 9) + 1;
}

/** 花色（'man'|'pin'|'sou'|'honor'）。 */
export function tileSuit(code: number): 'man' | 'pin' | 'sou' | 'honor' {
  const k = kindOf(code);
  if (k < 9) return 'man';
  if (k < 18) return 'pin';
  if (k < 27) return 'sou';
  return 'honor';
}
