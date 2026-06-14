import { describe, it, expect } from 'vitest';
import { Engine } from '../../runtime/engine.js';
import type { Component } from '@engine/core/types.js';
import type { Transform, RandomSeed, Resource, State } from '@engine/protocol/components.js';
import { buildGameG3DFlip, buildGameGDuel3D, buildGameGMatch, decideFaceUp, flipTarget, FLIP_DURATION, FLIP_SPINS, MATCH_REWARD, type FateCard } from './blueprint.js';

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
