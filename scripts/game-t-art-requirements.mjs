// scripts/game-t-art-requirements.mjs —— 用美术替换管线的「需求推导」跑 game-t《墨消》→ 产出资产
// 需求台账（capability-plan §4.5 三行接入之③·照 game-q 样板·mergeLedger 保号 append-only）。
// vite-node 跑（import game-t 的 TS buildLevelBlueprint）。用法：npx vite-node scripts/game-t-art-requirements.mjs [--gen]
//   --gen：额外把需求表喂批处理（mock·风格包·无 key→占位），产物落 scratch root（不碰仓库 game-t）。
//
// 推导输入=「展示位关卡」（authoring-only·非真关）：六色全开 + 墨渍 + 冰纹瓷三态 + 砚石，
// 让全部视觉实体族（墨珠格/皮肤定义/墨渍底衬）都在场。GDD §六 的场景/吉祥物/招式字等非实体件
// 由美术平台阶段在台账上人工补行（styleset 静态枚举同款纪律）——本脚本只对蓝图可推导部分负责。
import { buildLevelBlueprint } from '../src/games/game-t/index.ts';
import { deriveRequirements, batchGenerate, mergeLedger } from './art-replace.mjs';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// 展示位关卡（authoring-only）：覆盖 kinds=6 / jelly 双层 / 瓷 1-3 hp / 砚石。
const SHOWCASE = {
  no: 0,
  name: '展示位',
  type: 'mixed',
  cols: 7,
  rows: 9,
  kinds: 6,
  moves: 10,
  goals: [{ kind: 'jelly' }, { kind: 'blocker' }],
  stars: [1, 2, 3],
  seed: 1,
  layout: {
    board: ['.......', '.......', '.......', '.......', '.......', '.......', '.......', '.......', '.......'],
    jelly: ['.......', '.......', '..12...', '.......', '.......', '.......', '.......', '.......', '.......'],
    blockers: ['.......', '.......', '.......', '..123..', '...S...', '.......', '.......', '.......', '.......'],
  },
};

const bp = buildLevelBlueprint(SHOWCASE);
// append-only（owner 07-09「ID 错位」定案）：重跑并入现台账——旧槽位保原编号/状态/prompt，新槽位顺延，消失槽位墓碑保号。
const LEDGER_FILE = join(ROOT, 'public', 'games', 'game-t', 'art', 'art-ledger.json');
const prev = existsSync(LEDGER_FILE) ? JSON.parse(readFileSync(LEDGER_FILE, 'utf8')) : null;
const ledger = mergeLedger(prev, deriveRequirements({ entities: bp.entities }, { game: 'game-t' }));
// 风格锚=引风格包 id（GDD §六「引风格包·不手抄锚文」；锚 v2 原文单一真相在 scripts/style-packs.json）。
ledger.artStyle = { ...(ledger.artStyle || {}), packId: 'apollo-toon' };

const OUT = process.env.ARTREQ_OUT || join(tmpdir(), 'game-t-artreq');
mkdirSync(dirname(LEDGER_FILE), { recursive: true });
mkdirSync(OUT, { recursive: true });
writeFileSync(LEDGER_FILE, JSON.stringify(ledger, null, 2) + '\n');

if (process.argv.includes('--gen')) {
  const r = await batchGenerate(ledger, 'apollo-toon', { root: OUT, game: 'game-t', mock: true });
  writeFileSync(LEDGER_FILE, JSON.stringify(ledger, null, 2) + '\n');
  console.error('[gen]', JSON.stringify(r.summary));
}

const esc = (s) => String(s).replace(/\|/g, '\\|');
const lines = [];
lines.push(`# game-t《墨消》资产需求表（${ledger.rows.length} 项·管线自动推导）\n`);
lines.push('> 来源：美术替换管线 deriveRequirements 扫「展示位关卡」全视觉实体。game-t 现状=程序化色块占位 → 本表=蓝图可推导的美术需求；场景/吉祥物/招式字等非实体件在美术平台按 GDD §六 补行（风格锚=apollo-toon·台账 prompt 规范见 GDD §六）。\n');
lines.push('| 编号 | 类型 | 实体/槽位 | 皮肤 key | 当前占位 | 需求描述 | 规格 |');
lines.push('|---|---|---|---|---|---|---|');
for (const r of ledger.rows) {
  const spec = r.kind === 'model3d' ? `scale ${r.spec.scale}·poly≤${r.spec.polyBudget}` : `${r.spec.w}×${r.spec.h}${r.spec.transparent ? '·透明底' : '·满幅'}`;
  lines.push(`| ${r.no} | ${r.kind} | ${esc(r.slot.entity)} | ${esc(r.skinKey ?? '—')} | ${esc(r.placeholder.current)} | ${esc(r.context)} | ${spec} |`);
}
lines.push(`\n共 ${ledger.rows.length} 项。台账 JSON（工具读此路径）：public/games/game-t/art/art-ledger.json`);
const md = lines.join('\n');
console.log(md);
writeFileSync(join(OUT, 'game-t-art-requirements.md'), md + '\n');
