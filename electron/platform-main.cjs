'use strict';
// Electron 平台主进程（docs/workflow/platform-packaging-spec.md D3·核心编排层）——
// 启动 → spawn 内置 python 后端（apollo.py platform，同端口伺服已构建前端 + /api/*）
// → 轮询健康检查 → loadURL(127.0.0.1:port) → 窗口关闭/quit 时 kill 后端子进程（防僵尸）。
//
// 别动现有单游戏 electron/main.cjs（dist-cartridge 单卡带先例，产物形态完全不同）——
// 这是独立的新入口，两者不共用生命周期/不互相 require。
// CJS 扩展名同 main.cjs 的理由：package.json "type":"module" 会让裸 .js 当 ESM 解析而炸。

const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const {
  resolvePythonBin, findFreePort, spawnBackend, waitForHealth, killBackend,
} = require('./platform-launch.cjs');

let backendProc = null;

/**
 * 后端源码 + 已构建前端所在目录。
 * 打包态：D5（mac CI·electron-builder）约定把 `platform-dist/**` 整棵通过 extraResources 搬进
 * `resourcesPath/backend/`——这条路径尚未接线（D5 未做·见交付说明「留给 D5」），先按约定写好，
 * 真正验证要等 electron-builder 配置落地。
 * dev / 本仓库 Linux 验证：直接读仓库自己 `node scripts/build-platform.mjs` 产出的 platform-dist/。
 */
function resolveBackendDir() {
  if (app.isPackaged) return path.join(process.resourcesPath, 'backend');
  return path.join(__dirname, '..', 'platform-dist');
}

async function startBackendAndWindow() {
  const backendDir = resolveBackendDir();
  if (!fs.existsSync(path.join(backendDir, 'apollo.py'))) {
    throw new Error(
      `后端目录缺 apollo.py：${backendDir}\n`
      + '（先跑一次 `node scripts/build-platform.mjs` 组装 platform-dist/，dev 模式才有得读）',
    );
  }
  const resourcesPath = app.isPackaged ? process.resourcesPath : null;
  const pythonBin = resolvePythonBin(resourcesPath);
  const port = await findFreePort();
  const staticDir = path.join(backendDir, 'dist'); // vite build 产物（studio launcher）

  console.log('[platform-main] spawn 后端', { pythonBin, backendDir, port, staticDir });
  backendProc = spawnBackend({
    pythonBin,
    backendDir,
    port,
    staticDir,
    onLog: (line, stream) => console.log(`[backend:${stream}]`, line.trimEnd()),
  });
  backendProc.on('exit', (code, signal) => {
    console.log('[platform-main] 后端进程退出', { code, signal });
  });
  backendProc.on('error', (err) => {
    console.error('[platform-main] 后端进程 spawn 失败', err);
  });

  const url = `http://127.0.0.1:${port}/`;
  await waitForHealth(url, { timeoutMs: 20000 });
  console.log('[platform-main] 健康检查通过 →', url);

  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    backgroundColor: '#050510',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });
  win.loadURL(url);
  win.once('ready-to-show', () => win.show());
  return win;
}

app.whenReady().then(() => {
  startBackendAndWindow().catch((e) => {
    console.error('[platform-main] 启动失败:', e);
    killBackend(backendProc);
    app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      startBackendAndWindow().catch((e) => console.error('[platform-main] 重开窗口失败:', e));
    }
  });
});

// 窗口全关（非 mac）/ 应用退出前 / 进程退出：都要收后端子进程，防止 electron 关了、
// python 还占着端口在后台空跑成僵尸（BYO-key 明文配置只在本机、常驻进程也是隐性风险面）。
app.on('window-all-closed', () => {
  killBackend(backendProc);
  if (process.platform !== 'darwin') app.quit();
});
app.on('before-quit', () => killBackend(backendProc));
process.on('exit', () => killBackend(backendProc));

// Linux 真机实测过的口子（不是纸面假设）：外部直接 SIGTERM/SIGINT 主进程（装机管理器杀应用、
// `kill <pid>`、CI 收尾）**不会**触发上面几个 Electron 生命周期事件——Node 的 'exit' 事件本身
// 也只在"正常退出"时触发，被信号杀掉时不保证跑到。实测复现过：外部 kill -9 electron 主进程后，
// `python3 apollo.py platform` 子进程原地变孤儿继续跑（xvfb-run + node smoke 交叉验证时抓到）。
// 显式接管这两个信号、手动 killBackend 后再退出，才是这条清理路径的真正兜底。
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    console.log(`[platform-main] 收到 ${sig} → 清理后端子进程后退出`);
    killBackend(backendProc);
    app.quit();
    setTimeout(() => process.exit(0), 500).unref();
  });
}
