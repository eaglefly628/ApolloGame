// electron/platform-launch.cjs 纯函数单测（platform-packaging-spec.md D3）。
// 不起真 Electron/真 python 后端（那是 scripts/platform-launch-smoke.mjs 端到端的活）；
// 这里只钉：路径解析规则 / 端口分配 / 清理函数的幂等性。CJS 模块被 vitest 当 ESM 默认导入
// 消费——Node 的 cjs-module-lexer 能从 `module.exports = {a,b,c}` 静态识别具名导出，
// import { x } from '*.cjs' 天然可用（build-platform 生态里 scripts/platform-launch-smoke.mjs
// 已验证同一份 interop 路径在真实端到端场景里也走得通）。
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  resolvePythonBin, findFreePort, killBackend,
} from './platform-launch.cjs';
import net from 'node:net';

describe('resolvePythonBin · 内置 python 路径解析', () => {
  it('未打包（resourcesPath=null）→ 回退系统 python3', () => {
    expect(resolvePythonBin(null)).toBe('python3');
  });

  it('打包但 pybundle/bin/python3 不存在（占位阶段）→ 回退系统 python3', () => {
    expect(resolvePythonBin('/nonexistent/resources/path')).toBe('python3');
  });

  it('打包且 pybundle/bin/python3 真实存在 → 用内置那份（不回退）', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pybundle-'));
    try {
      mkdirSync(join(dir, 'pybundle', 'bin'), { recursive: true });
      const bin = join(dir, 'pybundle', 'bin', 'python3');
      writeFileSync(bin, '#!/bin/sh\n');
      expect(resolvePythonBin(dir)).toBe(bin);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('Windows 平台找 python.exe（供单测跨平台核验·不依赖真机 OS）', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pybundle-win-'));
    try {
      mkdirSync(join(dir, 'pybundle', 'bin'), { recursive: true });
      writeFileSync(join(dir, 'pybundle', 'bin', 'python.exe'), '');
      expect(resolvePythonBin(dir, 'win32')).toBe(join(dir, 'pybundle', 'bin', 'python.exe'));
      // 没有内置文件时 win32 的系统回退是 'python' 不是 'python3'。
      expect(resolvePythonBin(null, 'win32')).toBe('python');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('findFreePort · 端口分配', () => {
  it('返回一个可用端口号（1~65535 区间的整数）', async () => {
    const port = await findFreePort();
    expect(Number.isInteger(port)).toBe(true);
    expect(port).toBeGreaterThan(0);
    expect(port).toBeLessThan(65536);
  });

  // ── 2026-09-28 换机制（原断言 `a !== b` 在全量并发下实测翻红·单跑 5/5 绿）──────────────────
  // 原注释写「万一撞号说明端口没被正确关闭，值得追查」——**因果反了**：`findFreePort` 就是
  // listen(0) 拿号后立刻 close 释放；号被正确释放之后，内核**完全可以**把同一个号再发一次。
  // 撞号是「关闭成功」的证据，不是 bug。所以那条断言在测它自己声称的反面，且天生随机翻红
  // （并发跑时别的测试在抢端口，撞号概率更高）——正是 CLAUDE.md 说的「给 CI 埋雷」。
  //
  // 真正要守的不变量只有两条，两条都确定、都不靠运气：
  //   ① 拿回来的号**真能 bind**（这才是调用方唯一在乎的事）；
  //   ② 某个号**正被占用**时，不会把它发给你（否则后端起不来）。
  //      ②要在「第一个还开着」的时候问第二个——原测试把第一个关掉了，所以它连②也没测到。
  it('拿回来的端口真能 bind（这才是调用方在乎的事）', async () => {
    const port = await findFreePort();
    const srv = net.createServer();
    await new Promise((res, rej) => { srv.on('error', rej); srv.listen(port, '127.0.0.1', res); });
    expect(srv.address().port).toBe(port);
    await new Promise((res) => srv.close(res));
  });

  it('★ 端口正被占用时不会再发同一个号（后端才起得来）', async () => {
    const held = net.createServer();
    const first = await findFreePort();
    await new Promise((res, rej) => { held.on('error', rej); held.listen(first, '127.0.0.1', res); });
    try {
      // 第一个**还开着**时连问 5 次：一次都不该给出那个被占用的号（确定性·非概率断言）
      for (let i = 0; i < 5; i++) expect(await findFreePort()).not.toBe(first);
    } finally {
      await new Promise((res) => held.close(res));
    }
  });
});

describe('killBackend · 清理幂等性', () => {
  it('child 为 null/undefined → 安全跳过，不抛异常', () => {
    expect(() => killBackend(null)).not.toThrow();
    expect(() => killBackend(undefined)).not.toThrow();
  });

  it('child 已标记 killed → 安全跳过（不重复 kill）', () => {
    let killCalls = 0;
    const fakeChild = { killed: true, exitCode: null, kill: () => { killCalls++; } };
    killBackend(fakeChild);
    expect(killCalls).toBe(0);
  });

  it('child 已退出（exitCode 非 null）→ 安全跳过', () => {
    let killCalls = 0;
    const fakeChild = { killed: false, exitCode: 0, kill: () => { killCalls++; } };
    killBackend(fakeChild);
    expect(killCalls).toBe(0);
  });

  it('存活的 child → 发 SIGTERM（graceMs 给够大，测试自身跑不到 SIGKILL 兜底那步）', () => {
    const calls = [];
    const fakeChild = { killed: false, exitCode: null, kill: (sig) => calls.push(sig) };
    killBackend(fakeChild, 999999);
    expect(calls).toEqual(['SIGTERM']);
  });
});
