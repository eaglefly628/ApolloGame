// Game B ·《雀宴》—— 麻将牌目录 + 3D 摆位（纯数据/纯函数·零逻辑零随机）。
// 尺寸/位置=scene-layout-handoff.md §二（归一单位·×U 进世界）；占位资产=B-007（FluffyStuff CC0·已 vendor）。
// S3 骨架口径：满 136 牌山 + 线框稿示意手牌的静态摆拍（发牌/洗牌=S4 麻将核·种子 PRNG 驱动）。
import { U } from './theme.js';

// ── 牌种目录（34 种 + 赤 5 ×3·资产 key = 本地索引 mahjong/tex/<牌>·B-007 vendor 而来）────
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

// ── 牌尺寸（归一 0.072×0.096×0.052 宽×高×厚 ≈ 真实牌比例）───────────────────────────
export const TILE_W = 0.072 * U;
export const TILE_H = 0.096 * U;
export const TILE_D = 0.052 * U;

export interface TilePose {
  x: number;
  y: number;
  z: number;
  rotX?: number;
  rotY?: number;
}

// ── 牌山（四边各 17 墩 × 2 层 = 136·面朝下平躺）────────────────────────────────────
// 墙线离心 0.62（交接档「距边 0.62」按几何唯一解读：17 墩跨 17×0.072=1.224、半跨 0.612 ≤ 0.62，
// 四墙恰围合不相交；若解读成离心 0.38 则四角互相穿插——故取墙线 |x|/|z| = 0.62）。
// 平躺=rotX π/2（正面朝下·牌背朝上）；东西两墙 rotY π/2 让墩沿墙线排。
const WALL_LINE = 0.62 * U;
const STACKS = 17;

export function wallLayout(): Array<TilePose & { side: 'e' | 's' | 'w' | 'n'; stack: number; layer: number }> {
  const out: Array<TilePose & { side: 'e' | 's' | 'w' | 'n'; stack: number; layer: number }> = [];
  const span = (i: number): number => (i - (STACKS - 1) / 2) * TILE_W;
  for (let i = 0; i < STACKS; i++) {
    for (let layer = 0; layer < 2; layer++) {
      const y = TILE_D / 2 + layer * TILE_D;
      out.push({ side: 's', stack: i, layer, x: span(i), y, z: WALL_LINE, rotX: Math.PI / 2 });
      out.push({ side: 'n', stack: i, layer, x: -span(i), y, z: -WALL_LINE, rotX: Math.PI / 2 });
      out.push({ side: 'e', stack: i, layer, x: WALL_LINE, y, z: -span(i), rotX: Math.PI / 2, rotY: Math.PI / 2 });
      out.push({ side: 'w', stack: i, layer, x: -WALL_LINE, y, z: span(i), rotX: Math.PI / 2, rotY: Math.PI / 2 });
    }
  }
  return out;
}

// ── 自家手牌（南边距边 0.15 → z=0.85·13 枚立起面向镜头 + 摸牌位右离）────────────────────
// 摆拍手＝线框稿示意（一二三万 ④⑤⑥ 456索 東東 九九万 + 摸④⑦筒）——内容 1:1 线框稿·S4 起由 sim 发牌。
export const DEMO_HAND: TileKind[] = [
  'man-1', 'man-2', 'man-3',
  'pin-4', 'pin-5', 'pin-6',
  'sou-4', 'sou-5', 'sou-6',
  'ton', 'ton',
  'man-9', 'man-9',
];
export const DEMO_TSUMO: TileKind = 'pin-7';

const HAND_Z = 0.85 * U;
const HAND_GAP = 0.006 * U;
const TSUMO_GAP = 0.016 * U;

export function handLayout(count = DEMO_HAND.length): Array<TilePose & { tsumo?: boolean }> {
  const step = TILE_W + HAND_GAP;
  const x0 = -((count - 1) * step) / 2;
  const tiles: Array<TilePose & { tsumo?: boolean }> = Array.from({ length: count }, (_, i) => ({
    x: x0 + i * step,
    y: TILE_H / 2,
    z: HAND_Z,
  }));
  tiles.push({ x: x0 + count * step + TSUMO_GAP, y: TILE_H / 2, z: HAND_Z, tsumo: true });
  return tiles;
}
