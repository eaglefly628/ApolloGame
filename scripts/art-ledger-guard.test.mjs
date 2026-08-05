// art-ledger-guard 自检（REQ-ARTPIPE2 A1）：黑户 / 死账 / 缺来源 三判各 ≥2 例 + 棘轮增红减绿
// + servedPath 非标准树（game-d 式 `/art/<game>/…`）不误判。全用临时目录合成 fixture，零碰真仓库数据。
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  blackHouseholdFiles, deadAccountRows, missingProvenanceRows,
  discoverArtRoots, auditGame, discoverGames, ratchetCheck,
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
