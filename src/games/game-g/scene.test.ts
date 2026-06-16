import { describe, it, expect } from 'vitest';
import { cardScreenPos, marchScreenPos, laneScores, TOWERS, LANE_Y, CONTEST, HOME_AX, HOME_BX } from './scene.js';
import { FLIP_DURATION, MARCH_DURATION } from './blueprint.js';

// 三路战场布局单一真相（render-frame SVG 评审帧 ↔ ThreeRenderer 真 3D 共用）。纯函数、headless 可测。
describe('Game G · scene 三路战场布局（单一真相）', () => {
  it('cardScreenPos：A 在中线左 / B 在右、对称；后排更远离中线；lane 决定 y 行', () => {
    const a0 = cardScreenPos(1, 'a', 0);
    const b0 = cardScreenPos(1, 'b', 0);
    expect(a0.x).toBeLessThan(CONTEST); // 我军左
    expect(b0.x).toBeGreaterThan(CONTEST); // 敌军右
    expect(CONTEST - a0.x).toBeCloseTo(b0.x - CONTEST, 6); // 接敌对称
    expect(cardScreenPos(1, 'a', 3).x).toBeLessThan(a0.x); // idx3=col1 后排更靠左老家
    expect(cardScreenPos(0, 'a', 1).y).toBeCloseTo(LANE_Y[0], 6); // 上路中行
    expect(cardScreenPos(2, 'a', 1).y).toBeCloseTo(LANE_Y[2], 6); // 下路中行
  });

  it('cardScreenPos：arc 抛飞弧上跳（y 减小）', () => {
    expect(cardScreenPos(1, 'a', 1, 1).y).toBeLessThan(cardScreenPos(1, 'a', 1, 0).y);
  });

  it('marchScreenPos：行军三相位——兵出老家 → 接敌中线 → 幸存突破敌家（亡者留中线，design/17）', () => {
    // 相位1 出发(elapsed=0)：双方各在自家老家前、分立中线两侧。
    const aOut = marchScreenPos(1, 'a', 0, true, 0);
    const bOut = marchScreenPos(1, 'b', 0, true, 0);
    expect(aOut.x).toBeLessThan(HOME_AX + 120); // 我军贴左老家
    expect(bOut.x).toBeGreaterThan(HOME_BX - 120); // 敌军贴右老家
    // 相位1→接敌(elapsed=FLIP_DURATION)：前锋收拢到中线两侧、对称、各向中线推进了。
    const aClash = marchScreenPos(1, 'a', 0, true, FLIP_DURATION);
    const bClash = marchScreenPos(1, 'b', 0, true, FLIP_DURATION);
    expect(aClash.x).toBeGreaterThan(aOut.x); // A 向右推进
    expect(bClash.x).toBeLessThan(bOut.x); // B 向左推进
    expect(CONTEST - aClash.x).toBeCloseTo(bClash.x - CONTEST, 6); // 接敌对称
    // 相位2 破家(elapsed=FLIP+MARCH)：幸存(faceUp)跨中线扑敌家；亡者(!faceUp)留中线。
    const aWin = marchScreenPos(1, 'a', 0, true, FLIP_DURATION + MARCH_DURATION);
    const aDead = marchScreenPos(1, 'a', 0, false, FLIP_DURATION + MARCH_DURATION);
    expect(aWin.x).toBeGreaterThan(HOME_BX - 160); // 幸存 A 扑到敌家附近
    expect(aDead.x).toBeLessThan(CONTEST); // 阵亡者留中线、未突破
  });

  it('laneScores：只数活牌、按 lane/side 归类', () => {
    const s = laneScores([
      { lane: 0, side: 'a', faceUp: true }, { lane: 0, side: 'a', faceUp: false },
      { lane: 0, side: 'b', faceUp: true }, { lane: 2, side: 'b', faceUp: true },
    ]);
    expect(s[0]).toEqual({ a: 1, b: 1 });
    expect(s[1]).toEqual({ a: 0, b: 0 });
    expect(s[2]).toEqual({ a: 0, b: 1 });
  });

  it('TOWERS：6 座（每路 A/B 各一），A 左 B 右', () => {
    expect(TOWERS).toHaveLength(6);
    expect(TOWERS.filter((t) => t.side === 'a').every((t) => t.x < CONTEST)).toBe(true);
    expect(TOWERS.filter((t) => t.side === 'b').every((t) => t.x > CONTEST)).toBe(true);
  });
});
