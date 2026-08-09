// scripts/game108-art-requirements.mjs —— game108《拳律》美术需求台账推导（capability-plan §4.5 声明的那个脚本）。
//
// 为什么要有这么个脚本、而不是手写一份 JSON：
//   台账是**美术线的输入**（一键全量照着它逐行拼 prompt），它必须跟着游戏一起长。
//   手写的台账会在「加了一屏 / 换了个槽」之后悄悄过期，而过期的台账不会报错——
//   它只是让那一行永远生不出图，或者生出来没人消费（孤儿行·红线明令禁止）。
//   推导脚本把「有哪些槽」这件事从记忆里搬到代码里：改了消费点，重跑一次就对上了。
//
// 用法：npx vite-node scripts/game108-art-requirements.mjs
// append-only：走 `mergeLedger` 并入现台账——保编号 / 状态 / prompt / history（重跑不挪号、不覆盖已填）。
//
// ⚠ **只列有真实消费槽的行**（REQ-ART-可消费槽铁律）。想加一行先问：
//    「生成出来之后，游戏里哪一句代码会把它读上画面？」答不上来就是孤儿行，宁可不列。
import { mergeLedger } from './art-replace.mjs';
import { ART_SLOTS, skinKeyOf } from '../games/game108/art-slots.ts';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'games', 'game108', 'art');
const OUT = join(OUT_DIR, 'art-ledger.json');

/**
 * **风格锚**（美术平台的「🎯 风格锚」那一栏·S6 板上的「锚」）。
 * 不是随手挑一个包：本作已经有 owner 亲自给的设计定稿（`design_handoff_rule_of_three_battle`），
 * 三张手型图标就是从那份稿子里切出来的。锚要**咬住那份稿子**，否则后生成的图会和已有的三张打架。
 */
const ART_STYLE = {
  packId: 'cartoon-thick',                     // 厚描边卡通——与定稿的粗墨描边同一路
  stylePrompt: [
    'rule-of-three cartoon duel style',
    'thick ink outline, flat cel shading, warm cream paper ground',
    'saturated candy palette: gold #f0b429, crimson #d9534f, jade #4f9d69',
    'chunky rounded forms, hand-drawn feel, no gradients on outlines',
    'matches the shipped hand icons in design_handoff_rule_of_three_battle',
  ].join(', '),
  note: 'owner 2026-08-07 设计定稿随件交付；锚咬住定稿以免新生成的图与已有三张手型图标打架',
};

// 素材清单**不在这里维护** —— 单一真相是 `games/game108/art-slots.ts`，
// 屏那一层按同一张表取皮（`pickSkin`）。两边同源 = 「加了可换面却忘了记账」会被点名测试逮住。
const rows = ART_SLOTS.map((a) => ({
  skinKey: skinKeyOf(a.key),
  desc: a.desc,
  kind: a.key.startsWith('scene/') ? 'background' : a.key.startsWith('gesture-') || a.key.startsWith('arm-') ? 'sprite' : 'ui-icon',
  // ⚠ **逐素材一个 entity**：`mergeLedger` 按**槽**认行身份（`rowIdentity = slotKey(row.slot)`），
  //   多种素材共用一个槽形状会在重跑时**塌成一行**（实测：三只手全被并到 art-03）。
  //   手册去重口径是「一行 = 一种素材」——所以槽要写得和素材一样细。已开单报工具线（REQ-ARTTOOL-02）。
  slot: { entity: a.entity, component: a.key.startsWith('scene/') ? 'sceneBgSkin' : 'Image', field: a.key.startsWith('scene/') ? 'imageUrl' : 'src' },
  query: a.key.replace(/-/g, ' '),
  spec: { w: a.w, h: a.h, transparent: a.transparent },
  context: a.context,
  status: 'needs-art',
}));

const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : null;
const fresh = { slug: 'game108', mode: 'compiled', artStyle: ART_STYLE, rows };
// mergeLedger 保编号与已填状态；artStyle 以本脚本为准（锚是设计决策，跟着脚本走）。
const merged = { ...mergeLedger(prev, fresh), artStyle: ART_STYLE };
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, JSON.stringify(merged, null, 1) + '\n');

const live = merged.rows.filter((r) => r.status !== 'retired');
console.log(`game108 台账：${live.length} 行 · 锚 ${merged.artStyle?.packId}`);
for (const r of live) console.log(`  ${r.no} ${r.skinKey.padEnd(24)} ${r.status.padEnd(10)} ${r.kind}`);
