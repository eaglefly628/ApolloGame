#!/usr/bin/env node
// game102《色流工坊 / Pixel Pour》· 功能格图标贴图生成器（程序化·零外部依赖·零网络·CC0 自产）。
//
// 为 voxel 功能格方块面生成 4 张 128×128 满幅不透明贴图：圆角方砖底 + 居中白色符号 + 深色描边框。
// 贴到 3D 体素方块面上（Material3D.map），让玩家一眼认出格子类型。
// 纯栅格绘制（fillRect / roundRect / 多边形扫描线填充 / disc），确定性、同输入同像素。
// 用法：node scripts/game-102-cell-icon-gen.mjs
//   → 写 public/games/game102/art/cell-icon-<kind>.png 并 upsert 本地索引 index.json（filled·spec 闭集）。
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { encodePngRGBA } from './asset-matte.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ART_DIR = join(__dir, '..', 'public', 'games', 'game102', 'art');
const S = 128;

// ── 小色工具 ──
const rgb = (h) => [(h >> 16) & 0xff, (h >> 8) & 0xff, h & 0xff];
const clamp8 = (v) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));
const shade = ([r, g, b], k) => [clamp8(r * k), clamp8(g * k), clamp8(b * k)];
const WHITE = [255, 255, 255];

// ── 栅格画布（RGBA·alpha over 合成）──
function makeCanvas() {
  const buf = Buffer.alloc(S * S * 4); // 全透明
  const px = (x, y, [r, g, b], a = 1) => {
    if (x < 0 || y < 0 || x >= S || y >= S || a <= 0) return;
    const o = (y * S + x) * 4;
    const da = buf[o + 3] / 255;
    const oa = a + da * (1 - a);
    if (oa <= 0) return;
    buf[o] = clamp8((r * a + buf[o] * da * (1 - a)) / oa);
    buf[o + 1] = clamp8((g * a + buf[o + 1] * da * (1 - a)) / oa);
    buf[o + 2] = clamp8((b * a + buf[o + 2] * da * (1 - a)) / oa);
    buf[o + 3] = clamp8(oa * 255);
  };
  return { buf, px };
}

const cover = (d) => (d <= -0.5 ? 1 : d >= 0.5 ? 0 : 0.5 - d);

// 圆角矩形（轴对齐·signed-distance 抗锯齿）。
function roundRect(cvs, cx, cy, hw, hh, r, color, alpha = 1) {
  for (let y = Math.floor(cy - hh - 2); y <= Math.ceil(cy + hh + 2); y++)
    for (let x = Math.floor(cx - hw - 2); x <= Math.ceil(cx + hw + 2); x++) {
      const dx = Math.abs(x + 0.5 - cx) - (hw - r), dy = Math.abs(y + 0.5 - cy) - (hh - r);
      const d = Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r;
      const a = cover(d) * alpha;
      if (a > 0) cvs.px(x, y, color, a);
    }
}

// 圆盘。
function disc(cvs, cx, cy, rad, color, alpha = 1) {
  for (let y = Math.floor(cy - rad - 2); y <= Math.ceil(cy + rad + 2); y++)
    for (let x = Math.floor(cx - rad - 2); x <= Math.ceil(cx + rad + 2); x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - rad;
      const a = cover(d) * alpha;
      if (a > 0) cvs.px(x, y, color, a);
    }
}

// 环（外白内挖空成描边圈）：ringRad 外半径·thick 环厚。
function ring(cvs, cx, cy, rad, thick, color, alpha = 1) {
  for (let y = Math.floor(cy - rad - 2); y <= Math.ceil(cy + rad + 2); y++)
    for (let x = Math.floor(cx - rad - 2); x <= Math.ceil(cx + rad + 2); x++) {
      const dist = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      const d = Math.abs(dist - (rad - thick / 2)) - thick / 2;
      const a = cover(d) * alpha;
      if (a > 0) cvs.px(x, y, color, a);
    }
}

// 粗线段（圆头胶囊）。
function stroke(cvs, x1, y1, x2, y2, rad, color, alpha = 1) {
  const vx = x2 - x1, vy = y2 - y1, len2 = vx * vx + vy * vy || 1;
  const r0 = Math.floor(Math.min(x1, x2) - rad - 2), r1 = Math.ceil(Math.max(x1, x2) + rad + 2);
  const c0 = Math.floor(Math.min(y1, y2) - rad - 2), c1 = Math.ceil(Math.max(y1, y2) + rad + 2);
  for (let y = c0; y <= c1; y++) for (let x = r0; x <= r1; x++) {
    const pxc = x + 0.5, pyc = y + 0.5;
    let t = ((pxc - x1) * vx + (pyc - y1) * vy) / len2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const d = Math.hypot(pxc - (x1 + vx * t), pyc - (y1 + vy * t)) - rad;
    const a = cover(d) * alpha;
    if (a > 0) cvs.px(x, y, color, a);
  }
}

// 多边形扫描线填充（3×3 超采样抗锯齿）。points = [[x,y],...]。
function polygon(cvs, points, color, alpha = 1) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of points) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  const inside = (px, py) => {
    let c = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [xi, yi] = points[i], [xj, yj] = points[j];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  for (let y = Math.floor(minY - 1); y <= Math.ceil(maxY + 1); y++)
    for (let x = Math.floor(minX - 1); x <= Math.ceil(maxX + 1); x++) {
      let hit = 0;
      for (let sy = 0; sy < 3; sy++) for (let sx = 0; sx < 3; sx++)
        if (inside(x + (sx + 0.5) / 3, y + (sy + 0.5) / 3)) hit++;
      const a = (hit / 9) * alpha;
      if (a > 0) cvs.px(x, y, color, a);
    }
}

// ── 方砖底 + 深色描边框（满幅不透明）──
function tileBase(hex) {
  const cvs = makeCanvas();
  const base = rgb(hex);
  const edge = shade(base, 0.42);   // 深色描边（同色系压暗·方块面之间分隔感）
  const cx = S / 2, cy = S / 2;
  // 深色底满幅（描边色）
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) cvs.px(x, y, edge, 1);
  // 圆角方砖本体（内缩留描边框）
  roundRect(cvs, cx, cy, 58, 58, 18, base, 1);
  // 顶部柔和高光斜带（提立体感·仍不透明）
  roundRect(cvs, cx, cy - 30, 50, 20, 14, shade(base, 1.14), 0.5);
  return cvs;
}

// ── 火焰 ──
function drawFire(cvs) {
  const cx = 64;
  // 主外焰（对称水滴/火苗轮廓）
  polygon(cvs, [
    [cx, 22], [cx + 16, 44], [cx + 22, 68], [cx + 14, 92], [cx, 104],
    [cx - 14, 92], [cx - 22, 68], [cx - 16, 44],
  ], WHITE, 1);
  // 尖头拉长
  polygon(cvs, [[cx, 20], [cx + 9, 40], [cx - 9, 40]], WHITE, 1);
  // 左右卷曲小舌
  polygon(cvs, [[cx - 20, 62], [cx - 30, 74], [cx - 18, 84]], WHITE, 1);
  polygon(cvs, [[cx + 20, 66], [cx + 30, 78], [cx + 17, 86]], WHITE, 1);
  // 底部圆润
  disc(cvs, cx, 90, 22, WHITE, 1);
}

// ── 时钟 ──
function drawClock(cvs) {
  const cx = 64, cy = 64;
  ring(cvs, cx, cy, 40, 9, WHITE, 1);   // 表圈
  // 12 点小刻度
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const x = cx + Math.sin(a) * 32, y = cy - Math.cos(a) * 32;
    disc(cvs, x, y, 3, WHITE, 1);
  }
  stroke(cvs, cx, cy, cx, cy - 24, 5, WHITE, 1);        // 时针（朝上）
  stroke(cvs, cx, cy, cx + 22, cy + 6, 4.5, WHITE, 1);  // 分针（朝右下）
  disc(cvs, cx, cy, 6, WHITE, 1);                        // 中心轴
}

// ── 爆炸星芒 ──
function drawBomb(cvs) {
  const cx = 64, cy = 64;
  const spikes = 10, outer = 46, inner = 20;
  const pts = [];
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  polygon(cvs, pts, WHITE, 1);
  disc(cvs, cx, cy, 14, WHITE, 1); // 实心核
}

// ── 子弹/弹药 ──
function drawAmmo(cvs) {
  const cx = 64;
  // 弹尖（ogive 三角圆头）
  polygon(cvs, [[cx, 20], [cx + 17, 46], [cx - 17, 46]], WHITE, 1);
  disc(cvs, cx, 44, 17, WHITE, 1);
  // 弹身
  roundRect(cvs, cx, 68, 17, 22, 4, WHITE, 1);
  // 弹壳底缘（略宽的座）
  roundRect(cvs, cx, 96, 20, 12, 4, WHITE, 1);
  // 底缘沟槽（用底砖不可见——改用微阴影线在白身上：细深线，靠环形凹槽表现）
  return cvs;
}

const KINDS = [
  { key: 'fire', hex: 0xff7a3a, draw: drawFire, label: '火' },
  { key: 'time', hex: 0x6ad0ff, draw: drawClock, label: '时钟' },
  { key: 'bomb', hex: 0xff4a3a, draw: drawBomb, label: '爆炸' },
  { key: 'ammo', hex: 0xffe08a, draw: drawAmmo, label: '弹药' },
];

// ── 生成 + 落盘 + 登记本地索引 ──
const written = [];
for (const k of KINDS) {
  const cvs = tileBase(k.hex);
  k.draw(cvs);
  const buf = encodePngRGBA(S, S, cvs.buf);
  const file = `cell-icon-${k.key}.png`;
  writeFileSync(join(ART_DIR, file), buf);
  written.push({ ...k, file });
  console.log(`  ✎ ${file} (${buf.length} bytes)`);
}

const idxPath = join(ART_DIR, 'index.json');
const idx = JSON.parse(readFileSync(idxPath, 'utf8'));
const byId = new Map(idx.assets.map((a) => [a.id, a]));
for (const w of written) {
  const id = `cell-icon/${w.key}`;
  byId.set(id, {
    id,
    type: 'texture',
    description: `功能格图标贴图 · ${w.label} · 程序化生成（voxel 功能格方块面·满幅不透明）`,
    status: 'filled',
    path: `/games/game102/art/${w.file}`,
    category: 'texture.cell-icon',
    tags: ['cell-icon', w.key, 'texture', 'voxel', 'game102', 'proto'],
    style: 'flat-icon',
    license: 'CC0',
    source: 'procedural (scripts/game-102-cell-icon-gen.mjs)',
    spec: { usage: 'texture', colorSpace: 'srgb', wrap: 'clamp', format: 'png', width: S, height: S, transparent: false },
    provenance: {
      method: 'procedural-raster (roundRect tile + polygon-scanline white glyph + dark same-hue border)',
      generator: 'scripts/game-102-cell-icon-gen.mjs',
      tint: `#${w.hex.toString(16).padStart(6, '0')}`,
      note: 'deterministic; zero external assets/network; full-frame opaque face texture for 3D voxel cell blocks',
    },
  });
}
idx.assets = [...byId.values()];
writeFileSync(idxPath, JSON.stringify(idx, null, 2) + '\n');
console.log(`  ✎ index.json upsert ${written.length} entries → cell-icon/{${KINDS.map((k) => k.key).join(',')}}`);
