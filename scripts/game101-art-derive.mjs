// scripts/game101-art-derive.mjs —— game101《海港绯闻》美术需求推导（台账·零孤儿）。
// 扫 buildBlueprint() 全视觉实体（含 PrefabLibrary 物品模板的 Sprite 皮肤槽）→ 产 art-ledger.json
// （每条=一个视觉实体的美术需求 + 当前占位）。M1 阶段=零真资产·全占位 → 本表即「该配哪些美术」的完整清单。
// 风格参照=Claude Design 稿 MergeBeach.dc.html（亮蓝沙滩美食风）；**美术全部原创·禁抠稿 PNG**（IP 铁律）。
// vite-node 跑（import game101 的 TS buildBlueprint）。用法：npx vite-node scripts/game101-art-derive.mjs [--gen]
import { buildBlueprint } from '../src/games/game101/blueprint.ts';
import { CHAINS } from '../src/games/game101/theme.ts';
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

// ── 清晰台账 md（按物品链分组·带中文名/等级/占位色/规格/状态）─────────────────
const esc = (s) => String(s).replace(/\|/g, '\\|');
// skinKey(item_<chain>_<lvl>) → 链/物品元信息（中文名·售价·占位色）。
const META = {};
for (const c of CHAINS) for (const lv of c.levels) META[`item_${lv.item}`] = { chainId: c.id, chainName: c.name, name: lv.name, lvl: lv.lvl, sell: lv.sell };
const rowsByKey = Object.fromEntries(ledger.rows.map((r) => [r.skinKey, r]));
const specOf = (r) => (r.kind === 'model3d' ? `scale ${r.spec.scale}·poly≤${r.spec.polyBudget}` : `${r.spec.w}×${r.spec.h}px·透明底`);
const statusCn = { 'needs-art': '⬜ 待美术', procedural: '⬜ 待美术', pending: '🟡 待生成', generated: '🟢 已生成', approved: '✅ 已审' };

const lines = [];
lines.push(`# game101《海港绯闻》· 美术台账（art ledger）`);
lines.push('');
lines.push(`> **机器真相** = \`public/games/game101/art/art-ledger.json\`（工具读此路径·append-only 保号）。本 md = 人读视图，由 \`scripts/game101-art-derive.mjs\` 自动生成，**勿手改**（改台账改脚本/JSON）。`);
lines.push('> 来源：`deriveRequirements` 扫 `buildBlueprint()` 全视觉实体（PrefabLibrary 物品模板 Sprite 皮肤槽）。');
lines.push('> 风格参照：Claude Design 稿 `MergeBeach.dc.html`（cozy 糖果感）。**美术全部原创·禁抠稿 PNG**（IP 铁律）。');
lines.push('> 消费槽：每行绑一个 `Sprite.textureKey` 皮肤槽（`ledger-audit` 零孤儿）；未填时回退 2D 色块占位。');
lines.push('');
lines.push(`## 概览`);
lines.push('');
lines.push('| 分组 | 项数 | 皮肤槽前缀 | 消费方 |');
lines.push('|---|---:|---|---|');
for (const c of CHAINS) {
  const n = c.levels.filter((lv) => rowsByKey[`item_${lv.item}`]).length;
  lines.push(`| ${esc(c.name)} | ${n} | \`item_${c.id}_*\` | merge 板物品 sprite |`);
}
lines.push(`| **合计** | **${ledger.rows.length}** | | |`);
lines.push('');
lines.push(`> 规格统一：**84×84px·透明底**（2D 俯视·棋盘格内 82% 显示）。状态：⬜ 待美术=当前全部（零真资产·待 S6 生成）。`);
lines.push('');

// 每链一节：等级从低到高。
for (const c of CHAINS) {
  const rows = c.levels.map((lv) => ({ lv, r: rowsByKey[`item_${lv.item}`] })).filter((x) => x.r);
  if (!rows.length) continue;
  lines.push(`## ${esc(c.name)}（\`${c.id}\`·${rows.length} 级）`);
  lines.push('');
  lines.push('| 编号 | 等级 | 物品 | 皮肤槽 skinKey | 占位色 | 规格 | 状态 |');
  lines.push('|---|:--:|---|---|---|---|---|');
  for (const { lv, r } of rows) {
    const tint = (r.placeholder?.current?.match(/#[0-9a-fA-F]{6}/) || ['—'])[0];
    lines.push(`| ${r.no} | L${lv.lvl} | ${esc(lv.name)}（售 ${lv.sell}）| \`${r.skinKey}\` | \`${tint}\` | ${specOf(r)} | ${statusCn[r.status] || r.status} |`);
  }
  lines.push('');
}
lines.push(`---`);
lines.push(`共 ${ledger.rows.length} 项皮肤槽。生成/替换走 art-pipeline（\`docs/playbooks/art-pipeline.md\`）：台账→风格锚→一键全量→写回→人审。`);
const md = lines.join('\n');
console.log(md);
const LEDGER_MD = join(ROOT, 'public', 'games', 'game101', 'art', 'art-ledger.md');
writeFileSync(LEDGER_MD, md + '\n');
writeFileSync(join(OUT, 'game101-art-requirements.md'), md + '\n');
