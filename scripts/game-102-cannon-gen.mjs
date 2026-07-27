#!/usr/bin/env node
// game102《色流工坊 / Pixel Pour》· 炮台精灵生成器（程序化·零外部依赖·零网络·CC0 自产）。
//
// 为 voxel-proto 底部 3 门炮生成每色一套的加农炮精灵（128×128·透明底·usage:sprite）。
// 纯栅格绘制（圆盘/胶囊/圆角矩形 + 圆柱阴影 + 卡通描边），确定性、同输入同像素。
// 用法：node scripts/game-102-cannon-gen.mjs   → 写 public/games/game102/art/cannon-tower-<color>.png
//        并 upsert 进本地索引 public/games/game102/art/index.json（filled·spec 闭集）。
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { encodePngRGBA } from './asset-matte.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ART_DIR = join(__dir, '..', 'public', 'games', 'game102', 'art');
const S = 128;

const COLORS = [
  { key: 'red', hex: 0xe0433f },
  { key: 'yellow', hex: 0xf2c21e },
  { key: 'green', hex: 0x5cb544 },
  { key: 'blue', hex: 0x2e6cf6 },
  { key: 'purple', hex: 0x8b5cf6 },
];

// ── 小色工具 ──
const rgb = (h) => [(h >> 16) & 0xff, (h >> 8) & 0xff, h & 0xff];
const clamp8 = (v) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));
const shade = ([r, g, b], k) => [clamp8(r * k), clamp8(g * k), clamp8(b * k)];
const mix = ([r, g, b], [r2, g2, b2], t) => [clamp8(r + (r2 - r) * t), clamp8(g + (g2 - g) * t), clamp8(b + (b2 - b) * t)];

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

// 抗锯齿覆盖率：signed distance d（<0 内部）→ 覆盖 alpha（1px 羽化）。
const cover = (d) => (d <= -0.5 ? 1 : d >= 0.5 ? 0 : 0.5 - d);

// 圆盘（可带每像素着色回调 shade(dx,dy,rad)→color）。
function disc(cvs, cx, cy, rad, colorFn, alpha = 1) {
  const r0 = Math.floor(cx - rad - 2), r1 = Math.ceil(cx + rad + 2);
  const c0 = Math.floor(cy - rad - 2), c1 = Math.ceil(cy + rad + 2);
  for (let y = c0; y <= c1; y++) for (let x = r0; x <= r1; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
    const d = Math.hypot(dx, dy) - rad;
    const a = cover(d) * alpha;
    if (a > 0) cvs.px(x, y, typeof colorFn === 'function' ? colorFn(dx, dy, rad) : colorFn, a);
  }
}

// 胶囊（线段 p1→p2 + 半径 rad）·圆柱阴影：按到轴的法向距离归一 → 明暗（中亮边暗）。
function capsule(cvs, x1, y1, x2, y2, rad, base, alpha = 1) {
  const vx = x2 - x1, vy = y2 - y1, len2 = vx * vx + vy * vy || 1;
  const r0 = Math.floor(Math.min(x1, x2) - rad - 2), r1 = Math.ceil(Math.max(x1, x2) + rad + 2);
  const c0 = Math.floor(Math.min(y1, y2) - rad - 2), c1 = Math.ceil(Math.max(y1, y2) + rad + 2);
  for (let y = c0; y <= c1; y++) for (let x = r0; x <= r1; x++) {
    const px = x + 0.5, py = y + 0.5;
    let t = ((px - x1) * vx + (py - y1) * vy) / len2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cxp = x1 + vx * t, cyp = y1 + vy * t;
    const dist = Math.hypot(px - cxp, py - cyp);
    const d = dist - rad;
    const a = cover(d) * alpha;
    if (a <= 0) continue;
    // 法向归一 n∈[-1,1]：+1=下缘暗、-1=上缘亮 → 圆柱柔和高光。
    const n = rad > 0 ? Math.max(-1, Math.min(1, (dist / rad) * ((px - cxp) * vy - (py - cyp) * vx >= 0 ? 1 : -1))) : 0;
    const k = 1.18 - 0.5 * (n * 0.5 + 0.5) - 0.12 * (n < 0 ? -n : 0); // 上侧提亮、下侧压暗
    cvs.px(x, y, shade(base, k), a);
  }
}

// 圆角矩形（轴对齐）。
function roundRect(cvs, cx, cy, hw, hh, r, color, alpha = 1) {
  for (let y = Math.floor(cy - hh - 2); y <= Math.ceil(cy + hh + 2); y++)
    for (let x = Math.floor(cx - hw - 2); x <= Math.ceil(cx + hw + 2); x++) {
      const dx = Math.abs(x + 0.5 - cx) - (hw - r), dy = Math.abs(y + 0.5 - cy) - (hh - r);
      const d = Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r;
      const a = cover(d) * alpha;
      if (a > 0) cvs.px(x, y, color, a);
    }
}

function drawCannon(hex) {
  const cvs = makeCanvas();
  const body = rgb(hex);
  const OUT = [24, 20, 34];              // 卡通深描边（近黑冷调）
  const wood = [122, 84, 52], woodDk = [80, 52, 30];

  // 几何锚（3/4 视角·炮管指向右上）。
  const bx1 = 40, by1 = 80, bx2 = 108, by2 = 34; // 炮管轴
  const R = 15;

  // 1) 轮子（两只·后小前大·先描边再本体再轮毂）——中性木色让炮管色跳出来。
  const wheels = [{ x: 42, y: 100, r: 17 }, { x: 74, y: 103, r: 14 }];
  for (const w of wheels) {
    disc(cvs, w.x, w.y, w.r + 2.5, OUT);
    disc(cvs, w.x, w.y, w.r, (dx, dy, rad) => shade(wood, 1.12 - (dy / rad) * 0.28));
    disc(cvs, w.x, w.y, w.r * 0.42, woodDk);       // 轮毂
    disc(cvs, w.x, w.y, w.r * 0.16, shade(wood, 1.2));
  }

  // 2) 炮座/托架（连接轮与炮管的木托）。
  roundRect(cvs, 58, 92, 24, 9, 6, OUT);
  roundRect(cvs, 58, 91, 21, 6.5, 5, wood);
  roundRect(cvs, 58, 89.5, 21, 3, 3, shade(wood, 1.15));

  // 3) 炮管（描边胶囊 + 圆柱阴影本体）。
  capsule(cvs, bx1, by1, bx2, by2, R + 2.5, OUT);
  capsule(cvs, bx1, by1, bx2, by2, R, body);
  // 炮管高光条（细亮胶囊·偏上侧）。
  const nx = -(by2 - by1), ny = (bx2 - bx1), nl = Math.hypot(nx, ny) || 1;
  const ox = (nx / nl) * R * 0.42, oy = (ny / nl) * R * 0.42;
  capsule(cvs, bx1 - ox, by1 - oy, bx2 - ox, by2 - oy, R * 0.28, mix(body, [255, 255, 255], 0.55), 0.75);
  // 后端环箍（炮尾）+ 尾球。
  disc(cvs, bx1, by1, R * 0.62 + 2.5, OUT);
  disc(cvs, bx1, by1, R * 0.62, (dx, dy, rad) => shade(body, 1.08 - (dy / rad) * 0.3));

  // 4) 炮口（前端·深色环 + 内膛暗洞）。
  disc(cvs, bx2, by2, R + 2.5, OUT);
  disc(cvs, bx2, by2, R, (dx, dy, rad) => shade(body, 1.12 - (dy / rad) * 0.32));
  disc(cvs, bx2, by2, R * 0.72, shade(body, 0.55));
  disc(cvs, bx2, by2, R * 0.5, [18, 16, 26]);
  disc(cvs, bx2 - 2, by2 - 2, R * 0.2, [60, 55, 78], 0.6); // 内膛微反光

  return cvs.buf;
}

// ── 生成 + 落盘 + 登记本地索引 ──
const written = [];
for (const c of COLORS) {
  const buf = encodePngRGBA(S, S, drawCannon(c.hex));
  const file = `cannon-tower-${c.key}.png`;
  writeFileSync(join(ART_DIR, file), buf);
  written.push({ ...c, file });
  console.log(`  ✎ ${file} (${buf.length} bytes)`);
}

// upsert index.json（保留既有条目·按 id 覆盖）。
const idxPath = join(ART_DIR, 'index.json');
const idx = JSON.parse(readFileSync(idxPath, 'utf8'));
const byId = new Map(idx.assets.map((a) => [a.id, a]));
for (const w of written) {
  const id = `cannon-tower/${w.key}`;
  byId.set(id, {
    id,
    type: 'texture',
    description: `加农炮台精灵 · ${w.key} · 程序化生成（voxel-proto 底部发射炮）`,
    status: 'filled',
    path: `/games/game102/art/${w.file}`,
    category: 'sprite.cannon',
    tags: ['cannon', 'tower', w.key, 'sprite', 'game102', 'proto'],
    style: 'cartoon',
    license: 'CC0',
    source: 'procedural (scripts/game-102-cannon-gen.mjs)',
    spec: { usage: 'sprite', colorSpace: 'srgb', format: 'png', width: S, height: S, transparent: true },
    provenance: {
      method: 'procedural-raster (disc/capsule/roundRect + cylindrical shading + cartoon outline)',
      generator: 'scripts/game-102-cannon-gen.mjs',
      tint: `#${w.hex.toString(16).padStart(6, '0')}`,
      note: 'deterministic; zero external assets/network; barrel recolored per palette, neutral wood carriage/wheels',
    },
  });
}
idx.assets = [...byId.values()];
writeFileSync(idxPath, JSON.stringify(idx, null, 2) + '\n');
console.log(`  ✎ index.json upsert ${written.length} entries → cannon-tower/{${COLORS.map((c) => c.key).join(',')}}`);
