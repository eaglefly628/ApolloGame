// 从 GitHub 托管的 CC0/CC-BY 资产包整包拉取 → 解压 → 落进 assets/<dest>/ + 并进 assets/index.json。
//
// 用法: node scripts/import-art-pack.mjs <pack> [limit]
//   例: node scripts/import-art-pack.mjs game-icons 80
//
// 为什么走 GitHub：本环境出口网络策略挡了大多数素材站(403)，仅 GitHub(raw/codeload)可达(实测)。
// 授权：每条记 license/source/style/provenance（CC-BY 需署名——provenance.author 留痕，不设硬门）。
// 确定性：文件排序 + 取前 limit + 稳定 id；同一包+同一 limit → 同一份并入计划，可复放、可审计。
// 零外部依赖：curl 下包、tar 解压（环境自带）；SVG 尺寸从 viewBox 现解（同 src/assets/import/sniff.ts）。

import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = join(ROOT, 'assets');
const INDEX = join(ASSETS, 'index.json');

// 包目录（数据驱动：增一个包 = 加一条；扒数据本身不写自由逻辑）。
const PACKS = {
  'game-icons': {
    repo: 'game-icons/icons',
    ref: 'master',
    tarTop: 'icons-master', // tar 解压顶层目录
    ext: '.svg',
    style: 'cartoon.flat',
    license: 'CC BY 3.0',
    source: 'game-icons',
    category: 'icon.ui',
    dest: 'gameicons',
    idPrefix: 'gameicons',
    transparent: false, // game-icons = 白图标+黑底方块（不透明）
  },
};

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

// SVG 尺寸：viewBox 优先，回退 width/height 属性（与 sniff.ts 同源逻辑）。
function svgDims(buf) {
  const tag = buf.subarray(0, 1024).toString('latin1').match(/<svg\b[^>]*>/i)?.[0] ?? '';
  const vb = tag.match(/viewBox\s*=\s*["']\s*[\d.+-]+\s+[\d.+-]+\s+([\d.+-]+)\s+([\d.+-]+)/i);
  let w = vb ? Math.round(parseFloat(vb[1])) : 0;
  let h = vb ? Math.round(parseFloat(vb[2])) : 0;
  if (!w) w = Math.round(parseFloat(tag.match(/\bwidth\s*=\s*["']?\s*([\d.]+)/i)?.[1] ?? '0'));
  if (!h) h = Math.round(parseFloat(tag.match(/\bheight\s*=\s*["']?\s*([\d.]+)/i)?.[1] ?? '0'));
  return { w, h };
}

const packKey = process.argv[2] ?? 'game-icons';
const limit = Number(process.argv[3] ?? 80);
const P = PACKS[packKey];
if (!P) {
  console.error(`未知包 "${packKey}"。可选: ${Object.keys(PACKS).join(', ')}`);
  process.exit(1);
}

const tmp = mkdtempSync(join(tmpdir(), 'artpack-'));
try {
  const tgz = join(tmp, 'pack.tgz');
  const url = `https://codeload.github.com/${P.repo}/tar.gz/refs/heads/${P.ref}`;
  console.log(`↓ 下载 ${url}`);
  execFileSync('curl', ['-sSL', '-m', '180', '-o', tgz, url]);
  execFileSync('tar', ['-xzf', tgz, '-C', tmp]);
  const srcRoot = join(tmp, P.tarTop);

  const files = walk(srcRoot)
    .filter((f) => f.toLowerCase().endsWith(P.ext))
    .map((f) => relative(srcRoot, f).split(sep).join('/'))
    .sort()
    .slice(0, limit);

  const idx = JSON.parse(readFileSync(INDEX, 'utf8'));
  const byId = new Map(idx.assets.map((a) => [a.id, a]));

  let added = 0;
  for (const rel of files) {
    const parts = rel.split('/'); // <author>/<name>.svg
    if (parts.length < 2) continue;
    const author = parts[0];
    const name = parts[parts.length - 1].replace(/\.svg$/i, '');
    const buf = readFileSync(join(srcRoot, rel));
    const { w, h } = svgDims(buf);
    if (!w || !h) continue; // 尺寸读不出 → 跳过
    const id = `${P.idPrefix}/${author}/${name}`;
    const destRel = `${P.dest}/${author}/${name}.svg`;
    const destAbs = join(ASSETS, destRel);
    mkdirSync(dirname(destAbs), { recursive: true });
    copyFileSync(join(srcRoot, rel), destAbs);
    const words = name.split(/[-_]/).filter(Boolean);
    byId.set(id, {
      id,
      type: 'texture',
      description: `${name.replace(/[-_]/g, ' ')} · ${P.source} (${author})`,
      status: 'filled',
      path: destRel,
      category: P.category,
      style: P.style,
      license: P.license,
      source: P.source,
      tags: [...new Set([...words, author, 'icon', 'flat', 'vector'])],
      spec: { format: 'svg', width: w, height: h, transparent: P.transparent ?? true },
      provenance: { repo: P.repo, ref: P.ref, author },
    });
    added++;
  }

  idx.assets = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
  writeFileSync(INDEX, JSON.stringify(idx, null, 2) + '\n');
  console.log(
    `✓ 并入 ${added} 项 (${P.style} · ${P.license}) → assets/${P.dest}/ + assets/index.json（共 ${idx.assets.length} 项）`,
  );
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
