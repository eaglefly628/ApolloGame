// scripts/game-q-art-requirements.mjs —— 用美术替换管线的「需求推导」跑 game-q（零真资产·全程序化色块
// 的反面教材）→ 产出资产需求表（每条=一个视觉实体需要的美术 + 当前占位 + 美术需求描述）。
// vite-node 跑（import game-q 的 TS buildBlueprint）。用法：npx vite-node scripts/game-q-art-requirements.mjs [--gen]
//   --gen：额外把需求表喂批处理（mock·pixel-retro 风格包·无 key→占位），产物落 scratch root（不碰仓库 game-q）。
import { buildBlueprint } from '../src/games/game-q/index.ts';
import { deriveRequirements, batchGenerate } from './art-replace.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const bp = buildBlueprint();
const ledger = deriveRequirements({ entities: bp.entities }, { game: 'game-q' });

// 台账落 scratchpad（不污染仓库 game-q 目录）
const OUT = process.env.ARTREQ_OUT || join(tmpdir(), 'game-q-artreq');
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'game-q-art-ledger.json'), JSON.stringify(ledger, null, 2) + '\n');

if (process.argv.includes('--gen')) {
  const r = await batchGenerate(ledger, 'pixel-retro', { root: OUT, game: 'game-q', mock: true });
  writeFileSync(join(OUT, 'game-q-art-ledger.json'), JSON.stringify(ledger, null, 2) + '\n');
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
lines.push(`\n共 ${ledger.rows.length} 项。台账 JSON：${join(OUT, 'game-q-art-ledger.json')}`);
const md = lines.join('\n');
console.log(md);
writeFileSync(join(OUT, 'game-q-art-requirements.md'), md + '\n');
