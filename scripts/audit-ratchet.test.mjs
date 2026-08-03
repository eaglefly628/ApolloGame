// scripts/audit-ratchet.test.mjs —— 红旗棘轮的行为契约测试（REQ-QA-红旗棘轮 + REQ-AUDIT-守门 防自基线）。
// 跑真 CLI（子进程 node scripts/game-skill-audit.mjs），断言：
//   ① 基线在册全部游戏的三红旗计数都不超机读基线（scripts/audit-baseline.json）——超基线 = 新增红旗 = 门禁红；
//   ② 基线覆盖清单；
//   ③ 真基线里每个红旗计数>0 的条目都带 Lead 批注（approvedBy:"LEAD"+date+reason）——违规者不得自写豁免；
//   ④ 对抗：自写基线（红旗>0 但无 approvedBy）→ RATCHET FAIL；
//   ⑤ 对抗：新游戏红旗（无基线条目）→ RATCHET FAIL。
// 判据用棘轮判词 token（RATCHET: PASS 进 stdout / FAIL 进 stderr），不看整体退出码：
//   整体退出码本就受 AUDIT 判词影响，与棘轮是否新增红旗无关，故只断言棘轮段的判词（照 docs-ref-guard.test.mjs 的 spawn 模式）。
// ④⑤ 用 ZEROCRAFT_AUDIT_BASELINE 指向临时固定基线（不碰真基线·搭配真游戏源实测红旗：
//    ④/⑤ 判定逻辑只看"本次实际扫到的游戏(rows)"，与真基线是否恰好记录该游戏无关——故随便挑现存游戏当
//    CLI 扫描目标即可（REQ-RETRO 批①·2026-08-03 game-f/game-q 已删，原样例换成 game-e/game-g）：
//    ④ game-e 基线声明豁免（缺 approvedBy）；⑤ game-g 真源本就带红旗（8/29/31，见 audit-baseline.json）。
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

// 对抗测试用临时固定基线（ZEROCRAFT_AUDIT_BASELINE 覆盖·不碰真基线·mkdtemp 并行安全）。
const TMP = mkdtempSync(join(tmpdir(), 'audit-ratchet-'));
afterAll(() => rmSync(TMP, { recursive: true, force: true }));
function fixtureBaseline(obj) {
  const p = join(TMP, `bl-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(p, JSON.stringify(obj));
  return p;
}

describe('红旗棘轮（audit-baseline.json）', () => {
  it('基线在册全部游戏都不超基线 → RATCHET: PASS·无超基线告警', () => {
    const { stdout, stderr } = runAudit();
    // 棘轮判词：PASS 在 stdout；一旦某指标超基线/自写豁免/新游戏会打 RATCHET: FAIL 到 stderr。
    expect(stdout).toContain('RATCHET: PASS');
    expect(stdout).not.toContain('RATCHET: FAIL');
    expect(stderr).not.toContain('RATCHET: FAIL');
    expect(stderr).not.toContain('超基线');
  }, 60000);

  it('基线覆盖 e/g/i/z 全部在册（h/j/k/m/block-blast-mini 已删·owner 2026-07-16；d/f/q/x/t 已删·owner 2026-08-03 REQ-RETRO）', () => {
    expect([...BASELINE_GAMES].sort()).toEqual(
      ['game-e', 'game-g', 'game-i', 'game-z'],
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
    // 判定只看"本次实际扫到的游戏"，与真实红旗数无关（game-e 是否真有 createElement:5 不影响本对抗）。
    const bl = fixtureBaseline({ games: { 'game-e': { createElement: 5 } } });
    const { stdout, stderr } = runAudit(['game-e'], { ZEROCRAFT_AUDIT_BASELINE: bl });
    const all = stdout + stderr;
    expect(all).toContain('RATCHET: FAIL');
    expect(all).toContain('自写豁免');
    expect(all).not.toContain('RATCHET: PASS');
  }, 60000);

  it('对抗·新游戏红旗：无基线条目 + 带红旗 → RATCHET: FAIL（豁免走 requests.md 找 Lead·不自加条目）', () => {
    // 用 game-g（真源稳定带红旗，见 audit-baseline.json 8/29/31）作被测源。
    const bl = fixtureBaseline({ games: {} });
    const { stdout, stderr } = runAudit(['game-g'], { ZEROCRAFT_AUDIT_BASELINE: bl });
    const all = stdout + stderr;
    expect(all).toContain('RATCHET: FAIL');
    expect(all).toContain('新游戏红旗');
    expect(all).not.toContain('RATCHET: PASS');
  }, 60000);
});
