// scripts/game-103-art-derive.mjs —— game-103《幸存者核心原型》美术需求推导（台账·零孤儿）。
// 扫 buildBlueprint() 全视觉实体（含 PrefabLibrary 模板的 Sprite 皮肤槽）→ 产 art-ledger.json（每条=一个
// 视觉实体的美术需求 + 当前占位几何体）。M1 阶段=零真资产·全占位色块 → 本表即「该配哪些美术」的完整清单。
// vite-node 跑（import game-103 的 TS buildBlueprint）。用法：npx vite-node scripts/game-103-art-derive.mjs [--gen]
import { buildBlueprint } from '../src/games/game-103/index.ts';
import { deriveRequirements, batchGenerate, mergeLedger } from './art-replace.mjs';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const bp = buildBlueprint();
const LEDGER_FILE = join(ROOT, 'public', 'games', 'game-103', 'art', 'art-ledger.json');
const prev = existsSync(LEDGER_FILE) ? JSON.parse(readFileSync(LEDGER_FILE, 'utf8')) : null;
// append-only 并入现台账：旧槽位保原编号/状态/prompt，新槽位顺延，消失槽位墓碑保号。
const ledger = mergeLedger(prev, deriveRequirements({ entities: bp.entities }, { game: 'game-103' }));

const OUT = process.env.ARTREQ_OUT || join(tmpdir(), 'game-103-artreq');
mkdirSync(dirname(LEDGER_FILE), { recursive: true });
mkdirSync(OUT, { recursive: true });
writeFileSync(LEDGER_FILE, JSON.stringify(ledger, null, 2) + '\n');

if (process.argv.includes('--gen')) {
  const r = await batchGenerate(ledger, 'pixel-retro', { root: OUT, game: 'game-103', mock: true });
  writeFileSync(LEDGER_FILE, JSON.stringify(ledger, null, 2) + '\n');
  console.error('[gen]', JSON.stringify(r.summary));
}

const esc = (s) => String(s).replace(/\|/g, '\\|');
const lines = [];
lines.push(`# game-103《幸存者核心原型》资产需求表（${ledger.rows.length} 项·管线自动推导）\n`);
lines.push('> 来源：美术替换管线 deriveRequirements 扫 buildBlueprint() 全视觉实体（含 PrefabLibrary 模板）。M1 现状=零真资产·全占位几何体 → 本表即完整美术需求清单。\n');
lines.push('| 编号 | 类型 | 实体/槽位 | 当前占位 | 美术需求描述 | 规格 |');
lines.push('|---|---|---|---|---|---|');
for (const r of ledger.rows) {
  const spec = r.kind === 'model3d' ? `scale ${r.spec.scale}·poly≤${r.spec.polyBudget}` : `${r.spec.w}×${r.spec.h}${r.spec.transparent ? '·透明底' : '·满幅'}`;
  lines.push(`| ${r.no} | ${r.kind} | ${esc(r.slot.entity)} | ${esc(r.placeholder.current)} | ${esc(r.context)} | ${spec} |`);
}
lines.push(`\n共 ${ledger.rows.length} 项。台账 JSON（工具读此路径）：public/games/game-103/art/art-ledger.json`);
const md = lines.join('\n');
console.log(md);
writeFileSync(join(OUT, 'game-103-art-requirements.md'), md + '\n');
