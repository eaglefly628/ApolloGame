// game-d sim 单测（此前 0 测试）——盯两处刚接入引擎系统的路径：
//   ① 种子化随机（RandomSeed + nextRandom）替代 Math.random → 确定性/可回放/双人 lockstep 基石。
//   ② 骰型判定复用 poker-hand 计数内核（evaluateHand.rankCounts + rankMaxCount），不再手写元素直方图。
import { describe, it, expect } from 'vitest';
import { loadoutPattern } from './game-d.js';
import { makeDie, rollPool, type DieDef } from './dice.js';
import { nextRandom } from '@skills/atoms/random/index.js';
import type { RandomSeed } from '@engine/protocol/components.js';

const def = (el: string): DieDef => ({ el } as unknown as DieDef);
const seed = (s: number): RandomSeed => ({ type: 'RandomSeed', seed: s, sequence: 0 } as RandomSeed);
const seededRnd = (s: RandomSeed) => (): number => nextRandom(s);

describe('game-d · 种子化随机（确定性/可回放·绝不 Math.random）', () => {
  it('同种子 → 同掷骰序列（rollPool 走 nextRandom）', () => {
    const pool = ['lieyan', 'hanquan', 'tengman', 'jinglei', 'qingfeng'].map(makeDie);
    const ra = rollPool(pool, seededRnd(seed(20260702)));
    const rb = rollPool(pool, seededRnd(seed(20260702)));
    expect(ra.map((r) => [r.v, r.el])).toEqual(rb.map((r) => [r.v, r.el]));
  });
  it('不同种子 → 序列（大概率）不同', () => {
    const pool = Array.from({ length: 8 }, () => makeDie('lieyan'));
    const ra = rollPool(pool, seededRnd(seed(1))).map((r) => r.v);
    const rb = rollPool(pool, seededRnd(seed(999))).map((r) => r.v);
    expect(ra).not.toEqual(rb);
  });
  it('nextRandom 就地推进 sequence（回放游标）', () => {
    const s = seed(42);
    nextRandom(s); nextRandom(s);
    expect(s.sequence).toBe(2);
  });
});

describe('game-d · 骰型判定复用 poker-hand 计数内核', () => {
  it('空骰组', () => expect(loadoutPattern([]).name).toBe('空骰组'));
  it('五种不同 + 满 5 → 五星同辉', () =>
    expect(loadoutPattern(['huo', 'shui', 'mu', 'lei', 'feng'].map(def)).name).toBe('五星同辉'));
  it('三同 → 三元和鸣', () =>
    expect(loadoutPattern(['huo', 'huo', 'huo', 'shui'].map(def)).name).toBe('三元和鸣'));
  it('四种不同（不满 5）→ 四方汇聚', () =>
    expect(loadoutPattern(['huo', 'shui', 'mu', 'lei'].map(def)).name).toBe('四方汇聚'));
  it('两同 → 元素对子', () =>
    expect(loadoutPattern(['huo', 'huo', 'shui'].map(def)).name).toBe('元素对子'));
  it('wild 不计入计数（百搭）：两火 + wild 仍是元素对子', () =>
    expect(loadoutPattern(['huo', 'huo', 'wild'].map(def)).name).toBe('元素对子'));
  it('各一色（<4 种）→ 杂色阵', () =>
    expect(loadoutPattern(['huo', 'shui', 'mu'].map(def)).name).toBe('杂色阵'));
});
