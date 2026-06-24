import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyUsedAssets } from './vite.assets';

const targetGame = process.env.VITE_TARGET_GAME ?? 'game-f';

export default defineConfig({
  plugins: [react(), copyUsedAssets(__dirname, 'dist-cartridge')],
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
