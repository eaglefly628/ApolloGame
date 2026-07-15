// 共同零件清单守卫（REQ-STAB 建议②）：门禁——当前扫到的零件集必须与冻结基线一致。
// 有人加/改名/删一个组件而没同提交跑 --update 更新基线 → 本测立即红（改动逃不过 review）。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { scanComponents, diffComponents } from './component-manifest-guard.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const baseline = JSON.parse(readFileSync(join(ROOT, 'scripts', 'component-manifest-baseline.json'), 'utf8'));

describe('component-manifest-guard — 共同零件清单守卫（门禁）', () => {
  it('当前零件集与冻结基线逐一致（漂移即红·改零件须同提交 --update）', () => {
    const current = scanComponents();
    const { added, removed } = diffComponents(current, baseline.components);
    // 失败信息直接点名，便于一眼看出加/删了什么。
    expect({ added, removed }).toEqual({ added: [], removed: [] });
  });

  it('基线自洽（count 字段 = 清单长度·升序去重）', () => {
    expect(baseline.count).toBe(baseline.components.length);
    expect([...baseline.components].sort()).toEqual(baseline.components); // 已升序
    expect(new Set(baseline.components).size).toBe(baseline.components.length); // 无重复
  });
});

describe('component-manifest-guard — diff 检出正确性（自证）', () => {
  it('新增：当前有、基线无 → added 点名', () => {
    expect(diffComponents(['A', 'B', 'C'], ['A', 'B'])).toEqual({ added: ['C'], removed: [] });
  });
  it('消失：基线有、当前无（改名/删除）→ removed 点名', () => {
    expect(diffComponents(['A', 'C'], ['A', 'B', 'C'])).toEqual({ added: [], removed: ['B'] });
  });
  it('改名=一加一减（旧名消失+新名新增·都摆到明面）', () => {
    expect(diffComponents(['A', 'Speed2'], ['A', 'Speed'])).toEqual({ added: ['Speed2'], removed: ['Speed'] });
  });
});
