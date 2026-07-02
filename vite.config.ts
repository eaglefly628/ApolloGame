import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyUsedAssets } from './vite.assets';

export default defineConfig({
  plugins: [react(), copyUsedAssets(__dirname, 'dist')],
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
  // 3D 渲染线的重依赖藏在**动态 import 的 3D 游戏**背后。Vite 冷启动扫描会跟进动态 import 把 three
  // 核预打包（.vite/deps 里已见 three.js），但 three/addons/* 这些深子路径常被漏扫 → 首次开 3D 游戏
  // 才现发现 → 触发"依赖再优化 + 整页 reload"（launcher.tsx:716 那条"依赖再优化把人弹回主页"即此症）。
  // 预声明全部深子路径，逼 Vite 冷启动一次性预打包、之后不再中途重优化——开 3D 游戏不再卡一下/弹一下。
  // three 本就在预打包集里（此处不增冷启动成本，只补齐 addons）；列表 = 源码实际 import 的那些，改依赖时同步。
  optimizeDeps: {
    include: [
      'three',
      'cannon-es',
      'three/addons/environments/RoomEnvironment.js',
      'three/addons/loaders/GLTFLoader.js',
      'three/addons/geometries/ConvexGeometry.js',
      'three/addons/utils/SkeletonUtils.js',
      'three/addons/postprocessing/EffectComposer.js',
      'three/addons/postprocessing/RenderPass.js',
      'three/addons/postprocessing/ShaderPass.js',
      'three/addons/postprocessing/UnrealBloomPass.js',
      'three/addons/postprocessing/GTAOPass.js',
      'three/addons/postprocessing/OutputPass.js',
      'three/addons/postprocessing/SMAAPass.js',
      'three/addons/shaders/HorizontalTiltShiftShader.js',
      'three/addons/shaders/VerticalTiltShiftShader.js',
    ],
  },
  test: {
    // 排除并行 Programmer 的 worktree 副本（.claude/worktrees）——否则 vitest 会把副本里的
    // 测试也扫进来、测试数虚高（曾出现 1515 假象）。保留默认的 node_modules/dist 排除。
    exclude: ['**/node_modules/**', '**/dist/**', '**/.claude/**'],
  },
});
