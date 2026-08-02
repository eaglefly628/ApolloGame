// scripts/game101-art-derive.mjs —— game101《海港绯闻》美术需求推导（台账·零孤儿）。
// 扫 buildBlueprint() 全视觉实体（含 PrefabLibrary 物品模板的 Sprite 皮肤槽）→ 产 art-ledger.json
// （每条=一个视觉实体的美术需求 + 当前占位）。M1 阶段=零真资产·全占位 → 本表即「该配哪些美术」的完整清单。
// 风格参照=Claude Design 稿 MergeBeach.dc.html（亮蓝沙滩美食风）；**美术全部原创·禁抠稿 PNG**（IP 铁律）。
// vite-node 跑（import game101 的 TS buildBlueprint）。用法：npx vite-node scripts/game101-art-derive.mjs [--gen]
import { buildBlueprint } from '../games/game101/blueprint.ts';
import { CHAINS } from '../games/game101/theme.ts';
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

// ── 逐行 prompt 精调（owner 2026-07-26 修）───────────────────────────────────────
// 问题：推导脚本用 item **id**（tool/fries/gen_fridge…）拼 prompt → "tool body"/"gen gen fridge"，
//   语义错位（tool 实为甜点·fries 实为蔬果·gen_fridge 实为米仓产粮食·gen_toolbox 实为甜点炉产甜点），
//   AI 会画成扳手/冰箱而非巧克力/米仓。**不改内部 id**（牵连 orders/board-cover/bubbles/测试），
//   改用台账支持的逐行 `prompt` 字段（dialectPrompt: row.prompt 整体覆盖 query+desc）。
// 来源：chains.json 中文 name（巧克力/玉米/米仓…）→ 各写一句英文视觉 prompt·描真实物·带风格锚。
// 风格锚统一（ui-brief §0 cozy 糖果感 · top-down 2D · isolated · transparent · 84×84）。
const STYLE_SPRITE = 'cozy candy-style casual merge game item, warm sunny harbor color palette, soft rounded forms, clean bold outline, top-down 2D view, single isolated centered subject, transparent background, soft drop shadow, polished mobile game icon';
const STYLE_GEN = 'cozy candy-style casual merge game generator machine, warm sunny harbor color palette, soft rounded forms, clean bold outline, top-down 2.5D view, single isolated centered appliance, transparent background, soft drop shadow, polished mobile game icon';
// 低→高级视觉递进（ui-brief §0.4）：越高级越精致/越亮/装饰更多。
function progressWord(lvl, maxLvl) {
  const t = maxLvl > 1 ? (lvl - 1) / (maxLvl - 1) : 0;
  if (t < 0.34) return 'simple and humble, plain presentation';
  if (t < 0.67) return 'refined and appetizing, a few decorative touches';
  return 'ornate and luxurious, glossy highlights, rich decoration, sparkles, premium plating';
}
// 各物品级 → 英文实物主体（描 chains.json 的真实中文名对应物·非 id）。
const ITEM_EN = {
  // 粮食链（稻谷→盛宴）
  food_1: 'a small bundle of golden rice stalks with raw grains',
  food_2: 'a bowl of fluffy steamed white rice',
  food_3: 'a rustic loaf of crusty bread',
  food_4: 'a golden buttery croissant',
  food_5: 'a slice of soft sponge cake',
  food_6: 'an ornate multi-layer decorated cake',
  food_7: 'a golden baked fruit pie',
  food_8: 'a tall ice-cream sundae in a glass',
  food_9: 'a lavish grand feast platter piled with food',
  // 渔获链（小鱼→海鲜锅）
  fish_1: 'a tiny fresh little fish',
  fish_2: 'a plump fresh whole fish',
  fish_3: 'a fresh pink shrimp',
  fish_4: 'a piece of nigiri sushi',
  fish_5: 'a slice of pink-swirl fish cake (kamaboko)',
  fish_6: 'a seafood bento lunch box',
  fish_7: 'crispy fried tempura shrimp',
  fish_8: 'a bowl of oden hot-pot skewers',
  fish_9: 'a steaming seafood hot pot',
  // 蔬果链（土豆→咖喱）
  fries_1: 'a plump brown potato',
  fries_2: 'a fresh orange carrot with green top',
  fries_3: 'a bowl of fresh green garden salad',
  fries_4: 'a clay pot of braised mixed vegetables',
  fries_5: 'an ear of yellow corn with husk',
  fries_6: 'a hearty bowl of vegetable stew',
  fries_7: 'a plate of vegetable curry with rice',
  // 饮品链（咖啡豆→鸡尾酒）
  coffee_1: 'a small pile of roasted coffee beans',
  coffee_2: 'a cup of hot black coffee',
  coffee_3: 'a latte with leaf latte art',
  coffee_4: 'a tall iced drink with a straw',
  coffee_5: 'a cup of bubble milk tea with pearls',
  coffee_6: 'a glass of fresh fruit juice',
  coffee_7: 'a cup of floral herbal tea',
  coffee_8: 'a colorful tropical cocktail with umbrella',
  // 甜点链（巧克力→蜜罐）
  tool_1: 'a chocolate bar',
  tool_2: 'a wrapped hard candy',
  tool_3: 'a glazed donut with sprinkles',
  tool_4: 'a frosted cupcake with a cherry',
  tool_5: 'a golden waffle with berries and syrup',
  tool_6: 'a colorful swirl lollipop',
  tool_7: 'a chocolate-chip cookie',
  tool_8: 'a honey jar with a wooden dipper',
  // 限时鲜货（🦀·到期自毁）
  timed_fresh: 'a fresh red crab, glistening limited-time seafood',
};
// 生成器（机器台面观感·非 "gen gen X"）。
const GEN_EN = {
  gen_fridge: 'a wooden rice granary storage bin filled with grain, a rice mill machine',
  gen_coffee: 'a shiny espresso coffee machine',
  gen_fishbox: 'a wooden fish-catch crate packed with fish on ice',
  gen_toolbox: 'a warm pastry baking oven with desserts, a dessert oven',
};
// 非物品/生成器的其余 sprite。
const MISC_EN = {
  board_cell: { subject: 'a rounded merge-board grid cell tile, cozy warm cream and soft blue operating surface with gentle inner shadow', style: STYLE_SPRITE },
  bubble: { subject: 'a glossy translucent bubble lock capsule sealing a hidden item inside, shiny highlight and rim light', style: STYLE_SPRITE },
  cover_sand: { subject: 'a mound of sandy debris covering a board tile, dusty cover to be cleared by digging', style: STYLE_SPRITE },
};
// item id → 所属链的 maxLvl（视觉递进用）。
const ITEM_LVL = {};
for (const c of CHAINS) for (const lv of c.levels) ITEM_LVL[lv.item] = { lvl: lv.lvl, max: c.levels.length };
function promptFor(skinKey) {
  const item = skinKey.startsWith('item_') ? skinKey.slice(5) : null;
  if (item && ITEM_EN[item]) {
    const meta = ITEM_LVL[item];
    const prog = meta ? `, ${progressWord(meta.lvl, meta.max)}` : '';
    return `${ITEM_EN[item]}${prog}, ${STYLE_SPRITE}`;
  }
  if (GEN_EN[skinKey]) return `${GEN_EN[skinKey]}, ${STYLE_GEN}`;
  if (MISC_EN[skinKey]) return `${MISC_EN[skinKey].subject}, ${MISC_EN[skinKey].style}`;
  return null;
}
for (const row of ledger.rows) {
  if (row.status === 'retired') continue;
  const p = promptFor(row.skinKey);
  if (p) row.prompt = p; // 整体覆盖机器推导的 query+desc（dialectPrompt 优先 row.prompt）
}

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
