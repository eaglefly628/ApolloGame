// scripts/test-hygiene-check.test.mjs —— 测试三禁体检的自测（测试加固批·2026-08-24）。
// 病：本守卫在门禁面旗 testHygiene 里被点名跑，却全库零自测——「守卫自己坏了没人知道」
// 正是 REQ-GUARDGATE 要治的形状。两腿 spawn 真跑（红腿本身=撤修验红：期望非零退出码）。
//
// hermetic 机制：守卫的扫描根是 cwd 相对的 `src`（ROOT = 'src'），故 spawn 时把 cwd 指到
// 临时树即完成根注入——零改守卫、缺省行为天然不变（真仓门禁照旧在仓根跑）。无需加 --root。
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const GUARD = join(dirname(fileURLToPath(import.meta.url)), 'test-hygiene-check.mjs');
const withTree = (fn) => {
  const root = mkdtempSync(join(tmpdir(), 'hygiene-check-'));
  try { return fn(root); } finally { rmSync(root, { recursive: true, force: true }); }
};
const run = (cwd) => spawnSync(process.execPath, [GUARD], { cwd, encoding: 'utf8', timeout: 30000 });

describe('test-hygiene-check · CLI 两腿（临时树·真 spawn）', () => {
  it('种一个三禁违例文件（墙钟 + 外部 IO + 裸随机）→ exit 1 · 判词 FAIL · 三规则全点名', () => withTree((root) => {
    mkdirSync(join(root, 'src'), { recursive: true });
    // 路径避开白名单条目（src/debug/debug.test.ts 是 naked-random 的有意例外）。
    writeFileSync(join(root, 'src', 'evil.test.ts'), [
      "it('bad', async () => {",
      '  await new Promise((r) => setTimeout(r, 100));', // ① 真时间等待（无 vi.useFakeTimers）
      "  const res = await fetch('https://example.com');", // ② 外部 IO 直连（无 mock/stub）
      '  const roll = Math.random();', // ③ 裸随机
      '});',
    ].join('\n'));
    const r = run(root);
    expect(r.status, r.stdout + r.stderr).toBe(1); // 撤修验红本体：守卫失能则这里等不到 1
    expect(r.stdout).toContain('HYGIENE: FAIL');
    expect(r.stdout).toContain('硬违规');
    for (const rule of ['time-wait', 'external-io', 'naked-random']) expect(r.stdout).toContain(rule);
  }));

  it('干净树（受控测试：fake timers + 无 IO + 无裸随机）→ exit 0 · 判词 PASS', () => withTree((root) => {
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'src', 'clean.test.ts'), [
      "it('ok', () => {",
      '  expect(1 + 1).toBe(2);',
      '});',
    ].join('\n'));
    const r = run(root);
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(r.stdout).toContain('HYGIENE: PASS');
  }));
});
