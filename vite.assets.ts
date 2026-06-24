import { resolve } from 'path';
import { cpSync, existsSync, readFileSync } from 'node:fs';

// 构建期把「实际用到的」FreeArtLib 美术拷进产物 /assets（项目无 public 目录，否则字符串 URL 在 build/烧录版 404）。
// 只拷游戏运行时引用的子集（不是整包 30M）：game-e 扑克/小丑/金币/GUI 图标；game-f DCSS 角色 + 特效。
// 跳过仅工具/未用的大目录（dungeon / player / misc / index.json / item-weapon 等）。
export function copyUsedAssets(root: string, defaultOut: string) {
  let outDir = defaultOut;
  const srcDir = resolve(root, 'assets/FreeArtLib');
  return {
    name: 'copy-used-assets',
    apply: 'build' as const,
    configResolved(c: { build: { outDir: string } }) { outDir = c.build.outDir; },
    closeBundle() {
      const cp = (rel: string) => {
        const s = resolve(srcDir, rel);
        if (existsSync(s)) cpSync(s, resolve(root, outDir, 'assets/FreeArtLib', rel), { recursive: true });
      };
      // game-e（小丑牌）：扑克牌 + 小丑 webp + 过关金币 + 商店/日志 GUI 图标
      cp('cardgame');
      cp('item/gold/gold_pile.png');
      cp('gui/tavern.png');
      cp('gui/spells/components/scroll.png');
      // game-f（自走棋）：特效 + 只拷其 assets.ts 实际引用到的 DCSS 角色（避免整包 monster/ 5M 大半没用）
      cp('effect');
      try {
        const f = readFileSync(resolve(root, 'src/games/game-f/assets.ts'), 'utf8');
        const names = [...f.matchAll(/dcss\('([^']+)'\)/g)].map((m) => m[1]);
        if (names.length) for (const n of new Set(names)) cp(`monster/${n}.png`);
        else cp('monster');
      } catch { cp('monster'); }
    },
  };
}
