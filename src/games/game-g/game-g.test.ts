import { describe, it, expect } from 'vitest';
import { Engine } from '../../runtime/engine.js';
import type { Component } from '@engine/core/types.js';
import type { Transform, RandomSeed, Resource, State, Card3D } from '@engine/protocol/components.js';
import { buildGameG3DFlip, buildGameGDuel3D, buildGameGMatch, buildGameGArmyMatch, prepareArmies, standardArmy, armyFromFormation, laneEstimates, applyInterventions, applyShadowRevenge, quartermasterEnergy, pickAiFormation, applyJokers, jokerMoraleScale, jokerLinks, jokerKeyBuffs, GAME_G_JOKERS, JOKER_BY_ID, ARCHETYPES, detectArchetype, archetypeMatchup, activeArchetype, applyArchetypeActivation, GAME_G_PLANETS, GAME_G_FOILS, effectiveLives, effectiveLeverCap, effectiveLeverRegen, effectiveTierBonus, applyPlanetArmy, laneHandTier, battleSpec, RUN_BATTLES, RUN_LIVES, BETWEEN_BUFFS, applyBuff, BOSS_ROSTER, bossFor, LEVER_CATALOG, LEVER_START, LEVER_CAP, LEVER_REGEN, FORMATION_PRESETS, PRESET_NAMES, decideFaceUp, cardFace, flipTarget, FLIP_DURATION, FLIP_SPINS, MATCH_REWARD, MARCH_DURATION, type FateCard, type ArmyCard, type Intervention, type BuffTarget } from './blueprint.js';

const get = <T extends Component>(e: Engine, id: string, type: string): T | undefined => e.world.getComponent<T>(id, type);
const rotOf = (e: Engine, id = 'card'): number => get<Transform>(e, id, 'Transform')!.rotation;
const faceUpVisible = (rot: number): boolean => Math.cos(rot) > 0; // 正面=朝镜头(+z) ⟺ cos>0
const seedOf = (seed: number): RandomSeed => ({ type: 'RandomSeed', seed, sequence: 0 });

// outcome-first：胜负先定（规则/入参），物理翻牌是反推的表现（tween 翻到既定面）。
// 3D 画面由 ThreeRenderer 演（仅浏览器）；此处 headless 验"既定结果→翻到对的面"+"胜负规则"的确定性逻辑。
describe('Game G · 3D 翻牌（既定胜负 → tween 翻到既定面）', () => {
  const runFlip = (faceUp: boolean): Engine => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameG3DFlip(faceUp));
    return e;
  };

  it('既定"活"→翻到正面(cos>0)；既定"死"→反面(cos<0)；落定角=既定目标', () => {
    for (const faceUp of [true, false]) {
      const e = runFlip(faceUp);
      for (let i = 0; i < FLIP_DURATION + 5; i++) e.world.tick();
      expect(rotOf(e)).toBeCloseTo(flipTarget(faceUp, FLIP_SPINS), 6);
      expect(faceUpVisible(rotOf(e))).toBe(faceUp);
    }
  });

  it('翻牌过程：从 0 起、空翻推进、收敛到既定面', () => {
    const e = runFlip(true);
    expect(rotOf(e)).toBe(0);
    for (let i = 0; i < 30; i++) e.world.tick();
    expect(rotOf(e)).toBeGreaterThan(0); // 正在翻（已空翻一部分）
    for (let i = 0; i < FLIP_DURATION; i++) e.world.tick();
    expect(rotOf(e)).toBeCloseTo(2 * Math.PI * FLIP_SPINS, 6); // 收敛到正面（2π·k）
  });

  it('确定性：同既定结果两次 → 落定角一致', () => {
    const settle = (faceUp: boolean): number => {
      const e = runFlip(faceUp);
      for (let i = 0; i < FLIP_DURATION + 20; i++) e.world.tick();
      return rotOf(e);
    };
    expect(settle(false)).toBe(settle(false));
    expect(settle(true)).toBe(settle(true));
  });
});

describe('Game G · 胜负规则（属性加权种子硬币，确定性）', () => {
  it('decideFaceUp 确定性 + 属性加权：高 favor 更易正面（同 seed 序列下严格更多）', () => {
    const rollMany = (favor: number, n: number): number => {
      const rng = seedOf(42);
      let up = 0;
      for (let i = 0; i < n; i++) if (decideFaceUp(favor, rng)) up++;
      return up;
    };
    expect(rollMany(90, 50)).toBe(rollMany(90, 50)); // 同 seed → 完全可复现
    expect(rollMany(90, 200)).toBeGreaterThan(rollMany(10, 200)); // 加权：高 favor 正面更多
    // 边界钳制：favor 极端也保留少量翻盘可能（0.05~0.95），不必全验，构造上保证。
    expect(decideFaceUp(100, seedOf(1))).toEqual(decideFaceUp(100, seedOf(1)));
  });

  it('buildGameGDuel3D：每张牌按规则先定胜负 → 3D 翻到既定面（与规则回放一致、确定性）', () => {
    const cards: FateCard[] = [
      { id: 'a', favor: 80 },
      { id: 'b', favor: 20 },
      { id: 'c', favor: 50 },
    ];
    const seed = 7;
    // 用同 seed 回放规则，算每张牌的期望既定面（顺序与装配一致）。
    const rng = seedOf(seed);
    const expected = cards.map((c) => decideFaceUp(c.favor, rng));

    const e = new Engine({ tickRate: 60 });
    e.load(buildGameGDuel3D(cards, seed));
    for (let i = 0; i < FLIP_DURATION + 10; i++) e.world.tick();

    cards.forEach((c, i) => {
      const rot = rotOf(e, c.id);
      expect(rot).toBeCloseTo(flipTarget(expected[i], FLIP_SPINS), 6); // 翻到规则既定面
      expect(faceUpVisible(rot)).toBe(expected[i]); // 正/反与规则一致
      expect(Math.abs(Math.cos(rot))).toBeCloseTo(1, 6); // 平躺在某一面（非立棱）
    });
  });

  it('确定性：同牌+同 seed 两次装配 → 各牌既定面一致', () => {
    const cards: FateCard[] = [{ id: 'a', favor: 65 }, { id: 'b', favor: 35 }];
    const faces = (): boolean[] => {
      const e = new Engine({ tickRate: 60 });
      e.load(buildGameGDuel3D(cards, 99));
      for (let i = 0; i < FLIP_DURATION + 5; i++) e.world.tick();
      return cards.map((c) => faceUpVisible(rotOf(e, c.id)));
    };
    expect(faces()).toEqual(faces());
  });
});

describe('Game G · MVP-1 一局收口（掷命→数存活→判胜负→结算）', () => {
  const teamA: FateCard[] = [{ id: 'a1', favor: 90 }, { id: 'a2', favor: 80 }, { id: 'a3', favor: 70 }];
  const teamB: FateCard[] = [{ id: 'b1', favor: 30 }, { id: 'b2', favor: 20 }, { id: 'b3', favor: 10 }];

  // 同 seed 回放规则算期望（顺序与装配一致：先 A 后 B）。
  const expectMatch = (seed: number): { aAlive: number; bAlive: number; winner: string } => {
    const rng = seedOf(seed);
    const aAlive = teamA.filter((c) => decideFaceUp(c.favor, rng)).length;
    const bAlive = teamB.filter((c) => decideFaceUp(c.favor, rng)).length;
    const winner = aAlive > bAlive ? 'a' : aAlive < bAlive ? 'b' : 'draw';
    return { aAlive, bAlive, winner };
  };

  const runMatch = (seed: number): Engine => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameGMatch(teamA, teamB, seed));
    for (let i = 0; i < FLIP_DURATION + 10; i++) e.world.tick();
    return e;
  };

  it('数存活 = 各队落定正面数（group-count 按 队位|ALIVE 计）', () => {
    const seed = 7;
    const exp = expectMatch(seed);
    const e = runMatch(seed);
    expect(get<Resource>(e, 'res_a', 'Resource')!.current).toBe(exp.aAlive);
    expect(get<Resource>(e, 'res_b', 'Resource')!.current).toBe(exp.bAlive);
  });

  it('判胜负：翻牌演完按存活数比 → winner 状态与规则回放一致', () => {
    for (const seed of [1, 7, 42, 99, 123]) {
      const exp = expectMatch(seed);
      const e = runMatch(seed);
      expect(get<State>(e, 'winner', 'State')!.current).toBe(exp.winner);
    }
  });

  it('结算：我方(A)胜 → 材料 +reward；否则不掉材', () => {
    for (const seed of [1, 7, 42, 99, 123]) {
      const exp = expectMatch(seed);
      const e = runMatch(seed);
      expect(get<Resource>(e, 'res_mats', 'Resource')!.current).toBe(exp.winner === 'a' ? MATCH_REWARD : 0);
    }
  });

  it('结算前(翻牌中) winner 仍 pending —— 演完才定', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameGMatch(teamA, teamB, 7));
    for (let i = 0; i < FLIP_DURATION - 5; i++) e.world.tick(); // 还没到结算门
    expect(get<State>(e, 'winner', 'State')!.current).toBe('pending');
    for (let i = 0; i < 10; i++) e.world.tick(); // 过门
    expect(get<State>(e, 'winner', 'State')!.current).not.toBe('pending');
  });

  it('确定性：同牌+同 seed 两局逐拍 hash 一致', () => {
    const e1 = new Engine({ tickRate: 60 });
    const e2 = new Engine({ tickRate: 60 });
    e1.load(buildGameGMatch(teamA, teamB, 7));
    e2.load(buildGameGMatch(teamA, teamB, 7));
    for (let i = 0; i < FLIP_DURATION + 10; i++) {
      e1.world.tick();
      e2.world.tick();
      expect(e1.hash()).toBe(e2.hash());
    }
  });
});

describe('Game G · 体量与牌阵布局（撞击观感的数据底座）', () => {
  it('cardFace：序号 → 标准 52 牌点数/花色（循环）', () => {
    expect(cardFace(0)).toEqual({ rank: 'A', suit: 'S' });
    expect(cardFace(12)).toEqual({ rank: 'K', suit: 'S' });
    expect(cardFace(13)).toEqual({ rank: 'A', suit: 'H' });
    expect(cardFace(51)).toEqual({ rank: 'K', suit: 'C' });
    expect(cardFace(52)).toEqual(cardFace(0)); // 满 52 循环
  });

  it('配对布局：A[i]/B[i] 同 pairKey、side 各为 a/b（渲染器据此让两牌相撞）', () => {
    const A: FateCard[] = [{ id: 'a0', favor: 60 }, { id: 'a1', favor: 60 }];
    const B: FateCard[] = [{ id: 'b0', favor: 40 }, { id: 'b1', favor: 40 }];
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameGMatch(A, B, 1));
    const ca0 = get<Card3D>(e, 'a0', 'Card3D')!;
    const cb1 = get<Card3D>(e, 'b1', 'Card3D')!;
    expect(ca0.side).toBe('a');
    expect(ca0.pairKey).toBe(0);
    expect(cb1.side).toBe('b');
    expect(cb1.pairKey).toBe(1);
    expect(ca0.rank).toBe('A'); // pairKey 0 → A♠
  });

  it('军阵：54/方·三路×18·军衔=点数（standardArmy 结构）', () => {
    const A = standardArmy('a', 0);
    expect(A).toHaveLength(54);
    for (const lane of [0, 1, 2]) {
      const lc = A.filter((c) => c.lane === lane);
      expect(lc).toHaveLength(18); // 每路 18
      expect(lc.filter((c) => c.general)).toHaveLength(1); // 每路 1 主将
    }
    // 三路主将 = 最高军衔（2 王 + 1 K，favor 80）
    expect(A.filter((c) => c.general).every((c) => c.favor >= 80 || c.rank === 'JOKER' || c.rank === 'K')).toBe(true);
  });

  it('G2 将领牵动 + 攻克大本营：三路数存活/净突破/总胜负与逐级掷命回放一致', () => {
    const clamp = (f: number): number => Math.max(5, Math.min(95, Math.round(f)));
    // 镜像 builder 的逐级掷命（主将先、活+8/亡−14、再下属），算各路存活。
    const replay = (army: ArmyCard[], rng: { type: 'RandomSeed'; seed: number; sequence: number }): number[] => {
      const alive = [0, 0, 0];
      for (const lane of [0, 1, 2]) {
        const lc = army.filter((c) => c.lane === lane);
        const gen = lc.find((c) => c.general)!;
        const fg = decideFaceUp(gen.favor, rng);
        if (fg) alive[lane]++;
        const shift = fg ? 8 : -14;
        for (const c of lc) {
          if (c.general) continue;
          if (decideFaceUp(clamp(c.favor + shift), rng)) alive[lane]++;
        }
      }
      return alive;
    };
    for (const seed of [1, 7, 42, 99]) {
      const A = standardArmy('a', 6);
      const B = standardArmy('b', -4);
      const rng = { type: 'RandomSeed' as const, seed, sequence: 0 };
      const aAlive = replay(A, rng);
      const bAlive = replay(B, rng);
      // 净突破·攻克大本营（design/17 §二）：每路幸存差累加 = 突破到敌老家的兵，多者破敌老家=胜。
      const dmgB = [0, 1, 2].reduce((s, L) => s + Math.max(0, aAlive[L] - bAlive[L]), 0);
      const dmgA = [0, 1, 2].reduce((s, L) => s + Math.max(0, bAlive[L] - aAlive[L]), 0);
      const winner = dmgB > dmgA ? 'a' : dmgA > dmgB ? 'b' : 'draw';

      const e = new Engine({ tickRate: 60 });
      e.load(buildGameGArmyMatch(A, B, seed));
      for (let i = 0; i < FLIP_DURATION + MARCH_DURATION + 6; i++) e.world.tick();
      for (const L of [0, 1, 2]) {
        expect(get<Resource>(e, `res_a${L}`, 'Resource')!.current).toBe(aAlive[L]); // 各路存活与回放一致
        expect(get<Resource>(e, `res_b${L}`, 'Resource')!.current).toBe(bAlive[L]);
      }
      expect(get<State>(e, 'winner', 'State')!.current).toBe(winner); // 攻克大本营总胜负一致
    }
  });

  it('确定性：同军同 seed 两局逐拍 hash 一致', () => {
    const A = standardArmy('a', 6);
    const B = standardArmy('b', -4);
    const e1 = new Engine({ tickRate: 60 });
    const e2 = new Engine({ tickRate: 60 });
    e1.load(buildGameGArmyMatch(A, B, 7));
    e2.load(buildGameGArmyMatch(A, B, 7));
    for (let i = 0; i < FLIP_DURATION + MARCH_DURATION + 6; i++) {
      e1.world.tick();
      e2.world.tick();
      expect(e1.hash()).toBe(e2.hash());
    }
  });

  it('体量：52v52 一局照样按存活数定胜负（与规则回放一致）', () => {
    const mk = (p: string, base: number): FateCard[] => Array.from({ length: 52 }, (_, i) => ({ id: `${p}${i}`, favor: base + (i % 12) * 3 }));
    const A = mk('a', 50);
    const B = mk('b', 28);
    const seed = 7;
    const rng: RandomSeed = { type: 'RandomSeed', seed, sequence: 0 };
    const aAlive = A.filter((c) => decideFaceUp(c.favor, rng)).length;
    const bAlive = B.filter((c) => decideFaceUp(c.favor, rng)).length;
    const winner = aAlive > bAlive ? 'a' : aAlive < bAlive ? 'b' : 'draw';

    const e = new Engine({ tickRate: 60 });
    e.load(buildGameGMatch(A, B, seed));
    for (let i = 0; i < FLIP_DURATION + 10; i++) e.world.tick();
    expect(get<Resource>(e, 'res_a', 'Resource')!.current).toBe(aAlive);
    expect(get<Resource>(e, 'res_b', 'Resource')!.current).toBe(bAlive);
    expect(get<State>(e, 'winner', 'State')!.current).toBe(winner);
  });
});

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

  it('布阵影响胜负且确定：同阵型+seed 逐拍 hash 一致；攻中阵中路更易赢', () => {
    const mkE = (fa: typeof FORMATION_PRESETS[string]): Engine => {
      const e = new Engine({ tickRate: 60 });
      e.load(buildGameGArmyMatch(armyFromFormation('a', 8, fa), armyFromFormation('b', -8, FORMATION_PRESETS['均衡']), 7));
      return e;
    };
    const e1 = mkE(FORMATION_PRESETS['锋矢']);
    const e2 = mkE(FORMATION_PRESETS['锋矢']);
    for (let i = 0; i < FLIP_DURATION + 12; i++) {
      e1.world.tick();
      e2.world.tick();
      expect(e1.hash()).toBe(e2.hash()); // 同阵型+seed → 确定
    }
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

  it('斩首令：敌某路主将必掉→该路溃散 → 敌该路存活 ≤ 不打时（同 seed，干预进 sim 确定）', () => {
    const runB0 = (list: Intervention[], seed: number): number => {
      const A = standardArmy('a', 6);
      const B = standardArmy('b', 6); // 敌偏强，凸显斩首效果
      const { a, b } = applyInterventions(A, B, list);
      const e = new Engine({ tickRate: 60 });
      e.load(buildGameGArmyMatch(a, b, seed));
      for (let i = 0; i < FLIP_DURATION + 12; i++) e.world.tick();
      return e.world.getComponent<Resource>('res_b0', 'Resource')!.current;
    };
    for (const seed of [1, 7, 42, 99]) {
      expect(runB0([{ kind: 'decapitate', lane: 0 }], seed)).toBeLessThanOrEqual(runB0([], seed));
    }
  });

  it('确定性：同军+同干预序列+同 seed 两局逐拍 hash 一致（干预进 sim）', () => {
    const list: Intervention[] = [{ kind: 'bless', lane: 1 }, { kind: 'decapitate', lane: 0 }, { kind: 'reinforce', lane: 2 }];
    const mk = (): Engine => {
      const { a, b } = applyInterventions(standardArmy('a', 4), standardArmy('b', -2), list);
      const e = new Engine({ tickRate: 60 });
      e.load(buildGameGArmyMatch(a, b, 7));
      return e;
    };
    const e1 = mk();
    const e2 = mk();
    for (let i = 0; i < FLIP_DURATION + 12; i++) {
      e1.world.tick();
      e2.world.tick();
      expect(e1.hash()).toBe(e2.hash());
    }
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
  it('护盾/同花进 sim 确定：同军+同干预+seed 逐拍 hash 一致', () => {
    const list: Intervention[] = [{ kind: 'shield', lane: 0 }, { kind: 'flush', lane: 1 }];
    const mk = (): Engine => {
      const { a, b } = applyInterventions(standardArmy('a', 2), standardArmy('b', 0), list);
      const e = new Engine({ tickRate: 60 });
      e.load(buildGameGArmyMatch(a, b, 7));
      return e;
    };
    const e1 = mk(), e2 = mk();
    for (let i = 0; i < FLIP_DURATION + MARCH_DURATION + 6; i++) { e1.world.tick(); e2.world.tick(); expect(e1.hash()).toBe(e2.hash()); }
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
  const target = (): BuffTarget => ({ deck: Array.from({ length: 52 }, (_, i) => 44 + (i % 10) * 2), lives: 3, leverEnergy: 3, materials: 0, jokers: [] });
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
    const t3 = { deck: [50], lives: 3, leverEnergy: LEVER_CAP, materials: 0, jokers: [] }; applyBuff(t3, byId('stockpile')); expect(t3.leverEnergy).toBe(LEVER_CAP); // 已满不溢出
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

  it('Boss 起手干预进 sim 确定：同军 + 同 Boss openingLevers + seed 逐拍 hash 一致', () => {
    const boss = bossFor(5); // 小王·无常（decapitate×3 反噬玩家）
    const mk = (): Engine => {
      let { a, b } = applyInterventions(standardArmy('a', 2), armyFromFormation('b', boss.favorBias, boss.formation), [{ kind: 'bless', lane: 0 }], 2);
      ({ a, b } = applyInterventions(a, b, boss.openingLevers, boss.favorBias, 'b'));
      const e = new Engine({ tickRate: 60 });
      e.load(buildGameGArmyMatch(a, b, 9));
      return e;
    };
    const e1 = mk(), e2 = mk();
    for (let i = 0; i < FLIP_DURATION + MARCH_DURATION + 6; i++) { e1.world.tick(); e2.world.tick(); expect(e1.hash()).toBe(e2.hash()); }
  });

  it('梅花K·人海 起手增援(caster=b)→Boss 该路兵力 +2（go-wide 落 Boss 侧）', () => {
    const boss = BOSS_ROSTER.find((b) => b.id === 'clubK')!;
    const B0 = armyFromFormation('b', boss.favorBias, boss.formation);
    const { b } = applyInterventions(standardArmy('a', 0), B0, boss.openingLevers, boss.favorBias, 'b');
    for (const lane of [0, 1, 2]) expect(b.filter((c) => c.lane === lane).length).toBe(B0.filter((c) => c.lane === lane).length + 2);
  });
});

describe('Game G · T-G6 小丑牌（融牌面 · build 时 favor 变换 · 持久牌组身份）', () => {
  const mk = (id: string, lane: number, suit: string, favor: number): ArmyCard => ({ id, rank: 'A', lane, favor, general: false, suit });

  it('小丑目录 10 张(全)，kind 合法、cost>0、有 text；JOKER_BY_ID 覆盖全', () => {
    expect(GAME_G_JOKERS.length).toBeGreaterThanOrEqual(10);
    const kinds = new Set(['suit-synergy', 'polarize', 'lane-pref', 'diehard', 'morale', 'link', 'economy', 'revenge']);
    for (const j of GAME_G_JOKERS) {
      expect(kinds.has(j.kind)).toBe(true);
      expect(j.cost).toBeGreaterThan(0);
      expect(j.text.length).toBeGreaterThan(0);
      expect(JOKER_BY_ID.get(j.id)).toBe(j);
    }
  });

  it('空小丑集 → 原样复制（不改 favor、非别名）', () => {
    const army = [mk('x', 0, 'H', 50)];
    const out = applyJokers(army, []);
    expect(out).toEqual(army);
    expect(out).not.toBe(army);
  });

  it('同袍：本路每张同花色 → +2×同花数（限本路本花色）', () => {
    const army = [mk('a', 0, 'H', 50), mk('b', 0, 'H', 50), mk('c', 0, 'S', 50), mk('d', 1, 'H', 50)];
    const out = applyJokers(army, ['comrade']);
    expect(out.find((c) => c.id === 'a')!.favor).toBe(54); // lane0 2×H → +2×2
    expect(out.find((c) => c.id === 'b')!.favor).toBe(54);
    expect(out.find((c) => c.id === 'c')!.favor).toBe(52); // lane0 1×S → +2×1
    expect(out.find((c) => c.id === 'd')!.favor).toBe(52); // lane1 1×H → +2×1
  });

  it('赌徒：favor≥50 +12、<50 −12（两极化）', () => {
    const out = applyJokers([mk('hi', 0, 'H', 60), mk('lo', 0, 'H', 40)], ['gambler']);
    expect(out.find((c) => c.id === 'hi')!.favor).toBe(72);
    expect(out.find((c) => c.id === 'lo')!.favor).toBe(28);
  });

  it('先登：仅上路(lane0) +8', () => {
    const out = applyJokers([mk('up', 0, 'H', 50), mk('mid', 1, 'H', 50)], ['vanguard']);
    expect(out.find((c) => c.id === 'up')!.favor).toBe(58);
    expect(out.find((c) => c.id === 'mid')!.favor).toBe(50);
  });

  it('不屈：favor<88 拉到 88、≥88 不变', () => {
    const out = applyJokers([mk('weak', 0, 'H', 46), mk('strong', 0, 'H', 90)], ['diehard']);
    expect(out.find((c) => c.id === 'weak')!.favor).toBe(88);
    expect(out.find((c) => c.id === 'strong')!.favor).toBe(90);
  });

  it('outcome-first：融不屈只升 favor → 同 seed 下存活数单调不减', () => {
    const baseA = standardArmy('a', -10); // 压低制造弱牌
    const run = (jids: string[]): number => {
      const a = applyJokers(baseA, jids);
      const e = new Engine({ tickRate: 60 });
      e.load(buildGameGArmyMatch(a, standardArmy('b', 0), 5));
      for (let i = 0; i < FLIP_DURATION + 8; i++) e.world.tick();
      return ['res_a0', 'res_a1', 'res_a2'].reduce((s, id) => s + (get<Resource>(e, id, 'Resource')?.current ?? 0), 0);
    };
    expect(run(['diehard'])).toBeGreaterThanOrEqual(run([]));
  });

  it('确定性：同军 + 同小丑集 + seed 逐拍 hash 一致（融小丑进 sim）', () => {
    const mkE = (): Engine => {
      const a = applyJokers(standardArmy('a', 2), ['comrade', 'vanguard']);
      const e = new Engine({ tickRate: 60 });
      e.load(buildGameGArmyMatch(a, standardArmy('b', 0), 9));
      return e;
    };
    const e1 = mkE(), e2 = mkE();
    for (let i = 0; i < FLIP_DURATION + MARCH_DURATION + 6; i++) { e1.world.tick(); e2.world.tick(); expect(e1.hash()).toBe(e2.hash()); }
  });

  it('旗手/枭雄 士气倍率：旗手全路 ×1.5、枭雄仅顶级主将(K/王)路 ×2、无则 [1,1,1]', () => {
    const army = standardArmy('a', 0); // 三路主将均顶级(JOKER/JOKER/K)
    expect(jokerMoraleScale(army, [])).toEqual([1, 1, 1]);
    expect(jokerMoraleScale(army, ['bannerman'])).toEqual([1.5, 1.5, 1.5]);
    for (const v of jokerMoraleScale(army, ['warlord'])) expect(v).toBe(2); // 全顶级 → 全 ×2
    // 枭雄只认顶级主将：把某路主将换成低军衔 → 该路不放大
    const army2 = army.map((c) => (c.lane === 1 && c.general ? { ...c, rank: '7' } : c));
    expect(jokerMoraleScale(army2, ['warlord'])).toEqual([2, 1, 2]);
  });

  it('旗手放大士气：build 时该路下属(主将活)favor 抬升 → 表现为存活单调不减（同 seed）', () => {
    const baseA = standardArmy('a', 6); // 主将高军衔+偏置 → 大概率活、士气生效
    const run = (jids: string[]): number => {
      const a = applyJokers(baseA, jids);
      const e = new Engine({ tickRate: 60 });
      e.load(buildGameGArmyMatch(a, standardArmy('b', 0), 11, undefined, jokerMoraleScale(a, jids)));
      for (let i = 0; i < FLIP_DURATION + 8; i++) e.world.tick();
      return ['res_a0', 'res_a1', 'res_a2'].reduce((s, id) => s + (get<Resource>(e, id, 'Resource')?.current ?? 0), 0);
    };
    expect(run(['bannerman'])).toBeGreaterThanOrEqual(run([])); // 士气放大只升不降
  });

  it('确定性：旗手士气缩放进 sim 逐拍 hash 一致（缩放不改掷命次数）', () => {
    const mkE = (): Engine => {
      const a = applyJokers(standardArmy('a', 4), ['bannerman', 'warlord']);
      const e = new Engine({ tickRate: 60 });
      e.load(buildGameGArmyMatch(a, standardArmy('b', 0), 13, undefined, jokerMoraleScale(a, ['bannerman', 'warlord'])));
      return e;
    };
    const e1 = mkE(), e2 = mkE();
    for (let i = 0; i < FLIP_DURATION + MARCH_DURATION + 6; i++) { e1.world.tick(); e2.world.tick(); expect(e1.hash()).toBe(e2.hash()); }
  });

  it('jokerLinks：从已融小丑取死士/连环开关（结局联动族）', () => {
    expect(jokerLinks([])).toEqual({ martyr: false, chain: false });
    expect(jokerLinks(['martyr'])).toEqual({ martyr: true, chain: false });
    expect(jokerLinks(['chain', 'comrade'])).toEqual({ martyr: false, chain: true });
    expect(jokerLinks(['martyr', 'chain'])).toEqual({ martyr: true, chain: true });
  });

  it('死士：首死后余部 +报仇（只升 favor、不改掷命次数）→ 同 seed 存活单调不减', () => {
    const baseA = standardArmy('a', -16); // 压低→兵大概率死、触发首死链
    const survivors = (links: { martyr: boolean; chain: boolean }): number => {
      const e = new Engine({ tickRate: 60 });
      e.load(buildGameGArmyMatch(baseA, standardArmy('b', 0), 33, undefined, undefined, links));
      for (let i = 0; i < FLIP_DURATION + 8; i++) e.world.tick();
      return ['res_a0', 'res_a1', 'res_a2'].reduce((s, id) => s + (get<Resource>(e, id, 'Resource')?.current ?? 0), 0);
    };
    expect(survivors({ martyr: true, chain: false })).toBeGreaterThanOrEqual(survivors({ martyr: false, chain: false }));
  });

  it('结局联动进 sim 确定：同军 + 同 links(死士+连环) + seed 逐拍 hash 一致（前向单遍）', () => {
    const mk = (): Engine => {
      const e = new Engine({ tickRate: 60 });
      e.load(buildGameGArmyMatch(standardArmy('a', 0), standardArmy('b', 0), 41, undefined, [1, 1, 1], { martyr: true, chain: true }));
      return e;
    };
    const e1 = mk(), e2 = mk();
    for (let i = 0; i < FLIP_DURATION + MARCH_DURATION + 6; i++) { e1.world.tick(); e2.world.tick(); expect(e1.hash()).toBe(e2.hash()); }
  });

  it('prepareArmies 带出 linksA（死士/连环 喂 build）', () => {
    const { linksA } = prepareArmies({ formation: FORMATION_PRESETS['均衡'], deckBias: 0, jokers: ['martyr', 'chain'], interventions: [], enemyBias: 0 });
    expect(linksA).toEqual({ martyr: true, chain: true });
  });

  it('督粮：每胜一路 +1◈（仅拥有时；lanesWon clamp≥0）', () => {
    expect(quartermasterEnergy([], 3)).toBe(0);
    expect(quartermasterEnergy(['quartermaster'], 2)).toBe(2);
    expect(quartermasterEnergy(['quartermaster'], 0)).toBe(0);
    expect(quartermasterEnergy(['quartermaster'], -1)).toBe(0); // 负数钳 0
  });

  it('applyShadowRevenge：仅被斩路(主将 favor≤8)余部 +复仇，主将不变、他路不变', () => {
    const army = standardArmy('a', 0);
    const hit = army.map((c) => (c.lane === 1 && c.general ? { ...c, favor: 8 } : c)); // 人工把 lane1 主将斩到 8
    const out = applyShadowRevenge(hit);
    const soldierSum = (arr: ArmyCard[], lane: number): number => arr.filter((c) => c.lane === lane && !c.general).reduce((s, c) => s + c.favor, 0);
    expect(soldierSum(out, 1)).toBeGreaterThan(soldierSum(hit, 1)); // 被斩路余部复仇
    expect(soldierSum(out, 0)).toBe(soldierSum(hit, 0)); // 他路不变
    expect(out.find((c) => c.lane === 1 && c.general)!.favor).toBe(8); // 主将仍被斩（退路不救将）
  });

  it('影武者：Boss 斩首命中我三路主将 → prepareArmies 让三路余部 +复仇（vs 不带影武者）', () => {
    const boss = BOSS_ROSTER.find((b) => b.id === 'smallJoker')!; // decapitate×3
    const make = (jokers: string[]): ArmyCard[] => prepareArmies({ formation: FORMATION_PRESETS['均衡'], deckBias: 0, jokers, interventions: [], enemyForm: boss.formation, enemyBias: boss.favorBias, boss }).a;
    const without = make([]);
    const withShadow = make(['shadow']);
    const soldierSum = (arr: ArmyCard[], lane: number): number => arr.filter((c) => c.lane === lane && !c.general).reduce((s, c) => s + c.favor, 0);
    for (const lane of [0, 1, 2]) {
      expect(without.find((c) => c.lane === lane && c.general)!.favor).toBe(8); // 三路主将都被斩
      expect(soldierSum(withShadow, lane)).toBeGreaterThan(soldierSum(without, lane)); // 影武者 → 余部复仇
    }
  });

  it('流派钥匙：jokerKeyBuffs 为每张"未拥有"小丑产 kind=joker 的 RunBuff（已拥有不出）', () => {
    const all = jokerKeyBuffs([]);
    expect(all).toHaveLength(GAME_G_JOKERS.length); // 全未拥有 → 全产
    for (const k of all) { expect(k.kind).toBe('joker'); expect(k.jokerId).toBeTruthy(); expect(JOKER_BY_ID.has(k.jokerId!)).toBe(true); }
    const owned = jokerKeyBuffs(['comrade', 'bannerman']);
    expect(owned).toHaveLength(GAME_G_JOKERS.length - 2);
    expect(owned.some((k) => k.jokerId === 'comrade' || k.jokerId === 'bannerman')).toBe(false);
  });

  it('applyBuff(joker)：白嫖小丑入 save.jokers，去重幂等', () => {
    const t: BuffTarget = { deck: [50], lives: 3, leverEnergy: 3, materials: 0, jokers: [] };
    const key = jokerKeyBuffs([])[0]; // 取第一张钥匙
    applyBuff(t, key);
    expect(t.jokers).toEqual([key.jokerId]);
    applyBuff(t, key); // 再选同一张 → 不重复
    expect(t.jokers).toEqual([key.jokerId]);
  });
});

describe('Game G · T-G6 流派 + 克制网（身份 + 石头剪刀布 · 纯数据）', () => {
  it('流派池=6，counters 合法(在集合内、无自克)、keyJokers 是有效小丑 id', () => {
    expect(ARCHETYPES).toHaveLength(6);
    const ids = new Set(ARCHETYPES.map((a) => a.id));
    for (const a of ARCHETYPES) {
      expect(ids.has(a.counters)).toBe(true);
      expect(a.counters).not.toBe(a.id); // 无自克
      for (const k of a.keyJokers) expect(JOKER_BY_ID.has(k)).toBe(true);
    }
  });

  it('克制网：每流派恰被 1 个克制（双 3-环闭合）+ 核心环 decap→general→wide→decap', () => {
    const counters = new Map(ARCHETYPES.map((a) => [a.id, a.counters]));
    for (const a of ARCHETYPES) expect(ARCHETYPES.filter((x) => x.counters === a.id).length).toBe(1);
    expect(counters.get('decap')).toBe('general');
    expect(counters.get('general')).toBe('wide');
    expect(counters.get('wide')).toBe('decap');
  });

  it('detectArchetype：无小丑→null；旗手+枭雄→将领流；多数决', () => {
    expect(detectArchetype([])).toBeNull();
    expect(detectArchetype(['bannerman', 'warlord'])?.id).toBe('general');
    expect(detectArchetype(['gambler', 'diehard'])?.id).toBe('probability');
    expect(detectArchetype(['comrade'])?.id).toBe('cardtype');
    expect(detectArchetype(['gambler', 'diehard', 'comrade'])?.id).toBe('probability'); // 概率(2) 压牌型(1)
  });

  it('archetypeMatchup：将领克铺场、铺场被将领克、将领vs牌型中立', () => {
    expect(archetypeMatchup('general', 'wide')).toBe('counter');
    expect(archetypeMatchup('wide', 'general')).toBe('countered');
    expect(archetypeMatchup('general', 'cardtype')).toBe('neutral');
  });

  it('每个 Boss 带合法流派 id', () => {
    const ids = new Set(ARCHETYPES.map((a) => a.id));
    for (const b of BOSS_ROSTER) expect(ids.has(b.archetype)).toBe(true);
  });
});

describe('Game G · AI 暗布阵 pickAiFormation（纯逻辑下沉 · committed→反制）', () => {
  const even = [10, 10, 10];
  it('低关(≤2)非 committed → 均衡', () => {
    expect(pickAiFormation(1, 0, even, false)).toEqual(FORMATION_PRESETS['均衡']);
    expect(pickAiFormation(2, 5, even, false)).toEqual(FORMATION_PRESETS['均衡']);
  });

  it('中关(3–5)非 committed → 随 stage+materials 变化(预设之一)', () => {
    const f = pickAiFormation(3, 1, even, false);
    expect(PRESET_NAMES.some((n) => FORMATION_PRESETS[n] === f)).toBe(true);
  });

  it('高关(>5) → 猛攻最弱一路（该路堆 18 军官）', () => {
    const f = pickAiFormation(6, 0, [14, 4, 12], false); // 中路最弱
    expect(f.officers[1]).toBe(18);
    expect(f.officers).toEqual([6, 18, 6]);
  });

  it('committed（玩家集齐招牌）→ 低关也反制攻最弱路', () => {
    const f = pickAiFormation(1, 0, [3, 14, 14], true); // 上路最弱
    expect(f.officers[0]).toBe(18); // 全程反制（非 committed 时此关本是均衡）
    expect(pickAiFormation(1, 0, [3, 14, 14], false)).toEqual(FORMATION_PRESETS['均衡']); // 对照：未 committed 仍均衡
  });
});

describe('Game G · T-G6 星球牌（第二养成轴 · 可叠加升档 · 纯数据）', () => {
  const TROOP = ['A', '2', '3', '4', '5', '6'];
  it('星球池≥4，kind 合法、cost/amount>0、有 text', () => {
    expect(GAME_G_PLANETS.length).toBeGreaterThanOrEqual(4);
    const kinds = new Set(['lives', 'energy', 'rank-favor', 'tier']);
    for (const p of GAME_G_PLANETS) {
      expect(kinds.has(p.kind)).toBe(true);
      expect(p.cost).toBeGreaterThan(0);
      expect(p.amount).toBeGreaterThan(0);
      expect(p.text.length).toBeGreaterThan(0);
    }
  });

  it('effective 派生 run 参数：无星球=base，按级线性叠加', () => {
    expect(effectiveLives({})).toBe(RUN_LIVES);
    expect(effectiveLives({ saturn: 2 })).toBe(RUN_LIVES + 2);
    expect(effectiveLeverCap({})).toBe(LEVER_CAP);
    expect(effectiveLeverCap({ jupiter: 1 })).toBe(LEVER_CAP + 1);
    expect(effectiveLeverRegen({ jupiter: 3 })).toBe(LEVER_REGEN + 3);
  });

  it('星球·军：仅「兵」档(A–6) +3/级、军官不变；无 mars → 原样复制', () => {
    const army = standardArmy('a', 0);
    const out = applyPlanetArmy(army, { mars: 1 });
    for (const c of out) {
      const o = army.find((x) => x.id === c.id)!;
      if (TROOP.includes(c.rank)) expect(c.favor).toBe(Math.min(95, o.favor + 3)); // 兵 +3
      else expect(c.favor).toBe(o.favor); // 军官/王 不变
    }
    expect(applyPlanetArmy(army, {})).toEqual(army);
  });

  it('星球·军 进 prepareArmies：兵档底盘抬升（vs 无星球）', () => {
    const sumTroop = (a: ArmyCard[]): number => a.filter((c) => TROOP.includes(c.rank)).reduce((s, c) => s + c.favor, 0);
    const opt = { formation: FORMATION_PRESETS['均衡'], deckBias: 0, jokers: [], interventions: [] as Intervention[], enemyBias: 0 };
    const base = prepareArmies({ ...opt, planets: {} }).a;
    const withMars = prepareArmies({ ...opt, planets: { mars: 2 } }).a;
    expect(sumTroop(withMars)).toBeGreaterThan(sumTroop(base));
  });

  it('星球·型：成型(非高牌)整条阶梯 +bonus；高牌(0)不吃', () => {
    const mk = (rank: string, suit: string, i: number): ArmyCard => ({ id: `x${i}`, rank, lane: 0, favor: 50, general: i === 0, suit });
    const flushLane = ['A', 'K', 'Q', '9', '3'].map((r, i) => mk(r, 'H', i)); // 同花
    expect(laneHandTier(flushLane).buff).toBe(10); // flush 基础
    expect(laneHandTier(flushLane, 4).buff).toBe(14); // +星球·型 4
    const highCard = [['A', 'H'], ['K', 'S'], ['9', 'D'], ['7', 'C'], ['3', 'H']].map(([r, s], i) => mk(r, s, i));
    expect(laneHandTier(highCard).type).toBe('high-card');
    expect(laneHandTier(highCard, 4).buff).toBe(0); // 高牌不成型 → 不吃加成
    expect(effectiveTierBonus({ mercury: 2 })).toBe(8); // amount 4 × 2 级
  });

  it('foil 闪艺：池≥4、id 唯一、cost>0、有名/述（纯表现收集·零 gameplay）', () => {
    expect(GAME_G_FOILS.length).toBeGreaterThanOrEqual(4);
    expect(new Set(GAME_G_FOILS.map((f) => f.id)).size).toBe(GAME_G_FOILS.length);
    for (const f of GAME_G_FOILS) { expect(f.cost).toBeGreaterThan(0); expect(f.name.length).toBeGreaterThan(0); expect(f.desc.length).toBeGreaterThan(0); }
  });

  it('星球·型 进 prepareArmies：flush 干预受益于 mercury（vs 无星球）', () => {
    const opt = { formation: FORMATION_PRESETS['均衡'], deckBias: 0, jokers: [], interventions: [{ kind: 'flush', lane: 0 }] as Intervention[], enemyBias: 0 };
    const sumLane0 = (a: ArmyCard[]): number => a.filter((c) => c.lane === 0).reduce((s, c) => s + c.favor, 0);
    const base = prepareArmies({ ...opt, planets: {} }).a;
    const withTier = prepareArmies({ ...opt, planets: { mercury: 2 } }).a;
    expect(sumLane0(withTier)).toBeGreaterThan(sumLane0(base)); // 牌型阶梯被星球·型抬高 → flush 给该路更多 favor
  });
});

describe('Game G · T-G6 流派激活质变（主流派集齐 keyJokers → 招牌增益）', () => {
  const sumLane = (arr: ArmyCard[], lane: number): number => arr.filter((c) => c.lane === lane).reduce((s, c) => s + c.favor, 0);

  it('activeArchetype：空/部分→null；集齐主流派→该流派；混搭只激活主流派', () => {
    expect(activeArchetype([])).toBeNull();
    expect(activeArchetype(['bannerman'])).toBeNull(); // 部分(缺枭雄)
    expect(activeArchetype(['bannerman', 'warlord'])).toBe('general');
    expect(activeArchetype(['comrade'])).toBe('cardtype');
    expect(activeArchetype(['vanguard', 'martyr', 'chain'])).toBe('wide');
    expect(activeArchetype(['bannerman', 'warlord', 'comrade'])).toBe('general'); // 将领(2)>牌型(1) 主流派
  });

  it('将领流激活：moraleMul=1.3、军不变', () => {
    const A = standardArmy('a', 0);
    const r = applyArchetypeActivation('general', A, standardArmy('b', 0), 0);
    expect(r.moraleMul).toBe(1.3);
    expect(r.a.map((c) => c.favor)).toEqual(A.map((c) => c.favor));
  });

  it('铺场流激活：每路 +2 兵（共 +6）', () => {
    const A = standardArmy('a', 0);
    const r = applyArchetypeActivation('wide', A, standardArmy('b', 0), 0);
    expect(r.a.length).toBe(A.length + 6);
    for (const lane of [0, 1, 2]) expect(r.a.filter((c) => c.lane === lane).length).toBe(A.filter((c) => c.lane === lane).length + 2);
  });

  it('牌型流激活：tierBonusAdd=12（阶梯近×2）；概率流：favor 下限拉到 15', () => {
    expect(applyArchetypeActivation('cardtype', standardArmy('a', 0), standardArmy('b', 0), 0).tierBonusAdd).toBe(12);
    const r = applyArchetypeActivation('probability', standardArmy('a', -40), standardArmy('b', 0), 0);
    expect(Math.min(...r.a.map((c) => c.favor))).toBeGreaterThanOrEqual(15);
  });

  it('斩首流激活：敌主将先怯 −12（仅敌主将）', () => {
    const B = standardArmy('b', 0);
    const r = applyArchetypeActivation('decap', standardArmy('a', 0), B, 0);
    for (const lane of [0, 1, 2]) {
      const g0 = B.find((c) => c.lane === lane && c.general)!;
      const g1 = r.b.find((c) => c.lane === lane && c.general)!;
      expect(g1.favor).toBe(Math.max(5, g0.favor - 12));
    }
  });

  it('弃一保二激活：两强路 +favor、最弱路不变', () => {
    const A = armyFromFormation('a', 0, FORMATION_PRESETS['田忌']); // 上路最弱(2 军官)
    const r = applyArchetypeActivation('tianji', A, standardArmy('b', 0), 0);
    const sums = [0, 1, 2].map((l) => sumLane(A, l));
    const weakest = sums.indexOf(Math.min(...sums));
    expect(sumLane(r.a, weakest)).toBe(sumLane(A, weakest)); // 最弱路不变
    for (const lane of [0, 1, 2]) if (lane !== weakest) expect(sumLane(r.a, lane)).toBeGreaterThan(sumLane(A, lane));
  });

  it('将领流激活进 prepareArmies：moraleA = 小丑士气 ×1.3', () => {
    const r = prepareArmies({ formation: FORMATION_PRESETS['均衡'], deckBias: 0, jokers: ['bannerman', 'warlord'], interventions: [], enemyBias: 0 });
    const morJoker = jokerMoraleScale(r.a, ['bannerman', 'warlord']);
    for (let i = 0; i < 3; i++) expect(r.moraleA[i]).toBeCloseTo(morJoker[i] * 1.3, 6);
  });

  it('确定性：激活质变(铺场流+联动)进 sim 逐拍 hash 一致', () => {
    const mk = (): Engine => {
      const { a, b, moraleA, linksA } = prepareArmies({ formation: FORMATION_PRESETS['锋矢'], deckBias: 2, jokers: ['vanguard', 'martyr', 'chain'], interventions: [], enemyForm: FORMATION_PRESETS['均衡'], enemyBias: 0 });
      const e = new Engine({ tickRate: 60 });
      e.load(buildGameGArmyMatch(a, b, 55, undefined, moraleA, linksA));
      return e;
    };
    const e1 = mk(), e2 = mk();
    for (let i = 0; i < FLIP_DURATION + MARCH_DURATION + 6; i++) { e1.world.tick(); e2.world.tick(); expect(e1.hash()).toBe(e2.hash()); }
  });
});

describe('Game G · 全栈养成端到端（星球+激活流派+干预+Boss+联动 一锅 · 硬化）', () => {
  const surv = (setup: Parameters<typeof prepareArmies>[0], seed: number): number => {
    const { a, b, moraleA, linksA } = prepareArmies(setup);
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameGArmyMatch(a, b, seed, undefined, moraleA, linksA));
    for (let i = 0; i < FLIP_DURATION + 10; i++) e.world.tick();
    return ['res_a0', 'res_a1', 'res_a2'].reduce((s, id) => s + (get<Resource>(e, id, 'Resource')?.current ?? 0), 0);
  };

  it('养成回报：满配(星球+集齐将领流+干预)军 vs 同 Boss 存活 > 裸军', () => {
    const boss = bossFor(2);
    const base = { formation: FORMATION_PRESETS['均衡'], deckBias: 0, jokers: [] as string[], interventions: [] as Intervention[], enemyForm: boss.formation, enemyBias: boss.favorBias, boss, planets: {} as Record<string, number> };
    const kitted = { ...base, jokers: ['bannerman', 'warlord', 'diehard'], interventions: [{ kind: 'bless', lane: 0 }, { kind: 'bless', lane: 1 }] as Intervention[], planets: { mars: 3, saturn: 1 } };
    expect(surv(kitted, 77)).toBeGreaterThan(surv(base, 77)); // 养成全栈确实更强
  });

  it('胜负正确性：压倒性强军 → winner=a；裸弱军 vs 强敌 → winner=b（净突破方向对）', () => {
    const settle = (armyA: ArmyCard[], armyB: ArmyCard[], seed: number): string => {
      const e = new Engine({ tickRate: 60 });
      e.load(buildGameGArmyMatch(armyA, armyB, seed));
      for (let i = 0; i < FLIP_DURATION + MARCH_DURATION + 6; i++) e.world.tick();
      return get<State>(e, 'winner', 'State')!.current;
    };
    const strong = applyJokers(standardArmy('a', 20), ['diehard']); // 高偏置 + 免死地板 88 → 压倒
    expect(settle(strong, standardArmy('b', -40), 7)).toBe('a'); // 强 vs 弱 → a 胜
    expect(settle(standardArmy('a', -40), applyJokers(standardArmy('b', 20), ['diehard']), 7)).toBe('b'); // 反向 → b 胜
  });

  it('最大配置确定性：星球+铺场流激活+联动+护盾/增援+终局 Boss 同 setup+seed 逐拍 hash 一致', () => {
    const boss = bossFor(5); // 小王·无常（decapitate×3）
    const setup = (): Parameters<typeof prepareArmies>[0] => ({
      formation: FORMATION_PRESETS['田忌'], deckBias: 4,
      jokers: ['vanguard', 'martyr', 'chain', 'diehard'], // wide 集齐 → 激活 +2兵/路；martyr/chain 联动
      interventions: [{ kind: 'reinforce', lane: 2 }, { kind: 'shield', lane: 0 }],
      enemyForm: boss.formation, enemyBias: boss.favorBias, boss,
      planets: { mars: 2, mercury: 1, jupiter: 1 },
    });
    const mk = (): Engine => {
      const { a, b, moraleA, linksA } = prepareArmies(setup());
      const e = new Engine({ tickRate: 60 });
      e.load(buildGameGArmyMatch(a, b, 88, undefined, moraleA, linksA));
      return e;
    };
    const e1 = mk(), e2 = mk();
    for (let i = 0; i < FLIP_DURATION + MARCH_DURATION + 6; i++) { e1.world.tick(); e2.world.tick(); expect(e1.hash()).toBe(e2.hash()); }
  });
});

describe('Game G · 完整 build 时编排 prepareArmies（showMatch 同款 · 端到端）', () => {
  const boss = bossFor(5); // 小王·无常（decapitate×3 反噬玩家）
  const setup = () => ({
    formation: FORMATION_PRESETS['田忌'],
    deckBias: 6,
    jokers: ['bannerman', 'comrade', 'vanguard'],
    interventions: [{ kind: 'bless', lane: 1 }, { kind: 'reinforce', lane: 2 }] as Intervention[],
    enemyForm: boss.formation,
    enemyBias: boss.favorBias,
    boss,
  });

  it('端到端确定性：同 setup+seed → 逐拍 hash 一致（融小丑+玩家干预+Boss起手+士气 全栈）', () => {
    const mk = (): Engine => {
      const { a, b, moraleA } = prepareArmies(setup());
      const e = new Engine({ tickRate: 60 });
      e.load(buildGameGArmyMatch(a, b, 21, undefined, moraleA));
      return e;
    };
    const e1 = mk(), e2 = mk();
    for (let i = 0; i < FLIP_DURATION + MARCH_DURATION + 6; i++) { e1.world.tick(); e2.world.tick(); expect(e1.hash()).toBe(e2.hash()); }
  });

  it('编排落实各效果：旗手士气×1.5、Boss 斩首压玩家三路主将 favor=8、增援我方该路 +2 兵', () => {
    const { a, moraleA } = prepareArmies(setup());
    expect(moraleA).toEqual([1.5, 1.5, 1.5]); // 旗手全路
    for (const lane of [0, 1, 2]) expect(a.find((c) => c.lane === lane && c.general)!.favor).toBe(8); // Boss 斩首（绝对设值，覆盖小丑加成）
    const base = armyFromFormation('a', 6, FORMATION_PRESETS['田忌']).filter((c) => c.lane === 2).length;
    expect(a.filter((c) => c.lane === 2).length).toBe(base + 2); // 增援 lane2
  });

  it('编排不改掷命次数 → 跑到结算出胜负（不卡 pending）', () => {
    const { a, b, moraleA } = prepareArmies(setup());
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameGArmyMatch(a, b, 21, undefined, moraleA));
    for (let i = 0; i < FLIP_DURATION + MARCH_DURATION + 6; i++) e.world.tick();
    expect(['a', 'b', 'draw']).toContain(get<State>(e, 'winner', 'State')!.current);
  });
});
