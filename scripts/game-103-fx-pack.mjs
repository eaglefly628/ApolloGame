// game-103 FX 精灵表打包 —— 把 DCSS FreeArtLib/effect 的序列帧水平拼成单行横条精灵表，
// 供幸存者游戏子弹/弹幕用序列帧动画。零依赖：复用 contact-sheet 的纯 Node PNG 解码 + 自带 RGBA 编码。
// 幂等：可重复运行。输出 public/games/game-103/art/fx/<group>.png。
// 用法：node scripts/game-103-fx-pack.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { inflateSync, deflateSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── PNG 解码（移植自 scripts/contact-sheet.mjs · 支持 gray/RGB/palette/gray+A/RGBA）──
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

// ── PNG 编码（RGBA8·color type 6·filter 0）——保留 alpha 透明通道 ──
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
function encodePngRGBA(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // RGBA8
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── 组定义（帧顺序严格按序号升序）──
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const SRC = resolve(ROOT, 'assets/FreeArtLib/effect');
const OUTDIR = resolve(ROOT, 'public/games/game-103/art/fx');
const GROUPS = [
  { group: 'magic_dart', frames: [0, 1, 2, 3, 4, 5] },
  { group: 'searing_ray', frames: [0, 1, 2, 3, 4, 5] },
  { group: 'flame', frames: [0, 1, 2] },
  { group: 'sting', frames: [0, 1, 2] },
  { group: 'sandblast', frames: [0, 1, 2] },
  { group: 'gold_sparkles', frames: [1, 2, 3] },
];

mkdirSync(OUTDIR, { recursive: true });
for (const { group, frames } of GROUPS) {
  const decoded = frames.map((n) => {
    const f = resolve(SRC, `${group}_${n}.png`);
    const d = decodePng(readFileSync(f));
    if (d.w !== 32 || d.h !== 32) throw new Error(`${f} 不是 32×32（实际 ${d.w}×${d.h}）`);
    return d;
  });
  const count = decoded.length;
  const W = 32 * count, H = 32;
  const sheet = Buffer.alloc(W * H * 4); // 全 0 = 透明底
  decoded.forEach((d, fi) => {
    const ox = fi * 32;
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const s = (y * 32 + x) * 4;
        const t = (y * W + (ox + x)) * 4;
        sheet[t] = d.px[s]; sheet[t + 1] = d.px[s + 1]; sheet[t + 2] = d.px[s + 2]; sheet[t + 3] = d.px[s + 3];
      }
    }
  });
  const out = resolve(OUTDIR, `${group}.png`);
  writeFileSync(out, encodePngRGBA(W, H, sheet));
  console.log(`${group}.png  (w=${W}, h=${H}, frames=${count})`);
}
