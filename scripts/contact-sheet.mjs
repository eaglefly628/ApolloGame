// 素材契约审计 · 拼图工具 —— 把若干小像素图（如 DCSS 32×32）放大拼成一张大图，
// 供人/VLM 逐格看图打标签（wiki 像素扫描 / artlib-tags 审计流程用）。
// 零依赖：纯 Node 解码 PNG（IHDR/PLTE/tRNS/IDAT + 滤波重建）→ 最近邻放大 → 棋盘格底网格 → 编码 PNG。
// 用法：node scripts/contact-sheet.mjs --out /tmp/sheet.png --cols 4 --scale 7 a.png b.png ...
import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync, deflateSync } from 'node:zlib';

// ── PNG 解码（支持 bitDepth 8 的 gray/RGB/palette/gray+A/RGBA；DCSS 全在此范围）──
function u32(b, o) { return (b[o] << 24 | b[o + 1] << 16 | b[o + 2] << 8 | b[o + 3]) >>> 0; }

const paeth = (a, b, c) => {
  const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};
function unfilter(raw, offset, w, h, CH) {
  const stride = w * CH;
  const out = Buffer.alloc(h * stride);
  let p = offset;
  for (let y = 0; y < h; y++) {
    const ft = raw[p++];
    const prevOff = (y - 1) * stride, curOff = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= CH ? out[curOff + x - CH] : 0, b = y > 0 ? out[prevOff + x] : 0, c = x >= CH && y > 0 ? out[prevOff + x - CH] : 0;
      let v = raw[p + x];
      if (ft === 1) v += a; else if (ft === 2) v += b; else if (ft === 3) v += (a + b) >> 1; else if (ft === 4) v += paeth(a, b, c);
      out[curOff + x] = v & 0xff;
    }
    p += stride;
  }
  return { data: out, next: p };
}
const ADAM7 = [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]];

function decodePng(buf) {
  if (u32(buf, 0) !== 0x89504e47) throw new Error('not png');
  let w = 0, h = 0, depth = 0, color = 0, interlace = 0, plte = null, trns = null;
  const idat = [];
  for (let p = 8; p + 8 <= buf.length;) {
    const len = u32(buf, p), type = buf.toString('latin1', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = u32(data, 0); h = u32(data, 4); depth = data[8]; color = data[9]; interlace = data[12]; }
    else if (type === 'PLTE') plte = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (depth !== 8) throw new Error(`unsupported bit depth ${depth}`);
  const CH = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[color];
  if (!CH) throw new Error(`unsupported color type ${color}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * CH;
  let out;
  if (interlace === 1) {
    // Adam7 隔行：逐趟解滤波再散布（曾忽略此标志 → 隔行图渲染成噪点）。
    out = Buffer.alloc(h * stride);
    let pos = 0;
    for (const [x0, y0, dx, dy] of ADAM7) {
      const pw = Math.ceil((w - x0) / dx), ph = Math.ceil((h - y0) / dy);
      if (pw <= 0 || ph <= 0) continue;
      const r = unfilter(raw, pos, pw, ph, CH);
      pos = r.next;
      for (let j = 0; j < ph; j++) for (let i = 0; i < pw; i++) {
        const src = (j * pw + i) * CH, dst = ((y0 + j * dy) * w + (x0 + i * dx)) * CH;
        for (let ch = 0; ch < CH; ch++) out[dst + ch] = r.data[src + ch];
      }
    }
  } else {
    out = unfilter(raw, 0, w, h, CH).data;
  }
  // → RGBA
  const px = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    let r, g, bl, al = 255;
    if (color === 6) { r = out[i * 4]; g = out[i * 4 + 1]; bl = out[i * 4 + 2]; al = out[i * 4 + 3]; }
    else if (color === 2) { r = out[i * 3]; g = out[i * 3 + 1]; bl = out[i * 3 + 2]; }
    else if (color === 3) { const idx = out[i]; r = plte[idx * 3]; g = plte[idx * 3 + 1]; bl = plte[idx * 3 + 2]; al = trns && idx < trns.length ? trns[idx] : 255; }
    else if (color === 0) { r = g = bl = out[i]; }
    else { r = g = bl = out[i * 2]; al = out[i * 2 + 1]; }
    px[i * 4] = r; px[i * 4 + 1] = g; px[i * 4 + 2] = bl; px[i * 4 + 3] = al;
  }
  return { w, h, px };
}

// ── PNG 编码（RGB8，filter 0）──
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'latin1');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
function encodePng(w, h, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; // RGB8
  const raw = Buffer.alloc(h * (w * 3 + 1));
  for (let y = 0; y < h; y++) rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── 拼图 ──
const args = process.argv.slice(2);
function opt(name, dflt) {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return dflt;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
}
const OUT = opt('out', '/tmp/contact-sheet.png');
const COLS = +opt('cols', 4);
const SCALE = +opt('scale', 7);
const files = args;
if (files.length === 0) {
  console.error('用法: node scripts/contact-sheet.mjs --out o.png --cols 4 --scale 7 <png...>');
  process.exit(1);
}

const GAP = 14, MARGIN = 14, CHK = 8; // 间距/边距/棋盘格尺寸
const imgs = files.map((f) => ({ f, ...decodePng(readFileSync(f)) }));
const cellW = Math.max(...imgs.map((i) => i.w)) * SCALE;
const cellH = Math.max(...imgs.map((i) => i.h)) * SCALE;
const rows = Math.ceil(imgs.length / COLS);
const W = MARGIN * 2 + COLS * cellW + (COLS - 1) * GAP;
const H = MARGIN * 2 + rows * cellH + (rows - 1) * GAP;
const canvas = Buffer.alloc(W * H * 3, 0x10); // 暗底

for (let n = 0; n < imgs.length; n++) {
  const { w, h, px } = imgs[n];
  const ox = MARGIN + (n % COLS) * (cellW + GAP);
  const oy = MARGIN + Math.floor(n / COLS) * (cellH + GAP);
  for (let y = 0; y < cellH; y++) {
    for (let x = 0; x < cellW; x++) {
      const cx = ox + x, cy = oy + y, o = (cy * W + cx) * 3;
      // 棋盘格底（透明可见）
      const dark = (Math.floor(x / CHK) + Math.floor(y / CHK)) % 2 === 0;
      let r = dark ? 0x2a : 0x1c, g = dark ? 0x30 : 0x22, b = dark ? 0x3c : 0x2c;
      const sx = Math.floor(x / SCALE), sy = Math.floor(y / SCALE);
      if (sx < w && sy < h) {
        const i = (sy * w + sx) * 4, al = px[i + 3] / 255;
        if (al > 0) { r = px[i] * al + r * (1 - al); g = px[i + 1] * al + g * (1 - al); b = px[i + 2] * al + b * (1 - al); }
      }
      canvas[o] = r; canvas[o + 1] = g; canvas[o + 2] = b;
    }
  }
}

writeFileSync(OUT, encodePng(W, H, canvas));
console.log(`${OUT}  ${W}×${H} · ${imgs.length} 图 · ${COLS} 列 · ×${SCALE}`);
imgs.forEach((i, n) => console.log(`  [${Math.floor(n / COLS) + 1}-${(n % COLS) + 1}] ${i.f}`));
