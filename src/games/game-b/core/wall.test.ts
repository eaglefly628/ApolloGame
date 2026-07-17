// Game B ·《雀宴》麻将核切片① —— 牌山/洗牌/配牌/开门测试（清单 §1 逐条 + 确定性总闸）。
// 口径真相=docs/design/game-b/mahjong-core-tests.md §1；确定性=同 seed 全复现（walkthrough 依据）。
import { describe, it, expect } from 'vitest';
import {
  buildWall, dealWall, doraFromIndicator, wallHealth, type WallConfig,
} from './wall.js';
import {
  kindOf, isRed, NUM_KINDS, FULL_WALL, RED_FIVE_KINDS, RED_OFFSET,
} from './tiles-def.js';

const cfg = (seed: number, akaDora = true): WallConfig => ({ seed, akaDora });

describe('§1 建山（buildWall）', () => {
  it('136 枚·34 种各 4·赤5 开=恰 3 枚赤（每色一枚）', () => {
    const wall = buildWall(true);
    expect(wall).toHaveLength(FULL_WALL);
    const perKind = new Array<number>(NUM_KINDS).fill(0);
    for (const c of wall) perKind[kindOf(c)]++;
    expect(perKind.every((n) => n === 4)).toBe(true);
    const reds = wall.filter(isRed);
    expect(reds).toHaveLength(3);
    expect(reds.map(kindOf).sort((a, b) => a - b))
      .toEqual([RED_FIVE_KINDS.man, RED_FIVE_KINDS.pin, RED_FIVE_KINDS.sou].sort((a, b) => a - b));
  });

  it('赤5 关=0 枚赤·仍守恒 136·每种 4', () => {
    const wall = buildWall(false);
    expect(wall).toHaveLength(FULL_WALL);
    expect(wall.filter(isRed)).toHaveLength(0);
    const perKind = new Array<number>(NUM_KINDS).fill(0);
    for (const c of wall) perKind[kindOf(c)]++;
    expect(perKind.every((n) => n === 4)).toBe(true);
  });

  it('赤枚 = 普5 种码 + 100（man5红=104/pin5红=113/sou5红=122）', () => {
    const reds = buildWall(true).filter(isRed).sort((a, b) => a - b);
    expect(reds).toEqual([
      RED_FIVE_KINDS.man + RED_OFFSET, RED_FIVE_KINDS.pin + RED_OFFSET, RED_FIVE_KINDS.sou + RED_OFFSET,
    ]);
  });
});

describe('§1 洗牌·配牌·开门（dealWall）', () => {
  it('配牌各 13·活山余 70·王牌 14（东风战余牌口径）', () => {
    const d = dealWall(cfg(42));
    expect(d.hands).toHaveLength(4);
    for (const h of d.hands) expect(h).toHaveLength(13);
    expect(d.drawWall).toHaveLength(70);
    expect(d.deadWall).toHaveLength(14);
    // 全牌守恒 136·每种 4 枚（配牌+活山+王牌无遗漏无重复）
    const health = wallHealth(d);
    expect(health.total).toBe(FULL_WALL);
    expect(health.perKindOk).toBe(true);
  });

  it('掷骰：两骰各 1-6·sum∈2-12·开门家=(sum-1)%4', () => {
    const d = dealWall(cfg(7));
    expect(d.dice[0]).toBeGreaterThanOrEqual(1);
    expect(d.dice[0]).toBeLessThanOrEqual(6);
    expect(d.dice[1]).toBeGreaterThanOrEqual(1);
    expect(d.dice[1]).toBeLessThanOrEqual(6);
    const sum = d.dice[0] + d.dice[1];
    expect(d.openWall).toBe((sum - 1) % 4);
    expect(d.breakPos).toBeGreaterThanOrEqual(0);
    expect(d.breakPos).toBeLessThan(FULL_WALL);
  });

  it('宝牌指示牌=王牌第 3 墩上牌(index4)·裏=其下张(index5)', () => {
    const d = dealWall(cfg(99));
    expect(d.doraIndicator).toBe(d.deadWall[4]);
    expect(d.uraIndicator).toBe(d.deadWall[5]);
  });

  it('赤5 关：整局零赤枚（守恒 136）', () => {
    const d = dealWall(cfg(42, false));
    const all = [...d.hands.flat(), ...d.drawWall, ...d.deadWall];
    expect(all).toHaveLength(FULL_WALL);
    expect(all.filter(isRed)).toHaveLength(0);
  });
});

describe('§1 确定性（同 seed 全复现·异 seed 异·walkthrough 总闸）', () => {
  it('同 seed → 配牌/活山/王牌/骰点逐张相同', () => {
    const a = dealWall(cfg(2026));
    const b = dealWall(cfg(2026));
    expect(a.hands).toEqual(b.hands);
    expect(a.drawWall).toEqual(b.drawWall);
    expect(a.deadWall).toEqual(b.deadWall);
    expect(a.dice).toEqual(b.dice);
    expect(a.breakPos).toBe(b.breakPos);
  });

  it('异 seed → 配牌不同（洗牌真随机·种子驱动）', () => {
    const a = dealWall(cfg(1));
    const b = dealWall(cfg(2));
    expect(a.hands).not.toEqual(b.hands);
  });

  it('零裸随机：不引 Math.random（源码静态自证=引擎 seededShuffle/randomInt）', async () => {
    // 逻辑核只经引擎 w1-random 派生；本例以「同 seed 双跑同结果」作行为佐证（裸 random 会破此不变量）。
    const runs = [11, 11, 11].map((s) => JSON.stringify(dealWall(cfg(s)).hands));
    expect(new Set(runs).size).toBe(1);
  });
});

describe('§1 宝牌环回（doraFromIndicator·标准环）', () => {
  it('数牌 9→1 同花色环回·中张 +1', () => {
    expect(doraFromIndicator(0)).toBe(1); // man1→man2
    expect(doraFromIndicator(8)).toBe(0); // man9→man1（环回）
    expect(doraFromIndicator(17)).toBe(9); // pin9→pin1
    expect(doraFromIndicator(26)).toBe(18); // sou9→sou1
  });
  it('风牌 北→東環·三元 中→白環', () => {
    expect(doraFromIndicator(27)).toBe(28); // 東→南
    expect(doraFromIndicator(30)).toBe(27); // 北→東（環）
    expect(doraFromIndicator(31)).toBe(32); // 白→發
    expect(doraFromIndicator(33)).toBe(31); // 中→白（環）
  });
  it('赤5 指示（code≥100）按其普5 种环回', () => {
    expect(doraFromIndicator(RED_FIVE_KINDS.man + RED_OFFSET)).toBe(RED_FIVE_KINDS.man + 1); // 赤man5→man6
  });
});
