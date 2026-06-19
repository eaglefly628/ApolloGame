// 彩色表情导入器：Twemoji 图(CC-BY 4.0) + gemoji 名表(MIT，给码点配人话名/别名/标签 → 可按概念搜)。
// 用法: node scripts/import-emoji.mjs [cap]   例: node scripts/import-emoji.mjs 600
// 为什么：game-icons 是单色；这条补"彩色、可搜、licensed"的扁平素材(cartoon.flat)。
// 仅 GitHub 可达(本环境出口策略)；raw 取 72×72 PNG，按概念名建可搜 id/tags。

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const USEFUL = new Set(['Objects', 'Symbols', 'Animals & Nature', 'Food & Drink', 'Activities', 'Smileys & Emotion']);
const CAP = Number(process.argv[2] ?? 600);
const ASSETS = 'assets', INDEX = 'assets/index.json';
const TW = (cp) => `https://raw.githubusercontent.com/twitter/twemoji/master/assets/72x72/${cp}.png`;

const cpName = (emoji) => [...emoji].map((c) => c.codePointAt(0).toString(16)).filter((h) => h !== 'fe0f').join('-');

async function gemoji() {
  if (existsSync('/tmp/gemoji.json')) return JSON.parse(readFileSync('/tmp/gemoji.json', 'utf8'));
  const r = await fetch('https://raw.githubusercontent.com/github/gemoji/master/db/emoji.json');
  return r.json();
}

const all = await gemoji();
const pool = all.filter((e) => USEFUL.has(e.category) && e.aliases?.length);
// 均匀采样到 CAP（跨类取变化，不偏头部）
const pick = [];
const step = Math.max(1, pool.length / CAP);
for (let i = 0; pick.length < CAP && Math.floor(i) < pool.length; i += step) pick.push(pool[Math.floor(i)]);

const idx = JSON.parse(readFileSync(INDEX, 'utf8'));
const byId = new Map(idx.assets.map((a) => [a.id, a]));
mkdirSync(join(ASSETS, 'emoji'), { recursive: true });

let added = 0, skipped = 0;
async function one(e) {
  const cp = cpName(e.emoji);
  const id = `emoji/${e.aliases[0]}`;
  if (byId.has(id)) return;
  let r;
  try { r = await fetch(TW(cp)); } catch { skipped++; return; }
  if (!r.ok) { skipped++; return; }
  const buf = Buffer.from(await r.arrayBuffer());
  const destRel = `emoji/${cp}.png`;
  writeFileSync(join(ASSETS, destRel), buf);
  const catWords = e.category.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  byId.set(id, {
    id, type: 'texture', description: `${e.description} (emoji)`, status: 'filled', path: destRel,
    category: 'emoji', style: 'cartoon.flat', license: 'CC BY 4.0', source: 'twemoji',
    tags: [...new Set([...e.aliases, ...(e.tags || []), e.description, ...catWords, 'emoji'].filter(Boolean))],
    spec: { format: 'png', width: 72, height: 72, transparent: true },
    provenance: { repo: 'twitter/twemoji', emoji: e.emoji, codepoints: cp },
  });
  added++;
}

const CHUNK = 20;
for (let i = 0; i < pick.length; i += CHUNK) await Promise.all(pick.slice(i, i + CHUNK).map(one));
idx.assets = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
writeFileSync(INDEX, JSON.stringify(idx, null, 2) + '\n');
console.log(`✓ emoji 并入 ${added}（跳过 ${skipped}，多为 twemoji 无此码点）→ assets/emoji/ + index（共 ${idx.assets.length} 项）`);
