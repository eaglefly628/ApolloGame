// Game B ·《雀宴》—— 麻将牌目录 + 3D 摆位（纯数据/纯函数·零逻辑零随机）。
// 视觉重做（owner 2026-07-17「好好想想麻将什么样子」）：参照雀魂/天凤电子麻将——
//   自家手牌=屏幕底部一大排、牌面清晰朝玩家；三家=牌背围三面；牌山=红牌背方墙；牌河=弃牌摊开。
// 牌面只在正面（box 牌身 + 正面 plane 贴图·不再 Material3D.map 贴满 6 面糊成怪牌）。
// 尺寸/位置=scene-layout-handoff.md §二基调 + 电子麻将视觉惯例；占位资产=B-007（FluffyStuff CC0）。
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

// ── 牌尺寸（世界单位·桌面 1.8U=18 宽）────────────────────────────────────────────────
// 自家手牌=放大特写（雀魂式·屏幕底部主角）；场牌（山/对家/侧家/河）=标准小牌。
export const HAND_W = 0.115 * U; // 1.15
export const HAND_H = 0.155 * U; // 1.55
export const HAND_D = 0.042 * U; // 0.42
export const SM_W = 0.062 * U; // 0.62（缩小→牌山四墙围合不交叉·牌河/副露留缝）
export const SM_H = 0.084 * U; // 0.84
export const SM_D = 0.03 * U; // 0.30

export interface TilePose {
  x: number;
  y: number;
  z: number;
  rotX?: number;
  rotY?: number;
}

// ── 自家手牌（南·玩家）：桌南内缘一大排·牌立·牌面朝相机·摸牌右离一档───────────────────
// 内容=线框稿示意手（1:1）；S4 起由 sim 发牌。牌面清晰（body 白 + 正面 plane 贴图）。
export const DEMO_HAND: TileKind[] = [
  'man-1', 'man-2', 'man-3',
  'pin-4', 'pin-5', 'pin-6',
  'sou-4', 'sou-5', 'sou-6',
  'ton', 'ton',
  'man-9', 'man-9',
];
export const DEMO_TSUMO: TileKind = 'pin-7';

const HAND_Z = 0.72 * U; // 桌南内缘（牌山外·靠玩家）
const HAND_GAP = 0.012 * U;
const TSUMO_GAP = 0.05 * U;

export function handLayout(count = DEMO_HAND.length): Array<TilePose & { tsumo?: boolean }> {
  const step = HAND_W + HAND_GAP;
  const total = count * step + TSUMO_GAP;
  const x0 = -total / 2 + HAND_W / 2;
  const tiles: Array<TilePose & { tsumo?: boolean }> = Array.from({ length: count }, (_, i) => ({
    x: x0 + i * step,
    y: HAND_H / 2,
    z: HAND_Z,
  }));
  tiles.push({ x: x0 + count * step + TSUMO_GAP, y: HAND_H / 2, z: HAND_Z, tsumo: true });
  return tiles;
}

// ── 三家手牌（对家北 + 东西·牌背立牌·围三面）──────────────────────────────────────────
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

// ── 牌河（各家门前弃牌·牌面朝上摊开·示意"一局进行中"·固定牌确定性）───────────────────
// S3=静态定格示意（非真弃牌·S4 由 sim 摆真河）；每家 6 张 2 行×3。
export const RIVER_DEMO: Record<'south' | Seat, TileKind[]> = {
  south: ['pin-1', 'sou-9', 'ton', 'man-8', 'haku', 'pin-3'],
  north: ['sou-2', 'man-5', 'chun', 'pin-8', 'nan', 'sou-6'],
  east: ['man-4', 'pin-6', 'hatsu', 'sou-3', 'ton', 'man-1'],
  west: ['sou-7', 'pin-2', 'shaa', 'man-6', 'pei', 'sou-4'],
};

const RIVER_LINE = 0.2 * U; // 河距心（牌山内侧·门前）
const RIVER_COLS = 3;

/** 牌河牌面朝上平躺位（每家 6 张·2 行 3 列·门前方向铺）。
 *  **只 rotX=-π/2**（plane 法线 +z→+y·牌面朝上·俯视看得见弃牌）——不叠 rotY：rotX+rotY 欧拉组合会把
 *  plane 转成竖直（侧看成白线·v3 中间那几根线的成因）。占位弃牌牌面朝向无所谓，位置区分门前即可。 */
export function riverLayout(seat: 'south' | Seat): TilePose[] {
  const gw = SM_W + 0.006 * U;
  const gh = SM_H + 0.006 * U;
  const faceUp = -Math.PI / 2;
  const out: TilePose[] = [];
  for (let i = 0; i < RIVER_DEMO[seat].length; i++) {
    const col = i % RIVER_COLS;
    const row = Math.floor(i / RIVER_COLS);
    const off = (col - (RIVER_COLS - 1) / 2) * gw; // 沿墙方向
    const depth = RIVER_LINE + row * gh; // 门前由内向外铺
    const y = SM_D / 2 + 0.002 * U;
    if (seat === 'south') out.push({ x: off, y, z: depth, rotX: faceUp });
    else if (seat === 'north') out.push({ x: -off, y, z: -depth, rotX: faceUp });
    else if (seat === 'east') out.push({ x: depth, y, z: -off, rotX: faceUp });
    else out.push({ x: -depth, y, z: off, rotX: faceUp }); // west
  }
  return out;
}
