// scripts/game101-art-derive.mjs —— game101《海港绯闻》美术需求推导（台账·零孤儿）。
// 扫 buildBlueprint() 全视觉实体（含 PrefabLibrary 物品模板的 Sprite 皮肤槽）→ 产 art-ledger.json
// （每条=一个视觉实体的美术需求 + 当前占位）。M1 阶段=零真资产·全占位 → 本表即「该配哪些美术」的完整清单。
// 风格参照=Claude Design 稿 MergeBeach.dc.html（亮蓝沙滩美食风）；**美术全部原创·禁抠稿 PNG**（IP 铁律）。
// vite-node 跑（import game101 的 TS buildBlueprint）。用法：npx vite-node scripts/game101-art-derive.mjs [--gen]
import { buildBlueprint } from '../src/games/game101/blueprint.ts';
import { deriveRequirements, batchGenerate, mergeLedger } from './art-replace.mjs';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const bp = buildBlueprint();
const LEDGER_FILE = join(ROOT, 'public', 'games', 'game101', 'art', 'art-ledger.json');
const prev = existsSync(LEDGER_FILE) ? JSON.parse(readFileSync(LEDGER_FILE, 'utf8')) : null;
// append-only 并入现台账：旧槽位保原编号/状态/prompt，新槽位顺延，消失槽位墓碑保号。
const ledger = mergeLedger(prev, deriveRequirements({ entities: bp.entities }, { game: 'game101' }));

const OUT = process.env.ARTREQ_OUT || join(tmpdir(), 'game101-artreq');
mkdirSync(dirname(LEDGER_FILE), { recursive: true });
mkdirSync(OUT, { recursive: true });
writeFileSync(LEDGER_FILE, JSON.stringify(ledger, null, 2) + '\n');

if (process.argv.includes('--gen')) {
  const r = await batchGenerate(ledger, 'casual-cozy', { root: OUT, game: 'game101', mock: true });
  writeFileSync(LEDGER_FILE, JSON.stringify(ledger, null, 2) + '\n');
  console.error('[gen]', JSON.stringify(r.summary));
}

const esc = (s) => String(s).replace(/\|/g, '\\|');
const lines = [];
lines.push(`# game101《海港绯闻》资产需求表（${ledger.rows.length} 项·管线自动推导）\n`);
lines.push('> 来源：美术替换管线 deriveRequirements 扫 buildBlueprint() 全视觉实体（含 PrefabLibrary 物品模板 Sprite 皮肤槽）。');
lines.push('> 风格参照=Claude Design 稿 MergeBeach.dc.html（亮蓝沙滩美食风·cozy 糖果感）。**美术全部原创·禁抠稿 PNG**（IP 铁律）。');
lines.push('> M1 现状=零真资产·全占位（emoji/主题色）→ 本表即完整美术需求清单。\n');
lines.push('| 编号 | 类型 | 实体/槽位 | 当前占位 | 美术需求描述 | 规格 |');
lines.push('|---|---|---|---|---|---|');
for (const r of ledger.rows) {
  const spec = r.kind === 'model3d' ? `scale ${r.spec.scale}·poly≤${r.spec.polyBudget}` : `${r.spec.w}×${r.spec.h}${r.spec.transparent ? '·透明底' : '·满幅'}`;
  lines.push(`| ${r.no} | ${r.kind} | ${esc(r.slot.entity)} | ${esc(r.placeholder.current)} | ${esc(r.context)} | ${spec} |`);
}
lines.push(`\n共 ${ledger.rows.length} 项。台账 JSON（工具读此路径）：public/games/game101/art/art-ledger.json`);
const md = lines.join('\n');
console.log(md);
writeFileSync(join(OUT, 'game101-art-requirements.md'), md + '\n');
