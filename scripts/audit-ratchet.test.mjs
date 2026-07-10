// scripts/audit-ratchet.test.mjs —— 红旗棘轮的行为契约测试（REQ-QA-红旗棘轮）。
// 跑真 CLI（子进程 node scripts/game-skill-audit.mjs），断言全部 8 款游戏的三红旗
// 计数（裸Math.random / innerHTML / document.createElement）都不超机读基线
// （scripts/audit-baseline.json）——超基线 = 新增红旗 = 门禁红。
// 判据用棘轮判词 token（RATCHET: PASS 进 stdout / FAIL 进 stderr），不看整体退出码：
//   整体退出码本就受既有 AUDIT: FAIL（存量红海）影响=1，与棘轮是否新增红旗无关，
//   故只断言棘轮段的判词（照 docs-ref-guard.test.mjs 的 spawn 模式）。
// 脚本纯 node/fs，故直接用 `node` 跑（不需 vite-node）。
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { readFileSync } from 'node:fs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function runAudit(...games) {
  const r = spawnSync('node', ['scripts/game-skill-audit.mjs', ...games], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 60000,
  });
  return { code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

const BASELINE_GAMES = Object.keys(
  JSON.parse(readFileSync(join(ROOT, 'scripts/audit-baseline.json'), 'utf8')).games,
);

describe('红旗棘轮（audit-baseline.json）', () => {
  it('全部 8 款游戏都不超基线 → RATCHET: PASS·无超基线告警', () => {
    const { stdout, stderr } = runAudit();
    // 棘轮判词：PASS 在 stdout；一旦某指标超基线会打 RATCHET: FAIL 到 stderr。
    expect(stdout).toContain('RATCHET: PASS');
    expect(stdout).not.toContain('RATCHET: FAIL');
    expect(stderr).not.toContain('RATCHET: FAIL');
    expect(stderr).not.toContain('超基线');
  }, 60000);

  it('基线覆盖 d/e/f/g/h/i/j/k/m/q/x/z 全部 12 款', () => {
    expect([...BASELINE_GAMES].sort()).toEqual(
      ['game-d', 'game-e', 'game-f', 'game-g', 'game-h', 'game-i', 'game-j', 'game-k', 'game-m', 'game-q', 'game-x', 'game-z'],
    );
  });
});
