// 上下文预算守卫（REQ-CTX）门禁：真仓库必须在预算内 + 检查核语义自证。
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { checkBudget } from './context-budget-guard.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const budget = JSON.parse(readFileSync(join(ROOT, 'scripts', 'context-budget-baseline.json'), 'utf8'));

describe('context-budget-guard — 真仓库在预算内（门禁）', () => {
  it('requests 池 ≤ 封顶 · T0 必读各 ≤ 封顶 · 每本手册 ≤80 行', () => {
    const t0Chars = {};
    for (const f of Object.keys(budget.t0MaxChars)) t0Chars[f] = readFileSync(join(ROOT, f), 'utf8').length;
    const playbookLines = {};
    for (const f of readdirSync(join(ROOT, 'docs', 'playbooks'))) {
      if (f.endsWith('.md')) playbookLines[`docs/playbooks/${f}`] = readFileSync(join(ROOT, 'docs', 'playbooks', f), 'utf8').split('\n').length;
    }
    const actual = { requestsChars: readFileSync(join(ROOT, 'docs/workflow/requests.md'), 'utf8').length, t0Chars, playbookLines };
    expect(checkBudget(actual, budget)).toEqual([]); // 超预算即红·点名文件与数字
  });
});

describe('context-budget-guard — 检查核语义（自证）', () => {
  const B = { requestsPoolMaxChars: 100, t0MaxChars: { 'a.md': 50 }, playbookMaxLines: 80 };
  it('池超顶点名', () => {
    const i = checkBudget({ requestsChars: 101, t0Chars: { 'a.md': 10 }, playbookLines: {} }, B);
    expect(i).toHaveLength(1);
    expect(i[0]).toContain('requests.md');
  });
  it('T0 超顶/缺文件点名', () => {
    expect(checkBudget({ requestsChars: 1, t0Chars: { 'a.md': 51 }, playbookLines: {} }, B)[0]).toContain('a.md');
    expect(checkBudget({ requestsChars: 1, t0Chars: {}, playbookLines: {} }, B)[0]).toContain('缺文件');
  });
  it('手册超 80 行点名', () => {
    const i = checkBudget({ requestsChars: 1, t0Chars: { 'a.md': 10 }, playbookLines: { 'docs/playbooks/x.md': 81 } }, B);
    expect(i).toHaveLength(1);
    expect(i[0]).toContain('x.md');
  });
  it('全在预算内 → 空', () => {
    expect(checkBudget({ requestsChars: 99, t0Chars: { 'a.md': 50 }, playbookLines: { 'docs/playbooks/x.md': 80 } }, B)).toEqual([]);
  });
});
