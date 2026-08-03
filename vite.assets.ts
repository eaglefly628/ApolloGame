import { resolve } from 'path';
import { cpSync, existsSync, readFileSync } from 'node:fs';

// 各游戏运行时真正用到的 FreeArtLib 美术（相对 assets/FreeArtLib/ 的路径），从游戏自己的
// 数据源解析（不写死、随上新自动跟进）：
//   game-e：扑克 cards.png + 已声明小丑 webp + 金币 + 2 个 GUI 图标
//   game-f：assets.ts 引用到的 DCSS 角色(dcss) + 特效(fx)
function parseNames(root: string, file: string, re: RegExp): string[] | null {
  try { return [...readFileSync(resolve(root, file), 'utf8').matchAll(re)].map((m) => m[1]); } catch { return null; }
}

/** 返回用到的美术相对路径列表（相对 assets/FreeArtLib/）。target 给定时只返回该游戏的。 */
export function usedAssetRels(root: string, target?: string): string[] {
  const rels: string[] = [];
  if (!target || target === 'game-e') {
    rels.push('cardgame/cards.png', 'item/gold/gold_pile.png', 'gui/tavern.png', 'gui/spells/components/scroll.png');
    const jn = parseNames(root, 'games/game-e/jokers.ts', /name: '([^']+)'/g);
    if (jn) for (const n of new Set(jn)) rels.push(`cardgame/card/${n.replace(/ /g, '_')}.webp`);
  }
  if (!target || target === 'game-f') {
    const mn = parseNames(root, 'games/game-f/assets.ts', /dcss\('([^']+)'\)/g);
    if (mn) for (const n of new Set(mn)) rels.push(`monster/${n}.png`);
    const fn = parseNames(root, 'games/game-f/assets.ts', /fx\('([^']+)'\)/g);
    if (fn) for (const n of new Set(fn)) rels.push(`effect/${n}.png`);
  }
  return rels;
}

// 构建期把用到的美术拷进产物 /assets（多文件模式；项目无 public 目录，否则字符串 URL 404）。
export function copyUsedAssets(root: string, defaultOut: string) {
  let outDir = defaultOut;
  const srcDir = resolve(root, 'assets/FreeArtLib');
  return {
    name: 'copy-used-assets',
    apply: 'build' as const,
    configResolved(c: { build: { outDir: string } }) { outDir = c.build.outDir; },
    closeBundle() {
      for (const rel of usedAssetRels(root)) {
        const s = resolve(srcDir, rel);
        if (existsSync(s)) cpSync(s, resolve(root, outDir, 'assets/FreeArtLib', rel), { recursive: true });
      }
    },
  };
}

const MIME: Record<string, string> = {
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml',
};

// 单文件模式：把用到的美术 base64 注入 globalThis.__APOLLO_INLINE_ASSETS__
// （键 = 'assets/FreeArtLib/<rel>'，与 game-*/assets.ts 的 descriptor.src 一致），
// 让单 HTML 自带美术、运行时无需外部文件。配合 vite-plugin-singlefile。
export function inlineUsedAssets(root: string, target?: string) {
  const srcDir = resolve(root, 'assets/FreeArtLib');
  return {
    name: 'inline-used-assets',
    apply: 'build' as const,
    transformIndexHtml(html: string) {
      const map: Record<string, string> = {};
      for (const rel of usedAssetRels(root, target)) {
        const s = resolve(srcDir, rel);
        if (!existsSync(s)) continue;
        const ext = rel.slice(rel.lastIndexOf('.')).toLowerCase();
        const mime = MIME[ext] ?? 'application/octet-stream';
        map[`assets/FreeArtLib/${rel}`] = `data:${mime};base64,${readFileSync(s).toString('base64')}`;
      }
      const tag = `<script>globalThis.__APOLLO_INLINE_ASSETS__=${JSON.stringify(map)};</script>`;
      return html.replace(/<\/head>/i, tag + '</head>');
    },
  };
}
