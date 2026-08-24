// art-ledger-guard 自检（REQ-ARTPIPE2 A1）：黑户 / 死账 / 缺来源 三判各 ≥2 例 + 棘轮增红减绿
// + servedPath 非标准树（game-d 式 `/art/<game>/…`）不误判。全用临时目录合成 fixture，零碰真仓库数据。
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  blackHouseholdFiles, deadAccountRows, missingProvenanceRows,
  discoverArtRoots, auditGame, discoverGames, ratchetCheck,
  readArtIndex, indexEntryHasProvenance, indexCoveredPaths,
} from './art-ledger-guard.mjs';

const withRoot = (fn) => {
  const r = mkdtempSync(join(tmpdir(), 'art-ledger-guard-'));
  try { return fn(r); } finally { rmSync(r, { recursive: true, force: true }); }
};

/** 在临时根下建 `public/games/<game>/art/<relPath>`，写入任意字节内容。 */
function putFile(root, game, relPath) {
  const abs = join(root, 'public', 'games', game, 'art', relPath);
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, Buffer.from([0x89, 0x50]));
}

describe('REQ-ARTPIPE2 A1 · 黑户判定', () => {
  it('磁盘有文件、台账任何行任何 servedPath 都没提过 → 黑户', () => withRoot((root) => {
    putFile(root, 'game-x', 'icons/lost.png');
    const ledger = { rows: [], pending: [] };
    const bh = blackHouseholdFiles(root, 'game-x', ledger);
    expect(bh).toContain('/games/game-x/art/icons/lost.png');
  }));

  it('磁盘有文件、行 gen.servedPath 精确指到它 → 不是黑户', () => withRoot((root) => {
    putFile(root, 'game-x', 'icons/found.png');
    const ledger = { rows: [{ no: 'art-01', gen: { servedPath: '/games/game-x/art/icons/found.png' } }], pending: [] };
    const bh = blackHouseholdFiles(root, 'game-x', ledger);
    expect(bh).not.toContain('/games/game-x/art/icons/found.png');
  }));

  it('只被 ref.servedPath（非 gen.servedPath）提过的历史/占位文件 → 仍算已入账·不是黑户', () => withRoot((root) => {
    putFile(root, 'game-x', 'ui/old-placeholder.svg');
    // 行的「当前真相」gen.servedPath 已指向别处（例如后来被替换），但 ref.servedPath 仍留痕旧文件——
    // 深扫任意 servedPath 字段即视为「台账提过」，不当黑户（game-c art-017 真实场景同构）。
    const ledger = {
      rows: [{
        no: 'art-01',
        ref: { servedPath: '/games/game-x/art/ui/old-placeholder.svg' },
        gen: { servedPath: '/games/game-x/art/gen/replaced.png' },
      }],
      pending: [],
    };
    const bh = blackHouseholdFiles(root, 'game-x', ledger);
    expect(bh).not.toContain('/games/game-x/art/ui/old-placeholder.svg');
  }));
});

/** 在临时根下写 `public/games/<game>/art/index.json`（{version:1, assets} 真实格式）。 */
function putIndex(root, game, assets) {
  const abs = join(root, 'public', 'games', game, 'art', 'index.json');
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, JSON.stringify({ version: 1, assets }));
}

describe('REQ-ARTGUARD · 判据②：索引记账（path 命中 + 来源登记）免黑户', () => {
  it('腿一：索引条目 path 命中 + `provenance` 对象存在 → 免罪；同目录无索引条目的文件仍黑', () => withRoot((root) => {
    putFile(root, 'game-x', 'cards/ace.svg');
    putFile(root, 'game-x', 'cards/stray.svg'); // 索引没提过的邻居——判据②绝不顺带赦免
    putIndex(root, 'game-x', [{
      id: 'card/ace', type: 'texture', status: 'filled',
      path: '/games/game-x/art/cards/ace.svg',
      provenance: { pulledFrom: 'https://example.com/AC.svg', license: 'Public Domain', date: '2026-07-17' },
    }]);
    const bh = blackHouseholdFiles(root, 'game-x', { rows: [], pending: [] });
    expect(bh).not.toContain('/games/game-x/art/cards/ace.svg');
    expect(bh).toContain('/games/game-x/art/cards/stray.svg');
  }));

  it('腿一变体：无 provenance 但 `license`+`source` 双齐 → 同样免罪', () => withRoot((root) => {
    putFile(root, 'game-x', 'fx/flame.png');
    putIndex(root, 'game-x', [{
      id: 'fx/flame', type: 'texture', status: 'filled',
      path: '/games/game-x/art/fx/flame.png',
      license: 'CC0', source: 'apollo-procedural',
    }]);
    const bh = blackHouseholdFiles(root, 'game-x', { rows: [], pending: [] });
    expect(bh).not.toContain('/games/game-x/art/fx/flame.png');
  }));

  it('腿二：path 命中但**无来源登记**（无 provenance·无 license/source）→ 仍黑（只挂 path 不免罪）', () => withRoot((root) => {
    putFile(root, 'game-x', 'ui/naked.svg');
    putIndex(root, 'game-x', [{
      id: 'ui/naked', type: 'texture', status: 'filled',
      path: '/games/game-x/art/ui/naked.svg',
    }]);
    const bh = blackHouseholdFiles(root, 'game-x', { rows: [], pending: [] });
    expect(bh).toContain('/games/game-x/art/ui/naked.svg');
  }));

  it('腿二边界：license 有 source 无（双齐不成立）→ 仍黑；provenance 是字符串非对象 → 仍黑', () => withRoot((root) => {
    putFile(root, 'game-x', 'ui/half.svg');
    putFile(root, 'game-x', 'ui/strprov.svg');
    putIndex(root, 'game-x', [
      { id: 'ui/half', path: '/games/game-x/art/ui/half.svg', license: 'CC0' }, // source 缺
      { id: 'ui/strprov', path: '/games/game-x/art/ui/strprov.svg', provenance: 'legacy-string' }, // 非对象
    ]);
    const bh = blackHouseholdFiles(root, 'game-x', { rows: [], pending: [] });
    expect(bh).toContain('/games/game-x/art/ui/half.svg');
    expect(bh).toContain('/games/game-x/art/ui/strprov.svg');
    expect(indexEntryHasProvenance({ license: 'CC0' })).toBe(false);
    expect(indexEntryHasProvenance({ provenance: 'legacy-string' })).toBe(false);
    expect(indexEntryHasProvenance({ license: 'CC0', source: 'apollo-procedural' })).toBe(true);
    expect(indexEntryHasProvenance({ provenance: { pulledFrom: 'x' } })).toBe(true);
  }));

  it('索引缺失/解析失败 → 空索引不抛错·判据②不参与（行为同旧规则）', () => withRoot((root) => {
    putFile(root, 'game-x', 'icons/lonely.png');
    expect(readArtIndex(root, 'game-x')).toEqual({ assets: [] }); // 无 index.json
    writeFileSync(join(root, 'public', 'games', 'game-x', 'art', 'index.json'), '{broken');
    expect(readArtIndex(root, 'game-x')).toEqual({ assets: [] }); // 坏 JSON 同空
    const bh = blackHouseholdFiles(root, 'game-x', { rows: [], pending: [] });
    expect(bh).toContain('/games/game-x/art/icons/lonely.png');
  }));

  it('indexCoveredPaths 只收「path 非空 + 有登记」的条目（auditGame 全链默认接入索引）', () => withRoot((root) => {
    const covered = indexCoveredPaths({ assets: [
      { path: '/a.png', provenance: { x: 1 } },
      { path: '/b.png', license: 'CC0', source: 's' },
      { path: '/c.png' },            // 无登记 → 不入
      { path: '', license: 'CC0', source: 's' }, // 空 path → 不入
      { license: 'CC0', source: 's' },           // 无 path → 不入
    ] });
    expect([...covered].sort()).toEqual(['/a.png', '/b.png']);
    // 全链：auditGame（不显式传 index）也走判据②
    putFile(root, 'game-x', 'cards/king.svg');
    putIndex(root, 'game-x', [{ id: 'card/king', path: '/games/game-x/art/cards/king.svg', license: 'Public Domain', source: 'notpeter/Vector-Playing-Cards' }]);
    const r = auditGame(root, 'game-x');
    expect(r.blackHouseholds).not.toContain('/games/game-x/art/cards/king.svg');
  }));
});

describe('REQ-ARTPIPE2 A1 · 死账判定（只认 gen.servedPath = 当前真相）', () => {
  it('行 gen.servedPath 指路径磁盘无此文件 → 死账', () => withRoot((root) => {
    const ledger = { rows: [{ no: 'art-09', gen: { servedPath: '/games/game-x/art/gen/missing.png' } }], pending: [] };
    const dead = deadAccountRows(root, ledger);
    expect(dead.map((d) => d.no)).toContain('art-09');
  }));

  it('行 gen.servedPath 指路径磁盘有文件 → 不是死账', () => withRoot((root) => {
    putFile(root, 'game-x', 'gen/present.png');
    const ledger = { rows: [{ no: 'art-10', gen: { servedPath: '/games/game-x/art/gen/present.png' } }], pending: [] };
    const dead = deadAccountRows(root, ledger);
    expect(dead.map((d) => d.no)).not.toContain('art-10');
  }));

  it('旧占位路径（ref.servedPath）失效不算死账——死账严格只看 gen.servedPath', () => withRoot((root) => {
    putFile(root, 'game-x', 'gen/current.png'); // 当前真相文件在
    const ledger = {
      rows: [{
        no: 'art-11',
        ref: { servedPath: '/games/game-x/art/ui/never-existed.svg' }, // 历史占位路径，从未落盘也无妨
        gen: { servedPath: '/games/game-x/art/gen/current.png' },
      }],
      pending: [],
    };
    expect(deadAccountRows(root, ledger).map((d) => d.no)).not.toContain('art-11');
  }));
});

describe('REQ-ARTPIPE2 A1 · 缺来源判定（已产出·非程序化·无 provenance）', () => {
  it('gen.servedPath 有文件、来源非 procedural、无 provenance → 缺来源', () => {
    const ledger = { rows: [{ no: 'art-20', gen: { source: 'user-upload', servedPath: '/games/game-x/art/gen/a.png' } }], pending: [] };
    const mp = missingProvenanceRows(ledger);
    expect(mp.map((m) => m.no)).toContain('art-20');
  });

  it('同上但带 provenance（对象或字面量字符串皆算已登记）→ 不缺来源', () => {
    const ledger = {
      rows: [
        { no: 'art-21', gen: { source: 'user-upload', servedPath: '/games/game-x/art/gen/b.png' }, provenance: { license: 'CC0', source: 'owner' } },
        { no: 'art-22', gen: { source: 'twemoji', servedPath: '/games/game-x/art/gen/c.png' }, provenance: 'unknown-legacy' },
      ],
      pending: [],
    };
    const mp = missingProvenanceRows(ledger);
    expect(mp.map((m) => m.no)).not.toContain('art-21');
    expect(mp.map((m) => m.no)).not.toContain('art-22');
  });

  it('程序化来源（source 含 procedural）即便无 provenance 也不算缺来源（确定性脚本自解释）', () => {
    const ledger = { rows: [{ no: 'art-23', gen: { source: 'procedural', servedPath: '/games/game-x/art/gen/d.svg' } }], pending: [] };
    expect(missingProvenanceRows(ledger).map((m) => m.no)).not.toContain('art-23');
  });
});

describe('REQ-ARTPIPE2 A1 · servedPath 非标准树不误判（game-d 式 `/art/<game>/…`）', () => {
  it('非标准根下被行 gen.servedPath 覆盖的文件不是黑户；同根下未覆盖的新文件仍被抓', () => withRoot((root) => {
    // 真文件落在 public/art/game-d/**（不是 public/games/game-d/art/**）——game-d 真实拓扑。
    const nonstdAbs = join(root, 'public', 'art', 'game-d', 'elements', 'an.png');
    mkdirSync(join(nonstdAbs, '..'), { recursive: true });
    writeFileSync(nonstdAbs, Buffer.from([0x89, 0x50]));
    const strayAbs = join(root, 'public', 'art', 'game-d', 'elements', 'stray.png');
    writeFileSync(strayAbs, Buffer.from([0x89, 0x50]));

    const ledger = { rows: [{ no: 'art-01', gen: { servedPath: '/art/game-d/elements/an.png' } }], pending: [] };

    // discoverArtRoots 必须从行的 servedPath 反推出这棵非标准树（附加于恒扫的标准根之外）。
    const roots = discoverArtRoots(root, 'game-d', ledger);
    expect(roots.some((r) => r.servedPrefix === '/art/game-d')).toBe(true);

    const bh = blackHouseholdFiles(root, 'game-d', ledger);
    expect(bh).not.toContain('/art/game-d/elements/an.png'); // 已被行覆盖，不误判黑户
    expect(bh).toContain('/art/game-d/elements/stray.png');   // 同一棵非标准树里真散件，仍被抓到
    expect(deadAccountRows(root, ledger)).toHaveLength(0); // an.png 真在盘·不是死账
  }));
});

describe('REQ-ARTPIPE2 A1 · 棘轮基线（新黑户=违规·基线内=放行）', () => {
  it('黑户不在基线内 → 棘轮判违规（红）', () => withRoot((root) => {
    putFile(root, 'game-x', 'icons/new.png');
    const results = [auditGame(root, 'game-x')];
    const baseline = { blackHouseholds: {} }; // 空基线：任何黑户都是「新」的
    const r = ratchetCheck(baseline, results);
    expect(r.ok).toBe(false);
    expect(r.violations['game-x']).toContain('/games/game-x/art/icons/new.png');
  }));

  it('同一黑户已在基线内 → 棘轮判放行（绿）·不再算违规', () => withRoot((root) => {
    putFile(root, 'game-x', 'icons/known.png');
    const results = [auditGame(root, 'game-x')];
    const baseline = { blackHouseholds: { 'game-x': ['/games/game-x/art/icons/known.png'] } };
    const r = ratchetCheck(baseline, results);
    expect(r.ok).toBe(true);
    expect(r.violations['game-x']).toBeUndefined();
  }));

});

// ── CLI 退出码矩阵（测试加固批·2026-08-24）────────────────────────────
// 门禁只认退出码（scoped-gate 对本守卫 allowExit:[0,2]·1=硬拦），此前纯函数各判都有测试、
// CLI 收口的「判定→退出码」映射却零覆盖——映射写错（如 FAIL 落 2）门禁静默放行。三腿 spawn 真跑：
// 新黑户→1（FAIL）·基线覆盖的存量→2（WARN）·干净→0（PASS），各 grep 一处判词文本锚。
// 根注入走 --root <dir>（本批新加·hermetic），缺省（不带 --root）=真仓根——末腿钉死缺省不受 cwd 影响。
describe('CLI 退出码矩阵（--root 临时仓真 spawn·判词锚）', () => {
  const GUARD = join(dirname(fileURLToPath(import.meta.url)), 'art-ledger-guard.mjs');
  const runCli = (args, opts = {}) => spawnSync(process.execPath, [GUARD, ...args], { encoding: 'utf8', timeout: 30000, ...opts });

  it('新黑户（不在基线）→ exit 1 · 判词 FAIL + 点名棘轮违规', () => withRoot((root) => {
    putFile(root, 'game-x', 'icons/new.png'); // 无台账无基线 → 该文件=新黑户
    const r = runCli(['--root', root, 'game-x']);
    expect(r.status, r.stdout + r.stderr).toBe(1);
    expect(r.stdout).toContain('棘轮违规');
    expect(r.stdout).toContain('ART-LEDGER-GUARD: FAIL');
  }));

  it('基线覆盖的存量黑户 → exit 2 · 判词 WARN（警告态放行·正是 allowExit:[0,2] 的 2）', () => withRoot((root) => {
    putFile(root, 'game-x', 'icons/known.png');
    mkdirSync(join(root, 'scripts'), { recursive: true });
    writeFileSync(join(root, 'scripts', 'art-ledger-baseline.json'),
      JSON.stringify({ blackHouseholds: { 'game-x': ['/games/game-x/art/icons/known.png'] } }));
    const r = runCli(['--root', root, 'game-x']);
    expect(r.status, r.stdout + r.stderr).toBe(2);
    expect(r.stdout).toContain('ART-LEDGER-GUARD: WARN');
  }));

  it('干净仓（行覆盖·procedural 来源·文件真在盘）→ exit 0 · 判词 PASS', () => withRoot((root) => {
    putFile(root, 'game-x', 'gen/ok.png');
    writeFileSync(join(root, 'public', 'games', 'game-x', 'art', 'art-ledger.json'), JSON.stringify({
      version: 1, game: 'game-x',
      rows: [{ no: 'art-01', gen: { source: 'procedural', servedPath: '/games/game-x/art/gen/ok.png' } }],
      pending: [],
    }));
    const r = runCli(['--root', root, 'game-x']);
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(r.stdout).toContain('ART-LEDGER-GUARD: PASS');
  }));

  it('缺省（不带 --root）=真仓根·不受 cwd 影响（钉住缺省行为与加参前一致）', () => withRoot((root) => {
    // cwd 摆一个"会被当黑户"的诱饵树：若缺省根错读了 cwd，zz-cwd-trap 必出现在报告里。
    putFile(root, 'zz-cwd-trap', 'lure.png');
    const r = runCli([], { cwd: root });
    expect(r.stdout).not.toContain('zz-cwd-trap');
    expect(r.stdout).toMatch(/ART-LEDGER-GUARD: (PASS|WARN)/); // 真仓现状=挂账 WARN（exit 2）或全净
    expect([0, 2], `真仓缺省跑出 exit ${r.status}（1=真仓新增黑户·先修仓再论守卫）`).toContain(r.status);
  }));
});

describe('REQ-ARTPIPE2 A1 · discoverGames / auditGame 基础接线', () => {
  it('discoverGames 只收有 art/ 目录的游戏（无台账也收——零台账正是本守卫要抓的）', () => withRoot((root) => {
    putFile(root, 'game-has-art', 'a.png');
    mkdirSync(join(root, 'public', 'games', 'game-no-art'), { recursive: true });
    const games = discoverGames(root);
    expect(games).toContain('game-has-art');
    expect(games).not.toContain('game-no-art');
  }));

  it('auditGame：台账缺失（ledgerMissing）时全部磁盘文件都报黑户', () => withRoot((root) => {
    putFile(root, 'game-zero', 'x.png');
    putFile(root, 'game-zero', 'y.svg');
    const r = auditGame(root, 'game-zero');
    expect(r.ledgerMissing).toBe(true);
    expect(r.blackHouseholds.sort()).toEqual(['/games/game-zero/art/x.png', '/games/game-zero/art/y.svg']);
  }));
});
