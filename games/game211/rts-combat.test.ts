// 现代战争数值核心测试 —— 平衡表的验收在这里，改 UNIT / DMG_TABLE 必须跑这个。
import { describe, it, expect } from 'vitest';
import {
  UNITS, UNIT, DMG_TABLE, damageMul, damageOf, canEngage, hitsToKill, ticksToKill,
  duelWinner, outranges, blindTo, nextSpawnUnit, compTotal, EMPTY_COMP,
  regenSupply, canAfford, paySupply, frontLine, frontWinner,
  type UnitId, type Composition,
} from './rts-combat.js';

describe('现代战争设定 · 结构', () => {
  it('恰好 8 个基本兵种（owner 定）', () => {
    expect(UNITS).toHaveLength(8);
    expect(new Set(UNITS).size).toBe(8);
  });
  it('owner 点名的四个都在：步兵 / 坦克 / 直升机 / 火箭炮', () => {
    for (const u of ['rifle', 'mbt', 'heli', 'mlrs'] as const) expect(UNITS).toContain(u);
  });
  it('**全远程·没有近兵器**：所有射程 ≥ 9', () => {
    for (const u of UNITS) expect(UNIT[u].range).toBeGreaterThanOrEqual(9);
  });
  it('三个目标类都有单位（soft / armor / air 都不空）', () => {
    for (const c of ['soft', 'armor', 'air'] as const) {
      expect(UNITS.filter((u) => UNIT[u].cls === c).length).toBeGreaterThan(0);
    }
  });
  it('四个弹种都有单位在用（没有摆设行）', () => {
    for (const w of ['he', 'ap', 'atgm', 'aa'] as const) {
      expect(UNITS.filter((u) => UNIT[u].weapon === w).length).toBeGreaterThan(0);
    }
  });
});

describe('⭐ 真实条令：这些关系必须成立（不是硬编的相克，是伤害表算出来的）', () => {
  it('步兵打坦克基本无效（≥50 发才打穿）', () => {
    expect(hitsToKill('rifle', 'mbt')).toBeGreaterThanOrEqual(50);
  });
  it('坦克主炮**打不到**直升机（AP 对空 = 0·不是伤害低，是没有交战关系）', () => {
    expect(canEngage('mbt', 'heli')).toBe(false);
    expect(ticksToKill('mbt', 'heli')).toBe(Infinity);
  });
  it('不带防空就被武直点名：只有 AA 能高效反直升机', () => {
    expect(DMG_TABLE.aa.air).toBeGreaterThan(DMG_TABLE.he.air * 5);
    expect(duelWinner('aa', 'heli')).toBe('aa');
  });
  it('机枪组是反步兵之王（打步枪兵比步枪兵打它快得多）', () => {
    expect(ticksToKill('mg', 'rifle')).toBeLessThan(ticksToKill('rifle', 'mg'));
  });
  it('反坦克组能打穿坦克，但**极脆**——被机枪几发带走 ⇒ 必须有步兵掩护', () => {
    expect(duelWinner('at', 'mbt')).toBe('at');
    expect(hitsToKill('mg', 'at')).toBeLessThanOrEqual(5);
    expect(ticksToKill('mg', 'at')).toBeLessThan(ticksToKill('at', 'mg'));
  });
  it('火箭炮射程碾压全场，但对刀打不过任何直瞄单位', () => {
    for (const u of UNITS) if (u !== 'mlrs') expect(outranges('mlrs', u)).toBe(true);
    expect(duelWinner('mlrs', 'mbt')).toBe('mbt');
    expect(UNIT.mlrs.splash).toBeGreaterThan(0);   // 它的价值在面杀伤，不在对刀
  });
  it('防空车对地几乎无用（纯功能位·逼出配比决策）', () => {
    expect(DMG_TABLE.aa.soft).toBeLessThan(0.3);
    expect(DMG_TABLE.aa.armor).toBeLessThan(0.2);
    expect(duelWinner('aa', 'mbt')).toBe('mbt');
  });
});

describe('平衡：没有万能兵种 · 没有废兵种', () => {
  it('全矩阵一览（不断言·给调表的人看）', () => {
    const cell = (a: UnitId, b: UnitId): string => {
      if (a === b) return '   —  ';
      const t = ticksToKill(a, b);
      return (t === Infinity ? ' ∅   ' : String(t).padStart(5)) + ' ';
    };
    console.info('[rts/matrix] 行=攻方 列=守方 · 数字=击杀耗时 tick · ∅=打不到\n         %s\n%s',
      UNITS.map((u) => UNIT[u].short.padEnd(6)).join(''),
      UNITS.map((a) => `  ${UNIT[a].short.padEnd(6)}${UNITS.map((b) => cell(a, b)).join('')}`).join('\n'));
    console.info('[rts/blind] 打不到的目标类：%s',
      UNITS.map((u) => `${UNIT[u].short}→${blindTo(u).join('/') || '无'}`).join('  '));
    expect(UNITS).toHaveLength(8);
  });
  it('没有「打谁都赢」的兵种', () => {
    for (const a of UNITS) {
      const wins = UNITS.filter((b) => b !== a && duelWinner(a, b) === a).length;
      expect(wins).toBeLessThan(UNITS.length - 1);
    }
  });
  it('每个兵种至少能打赢一个（没有纯废物）', () => {
    for (const a of UNITS) {
      const wins = UNITS.filter((b) => b !== a && duelWinner(a, b) === a).length;
      expect(wins).toBeGreaterThan(0);
    }
  });
  it('贵的不一定强，但强的一定贵（cost 与 hp×dmg 大致同向·防出现「又便宜又全能」）', () => {
    expect(UNIT.mbt.cost).toBeGreaterThan(UNIT.rifle.cost);
    expect(UNIT.heli.cost).toBeGreaterThan(UNIT.rifle.cost);
  });
});

describe('投放配比 · 确定性轮转', () => {
  const comp = (o: Partial<Composition>): Composition => ({ ...EMPTY_COMP, ...o });
  it('空配比 → null', () => { expect(nextSpawnUnit(EMPTY_COMP, EMPTY_COMP)).toBeNull(); });
  it('1:1 → 交替，不会连出一堆同兵种', () => {
    let sent = EMPTY_COMP; const out: UnitId[] = [];
    for (let i = 0; i < 6; i++) { const u = nextSpawnUnit(comp({ rifle: 1, mbt: 1 }), sent)!; out.push(u); sent = { ...sent, [u]: sent[u] + 1 }; }
    expect(out.filter((u) => u === 'rifle')).toHaveLength(3);
    expect(out.filter((u) => u === 'mbt')).toHaveLength(3);
  });
  it('4:1 长跑收敛（±1）', () => {
    let sent = EMPTY_COMP;
    for (let i = 0; i < 100; i++) { const u = nextSpawnUnit(comp({ rifle: 4, mbt: 1 }), sent)!; sent = { ...sent, [u]: sent[u] + 1 }; }
    expect(Math.abs(sent.rifle - 80)).toBeLessThanOrEqual(1);
    expect(Math.abs(sent.mbt - 20)).toBeLessThanOrEqual(1);
  });
  it('确定性可回放', () => {
    const c = comp({ rifle: 2, at: 1, mlrs: 3 });
    expect(nextSpawnUnit(c, EMPTY_COMP)).toBe(nextSpawnUnit(c, EMPTY_COMP));
  });
});

describe('兵力与战线', () => {
  it('回复钳在上限 · 买得起才扣', () => {
    expect(regenSupply({ current: 99, max: 100, regen: 5 }).current).toBe(100);
    const s = { current: 20, max: 100, regen: 1 };
    expect(canAfford(s, 'rifle')).toBe(true);
    expect(paySupply(s, 'rifle').current).toBe(12);
    expect(canAfford({ ...s, current: 5 }, 'mbt')).toBe(false);
  });
  it('战线中点 · 推过基地线即胜', () => {
    expect(frontLine(null, null, 50)).toBe(0);
    expect(frontWinner(46, 50)).toBe('red');
    expect(frontWinner(-46, 50)).toBe('blue');
    expect(frontWinner(0, 50)).toBeNull();
  });
});
