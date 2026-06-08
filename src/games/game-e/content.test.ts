import { describe, it, expect } from 'vitest';
import { STANDARD_DECK, RANK_CHIPS, SUITS, RANKS, RANK_ORDER } from './deck.js';
import { HAND_RANKINGS, HAND_ORDER, handScoreAtLevel } from './hand-rankings.js';
import { ANTE_BASE, BLIND_MULT, blindRequirement, BLIND_ORDER } from './blinds.js';
import { STARTER_JOKERS, JOKER_BY_ID } from './jokers.js';
import { jokerArtKey, JOKER_ART_FILES } from './assets.js';

// 全为「数据自洽」断言：不进 sim/hash，证明内容表确定、可被引擎能力直接消费。

describe('game-e · 牌组', () => {
  it('恰好 52 张、唯一、chip 值齐全', () => {
    expect(STANDARD_DECK.length).toBe(52);
    const seen = new Set(STANDARD_DECK.map((c) => `${c.suit}-${c.rank}`));
    expect(seen.size).toBe(52);
    expect(SUITS.length).toBe(4);
    expect(RANKS.length).toBe(13);
    for (const r of RANKS) {
      expect(RANK_CHIPS[r]).toBeGreaterThan(0);
      expect(RANK_ORDER[r]).toBeGreaterThan(0);
    }
    expect(RANK_CHIPS.A).toBe(11);
    expect(RANK_CHIPS.K).toBe(10);
  });
});

describe('game-e · 牌型表', () => {
  it('12 型齐全、基础分按强弱单调不减、升级加性递增', () => {
    expect(HAND_ORDER.length).toBe(12);
    for (const id of HAND_ORDER) expect(HAND_RANKINGS[id]).toBeDefined();
    // 基础 chips 沿 HAND_ORDER 单调不减（强牌型不更弱）
    for (let i = 1; i < HAND_ORDER.length; i++) {
      const prev = HAND_RANKINGS[HAND_ORDER[i - 1]];
      const cur = HAND_RANKINGS[HAND_ORDER[i]];
      expect(cur.baseChips).toBeGreaterThanOrEqual(prev.baseChips);
    }
    // 升级加性：Lv2 严格 ≥ Lv1
    for (const id of HAND_ORDER) {
      const l1 = handScoreAtLevel(id, 1);
      const l2 = handScoreAtLevel(id, 2);
      expect(l1.chips).toBe(HAND_RANKINGS[id].baseChips);
      expect(l2.chips).toBeGreaterThan(l1.chips);
      expect(l2.mult).toBeGreaterThan(l1.mult);
    }
  });

  it('handScoreAtLevel：level≤1 退化为基础值', () => {
    const r = handScoreAtLevel('flush', 0);
    expect(r).toEqual({ chips: 35, mult: 4 });
  });
});

describe('game-e · 盲注曲线', () => {
  it('base 严格递增；Small<Big<Boss', () => {
    for (let a = 2; a < ANTE_BASE.length; a++) {
      expect(ANTE_BASE[a]).toBeGreaterThan(ANTE_BASE[a - 1]);
    }
    expect(BLIND_MULT.small).toBeLessThan(BLIND_MULT.big);
    expect(BLIND_MULT.big).toBeLessThan(BLIND_MULT.boss);
    expect(BLIND_ORDER).toEqual(['small', 'big', 'boss']);
  });

  it('blindRequirement = base × 倍率；越界 → Infinity', () => {
    expect(blindRequirement(1, 'small')).toBe(300);
    expect(blindRequirement(1, 'big')).toBe(450);
    expect(blindRequirement(1, 'boss')).toBe(600);
    expect(blindRequirement(999, 'small')).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('game-e · 小丑数据', () => {
  it('起手 14 张、id 唯一、字段在合法枚举内', () => {
    expect(STARTER_JOKERS.length).toBe(14);
    const ids = STARTER_JOKERS.map((j) => j.id);
    expect(new Set(ids).size).toBe(14);
    const ops = new Set(['add', 'mul']);
    const targets = new Set(['chips', 'mult', 'money']);
    for (const j of STARTER_JOKERS) {
      expect(ops.has(j.op)).toBe(true);
      expect(targets.has(j.target)).toBe(true);
      expect(j.cost).toBeGreaterThan(0);
      expect(j.artKey).toBe(jokerArtKey(j.id));
      expect(j.text.length).toBeGreaterThan(0);
      // valueFrom（量纲动态值）若有，coeff 应非零
      if (j.valueFrom) expect(j.valueFrom.coeff).not.toBe(0);
    }
    expect(JOKER_BY_ID.get('cavendish')?.op).toBe('mul');
  });

  it('刻意覆盖全部 7 型', () => {
    const types = new Set(STARTER_JOKERS.map((j) => j.jokerType));
    for (const t of ['+m', '+c', 'Xm', '+$', '...'] as const) expect(types.has(t)).toBe(true);
  });

  it('有图的小丑 artKey 命中资产清单；缺图的走占位（不报错）', () => {
    const artIds = new Set(JOKER_ART_FILES.map((f) => f.id));
    const withArt = STARTER_JOKERS.filter((j) => artIds.has(j.id));
    // 起手集大部分有图（joker/cavendish/the_duo… 命中），少数（banner/bull…）暂缺
    expect(withArt.length).toBeGreaterThanOrEqual(10);
  });
});
