#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  scripts/game108-spec-recursion.mjs —— 验收剧本的「递归复核」（owner 2026-08-07 立）
//
//  病：S4 的规矩是「验收剧本作者 = GD 非 PE」，靠**两个人**来防「实现错了剧本也跟着错」。
//  owner 2026-08-07 裁：**同一个人可以接受，但判定时候的逻辑需要有一个递归**。
//
//  「递归」= 剧本判完实现之后，**再用实现反过来判剧本一遍**：
//    对每一条策划条款，故意把它的实现打坏 → **必须有剧本转红**。
//    没有任何剧本会红的条款 = 该条款**没有守卫**（剧本是摆设，同一个人写的时候尤其容易这样）。
//  这是「撤修验红」纪律从代码测试推广到验收剧本层。
//
//  用法：node scripts/game108-spec-recursion.mjs
//  退出码：0 = 每条款都至少有一条剧本守着 · 1 = 有条款无人守（**剧本要补**，不是实现要改）
//  注：本脚本**改完必复原**（try/finally），且每处破坏都带锚点断言——改不到就报错，
//      防「全绿其实是根本没改到文件」（本仓踩过三次的假绿形态）。
// ═══════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BP = join(ROOT, 'games', 'game108', 'blueprint.ts');

/** 每条 = 一个策划条款 + 打坏它的最小改动 + 期望「至少一条剧本转红」。 */
const SABOTAGES = [
  {
    clause: 'R-108-01 结算在 T4（不是提交当拍）',
    find: '    settleWhenFlag: SETTLE_GATE,',
    replace: '    // 破坏：撤掉结算门',
  },
  {
    clause: 'R-108-13 伤害按出手方**自己**那条槽缩放',
    find: 'damage: { base: DMG_BASE, scaleByResource: chargeRelName(h), perSide: true, step: DMG_STEP },',
    replace: 'damage: { base: DMG_BASE },',           // 退化成固定 10
  },
  {
    clause: 'R-108-14 出过即清零',
    find: "    clearOnSettle: 'charge',",
    replace: '    // 破坏：不清零',
  },
  {
    clause: 'R-108-12 克制关系（石>剪>布>石）',
    find: "beats: { rock: ['scissors'], paper: ['rock'], scissors: ['paper'] },",
    replace: "beats: { rock: ['paper'], paper: ['scissors'], scissors: ['rock'] },",  // 整个反过来
  },
  {
    clause: 'R-108-15 平局双方不掉血',
    find: 'tie: { selfDamage: TIE_SELF_DAMAGE },',
    replace: 'tie: { selfDamage: 10 },',
  },
  {
    clause: 'R-108-10 蓄力封顶 3',
    find: 'Resource: { id: chargeRes(side, h), current: 0, min: 0, max: CHARGE_CAP },',
    replace: 'Resource: { id: chargeRes(side, h), current: 0, min: 0, max: 99 },',
  },
];

const runAcceptance = () => spawnSync('npx', ['vite-node', 'scripts/acceptance-run.mjs', '--', '--game', 'game108'],
  { cwd: ROOT, encoding: 'utf8', timeout: 300_000 });

const original = readFileSync(BP, 'utf8');
const results = [];

try {
  // 前提：未破坏时必须全绿，否则下面「变红」这件事不成立。
  const base = runAcceptance();
  if ((base.status ?? 1) !== 0) {
    console.error('✗ 前提不成立：未破坏时验收剧本就没全绿，先修那个再跑递归复核\n' + (base.stdout || ''));
    process.exit(1);
  }
  console.log('前提 ✓ 未破坏时 5/5 全绿\n══ 递归复核：逐条款打坏，看有没有剧本转红 ══\n');

  for (const s of SABOTAGES) {
    if (!original.includes(s.find)) {                 // 锚点断言：改不到就是假绿
      console.error(`✗ 锚点未命中（脚本过期，不是条款没守卫）：${s.clause}\n   找不到：${s.find}`);
      process.exit(1);
    }
    writeFileSync(BP, original.replace(s.find, s.replace));
    const r = runAcceptance();
    const red = (r.status ?? 1) !== 0;
    const failing = (r.stdout || '').split('\n').filter((l) => l.startsWith('FAIL')).map((l) => l.slice(5, 40).trim());
    results.push({ clause: s.clause, guarded: red, by: failing });
    console.log(`${red ? '  ✓' : '  ✗'} ${s.clause}`);
    console.log(`      ${red ? '被这些剧本抓住：' + failing.join(' / ') : '**无人守卫**——打坏了所有剧本照样全绿，该条款的剧本要补'}`);
  }
} finally {
  writeFileSync(BP, original);                        // 必复原
  if (readFileSync(BP, 'utf8') !== original) { console.error('✗ 复原失败！手动检查 ' + BP); process.exit(1); }
}

const naked = results.filter((r) => !r.guarded);
console.log(`\n══ 结论：${results.length} 条条款 · ${results.length - naked.length} 条有剧本守着 · ${naked.length} 条裸奔 ══`);
if (naked.length) console.log('裸奔的条款：\n' + naked.map((r) => '  · ' + r.clause).join('\n'));
process.exit(naked.length ? 1 : 0);
