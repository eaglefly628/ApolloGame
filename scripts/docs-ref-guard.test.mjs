// scripts/docs-ref-guard.test.mjs —— docs-ref-guard CLI 的行为契约测试。
// 跑真 CLI（子进程 node），断言退出码 + 判词 token：
//   ① 真文档（docs/roles+playbooks+qa）全绿 → exit 0 + DOCS-REF: PASS；
//   ② fixture 里坏路径 → exit 1 + 点名断链；
//   ③ fixture 里 agent/技能名近似拼写 → exit 1；
//   ④ 真路径 + 占位符 fixture → exit 0（占位符自动放行）。
// 脚本纯 node/fs，故直接用 `node` 跑（不需 vite-node）。
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function runGuard(...args) {
  const r = spawnSync('node', ['scripts/docs-ref-guard.mjs', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 60000,
  });
  return { code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

let tmp;
beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), 'drg-'));
  // 干净：真路径 + 占位符（占位符须自动放行）
  writeFileSync(
    join(tmp, 'clean.md'),
    '# clean\n`docs/roles/index.md`、`src/engine/protocol/components.ts`、占位符 `docs/design/<game>/gdd.md`。\n',
  );
  // 坏路径
  writeFileSync(join(tmp, 'badpath.md'), '# bad\n`docs/roles/does-not-exist.md`\n');
  // agent/技能名近似拼写（asset-manager 的错字）
  writeFileSync(join(tmp, 'badname.md'), '# typo\n用 `asset-managr` 处理资产。\n');
});
afterAll(() => {
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

describe('docs-ref-guard CLI', () => {
  it('真文档全绿 → exit 0 + DOCS-REF: PASS', () => {
    const { code, stdout } = runGuard();
    expect(code).toBe(0);
    expect(stdout).toContain('DOCS-REF: PASS');
  }, 60000);

  it('真路径 + 占位符 fixture → exit 0（占位符自动放行）', () => {
    const { code, stdout } = runGuard(join(tmp, 'clean.md'));
    expect(code).toBe(0);
    expect(stdout).toContain('DOCS-REF: PASS');
  }, 60000);

  it('坏路径 fixture → exit 1 + 点名断链', () => {
    const { code, stderr } = runGuard(join(tmp, 'badpath.md'));
    expect(code).toBe(1);
    expect(stderr).toContain('docs/roles/does-not-exist.md');
    expect(stderr).toContain('DOCS-REF: FAIL');
  }, 60000);

  it('agent/技能名近似拼写 fixture → exit 1', () => {
    const { code, stderr } = runGuard(join(tmp, 'badname.md'));
    expect(code).toBe(1);
    expect(stderr).toContain('asset-managr');
  }, 60000);
});
