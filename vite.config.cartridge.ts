import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyUsedAssets, inlineUsedAssets } from './vite.assets';
import { viteSingleFile } from 'vite-plugin-singlefile';

const targetGame = process.env.VITE_TARGET_GAME ?? 'game-f';
// VITE_SINGLEFILE=1 → 把 JS/CSS/字体内联进单个自包含 cartridge.html
// （供 cartridge-station 打成单 HTML OS）。默认关闭，团队正常多文件 tar.gz 构建不受影响。
const singleFile = process.env.VITE_SINGLEFILE === '1';

export default defineConfig({
  plugins: [
    react(),
    ...(singleFile
      ? [inlineUsedAssets(__dirname), viteSingleFile()]   // 美术 base64 内联 + JS/CSS 内联 → 单 HTML 自带美术
      : [copyUsedAssets(__dirname, 'dist-cartridge')]),
  ],
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
