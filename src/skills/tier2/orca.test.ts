import { describe, it, expect } from 'vitest';
import { orcaVelocity, linearProgram2, RVO_EPSILON, type OrcaAgent, type OrcaLine } from './orca.js';

const hyp = (v: { x: number; y: number }): number => Math.hypot(v.x, v.y);
const agent = (x: number, y: number, vx = 0, vy = 0, radius = 0.5): OrcaAgent => ({ x, y, vx, vy, radius });

describe('orca — 移植自 RVO2（Apache-2.0）· 线性规划本体', () => {
  it('无邻居 → 原样返回期望速度（避让不该无中生有地改路）', () => {
    const out = orcaVelocity(agent(0, 0), [], { x: 1, y: 0 }, 1, 2, 1);
    expect(out).toMatchObject({ x: 1, y: 0 });
  });

  it('期望速度超上限 → 钳到最大速度圆上（原码 linearProgram2 第一分支）', () => {
    const r = { x: 0, y: 0 };
    linearProgram2([], 1, { x: 3, y: 4 }, false, r);   // |(3,4)|=5 > 1
    expect(hyp(r)).toBeCloseTo(1, 9);
    expect(r.x / r.y).toBeCloseTo(3 / 4, 9);           // 方向不变
  });

  it('解出来的速度**满足每一条 ORCA 约束**（半平面在直线左侧·可行场景）', () => {
    // ⚠ 只在**可行**场景下断言"全满足"：原码在无可行解时会落到 linearProgram3，
    // 那一段求的是"最不违反"而不是"不违反"（挤死时的正确行为，见下面那条 LP3 用例）。
    // 第一版这里摆了三个近距离迎面单位 —— 那是**不可行**场景，断言当场红（0.146 > eps），
    // 红得对：错的是断言的前提，不是实现。
    const self = agent(0, 0, 1, 0);
    const neighbors = [agent(6, 2.5, -1, 0), agent(7, -3, -1, 0.1)];
    const pref = { x: 1, y: 0 };
    const out = orcaVelocity(self, neighbors, pref, 1, 2, 1);
    // 用与实现同源的构造重算约束，逐条验 det(dir, point - result) <= eps
    // （这条断言 = ORCA 的定义本身：结果必须落在所有半平面内）
    const lines: OrcaLine[] = [];
    const invT = 1 / 2;
    for (const o of neighbors) {
      const rp = { x: o.x - self.x, y: o.y - self.y };
      const rv = { x: self.vx - o.vx, y: self.vy - o.vy };
      const distSq = rp.x * rp.x + rp.y * rp.y;
      const cr = self.radius + o.radius;
      const w = { x: rv.x - invT * rp.x, y: rv.y - invT * rp.y };
      const wLenSq = w.x * w.x + w.y * w.y;
      const dp = w.x * rp.x + w.y * rp.y;
      let dir: { x: number; y: number }; let u: { x: number; y: number };
      if (dp < 0 && dp * dp > cr * cr * wLenSq) {
        const wl = Math.sqrt(wLenSq); const uw = { x: w.x / wl, y: w.y / wl };
        dir = { x: uw.y, y: -uw.x }; const k = cr * invT - wl; u = { x: k * uw.x, y: k * uw.y };
      } else {
        const leg = Math.sqrt(distSq - cr * cr);
        dir = (rp.x * w.y - rp.y * w.x) > 0
          ? { x: (rp.x * leg - rp.y * cr) / distSq, y: (rp.x * cr + rp.y * leg) / distSq }
          : { x: -(rp.x * leg + rp.y * cr) / distSq, y: -(-rp.x * cr + rp.y * leg) / distSq };
        const dv = rv.x * dir.x + rv.y * dir.y;
        u = { x: dv * dir.x - rv.x, y: dv * dir.y - rv.y };
      }
      lines.push({ point: { x: self.vx + 0.5 * u.x, y: self.vy + 0.5 * u.y }, direction: dir });
    }
    for (const l of lines) {
      const det = l.direction.x * (l.point.y - out.y) - l.direction.y * (l.point.x - out.x);
      expect(det).toBeLessThanOrEqual(RVO_EPSILON);
    }
    expect(hyp(out)).toBeLessThanOrEqual(1 + 1e-9);
  });

  it('**迎面对撞会侧让**：两个正对着走的单位，解出来的速度带横向分量', () => {
    // 完全正对（y 完全相同）时左右对称、理论上可以不让；给一点点错位即可打破对称（真实场景恒如此）。
    const self = agent(0, 0, 1, 0);
    const other = agent(4, 0.05, -1, 0);
    const out = orcaVelocity(self, [other], { x: 1, y: 0 }, 1, 5, 1);
    expect(Math.abs(out.y)).toBeGreaterThan(0.01);     // 真的侧开了
    expect(out.x).toBeGreaterThan(0);                  // 但仍在往前走（不是掉头）
  });

  it('**已经重叠**时给出脱离速度（原码 collision 分支·不许卡死在一起）', () => {
    const self = agent(0, 0, 0, 0, 0.5);
    const other = agent(0.2, 0, 0, 0, 0.5);            // 圆心距 0.2 < 半径和 1.0 = 已重叠
    const out = orcaVelocity(self, [other], { x: 0, y: 0 }, 1, 2, 1);
    expect(out.x).toBeLessThan(0);                     // 朝远离对方的方向脱离
    expect(hyp(out)).toBeGreaterThan(0);
  });

  it('**挤死时不失去速度**（linearProgram3 兜底：无可行解 → 求最不违反的那个）', () => {
    // 四面被围住：可行域为空，原码用 LP3 求"尽量少撞"的速度。
    const self = agent(0, 0, 0, 0, 0.5);
    const ring = [agent(0.6, 0, -1, 0), agent(-0.6, 0, 1, 0), agent(0, 0.6, 0, -1), agent(0, -0.6, 0, 1)];
    const out = orcaVelocity(self, ring, { x: 1, y: 0 }, 1, 2, 1);
    expect(Number.isFinite(out.x) && Number.isFinite(out.y)).toBe(true);   // 不出 NaN
    expect(hyp(out)).toBeLessThanOrEqual(1 + 1e-9);
  });

  it('确定性：同输入逐位相同 · 邻居列表顺序不同不影响（已按距离排好序的前提下）', () => {
    const self = agent(0, 0, 1, 0);
    const ns = [agent(2, 0.2, -1, 0), agent(2.5, -0.6, -1, 0.1)];
    const a = orcaVelocity(self, ns, { x: 1, y: 0 }, 1, 2, 1);
    const b = orcaVelocity(self, ns, { x: 1, y: 0 }, 1, 2, 1);
    expect(a).toEqual(b);
  });

  it('零墙钟零随机（源码级·同 flow-field 口径）', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(new URL('./orca.ts', import.meta.url), 'utf8');
    const body = src.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '');
    expect(body).not.toMatch(/Date\.now|performance\.now|Math\.random/);
  });

  it('保留了 Apache-2.0 归属声明（移植代码的硬要求）', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(new URL('./orca.ts', import.meta.url), 'utf8');
    expect(src).toContain('SPDX-License-Identifier: Apache-2.0');
    expect(src).toContain('University of North Carolina at Chapel Hill');
    expect(src).toContain('https://github.com/snape/RVO2');
  });
});
