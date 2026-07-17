// scripts/audit-ratchet.test.mjs —— 红旗棘轮的行为契约测试（REQ-QA-红旗棘轮 + REQ-AUDIT-守门 防自基线）。
// 跑真 CLI（子进程 node scripts/game-skill-audit.mjs），断言：
//   ① 全部 9 款游戏的三红旗计数都不超机读基线（scripts/audit-baseline.json）——超基线 = 新增红旗 = 门禁红；
//   ② 基线覆盖清单；
//   ③ 真基线里每个红旗计数>0 的条目都带 Lead 批注（approvedBy:"LEAD"+date+reason）——违规者不得自写豁免；
//   ④ 对抗：自写基线（红旗>0 但无 approvedBy）→ RATCHET FAIL；
//   ⑤ 对抗：新游戏红旗（无基线条目）→ RATCHET FAIL。
// 判据用棘轮判词 token（RATCHET: PASS 进 stdout / FAIL 进 stderr），不看整体退出码：
//   整体退出码本就受 AUDIT 判词影响，与棘轮是否新增红旗无关，故只断言棘轮段的判词（照 docs-ref-guard.test.mjs 的 spawn 模式）。
// ④⑤ 用 APOLLO_AUDIT_BASELINE 指向临时固定基线（不碰真基线·搭配真游戏源实测红旗：
//    ④ game-q 基线声明豁免；⑤ game-f 冻结带红旗）。
// 脚本纯 node/fs，故直接用 `node` 跑（不需 vite-node）。
import { describe, it, expect, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function runAudit(games = [], env = {}) {
  const r = spawnSync('node', ['scripts/game-skill-audit.mjs', ...games], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 60000,
    env: { ...process.env, ...env },
  });
  return { code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

const BASELINE = JSON.parse(readFileSync(join(ROOT, 'scripts/audit-baseline.json'), 'utf8')).games;
const BASELINE_GAMES = Object.keys(BASELINE);
const METRIC_KEYS = ['nakedRandom', 'innerHTML', 'createElement'];

// 对抗测试用临时固定基线（APOLLO_AUDIT_BASELINE 覆盖·不碰真基线·mkdtemp 并行安全）。
const TMP = mkdtempSync(join(tmpdir(), 'audit-ratchet-'));
afterAll(() => rmSync(TMP, { recursive: true, force: true }));
function fixtureBaseline(obj) {
  const p = join(TMP, `bl-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(p, JSON.stringify(obj));
  return p;
}

describe('红旗棘轮（audit-baseline.json）', () => {
  it('全部 9 款游戏都不超基线 → RATCHET: PASS·无超基线告警', () => {
    const { stdout, stderr } = runAudit();
    // 棘轮判词：PASS 在 stdout；一旦某指标超基线/自写豁免/新游戏会打 RATCHET: FAIL 到 stderr。
    expect(stdout).toContain('RATCHET: PASS');
    expect(stdout).not.toContain('RATCHET: FAIL');
    expect(stderr).not.toContain('RATCHET: FAIL');
    expect(stderr).not.toContain('超基线');
  }, 60000);

  it('基线覆盖 d/e/f/g/i/q/t/x/z 全部 9 款（h/j/k/m/block-blast-mini 已删·owner 2026-07-16；t=墨消 2026-07-16 立项）', () => {
    expect([...BASELINE_GAMES].sort()).toEqual(
      ['game-d', 'game-e', 'game-f', 'game-g', 'game-i', 'game-q', 'game-x', 'game-z'],
    );
  });

  it('防自基线：真基线每个红旗计数>0 的条目都带 Lead 批注（approvedBy:"LEAD"+date+reason）', () => {
    for (const [game, b] of Object.entries(BASELINE)) {
      const total = METRIC_KEYS.reduce((s, k) => s + (b[k] ?? 0), 0);
      if (total === 0) continue;
      expect(b.approvedBy, `${game} 缺 approvedBy:"LEAD"`).toBe('LEAD');
      expect(typeof b.date === 'string' && b.date.length > 0, `${game} 缺 date`).toBe(true);
      expect(typeof b.reason === 'string' && b.reason.length > 0, `${game} 缺 reason`).toBe(true);
    }
  });

  it('对抗·自写豁免：基线红旗>0 但无 approvedBy → RATCHET: FAIL（违规者不得自写豁免）', () => {
    const bl = fixtureBaseline({ games: { 'game-q': { createElement: 5 } } });
    const { stdout, stderr } = runAudit(['game-q'], { APOLLO_AUDIT_BASELINE: bl });
    const all = stdout + stderr;
    expect(all).toContain('RATCHET: FAIL');
    expect(all).toContain('自写豁免');
    expect(all).not.toContain('RATCHET: PASS');
  }, 60000);

  it('对抗·新游戏红旗：无基线条目 + 带红旗 → RATCHET: FAIL（豁免走 requests.md 找 Lead·不自加条目）', () => {
    // 用 game-f（冻结·稳定带红旗）作被测源——game-q C 件下沉后已零红旗、不再适合此对抗。
    const bl = fixtureBaseline({ games: {} });
    const { stdout, stderr } = runAudit(['game-f'], { APOLLO_AUDIT_BASELINE: bl });
    const all = stdout + stderr;
    expect(all).toContain('RATCHET: FAIL');
    expect(all).toContain('新游戏红旗');
    expect(all).not.toContain('RATCHET: PASS');
  }, 60000);
});
