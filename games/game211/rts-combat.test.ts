// RTS 数值战斗核心测试 —— 平衡表的验收在这里，改属性表必须跑这个。
import { describe, it, expect } from 'vitest';
import {
  SUITS, UNIT, counters, damageMul, damageOf, hitsToKill, ticksToKill, duelWinner,
  counterPairs, nextSpawnSuit, compTotal, EMPTY_COMP, regenSupply, canAfford, paySupply,
  frontLine, frontWinner, COUNTER_MUL, COUNTERED_MUL, type Suit, type Composition,
} from './rts-combat.js';

describe('环形相克 · 拓扑', () => {
  it('每个兵种恰好克一个、也恰好被一个克（真环·无万能兵种·无死兵种）', () => {
    const pairs = counterPairs();
    expect(pairs).toHaveLength(4);
    expect(new Set(pairs.map((p) => p.from)).size).toBe(4);   // 每个都当过克制方
    expect(new Set(pairs.map((p) => p.to)).size).toBe(4);     // 每个都当过被克方
  });
  it('没有自克·没有对克（A 克 B 则 B 不克 A）', () => {
    for (const a of SUITS) {
      expect(counters(a, a)).toBe(false);
      for (const b of SUITS) if (counters(a, b)) expect(counters(b, a)).toBe(false);
    }
  });
  it('走 4 步回到原点（环长恰好 = 4）', () => {
    let cur: Suit = 'spade';
    const seen: Suit[] = [cur];
    for (let i = 0; i < 4; i++) cur = counterPairs().find((p) => p.from === cur)!.to;
    expect(cur).toBe('spade');
    expect(new Set(seen).size).toBe(1);
  });
});

describe('伤害公式', () => {
  it('相克 ×1.75 · 被克 ×0.8 · 无关 ×1（双向·读表直觉）', () => {
    expect(damageMul('spade', 'heart')).toBe(COUNTER_MUL);
    expect(damageMul('heart', 'spade')).toBe(COUNTERED_MUL);
    expect(damageMul('spade', 'diamond')).toBe(1);
  });
  it('伤害 = 基础 × 倍率（确定性·同输入同输出·无随机）', () => {
    expect(damageOf('spade', 'heart')).toBeCloseTo(UNIT.spade.dmg * COUNTER_MUL, 9);
    expect(damageOf('spade', 'heart')).toBe(damageOf('spade', 'heart'));
  });
  it('击杀次数向上取整（打不满一下也得补一刀）', () => {
    for (const a of SUITS) for (const b of SUITS) {
      expect(hitsToKill(a, b)).toBe(Math.ceil(UNIT[b].hp / damageOf(a, b)));
      expect(Number.isInteger(hitsToKill(a, b))).toBe(true);
    }
  });
});

describe('⭐ 平衡验收：环形相克必须每一环都真的赢', () => {
  it('相克方在一对一里必胜（这是整张属性表的存在意义）', () => {
    const rows: string[] = [];
    for (const { from, to } of counterPairs()) {
      const w = duelWinner(from, to);
      rows.push(`${UNIT[from].label} vs ${UNIT[to].label} → 胜者 ${w === 'draw' ? '平' : UNIT[w].label} `
        + `(${ticksToKill(from, to)}t vs ${ticksToKill(to, from)}t)`);
      expect(w).toBe(from);
    }
    console.info('[rts/balance] 相克环：\n  %s', rows.join('\n  '));
  });

  it('全矩阵一览（不断言·给调表的人看）', () => {
    const line = (a: Suit): string => SUITS.map((b) => {
      if (a === b) return '  —  ';
      const w = duelWinner(a, b);
      return (w === a ? '胜' : w === b ? '负' : '平') + String(ticksToKill(a, b)).padStart(4);
    }).join(' ');
    console.info('[rts/matrix] 行=攻方 列=守方（胜负 + 击杀耗时 tick）\n        %s\n%s',
      SUITS.map((s) => UNIT[s].label.slice(0, 3).padEnd(6)).join(''),
      SUITS.map((a) => `  ${UNIT[a].label.slice(0, 3).padEnd(5)}${line(a)}`).join('\n'));
    expect(SUITS).toHaveLength(4);
  });

  it('没有「打谁都赢」的兵种（否则配比就没决策了）', () => {
    for (const a of SUITS) {
      const wins = SUITS.filter((b) => b !== a && duelWinner(a, b) === a).length;
      expect(wins).toBeLessThan(3);
    }
  });
  it('没有「打谁都输」的兵种（否则那张牌是废的）', () => {
    for (const a of SUITS) {
      const wins = SUITS.filter((b) => b !== a && duelWinner(a, b) === a).length;
      expect(wins).toBeGreaterThan(0);
    }
  });
});

describe('投放配比 · 确定性轮转', () => {
  const comp = (o: Partial<Composition>): Composition => ({ ...EMPTY_COMP, ...o });
  it('空配比 → null（没得投）', () => {
    expect(nextSpawnSuit(EMPTY_COMP, EMPTY_COMP)).toBeNull();
  });
  it('单一兵种 → 恒投它', () => {
    let sent = EMPTY_COMP;
    for (let i = 0; i < 5; i++) {
      const s = nextSpawnSuit(comp({ heart: 1 }), sent)!;
      expect(s).toBe('heart');
      sent = { ...sent, [s]: sent[s] + 1 };
    }
  });
  it('1:1 → 交替（不会连出一堆同兵种）', () => {
    let sent = EMPTY_COMP;
    const out: Suit[] = [];
    for (let i = 0; i < 6; i++) {
      const s = nextSpawnSuit(comp({ spade: 1, club: 1 }), sent)!;
      out.push(s); sent = { ...sent, [s]: sent[s] + 1 };
    }
    expect(out.filter((s) => s === 'spade')).toHaveLength(3);
    expect(out.filter((s) => s === 'club')).toHaveLength(3);
  });
  it('3:1 → 长跑后比例收敛到 3:1（±1）', () => {
    let sent = EMPTY_COMP;
    for (let i = 0; i < 80; i++) {
      const s = nextSpawnSuit(comp({ spade: 3, heart: 1 }), sent)!;
      sent = { ...sent, [s]: sent[s] + 1 };
    }
    expect(compTotal(sent)).toBe(80);
    expect(Math.abs(sent.spade - 60)).toBeLessThanOrEqual(1);
    expect(Math.abs(sent.heart - 20)).toBeLessThanOrEqual(1);
  });
  it('确定性：同输入两次调用同结果（可回放）', () => {
    const c = comp({ spade: 2, diamond: 1, club: 5 });
    expect(nextSpawnSuit(c, EMPTY_COMP)).toBe(nextSpawnSuit(c, EMPTY_COMP));
  });
});

describe('兵力资源 · 投放节奏', () => {
  it('回复钳在上限', () => {
    expect(regenSupply({ current: 99, max: 100, regen: 5 }).current).toBe(100);
    expect(regenSupply({ current: 100, max: 100, regen: 5 }).current).toBe(100);
  });
  it('买得起才扣·扣的是该兵种的 cost', () => {
    const s = { current: 20, max: 100, regen: 1 };
    expect(canAfford(s, 'spade')).toBe(true);          // cost 10
    expect(paySupply(s, 'spade').current).toBe(10);
    expect(canAfford({ ...s, current: 5 }, 'diamond')).toBe(false);  // cost 18
    expect(paySupply({ ...s, current: 5 }, 'diamond').current).toBe(5); // 不足 → 不扣
  });
  it('贵的兵种确实更贵（cost 与强度同向·否则没有取舍）', () => {
    expect(UNIT.diamond.cost).toBeGreaterThan(UNIT.spade.cost);
    expect(UNIT.heart.cost).toBeGreaterThan(UNIT.spade.cost);
  });
});

describe('战线 · 战场规则', () => {
  it('双方都没单位 → 战线在中点', () => {
    expect(frontLine(null, null, 50)).toBe(0);
  });
  it('红方推进 → 战线为正', () => {
    expect(frontLine(20, 30, 50)).toBe(25);
    expect(frontLine(10, 50, 50)).toBeGreaterThan(0);
  });
  it('推过对方基地线即胜', () => {
    expect(frontWinner(46, 50)).toBe('red');
    expect(frontWinner(-46, 50)).toBe('blue');
    expect(frontWinner(0, 50)).toBeNull();
  });
});
