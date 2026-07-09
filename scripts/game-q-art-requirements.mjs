// scripts/game-q-art-requirements.mjs —— 用美术替换管线的「需求推导」跑 game-q（零真资产·全程序化色块
// 的反面教材）→ 产出资产需求表（每条=一个视觉实体需要的美术 + 当前占位 + 美术需求描述）。
// vite-node 跑（import game-q 的 TS buildBlueprint）。用法：npx vite-node scripts/game-q-art-requirements.mjs [--gen]
//   --gen：额外把需求表喂批处理（mock·pixel-retro 风格包·无 key→占位），产物落 scratch root（不碰仓库 game-q）。
import { buildBlueprint } from '../src/games/game-q/index.ts';
import { deriveRequirements, batchGenerate, mergeLedger } from './art-replace.mjs';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const bp = buildBlueprint();
// append-only（owner 07-09「ID 错位」定案）：重跑并入现台账——旧槽位保原编号/状态/prompt，新槽位顺延，消失槽位墓碑保号。
const PREV_FILE = join(ROOT, 'public', 'games', 'game-q', 'art', 'art-ledger.json');
const prev = existsSync(PREV_FILE) ? JSON.parse(readFileSync(PREV_FILE, 'utf8')) : null;
const ledger = mergeLedger(prev, deriveRequirements({ entities: bp.entities }, { game: 'game-q' }));

// 台账落**游戏正规美术目录**（美术替换工作流 §三：每游戏一份 art-ledger.json·`public/games/<game>/art/`·
// 控制台美术台账工具读此路径 GET /api/art/ledger?slug=game-q）。md 预览仍落 scratchpad（人读·非工具消费）。
const LEDGER_FILE = join(ROOT, 'public', 'games', 'game-q', 'art', 'art-ledger.json');
const OUT = process.env.ARTREQ_OUT || join(tmpdir(), 'game-q-artreq');
mkdirSync(dirname(LEDGER_FILE), { recursive: true });
mkdirSync(OUT, { recursive: true });
writeFileSync(LEDGER_FILE, JSON.stringify(ledger, null, 2) + '\n');

if (process.argv.includes('--gen')) {
  const r = await batchGenerate(ledger, 'pixel-retro', { root: OUT, game: 'game-q', mock: true });
  writeFileSync(LEDGER_FILE, JSON.stringify(ledger, null, 2) + '\n');
  console.error('[gen]', JSON.stringify(r.summary));
}

const esc = (s) => String(s).replace(/\|/g, '\\|');
const lines = [];
lines.push(`# game-q《Neon Siege》资产需求表（${ledger.rows.length} 项·管线自动推导）\n`);
lines.push('> 来源：美术替换管线 deriveRequirements 扫 buildBlueprint() 全视觉实体（含 PrefabLibrary 模板）。game-q 现状=零真资产·全程序化色块/3D 图元 → 本表即「该配哪些美术」的完整需求清单。\n');
lines.push('| 编号 | 类型 | 实体/槽位 | 当前占位 | 美术需求描述 | 规格 |');
lines.push('|---|---|---|---|---|---|');
for (const r of ledger.rows) {
  const spec = r.kind === 'model3d' ? `scale ${r.spec.scale}·poly≤${r.spec.polyBudget}` : `${r.spec.w}×${r.spec.h}${r.spec.transparent ? '·透明底' : '·满幅'}`;
  lines.push(`| ${r.no} | ${r.kind} | ${esc(r.slot.entity)} | ${esc(r.placeholder.current)} | ${esc(r.context)} | ${spec} |`);
}
lines.push(`\n共 ${ledger.rows.length} 项。台账 JSON（工具读此路径）：public/games/game-q/art/art-ledger.json`);
const md = lines.join('\n');
console.log(md);
writeFileSync(join(OUT, 'game-q-art-requirements.md'), md + '\n');
