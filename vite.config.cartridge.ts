import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { cpSync, existsSync } from 'node:fs';

const targetGame = process.env.VITE_TARGET_GAME ?? 'game-f';

// 烧录版同样把 assets/ 拷进产物 /assets（否则扑克牌/小丑美术 404）。
function copyAssets() {
  let outDir = 'dist-cartridge';
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
  root: '.',
  base: './',
  build: {
    outDir: 'dist-cartridge',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'cartridge.html'),
    },
  },
  define: {
    __TARGET_GAME__: JSON.stringify(targetGame),
  },
  resolve: {
    alias: {
      '@engine':     resolve(__dirname, 'src/engine'),
      '@skills':     resolve(__dirname, 'src/skills'),
      '@atom-skills':resolve(__dirname, 'src/skills/atoms'),
      '@assets':     resolve(__dirname, 'src/assets'),
      '@services':   resolve(__dirname, 'src/services'),
      '@renderer':   resolve(__dirname, 'src/renderer'),
      '@ui':         resolve(__dirname, 'src/ui'),
      '@net':        resolve(__dirname, 'src/net'),
    },
  },
});
