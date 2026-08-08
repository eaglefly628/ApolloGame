#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  scripts/ui-brief.mjs —— UI 设计需求单推导器（REQ-DESIGNLINE 二期①·PST 域 2026-08-08）
//
//  治的病：owner 手动拼「这屏要什么控件」的需求单——纯体力活，且动作清单全凭记忆写，
//  经常漏（RENDERCHECK R2 实测 game-a 可驱动率 0/19 的根因之一）。本脚本从游戏自己的数据里
//  **推导**需求单，动作清单三源合并去重（同 `docs/playbooks/game-production.md` 词表对齐律）：
//    (a) 该游戏验收剧本各步骤名（docs/design/<slug>/acceptance/*.scenario.jsonc 的 signal 字段）
//        ——词表对齐律已保证这与真 UI data-action 同源，优先级最高。
//    (b) 蓝图/manifest 里的 action/clickable/keybind 字符串——'compiled' 形态（games/<slug>/**/*.ts
//        源码扫描 `action:`/`signal:`/`data-action=` 字面量）或 'cart'/'builtin' 形态（manifest.json
//        递归找 Clickable.action / KeyBinding.signal）。
//    (c) 已有 UI 的 data-action 实测清单（若 R2 证据在档——约定读 public/games/<slug>/probe/
//        ui-inventory.json 的 {seen:[...]}；本仓目前没有生产者持久化这份证据，此源多数时候是空，
//        钩子留着等 REQ-RENDERCHECK/REQ-S3CLICK 一系的探针以后补写）。
//  GDD `docs/design/<slug>/gdd.md` 的「动作词表」一节（如有）**只作语义注解**、不作独立动作源——
//  它本就是「唯一真相」，(a)/(b)/(c) 都应已是它的下游表达，不重复造第四个源。
//
//  屏清单：从 GDD「屏幕」一节的表格/列表推导；没有该节 → 模板占位（不猜）。
//  风格锚：查该游戏 art-ledger.json（同 workshop refreshDesignAnchor 先例：artStyle.packId 优先，
//  否则任一行 gen.pack）命中 scripts/style-packs.json 就引原文，未锚定则留 owner 选/自由描述占位。
//  品味槽：--taste 一句话，缺省留空槽等 owner 填。
//
//  用法：
//    node scripts/ui-brief.mjs --game <slug> [--taste "一句话"] [--json]
//  产物：docs/design/<slug>/ui-briefs/brief-<YYYY-MM-DD>.md（同日重跑覆盖同一文件）+ stdout。
//  --json：末行打印机读结果 {ok,slug,path,markdown,screenCount,actionCount,actionSources,...}
//  （main_entry/design_ingest.py::handle_design_ui_brief 薄封装本 CLI，供 workshop 步进器按钮调用）。
// ═══════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAndValidate } from './acceptance-schema.mjs';
import { artRoot } from './art-paths.mjs';
import { allStylePacks } from './style-packs.mjs';

const ROOT = process.env.ZEROCRAFT_UI_BRIEF_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');

// ── ① 屏清单：GDD「屏幕」一节推导 ──────────────────────────────────────────
const HEADING_RE = /^#{1,6}\s/;

/** 抓 GDD 里第一个匹配 headingRe 的小节正文（到下一个同级/任意标题为止，含子表格）。找不到 = null。 */
export function findGddSection(gddText, headingTestRe) {
  if (!gddText) return null;
  const lines = gddText.split('\n');
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (headingTestRe.test(lines[i])) { start = i; break; }
  }
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (HEADING_RE.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start + 1, end).join('\n');
}

/** 一段 markdown 表格 → {header:[], rows:[[...]]}；不是表格 = null。 */
export function parseMdTable(block) {
  if (!block) return null;
  const lines = block.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('|'));
  if (lines.length < 2) return null;
  const splitRow = (l) => {
    let s = l;
    if (s.startsWith('|')) s = s.slice(1);
    if (s.endsWith('|')) s = s.slice(0, -1);
    return s.split('|').map((c) => c.trim());
  };
  const header = splitRow(lines[0]);
  const rows = lines.slice(2).filter((l) => !/^[-:| ]+$/.test(l)).map(splitRow); // lines[1]=分隔行·跳过
  return { header, rows };
}

const SCREEN_HEADING_RE = /^#{1,6}\s*(?:[0-9]+[a-z]?\.)?\s*(屏幕|界面|画面)/;

/** 从 GDD 推屏清单。有「屏幕」节表格 → 首列（含「屏」字的列，否则第一列）；有节但无表格 → 项目符号行；
 *  都没有 → {screens:[], placeholder:true}（推不出留模板占位·不猜）。 */
export function deriveScreens(gddText) {
  const block = findGddSection(gddText, SCREEN_HEADING_RE);
  if (!block) return { screens: [], placeholder: true };
  const table = parseMdTable(block);
  if (table) {
    let idx = table.header.findIndex((h) => /屏/.test(h));
    if (idx < 0) idx = 0;
    const screens = table.rows.map((r) => (r[idx] || '').replace(/\*\*/g, '').trim()).filter(Boolean);
    if (screens.length) return { screens, placeholder: false };
  }
  const bullets = block.split('\n').map((l) => l.trim())
    .filter((l) => /^[-*·]\s+/.test(l)).map((l) => l.replace(/^[-*·]\s+/, '').trim());
  if (bullets.length) return { screens: bullets, placeholder: false };
  return { screens: [], placeholder: true };
}

// ── ② 全动作清单：三源合并去重 ──────────────────────────────────────────

/** (a) 验收剧本各步骤 signal 名——已过 schema 校验的剧本才采信；坏剧本跳过不炸。 */
export function actionsFromScenarios(root, slug) {
  const dir = join(root, 'docs', 'design', slug, 'acceptance');
  const out = [];
  if (!existsSync(dir)) return out;
  const seen = new Set();
  const files = readdirSync(dir).filter((f) => f.endsWith('.scenario.jsonc')).sort();
  for (const f of files) {
    let text;
    try { text = readFileSync(join(dir, f), 'utf8'); } catch { continue; }
    const pv = parseAndValidate(text);
    if (!pv.ok || !pv.value || !Array.isArray(pv.value.steps)) continue;
    for (const step of pv.value.steps) {
      if (step && typeof step.signal === 'string' && step.signal && !seen.has(step.signal)) {
        seen.add(step.signal);
        out.push({ name: step.signal, source: 'scenario', file: f });
      }
    }
  }
  return out;
}

function listTsFiles(dir) {
  const out = [];
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const ent of entries) {
    if (ent.name.startsWith('.')) continue;
    const p = join(dir, ent.name);
    if (ent.isDirectory()) { out.push(...listTsFiles(p)); continue; }
    if (ent.isFile() && ent.name.endsWith('.ts') && !ent.name.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

/** manifest JSON 递归找 Clickable.action / KeyBinding.signal / 任意 .action 字符串字段。 */
function walkManifestActions(node, push, depth = 0) {
  if (depth > 16 || node == null || typeof node !== 'object') return;
  if (Array.isArray(node)) { for (const it of node) walkManifestActions(it, push, depth + 1); return; }
  if (typeof node.action === 'string' && node.action) push(node.action);
  if (typeof node.signal === 'string' && node.signal) push(node.signal);
  for (const k of Object.keys(node)) walkManifestActions(node[k], push, depth + 1);
}

/** (b) 蓝图/manifest 里的 action/clickable/keybind 字符串。'cart'(library/<slug>/manifest.json) 或
 *  'builtin'(public/games/<slug>/manifest.json) → JSON 递归找；否则 'compiled'(games/<slug>/**\/*.ts)
 *  → 正则扫字面量（同 ui-inventory.mjs 的「抽不出来就明说」精神：扫不到就是空数组，不猜）。 */
export function actionsFromBlueprint(root, slug) {
  const out = [];
  const seen = new Set();
  const push = (name) => { if (name && !seen.has(name)) { seen.add(name); out.push({ name, source: 'blueprint' }); } };

  const cartManifest = join(root, 'library', slug, 'manifest.json');
  const builtinManifest = join(root, 'public', 'games', slug, 'manifest.json');
  const manifestPath = existsSync(cartManifest) ? cartManifest : existsSync(builtinManifest) ? builtinManifest : null;
  if (manifestPath) {
    let data;
    try { data = JSON.parse(readFileSync(manifestPath, 'utf8')); } catch { data = null; }
    if (data) walkManifestActions(data, push);
    return out;
  }
  const srcDir = join(root, 'games', slug);
  if (!existsSync(srcDir)) return out;
  for (const file of listTsFiles(srcDir)) {
    let text;
    try { text = readFileSync(file, 'utf8'); } catch { continue; }
    for (const m of text.matchAll(/\baction:\s*['"]([^'"]+)['"]/g)) push(m[1]);
    for (const m of text.matchAll(/\bsignal:\s*['"]([^'"]+)['"]/g)) push(m[1]);
    for (const m of text.matchAll(/data-action=["']([^"']+)["']/g)) push(m[1]);
  }
  return out;
}

/** (c) R2 实测 data-action 清单——约定读 public/games/<slug>/probe/ui-inventory.json 的 {seen:[...]}。
 *  本仓当前没有生产者持久化这份证据（ui-inventory.mjs 只打印到 stdout），故此源目前恒空；约定先落，
 *  等 REQ-RENDERCHECK/REQ-S3CLICK 一系探针补写落盘后自动生效——**不是缺陷，是留好的接口**。 */
export function actionsFromR2Evidence(root, slug) {
  const p = join(root, 'public', 'games', slug, 'probe', 'ui-inventory.json');
  if (!existsSync(p)) return [];
  let data;
  try { data = JSON.parse(readFileSync(p, 'utf8')); } catch { return []; }
  const seen = Array.isArray(data && data.seen) ? data.seen : [];
  return seen.filter((n) => typeof n === 'string' && n).map((name) => ({ name, source: 'r2' }));
}

const ACTION_HEADING_RE = /^#{1,6}\s*(?:[0-9]+[a-z]?\.)?\s*动作(词表|清单)/;

/** GDD「动作词表」一节 → Map<动作名, 语义一句话>（只作语义注解·不作独立动作源——见文件头注）。
 *  行内动作名列可能是「`a` / `b` / `c`」这种一行挂多个动作，语义列内容共用给这一行的每个动作。 */
export function actionSemanticsFromGdd(gddText) {
  const map = new Map();
  const block = findGddSection(gddText, ACTION_HEADING_RE);
  if (!block) return map;
  const table = parseMdTable(block);
  if (!table) return map;
  const nameIdx = Math.max(0, table.header.findIndex((h) => /动作/.test(h)));
  let semIdx = table.header.findIndex((h) => /语义/.test(h));
  if (semIdx < 0) semIdx = table.header.length > 1 ? 1 : -1;
  for (const row of table.rows) {
    const nameCell = row[nameIdx] || '';
    const semCell = semIdx >= 0 ? (row[semIdx] || '').trim() : '';
    const backticked = [...nameCell.matchAll(/`([^`]+)`/g)].map((m) => m[1].trim());
    const names = backticked.length ? backticked : nameCell.split('/').map((s) => s.trim()).filter(Boolean);
    for (const n of names) if (n && !map.has(n)) map.set(n, semCell);
  }
  return map;
}

const NO_SEMANTIC = '（语义待补——GDD 未钉自然语言，回该游戏 GDD「动作词表」节或参考验收剧本行为补一句「点了发生什么」）';

/** 三源按优先级合并去重（同名只留首次出现·源标注全部保留供追溯），语义查 GDD 表未命中则占位。
 *  返回 [{name, semantic, sources:[...]}]，顺序=(a)→(b)→(c) 各自内部原序。 */
export function mergeActions(sourceLists, semanticsMap) {
  const order = [];
  const bySources = new Map();
  for (const list of sourceLists) {
    for (const item of list) {
      if (!bySources.has(item.name)) { bySources.set(item.name, new Set()); order.push(item.name); }
      bySources.get(item.name).add(item.source);
    }
  }
  return order.map((name) => ({
    name,
    semantic: (semanticsMap && semanticsMap.get(name)) || NO_SEMANTIC,
    sources: [...bySources.get(name)],
  }));
}

// ── ③ 风格锚 ────────────────────────────────────────────────────────────

const SOURCE_LABEL = { scenario: '验收剧本', blueprint: '蓝图扫描', r2: 'UI 实测(R2)' };

/** 该游戏 art-ledger.json 是否已锚定某风格包（artStyle.packId 优先·否则任一行 gen.pack）；
 *  同 workshop refreshDesignAnchor 前端逻辑先例（数据来源一致，避免需求单与工坊面板各说各话）。 */
export function findStyleAnchor(root, slug, packs) {
  const ledgerPath = join(artRoot(root, slug), 'art-ledger.json');
  if (!existsSync(ledgerPath)) return null;
  let data;
  try { data = JSON.parse(readFileSync(ledgerPath, 'utf8')); } catch { return null; }
  let packId = data && data.artStyle && typeof data.artStyle === 'object' ? data.artStyle.packId : null;
  if (!packId && Array.isArray(data && data.rows)) {
    const hit = data.rows.find((r) => r && r.gen && typeof r.gen.pack === 'string');
    packId = hit ? hit.gen.pack : null;
  }
  if (!packId) return null;
  return packs[packId] || null;
}

const hex = (n) => '#' + ((Number(n) || 0) >>> 0).toString(16).padStart(6, '0');

// ── 拼装 ────────────────────────────────────────────────────────────────

export function buildBrief({ slug, name, pitch, taste, screens, screensPlaceholder, actions, anchor, packs }) {
  const today = new Date().toISOString().slice(0, 10);
  const lines = [];
  lines.push(`# UI 设计需求单 · ${name || slug}（${slug}）`);
  lines.push(`生成时间：${today}`);
  lines.push('');
  lines.push(`一句话玩法（pitch）：${pitch || '【请填：一句话玩法——回 S1 立项卡补 pitch，重跑本推导会自动带进来】'}`);
  lines.push('');
  lines.push('## ① 屏清单');
  if (screens.length) {
    for (const s of screens) lines.push(`- ${s}`);
  } else {
    lines.push('【推不出——GDD 未见「屏幕」一节表格/列表；请手动列出主菜单/对局/结算等屏，或先在 GDD 补一节「屏幕」】');
  }
  if (!screensPlaceholder && screens.length) lines.push('（来源：GDD「屏幕」一节）');
  lines.push('');
  lines.push('## ② 全动作清单');
  if (actions.length) {
    lines.push('| 动作名 | 触发语义 | 数据源 |');
    lines.push('|---|---|---|');
    for (const a of actions) {
      const srcLabel = a.sources.map((s) => SOURCE_LABEL[s] || s).join('+');
      lines.push(`| \`${a.name}\` | ${a.semantic.replace(/\|/g, '\\|')} | ${srcLabel} |`);
    }
  } else {
    lines.push('【推不出——验收剧本/蓝图源码里都没扫到动作字符串；请先补至少一份 docs/design/'
      + `${slug}/acceptance/*.scenario.jsonc（步骤名=真 UI 动作名），或手动列出本屏全部交互动作】`);
  }
  lines.push('');
  lines.push('> 每一条都要在设计稿里真落一个可点击元素，`data-action` 原样照抄本表「动作名」列（不改字、不加前缀）。');
  lines.push('');
  lines.push('## ③ 风格锚 + 品味槽');
  if (anchor) {
    lines.push(`【${anchor.packId || ''} · ${anchor.name || ''}】`);
    lines.push(`中文提示词：${anchor.promptZh || '（无）'}`);
    lines.push(`英文提示词：${anchor.promptEn || '（无）'}`);
    lines.push(`调色板：${Array.isArray(anchor.palette) ? anchor.palette.map(hex).join(' ') : '（无）'}`);
  } else {
    lines.push('【该游戏暂未锚定风格包——从下列任选其一写进视觉方向，或直接描述参考图/关键词/情绪板】');
    const ids = Object.keys(packs || {});
    if (ids.length) for (const id of ids) lines.push(`· ${id}（${packs[id].name || ''}）`);
    else lines.push('（风格包列表暂空）');
  }
  lines.push('');
  lines.push(`品味槽（owner 一句话）：${taste ? taste : '【owner 填】'}`);
  lines.push('');
  lines.push('## ④ 输出契约（固定模板·不可删改）');
  lines.push('- 单文件自包含 .dc.html；图片较多时打包为 zip（html + 资源文件，Claude Design 默认导出即为 zip）——两种形式都收，禁外链 `<script src=`。');
  lines.push('- 每个交互元素必须带 `data-action="<②清单里的动作名>"`（照抄，不改字、不加前缀）。');
  lines.push('- 标注屏尺寸（如 1920×1080 横版 / 456×788 竖屏）。');
  lines.push('- 画出关键状态：正常 / 悬停 / 禁用 / 按游戏追加胜负态等。');
  lines.push('- 完成后经工坊「🎨 设计稿产线 · 📥 收稿箱」交付。');
  lines.push('');
  lines.push('## ⑤ 交付方式');
  lines.push(`两条路都可以（交付物是整包 zip 或单 .dc.html，两种都收）：`);
  lines.push(`① **工坊拖拽**：回本工坊「🎨 设计稿产线 · 📥 收稿箱」，把 Claude Design 导出的 .zip（或单 .dc.html）`
    + `整包拖进去/选择上传——自动落 \`docs/design/${slug}/\`（zip 落 \`ui-refs/<稿名>/\` 并保留包内相对路径结构）`
    + '并登记台账（draft）+ 自动核对②动作清单（缺项亮 ⚠ 警示·不拒收）。');
  lines.push(`② **命令行**：不想开浏览器就 \`python3 zerocraft.py design-import <zip路径> --game ${slug}\`——`
    + '本机直接导入（同一套安全解包 + 登记 + 对账逻辑，零 HTTP）。');
  lines.push('review 通过后勾/传「☑ 定稿」（定稿 = 1:1 复刻基准挂载对象）。');
  return lines.join('\n');
}

// ── CLI ────────────────────────────────────────────────────────────────

export async function generate(root, slug, taste) {
  const gddPath = join(root, 'docs', 'design', slug, 'gdd.md');
  const gddText = existsSync(gddPath) ? readFileSync(gddPath, 'utf8') : '';
  const pipelinePath = join(root, 'public', 'games', slug, 'pipeline.json');
  let concept = {};
  if (existsSync(pipelinePath)) {
    try { concept = JSON.parse(readFileSync(pipelinePath, 'utf8')).concept || {}; } catch { concept = {}; }
  }

  const { screens, placeholder: screensPlaceholder } = deriveScreens(gddText);
  const scenarioActions = actionsFromScenarios(root, slug);
  const blueprintActions = actionsFromBlueprint(root, slug);
  const r2Actions = actionsFromR2Evidence(root, slug);
  const semantics = actionSemanticsFromGdd(gddText);
  const actions = mergeActions([scenarioActions, blueprintActions, r2Actions], semantics);

  const packs = allStylePacks();
  const anchor = findStyleAnchor(root, slug, packs);

  const markdown = buildBrief({
    slug, name: concept.name, pitch: concept.pitch, taste, screens, screensPlaceholder, actions, anchor, packs,
  });

  const outDir = join(root, 'docs', 'design', slug, 'ui-briefs');
  mkdirSync(outDir, { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  const outPath = join(outDir, `brief-${today}.md`);
  writeFileSync(outPath, markdown + '\n', 'utf8');

  return {
    ok: true, slug, path: relative(root, outPath), markdown,
    screenCount: screens.length, actionCount: actions.length,
    actionSources: {
      scenario: scenarioActions.length, blueprint: blueprintActions.length, r2: r2Actions.length,
    },
    styleAnchorPackId: anchor ? anchor.packId : null,
    tasteFilled: !!taste,
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const opt = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
  const slug = opt('game');
  const taste = opt('taste') || '';
  const asJson = argv.includes('--json');
  if (!slug) {
    console.error('用法: node scripts/ui-brief.mjs --game <slug> [--taste "一句话"] [--json]');
    process.exit(2);
  }
  let result;
  try {
    result = await generate(ROOT, slug, taste);
  } catch (e) {
    if (asJson) { console.log(JSON.stringify({ ok: false, error: e?.message ?? String(e) })); process.exit(1); }
    console.error(`推导失败: ${e?.message ?? e}`);
    process.exit(1);
  }
  if (asJson) {
    console.log(JSON.stringify(result));
    process.exit(0);
  }
  console.log(result.markdown);
  console.log('');
  console.log(`── 落盘：${result.path} · ${result.screenCount} 屏 · ${result.actionCount} 动作`
    + `（剧本${result.actionSources.scenario}/蓝图${result.actionSources.blueprint}/R2实测${result.actionSources.r2}）`);
  process.exit(0);
}

const isMain = process.argv[1] && (process.argv[1].endsWith('ui-brief.mjs'));
if (isMain && !process.env.VITEST && !process.env.VITEST_WORKER_ID) {
  main();
}
