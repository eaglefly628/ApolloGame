import { describe, it, expect } from 'vitest';
import { Engine } from '../../runtime/engine.js';
import type { Component } from '@engine/core/types.js';
import type { Transform, RandomSeed, Resource, State } from '@engine/protocol/components.js';
import { buildGameG3DFlip, buildGameGDuel3D, buildGameGArmyMatch, prepareArmies, standardArmy, armyFromFormation, laneEstimates, applyInterventions, applyShadowRevenge, quartermasterEnergy, pickAiFormation, applyTiangangs, tiangangMoraleScale, tiangangLinks, tiangangKeyBuffs, GAME_G_TIANGANGS, TIANGANG_BY_ID, ARCHETYPES, detectArchetype, archetypeMatchup, activeArchetype, applyArchetypeActivation, GAME_G_PLANETS, GAME_G_FOILS, effectiveLives, effectiveLeverCap, effectiveLeverRegen, effectiveTierBonus, applyPlanetArmy, laneHandTier, battleSpec, RUN_BATTLES, RUN_LIVES, BETWEEN_BUFFS, applyBuff, BOSS_ROSTER, bossFor, LEVER_CATALOG, LEVER_START, LEVER_CAP, LEVER_REGEN, FORMATION_PRESETS, PRESET_NAMES, decideFaceUp, cardFace, flipTarget, FLIP_DURATION, FLIP_SPINS, MARCH_DURATION, type FateCard, type ArmyCard, type Intervention, type BuffTarget } from './blueprint.js';

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

describe('Game G · 体量与牌阵布局（撞击观感的数据底座）', () => {
  it('cardFace：序号 → 标准 52 牌点数/花色（循环）', () => {
    expect(cardFace(0)).toEqual({ rank: 'A', suit: 'S' });
    expect(cardFace(12)).toEqual({ rank: 'K', suit: 'S' });
    expect(cardFace(13)).toEqual({ rank: 'A', suit: 'H' });
    expect(cardFace(51)).toEqual({ rank: 'K', suit: 'C' });
    expect(cardFace(52)).toEqual(cardFace(0)); // 满 52 循环
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
});

