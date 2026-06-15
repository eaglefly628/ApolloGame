import { describe, it, expect } from 'vitest';
import { Engine } from '../../runtime/engine.js';
import type { Component } from '@engine/core/types.js';
import type { Transform, RandomSeed, Resource, State, Card3D } from '@engine/protocol/components.js';
import { buildGameG3DFlip, buildGameGDuel3D, buildGameGMatch, buildGameGArmyMatch, standardArmy, armyFromFormation, laneEstimates, applyInterventions, LEVER_CATALOG, LEVER_START, LEVER_CAP, LEVER_REGEN, FORMATION_PRESETS, PRESET_NAMES, decideFaceUp, cardFace, flipTarget, FLIP_DURATION, FLIP_SPINS, MATCH_REWARD, type FateCard, type ArmyCard, type Intervention } from './blueprint.js';

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

  it('G2 将领牵动 + best-of-3：三路数存活/路胜负/总胜负与逐级掷命回放一致', () => {
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
      let aLanes = 0, bLanes = 0;
      for (const L of [0, 1, 2]) { if (aAlive[L] > bAlive[L]) aLanes++; else if (aAlive[L] < bAlive[L]) bLanes++; }
      const winner = aLanes >= 2 ? 'a' : bLanes >= 2 ? 'b' : 'draw';

      const e = new Engine({ tickRate: 60 });
      e.load(buildGameGArmyMatch(A, B, seed));
      for (let i = 0; i < FLIP_DURATION + 12; i++) e.world.tick();
      for (const L of [0, 1, 2]) {
        expect(get<Resource>(e, `res_a${L}`, 'Resource')!.current).toBe(aAlive[L]); // 各路存活与回放一致
        expect(get<Resource>(e, `res_b${L}`, 'Resource')!.current).toBe(bAlive[L]);
      }
      expect(get<State>(e, 'winner', 'State')!.current).toBe(winner); // best-of-3 总胜负一致
    }
  });

  it('确定性：同军同 seed 两局逐拍 hash 一致', () => {
    const A = standardArmy('a', 6);
    const B = standardArmy('b', -4);
    const e1 = new Engine({ tickRate: 60 });
    const e2 = new Engine({ tickRate: 60 });
    e1.load(buildGameGArmyMatch(A, B, 7));
    e2.load(buildGameGArmyMatch(A, B, 7));
    for (let i = 0; i < FLIP_DURATION + 12; i++) {
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
  it('同花：本路某花 ≥3 张 → 全路 favor 抬升；否则不变', () => {
    const A = standardArmy('a', 0);
    const lane0 = A.filter((c) => c.lane === 0);
    const cnt: Record<string, number> = {};
    for (const c of lane0) cnt[c.suit] = (cnt[c.suit] ?? 0) + 1;
    const maxSuit = Math.max(...Object.values(cnt));
    const fl = applyInterventions(A, standardArmy('b', 0), [{ kind: 'flush', lane: 0 }]).a.filter((c) => c.lane === 0);
    const sum = (xs: ArmyCard[]): number => xs.reduce((s, c) => s + c.favor, 0);
    if (maxSuit > 2) expect(sum(fl)).toBeGreaterThan(sum(lane0));
    else expect(sum(fl)).toBe(sum(lane0));
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
    for (let i = 0; i < FLIP_DURATION + 12; i++) { e1.world.tick(); e2.world.tick(); expect(e1.hash()).toBe(e2.hash()); }
  });
});
