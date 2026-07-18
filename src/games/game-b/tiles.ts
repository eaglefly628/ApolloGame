// Game B ·《雀宴》—— 麻将牌目录 + 3D 氛围舞台摆位（纯数据/纯函数·零逻辑零随机）。
// 架构（owner 2026-07-18 根因修正）：3D 只留**氛围件**——牌山方墙 + 三家牌背立牌（围三面）。
//   自家手牌/四家牌河/宝牌=**2D HUD**（play-ui.ts·真牌局投影·点牌即打），不再在 3D 里塞静态假牌
//   （假牌与真局对不上=owner 直指的「分不清谁在打」根因）。占位资产=B-007（FluffyStuff CC0）。
import { U } from './theme.js';

// ── 牌种目录（34 种 + 赤 5 ×3·资产 key = 本地索引 mahjong/tex/<牌>）──────────────────
export const SUITS = ['man', 'pin', 'sou'] as const;
export type TileKind =
  | `${(typeof SUITS)[number]}-${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`
  | `${(typeof SUITS)[number]}-5-red`
  | 'ton' | 'nan' | 'shaa' | 'pei' | 'haku' | 'hatsu' | 'chun';

/** 牌种 → 3D 贴面资产 key（本地索引 id·PNG albedo）。 */
export const texKey = (kind: TileKind | 'back' | 'front' | 'blank'): string => `mahjong/tex/${kind}`;

/** 全 34 种实名（校验/S4 配山用；赤 5 为替换枚不入 34 基种）。 */
export const TILE_KINDS: TileKind[] = [
  ...SUITS.flatMap((s) => Array.from({ length: 9 }, (_, i) => `${s}-${i + 1}` as TileKind)),
  'ton', 'nan', 'shaa', 'pei', 'haku', 'hatsu', 'chun',
];

// ── 牌尺寸（世界单位·桌面 1.8U=18 宽·场牌=标准小牌·围合方墙留缝）─────────────────────────
export const SM_W = 0.062 * U; // 0.62（缩小→牌山四墙围合不交叉）
export const SM_H = 0.084 * U; // 0.84
export const SM_D = 0.03 * U; // 0.30

export interface TilePose {
  x: number;
  y: number;
  z: number;
  rotX?: number;
  rotY?: number;
}

// ── 三家手牌（对家北 + 东西·牌背立牌·围三面·氛围）─────────────────────────────────────────
export type Seat = 'north' | 'east' | 'west';
const SIDE_LINE = 0.72 * U; // 三家距心（对称自家 HAND_Z）
const SIDE_COUNT = 13;

export function sideHandLayout(seat: Seat): TilePose[] {
  const step = SM_W + 0.01 * U;
  const spread = (i: number): number => (i - (SIDE_COUNT - 1) / 2) * step;
  const y = SM_H / 2;
  return Array.from({ length: SIDE_COUNT }, (_, i) => {
    if (seat === 'north') return { x: -spread(i), y, z: -SIDE_LINE, rotY: Math.PI };
    if (seat === 'east') return { x: SIDE_LINE, y, z: spread(i), rotY: -Math.PI / 2 };
    return { x: -SIDE_LINE, y, z: -spread(i), rotY: Math.PI / 2 }; // west
  });
}

// ── 牌山（四边各 17 墩 × 2 层 = 136·红牌背朝上平躺·围成方墙·四角相接不交叉）──────────────
const STACKS = 17;
const WALL_STEP = SM_W + 0.004 * U;
export const WALL_LINE = 8 * WALL_STEP; // 墙距心=最外墩位置 → 四墙首尾围合成方（不再堆叠交叉）

export function wallLayout(): Array<TilePose & { side: 'e' | 's' | 'w' | 'n'; stack: number; layer: number }> {
  const out: Array<TilePose & { side: 'e' | 's' | 'w' | 'n'; stack: number; layer: number }> = [];
  const step = WALL_STEP;
  const span = (i: number): number => (i - (STACKS - 1) / 2) * step;
  for (let i = 0; i < STACKS; i++) {
    for (let layer = 0; layer < 2; layer++) {
      const y = SM_D / 2 + layer * SM_D; // 平躺·厚度朝上·两层堆叠
      // 平躺：rotX=π/2 使牌面朝下/牌背朝上（牌高 SM_H 沿水平·厚 SM_D 竖直）
      out.push({ side: 's', stack: i, layer, x: span(i), y, z: WALL_LINE, rotX: Math.PI / 2 });
      out.push({ side: 'n', stack: i, layer, x: -span(i), y, z: -WALL_LINE, rotX: Math.PI / 2 });
      out.push({ side: 'e', stack: i, layer, x: WALL_LINE, y, z: -span(i), rotX: Math.PI / 2, rotY: Math.PI / 2 });
      out.push({ side: 'w', stack: i, layer, x: -WALL_LINE, y, z: span(i), rotX: Math.PI / 2, rotY: Math.PI / 2 });
    }
  }
  return out;
}
