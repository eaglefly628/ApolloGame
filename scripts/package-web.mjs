#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  scripts/package-web.mjs —— 把「库卡带」(library/<slug> 纯数据 manifest) 打成
//  单个自包含 HTML（file:// 双击即玩·零外部请求）。REQ-PKG·发布线/Lead 域。
//
//  用法：node scripts/package-web.mjs <slug> [outFile]
//        缺省 outFile = release/<slug>/<slug>.html
//
//  原理（宪法对味：游戏=数据·引擎=解释器·打包=引擎 bundle + 内联数据）：
//    1. VITE_TARGET_GAME=__inline__ + VITE_SINGLEFILE=1 构建 cartridge → 一个**通用**的
//       「内联数据卡带」单 HTML 外壳（bundle 走 cartridge-inline-run·不静态 import 任何工程游戏）；
//    2. 把该 slug 的 manifest 内联进 <head> 的 window.__APOLLO_INLINE_CART__（在 bundle module 前执行），
//       外壳挂载即读它、走既有 parseManifest+引擎 load 路径直接跑，跳过在线 fetch；
//    3. 覆盖 <title> 为游戏名。产物自包含体检（无 http(s) 外链）不过 → 明报退出码 1。
//
//  注：manifest 里未解析的 "art:<query>" 引用在离线包里退化为占位（渲染层不炸加载）；
//      art: 打包期解析 + FreeArtLib/资产 base64 内联=后续件（REQ-PKG 完工回执已登记）。
// ═══════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** 读该 slug 的 manifest（library 优先·public/games 兜底）。找不到→抛。 */
export function readCartManifest(root, slug) {
  const candidates = [
    join(root, 'library', slug, 'manifest.json'),
    join(root, 'public', 'games', slug, 'manifest.json'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf8'));
  }
  throw new Error(`找不到卡带 manifest：library/${slug}/manifest.json（或 public/games/${slug}/manifest.json）`);
}

/** 读该 slug 的展示 meta（title/subtitle）——library/<slug>/meta.json .name/.tagline，缺省回退 slug。 */
export function readCartMeta(root, slug) {
  const p = join(root, 'library', slug, 'meta.json');
  let name = slug;
  let subtitle = '数据驱动卡带';
  if (existsSync(p)) {
    try {
      const m = JSON.parse(readFileSync(p, 'utf8'));
      if (typeof m.name === 'string' && m.name.trim()) name = m.name.trim();
      if (typeof m.tagline === 'string' && m.tagline.trim()) subtitle = m.tagline.trim();
      else if (typeof m.description === 'string' && m.description.trim()) subtitle = m.description.trim().slice(0, 60);
    } catch { /* 坏 meta 不阻塞打包·用回退 */ }
  }
  return { title: name, subtitle };
}

// JSON → 可安全嵌进内联 <script> 的字面量：转义 < > 防 "</script>" 提前闭合，
// 转义 U+2028/U+2029（JS 里是行终止符·裸嵌进 script 会截断）。用 \u 转义写正则（源文件保持纯 ASCII）。
function scriptSafeJson(v) {
  const LINE_SEP = new RegExp("[\\u2028\\u2029]", "g");
  return JSON.stringify(v)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(LINE_SEP, (m) => "\\u" + m.charCodeAt(0).toString(16));
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * 把内联卡带 globals 注入 HTML 外壳的 <head>（bundle module 之前执行），并覆盖 <title>。
 * 纯字符串变换（不碰磁盘）——导出供单测。
 */
export function injectInline(html, { cart, meta, assets, title }) {
  if (!/<\/head>/i.test(html)) {
    throw new Error('外壳 HTML 缺少 </head>——无法注入内联卡带数据（cartridge.html 结构异常？）');
  }
  const parts = [`window.__APOLLO_INLINE_CART__=${scriptSafeJson(cart)};`];
  if (meta) parts.push(`window.__APOLLO_INLINE_META__=${scriptSafeJson(meta)};`);
  if (assets && Object.keys(assets).length) {
    parts.push(`globalThis.__APOLLO_INLINE_ASSETS__=Object.assign(globalThis.__APOLLO_INLINE_ASSETS__||{},${scriptSafeJson(assets)});`);
  }
  const tag = `<script>${parts.join('')}</script>`;
  let out = html.replace(/<\/head>/i, `${tag}</head>`);
  if (title) out = out.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  return out;
}

/**
 * 自包含体检：扫 HTML 里会触发浏览器网络加载的外部 http(s) 引用（script/link/img/CSS url/@import）。
 * 返回问题列表（空=自包含·file:// 双击不联网）。xmlns 命名空间 URL 不算（不发请求）。导出供单测。
 */
export function scanSelfContainment(html) {
  const issues = [];
  const checks = [
    [/<script\b[^>]*\bsrc\s*=\s*["']https?:\/\//gi, '<script src> 外链'],
    [/<link\b[^>]*\bhref\s*=\s*["']https?:\/\//gi, '<link href> 外链'],
    [/<img\b[^>]*\bsrc\s*=\s*["']https?:\/\//gi, '<img src> 外链'],
    [/url\(\s*["']?https?:\/\//gi, 'CSS url() 外链'],
    [/@import[^;]*["']https?:\/\//gi, 'CSS @import 外链'],
  ];
  for (const [re, label] of checks) {
    const m = html.match(re);
    if (m) issues.push(`${label}×${m.length}（如：${m[0].slice(0, 70)}）`);
  }
  return issues;
}

/** 构建通用「内联数据卡带」外壳（VITE_TARGET_GAME=__inline__·单文件）→ 返回 dist-cartridge/cartridge.html 内容。 */
function buildInlineShell(root) {
  const env = { ...process.env, VITE_TARGET_GAME: '__inline__', VITE_SINGLEFILE: '1' };
  execFileSync('npx', ['vite', 'build', '--config', 'vite.config.cartridge.ts'], {
    cwd: root, env, stdio: 'inherit',
  });
  const shell = join(root, 'dist-cartridge', 'cartridge.html');
  if (!existsSync(shell)) throw new Error('构建完成但未找到外壳 dist-cartridge/cartridge.html');
  return readFileSync(shell, 'utf8');
}

export async function packageWeb(root, slug, outFile, { build = true, shellHtml } = {}) {
  const cart = readCartManifest(root, slug);
  const meta = readCartMeta(root, slug);
  let shell = shellHtml;
  if (shell == null) {
    if (build) {
      shell = buildInlineShell(root);
    } else {
      const p = join(root, 'dist-cartridge', 'cartridge.html');
      if (!existsSync(p)) throw new Error('--no-build 但外壳不存在：先构建一次或去掉 --no-build');
      shell = readFileSync(p, 'utf8');
    }
  }

  const finalHtml = injectInline(shell, { cart, meta, title: meta.title });

  const issues = scanSelfContainment(finalHtml);
  if (issues.length) {
    throw new Error(`产物不自包含（有外部网络引用，file:// 双击会联网/缺件）：\n  - ${issues.join('\n  - ')}`);
  }

  const out = outFile || join(root, 'release', slug, `${slug}.html`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, finalHtml, 'utf8');
  return out;
}

async function main(argv) {
  const noBuild = argv.includes('--no-build');
  const args = argv.filter((a) => a !== '--no-build');
  const [slug, outFile] = args;
  if (!slug || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    process.stderr.write(`用法：node scripts/package-web.mjs <slug> [outFile] [--no-build]\n非法或缺失 slug：${slug ?? '(缺)'}\n`);
    process.exit(2);
  }
  try {
    const out = await packageWeb(ROOT, slug, outFile, { build: !noBuild });
    const kb = Math.round(readFileSync(out).length / 1024);
    process.stdout.write(`[package-web] ${slug} → ${out}（${kb} KB·自包含·双击即玩）\n`);
  } catch (e) {
    process.stderr.write(`[package-web] 失败：${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2));
