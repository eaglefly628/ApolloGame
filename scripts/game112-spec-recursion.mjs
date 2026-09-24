#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  scripts/game112-spec-recursion.mjs —— 验收剧本的「递归复核」（docs/playbooks/testing.md·owner 2026-08-07 立）
//
//  「递归」= 剧本判完实现之后，**再用实现反过来判剧本一遍**：
//    对每一条策划条款，故意把它的实现打坏 → **必须有剧本转红**。
//    没有任何剧本会红的条款 = 该条款**没有守卫**（剧本是摆设；同一个人写剧本时尤其容易贴着实现写）。
//  game112 的剧本作者 = GD-112、实现 = PE-112，同一个 session——正是手册点名最该做递归的形态。
//
//  用法：node scripts/game112-spec-recursion.mjs
//  退出码：0 = 每条款都至少有一条剧本守着 · 1 = 有条款无人守（**剧本要补**，不是实现要改）
//  注：本脚本**改完必复原**（try/finally + 早退先复原），每处破坏都带锚点断言——
//      锚点找不到就报「脚本过期」而不是静默判绿（本仓踩过三次的假绿形态）。
//      照 game108 先例改在本工作树（同一文件·毫秒级复原）；要并行验证请去临时 clone。
// ═══════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILES = {
  data: join(ROOT, 'games', 'game112', 'world-data.ts'),
  bp: join(ROOT, 'games', 'game112', 'blueprint.ts'),
};

/** 每条 = 一个策划条款 + 打坏它的最小改动（file/find/replace）+ 期望「至少一条剧本转红」。 */
const SABOTAGES = [
  {
    clause: 'GDD §4.1/§6.2 轻声呼唤 → 兴致 +6（陪伴动作一拍反馈）',
    file: 'data',
    find: "{ res: relId('mood', ACTIVE_CAT), amount: 6 }",
    replace: "{ res: relId('mood', ACTIVE_CAT), amount: 0 }",
  },
  {
    clause: 'GDD §6.2 心光只靠陪伴长（陪它坐坐 → 心光 +2）',
    file: 'data',
    find: "{ res: relId('heartlight', ACTIVE_CAT), amount: 2 }",
    replace: "{ res: relId('heartlight', ACTIVE_CAT), amount: 0 }",
  },
  {
    clause: 'GDD §6.2 兴致当次自然变化（每 40 拍 −1）',
    file: 'data',
    find: 'export const MOOD_DRIFT = { amountPerTick: -1, period: 40 } as const;',
    replace: 'export const MOOD_DRIFT = { amountPerTick: 0, period: 40 } as const;',
  },
  {
    clause: 'GDD §5.4/§6.2 长期量（亲近/心光）不因空等下降——只有兴致挂下行',
    file: 'bp',
    find: "      ...(r.key === 'mood'",
    replace: "      ...(r.key !== 'ease'",              // 破坏：亲近/心光也挂上衰减
  },
  {
    clause: 'GDD §12.4 杂货铺按价扣星砂；不够 = 整单不动',
    file: 'bp',
    find: 'costs: [{ id: STARDUST, amount: it.price }]',
    replace: 'costs: []',                             // 破坏：白拿
  },
  {
    clause: 'GDD §12.4 成交即拥有（own.<item> 置旗）',
    file: 'bp',
    find: ', grantsFlag: ownFlag(it.id) }',
    replace: ' }',
  },
  {
    clause: 'menu-flow §10 放到馆里 → 物件回到共同空间（placed.<item>）',
    file: 'bp',
    find: "kind: 'set-flag', targetId: placedFlag(it.id), value: true",
    replace: "kind: 'set-flag', targetId: placedFlag(it.id), value: false",
  },
  {
    clause: 'GDD §11 心光到阈值那一拍解锁章节（edge）',
    file: 'bp',
    find: "cmp: 'gte', value: c.unlockHeartlight",
    replace: "cmp: 'gte', value: 9999",
  },
  {
    clause: 'GDD §3.4 回馆恰好展开一个离线小事件（WeightedSpawn 按档权重表）',
    file: 'bp',
    find: '.filter((x) => x.weight > 0);',
    replace: '.filter(() => false);',                // 破坏：权重表空 → 什么都不展开
  },
  {
    clause: 'menu-flow §3 看过即回收（ack → destroy-tagged 掩码）',
    file: 'bp',
    find: "kind: 'destroy-tagged', targetId: 'offline-props', value: OFFLINE_TAG",
    replace: "kind: 'destroy-tagged', targetId: 'offline-props', value: OFFLINE_TAG << 4",
  },
  {
    clause: 'GDD §6.2 兴致当次临时·重开回初值（不进档）',
    file: 'bp',
    find: 'const current = r.persist ? (s.relations[id] ?? r.start) : r.start;',
    replace: 'const current = s.relations[id] ?? r.start;',
  },
];

const runAcceptance = () => spawnSync('npx', ['vite-node', 'scripts/acceptance-run.mjs', '--', '--game', 'game112'],
  { cwd: ROOT, encoding: 'utf8', timeout: 300_000, env: { ...process.env, ZEROCRAFT_ACCEPTANCE_CLI: '1' } });

const original = Object.fromEntries(Object.entries(FILES).map(([k, p]) => [k, readFileSync(p, 'utf8')]));
const restore = () => { for (const [k, p] of Object.entries(FILES)) writeFileSync(p, original[k]); };
const results = [];

try {
  const base = runAcceptance();
  if ((base.status ?? 1) !== 0) {
    restore();
    console.error('✗ 前提不成立：未破坏时验收剧本就没全绿，先修那个再跑递归复核\n' + (base.stdout || base.stderr || ''));
    process.exit(1);
  }
  console.log('前提 ✓ 未破坏时验收剧本全绿\n══ 递归复核：逐条款打坏，看有没有剧本转红 ══\n');

  for (const s of SABOTAGES) {
    const src = original[s.file];
    if (!src.includes(s.find)) {
      restore();
      console.error(`✗ 锚点未命中（脚本过期，不是条款没守卫）：${s.clause}\n   找不到：${s.find}\n（已复原）`);
      process.exit(1);
    }
    writeFileSync(FILES[s.file], src.replace(s.find, s.replace));
    const r = runAcceptance();
    restore();
    const red = (r.status ?? 1) !== 0;
    const failing = (r.stdout || '').split('\n').filter((l) => /^(FAIL|✗)/.test(l))
      .map((l) => l.replace(/^(FAIL|✗)\s*/, '').split('  [')[0].slice(0, 48).trim());
    results.push({ clause: s.clause, guarded: red, by: failing });
    console.log(`${red ? '  ✓' : '  ✗'} ${s.clause}`);
    console.log(`      ${red ? '被这些剧本抓住：' + (failing.join(' / ') || '(退出码非零)') : '**无人守卫**——打坏了所有剧本照样全绿，该条款的剧本要补'}`);
  }
} finally {
  restore();
  for (const [k, p] of Object.entries(FILES)) {
    if (readFileSync(p, 'utf8') !== original[k]) { console.error('✗ 复原失败！手动检查 ' + p); process.exit(1); }
  }
}

const naked = results.filter((r) => !r.guarded);
console.log(`\n══ 结论：${results.length} 条条款 · ${results.length - naked.length} 条有剧本守着 · ${naked.length} 条裸奔 ══`);
if (naked.length) console.log('裸奔的条款：\n' + naked.map((r) => '  · ' + r.clause).join('\n'));
process.exit(naked.length ? 1 : 0);
