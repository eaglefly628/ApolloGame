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
import { HANDS } from '../games/game108/theme.ts';
import { SCENE_BG_SKIN } from '../games/game108/game108.ts';
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

const HAND_DESC = {
  rock: 'front-facing rock hand icon, cartoon, thick ink outline, cream skin, transparent background',
  paper: 'front-facing paper hand icon, cartoon, thick ink outline, cream skin, transparent background',
  scissors: 'front-facing scissors hand icon, cartoon, thick ink outline, cream skin, transparent background',
};
const HAND_SPEC = {
  rock: { w: 195, h: 236 },
  paper: { w: 218, h: 245 },
  scissors: { w: 210, h: 245 },
};

const rows = [
  // ── ① 三只手型图标（§4.5 皮肤槽③ 的载体·三处复用）───────────────────────────
  //    消费点：`games/game108/hand-icons.ts` → 招式卡 / 我方蓄力槽 / 对手蓄力条。
  ...HANDS.map((h) => ({
    skinKey: `108/hand-icon-${h}`,
    desc: HAND_DESC[h],
    kind: 'ui-icon',
    // ⚠ **逐手一个 entity**，不是三行共用 `duel-screen`：`mergeLedger` 按**槽**认行身份
    //   （`rowIdentity = slotKey(row.slot)`），三行共用一个槽形状会在重跑时**塌成一行**
    //   （实测：三只手全被并到 art-03）。手册说的去重口径是「一行 = 一种素材」，
    //   而这三只是**三种素材**——所以槽要写得和素材一样细。已同步开单报工具线。
    slot: { entity: `duel-screen:hand-${h}`, component: 'Image', field: 'src' },
    query: `hand icon ${h}`,
    spec: { ...HAND_SPEC[h], displayW: 96, displayH: 104, transparent: true },
    context: `招式卡 96×104 / 我方蓄力槽 56×62 / 对手蓄力条 28×34 三处复用的「${h}」手型图标`,
    status: 'needs-art',
  })),
  // ── ② 舞台背景（§4.5 皮肤槽⑥·REQ-ART ② 的可换背景槽）────────────────────────
  //    消费点：`games/game108/game108.ts` 的 `mountHost({ sceneBgSkin })`。
  //    **有图叠图、无图纯回退程序化底**——所以这一行今天是 needs-art 也不会让画面空掉。
  {
    skinKey: SCENE_BG_SKIN,
    desc: 'dim underground fist-dueling hall, warm lantern pools, deep shadow, out-of-focus crowd silhouettes, painterly cartoon, no text',
    kind: 'background',
    slot: { entity: 'host-scene', component: 'sceneBgSkin', field: 'imageUrl' },
    query: 'underground duel hall background',
    spec: { w: 1920, h: 1080, transparent: false },
    context: '对局舞台底（1920×1080·`mountHost` 背景皮肤槽·无图时回退纯色 #171310）',
    status: 'needs-art',
  },
];

const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : null;
const fresh = { slug: 'game108', mode: 'compiled', artStyle: ART_STYLE, rows };
// mergeLedger 保编号与已填状态；artStyle 以本脚本为准（锚是设计决策，跟着脚本走）。
const merged = { ...mergeLedger(prev, fresh), artStyle: ART_STYLE };
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, JSON.stringify(merged, null, 1) + '\n');

const live = merged.rows.filter((r) => r.status !== 'retired');
console.log(`game108 台账：${live.length} 行 · 锚 ${merged.artStyle?.packId}`);
for (const r of live) console.log(`  ${r.no} ${r.skinKey.padEnd(24)} ${r.status.padEnd(10)} ${r.kind}`);
