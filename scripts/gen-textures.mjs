// 生成 game-z 程序化真实贴图（木板 albedo/法线 + 符文自发光）→ public/games/game-z/art/textures/*.png（游戏本地美术目录·REQ-3D-货架接入）。
// 确定性（hash 噪声·无随机）。用无头 canvas 画 → toDataURL(png) → 写文件。自产美术·无许可/网络依赖。
import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import process from 'node:process';
const groot = execSync('npm root -g').toString().trim();
const { chromium } = createRequire(`${groot}/x.js`)('playwright');
const PORT = 5592;
const server = spawn('./node_modules/.bin/vite', ['preview', '--port', String(PORT), '--strictPort'], { stdio: 'inherit' });
const cleanup = () => { try { server.kill('SIGKILL'); } catch { /* noop */ } };
process.on('exit', cleanup);
try {
  await new Promise((r) => setTimeout(r, 4000));
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load', timeout: 30000 });
  const out = await page.evaluate(() => {
    const N = 256, PLANK = 64;
    const hash = (x, y) => { let h = ((x * 374761393) ^ (y * 668265263)) >>> 0; h = (h ^ (h >>> 13)) * 1274126177 >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    const val = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi; const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1); return a + (b - a) * u + (c - a + (a - b - c + d) * u) * v; };
    // 高度场：木板（每 PLANK 一条·板间凹槽）+ 沿板长的木纹
    const H = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const inPlank = (y % PLANK) / PLANK; // 0..1 板内位置
      const groove = Math.min(inPlank, 1 - inPlank) < 0.06 ? -0.5 : 0; // 板间凹槽
      const grain = val(x / 8, y / 40) * 0.25 + val(x / 3, y / 12) * 0.1; // 木纹
      H[y * N + x] = 0.6 + groove + grain;
    }
    // albedo：木色 + 纹理明暗（sRGB）
    const cvA = document.createElement('canvas'); cvA.width = cvA.height = N; const a = cvA.getContext('2d');
    const idA = a.createImageData(N, N);
    for (let i = 0; i < N * N; i++) { const h = H[i]; const br = 0.55 + (h - 0.6) * 0.9; idA.data[i * 4] = Math.min(255, 150 * br); idA.data[i * 4 + 1] = Math.min(255, 95 * br); idA.data[i * 4 + 2] = Math.min(255, 55 * br); idA.data[i * 4 + 3] = 255; }
    a.putImageData(idA, 0, 0);
    // normal：中央差分 → 编码（线性）
    const cvN = document.createElement('canvas'); cvN.width = cvN.height = N; const n = cvN.getContext('2d');
    const idN = n.createImageData(N, N); const S = 4;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const l = H[y * N + (x + N - 1) % N], r = H[y * N + (x + 1) % N], u = H[((y + N - 1) % N) * N + x], d = H[((y + 1) % N) * N + x];
      const dx = (r - l) * S, dy = (d - u) * S, len = Math.hypot(dx, dy, 1);
      const o = (y * N + x) * 4; idN.data[o] = (-dx / len * 0.5 + 0.5) * 255; idN.data[o + 1] = (-dy / len * 0.5 + 0.5) * 255; idN.data[o + 2] = (1 / len * 0.5 + 0.5) * 255; idN.data[o + 3] = 255;
    }
    n.putImageData(idN, 0, 0);
    // emissive：暗底 + 发光符文网格（sRGB·REQ-3D ④ emissiveMap 展示·确定性 hash 图案）。
    const cvE = document.createElement('canvas'); cvE.width = cvE.height = N; const e = cvE.getContext('2d');
    const idE = e.createImageData(N, N); const CELL = 32;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const cx = (x % CELL) - CELL / 2, cy = (y % CELL) - CELL / 2;
      const gx = Math.floor(x / CELL), gy = Math.floor(y / CELL);
      const on = hash(gx, gy) > 0.45; // 约半数格发光（确定性）
      const d = Math.hypot(cx, cy) / (CELL / 2);
      const glow = on ? Math.max(0, 1 - d * d) : 0; // 径向发光衰减
      const line = (Math.abs(cx) < 1.5 || Math.abs(cy) < 1.5) ? 0.12 : 0; // 暗网格线
      const v = Math.min(1, glow + line);
      const o = (y * N + x) * 4;
      idE.data[o] = Math.min(255, v * 90); idE.data[o + 1] = Math.min(255, v * 230); idE.data[o + 2] = Math.min(255, v * 255); idE.data[o + 3] = 255; // 青蓝发光
    }
    e.putImageData(idE, 0, 0);
    return { albedo: cvA.toDataURL('image/png'), normal: cvN.toDataURL('image/png'), emissive: cvE.toDataURL('image/png') };
  });
  const outDir = 'public/games/game-z/art/textures'; // game-z 本地美术目录（REQ-3D-货架接入·停全局 public/textures 散落）
  mkdirSync(outDir, { recursive: true });
  writeFileSync(`${outDir}/plank_albedo.png`, Buffer.from(out.albedo.split(',')[1], 'base64'));
  writeFileSync(`${outDir}/plank_normal.png`, Buffer.from(out.normal.split(',')[1], 'base64'));
  writeFileSync(`${outDir}/rune_emissive.png`, Buffer.from(out.emissive.split(',')[1], 'base64'));
  console.log(`wrote ${outDir}/{plank_albedo,plank_normal,rune_emissive}.png`);
  await browser.close();
} finally { cleanup(); }
process.exit(0);
