// game-102-cannon-model-gen —— 程序化生成 game102《色流工坊》的**卡通加农炮 3D 模型**（GLB）。
// 数据驱动 + 确定性 + 零网络 + CC0（纯我方程序化几何·无外部素材）。
//
// 风格：彩色休闲 / 卡通加农炮——圆润敦实底座（带侧轮）+ 略胖的炮管，略微 Q。
// 约定（回报给接线方）：
//   · 前向轴 = +Z（炮口沿 local +Z 出膛）。
//   · 原点 = 底座中心 / 旋转支点，模型坐落于 y≥0（底面贴 y=0）。
//   · muzzle（炮口）local 坐标见下方 MUZZLE。
//   · 节点分离：barrel（可单独染色的炮管·浅中性底色·tint 乘法读真）/ carriage / wheel_l / wheel_r / cap。
//
// 用法: node scripts/game-102-cannon-model-gen.mjs
// 边界：只写 public/games/game102/art/cannon.glb（index.json 由资源管理员另行登记/校验）。

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'games', 'game102', 'art');
const OUT = join(OUT_DIR, 'cannon.glb');

// ── 几何工具：每个 part 产 { positions[], normals[], indices[] }（浮点数组·居中于各自 helper 坐标，再由 caller 变换）──

// 沿 +Z 轴的圆柱（含两端盖）：半径 r，从 z0 到 z1，radial 段 seg。可给两端不同半径（截锥）。
function cylinderZ(r0, r1, z0, z1, seg, capFront = true, capBack = true) {
  const pos = [], nrm = [], idx = [];
  const zc = (z0 + z1) / 2;
  const dr = r1 - r0, dz = z1 - z0;
  const slope = dr / dz; // 用于侧面法线
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const cx = Math.cos(a), cy = Math.sin(a);
    // 侧面法线（截锥修正）
    const nl = Math.hypot(1, slope);
    const nx = cx / nl, ny = cy / nl, nz = -slope / nl;
    pos.push(cx * r0, cy * r0, z0); nrm.push(nx, ny, nz);
    pos.push(cx * r1, cy * r1, z1); nrm.push(nx, ny, nz);
  }
  for (let i = 0; i < seg; i++) {
    const b = i * 2;
    idx.push(b, b + 1, b + 3, b, b + 3, b + 2);
  }
  // 端盖（三角扇）
  const addCap = (z, r, dir) => {
    const cIdx = pos.length / 3;
    pos.push(0, 0, z); nrm.push(0, 0, dir);
    const start = pos.length / 3;
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      pos.push(Math.cos(a) * r, Math.sin(a) * r, z); nrm.push(0, 0, dir);
    }
    for (let i = 0; i < seg; i++) {
      if (dir > 0) idx.push(cIdx, start + i, start + i + 1);
      else idx.push(cIdx, start + i + 1, start + i);
    }
  };
  if (capFront) addCap(z1, r1, 1);
  if (capBack) addCap(z0, r0, -1);
  return { positions: pos, normals: nrm, indices: idx };
}

// 圆环（torus·炮口装饰圈）：主半径 R，管半径 r，绕 +Z 轴（环平面 = XY），置于 z。
function torusZ(R, r, z, segMajor, segMinor) {
  const pos = [], nrm = [], idx = [];
  for (let i = 0; i <= segMajor; i++) {
    const u = (i / segMajor) * Math.PI * 2;
    const cu = Math.cos(u), su = Math.sin(u);
    for (let j = 0; j <= segMinor; j++) {
      const v = (j / segMinor) * Math.PI * 2;
      const cv = Math.cos(v), sv = Math.sin(v);
      const x = (R + r * cv) * cu;
      const y = (R + r * cv) * su;
      const zz = z + r * sv;
      pos.push(x, y, zz);
      nrm.push(cv * cu, cv * su, sv);
    }
  }
  const row = segMinor + 1;
  for (let i = 0; i < segMajor; i++) for (let j = 0; j < segMinor; j++) {
    const a = i * row + j, b = a + row;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  return { positions: pos, normals: nrm, indices: idx };
}

// 圆柱沿 +X 轴（车轮）：半径 r，从 x0 到 x1。
function cylinderX(r, x0, x1, seg) {
  const g = cylinderZ(r, r, 0, x1 - x0, seg);
  // 把 z 轴换到 x：局部 (px,py,pz) → (pz + x0, py, px) ；法线同旋转
  const rot = (p, n) => {
    for (let k = 0; k < p.length; k += 3) {
      const x = p[k], y = p[k + 1], z = p[k + 2];
      p[k] = z + x0; p[k + 1] = y; p[k + 2] = x;
    }
    for (let k = 0; k < n.length; k += 3) {
      const x = n[k], y = n[k + 1], z = n[k + 2];
      n[k] = z; n[k + 1] = y; n[k + 2] = x;
    }
  };
  rot(g.positions, g.normals);
  return g;
}

// 圆角箱（底座）：用宽/高/深 + 简单斜切角近似圆润。这里用带轻微顶部收窄的六面体（敦实梯形体）。
function carriageBody() {
  // 底面更宽、顶面略窄的梯形墩子；y: 0..h，x: ±，z: zb..zf
  const w0 = 0.62, w1 = 0.5;    // 底/顶半宽
  const h = 0.46;
  const zb = -0.5, zf = 0.42;
  const d0 = 0.5, d1 = 0.42;    // 底/顶半深
  // 8 角
  const V = [
    [-w0, 0, zb + (0.5 - d0)], [w0, 0, zb + (0.5 - d0)], [w0, 0, zf - (0.5 - d0) + (d0 - d0)], [-w0, 0, zf],
  ];
  // 用显式 8 顶点更清楚：
  const bl = zb, fr = zf;
  const bot = [[-w0, 0, bl], [w0, 0, bl], [w0, 0, fr], [-w0, 0, fr]];
  const top = [[-w1, h, bl + 0.04], [w1, h, bl + 0.04], [w1, h, fr - 0.04], [-w1, h, fr - 0.04]];
  const verts = [...bot, ...top];
  const quads = [
    [0, 1, 2, 3, [0, -1, 0]], // bottom
    [7, 6, 5, 4, [0, 1, 0]],  // top
    [0, 4, 5, 1, [0, 0, -1]], // back
    [3, 2, 6, 7, [0, 0, 1]],  // front
    [1, 5, 6, 2, [1, 0, 0]],  // right
    [0, 3, 7, 4, [-1, 0, 0]], // left
  ];
  const pos = [], nrm = [], idx = [];
  for (const q of quads) {
    const n = q[4]; const base = pos.length / 3;
    for (let i = 0; i < 4; i++) { const v = verts[q[i]]; pos.push(v[0], v[1], v[2]); nrm.push(n[0], n[1], n[2]); }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  // 顶部放一个浅“摇篮”座（半球缺口用小凸台近似）——加个小圆台承托炮管
  const cradle = cylinderZ(0.3, 0.3, -0.16, 0.16, 16);
  // 摇篮抬到炮管高度、绕 X 旋 90°让其轴向 X（作为鞍座）——简化：直接叠一个矮圆盘在顶
  translate(cradle, 0, h + 0.0, 0.0);
  // 旋转 cradle 使轴沿 Y（矮墩）
  rotateXtoY(cradle);
  return mergeGeo([{ positions: pos, normals: nrm, indices: idx }, cradle]);
}

// ── 变换工具 ──
function translate(g, dx, dy, dz) {
  for (let k = 0; k < g.positions.length; k += 3) { g.positions[k] += dx; g.positions[k + 1] += dy; g.positions[k + 2] += dz; }
}
function rotateXtoY(g) { // 绕 X 轴 +90°：(x,y,z)->(x,-z,y)
  const p = g.positions, n = g.normals;
  for (let k = 0; k < p.length; k += 3) { const y = p[k + 1], z = p[k + 2]; p[k + 1] = -z; p[k + 2] = y; }
  for (let k = 0; k < n.length; k += 3) { const y = n[k + 1], z = n[k + 2]; n[k + 1] = -z; n[k + 2] = y; }
}
function tiltX(g, rad, cy, cz) { // 绕过点(0,cy,cz)的 X 轴倾斜（抬炮口）
  const s = Math.sin(rad), c = Math.cos(rad), p = g.positions, n = g.normals;
  for (let k = 0; k < p.length; k += 3) {
    const y = p[k + 1] - cy, z = p[k + 2] - cz;
    p[k + 1] = cy + y * c - z * s; p[k + 2] = cz + y * s + z * c;
  }
  for (let k = 0; k < n.length; k += 3) {
    const y = n[k + 1], z = n[k + 2];
    n[k + 1] = y * c - z * s; n[k + 2] = y * s + z * c;
  }
}
function mergeGeo(list) {
  const pos = [], nrm = [], idx = []; let off = 0;
  for (const g of list) {
    pos.push(...g.positions); nrm.push(...g.normals);
    for (const i of g.indices) idx.push(i + off);
    off += g.positions.length / 3;
  }
  return { positions: pos, normals: nrm, indices: idx };
}

// ── 组装各部件（每部件 = 一个 node/mesh/primitive·独立材质与颜色）──
const AXIS_Y = 0.52;   // 炮管轴心高度
const TILT = -0.12;    // 轻微抬头（rad·负值 = 炮口上扬的休息姿态）

// 炮管：略胖圆柱 + 后膛球台 + 炮口加粗环
function barrelGeo() {
  const body = cylinderZ(0.24, 0.26, -0.30, 0.86, 20);      // 主管（前端略粗·喇叭感）
  const muzzle = cylinderZ(0.30, 0.33, 0.86, 1.00, 20);     // 炮口加粗段
  const rim = torusZ(0.31, 0.055, 1.00, 20, 10);            // 炮口装饰圈
  const breech = cylinderZ(0.24, 0.30, -0.44, -0.30, 18);   // 后膛收尾
  const knob = cylinderZ(0.30, 0.0, -0.50, -0.44, 14);      // 后膛圆帽
  const g = mergeGeo([breech, knob, body, muzzle, rim]);
  translate(g, 0, AXIS_Y, 0);
  tiltX(g, TILT, AXIS_Y, 0.0);
  return g;
}
// 车轮（侧面·带轮毂盖）
function wheelGeo(sign) {
  const tyre = torusZ(0.26, 0.10, 0, 20, 10);   // 轮胎（环平面 XY·需转到侧面 → 轴沿 X）
  const hub = cylinderZ(0.12, 0.12, -0.055, 0.055, 14);
  let g = mergeGeo([tyre, hub]);
  // 现在环平面在 XY（轴 Z）。车轮应绕 X 轴滚动 → 轴沿 X：绕 Y 旋 90°
  rotateYaxis90(g);
  translate(g, sign * 0.60, 0.28, -0.02);
  return g;
}
function rotateYaxis90(g) { // 绕 Y +90°：(x,y,z)->(z,y,-x)
  const p = g.positions, n = g.normals;
  for (let k = 0; k < p.length; k += 3) { const x = p[k], z = p[k + 2]; p[k] = z; p[k + 2] = -x; }
  for (let k = 0; k < n.length; k += 3) { const x = n[k], z = n[k + 2]; n[k] = z; n[k + 2] = -x; }
}

// 部件表：name / geo / baseColor(RGB 0..1) / metallic / roughness
const PARTS = [
  ['carriage', carriageBody(), [0.98, 0.86, 0.55], 0.0, 0.65], // 奶油木色底座
  ['barrel', barrelGeo(), [0.86, 0.88, 0.92], 0.15, 0.45],     // 浅中性炮管（供 tint 乘法染色）
  ['wheel_l', wheelGeo(-1), [0.36, 0.28, 0.46], 0.0, 0.7],     // 深紫车轮（撞色点缀）
  ['wheel_r', wheelGeo(1), [0.36, 0.28, 0.46], 0.0, 0.7],
];

// 归一化：整体抬升使最低点恰落 y=0（炮台稳坐地面·轮胎着地），返回抬升量 dy。
function groundAll(parts) {
  let minY = Infinity;
  for (const [, g] of parts) for (let k = 1; k < g.positions.length; k += 3) if (g.positions[k] < minY) minY = g.positions[k];
  const dy = -minY;
  for (const [, g] of parts) translate(g, 0, dy, 0);
  return dy;
}

// muzzle（炮口）local 坐标：barrel 前端中心 (0, AXIS_Y, 1.02) 经 tilt 后 + 落地抬升 dy
function computeMuzzle(dy) {
  const s = Math.sin(TILT), c = Math.cos(TILT);
  const y0 = AXIS_Y, z0 = 1.02;
  const y = AXIS_Y + (y0 - AXIS_Y) * c - z0 * s + dy;
  const z = (y0 - AXIS_Y) * s + z0 * c;
  return [0, y, z];
}

// ── glTF 2.0 (.glb) 序列化：多 node/mesh·POSITION+NORMAL·每 mesh 一 material(baseColorFactor+PBR) ──
function pad4(n) { return (n + 3) & ~3; }

function buildGlb(parts) {
  const buffers = []; // 累积 bin
  const bufferViews = [], accessors = [], meshes = [], nodes = [], materials = [];
  let binOffset = 0;
  const chunks = [];
  const pushView = (buf, target) => {
    const byteOffset = binOffset;
    bufferViews.push({ buffer: 0, byteOffset, byteLength: buf.length, target });
    chunks.push(buf);
    binOffset = pad4(binOffset + buf.length);
    // 填充到 4 字节
    const padded = binOffset - (byteOffset + buf.length);
    if (padded) chunks.push(Buffer.alloc(padded));
    return bufferViews.length - 1;
  };

  parts.forEach(([name, geo, color, metallic, roughness], pi) => {
    const positions = new Float32Array(geo.positions);
    const normals = new Float32Array(geo.normals);
    const maxIdx = geo.positions.length / 3;
    const useU32 = maxIdx > 65535;
    const indices = useU32 ? new Uint32Array(geo.indices) : new Uint16Array(geo.indices);

    const posB = Buffer.from(positions.buffer, positions.byteOffset, positions.byteLength);
    const nrmB = Buffer.from(normals.buffer, normals.byteOffset, normals.byteLength);
    const idxB = Buffer.from(indices.buffer, indices.byteOffset, indices.byteLength);

    let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < positions.length; i += 3) for (let k = 0; k < 3; k++) {
      const v = positions[i + k]; if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v;
    }

    const posView = pushView(posB, 34962);
    const nrmView = pushView(nrmB, 34962);
    const idxView = pushView(idxB, 34963);

    const posAcc = accessors.push({ bufferView: posView, componentType: 5126, count: positions.length / 3, type: 'VEC3', min: mn, max: mx }) - 1;
    const nrmAcc = accessors.push({ bufferView: nrmView, componentType: 5126, count: normals.length / 3, type: 'VEC3' }) - 1;
    const idxAcc = accessors.push({ bufferView: idxView, componentType: useU32 ? 5125 : 5123, count: indices.length, type: 'SCALAR' }) - 1;

    const matIdx = materials.push({
      name: `${name}_mat`,
      pbrMetallicRoughness: { baseColorFactor: [color[0], color[1], color[2], 1], metallicFactor: metallic, roughnessFactor: roughness },
    }) - 1;

    const meshIdx = meshes.push({ name, primitives: [{ attributes: { POSITION: posAcc, NORMAL: nrmAcc }, indices: idxAcc, material: matIdx }] }) - 1;
    nodes.push({ name, mesh: meshIdx });
  });

  const bin = Buffer.concat(chunks);
  const gltf = {
    asset: { version: '2.0', generator: 'apollo game-102-cannon-model-gen' },
    scene: 0,
    scenes: [{ nodes: nodes.map((_, i) => i) }],
    nodes, meshes, materials, accessors, bufferViews,
    buffers: [{ byteLength: bin.length }],
  };
  let json = Buffer.from(JSON.stringify(gltf), 'utf8');
  if (json.length % 4) json = Buffer.concat([json, Buffer.alloc(4 - (json.length % 4), 0x20)]);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8);
  const jsonChunk = Buffer.alloc(8); jsonChunk.writeUInt32LE(json.length, 0); jsonChunk.writeUInt32LE(0x4e4f534a, 4);
  const binChunk = Buffer.alloc(8); binChunk.writeUInt32LE(bin.length, 0); binChunk.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonChunk, json, binChunk, bin]);
}

mkdirSync(OUT_DIR, { recursive: true });
const dy = groundAll(PARTS);
const glb = buildGlb(PARTS);
writeFileSync(OUT, glb);

let tris = 0; for (const [, g] of PARTS) tris += g.indices.length / 3;
const muzzle = computeMuzzle(dy);
console.log(`cannon.glb 写出：${OUT}`);
console.log(`  部件: ${PARTS.map(p => p[0]).join(', ')}`);
console.log(`  三角面: ${tris} · 字节: ${glb.length}`);
console.log(`  muzzle(local): [${muzzle.map(v => v.toFixed(3)).join(', ')}]`);
console.log(`  前向轴: +Z · 原点: 底座中心/支点(y=0 落地) · 轴心高: ${AXIS_Y} · 抬头: ${TILT} rad`);
