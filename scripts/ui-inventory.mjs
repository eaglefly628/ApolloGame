#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  scripts/ui-inventory.mjs —— 「动作词表 vs 屏上真控件」差集（自证七问·第 7 问的机读部分）
//
//  治的病：**世界侧通了但玩家点不到**。game108 实测踩到——烟雾的世界通路全绿
//  （扣次数/置旗/计回合·验收剧本⑨过），但**屏上压根没有烟雾键**，玩家点不到。
//  这类缺失所有既有的门都抓不到：单测测世界、验收剧本测世界、点击门只验"至少一个键有效"、
//  渲染探针只验"画出来了"。**没有任何一道在问「词表里声明的动作，屏上是不是都够得着」。**
//
//  做法：真起 vite → 真 Chromium → 装该游戏 → 把**整局跑一遍**（不点，只等相位自己走），
//  沿途把出现过的 `[data-action]` 全收集起来 → 与该游戏声明的动作词表求差集。
//  为什么要"跑一遍"而不是开局扫一次：键会随相位换动作名（蓄力键 ↔ 出招键），只扫开局会漏掉一半。
//
//  用法：node scripts/ui-inventory.mjs --game <slug> [--vocab a,b,c]
//    --vocab 缺省时按约定去 `games/<slug>/theme.ts` 里读 `ACT` 的字面量（读不到就要求显式传）。
//  退出码：0 = 词表里的动作屏上都出现过 · 1 = 有动作玩家够不着 · 3 = 环境无浏览器（跳过）
// ═══════════════════════════════════════════════════════════════

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectBrowserRuntime, startDevServer, stopDevServer, deepLinkQuery } from './lib/render-harness.mjs';
import { detectForm } from './game-pipeline.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * 从 `theme.ts` 抽动作词表（约定：`export const ACT = {...}`，值是字面量或 `(h) => \`x.${h}\`` 模板）。
 * **抽不出来就明说抽不出来**，要求显式 `--vocab`——绝不猜一个空表然后"零差集"假绿。
 */
export function extractVocab(themeSrc, handsLiteral) {
  const m = themeSrc.match(/export const ACT = \{([\s\S]*?)\n\} as const;/);
  if (!m) return null;
  const body = m[1];
  const out = new Set();
  // 形如  smoke: 'smoke.use',
  for (const [, v] of body.matchAll(/:\s*'([^']+)'/g)) out.add(v);
  // 形如  charge: (h: Hand) => `charge.${h}`,
  for (const [, prefix] of body.matchAll(/=>\s*`([a-z.]+)\$\{/g)) {
    for (const h of handsLiteral) out.add(prefix + h);
  }
  return [...out].sort();
}

export function extractHands(themeSrc) {
  const m = themeSrc.match(/export const HANDS = \[([^\]]*)\]/);
  if (!m) return [];
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

/** 判词（纯函数·供单测直接灌）。 */
export function interpretInventory(vocab, seen) {
  const missing = vocab.filter((a) => !seen.includes(a));
  const extra = seen.filter((a) => !vocab.includes(a));
  if (missing.length) {
    return {
      exit: 1,
      summary: `✗ 词表里有 ${missing.length} 个动作**玩家够不着**（屏上从没出现过）：${missing.join(' / ')}`
        + '——世界侧通了不等于能玩，这是功能缺失不是观感问题',
      missing, extra,
    };
  }
  return { exit: 0, summary: `✓ 词表 ${vocab.length} 个动作屏上都够得着${extra.length ? `（另有屏上多出的 ${extra.length} 个：${extra.join(' / ')}）` : ''}`, missing, extra };
}

async function main() {
  const argv = process.argv.slice(2);
  const opt = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
  const slug = opt('game');
  if (!slug) { console.error('用法: node scripts/ui-inventory.mjs --game <slug> [--vocab a,b,c]'); process.exit(2); }

  let vocab = opt('vocab')?.split(',').map((x) => x.trim()).filter(Boolean);
  if (!vocab) {
    const theme = join(ROOT, 'games', slug, 'theme.ts');
    if (!existsSync(theme)) { console.error(`✗ 找不到 ${theme}，请显式传 --vocab`); process.exit(2); }
    const src = readFileSync(theme, 'utf8');
    vocab = extractVocab(src, extractHands(src));
    if (!vocab?.length) { console.error('✗ 从 theme.ts 抽不出 ACT 词表，请显式传 --vocab（不猜空表假绿）'); process.exit(2); }
  }

  const rt = detectBrowserRuntime();
  if (!rt.ok) { console.error('本机无 Chromium，跳过'); process.exit(3); }
  const { chromium } = await import('playwright');
  const dev = await startDevServer(ROOT);
  const browser = await chromium.launch({ executablePath: rt.execPath });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.route('**/api/generate/providers', (r) => r.fulfill({ status: 200, body: '[]' }));
  await page.route('**/api/library', (r) => r.fulfill({ status: 200, body: '[]' }));

  const seen = new Set();
  try {
    await page.goto(`http://localhost:${dev.port}/?${deepLinkQuery(detectForm(ROOT, slug), slug)}`, { waitUntil: 'networkidle' });
    // 跑一整局的时长（不点·只等相位自己走）——键会随相位换动作名，只扫开局会漏掉一半。
    for (let i = 0; i < 60; i++) {
      const found = await page.evaluate(
        `Array.from(document.querySelectorAll('[data-action]')).map(el => el.getAttribute('data-action')).filter(Boolean)`,
      );
      for (const a of found) seen.add(a);
      await page.waitForTimeout(250);
    }
  } finally {
    await browser.close();
    stopDevServer(dev.proc);
  }

  const v = interpretInventory(vocab, [...seen].sort());
  console.log(`[ui-inventory] ${slug} ${v.summary}`);
  process.exit(v.exit);
}

if (process.argv[1] && process.argv[1].endsWith('ui-inventory.mjs')) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
