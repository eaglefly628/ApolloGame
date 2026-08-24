// slow-lane-guard 判定网（纯函数+对账锚·不起子进程=快车道友好）。
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SLOW_TARGETS, classify } from './slow-lane-guard.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ok = { target: 'acceptance', reason: 'r', ticket: 't', approvedBy: 'LEAD', date: '2026-08-18' };

describe('slow-lane classify — 警告态基线棘轮（交回件①·B 案）', () => {
  it('新红（不在基线）→ FAIL；在案红 → WARN；全绿零基线 → PASS', () => {
    expect(classify([{ id: 'acceptance', pass: false }], []).verdict).toBe('FAIL');
    expect(classify([{ id: 'acceptance', pass: false }], [ok]).verdict).toBe('WARN');
    expect(classify([{ id: 'acceptance', pass: true }], []).verdict).toBe('PASS');
  });

  it('基线目标转绿 → FAIL（降基线仪式·棘轮只紧不松）', () => {
    const c = classify([{ id: 'acceptance', pass: true }], [ok]);
    expect(c.verdict).toBe('FAIL');
    expect(c.staleGreen.map((r) => r.id)).toEqual(['acceptance']);
  });

  it('基线条目缺 Lead 亲批四字段任一 → FAIL（违规者不得自写豁免）', () => {
    for (const missing of ['approvedBy', 'date', 'reason', 'ticket']) {
      const bad = { ...ok };
      delete bad[missing];
      expect(classify([{ id: 'acceptance', pass: false }], [bad]).verdict).toBe('FAIL');
    }
    expect(classify([{ id: 'acceptance', pass: false }], [{ ...ok, approvedBy: 'PE' }]).verdict).toBe('FAIL');
  });

  it('真基线文件形状合法（现有条目全带四字段·目标名都在目标表里）', () => {
    const base = JSON.parse(readFileSync(join(ROOT, 'scripts/slow-lane-baseline.json'), 'utf8')).knownRed;
    for (const b of base) {
      expect(b.approvedBy).toBe('LEAD');
      expect(b.date && b.reason && b.ticket).toBeTruthy();
      expect(SLOW_TARGETS.some((t) => t.id === b.target)).toBe(true);
    }
  });
});

describe('slow-lane 目标表卫生 — subjects 路径必须真实存在（防打错字面=面触发静默失效）', () => {
  // 面触发走 f.startsWith(subject) 纯字符串前缀匹配：subjects 打错一个字（如 game-pipline）
  // 不报任何错，只是那个目标从此永远不被点名——正是「写了测试没人跑」的复发形状。下限断言：
  // 每个 subjects 路径在仓内真实存在。唯一豁免 = 'library/'（卡带用户数据目录·.gitignore 在案·
  // 新 checkout 天然缺席——它是合法的"将来才出现"前缀，不是打错的字）。
  const INTENTIONALLY_ABSENT = new Set(['library/']);
  it('SLOW_TARGETS 每个 subjects 路径在仓内真实存在（豁免仅 library/）', () => {
    for (const t of SLOW_TARGETS) {
      for (const s of t.subjects) {
        if (INTENTIONALLY_ABSENT.has(s)) continue;
        expect(existsSync(join(ROOT, s)), `SLOW_TARGETS[${t.id}].subjects 含不存在路径 ${s}——打错字=该目标面触发静默失效`).toBe(true);
      }
    }
  });
});

describe('slow-lane 对账锚 — 目标表 ⇔ vite.config 快车道排除表逐一镜像', () => {
  it('DEEP_GLOBS 每一条都有同 test 路径的 SLOW_TARGETS 条目（两侧改一头就红）', () => {
    // 从 vite.config.ts 源码抠 ZEROCRAFT_DEEP 条件排除数组里的字符串（对账不抄常量·同 route 对账测试形态）。
    const src = readFileSync(join(ROOT, 'vite.config.ts'), 'utf8');
    const at = src.lastIndexOf('ZEROCRAFT_DEEP'); // 首次出现在注释里·真条件表达式是最后一次
    const seg = src.slice(at, src.indexOf('],', at));
    const globs = [...seg.matchAll(/'([^']+)'/g)].map((m) => m[1]).filter((g) => g.includes('/'));
    expect(globs.length).toBeGreaterThanOrEqual(6);
    for (const g of globs) {
      const norm = g.replace(/\*\*$/, ''); // 'games/game-f/**' → 'games/game-f/'
      expect(
        SLOW_TARGETS.some((t) => t.test === norm || t.test === g),
        `vite.config 排除了 ${g} 但 SLOW_TARGETS 没有对应条目——慢车道守卫漏了它`,
      ).toBe(true);
    }
  });
});
