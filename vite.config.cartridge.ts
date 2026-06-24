import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyUsedAssets, inlineUsedAssets } from './vite.assets';
import { viteSingleFile } from 'vite-plugin-singlefile';

const targetGame = process.env.VITE_TARGET_GAME ?? 'game-f';

// 每个游戏的真名（用于把 cartridge.html 的 <title> 从 "Apollo OS" 换成游戏名）。
const GAME_TITLES: Record<string, string> = {
  'game-a': '双人协作冒险', 'game-b': '乙游视觉小说', 'game-c': '缝纫物语 · 换装三消',
  'game-d': '暗黑类 ARPG 切片', 'game-e': '小丑牌 · 卡牌构建',
  'game-f': '像素三分天下 · 自走棋', 'game-g': '翻命扑克 · 3D 掷命骨架',
};
function setTitlePlugin() {
  const title = GAME_TITLES[targetGame] ?? targetGame;
  return {
    name: 'set-cartridge-title',
    transformIndexHtml(html: string) {
      return html.replace(/<title>[^<]*<\/title>/i, `<title>${title}</title>`);
    },
  };
}
// VITE_SINGLEFILE=1 → 把 JS/CSS/字体内联进单个自包含 cartridge.html
// （供 cartridge-station 打成单 HTML OS）。默认关闭，团队正常多文件 tar.gz 构建不受影响。
const singleFile = process.env.VITE_SINGLEFILE === '1';

export default defineConfig({
  plugins: [
    react(),
    setTitlePlugin(),
    ...(singleFile
      ? [inlineUsedAssets(__dirname, targetGame), viteSingleFile()]   // 只内联本游戏美术 + JS/CSS → 单 HTML 自带美术
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
