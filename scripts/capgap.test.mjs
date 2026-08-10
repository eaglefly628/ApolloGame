// scripts/capgap.test.mjs —— capgap CLI 行为契约（8/4 大评审 Q1 断链修复·2026-08-10）。
// 钉死四条：① add 落 .zerocraft/cap-gaps.jsonl·记录形状=protocols.py:_capgap_record 逐字段一致；
// ② 缺 title/need 拒收（退出码 1·通道不收空提案）；③ 读带旧 .apollo/ fallback（dir_or_legacy 同语义：
// 新文件写过第一行即转读新文件·存量不丢）；④ 字段 ≤1200 截断（与服务端同口径）。
// 纯函数直测 + 真 CLI spawn 各一层；全 hermetic（--root 指 mkdtemp·不碰真台账）。
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { makeEntry, parseArgs, addGap, listGaps, capgapReadPath } from './capgap.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(ROOT, 'scripts', 'capgap.mjs');

let TMP;
beforeAll(() => { TMP = mkdtempSync(join(tmpdir(), 'capgap-')); });
afterAll(() => rmSync(TMP, { recursive: true, force: true }));

function runCli(args) {
  const r = spawnSync('node', [CLI, ...args], { encoding: 'utf8', timeout: 30000 });
  return { code: r.status, all: (r.stdout ?? '') + (r.stderr ?? '') };
}

describe('capgap 记录构造（形状=服务端 _capgap_record 同款）', () => {
  it('全字段 + id/slug/role/at/status 齐（id=gap-<epoch秒>-<slug>·status=open）', () => {
    const e = makeEntry({ title: 'T', need: 'N', proposal: 'P', acceptance: 'A', slug: 'game-a', role: 'PE' }, 1754800000000);
    expect(e).toMatchObject({ id: 'gap-1754800000-game-a', slug: 'game-a', role: 'PE', status: 'open', title: 'T', need: 'N', proposal: 'P', acceptance: 'A' });
    expect(e.at).toBe(new Date(1754800000000).toISOString());
  });
  it('缺 need → 抛（通道不收空提案）；字段 >1200 截断（同服务端口径）', () => {
    expect(() => makeEntry({ title: 'T' })).toThrow(/--need/);
    const e = makeEntry({ title: 'x'.repeat(2000), need: 'N' });
    expect(e.title.length).toBe(1200);
  });
  it('parseArgs：--key value 与 -n', () => {
    expect(parseArgs(['add', '--title', 'T', '-n', '5'])).toMatchObject({ _: ['add'], title: 'T', n: '5' });
  });
});

describe('capgap 台账路径（统一路径=评审 Q1 改造②·写新读旧 fallback）', () => {
  it('add 写 .zerocraft/cap-gaps.jsonl（目录自建·JSONL 追加）', () => {
    const root = join(TMP, 'r1');
    const { path } = addGap({ title: '缺口一', need: '实查过' }, root);
    expect(path).toBe(join(root, '.zerocraft', 'cap-gaps.jsonl'));
    addGap({ title: '缺口二', need: '也实查过' }, root);
    const lines = readFileSync(path, 'utf8').trim().split('\n');
    expect(lines.length).toBe(2);
    expect(JSON.parse(lines[1])).toMatchObject({ title: '缺口二', status: 'open' });
  });
  it('读 fallback：只有旧 .apollo/ 存量 → list 读得到；新文件写过第一行 → 转读新文件', () => {
    const root = join(TMP, 'r2');
    mkdirSync(join(root, '.apollo'), { recursive: true });
    writeFileSync(join(root, '.apollo', 'cap-gaps.jsonl'), JSON.stringify({ title: '旧存量', status: 'open' }) + '\n');
    expect(capgapReadPath(root)).toBe(join(root, '.apollo', 'cap-gaps.jsonl'));
    expect(listGaps(root).gaps.map((g) => g.title)).toEqual(['旧存量']);
    addGap({ title: '新条', need: 'n' }, root); // 写永远落新目录
    expect(capgapReadPath(root)).toBe(join(root, '.zerocraft', 'cap-gaps.jsonl'));
    expect(listGaps(root).gaps.map((g) => g.title)).toEqual(['新条']); // dir_or_legacy 同语义：转读新文件
  });
});

describe('capgap 真 CLI（编译期 session 的最短逃生门·断链修复主件）', () => {
  it('add：入台账 + 提示 Lead 裁决面；list：新→旧可见', () => {
    const root = join(TMP, 'r3');
    const a = runCli(['add', '--title', 'CLI缺口', '--need', '现有能力实查表达不了', '--slug', 'game-b', '--root', root]);
    expect(a.code).toBe(0);
    expect(a.all).toContain('capgap 已入台账');
    expect(a.all).toContain('Lead 裁决'); // 通道≠自动批准
    expect(existsSync(join(root, '.zerocraft', 'cap-gaps.jsonl'))).toBe(true);
    const l = runCli(['list', '--root', root]);
    expect(l.code).toBe(0);
    expect(l.all).toContain('CLI缺口');
    expect(l.all).toContain('[game-b]');
  }, 30000);
  it('add 缺 --need → 退出码 1 + 点名缺什么', () => {
    const root = join(TMP, 'r4');
    const r = runCli(['add', '--title', '只有题目', '--root', root]);
    expect(r.code).toBe(1);
    expect(r.all).toContain('--need');
    expect(existsSync(join(root, '.zerocraft', 'cap-gaps.jsonl'))).toBe(false); // 拒收不落盘
  }, 30000);
});
