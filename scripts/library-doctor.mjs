#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  scripts/library-doctor.mjs —— 全库装载体检（owner 07-11「把加载失败的错误都 log 出来」）
//
//  用法：npx vite-node scripts/library-doctor.mjs
//
//  扫两处：library/<slug>/（AI 卡带）+ public/games/<slug>/（内置数据游戏），每盘走与
//  运行器/落盘门**同一套**检查（JSON → parseManifest → 真引擎 load + 空跑 2 tick →
//  有 logic.ts 的 TS 例外卡带再合体装载）——逐盘 try 住，一盘的错不挡下一盘。
//  stdout=机读 JSON（endpoint 消费）；stderr=人读逐行（终端直接看）。
//  体检只读不写：它是诊断报告，不是门（门在 manifest-check / cart-logic-check）。
// ═══════════════════════════════════════════════════════════════

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
import { parseManifestDetailed } from '../src/assembly/manifest.ts';
import { Engine } from '../src/runtime/engine.ts';

const ROOT = resolve(process.cwd());

function scanDir(base, where) {
  const dir = resolve(ROOT, base);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => /^[a-z0-9][a-z0-9-]*$/.test(n))
    .filter((n) => statSync(join(dir, n)).isDirectory())
    .filter((n) => existsSync(join(dir, n, 'manifest.json')))
    .map((n) => ({ slug: n, where, dir: join(dir, n) }));
}

async function checkOne(cart) {
  const warnings = [];
  let raw;
  try {
    raw = readFileSync(join(cart.dir, 'manifest.json'), 'utf8');
  } catch (e) {
    return { ...base(cart), ok: false, stage: 'read', error: `manifest.json 读不出来: ${msg(e)}` };
  }
  let parsedJson;
  try {
    parsedJson = JSON.parse(raw);
  } catch (e) {
    return { ...base(cart), ok: false, stage: 'json', error: `JSON 解析失败: ${msg(e)}` };
  }
  let result;
  try {
    result = parseManifestDetailed(parsedJson);
    warnings.push(...result.warnings);
  } catch (e) {
    return { ...base(cart), ok: false, stage: 'parse', error: msg(e), warnings };
  }
  let bp = result.blueprint;
  const logicPath = join(cart.dir, 'logic.ts');
  if (existsSync(logicPath)) {
    try {
      const mod = await import(pathToFileURL(logicPath).href);
      const cap = mod.cartCapability;
      if (!cap || typeof cap.id !== 'string' || !Array.isArray(cap.systems) || cap.systems.length === 0) {
        throw new Error('logic.ts 未导出合契约的 cartCapability（export const cartCapability = defineCapability({...})）');
      }
      bp = { capabilities: [...bp.capabilities, cap], entities: bp.entities };
    } catch (e) {
      return { ...base(cart), ok: false, stage: 'logic', error: `TS 逻辑装载失败: ${msg(e)}`, warnings, hasLogic: true };
    }
  }
  try {
    const eng = new Engine({ tickRate: 60 });
    eng.load(bp);
    eng.world.tick();
    eng.world.tick();
  } catch (e) {
    return { ...base(cart), ok: false, stage: 'load', error: `装载失败（parse 通过但引擎装不起来）: ${msg(e)}`, warnings, hasLogic: existsSync(logicPath) };
  }
  return { ...base(cart), ok: true, stage: 'ok', warnings, hasLogic: existsSync(logicPath) };
}

const base = (c) => ({ slug: c.slug, where: c.where });
const msg = (e) => (e && e.message ? e.message : String(e));

const carts = [...scanDir('library', 'library'), ...scanDir('public/games', 'builtin')];
const results = [];
for (const cart of carts) {
  // eslint-disable-next-line no-await-in-loop
  results.push(await checkOne(cart));
}

for (const r of results) {
  if (r.ok) {
    process.stderr.write(`✓ [${r.where}] ${r.slug}${r.warnings && r.warnings.length ? `（${r.warnings.length} 条告警）` : ''}\n`);
  } else {
    process.stderr.write(`✗ [${r.where}] ${r.slug} · ${r.stage} · ${r.error}\n`);
  }
}
const bad = results.filter((r) => !r.ok).length;
process.stderr.write(`—— 体检完：${results.length} 盘 · ${results.length - bad} 好 · ${bad} 坏\n`);
process.stdout.write(JSON.stringify({ ok: bad === 0, total: results.length, bad, results }) + '\n');
process.exit(0);
