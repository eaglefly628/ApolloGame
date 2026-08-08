// duel-spike 纯函数测试（物理表现不可测·但「朝向→生死→判词」「凸包形状」「组数→布局」这三步是纯函数·必须钉死）。
import { describe, it, expect } from 'vitest';
import { judgeDuel, upYOf, bevelCardHull, tallyOf, layoutFor, DUEL_COUNTS, type CardOutcome, type DuelOutcome } from './duel-spike.js';

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

describe('bevelCardHull · 收尖棱凸包（牌立不住的几何依据）', () => {
  const W = 1.55, H = 2.15, T = 0.085, K = 0.87;
  const hull = bevelCardHull(W, H, T, K);
  it('12 个顶点（4 角 × 中腰/正面/反面）', () => { expect(hull).toHaveLength(12); });
  it('最宽处在中腰 z=0 —— 正/反面都收窄，故边缘是一道脊而非平面', () => {
    const mid = hull.filter(([, , z]) => z === 0);
    const faces = hull.filter(([, , z]) => z !== 0);
    expect(mid).toHaveLength(4);
    const maxMidX = Math.max(...mid.map(([x]) => Math.abs(x)));
    const maxFaceX = Math.max(...faces.map(([x]) => Math.abs(x)));
    expect(maxMidX).toBeCloseTo(W / 2, 6);
    expect(maxFaceX).toBeCloseTo((W / 2) * K, 6);
    expect(maxFaceX).toBeLessThan(maxMidX); // ← 立不住的关键：没有与桌面平行的侧面
  });
  it('外形仍是扑克牌矩形：不超出 W×H×T 包围盒（owner 要的不是圆牌）', () => {
    for (const [x, y, z] of hull) {
      expect(Math.abs(x)).toBeLessThanOrEqual(W / 2 + 1e-9);
      expect(Math.abs(y)).toBeLessThanOrEqual(H / 2 + 1e-9);
      expect(Math.abs(z)).toBeLessThanOrEqual(T / 2 + 1e-9);
    }
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
