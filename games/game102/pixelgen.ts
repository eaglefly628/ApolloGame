// Game 102 · Pixel Pour —— 像素画关卡「生成」核心（authoring-time 纯函数·确定性·零裸 Math.random）。
//
// 内容模型（owner 2026-07-24 拍板）：**每关 = 一整幅满格 cols×rows 像素画**，每格颜色 = power(补给罐)色之一。
// 特殊件叠在图上：南瓜头(打碎掉落) / 钥匙 / 门。低成本批产 = 「一张画 → 一关数据」。
//
// 两条生成路径，落同一份数据（bitmap 满格 + specials 叠层）：
//   Path A · 图像量化：任意目标画(PNG/AI 出图) → 降采样到 cols×rows → 每格取**最近 power 色** → bitmap。
//            本文件出 `quantizeToBitmap`（纯函数·任意 RGB 网格皆可·不依赖 PNG 解码）。
//   Path B · 程序化：seed → 母题库合成(南瓜/藤/花/地) → bitmap + specials（本文件 `genGarden`）。
// 详见 docs/design/game102/pixel-gen.md。色板实名见 theme.PALETTE。
import { PALETTE, type PaletteColor } from './theme.js';

export type Rgb = readonly [number, number, number];
export interface GenSpecials {
  keys: Array<[number, number]>;          // 金钥匙格 [col,row]
  door: { col: number; row: number; w: number; h: number };
  pumpkins: Array<[number, number]>;      // 南瓜头锚点格 [col,row]（打碎掉落件·S4 接 gravity/hitbox）
}
export interface GenPicture { cols: number; rows: number; bitmap: string[]; specials: GenSpecials; }

// 调色板 → 有序数组（index 对齐 bitmap 数字·名 = power 色）。
export function paletteList(names: readonly string[]): PaletteColor[] {
  return names.map((n) => { const c = PALETTE[n]; if (!c) throw new Error(`pixelgen: 未知 power 色 ${n}`); return c; });
}
const hexRgb = (tint: number): Rgb => [(tint >> 16) & 0xff, (tint >> 8) & 0xff, tint & 0xff];

// ── Path A 核心：最近 power 色（感知加权 RGB 距离·亮度权重偏人眼·确定性整数比较）──────────
// 权重 (r 3, g 4, b 2) = 常用低成本感知近似（比裸欧氏更贴人眼·无需 LAB 转换）。
export function nearestPaletteIndex(rgb: Rgb, pal: readonly PaletteColor[]): number {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < pal.length; i++) {
    const [pr, pg, pb] = hexRgb(pal[i].tint);
    const dr = rgb[0] - pr, dg = rgb[1] - pg, db = rgb[2] - pb;
    const d = 3 * dr * dr + 4 * dg * dg + 2 * db * db;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

// RGB 网格(rows×cols) → bitmap（每格最近 power 色 index·'.'=透明格：alpha<128 视为空）。
export function quantizeToBitmap(grid: ReadonlyArray<ReadonlyArray<Rgb | null>>, names: readonly string[]): string[] {
  const pal = paletteList(names);
  return grid.map((row) => row.map((px) => (px == null ? '.' : String(nearestPaletteIndex(px, pal)))).join(''));
}

// ── 确定性 PRNG（authoring 期·mulberry32·与引擎 random 同算法族）──────────────────────────
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ── Path B：程序化「像素南瓜园」生成器（满格·母题合成·确定性）───────────────────────────
// 色板约定（garden 闭集·index）：0 green 1 black 2 red 3 orange 4 yellow 5 white。
// 输出满格 bitmap（每格一色）+ specials（南瓜头/钥匙/门）。母题=圆盘南瓜(橙身+黄高光+黑边+绿蒂)、藤、花。
const GARDEN = ['green', 'black', 'red', 'orange', 'yellow', 'white'] as const;
const I = { green: 0, black: 1, red: 2, orange: 3, yellow: 4, white: 5 } as const;

export function genGarden(cols: number, rows: number, seed: number): GenPicture {
  const rnd = mulberry32(seed);
  const grid: number[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => I.green));
  // 地面底噪：绿为主、掺黑(泥)斑，形成有机背景。
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) grid[r][c] = rnd() < 0.16 ? I.black : I.green;

  const setPx = (c: number, r: number, v: number): void => { if (c >= 0 && c < cols && r >= 0 && r < rows) grid[r][c] = v; };
  // 圆盘南瓜：半径 rad·橙身+黄高光+黑描边+顶部绿蒂。返回锚点(中心)。
  const pumpkin = (cx: number, cy: number, rad: number): [number, number] => {
    for (let dr = -rad - 1; dr <= rad + 1; dr++) for (let dc = -rad - 1; dc <= rad + 1; dc++) {
      const d2 = dc * dc + dr * dr;
      if (d2 <= (rad + 1) * (rad + 1) && d2 > rad * rad) setPx(cx + dc, cy + dr, I.black);   // 描边
      else if (d2 <= rad * rad) setPx(cx + dc, cy + dr, dc < -rad / 3 && dr < 0 ? I.yellow : I.orange); // 身+高光
    }
    setPx(cx, cy - rad - 1, I.green); setPx(cx, cy - rad - 2, I.green);  // 蒂
    setPx(cx - 1, cy, I.black); setPx(cx + 1, cy, I.black);              // 竖棱暗示
    return [cx, cy];
  };
  // 花：红/黄点簇。
  const flower = (cx: number, cy: number, petal: number): void => {
    setPx(cx, cy, I.yellow);
    for (const [dc, dr] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) setPx(cx + dc, cy + dr, petal);
  };

  // 摆 3 个南瓜头 + 若干花（seeded 位置·避边）。
  const pumpkins: Array<[number, number]> = [];
  const spots: Array<[number, number, number]> = [
    [Math.floor(cols * 0.28), Math.floor(rows * 0.34), Math.max(3, Math.floor(cols * 0.12))],
    [Math.floor(cols * 0.70), Math.floor(rows * 0.30), Math.max(3, Math.floor(cols * 0.13))],
    [Math.floor(cols * 0.52), Math.floor(rows * 0.66), Math.max(3, Math.floor(cols * 0.14))],
  ];
  for (const [cx, cy, rad] of spots) pumpkins.push(pumpkin(cx, cy, rad));
  const nFlowers = 6 + Math.floor(rnd() * 6);
  for (let i = 0; i < nFlowers; i++) {
    const c = 1 + Math.floor(rnd() * (cols - 2)), r = 1 + Math.floor(rnd() * (rows - 2));
    flower(c, r, rnd() < 0.5 ? I.red : I.orange);
  }

  // specials：钥匙散布在南瓜周边可达格；门在底部中央。
  const door = { col: Math.floor(cols / 2) - 1, row: rows - 2, w: 2, h: 2 };
  const keys: Array<[number, number]> = pumpkins.map(([cx, cy]) => [Math.min(cols - 1, cx + 2), Math.min(rows - 1, cy + 2)] as [number, number]);

  const bitmap = grid.map((row) => row.map((v) => String(v)).join(''));
  return { cols, rows, bitmap, specials: { keys, door, pumpkins } };
}

export const GARDEN_PALETTE = GARDEN;
