// duel-spike 纯函数测试（物理表现不可测·但「朝向→生死→判词」「凸包形状」「组数→布局」这三步是纯函数·必须钉死）。
import { describe, it, expect } from 'vitest';
import { judgeDuel, upYOf, bevelDiscHull, tallyOf, layoutFor, throwPlan, isHit, HIT_DIST_RATIO, DUEL_COUNTS, type CardOutcome, type DuelOutcome } from './duel-spike.js';

const c = (side: 'a' | 'b', upY: number): CardOutcome => ({ side, upY, front: upY > 0 });
const duel = (aUp: number, bUp: number): DuelOutcome => {
  const a = c('a', aUp), b = c('b', bUp);
  return { a, b, verdict: judgeDuel(a, b) };
};
/** 绕 X 轴转 θ 的四元数（牌翻面就是绕面内水平轴翻）。 */
const qx = (t: number): [number, number, number, number] => [Math.sin(t / 2), 0, 0, Math.cos(t / 2)];
/** 绕 Z 轴（= 牌面法线）转 θ —— 面内自转。 */
const qz = (t: number): [number, number, number, number] => [0, 0, Math.sin(t / 2), Math.cos(t / 2)];
/** 绕 Y（世界竖直轴）转 θ。 */
const qy = (t: number): [number, number, number, number] => [0, Math.sin(t / 2), 0, Math.cos(t / 2)];
/** 四元数乘（先施 r 再施 l）。 */
const mul = (l: readonly number[], r: readonly number[]): [number, number, number, number] => [
  l[3]! * r[0]! + l[0]! * r[3]! + l[1]! * r[2]! - l[2]! * r[1]!,
  l[3]! * r[1]! - l[0]! * r[2]! + l[1]! * r[3]! + l[2]! * r[0]!,
  l[3]! * r[2]! + l[0]! * r[1]! - l[1]! * r[0]! + l[2]! * r[3]!,
  l[3]! * r[3]! - l[0]! * r[0]! - l[1]! * r[1]! - l[2]! * r[2]!,
];

describe('judgeDuel · 抛掷定生死', () => {
  it('一正一反 → 正面者胜（我方正面=胜）', () => {
    expect(judgeDuel(c('a', 0.99), c('b', -0.99))).toBe('我方正面朝上 · 胜');
  });
  it('一正一反 → 正面者胜（敌方正面=负）', () => {
    expect(judgeDuel(c('a', -0.99), c('b', 0.99))).toBe('敌方正面朝上 · 负');
  });
  it('双正 → 同生（平）', () => {
    expect(judgeDuel(c('a', 0.99), c('b', 0.96))).toBe('双双正面 · 同生（平）');
  });
  it('双反 → 同归于尽（平）', () => {
    expect(judgeDuel(c('a', -0.99), c('b', -0.96))).toBe('双双反面 · 同归于尽（平）');
  });
});

describe('upYOf · 牌面朝向读数（正面法线 = 局部 +Z）', () => {
  // 盒牌**未旋转时是立着的**（法线沿世界 +Z 水平指向镜头）→ 平躺正面朝上 = 绕 X 转 −90°。
  it('未旋转 = 立着（法线水平·0）', () => { expect(upYOf([0, 0, 0, 1])).toBeCloseTo(0, 6); });
  it('绕 X 转 −90° = 正面朝上（+1·活）', () => { expect(upYOf(qx(-Math.PI / 2))).toBeCloseTo(1, 6); });
  it('绕 X 转 +90° = 反面朝上（−1·死）', () => { expect(upYOf(qx(Math.PI / 2))).toBeCloseTo(-1, 6); });
  it('平躺后再绕世界竖直轴打转，仍是正面朝上 —— 牌在桌上转圈不该改判生死', () => {
    for (const t of [0.4, 1.3, 2.9, 4.8]) expect(upYOf(mul(qy(t), qx(-Math.PI / 2)))).toBeCloseTo(1, 6);
  });
  it('读数恒在 [−1,1] 内（任意姿态）', () => {
    for (const [a, b, c2] of [[0.3, 1.1, 2.0], [2.2, 0.7, 5.1], [1.0, 4.0, 0.2]]) {
      const v = upYOf(mul(mul(qx(a!), qy(b!)), qz(c2!)));
      expect(v).toBeGreaterThanOrEqual(-1.000001); expect(v).toBeLessThanOrEqual(1.000001);
    }
  });
});

describe('bevelDiscHull · 收尖圆盘凸包（牌立不住的几何依据）', () => {
  const R = 1.12, T = 0.085, K = 0.82, SEG = 16;
  const hull = bevelDiscHull(R, T, K, SEG);
  it('3×seg 个顶点（中腰/正面/反面 三层同心环）', () => { expect(hull).toHaveLength(3 * SEG); });
  it('轮廓是**圆**：中腰一圈点到轴心距离恒等于 r —— owner 要的「旁边用圆形」', () => {
    const mid = hull.filter(([, , z]) => z === 0);
    expect(mid).toHaveLength(SEG);
    for (const [x, y] of mid) expect(Math.hypot(x, y)).toBeCloseTo(R, 6);
  });
  it('最宽处在中腰、两面收窄 → 边缘是环脊而非平面（站不住的关键）', () => {
    const faces = hull.filter(([, , z]) => z !== 0);
    for (const [x, y] of faces) expect(Math.hypot(x, y)).toBeCloseTo(R * K, 6);
    expect(R * K).toBeLessThan(R);
  });
  it('厚度不超 t（薄牌）', () => {
    for (const [, , z] of hull) expect(Math.abs(z)).toBeLessThanOrEqual(T / 2 + 1e-9);
  });
  it('分段越多越接近真圆：相邻中腰点夹角 = 2π/seg', () => {
    const mid = hull.filter(([, , z]) => z === 0);
    const a0 = Math.atan2(mid[0]![1], mid[0]![0]), a1 = Math.atan2(mid[1]![1], mid[1]![0]);
    expect(Math.abs(a1 - a0)).toBeCloseTo((2 * Math.PI) / SEG, 6);
  });
});

describe('tallyOf · 多组战况统计', () => {
  it('胜/负/平各自归类', () => {
    const t = tallyOf([duel(1, -1), duel(1, -1), duel(-1, 1), duel(1, 1), duel(-1, -1)]);
    expect(t).toEqual({ win: 2, lose: 1, draw: 2 });
  });
  it('空列表 → 全零', () => { expect(tallyOf([])).toEqual({ win: 0, lose: 0, draw: 0 }); });
});

describe('layoutFor · 组数 → 场地缩放', () => {
  it('1 组不缩（原尺寸）', () => { expect(layoutFor(1).scale).toBe(1); });
  it('组数越多牌越小、镜头越远（单调）', () => {
    let prevScale = Infinity, prevCam = 0;
    for (const n of DUEL_COUNTS) {
      const L = layoutFor(n);
      expect(L.scale).toBeLessThanOrEqual(prevScale);
      expect(L.camDist).toBeGreaterThanOrEqual(prevCam);
      prevScale = L.scale; prevCam = L.camDist;
    }
  });
  it('20 组仍能塞进桌面（总深 ≤ 桌深）', () => {
    const L = layoutFor(20);
    expect(20 * L.laneGap).toBeLessThanOrEqual(L.halfZ * 2);
  });
});

describe('throwPlan · 一对一空中对撞（owner「每张牌冲向对面对应那张」）', () => {
  const laneZ = 1.4, throwX = 2.6, vy = 8.6, tMeet = 0.36, stag = 0.26;
  const { a, b } = throwPlan(laneZ, throwX, vy, tMeet, stag);
  const at = (c: typeof a, t: number, g = 20): { x: number; y: number; z: number } =>
    ({ x: c.x + c.vx * t, y: c.y + c.vy * t - 0.5 * g * t * t, z: c.z + c.vz * t });

  it('① 交汇时刻 x 与 z 完全重合 —— 这就是「撞得上」的几何保证', () => {
    const pa = at(a, tMeet), pb = at(b, tMeet);
    expect(pa.x).toBeCloseTo(pb.x, 9);
    expect(pa.x).toBeCloseTo(0, 9);
    expect(pa.z).toBeCloseTo(pb.z, 9);
    expect(pa.z).toBeCloseTo(laneZ, 9);
  });
  it('② 速度严格镜像（等大反向的作用力·vz 恒 0）', () => {
    expect(a.vx).toBeCloseTo(-b.vx, 9);
    expect(a.vy).toBeCloseTo(b.vy, 9);
    expect(a.vz).toBe(0); expect(b.vz).toBe(0);
  });
  it('③ 全程 y 恒差 stagger —— 撞击点偏离质心·旋转由碰撞产生', () => {
    for (const t of [0, 0.1, tMeet, 0.5]) expect(at(a, t).y - at(b, t).y).toBeCloseTo(stag, 9);
  });
  it('④ 交汇时中心距 = stagger，远小于撞击判据 → 任何翻滚相位都必然接触', () => {
    const pa = at(a, tMeet), pb = at(b, tMeet);
    const d = Math.hypot(pa.x - pb.x, pa.y - pb.y, pa.z - pb.z);
    expect(d).toBeCloseTo(stag, 9);
    expect(isHit(d, 1.12)).toBe(true);
  });
  it('⑤ 回归护栏：上一版「出手即侧向分离」的写法交汇距离超判据 → 根本撞不上（记死这个坑）', () => {
    // 上一版：起手 z 错位 ±0.35R，再叠 Z 向持续分离速度 ±1.15 —— 两者都在把牌推开。
    const R = 1.12, zOff0 = 0.35 * R, VZ_BAD = 1.15;
    const zSep = 2 * (zOff0 + VZ_BAD * tMeet);              // 交汇时刻的 z 间距
    expect(isHit(Math.hypot(0, 0, zSep), R)).toBe(false);   // 实测对应「撞上 0/1 组·最近距 2.5+」
    // 只要去掉持续分离速度、把起手错位也归零，同样的抛法就必然撞上。
    expect(isHit(Math.hypot(0, stag, 0), R)).toBe(true);
  });
  it('⑥ 各组数下交汇点都落在本道中线上（不串道）', () => {
    for (const n of DUEL_COUNTS) {
      const L = layoutFor(n);
      const z = (n - 1) * L.laneGap;
      const p = throwPlan(z, 1.7 * L.scale + 0.9, vy, tMeet, stag * L.scale);
      expect(p.a.z).toBeCloseTo(z, 9); expect(p.b.z).toBeCloseTo(z, 9);
    }
  });
  it('HIT_DIST_RATIO 判据本身：≤1.2R 算撞上·超出不算', () => {
    expect(isHit(1.2 * 1.12, 1.12)).toBe(true);
    expect(isHit(1.2 * 1.12 + 0.01, 1.12)).toBe(false);
    expect(HIT_DIST_RATIO).toBe(1.2);
  });
});
