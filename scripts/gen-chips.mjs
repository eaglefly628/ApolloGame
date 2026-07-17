// gen-chips —— 程序化自产 2D 扑克筹码（德州等卡牌游戏用）。确定性·零网络·CC0 自产。
// GitHub 无宽松授权的现成筹码源 → 自产标准赌场面额筹码 SVG（圆盘 + 边缘点 + 内环 + 面额）。
// 落 assets/chips/*.svg + 登记 assets/index.json（category:chip·CC0·source:apollo-procedural）。幂等。
// 用法：node scripts/gen-chips.mjs [--dry]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// 标准赌场面额配色（body 主色·edge 边缘点色·text 面额字色·ring 内环色）。
const DENOMS = [
  { v: 1, name: 'white', body: '#f2f2f0', edge: '#c62828', text: '#222222', ring: '#d8d8d4' },
  { v: 5, name: 'red', body: '#c62828', edge: '#ffffff', text: '#ffffff', ring: '#9e1f1f' },
  { v: 10, name: 'blue', body: '#2b5fcc', edge: '#ffffff', text: '#ffffff', ring: '#1f47a0' },
  { v: 25, name: 'green', body: '#2e9d52', edge: '#ffffff', text: '#ffffff', ring: '#227a3f' },
  { v: 50, name: 'orange', body: '#e0842b', edge: '#1a1a1a', text: '#1a1a1a', ring: '#b8681f' },
  { v: 100, name: 'black', body: '#1e1e1e', edge: '#d4bd8a', text: '#d4bd8a', ring: '#3a3a3a' },
  { v: 500, name: 'purple', body: '#7a2bcc', edge: '#ffffff', text: '#ffffff', ring: '#5e1fa0' },
  { v: 1000, name: 'yellow', body: '#e8c72b', edge: '#1a1a1a', text: '#1a1a1a', ring: '#c0a41f' },
  { v: 5000, name: 'gray', body: '#9aa0a6', edge: '#7a2bcc', text: '#222222', ring: '#7d8288' },
];

// 一枚筹码 SVG：外盘 + 6 个边缘点（dash·contrasting）+ 虚线内环 + 内面盘 + 面额字。
function chipSvg(d) {
  const cx = 50, cy = 50, R = 47;
  const spots = [];
  const N = 6;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 - Math.PI / 2;
    // 边缘弧点：一段粗弧（用 rect 旋转近似）
    const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
    const deg = (a * 180) / Math.PI + 90;
    spots.push(`<rect x="${(x - 7).toFixed(1)}" y="${(y - 5).toFixed(1)}" width="14" height="10" rx="2" fill="${d.edge}" transform="rotate(${deg.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`);
  }
  const fs = d.v >= 1000 ? 17 : 21;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <circle cx="${cx}" cy="${cy}" r="${R}" fill="${d.body}" stroke="${d.ring}" stroke-width="2"/>
  <g>${spots.join('')}</g>
  <circle cx="${cx}" cy="${cy}" r="34" fill="none" stroke="${d.edge}" stroke-width="2.5" stroke-dasharray="6 5"/>
  <circle cx="${cx}" cy="${cy}" r="29" fill="${d.body}" stroke="${d.ring}" stroke-width="1.5"/>
  <text x="${cx}" y="${cy + fs / 3}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${fs}" font-weight="700" fill="${d.text}">${d.v}</text>
</svg>`;
}

function main() {
  const dry = process.argv.includes('--dry');
  const idxFile = join(ROOT, 'assets', 'index.json');
  const idx = JSON.parse(readFileSync(idxFile, 'utf8'));
  const have = new Set(idx.assets.map((a) => a.id));
  const at = new Date().toISOString().slice(0, 10);
  const dir = join(ROOT, 'assets', 'chips');
  if (!dry) mkdirSync(dir, { recursive: true });
  let n = 0;
  for (const d of DENOMS) {
    const id = `chip/${d.v}-${d.name}`;
    const destRel = `chips/${d.v}-${d.name}.svg`;
    if (dry) { console.log(`  + ${id}`); continue; }
    writeFileSync(join(ROOT, 'assets', destRel), chipSvg(d));
    if (have.has(id)) continue;
    idx.assets.push({
      id, type: 'texture', description: `poker chip ${d.v} (${d.name})`, status: 'filled',
      path: destRel, category: 'chip', style: 'flat', license: 'CC0 (自产)', source: 'apollo-procedural',
      tags: ['poker-chip', 'chip', 'casino', d.name, String(d.v)],
      spec: { format: 'svg', usage: 'sprite' },
      provenance: { generator: 'gen-chips', denom: d.v, color: d.name, date: at },
    });
    have.add(id); n++;
  }
  if (dry) { console.log(`  …计划 ${DENOMS.length} 枚`); return; }
  writeFileSync(idxFile, JSON.stringify(idx, null, 2) + '\n');
  console.log(`✓ 自产 ${DENOMS.length} 枚筹码 → assets/chips/ · 索引 +${n}（${idx.assets.length} 条）`);
}

main();
