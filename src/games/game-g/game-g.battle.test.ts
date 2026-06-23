// Game G · 战斗编排数据层测试（布阵/分兵/干预/护盾/战役/Boss/场间增益·拆分自 game-g.test.ts）。
import { describe, it, expect } from 'vitest';
import { prepareArmies, standardArmy, armyFromFormation, laneEstimates, applyInterventions, laneHandTier, battleSpec, RUN_BATTLES, RUN_LIVES, BETWEEN_BUFFS, applyBuff, BOSS_ROSTER, bossFor, LEVER_CATALOG, LEVER_START, LEVER_CAP, LEVER_REGEN, FORMATION_PRESETS, PRESET_NAMES, type ArmyCard, type BuffTarget } from './blueprint.js';

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

  it('laneEstimates：三路各给 Σfavor/主将/牌数(18)', () => {
    const est = laneEstimates(armyFromFormation('a', 0, FORMATION_PRESETS['锋矢']));
    expect(est).toHaveLength(3);
    expect(est[1].count).toBe(18);
    expect(est[1].sumFavor).toBeGreaterThan(est[0].sumFavor); // 锋矢攻中：中路 favor 总和最高(军官最多)
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

describe('Game G · T-G4 干预卡（揭晓前改输入，outcome-first 不破）', () => {
  const sumLane = (army: ArmyCard[], lane: number): number => army.filter((c) => c.lane === lane).reduce((s, c) => s + c.favor, 0);

  it('能量常量 + 6 卡目录(费用/侧)', () => {
    expect([LEVER_START, LEVER_CAP, LEVER_REGEN]).toEqual([3, 6, 2]);
    expect(Object.keys(LEVER_CATALOG)).toEqual(['bless', 'curse', 'shield', 'decapitate', 'reinforce', 'flush']);
    expect(LEVER_CATALOG.decapitate.cost).toBe(3);
    expect(LEVER_CATALOG.bless.side).toBe('a');
    expect(LEVER_CATALOG.curse.side).toBe('b');
  });

  it('applyInterventions：祝福↑诅咒↓我/敌某路 / 斩首→敌主将 favor=8 / 增援→我某路+2兵', () => {
    const A = standardArmy('a', 0);
    const B = standardArmy('b', 0);
    expect(sumLane(applyInterventions(A, B, [{ kind: 'bless', lane: 1 }]).a, 1)).toBeGreaterThan(sumLane(A, 1));
    expect(sumLane(applyInterventions(A, B, [{ kind: 'curse', lane: 2 }]).b, 2)).toBeLessThan(sumLane(B, 2));
    const dec = applyInterventions(A, B, [{ kind: 'decapitate', lane: 0 }]);
    expect(dec.b.find((c) => c.lane === 0 && c.general)!.favor).toBe(8);
    const rf = applyInterventions(A, B, [{ kind: 'reinforce', lane: 0 }]);
    expect(rf.a.filter((c) => c.lane === 0)).toHaveLength(20); // 18 + 2 兵
    // 原军不被改（map 深拷贝）
    expect(dec.b.find((c) => c.lane === 0 && c.general)!.favor).not.toBe(B.find((c) => c.lane === 0 && c.general)!.favor);
  });


  it('prepareArmies：全军 rank+suit 无重复（阵型交叉 + 1路增援 + Boss）', () => {
    const noDup = (army: ArmyCard[]): boolean => {
      const seen = new Set<string>();
      for (const c of army) { const k = `${c.rank}:${c.suit}`; if (seen.has(k)) return false; seen.add(k); }
      return true;
    };
    // 无干预：各阵型下均无重复（历史 bug：armyFromFormation 跨路同 rank 落同花色）
    for (const f of PRESET_NAMES) {
      const { a, b } = prepareArmies({ formation: FORMATION_PRESETS[f], deckBias: 2, tiangangs: [], interventions: [], enemyBias: -2, boss: null, planets: {} });
      expect(noDup(a), `阵型 ${f} a 有重复`).toBe(true);
      expect(noDup(b), `阵型 ${f} b 有重复`).toBe(true);
    }
    // 1路增援（历史 bug：reinforce 硬编码 A♠+2♥ → 和原军重复）：溢出 rank 借 JOKER/临近花色吸收
    const { a: aRf } = prepareArmies({ formation: FORMATION_PRESETS['均衡'], deckBias: 0, tiangangs: [], interventions: [{ kind: 'reinforce', lane: 0 }], enemyBias: 0, boss: null, planets: {} });
    expect(noDup(aRf), '1路增援后 a 有重复 rank+suit').toBe(true);
    // Boss 梅花K 三路增援（每路+2，共+6张，超出52张唯一上限 → 最后几张按最优尽力分配）：至少无简单重复
    const clubK = BOSS_ROSTER.find((b) => b.id === 'clubK')!;
    const { b: bClubK } = prepareArmies({ formation: FORMATION_PRESETS['均衡'], deckBias: 0, tiangangs: [], interventions: [], enemyBias: clubK.favorBias, boss: clubK, enemyForm: clubK.formation, planets: {} });
    // 60张超出54种组合 → 允许极少数溢出重复，但不超过 6 张
    const dups = bClubK.filter((c, i) => bClubK.findIndex((x) => x.rank === c.rank && x.suit === c.suit) !== i);
    expect(dups.length, `Boss clubK 三路增援重复张数(${dups.length})超过允许上限6`).toBeLessThanOrEqual(6);
  });
});

describe('Game G · T-G4 护盾 + 同花（首发 6 完成）', () => {
  it('目录含 6 卡(护盾2◈/同花2◈)', () => {
    expect(Object.keys(LEVER_CATALOG)).toHaveLength(6);
    expect(LEVER_CATALOG.shield.cost).toBe(2);
    expect(LEVER_CATALOG.flush.side).toBe('a');
  });
  it('护盾：本路最弱牌 favor 拉到 92(仅一张)', () => {
    const A = standardArmy('a', -20); // 压低，制造弱牌
    const sh = applyInterventions(A, standardArmy('b', 0), [{ kind: 'shield', lane: 0 }]).a.filter((c) => c.lane === 0);
    expect(Math.max(...sh.map((c) => c.favor))).toBeGreaterThanOrEqual(92);
    expect(sh.filter((c) => c.favor === 92).length).toBe(1);
  });
  it('牌型阶梯：评本路最高牌型→逐级 favor（复用 poker-hand 算法，标准 18 张路≥对子→有 buff）', () => {
    const A = standardArmy('a', 0);
    const lane0 = A.filter((c) => c.lane === 0);
    const { type, buff } = laneHandTier(lane0);
    expect(['high-card', 'pair', 'two-pair', 'three-of-a-kind', 'straight', 'flush', 'full-house', 'four-of-a-kind', 'straight-flush']).toContain(type);
    expect(buff).toBeGreaterThan(0); // 18 张里必有对子以上
    const sum = (xs: ArmyCard[]): number => xs.reduce((s, c) => s + c.favor, 0);
    const fl = applyInterventions(A, standardArmy('b', 0), [{ kind: 'flush', lane: 0 }]).a.filter((c) => c.lane === 0);
    expect(sum(fl)).toBeGreaterThan(sum(lane0)); // 牌型 buff 抬升全路
  });

  it('laneHandTier：构造同花路→flush / 顺子路→straight', () => {
    const mk = (rank: string, suit: string, i: number): ArmyCard => ({ id: `x${i}`, rank, lane: 0, favor: 50, general: i === 0, suit });
    const flushLane = ['A', 'K', 'Q', '9', '3'].map((r, i) => mk(r, 'H', i));
    expect(laneHandTier(flushLane).type).toBe('flush');
    const straightLane: ArmyCard[] = [['5', 'S'], ['6', 'H'], ['7', 'D'], ['8', 'C'], ['9', 'S']].map(([r, s], i) => mk(r, s, i));
    expect(laneHandTier(straightLane).type).toBe('straight');
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

describe('Game G · T-G5 终局 Boss 阵容 + 对称起手干预（design/13）', () => {
  const sumLane = (arr: ArmyCard[], lane: number): number => arr.filter((c) => c.lane === lane).reduce((s, c) => s + c.favor, 0);

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

  it('对称干预（caster=b）：增益落 Boss(b)、诅咒落玩家(a)——side 参数化', () => {
    const A = standardArmy('a', 0);
    const B = standardArmy('b', 0);
    // Boss 诅咒玩家 lane0 → 玩家(a)被削、Boss(b)不动
    const r = applyInterventions(A, B, [{ kind: 'curse', lane: 0 }], 0, 'b');
    expect(sumLane(r.a, 0)).toBeLessThan(sumLane(A, 0));
    expect(sumLane(r.b, 0)).toBe(sumLane(B, 0));
    // Boss 自祝福 lane1 → Boss(b)增益、玩家(a)不动
    const r2 = applyInterventions(A, B, [{ kind: 'bless', lane: 1 }], 0, 'b');
    expect(sumLane(r2.b, 1)).toBeGreaterThan(sumLane(B, 1));
    expect(sumLane(r2.a, 1)).toBe(sumLane(A, 1));
  });

  it('默认 caster=a 行为不变：玩家祝福落己(a)、诅咒落敌(b)', () => {
    const A = standardArmy('a', 0), B = standardArmy('b', 0);
    const r = applyInterventions(A, B, [{ kind: 'bless', lane: 0 }, { kind: 'curse', lane: 1 }]);
    expect(sumLane(r.a, 0)).toBeGreaterThan(sumLane(A, 0)); // 己方被祝福
    expect(sumLane(r.b, 1)).toBeLessThan(sumLane(B, 1)); // 敌方被诅咒
  });

  it('小王·无常 起手斩首(caster=b)→玩家该路主将 favor 压到 8（擒贼擒王反噬玩家）', () => {
    const A = standardArmy('a', 0);
    const gBefore = A.filter((c) => c.lane === 2).find((c) => c.general)!;
    const r = applyInterventions(A, standardArmy('b', 0), [{ kind: 'decapitate', lane: 2 }], 0, 'b');
    const gAfter = r.a.filter((c) => c.lane === 2).find((c) => c.general)!;
    expect(gBefore.favor).toBeGreaterThan(8);
    expect(gAfter.favor).toBe(8);
  });


  it('梅花K·人海 起手增援(caster=b)→Boss 该路兵力 +2（go-wide 落 Boss 侧）', () => {
    const boss = BOSS_ROSTER.find((b) => b.id === 'clubK')!;
    const B0 = armyFromFormation('b', boss.favorBias, boss.formation);
    const { b } = applyInterventions(standardArmy('a', 0), B0, boss.openingLevers, boss.favorBias, 'b');
    for (const lane of [0, 1, 2]) expect(b.filter((c) => c.lane === lane).length).toBe(B0.filter((c) => c.lane === lane).length + 2);
  });
});

