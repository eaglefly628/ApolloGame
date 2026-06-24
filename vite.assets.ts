import { resolve } from 'path';
import { cpSync, existsSync, readFileSync } from 'node:fs';

// 构建期把「实际引用到的」FreeArtLib 美术拷进产物 /assets（项目无 public 目录，否则字符串 URL 在 build/烧录版 404）。
// 只拷各游戏运行时真正用到的文件（从游戏自己的数据源解析，不写死、随上新自动跟进）：
//   game-e：扑克 cards.png + 已声明小丑的 webp（按 jokers.ts 的 name）+ 金币 + 2 个 GUI 图标
//   game-f：assets.ts 引用到的 DCSS 角色(dcss) + 特效(fx)
// 跳过整包未用的 dungeon / player / misc / index.json / item-weapon / card 里的非小丑图等。
export function copyUsedAssets(root: string, defaultOut: string) {
  let outDir = defaultOut;
  const srcDir = resolve(root, 'assets/FreeArtLib');
  // 从源文件解析某 helper('x') / name: 'x' 的参数列表（解析失败返回 null → 调用方兜底）。
  const parse = (file: string, re: RegExp): string[] | null => {
    try { return [...readFileSync(resolve(root, file), 'utf8').matchAll(re)].map((m) => m[1]); } catch { return null; }
  };
  return {
    name: 'copy-used-assets',
    apply: 'build' as const,
    configResolved(c: { build: { outDir: string } }) { outDir = c.build.outDir; },
    closeBundle() {
      const cp = (rel: string) => {
        const s = resolve(srcDir, rel);
        if (existsSync(s)) cpSync(s, resolve(root, outDir, 'assets/FreeArtLib', rel), { recursive: true });
      };
      // ── game-e（小丑牌）──
      cp('cardgame/cards.png'); // 扑克牌雪碧图
      const jn = parse('src/games/game-e/jokers.ts', /name: '([^']+)'/g);
      if (jn) for (const n of new Set(jn)) cp(`cardgame/card/${n.replace(/ /g, '_')}.webp`); // 仅已声明小丑的图
      else cp('cardgame/card'); // 兜底
      cp('item/gold/gold_pile.png');
      cp('gui/tavern.png');
      cp('gui/spells/components/scroll.png');
      // ── game-f（自走棋）：只拷 assets.ts 引用到的角色 + 特效 ──
      const mn = parse('src/games/game-f/assets.ts', /dcss\('([^']+)'\)/g);
      if (mn) for (const n of new Set(mn)) cp(`monster/${n}.png`); else cp('monster');
      const fn = parse('src/games/game-f/assets.ts', /fx\('([^']+)'\)/g);
      if (fn) for (const n of new Set(fn)) cp(`effect/${n}.png`); else cp('effect');
    },
  };
}
