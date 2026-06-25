import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyUsedAssets, inlineUsedAssets } from './vite.assets';

const targetGame = process.env.VITE_TARGET_GAME ?? 'game-f';

// 每个游戏的真名（用于把 cartridge.html 的 <title> 从 "Apollo OS" 换成游戏名）。
const GAME_TITLES: Record<string, string> = {
  'game-e': '小丑牌 · 卡牌构建',
  'game-f': '像素三分天下 · 自走棋', 'game-g': '翻命扑克 · 3D 掷命骨架',
  'game-i': '控件测试场 · 数据驱动 UI',
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

// 配置写成 async：vite-plugin-singlefile 仅单文件模式按需 import —— 桌面版(Mac/Win)
// 不依赖它、未装也能编译；只有单 HTML 构建才需要（先 npm install 拉取）。
export default defineConfig(async () => ({
  plugins: [
    react(),
    setTitlePlugin(),
    ...(singleFile
      ? [inlineUsedAssets(__dirname, targetGame), (await import('vite-plugin-singlefile')).viteSingleFile()]
      : [copyUsedAssets(__dirname, 'dist-cartridge')]),
  ],
  root: '.',
  base: './',
  build: {
    outDir: 'dist-cartridge',
    emptyOutDir: true,
    // 单文件模式：把所有资产（字体等 import 的）内联成 data URI，整进单 HTML；
    // 多文件模式用默认阈值（字体仍走外部文件，设备 http.server 部署不变）。
    assetsInlineLimit: singleFile ? 100_000_000 : 4096,
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
}));
