// gen-shelf-3d —— 给共享货架（assets/index.json）备齐**公用 3D 基础素材**（REQ-PA-3D公用货架 ①）。
// 数据驱动 + 确定性 + 零网络：材质=数据条目（引 pbr 预设）；mesh=程序化 glb（基础体）；贴图/天空盒=登记已产/程序化产物。
// 幂等：按 id upsert，可复放、可审计。游戏**不直引货架**——用 scripts/vendor-asset.mjs copy 进本地 art/ 再引。
//
// 用法: node scripts/gen-shelf-3d.mjs [materials|meshes|textures|env|all]
//
// 边界：只写共享货架 assets/index.json（+ assets/{meshes,textures,env}/ 文件）。渲染消费端(P3D)不动。

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = join(ROOT, 'assets', 'index.json');

// ── 公用材质货架（数据型·无文件·引 pbr 预设，与 src/assets/pbr-materials.ts 同名）──
// 每条 = 一个可 vendor 的「内置材质资源」；游戏 vendor 后 Material3D.materialRef 引它，物件 inline 字段可覆盖。
const MATERIALS = [
  ['matte', '哑光（陶土/塑料感·默认）'],
  ['plastic', '光面塑料（介电）'],
  ['steel', '钢（抛光·低粗糙）'],
  ['iron', '铸铁（暗·粗糙）'],
  ['gold', '金'],
  ['copper', '铜'],
  ['glass', '玻璃（透射）'],
  ['rock', '岩石（花岗岩/混凝土）'],
  ['dirt', '土（干土壤）'],
  ['wood', '木（橡木）'],
  ['emissive', '自发光'],
];

function materialEntries() {
  return MATERIALS.map(([preset, desc]) => ({
    id: `mat/${preset}`,
    type: 'material',
    description: `${desc} · 公用材质`,
    status: 'filled', // material 免 path（数据全在 spec·asset-index 校验放行）
    category: 'material',
    tags: ['material', 'pbr', 'shared-3d', preset],
    license: 'CC0-1.0', // 我方数据（引内置预设·无外部素材）
    source: 'apollo-shelf',
    spec: { preset },
  }));
}

// ── 公用基础 mesh 货架（程序化 glb·确定性·无外部素材）──
// 基础几何体（单位尺度·居中）：游戏 vendor 后 Mesh3D/Model 引 mesh key；scale/genCollision 走 spec 闭集。
function planeGeo() { // 1×1 XZ 平面·法线 +Y
  const positions = new Float32Array([-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5]);
  const normals = new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]);
  const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
  return { positions, normals, indices };
}
function boxGeo() { // 单位立方·每面独立法线
  const faces = [
    [[0, 0, 1], [-0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5]],
    [[0, 0, -1], [0.5, -0.5, -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5]],
    [[1, 0, 0], [0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5]],
    [[-1, 0, 0], [-0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5]],
    [[0, 1, 0], [-0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5]],
    [[0, -1, 0], [-0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5]],
  ];
  const pos = [], nrm = [], idx = [];
  for (const [n, quad] of faces) {
    const base = pos.length / 3;
    for (let i = 0; i < 4; i++) { pos.push(quad[i * 3], quad[i * 3 + 1], quad[i * 3 + 2]); nrm.push(n[0], n[1], n[2]); }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { positions: new Float32Array(pos), normals: new Float32Array(nrm), indices: new Uint16Array(idx) };
}
function sphereGeo(rings = 12, sectors = 18, r = 0.5) { // UV 球
  const pos = [], nrm = [], idx = [];
  for (let i = 0; i <= rings; i++) {
    const theta = (i / rings) * Math.PI, st = Math.sin(theta), ct = Math.cos(theta);
    for (let j = 0; j <= sectors; j++) {
      const phi = (j / sectors) * 2 * Math.PI, x = st * Math.cos(phi), y = ct, z = st * Math.sin(phi);
      pos.push(x * r, y * r, z * r); nrm.push(x, y, z);
    }
  }
  const row = sectors + 1;
  for (let i = 0; i < rings; i++) for (let j = 0; j < sectors; j++) {
    const a = i * row + j, b = a + row;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  return { positions: new Float32Array(pos), normals: new Float32Array(nrm), indices: new Uint16Array(idx) };
}

const pad4 = (n) => (n + 3) & ~3;

// 组一份最小 glTF 2.0 二进制（.glb）：positions(f32 VEC3) + normals(f32 VEC3) + indices(u16 SCALAR)。
function buildGlb(geo) {
  const posB = Buffer.from(geo.positions.buffer, geo.positions.byteOffset, geo.positions.byteLength);
  const nrmB = Buffer.from(geo.normals.buffer, geo.normals.byteOffset, geo.normals.byteLength);
  const idxB = Buffer.from(geo.indices.buffer, geo.indices.byteOffset, geo.indices.byteLength);
  const posLen = posB.length, nrmLen = nrmB.length, idxLen = idxB.length;
  const binLen = pad4(posLen + nrmLen + idxLen);
  const bin = Buffer.alloc(binLen);
  posB.copy(bin, 0); nrmB.copy(bin, posLen); idxB.copy(bin, posLen + nrmLen);
  // POSITION accessor 需 min/max
  let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < geo.positions.length; i += 3) for (let k = 0; k < 3; k++) {
    const v = geo.positions[i + k]; if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v;
  }
  const gltf = {
    asset: { version: '2.0', generator: 'apollo gen-shelf-3d' },
    scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2 }] }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: geo.positions.length / 3, type: 'VEC3', min: mn, max: mx },
      { bufferView: 1, componentType: 5126, count: geo.normals.length / 3, type: 'VEC3' },
      { bufferView: 2, componentType: 5123, count: geo.indices.length, type: 'SCALAR' },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: posLen, target: 34962 },
      { buffer: 0, byteOffset: posLen, byteLength: nrmLen, target: 34962 },
      { buffer: 0, byteOffset: posLen + nrmLen, byteLength: idxLen, target: 34963 },
    ],
    buffers: [{ byteLength: binLen }],
  };
  let json = Buffer.from(JSON.stringify(gltf), 'utf8');
  if (json.length % 4) json = Buffer.concat([json, Buffer.alloc(4 - (json.length % 4), 0x20)]); // 空格填充
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8);
  const jsonChunk = Buffer.alloc(8); jsonChunk.writeUInt32LE(json.length, 0); jsonChunk.writeUInt32LE(0x4e4f534a, 4);
  const binChunk = Buffer.alloc(8); binChunk.writeUInt32LE(bin.length, 0); binChunk.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonChunk, json, binChunk, bin]);
}

const MESHES = [
  ['plane', planeGeo(), 'none', '1×1 平面（地块/地面）'],
  ['cube', boxGeo(), 'box', '单位立方（占位/箱体）'],
  ['sphere', sphereGeo(), 'hull', '单位球（占位/星体）'],
];

function meshEntries() {
  mkdirSync(join(ROOT, 'assets', 'meshes'), { recursive: true });
  return MESHES.map(([name, geo, genCollision, desc]) => {
    writeFileSync(join(ROOT, 'assets', 'meshes', `${name}.glb`), buildGlb(geo));
    return {
      id: `mesh/${name}`,
      type: 'mesh',
      description: `${desc} · 公用基础几何`,
      status: 'filled',
      path: `meshes/${name}.glb`,
      category: 'mesh',
      tags: ['mesh', 'primitive', 'shared-3d', name],
      license: 'CC0-1.0',
      source: 'apollo-shelf',
      spec: { scale: 1, genCollision },
    };
  });
}

// ── 纯 Node PNG 编码（RGB·无依赖·确定性）──
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePng(w, h, rgb) { // rgb = Buffer(w*h*3)
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) { raw[y * (1 + w * 3)] = 0; rgb.copy(raw, y * (1 + w * 3) + 1, y * w * 3, (y + 1) * w * 3); }
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0))]);
}

// ── 程序化贴图货架（④a：产进货架·不再散落 public/textures/）──
// 现有 gen-textures.mjs 的浏览器产物（plank/rune）已在 public/textures/·确定性 → copy 进货架并登记。
const PROC_TEX = [
  ['plank_albedo', 256, 256, 'albedo', '木板 albedo（程序化·确定性）'],
  ['plank_normal', 256, 256, 'normal', '木板法线图（线性·法线用途）'],
  ['rune_emissive', 256, 256, 'emissive', '符文自发光图（emissiveMap 展示）'],
];
function textureEntries() {
  mkdirSync(join(ROOT, 'assets', 'textures'), { recursive: true });
  const out = [];
  for (const [name, w, h, usage, desc] of PROC_TEX) {
    const srcPub = join(ROOT, 'public', 'textures', `${name}.png`);
    if (!existsSync(srcPub)) { console.warn(`  跳过 ${name}（public/textures 无·先跑 gen-textures.mjs）`); continue; }
    copyFileSync(srcPub, join(ROOT, 'assets', 'textures', `${name}.png`));
    out.push({
      id: `tex/${name}`, type: 'texture', description: `${desc} · 公用贴图`, status: 'filled',
      path: `textures/${name}.png`, category: 'texture', tags: ['texture', 'procedural', 'shared-3d', usage],
      license: 'CC0-1.0', source: 'apollo-shelf',
      spec: { format: 'png', width: w, height: h, usage }, // colorSpace 由 usage 自动推（normal→linear·其余→srgb）
    });
  }
  return out;
}

// ── 天空盒货架（等距柱 equirect 渐变天空·纯 Node 产·CC0）──
function skyGradient(w = 512, h = 256) {
  const rgb = Buffer.alloc(w * h * 3);
  const top = [58, 110, 190], horizon = [206, 224, 244]; // 天顶蓝 → 地平线浅
  for (let y = 0; y < h; y++) {
    const t = y / (h - 1); // 0 顶 .. 1 底
    const r = Math.round(top[0] + (horizon[0] - top[0]) * t);
    const g = Math.round(top[1] + (horizon[1] - top[1]) * t);
    const b = Math.round(top[2] + (horizon[2] - top[2]) * t);
    for (let x = 0; x < w; x++) { const o = (y * w + x) * 3; rgb[o] = r; rgb[o + 1] = g; rgb[o + 2] = b; }
  }
  return { w, h, png: encodePng(w, h, rgb) };
}
function envEntries() {
  mkdirSync(join(ROOT, 'assets', 'env'), { recursive: true });
  const { w, h, png } = skyGradient();
  writeFileSync(join(ROOT, 'assets', 'env', 'sky_gradient.png'), png);
  return [{
    id: 'env/sky-gradient', type: 'texture', description: '渐变天空盒（equirect·天顶蓝→地平线浅）· 公用环境', status: 'filled',
    path: 'env/sky_gradient.png', category: 'skybox', tags: ['skybox', 'env', 'sky', 'equirect', 'shared-3d'],
    license: 'CC0-1.0', source: 'apollo-shelf',
    spec: { format: 'png', width: w, height: h, usage: 'sprite', wrap: 'repeat' },
  }];
}

// ── 程序化 PBR 材质库（各品类·每套 albedo+normal+roughness 贴图 + 一个引这些贴图的材质）──
// 确定性噪声（hash 值噪声 + fbm + worley 胞元）；纯数学产图·无外部素材·CC0。
const nz2 = (x, y) => { let h = ((x * 374761393) ^ (y * 668265263)) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const vnoise = (x, y) => {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = nz2(xi, yi), b = nz2(xi + 1, yi), c = nz2(xi, yi + 1), d = nz2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a + (a - b - c + d) * u) * v;
};
const fbm = (x, y, oct = 4) => { let s = 0, amp = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += vnoise(x * f, y * f) * amp; f *= 2; amp *= 0.5; } return s; };
const worley = (x, y, cell) => { // F1 距离(归一) + 最近胞元 id
  const cx = Math.floor(x / cell), cy = Math.floor(y / cell); let m = 1e9, id = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const gx = cx + i, gy = cy + j, px = (gx + nz2(gx, gy)) * cell, py = (gy + nz2(gy + 7, gx - 3)) * cell;
    const dd = (x - px) ** 2 + (y - py) ** 2; if (dd < m) { m = dd; id = nz2(gx * 3 + 1, gy * 3 - 2); }
  }
  return { d: Math.sqrt(m) / cell, id };
};

// 品类采样器 (x,y) → { alb:[r,g,b] 0..255, h:高度 0..1, rough:粗糙 0..1 }；metal 标于 CATS。
const CATS = {
  brick: { desc: '红砖 + 灰浆缝', s(x, y) {
    const bw = 64, bh = 28, mo = 5, row = Math.floor(y / bh), xo = x + (row % 2 ? bw / 2 : 0);
    const iy = y - row * bh, col = Math.floor(xo / bw), ix = xo - col * bw;
    if (ix < mo || ix > bw - mo || iy < mo || iy > bh - mo) { const g = 108 + fbm(x / 6, y / 6) * 22; return { alb: [g, g, g * 0.95], h: 0.25, rough: 0.92 }; }
    const t = nz2(col, row), n = fbm(x / 5, y / 5) * 0.5 + fbm(x / 2, y / 2) * 0.2, br = 0.8 + n * 0.4;
    return { alb: [(150 + t * 40) * br, (70 + t * 30) * br, (55 + t * 20) * br], h: 0.7 + n * 0.2, rough: 0.82 };
  } },
  cobblestone: { desc: '鹅卵石', s(x, y) {
    const { d, id } = worley(x, y, 26);
    if (d > 0.72) { const g = 55 + fbm(x / 4, y / 4) * 20; return { alb: [g, g, g], h: 0.15, rough: 0.95 }; }
    const dome = Math.cos(Math.min(d / 0.72, 1) * Math.PI / 2), g = 105 + id * 85, n = fbm(x / 3, y / 3) * 0.3;
    return { alb: [g * (0.85 + n), g * 0.98 * (0.85 + n), g * 0.92 * (0.85 + n)], h: 0.3 + dome * 0.6, rough: 0.88 };
  } },
  grass: { desc: '草地', s(x, y) {
    const n = fbm(x / 8, y / 8), bl = fbm(x / 2, y / 1.2), g = 88 + n * 70 + bl * 40;
    return { alb: [40 + n * 30, g, 35 + n * 20], h: 0.4 + bl * 0.3, rough: 0.9 };
  } },
  sand: { desc: '沙地', s(x, y) {
    const du = fbm(x / 40, y / 40), fi = fbm(x / 3, y / 3), b = 190 + du * 30 + fi * 20;
    return { alb: [b, b * 0.9, b * 0.68], h: 0.4 + du * 0.4 + fi * 0.1, rough: 0.85 };
  } },
  concrete: { desc: '混凝土', s(x, y) {
    const n = fbm(x / 10, y / 10) * 0.6 + fbm(x / 3, y / 3) * 0.3, g = 138 + n * 62;
    return { alb: [g, g, g * 1.02], h: 0.5 + n * 0.15, rough: 0.9 };
  } },
  metal: { desc: '拉丝金属', metal: 1, s(x, y) {
    const st = vnoise(x * 0.03, y * 0.5) * 0.6 + vnoise(x * 0.01, y * 1.1) * 0.3, g = 165 + st * 55;
    return { alb: [g, g, g * 1.02], h: 0.5 + st * 0.04, rough: 0.3 + st * 0.14 };
  } },
  fabric: { desc: '织物', s(x, y) {
    const T = 6, wx = Math.floor(x / T), wy = Math.floor(y / T), over = (wx + wy) % 2 === 0;
    const bump = over ? Math.sin((y % T) / T * Math.PI) : Math.sin((x % T) / T * Math.PI), n = fbm(x / 20, y / 20) * 0.2, br = 0.7 + bump * 0.4;
    return { alb: [(120 + n * 40) * br, (90 + n * 30) * br, (150 + n * 40) * br], h: 0.4 + bump * 0.4, rough: 0.85 };
  } },
  tile: { desc: '瓷砖', s(x, y) {
    const T = 48, gr = 4, cx = Math.floor(x / T), cy = Math.floor(y / T), ix = x - cx * T, iy = y - cy * T;
    if (ix < gr || iy < gr || ix > T - gr || iy > T - gr) return { alb: [90, 88, 85], h: 0.2, rough: 0.9 };
    const c = (cx + cy) % 2 === 0 ? 235 : 210, n = fbm(x / 6, y / 6) * 10;
    return { alb: [c + n, c + n, c - 6 + n], h: 0.75, rough: 0.18 };
  } },
  gravel: { desc: '碎石', s(x, y) {
    const { d, id } = worley(x, y, 10), dome = Math.max(0, 1 - d / 0.8), g = 90 + id * 90, n = fbm(x / 2, y / 2) * 0.3;
    return { alb: [g * (0.8 + n), g * (0.78 + n), g * (0.72 + n)], h: 0.2 + dome * 0.6, rough: 0.9 };
  } },
};

const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v)));
function genPbrMaps(cat, N = 256) {
  const sample = CATS[cat].s;
  const alb = Buffer.alloc(N * N * 3), H = new Float32Array(N * N), rough = Buffer.alloc(N * N * 3);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const r = sample(x, y), i = y * N + x;
    alb[i * 3] = clamp255(r.alb[0]); alb[i * 3 + 1] = clamp255(r.alb[1]); alb[i * 3 + 2] = clamp255(r.alb[2]);
    H[i] = r.h; const rg = clamp255(r.rough * 255); rough[i * 3] = rough[i * 3 + 1] = rough[i * 3 + 2] = rg;
  }
  const nrm = Buffer.alloc(N * N * 3), S = 3;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const l = H[y * N + (x + N - 1) % N], r = H[y * N + (x + 1) % N], u = H[((y + N - 1) % N) * N + x], dn = H[((y + 1) % N) * N + x];
    const dx = (r - l) * S, dy = (dn - u) * S, len = Math.hypot(dx, dy, 1), o = (y * N + x) * 3;
    nrm[o] = clamp255((-dx / len * 0.5 + 0.5) * 255); nrm[o + 1] = clamp255((-dy / len * 0.5 + 0.5) * 255); nrm[o + 2] = clamp255((1 / len * 0.5 + 0.5) * 255);
  }
  return { N, alb, nrm, rough };
}
function pbrEntries() {
  mkdirSync(join(ROOT, 'assets', 'textures', 'pbr'), { recursive: true });
  const out = [];
  for (const [cat, def] of Object.entries(CATS)) {
    const { N, alb, nrm, rough } = genPbrMaps(cat);
    const maps = [['albedo', alb, 'albedo'], ['normal', nrm, 'normal'], ['rough', rough, 'roughness']];
    for (const [suffix, buf, usage] of maps) {
      writeFileSync(join(ROOT, 'assets', 'textures', 'pbr', `${cat}_${suffix}.png`), encodePng(N, N, buf));
      out.push({
        id: `tex/pbr/${cat}_${suffix}`, type: 'texture', description: `${def.desc} ${usage} · 程序化 PBR`, status: 'filled',
        path: `textures/pbr/${cat}_${suffix}.png`, category: 'texture', tags: ['texture', 'procedural', 'pbr', 'shared-3d', cat, usage],
        license: 'CC0-1.0', source: 'apollo-shelf', spec: { format: 'png', width: N, height: N, usage, wrap: 'repeat' },
      });
    }
    out.push({
      id: `mat/${cat}`, type: 'material', description: `${def.desc} · 程序化 PBR 材质`, status: 'filled',
      category: 'material', tags: ['material', 'pbr', 'textured', 'shared-3d', cat], license: 'CC0-1.0', source: 'apollo-shelf',
      spec: {
        preset: def.metal ? 'steel' : 'matte',
        map: `tex/pbr/${cat}_albedo`, normalMap: `tex/pbr/${cat}_normal`, roughnessMap: `tex/pbr/${cat}_rough`,
        metalness: def.metal ? 1 : 0,
      },
    });
  }
  return out;
}

// ── 汇总各类 → 一份 upsert 计划 ──
function buildPlan(which) {
  const plan = [];
  if (which === 'materials' || which === 'all') plan.push(...materialEntries());
  if (which === 'meshes' || which === 'all') plan.push(...meshEntries());
  if (which === 'textures' || which === 'all') plan.push(...textureEntries());
  if (which === 'env' || which === 'all') plan.push(...envEntries());
  if (which === 'pbr' || which === 'all') plan.push(...pbrEntries());
  return plan;
}

const which = process.argv[2] ?? 'all';
const plan = buildPlan(which);
if (plan.length === 0) {
  console.error(`gen-shelf-3d: 无 "${which}" 类产物（可选 materials|meshes|textures|env|all）`);
  process.exit(1);
}

const idx = JSON.parse(readFileSync(INDEX, 'utf8'));
const byId = new Map(idx.assets.map((a) => [a.id, a]));
let added = 0, updated = 0;
for (const e of plan) {
  if (byId.has(e.id)) updated++; else added++;
  byId.set(e.id, e);
}
idx.assets = [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
writeFileSync(INDEX, JSON.stringify(idx, null, 2) + '\n');
console.log(`✓ 货架 3D「${which}」：新增 ${added} · 更新 ${updated} → assets/index.json（共 ${idx.assets.length} 项）`);
