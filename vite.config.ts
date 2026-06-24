import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { cpSync, existsSync } from 'node:fs';

// 把仓库根 assets/（FreeArtLib 美术：扑克牌 cards.png / 小丑 webp / GUI 图标…）拷进构建产物 /assets，
// 否则游戏里 `/assets/FreeArtLib/...` 的字符串 URL 在 dev 能 serve、build/烧录版却 404（项目无 public 目录）。
function copyAssets() {
  let outDir = 'dist';
  return {
    name: 'copy-freeartlib-assets',
    apply: 'build' as const,
    configResolved(c: { build: { outDir: string } }) { outDir = c.build.outDir; },
    closeBundle() {
      const src = resolve(__dirname, 'assets');
      if (existsSync(src)) cpSync(src, resolve(__dirname, outDir, 'assets'), { recursive: true });
    },
  };
}

export default defineConfig({
  plugins: [react(), copyAssets()],
  resolve: {
    alias: {
      '@engine': resolve(__dirname, 'src/engine'),
      '@skills': resolve(__dirname, 'src/skills'),
      '@atom-skills': resolve(__dirname, 'src/skills/atoms'),
      '@assets': resolve(__dirname, 'src/assets'),
      '@services': resolve(__dirname, 'src/services'),
      '@renderer': resolve(__dirname, 'src/renderer'),
      '@ui': resolve(__dirname, 'src/ui'),
      '@net': resolve(__dirname, 'src/net'),
    },
  },
  test: {
    // 排除并行 Programmer 的 worktree 副本（.claude/worktrees）——否则 vitest 会把副本里的
    // 测试也扫进来、测试数虚高（曾出现 1515 假象）。保留默认的 node_modules/dist 排除。
    exclude: ['**/node_modules/**', '**/dist/**', '**/.claude/**'],
  },
});
