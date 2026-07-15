import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, extname, sep } from 'path';
import { existsSync, statSync, createReadStream } from 'node:fs';
import { copyUsedAssets } from './vite.assets';

// 开发期实况伺服 public/games/** 与 public/art/**（owner 07-15 根因·立绘大叉/图标不换）：
// 这两处目录在下方 server.watch.ignored 里（避开 assets/ 3.7 万文件的启动监听风暴）。副作用是
// Vite 内建 publicDir 中间件对**dev 启动后新建/上传的美术文件视而不见** → 请求落到 SPA 兜底
// 返回 index.html（200 text/html）→ 浏览器把 HTML 当图片解码失败 → 立绘显示大叉、图标静默不换。
// 工坊「⬆ 上传本地图 / ⚡ 生成」写盘即在这些目录下 → 正撞此坑。加一条前置中间件按盘直取（防穿越·
// 与 apollo 的 _serve_public_games 同源同 content-type·no-cache），新文件无需重启 vite 即刻可见。
const ASSET_CT: Record<string, string> = {
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
};
function serveLiveGameAssets() {
  const roots: Record<string, string> = {
    '/games/': resolve(__dirname, 'public/games'),
    '/art/': resolve(__dirname, 'public/art'),
  };
  return {
    name: 'apollo-serve-live-game-assets',
    configureServer(server: { middlewares: { use: (fn: (req: { url?: string }, res: { statusCode: number; setHeader: (k: string, v: string) => void; end: (b?: string) => void } & NodeJS.WritableStream, next: () => void) => void) => void } }) {
      // 直接 use（非返回后置钩子）→ 排在 Vite 内建中间件之前，抢在 SPA 兜底之前命中真文件。
      server.middlewares.use((req, res, next) => {
        const url = (req.url || '').split('?')[0];
        const prefix = Object.keys(roots).find((p) => url.startsWith(p));
        if (!prefix) return next();
        let rel: string;
        try { rel = decodeURIComponent(url.slice(prefix.length)); } catch { return next(); }
        const base = roots[prefix];
        const target = resolve(base, rel);
        if (target !== base && !target.startsWith(base + sep)) { res.statusCode = 403; res.end('forbidden'); return; } // 防路径穿越
        if (!existsSync(target) || !statSync(target).isFile()) return next(); // 非文件 → 交回 Vite（可能是应用路由）
        res.setHeader('Content-Type', ASSET_CT[extname(target).toLowerCase()] || 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-cache');
        createReadStream(target).pipe(res);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), serveLiveGameAssets(), copyUsedAssets(__dirname, 'dist')],
  // 启动提速（owner 07-15「老开发库启动要好久」·诊断根因#1）：chokidar 缺省盯全仓 39,283 个文件，
  // 其中 assets/ 素材库就 37,004 个——listen 后初扫风暴把事件循环饿死（"ready in 270ms" 但首响应 6.6s，
  // 冷盘机器分钟级）。这些目录全是运行时 HTTP fetch 消费、无 HMR 价值 → 不监听（A/B 实测 6.63s→1.74s，
  // inotify 39,283→1,451）。用绝对路径钉根目录，**不误伤 src/assets（引擎代码要 HMR）**。
  // 代价（接受）：手改 public/games 下 JSON 不再自动整页刷新（工坊走 API 写、运行器 no-cache fetch，无感）；
  // library/<slug>/logic.ts 装载带 ?v= 版本参——PUT 后新 URL 重新 transform，不靠 watch。
  server: {
    watch: {
      ignored: [
        resolve(__dirname, 'assets') + '/**',
        resolve(__dirname, 'public/games') + '/**',
        resolve(__dirname, 'docs') + '/**',
        resolve(__dirname, 'wiki') + '/**',
        resolve(__dirname, 'library') + '/**',
        resolve(__dirname, '.apollo') + '/**',
      ],
    },
  },
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
