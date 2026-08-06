// 伴侣在场件守卫（REQ-DIALOGUE M3）：pickReaction 确定性（无 Math.random·seed 同选同）+ 加权 + buildPresence 合法闭集。
import { describe, it, expect } from 'vitest';
import { validateLayoutNode, renderNode, type LayoutNode } from '@ui/components/index.js';
import { apolloToon } from '@ui/apollo-toon-theme.js';
import { buildPresence, pickReaction, SAMPLE_REACTIONS, type ReactionTable } from './presence.js';

function types(n: LayoutNode, acc = new Set<string>()): Set<string> { acc.add(n.type); for (const c of n.children ?? []) types(c, acc); return acc; }

describe('REQ-DIALOGUE M3 · 伴侣在场件 presence', () => {
  it('pickReaction 确定性：同 seed → 同结果（录放一致·无裸随机）', () => {
    const a = pickReaction(SAMPLE_REACTIONS, 'win', 12345);
    const b = pickReaction(SAMPLE_REACTIONS, 'win', 12345);
    expect(a).toEqual(b);
    expect(a!.emotion).toBe('happy');
    expect(SAMPLE_REACTIONS['win']![0]!.lines).toContain(a!.line);
  });

  it('pickReaction 遍历 seed → 覆盖到多句（不是恒定一句）', () => {
    const seen = new Set<string>();
    for (let s = 0; s < 30; s++) seen.add(pickReaction(SAMPLE_REACTIONS, 'idle', s)!.line);
    expect(seen.size).toBeGreaterThan(1); // 种子选句真的在变
  });

  it('pickReaction 加权：weight 高的 entry 命中更多', () => {
    const table: ReactionTable = { e: [
      { emotion: 'x', lines: ['rare'], weight: 1 },
      { emotion: 'y', lines: ['common'], weight: 9 },
    ] };
    let common = 0;
    for (let s = 0; s < 100; s++) if (pickReaction(table, 'e', s)!.line === 'common') common++;
    expect(common).toBeGreaterThan(70); // ~90% 权重
  });

  it('pickReaction 未知 event → undefined（安全）', () => {
    expect(pickReaction(SAMPLE_REACTIONS, 'nope', 1)).toBeUndefined();
  });

  it('buildPresence 合法 LayoutNode（validate 零 issue·用 M1 portrait+dialog）', () => {
    const node = buildPresence({ name: '林清越', reaction: pickReaction(SAMPLE_REACTIONS, 'win', 7)! });
    expect(validateLayoutNode(node)).toEqual([]);
    const t = types(node);
    expect(t.has('portrait')).toBe(true);
    expect(t.has('dialog')).toBe(true);
    // 被动气泡：dialog kind:'choice' → 无推进信号（不误发 dialogue.advance）。
    const html = renderNode(node, apolloToon);
    expect(html).not.toContain('dialogue.advance');
  });

  it('buildPresence 无反应/空句 → 只显立绘（idle 无话·不空气泡）', () => {
    const node = buildPresence({ name: '林清越' });
    const t = types(node);
    expect(t.has('portrait')).toBe(true);
    expect(t.has('dialog')).toBe(false); // 无 line → 不拼气泡
    expect(validateLayoutNode(node)).toEqual([]);
  });

  // ── 回归（Lead 对抗性验收 2026-08-06 实测·owner 授权 Lead 直修）─────────────────
  // 反应表的 key 是**游戏数据里的任意串**，直接 `table[event]` 会沿原型链取到内建成员。
  it('event 为原型链保留名 → 安全返回 undefined（旧实现 constructor 会直接抛错崩掉）', () => {
    for (const e of ['constructor', 'toString', 'hasOwnProperty', 'valueOf']) {
      expect(() => pickReaction(SAMPLE_REACTIONS, e, 1)).not.toThrow();
      expect(pickReaction(SAMPLE_REACTIONS, e, 1)).toBeUndefined();
    }
  });

  // seed 由游戏给（分数/tick/RandomSeed）；游戏侧一旦算出 NaN，旧实现返回 line:undefined，
  // 而签名承诺 string → 气泡渲染 "undefined" / 消费方 .length 崩。
  it('脏种子（NaN/Infinity）→ 仍返回合法 string，且保持确定性', () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      const r = pickReaction(SAMPLE_REACTIONS, 'win', bad);
      expect(typeof r!.line).toBe('string');
      expect(r!.line.length).toBeGreaterThan(0);
      expect(r).toEqual(pickReaction(SAMPLE_REACTIONS, 'win', bad)); // 脏值也得确定性
    }
  });
});
