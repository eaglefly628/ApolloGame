'use strict';
// electron/platform-launch.cjs — 平台打包 D3：spawn 内置 python 后端 + 健康检查 + 清理的纯函数。
// 从 electron/platform-main.cjs 里独立抽出（不 require('electron')，零 Electron 运行时依赖）——
// 好处：容器/CI 没有 GUI（Xvfb 都未必装）时，这份逻辑仍可用普通 `node` 直接冒烟验证「spawn 后端
// →健康检查→清理」这条链路真的通，不必等 D5 mac CI 才第一次跑到真机；platform-main.cjs 只管
// Electron 生命周期编排，怎么找 python/怎么判活/怎么收拾子进程全在这。

const { spawn } = require('node:child_process');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');

/**
 * 解析内置 python 可执行文件路径。
 * 打包态（resourcesPath 给了 && pybundle/bin/python3 真实存在）→ 用它——真身是 D5 mac CI 灌进
 * `resourcesPath/pybundle/bin/python3` 的可搬迁 standalone python（本仓库 scripts/build-platform.mjs
 * 目前只在 platform-dist/pybundle/ 落一个 PLACEHOLDER.md 占位，尚无真可执行文件）。
 * 找不到 → 回退系统 `python3`（dev 环境 / Linux 验证 / pybundle 还是占位时都走这条，行为明确不隐藏）。
 * @param {string|null} resourcesPath electron 打包后的 process.resourcesPath；非打包态传 null。
 * @param {NodeJS.Platform} [platform] 供单测注入，缺省 process.platform。
 */
function resolvePythonBin(resourcesPath, platform = process.platform) {
  if (resourcesPath) {
    const bin = platform === 'win32' ? 'python.exe' : 'python3';
    const bundled = path.join(resourcesPath, 'pybundle', 'bin', bin);
    if (fs.existsSync(bundled)) return bundled;
  }
  return platform === 'win32' ? 'python' : 'python3';
}

/** 挑一个当前空闲的 TCP 端口（127.0.0.1·listen(0) 让内核分配，读回来即关闭释放）。 */
function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

/**
 * spawn 内置 python 跑 `apollo.py platform`（main_entry/cli.py cmd_platform：只起 API 服务器，
 * 它现在同时伺服已构建的静态前端——见 main_entry/server.py `_serve_static`/STATIC_DIST_DIR）。
 * @param {{pythonBin:string, backendDir:string, port:number, staticDir?:string,
 *          onLog?:(line:string, stream:'stdout'|'stderr')=>void}} opts
 * @returns {import('node:child_process').ChildProcess}
 */
function spawnBackend({ pythonBin, backendDir, port, staticDir, onLog }) {
  const env = {
    ...process.env,
    APOLLO_API_PORT: String(port),
    ...(staticDir ? { APOLLO_STATIC_DIR: staticDir } : {}),
  };
  const child = spawn(pythonBin, ['apollo.py', 'platform'], { cwd: backendDir, env });
  if (onLog) {
    child.stdout.on('data', (b) => onLog(b.toString(), 'stdout'));
    child.stderr.on('data', (b) => onLog(b.toString(), 'stderr'));
  }
  return child;
}

/**
 * 轮询 GET url 直到 200（或 timeoutMs 超时 → reject）。用全局 fetch（Node 18+/Electron 内置 Node
 * 均自带，免加依赖）。
 */
async function waitForHealth(url, { timeoutMs = 20000, intervalMs = 300 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastErr;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.status === 200) return true;
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`健康检查超时（${timeoutMs}ms）：GET ${url}（最后一次错误：${lastErr && lastErr.message}）`);
}

/** 结束后端子进程：先礼后兵——SIGTERM 给它机会自己退，graceMs 内没退再 SIGKILL（防僵尸进程）。 */
function killBackend(child, graceMs = 3000) {
  if (!child || child.killed || child.exitCode !== null) return;
  child.kill('SIGTERM');
  const t = setTimeout(() => {
    if (child.exitCode === null) child.kill('SIGKILL');
  }, graceMs);
  if (t.unref) t.unref();
}

module.exports = { resolvePythonBin, findFreePort, spawnBackend, waitForHealth, killBackend };
