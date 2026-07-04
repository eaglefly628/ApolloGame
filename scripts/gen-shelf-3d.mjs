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

// ── 汇总各类 → 一份 upsert 计划 ──
function buildPlan(which) {
  const plan = [];
  if (which === 'materials' || which === 'all') plan.push(...materialEntries());
  if (which === 'meshes' || which === 'all') plan.push(...meshEntries());
  if (which === 'textures' || which === 'all') plan.push(...textureEntries());
  if (which === 'env' || which === 'all') plan.push(...envEntries());
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
