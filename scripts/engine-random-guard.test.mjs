// scripts/engine-random-guard.test.mjs —— 引擎面禁裸 Math.random 守卫行为契约（REQ-GUARDGATE ①）。
// 钉死四条：① 真调用命中、注释提及不命中 ② 测试文件不归它扫（归 test-hygiene-check）
// ③ 白名单（atoms/random 实现点 + mp-client peerId）放行但 surfaced ④ 对真仓跑 = 非 FAIL（守卫自身不红门禁）。
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scanText, isScannable, isWhitelisted, collectSources, runScan, SCAN_ROOTS } from './engine-random-guard.mjs';

describe('engine-random-guard · 行扫描（真调用咬·注释/提及不咬）', () => {
  it('裸 Math.random() 调用 → 命中（带行号）', () => {
    const hits = scanText('const a = 1;\nconst r = Math.random();\n');
    expect(hits).toHaveLength(1);
    expect(hits[0].line).toBe(2);
    expect(hits[0].code).toContain('Math.random');
  });

  it('行注释里的 Math.random() / 无调用括号的提及 → 不命中', () => {
    expect(scanText('// 原为 Math.random()，已改种子 PRNG\n')).toHaveLength(0);
    expect(scanText('const x = 1; // 绝不 Math.random()\n')).toHaveLength(0);
    expect(scanText('// 绝不 Math.random。用引擎种子 PRNG\n')).toHaveLength(0);
  });

  it('别名/变体不漏：Math .random 空白、一行多语句仍咬', () => {
    expect(scanText('if (x) { y = Math.random () * 6; }\n')).toHaveLength(1);
  });
});

describe('engine-random-guard · 文件归属（非测试源文件才扫）', () => {
  it('*.test.* 不归它扫（三禁归 test-hygiene-check·不重叠不漏管）', () => {
    expect(isScannable('foo.test.ts')).toBe(false);
    expect(isScannable('foo.test.tsx')).toBe(false);
    expect(isScannable('foo.ts')).toBe(true);
    expect(isScannable('foo.tsx')).toBe(true);
    expect(isScannable('foo.mjs')).toBe(true);
    expect(isScannable('foo.md')).toBe(false);
    expect(isScannable('foo.json')).toBe(false);
  });

  it('白名单：atoms/random 实现点 + mp-client peerId 放行（各附理由）·其余引擎面不放', () => {
    expect(isWhitelisted('src/skills/atoms/random/index.ts')).toBeTruthy();
    expect(isWhitelisted('src/net/mp-client.ts')).toBeTruthy();
    expect(isWhitelisted('src/skills/tier2/matrix-duel.ts')).toBeUndefined();
    expect(isWhitelisted('src/engine/core/world.ts')).toBeUndefined();
  });
});

describe('engine-random-guard · 端到端（注入违规样本必咬·真仓必非 FAIL）', () => {
  it('临时树里种一个违规文件 → runScan 硬违规恰 1 处·测试文件同株不咬', () => {
    const root = mkdtempSync(join(tmpdir(), 'engine-random-guard-'));
    try {
      const dir = join(root, 'src', 'skills', 'tier2');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'evil.ts'), 'export const roll = () => Math.random();\n');
      writeFileSync(join(dir, 'evil.test.ts'), 'const x = Math.random();\n'); // 测试文件→不归本守卫
      writeFileSync(join(dir, 'clean.ts'), '// 绝不 Math.random()\nexport const ok = 1;\n');
      const { hard, waived } = runScan([join(root, 'src', 'skills')]);
      expect(hard).toHaveLength(1);
      expect(hard[0].file).toContain('evil.ts');
      expect(hard[0].line).toBe(1);
      expect(waived).toHaveLength(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('collectSources：根不存在 → 空列表不炸（门禁在精简 checkout 下也能跑）', () => {
    expect(collectSources('src/definitely-not-a-dir')).toEqual([]);
  });

  it('对真仓跑：退出码 0 + 判词非 FAIL（引擎面现状干净·白名单 surfaced）', () => {
    const r = spawnSync('node', ['scripts/engine-random-guard.mjs'], { encoding: 'utf8' });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/ENGINE-RANDOM: (PASS|WARNINGS)/);
  });

  it('扫描面 = spec 五目录一字不差（防守卫被悄悄缩面）', () => {
    expect(SCAN_ROOTS).toEqual(['src/engine', 'src/skills', 'src/assembly', 'src/net', 'src/services']);
  });

  it('CLI 红腿：硬违规树 → exit 1 + 判词 FAIL（测试加固批 2026-08-24·此前 CLI 只有绿腿·「红真拦」零覆盖）', () => {
    // SCAN_ROOTS 是 cwd 相对路径 → spawn 时 cwd 指临时树即根注入（hermetic·零改守卫）。
    const root = mkdtempSync(join(tmpdir(), 'engine-random-cli-'));
    try {
      mkdirSync(join(root, 'src', 'engine'), { recursive: true });
      writeFileSync(join(root, 'src', 'engine', 'evil.ts'), 'export const roll = () => Math.random();\n');
      const guard = join(process.cwd(), 'scripts', 'engine-random-guard.mjs');
      const r = spawnSync(process.execPath, [guard], { cwd: root, encoding: 'utf8', timeout: 30000 });
      expect(r.status, r.stdout + r.stderr).toBe(1); // 撤修验红本体：守卫失能则等不到 1
      expect(r.stdout).toContain('ENGINE-RANDOM: FAIL');
      expect(r.stdout).toContain('硬违规');
      expect(r.stdout).toContain('evil.ts'); // 锚点命中：确实咬的是种下的文件
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
