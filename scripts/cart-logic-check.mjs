#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  scripts/cart-logic-check.mjs —— TS 例外卡带的 logic.ts 装载门（REQ-ARCH·owner 07-11 拍板）
//
//  用法：npx vite-node scripts/cart-logic-check.mjs <slug> <logic 文件名>
//        （文件名限 logic.ts / logic.pending.ts，均在 library/<slug>/ 下——防路径穿越）
//
//  与 manifest-check 同一条纪律「能存必须能跑」：AI 产出的 logic.ts 落盘前必须
//  ① 模块能被 vite 管线装载（TS 编译错在此爆）
//  ② 导出 cartCapability（defineCapability 形状：id=cart-<slug>、systems 非空）
//  ③ 与该卡带 manifest 合体后 真引擎 load + 空跑 2 tick 不炸
//  任一失败 → exit 1 + stderr 明文（供回喂 LLM 修）。绝不 eval 自由字符串——
//  走与运行器完全相同的 ESM 装载路径，检查即彩排。
// ═══════════════════════════════════════════════════════════════

import { readFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { parseManifestDetailed } from '../src/assembly/manifest.ts';
import { Engine } from '../src/runtime/engine.ts';

function die(msg) {
  process.stderr.write(`${msg}\n`);
  process.exit(1);
}

const [slug, file] = process.argv.slice(2);
if (!slug || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) die(`cart-logic-check: 非法 slug: ${slug ?? '(缺)'}`);
if (!['logic.ts', 'logic.pending.ts'].includes(file ?? '')) die(`cart-logic-check: 文件名限 logic.ts / logic.pending.ts，收到: ${file ?? '(缺)'}`);

const dir = resolve(process.cwd(), 'library', slug);
const mfPath = resolve(dir, 'manifest.json');
const logicPath = resolve(dir, file);
if (!existsSync(mfPath)) die(`cart-logic-check: 卡带 manifest 不存在: library/${slug}/manifest.json`);
if (!existsSync(logicPath)) die(`cart-logic-check: 逻辑文件不存在: library/${slug}/${file}`);

let mod;
try {
  mod = await import(pathToFileURL(logicPath).href);
} catch (e) {
  die(`TS 逻辑装载失败（模块编译/导入期）: ${e && e.message ? e.message : e}`);
}

const cap = mod.cartCapability;
if (!cap || typeof cap !== 'object') die('TS 逻辑不合契约：必须 `export const cartCapability = defineCapability({...})`');
if (typeof cap.id !== 'string' || cap.id !== `cart-${slug}`) {
  die(`TS 逻辑不合契约：cartCapability.id 必须是 "cart-${slug}"（收到: ${cap && cap.id}）`);
}
if (!Array.isArray(cap.systems) || cap.systems.length === 0) die('TS 逻辑不合契约：cartCapability.systems 必须是非空数组');

let mf;
try {
  mf = JSON.parse(readFileSync(mfPath, 'utf8'));
} catch (e) {
  die(`cart-logic-check: manifest 解析失败: ${e && e.message ? e.message : e}`);
}

try {
  const parsed = parseManifestDetailed(mf);
  const bp = { capabilities: [...parsed.blueprint.capabilities, cap], entities: parsed.blueprint.entities };
  const eng = new Engine({ tickRate: 60 });
  eng.load(bp);
  eng.world.tick();
  eng.world.tick();
} catch (e) {
  die(`TS 逻辑装载失败（合体引擎 load/空跑期）: ${e && e.message ? e.message : e}`);
}

process.stdout.write(JSON.stringify({ ok: true, capId: cap.id, systems: cap.systems.map((s) => s.id) }) + '\n');
process.exit(0);
