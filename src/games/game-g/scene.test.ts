import { describe, it, expect } from 'vitest';
import { cardScreenPos, laneScores, TOWERS, LANE_Y, CONTEST } from './scene.js';

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
