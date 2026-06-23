// Game G · 战斗编排数据层测试（布阵/分兵/干预/护盾/战役/Boss/场间增益·拆分自 game-g.test.ts）。
import { describe, it, expect } from 'vitest';
import { standardArmy, armyFromFormation, battleSpec, RUN_BATTLES, RUN_LIVES, BETWEEN_BUFFS, applyBuff, BOSS_ROSTER, bossFor, LEVER_CATALOG, LEVER_START, LEVER_CAP, LEVER_REGEN, FORMATION_PRESETS, PRESET_NAMES, type ArmyCard, type BuffTarget } from './blueprint.js';

describe('Game G · T-G3 开局布阵 / 分兵（田忌赛马，纯数据）', () => {
  const OFFICER = new Set(['JOKER', 'K', 'Q', 'J', '10', '9', '8', '7']);
  const officersInLane = (army: ArmyCard[], lane: number): number => army.filter((c) => c.lane === lane && OFFICER.has(c.rank)).length;

  it('4 预设：军官数和=30、各路≤18', () => {
    expect(PRESET_NAMES).toEqual(['均衡', '锋矢', '两翼', '田忌']);
    for (const name of PRESET_NAMES) {
      const o = FORMATION_PRESETS[name].officers;
      expect(o[0] + o[1] + o[2]).toBe(30);
      expect(Math.max(...o)).toBeLessThanOrEqual(18);
    }
  });

  it('armyFromFormation：按阵型发三路，54 张/18 每路/每路 1 主将/军官数与阵型一致', () => {
    for (const name of PRESET_NAMES) {
      const f = FORMATION_PRESETS[name];
      const army = armyFromFormation('a', 0, f);
      expect(army).toHaveLength(54);
      for (const lane of [0, 1, 2]) {
        expect(army.filter((c) => c.lane === lane)).toHaveLength(18); // 每路 18
        expect(army.filter((c) => c.lane === lane && c.general)).toHaveLength(1); // 每路 1 主将
        expect(officersInLane(army, lane)).toBe(f.officers[lane]); // 军官分布=阵型
      }
    }
  });

  it('无阵型 → 回退 standardArmy（均衡蛇形，零迁移）', () => {
    const fallback = armyFromFormation('a', 5, undefined);
    expect(fallback).toHaveLength(54);
    for (const lane of [0, 1, 2]) expect(fallback.filter((c) => c.lane === lane)).toHaveLength(18);
    // 与 standardArmy 同构（同 favorBias 下各路军官数一致）
    const std = standardArmy('a', 5);
    for (const lane of [0, 1, 2]) expect(officersInLane(fallback, lane)).toBe(officersInLane(std, lane));
  });
});

describe('Game G · T-G3 自定义分兵（任意合法军官分布）', () => {
  const OFFICER = new Set(['JOKER', 'K', 'Q', 'J', '10', '9', '8', '7']);
  it('任意分布(含 0 路 / 满 18 路)：54 张 / 每路 18 / 军官数=分布 / 每路1主将', () => {
    for (const off of [[0, 18, 12], [18, 6, 6], [12, 12, 6], [2, 14, 14]] as [number, number, number][]) {
      const army = armyFromFormation('a', 4, { officers: off });
      expect(army).toHaveLength(54);
      for (const lane of [0, 1, 2]) {
        expect(army.filter((c) => c.lane === lane)).toHaveLength(18);
        expect(army.filter((c) => c.lane === lane && OFFICER.has(c.rank)).length).toBe(off[lane]);
        expect(army.filter((c) => c.lane === lane && c.general)).toHaveLength(1);
      }
    }
  });
});

// 干预卡目录（LEVER_CATALOG/LEVER_START/LEVER_REGEN）= 仍存活的纯数据（干预是 game-g.tsx 活用概念）。
// 旧 build-时施加器 applyInterventions / 牌型阶梯 laneHandTier / 完整编排 prepareArmies 随旧 effect-apply 路退役（见 git 史）→
// 其专测块已删；此处保留目录结构的纯数据回归（kept-data 覆盖·别随退役一起丢）。
describe('Game G · T-G4 干预卡目录（纯数据 · 6 卡 catalog）', () => {
  it('能量常量 + 6 卡目录(费用/侧)', () => {
    expect([LEVER_START, LEVER_CAP, LEVER_REGEN]).toEqual([3, 6, 2]);
    expect(Object.keys(LEVER_CATALOG)).toEqual(['bless', 'curse', 'shield', 'decapitate', 'reinforce', 'flush']);
    expect(Object.keys(LEVER_CATALOG)).toHaveLength(6);
    expect(LEVER_CATALOG.decapitate.cost).toBe(3);
    expect(LEVER_CATALOG.bless.side).toBe('a');
    expect(LEVER_CATALOG.curse.side).toBe('b');
    expect(LEVER_CATALOG.shield.cost).toBe(2);
    expect(LEVER_CATALOG.flush.side).toBe('a');
  });
});

describe('Game G · T-G5 战役/run 结构（战役曲线 + Boss）', () => {
  it('run 常量 + 战役曲线逐场升 + 终局 Boss', () => {
    expect([RUN_BATTLES, RUN_LIVES]).toEqual([5, 3]);
    const bias = [0, 1, 2, 3, 4].map((i) => battleSpec(i).enemyBias);
    for (let i = 1; i < 5; i++) expect(bias[i]).toBeGreaterThan(bias[i - 1]); // 敌偏置逐场升
    expect(battleSpec(0).boss).toBe(false);
    expect(battleSpec(4).boss).toBe(true); // 第 5 场=Boss
    expect(battleSpec(4).label).toContain('BOSS');
  });
  it('Boss 牌王座更强：终局敌军 favor 总和 > 序战', () => {
    const sum = (bias: number): number => standardArmy('b', bias).reduce((s, c) => s + c.favor, 0);
    expect(sum(battleSpec(4).enemyBias)).toBeGreaterThan(sum(battleSpec(0).enemyBias));
  });
});

describe('Game G · T-G5 场间三选一增益（养成核 · 纯数据 + applyBuff）', () => {
  const target = (): BuffTarget => ({ deck: Array.from({ length: 52 }, (_, i) => 44 + (i % 10) * 2), lives: 3, leverEnergy: 3, materials: 0, tiangangs: [] });
  const byId = (id: string) => BETWEEN_BUFFS.find((b) => b.id === id)!;

  it('增益池=5 张，每张 kind 合法、amount>0、最弱 LLM 能填的纯数据', () => {
    expect(BETWEEN_BUFFS).toHaveLength(5);
    const kinds = new Set(['deck-all', 'deck-weak', 'lives', 'energy', 'materials']);
    for (const b of BETWEEN_BUFFS) {
      expect(kinds.has(b.kind)).toBe(true);
      expect(b.amount).toBeGreaterThan(0);
      expect(b.name.length).toBeGreaterThan(0);
    }
  });

  it('整训：全军 favor +4（钳到 95）', () => {
    const t = target();
    const before = [...t.deck];
    applyBuff(t, byId('drill'));
    for (let i = 0; i < t.deck.length; i++) expect(t.deck[i]).toBe(Math.min(95, before[i] + 4));
  });

  it('精兵：仅最弱 10 张各 +8，其余不变；总增=10×8', () => {
    const t = target();
    const before = [...t.deck];
    applyBuff(t, byId('elite'));
    const delta = t.deck.map((f, i) => f - before[i]);
    expect(delta.filter((d) => d > 0).length).toBe(10); // 恰 10 张被抬升
    expect(delta.reduce((a, b) => a + b, 0)).toBe(80); // 无封顶时总增 80
    // 被抬升的就是原最弱 10 张
    const weakIdx = before.map((f, i) => [f, i] as const).sort((a, b) => a[0] - b[0]).slice(0, 10).map(([, i]) => i);
    for (const i of weakIdx) expect(delta[i]).toBe(8);
  });

  it('征兵/囤能(封顶 CAP)/财源 改对应资源', () => {
    const t1 = target(); applyBuff(t1, byId('conscript')); expect(t1.lives).toBe(4);
    const t2 = target(); applyBuff(t2, byId('stockpile')); expect(t2.leverEnergy).toBe(Math.min(LEVER_CAP, 3 + 3));
    const t3 = { deck: [50], lives: 3, leverEnergy: LEVER_CAP, materials: 0, tiangangs: [] }; applyBuff(t3, byId('stockpile')); expect(t3.leverEnergy).toBe(LEVER_CAP); // 已满不溢出
    const t4 = target(); applyBuff(t4, byId('revenue')); expect(t4.materials).toBe(25);
  });

  it('applyBuff 纯函数式：同 target+buff → 同结果（可重放）', () => {
    for (const b of BETWEEN_BUFFS) {
      const a = target(); const c = target();
      applyBuff(a, b); applyBuff(c, b);
      expect(a).toEqual(c);
    }
  });
});

// Boss 阵容（BOSS_ROSTER/bossFor）= 仍存活的纯数据（每 run 轮换一名牌王座）。
// 旧"对称起手干预"施加测（applyInterventions caster='b'）随旧 effect-apply 路退役（见 git 史）→ 专测块已删；
// 此处保留 roster 数据结构 + bossFor 轮换的纯数据回归。
describe('Game G · T-G5 终局 Boss 阵容（roster 数据 · 每 run 轮换）', () => {
  it('Boss 池=6 名，各 formation 合法(军官和=30) + openingLevers 合法 + 有人格/台词', () => {
    expect(BOSS_ROSTER).toHaveLength(6);
    const kinds = new Set(['bless', 'curse', 'shield', 'decapitate', 'reinforce', 'flush']);
    for (const bs of BOSS_ROSTER) {
      expect(bs.formation.officers.reduce((a, b) => a + b, 0)).toBe(30);
      expect(bs.name.length).toBeGreaterThan(0);
      expect(bs.persona.length).toBeGreaterThan(0);
      expect(bs.taunt.length).toBeGreaterThan(0);
      for (const lv of bs.openingLevers) {
        expect(kinds.has(lv.kind)).toBe(true);
        expect(lv.lane).toBeGreaterThanOrEqual(0);
        expect(lv.lane).toBeLessThanOrEqual(2);
      }
    }
  });

  it('bossFor 每 run 轮换归一（含越界/负 idx）', () => {
    expect(bossFor(0).id).toBe(BOSS_ROSTER[0].id);
    expect(bossFor(6).id).toBe(BOSS_ROSTER[0].id);
    expect(bossFor(7).id).toBe(BOSS_ROSTER[1].id);
    expect(bossFor(-1).id).toBe(BOSS_ROSTER[5].id);
  });
});

