#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  scripts/platform-launch-smoke.mjs —— electron/platform-launch.cjs 的无 GUI 冒烟验证
//  （platform-packaging-spec.md D3·Linux 验证条款：容器里 Xvfb 未必能真跑起 electron GUI，
//  这里绕开 Electron 本身，直接用普通 node 跑同一套 spawn→健康检查→curl→清理 逻辑，
//  证「后端真被 electron 会用的那条路径 spawn 起来了」而不是另起一套验证代码路径）。
//
//  用法：node scripts/platform-launch-smoke.mjs [platform-dist 目录，缺省 ./platform-dist]
//  退出码：0=PASS；非 0=某一步失败（stderr 说明失败在哪一步）。
// ═══════════════════════════════════════════════════════════════

import { existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  resolvePythonBin, findFreePort, spawnBackend, waitForHealth, killBackend,
} from '../electron/platform-launch.cjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function log(msg) { process.stdout.write(`[platform-launch-smoke] ${msg}\n`); }

async function main(argv) {
  const backendDir = resolve(argv[0] || join(ROOT, 'platform-dist'));
  if (!existsSync(join(backendDir, 'zerocraft.py'))) {
    throw new Error(`后端目录缺 zerocraft.py：${backendDir}（先跑 node scripts/build-platform.mjs）`);
  }

  log(`resolvePythonBin(null) → dev/Linux 回退系统 python3（resourcesPath 传 null 模拟未打包态）…`);
  const pythonBin = resolvePythonBin(null);
  log(`  → ${pythonBin}`);

  log('findFreePort() …');
  const port = await findFreePort();
  log(`  → ${port}`);

  const staticDir = join(backendDir, 'dist');
  log(`spawnBackend()（cwd=${backendDir}）…`);
  const child = spawnBackend({
    pythonBin, backendDir, port, staticDir,
    onLog: (line, stream) => process.stdout.write(`  [backend:${stream}] ${line}`),
  });
  let exited = false;
  child.on('exit', () => { exited = true; });
  child.on('error', (e) => { throw e; });

  try {
    const url = `http://127.0.0.1:${port}/`;
    log(`waitForHealth(${url}) …`);
    await waitForHealth(url, { timeoutMs: 20000 });
    log('  → 200 OK（同 electron loadURL 前置条件一致：后端已同端口伺服前端静态 + /api/*）');

    log('curl 复核（GET / 与 GET /api/version）…');
    const root = await fetch(url);
    const rootBody = await root.text();
    if (!rootBody.includes('<div id="app">')) throw new Error('GET / 返回体不像 studio launcher 的 index.html');
    log(`  GET / → ${root.status}（${rootBody.length} 字节，含 #app 挂载点 ✓）`);

    const ver = await fetch(`${url}api/version`);
    const verBody = await ver.json();
    log(`  GET /api/version → ${ver.status} ${JSON.stringify(verBody)}`);
    if (ver.status !== 200) throw new Error('GET /api/version 非 200');
  } finally {
    log('killBackend() 清理子进程…');
    killBackend(child);
    const deadline = Date.now() + 5000;
    while (!exited && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100));
    log(`  子进程已退出：${exited}`);
    if (!exited) throw new Error('killBackend 后子进程 5s 内未退出——可能有僵尸风险');
  }

  log('PASS —— spawn 后端 → 健康检查 → curl 验证内容 → 清理子进程，全链路通。');
}

main(process.argv.slice(2)).catch((e) => {
  process.stderr.write(`[platform-launch-smoke] FAIL: ${e instanceof Error ? e.stack || e.message : String(e)}\n`);
  process.exit(1);
});
