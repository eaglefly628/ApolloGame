// scripts/emoji-sync-guard.test.mjs —— emoji 图渲「两侧镜像」同步守卫（REQ-UI-emoji图渲 Lead 验收时把同步债机器化）。
// 渲染侧 src/ui/components/emoji.ts（PUI 域·浏览器端）与资产侧 scripts/emoji-resolve.mjs + emoji-audit.mjs
// （PA 域·Node 端）各存一份 cpName / SYMBOL_ALIAS / ICON 码点范围——任何一侧单改都会静默破图
// （渲染集 ⊄ vendor 集：渲染器发 <img> 而 vendor 没 copy 那张图）。本守卫钉死三样一致：
// 谁改词表/范围，**两侧同一提交一起改**，否则这里红。改动流程：PA 与 PUI 会审后两侧同改（CLAUDE.md 域界）。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { cpName as paCpName, SYMBOL_ALIAS as PA_ALIAS } from './emoji-resolve.mjs';
import { cpName as uiCpName, SYMBOL_ALIAS as UI_ALIAS } from '../src/ui/components/emoji.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

// 从两侧源码抠出 ICON 字符类内容（audit=正则字面量·render=字符串常量）——文本级钉死，不依赖导出。
function iconClassOfAudit() {
  const m = read('scripts/emoji-audit.mjs').match(/const ICON = \/\[(.+?)\]\/gu/);
  if (!m) throw new Error('emoji-audit.mjs 里找不到 ICON 正则（抽取器需随源码更新）');
  return m[1];
}
function iconClassOfRender() {
  const m = read('src/ui/components/emoji.ts').match(/const ICON = '\[(.+?)\]'/);
  if (!m) throw new Error('emoji.ts 里找不到 ICON 字符类（抽取器需随源码更新）');
  return m[1].replace(/\\\\u/g, '\\u'); // 字符串字面量里 \\u → 正则的 \u
}

describe('emoji 同步守卫（PA emoji-resolve/audit ↔ PUI emoji.ts 镜像一致）', () => {
  it('cpName 行为逐字一致（单码点/VS16 滤除/ZWJ 连字/符号）', () => {
    const probes = ['⚔', '⚔️', '🎮', '💎', '👨‍👩‍👧', '❤️', '🀄', '♔', '★', '♻', '🧊'];
    for (const p of probes) expect(uiCpName(p), `cpName(${p})`).toBe(paCpName(p));
  });

  it('SYMBOL_ALIAS 两侧逐条相等（改一侧必须同提交改另一侧）', () => {
    expect(UI_ALIAS).toEqual(PA_ALIAS);
  });

  it('ICON 码点范围两侧逐字一致（渲染集 ⊆ vendor 集的根保证）', () => {
    expect(iconClassOfRender()).toBe(iconClassOfAudit());
  });

  it('alias 源字符都落在 ICON 范围内（否则渲染端 alias 永不触发=死映射）', () => {
    const cls = new RegExp(`[${iconClassOfRender()}]`, 'u');
    for (const cp of Object.keys(PA_ALIAS)) {
      const ch = String.fromCodePoint(parseInt(cp, 16));
      expect(cls.test(ch), `alias 源 ${ch}(${cp}) 应可被渲染端检出`).toBe(true);
    }
  });

  it('alias 目标码点在共享库里确有美术图（否则 alias 渲出破图）', () => {
    const idx = JSON.parse(read('assets/index.json'));
    const have = new Set(idx.assets.filter((a) => a.category === 'emoji' && a.path).map((a) => a.path));
    for (const [src, dst] of Object.entries(PA_ALIAS)) {
      expect(have.has(`emoji/${dst}.png`), `alias ${src}→${dst} 目标应在库`).toBe(true);
    }
  });
});
