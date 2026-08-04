// 条款追踪守卫自测（REQ-SPECTRACE V1）：
//  A. 纯函数：extractClauses（切片/去重/[废]识别/哈希敏感度）。
//  B. judgeGame 四判各 ≥2 例（未覆盖/死引用/过期/孤儿）+ 编号复用红线 + 绿路径对照。
//  C. bless：拒红 1 例 + 成功落哈希 1 例 + 孤儿/已废/无 checks 的拒绝。
//  D. CLI 判词模式退出码（0/1/2）——spawn 真进程指向临时 fixture 根（ZEROCRAFT_SPECTRACE_ROOT），
//     不碰真 game-c 文件；ZEROCRAFT_SPECTRACE_CLI=1 握手防 VITEST 变量穿透误判被 import（同 acceptance-run.mjs 手法）。
//  假信心自查（哈希过期检测例）：见本文件底部注记——已按方法论人工短路哈希比较验证过该例真会转红，
//  结果记在 REQ-SPECTRACE 施工回报里（不在此文件留痕，因为「短路」是临时改源码验证测试有效性的一次性动作）。
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  hashText, extractClauses, buildClauseIndex, matrixPath, discoverGamesWithMatrix, loadMatrix,
  validateMatrixShape, checkExistence, judgeGame, verifyCheckForBless, blessOne,
} from './spec-trace-guard.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── fixture 工具（临时根·不碰真 game-c）─────────────────────────────────
function withRoot(fn) {
  const root = mkdtempSync(join(tmpdir(), 'spectrace-'));
  try { return fn(root); } finally { rmSync(root, { recursive: true, force: true }); }
}
function writeDoc(root, slug, relPath, text) {
  const p = join(root, 'docs', 'design', slug, relPath);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, text, 'utf8');
}
function writeMatrix(root, slug, matrix) {
  const p = join(root, 'docs', 'design', slug, 'spec-trace.json');
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(matrix, null, 2), 'utf8');
}
function writeScenario(root, slug, id) {
  const p = join(root, 'docs', 'design', slug, 'acceptance', `${id}.scenario.jsonc`);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify({ name: id, game: slug, seed: 0, steps: [{ tick: 1 }] }));
}
function writeTestFile(root, relPath) {
  const p = join(root, relPath);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, `import { describe, it, expect } from 'vitest';\ndescribe('x', () => { it('y', () => { expect(1).toBe(1); }); });\n`);
}
function writeAuditRules(root, rules) {
  const p = join(root, 'scripts', 'game-skill-audit.mjs');
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, `const flags = { ${rules.map((r) => `${r}: []`).join(', ')} };\n`);
}

// ═══ A. extractClauses — 纯函数 ═══
describe('extractClauses — 条款切片/去重/[废]识别/哈希敏感度', () => {
  it('两条标记 → 各自切到下一标记为止·哈希不同', () => {
    const text = '前言\n【R-X-001】第一条内容 A\n【R-X-002】第二条内容 B\n结尾';
    const es = extractClauses(text, 'X');
    expect(es.map((e) => e.clause)).toEqual(['R-X-001', 'R-X-002']);
    expect(es[0].hash).not.toBe(es[1].hash);
    expect(es[0].snippet).toContain('第一条内容 A');
    expect(es[0].snippet).not.toContain('第二条内容 B'); // 切片止于下一标记
  });

  it('切片不受**任意前缀**标记影响边界（防把别游戏标记并进本条）', () => {
    const text = '【R-X-001】内容一\n【R-Y-777】别游戏的条款\n更多 X 无关文字';
    const es = extractClauses(text, 'X');
    expect(es).toHaveLength(1);
    expect(es[0].snippet).toContain('内容一');
    expect(es[0].snippet).not.toContain('别游戏的条款'); // 边界=下一个**任意**标记，不管前缀
  });

  it('同编号出现两次 → 两条都标 dup:true（编号复用红线）', () => {
    const text = '【R-X-001】第一次\n【R-X-002】中间\n【R-X-001】第二次（误复用）';
    const es = extractClauses(text, 'X');
    const ones = es.filter((e) => e.clause === 'R-X-001');
    expect(ones).toHaveLength(2);
    expect(ones.every((e) => e.dup)).toBe(true);
    expect(es.find((e) => e.clause === 'R-X-002').dup).toBe(false);
  });

  it('[废] 出现在本条切片内 → deprecated=true；出现在下一条切片里不算本条', () => {
    const text = '【R-X-001】旧条款 [废] 留痕\n【R-X-002】新条款仍有效';
    const es = extractClauses(text, 'X');
    expect(es[0].deprecated).toBe(true);
    expect(es[1].deprecated).toBe(false);
  });

  it('修改本条切片内文字改哈希·修改下一条切片内文字不影响本条哈希', () => {
    const base = (mid, tail) => `【R-X-001】${mid}\n【R-X-002】${tail}`;
    const a = extractClauses(base('原文', '尾巴'), 'X');
    const bChangedOwn = extractClauses(base('改过的原文', '尾巴'), 'X');
    const cChangedOther = extractClauses(base('原文', '改过的尾巴'), 'X');
    expect(bChangedOwn[0].hash).not.toBe(a[0].hash); // 本条内容变→本条哈希变
    expect(cChangedOther[0].hash).toBe(a[0].hash);   // 下一条内容变→本条哈希不变
    expect(cChangedOther[1].hash).not.toBe(a[1].hash);
  });

  it('hashText 纯函数：同文本同哈希·异文本异哈希', () => {
    expect(hashText('a')).toBe(hashText('a'));
    expect(hashText('a')).not.toBe(hashText('b'));
  });

  it('buildClauseIndex：后出现者覆盖 map·duplicates 列出复用编号', () => {
    const entries = [{ clause: 'A', hash: '1' }, { clause: 'B', hash: '2' }, { clause: 'A', hash: '3' }];
    const { map, duplicates } = buildClauseIndex(entries);
    expect(map.get('A').hash).toBe('3');
    expect(duplicates).toEqual(['A']);
  });
});

// ═══ 矩阵形状 / 存在性 ═══
describe('validateMatrixShape / checkExistence', () => {
  it('缺必填字段 → 逐条报', () => {
    expect(validateMatrixShape({})).toEqual(expect.arrayContaining([
      expect.stringContaining('game'), expect.stringContaining('clausePrefix'),
      expect.stringContaining('docs'), expect.stringContaining('clauses'),
    ]));
  });
  it('合法形状通过', () => {
    expect(validateMatrixShape({ game: 'g', clausePrefix: 'G', docs: ['gdd.md'], clauses: [] })).toEqual([]);
  });

  it('checkExistence：未知 type → 死引用', () => {
    expect(checkExistence('/x', 'g', { type: 'bogus' }).ok).toBe(false);
  });
  it('checkExistence：test.name 不以 .test.* 结尾 → 拒（防指非测试文件）', () => {
    expect(checkExistence(REPO, 'game-c', { type: 'test', name: 'games/game-c/game-c.ts' }).ok).toBe(false);
  });
});

// ═══ B. judgeGame — 四判各 ≥2 例 + 复用红线 + 绿路径 ═══
describe('judgeGame — 未覆盖（文档有编号·矩阵无条目）', () => {
  it('单条未覆盖', () => withRoot((root) => {
    writeDoc(root, 'gx', 'gdd.md', '【R-X-001】条款一');
    writeMatrix(root, 'gx', { game: 'gx', clausePrefix: 'X', docs: ['gdd.md'], clauses: [] });
    const res = judgeGame(root, 'gx', loadMatrix(root, 'gx'));
    expect(res.ok).toBe(false);
    expect(res.uncovered).toEqual(['R-X-001']);
  }));
  it('多条未覆盖·已 [废] 的条款不算未覆盖', () => withRoot((root) => {
    writeDoc(root, 'gx', 'gdd.md', '【R-X-001】条款一\n【R-X-002】条款二 [废]\n【R-X-003】条款三');
    writeMatrix(root, 'gx', { game: 'gx', clausePrefix: 'X', docs: ['gdd.md'], clauses: [] });
    const res = judgeGame(root, 'gx', loadMatrix(root, 'gx'));
    expect(res.uncovered.sort()).toEqual(['R-X-001', 'R-X-003']); // 002 已废·不要求覆盖
  }));
});

describe('judgeGame — 死引用（矩阵指向不存在的验收物）', () => {
  it('scenario id 指向不存在的剧本文件', () => withRoot((root) => {
    writeDoc(root, 'gx', 'gdd.md', '【R-X-001】条款一');
    writeMatrix(root, 'gx', {
      game: 'gx', clausePrefix: 'X', docs: ['gdd.md'],
      clauses: [{ clause: 'R-X-001', checks: [{ type: 'scenario', id: 'no-such-scenario' }] }],
    });
    const res = judgeGame(root, 'gx', loadMatrix(root, 'gx'));
    expect(res.ok).toBe(false);
    expect(res.deadRef).toHaveLength(1);
    expect(res.deadRef[0]).toMatchObject({ clause: 'R-X-001' });
    expect(res.deadRef[0].reason).toContain('剧本文件不存在');
  }));
  it('test name 指向不存在的测试文件', () => withRoot((root) => {
    writeDoc(root, 'gx', 'gdd.md', '【R-X-001】条款一');
    writeMatrix(root, 'gx', {
      game: 'gx', clausePrefix: 'X', docs: ['gdd.md'],
      clauses: [{ clause: 'R-X-001', checks: [{ type: 'test', name: 'games/gx/no-such.test.ts' }] }],
    });
    const res = judgeGame(root, 'gx', loadMatrix(root, 'gx'));
    expect(res.deadRef[0].reason).toContain('测试文件不存在');
  }));
  it('audit rule 不在 game-skill-audit.mjs 已知 flag 集里', () => withRoot((root) => {
    writeDoc(root, 'gx', 'gdd.md', '【R-X-001】条款一');
    writeAuditRules(root, ['mathRandom']);
    writeMatrix(root, 'gx', {
      game: 'gx', clausePrefix: 'X', docs: ['gdd.md'],
      clauses: [{ clause: 'R-X-001', checks: [{ type: 'audit', rule: 'noSuchRule' }] }],
    });
    const res = judgeGame(root, 'gx', loadMatrix(root, 'gx'));
    expect(res.deadRef[0].reason).toContain('未知 audit rule');
  }));
});

describe('judgeGame — 过期（细则文本哈希 ≠ blessedHash）', () => {
  it('文档改了 → blessedHash 对不上 → stale', () => withRoot((root) => {
    const before = '【R-X-001】原始文本';
    const blessedHash = extractClauses(before, 'X')[0].hash;
    writeDoc(root, 'gx', 'gdd.md', '【R-X-001】已被改过的文本'); // 文档改动后
    writeScenario(root, 'gx', 's1');
    writeMatrix(root, 'gx', {
      game: 'gx', clausePrefix: 'X', docs: ['gdd.md'],
      clauses: [{ clause: 'R-X-001', checks: [{ type: 'scenario', id: 's1' }], blessedHash }],
    });
    const res = judgeGame(root, 'gx', loadMatrix(root, 'gx'));
    expect(res.ok).toBe(false);
    expect(res.stale).toEqual(['R-X-001']);
  }));
  it('从未 bless 过（缺 blessedHash 字段）→ 视为过期（逼首次 bless）', () => withRoot((root) => {
    writeDoc(root, 'gx', 'gdd.md', '【R-X-001】条款一');
    writeScenario(root, 'gx', 's1');
    writeMatrix(root, 'gx', {
      game: 'gx', clausePrefix: 'X', docs: ['gdd.md'],
      clauses: [{ clause: 'R-X-001', checks: [{ type: 'scenario', id: 's1' }] }], // 无 blessedHash
    });
    const res = judgeGame(root, 'gx', loadMatrix(root, 'gx'));
    expect(res.stale).toEqual(['R-X-001']);
  }));
});

describe('judgeGame — 孤儿（矩阵条目·文档里编号已不存在）', () => {
  it('矩阵引用了文档从未有过的编号', () => withRoot((root) => {
    writeDoc(root, 'gx', 'gdd.md', '【R-X-001】条款一');
    writeMatrix(root, 'gx', {
      game: 'gx', clausePrefix: 'X', docs: ['gdd.md'],
      clauses: [{ clause: 'R-X-001', checks: [] }, { clause: 'R-X-999', checks: [] }],
    });
    const res = judgeGame(root, 'gx', loadMatrix(root, 'gx'));
    expect(res.ok).toBe(false);
    expect(res.orphan).toEqual(['R-X-999']);
  }));
  it('条款曾在文档里·后被整条删除（GD 删规则未同步删矩阵条目）', () => withRoot((root) => {
    // 先建两条·bless 后模拟 GD 把 002 从文档整段删掉。
    writeDoc(root, 'gx', 'gdd.md', '【R-X-001】留着\n【R-X-002】将被删除');
    writeMatrix(root, 'gx', {
      game: 'gx', clausePrefix: 'X', docs: ['gdd.md'],
      clauses: [{ clause: 'R-X-001', checks: [] }, { clause: 'R-X-002', checks: [] }],
    });
    writeDoc(root, 'gx', 'gdd.md', '【R-X-001】留着'); // 002 整条消失
    const res = judgeGame(root, 'gx', loadMatrix(root, 'gx'));
    expect(res.orphan).toEqual(['R-X-002']);
  }));
});

describe('judgeGame — 编号复用红线（附加·非四判之一但图纸红线明令）', () => {
  it('文档内同编号出现两次 → duplicate 非空·整体判红', () => withRoot((root) => {
    writeDoc(root, 'gx', 'gdd.md', '【R-X-001】第一次\n【R-X-001】误复用');
    writeMatrix(root, 'gx', { game: 'gx', clausePrefix: 'X', docs: ['gdd.md'], clauses: [{ clause: 'R-X-001', checks: [] }] });
    const res = judgeGame(root, 'gx', loadMatrix(root, 'gx'));
    expect(res.ok).toBe(false);
    expect(res.duplicate).toEqual(['R-X-001']);
  }));
});

describe('judgeGame — 绿路径对照（无以上四类问题 → ok:true）', () => {
  it('文档/矩阵/剧本/测试文件/哈希 全对齐 → PASS', () => withRoot((root) => {
    const doc = '【R-X-001】条款一\n【R-X-002】条款二';
    writeDoc(root, 'gx', 'gdd.md', doc);
    writeScenario(root, 'gx', 's1');
    writeTestFile(root, 'games/gx/foo.test.ts');
    writeAuditRules(root, ['mathRandom']);
    const es = extractClauses(doc, 'X');
    writeMatrix(root, 'gx', {
      game: 'gx', clausePrefix: 'X', docs: ['gdd.md'],
      clauses: [
        { clause: 'R-X-001', checks: [{ type: 'scenario', id: 's1' }, { type: 'audit', rule: 'mathRandom' }], blessedHash: es[0].hash },
        { clause: 'R-X-002', checks: [{ type: 'test', name: 'games/gx/foo.test.ts' }, { type: 'human', note: '品味判断待人核' }], blessedHash: es[1].hash },
      ],
    });
    const res = judgeGame(root, 'gx', loadMatrix(root, 'gx'));
    expect(res.ok).toBe(true);
    expect(res.uncovered).toEqual([]);
    expect(res.orphan).toEqual([]);
    expect(res.deadRef).toEqual([]);
    expect(res.stale).toEqual([]);
    expect(res.totalChecks).toBe(4);
    expect(res.humanChecks).toBe(1);
  }));
});

// ═══ C. bless — 拒红 + 成功落哈希 + 孤儿/已废/无 checks ═══
describe('bless — verifyCheckForBless / blessOne', () => {
  const fakeRunners = (scenarioOk, testOk) => ({
    runScenario: () => (scenarioOk ? { ok: true, detail: 'PASS (fake)' } : { ok: false, detail: 'FAIL (fake) 剧本断言未过' }),
    runTestFile: () => (testOk ? { ok: true } : { ok: false, detail: 'vitest 未过 (fake)' }),
  });

  it('拒红 1 例：某 check 真跑失败 → blessOne 拒绝·matrix 未被改动（blessedHash 仍缺）', () => withRoot((root) => {
    const doc = '【R-X-001】条款一';
    writeDoc(root, 'gx', 'gdd.md', doc);
    writeScenario(root, 'gx', 's1');
    const matrix = { game: 'gx', clausePrefix: 'X', docs: ['gdd.md'], clauses: [{ clause: 'R-X-001', checks: [{ type: 'scenario', id: 's1' }] }] };
    const docMap = buildClauseIndex(extractClauses(doc, 'X')).map;
    const r = blessOne(root, 'gx', matrix, 'R-X-001', docMap, fakeRunners(false, true)); // 剧本真跑=FAIL
    expect(r.ok).toBe(false);
    expect(r.detail).toContain('FAIL');
    expect(matrix.clauses[0].blessedHash).toBeUndefined(); // 拒绝时不落哈希
  }));

  it('成功：全部 checks 真跑绿 → blessedHash 落成当前文本哈希', () => withRoot((root) => {
    const doc = '【R-X-001】条款一';
    writeDoc(root, 'gx', 'gdd.md', doc);
    writeScenario(root, 'gx', 's1');
    writeTestFile(root, 'games/gx/foo.test.ts');
    const matrix = {
      game: 'gx', clausePrefix: 'X', docs: ['gdd.md'],
      clauses: [{ clause: 'R-X-001', checks: [{ type: 'scenario', id: 's1' }, { type: 'test', name: 'games/gx/foo.test.ts' }] }],
    };
    const docMap = buildClauseIndex(extractClauses(doc, 'X')).map;
    const r = blessOne(root, 'gx', matrix, 'R-X-001', docMap, fakeRunners(true, true));
    expect(r.ok).toBe(true);
    expect(matrix.clauses[0].blessedHash).toBe(docMap.get('R-X-001').hash);
  }));

  it('死引用直接拒（bless 前置——check 连存在性都过不了，不会真跑）', () => withRoot((root) => {
    const doc = '【R-X-001】条款一';
    writeDoc(root, 'gx', 'gdd.md', doc);
    const matrix = { game: 'gx', clausePrefix: 'X', docs: ['gdd.md'], clauses: [{ clause: 'R-X-001', checks: [{ type: 'scenario', id: 'ghost' }] }] };
    const docMap = buildClauseIndex(extractClauses(doc, 'X')).map;
    const r = blessOne(root, 'gx', matrix, 'R-X-001', docMap, fakeRunners(true, true)); // runner 会说 true，但存在性先挡
    expect(r.ok).toBe(false);
    expect(r.detail).toContain('不存在');
  }));

  it('孤儿条款（矩阵有·文档无）→ 拒绝 bless', () => withRoot((root) => {
    const matrix = { game: 'gx', clausePrefix: 'X', docs: ['gdd.md'], clauses: [{ clause: 'R-X-999', checks: [{ type: 'human', note: 'x' }] }] };
    const docMap = new Map(); // 空文档
    const r = blessOne(root, 'gx', matrix, 'R-X-999', docMap, fakeRunners(true, true));
    expect(r.ok).toBe(false);
    expect(r.detail).toContain('孤儿');
  }));

  it('已标 [废] 的条款 → 拒绝 bless（无需再验）', () => withRoot((root) => {
    const doc = '【R-X-001】旧条款 [废]';
    const matrix = { game: 'gx', clausePrefix: 'X', docs: ['gdd.md'], clauses: [{ clause: 'R-X-001', checks: [{ type: 'human', note: 'x' }] }] };
    const docMap = buildClauseIndex(extractClauses(doc, 'X')).map;
    const r = blessOne(root, 'gx', matrix, 'R-X-001', docMap, fakeRunners(true, true));
    expect(r.ok).toBe(false);
    expect(r.detail).toContain('[废]');
  }));

  it('矩阵里根本没这条条目 → 拒绝（先登记再 bless）', () => withRoot((root) => {
    const matrix = { game: 'gx', clausePrefix: 'X', docs: ['gdd.md'], clauses: [] };
    const r = blessOne(root, 'gx', matrix, 'R-X-001', new Map(), fakeRunners(true, true));
    expect(r.ok).toBe(false);
    expect(r.detail).toContain('矩阵里无此条款条目');
  }));
});

// ═══ D. CLI 判词模式退出码（真进程·临时 fixture 根）═══
function runCli(tmpRoot, args) {
  return spawnSync('node', [join(REPO, 'scripts', 'spec-trace-guard.mjs'), ...args], {
    cwd: REPO, encoding: 'utf8', timeout: 30_000,
    env: { ...process.env, ZEROCRAFT_SPECTRACE_ROOT: tmpRoot, ZEROCRAFT_SPECTRACE_CLI: '1' },
  });
}

describe('CLI — 判词模式退出码（0 全绿 / 1 有红 / 2 用法错）', () => {
  it('全绿矩阵 → exit 0', () => withRoot((root) => {
    const doc = '【R-X-001】条款一';
    writeDoc(root, 'gx', 'gdd.md', doc);
    writeScenario(root, 'gx', 's1');
    const hash = extractClauses(doc, 'X')[0].hash;
    writeMatrix(root, 'gx', { game: 'gx', clausePrefix: 'X', docs: ['gdd.md'], clauses: [{ clause: 'R-X-001', checks: [{ type: 'scenario', id: 's1' }], blessedHash: hash }] });
    const r = runCli(root, ['--game', 'gx']);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('SPEC-TRACE: PASS');
  }));

  it('有红（未覆盖）→ exit 1', () => withRoot((root) => {
    writeDoc(root, 'gx', 'gdd.md', '【R-X-001】条款一');
    writeMatrix(root, 'gx', { game: 'gx', clausePrefix: 'X', docs: ['gdd.md'], clauses: [] });
    const r = runCli(root, ['--game', 'gx']);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('SPEC-TRACE: FAIL');
    expect(r.stdout).toContain('未覆盖');
  }));

  it('无任何游戏含 spec-trace.json → 中性 exit 0（V1 试点期）', () => withRoot((root) => {
    mkdirSync(join(root, 'docs', 'design'), { recursive: true });
    const r = runCli(root, []);
    expect(r.status).toBe(0);
  }));

  it('未知参数 → exit 2（用法错）', () => withRoot((root) => {
    const r = runCli(root, ['--bogus']);
    expect(r.status).toBe(2);
  }));

  it('--game 指名游戏无矩阵 → exit 2', () => withRoot((root) => {
    mkdirSync(join(root, 'docs', 'design'), { recursive: true });
    const r = runCli(root, ['--game', 'no-such-game']);
    expect(r.status).toBe(2);
  }));

  it('report 尾部输出 human 型占比', () => withRoot((root) => {
    const doc = '【R-X-001】条款一';
    writeDoc(root, 'gx', 'gdd.md', doc);
    const hash = extractClauses(doc, 'X')[0].hash;
    writeMatrix(root, 'gx', { game: 'gx', clausePrefix: 'X', docs: ['gdd.md'], clauses: [{ clause: 'R-X-001', checks: [{ type: 'human', note: 'x' }], blessedHash: hash }] });
    const r = runCli(root, ['--game', 'gx']);
    expect(r.stdout).toContain('human 型占比');
    expect(r.stdout).toContain('1/1');
  }));
});

describe('discoverGamesWithMatrix / matrixPath / loadMatrix', () => {
  it('只列出真有 spec-trace.json 的游戏目录', () => withRoot((root) => {
    writeMatrix(root, 'has-one', { game: 'has-one', clausePrefix: 'H', docs: ['gdd.md'], clauses: [] });
    mkdirSync(join(root, 'docs', 'design', 'no-matrix'), { recursive: true });
    expect(discoverGamesWithMatrix(root)).toEqual(['has-one']);
    expect(loadMatrix(root, 'no-matrix')).toBeNull();
    expect(matrixPath(root, 'has-one')).toBe(join(root, 'docs', 'design', 'has-one', 'spec-trace.json'));
  }));
});
