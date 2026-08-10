// duel-spike 纯函数测试（物理表现不可测·但「朝向→生死→判词」「凸包形状」「组数→布局」这三步是纯函数·必须钉死）。
import { describe, it, expect } from 'vitest';
import { judgeDuel, upYOf, tallyOf, layoutFor, throwPlan, isHit, HIT_DIST_RATIO, DUEL_COUNTS, SPIN_BAND, flightTime, flipPhaseSpanHalfTurns, type CardOutcome, type DuelOutcome } from './duel-spike.js';

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

describe('upYOf · 牌面朝向读数（faceAxis:\'y\' → 正面法线 = 局部 +Y）', () => {
  // 沿 Y 薄的牌**未旋转就是平躺、正面朝上**（不再像沿 Z 薄那样出生即立着）。
  it('未旋转 = 正面朝上（+1·活）', () => { expect(upYOf([0, 0, 0, 1])).toBeCloseTo(1, 6); });
  it('绕 X 翻 180° = 反面朝上（−1·死）', () => { expect(upYOf(qx(Math.PI))).toBeCloseTo(-1, 6); });
  it('绕 X 翻 90° = 牌立着（法线水平·0）—— 原生 cylinder 圆盘让这个姿态落不住', () => {
    expect(upYOf(qx(Math.PI / 2))).toBeCloseTo(0, 6);
  });
  it('绕 Y（牌面法线）自转不改变正反 —— 牌在桌上打转不该改判生死', () => {
    for (const t of [0.4, 1.3, 2.9, 4.8]) expect(upYOf(qy(t))).toBeCloseTo(1, 6);
  });
  it('读数恒在 [−1,1] 内（任意姿态）', () => {
    for (const [a, b, c2] of [[0.3, 1.1, 2.0], [2.2, 0.7, 5.1], [1.0, 4.0, 0.2]]) {
      const v = upYOf(mul(mul(qx(a!), qy(b!)), qz(c2!)));
      expect(v).toBeGreaterThanOrEqual(-1.000001); expect(v).toBeLessThanOrEqual(1.000001);
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
  it('**牌尺寸恒定不缩**（scale 恒 1）—— 缩牌会让碰撞盘退化成方块·圆盘立不住的性质失效', () => {
    for (const n of DUEL_COUNTS) expect(layoutFor(n).scale).toBe(1);
  });
  it('道距恒定 ≥ 牌长 —— 相邻道的牌不会互相压住', () => {
    for (const n of DUEL_COUNTS) expect(layoutFor(n).laneGap).toBeGreaterThanOrEqual(2.15);
  });
  it('组数越多：桌子越深、镜头越远（单调）', () => {
    let prevZ = 0, prevCam = 0;
    for (const n of DUEL_COUNTS) {
      const L = layoutFor(n);
      expect(L.halfZ).toBeGreaterThanOrEqual(prevZ);
      expect(L.camDist).toBeGreaterThanOrEqual(prevCam);
      prevZ = L.halfZ; prevCam = L.camDist;
    }
  });
  it('各档都塞得进桌面（总深 ≤ 桌深）', () => {
    for (const n of DUEL_COUNTS) {
      const L = layoutFor(n);
      expect(n * L.laneGap).toBeLessThanOrEqual(L.halfZ * 2);
    }
  });

  // ⚠ 回归护栏（2026-08-10·`scripts/game211-throw-lab.mjs` 控制变量实测换来的）：
  //   围栏是**无 Mesh3D 的刚体** → 引擎 spawn() 回落 w=h=4 → 恒 Box(2,2,2)，尺寸改不了，只能推远。
  //   牌斜靠在围栏上会被读成「未躺平」——而「牌不许站住」是 owner 的硬要求。
  //   同种子同抛掷、只改围栏距离的实测曲线：
  //     内表面距道心 2.2 → 未躺平 6.42%（靠墙 99.6%）· 3.4 → 3.25% · 5.0 → 1.13% · 6.6 → 0.42%（到底）· 96.2 → 0.47%
  //   故阈值取 6.6。旧式 `halfZ = max(3.2, n·laneGap/2 + 1.2)` 在 n=1 时只给 2.2、20 组时最外道只剩 1.8
  //   （**比牌长 2.15 还短**）——两处都在这条线以下。
  const FENCE_HALF = 2;            // 围栏 Box 半宽（引擎回落值·非本游戏可选）
  const MIN_CLEARANCE = 6.6;       // 实测阈值
  it('每一档：最外道到围栏内表面的余量 ≥ 6.6（牌不许靠在墙上站住）', () => {
    for (const n of DUEL_COUNTS) {
      const L = layoutFor(n);
      const fenceInner = (L.halfZ + 1.0) - FENCE_HALF;      // 围栏中心 halfZ+1.0 · 内表面再减半宽
      const outerLane = ((n - 1) / 2) * L.laneGap;          // 最外道中心
      expect(fenceInner - outerLane).toBeGreaterThanOrEqual(MIN_CLEARANCE - 1e-9); // 设计值正好等于阈值·留浮点容差
    }
  });
  it('旧口径确实踩在阈值以下 —— 记死它为什么不行', () => {
    for (const [n, oldInner] of [[1, 2.2], [20, 32.2]] as const) {
      const outerLane = ((n - 1) / 2) * LANE_GAP_EXPECTED;
      expect(oldInner - outerLane).toBeLessThan(MIN_CLEARANCE);
    }
  });
  it('推远围栏**不得**改变取景 —— 镜头按内容深算，不按场地深算（1 组仍是原来的近景）', () => {
    expect(layoutFor(1).camDist).toBeCloseTo(7.2 + 3.2 * 1.15, 9);   // 修复前的历史值
    expect(layoutFor(20).camDist).toBeCloseTo(7.2 + (20 * 3.2 / 2 + 1.2) * 1.15, 9);
  });
});
const LANE_GAP_EXPECTED = 3.2;

describe('翻面自旋 · 落面 50/50 的前提（owner「一半正一半反」+「旋转再弱一点点」）', () => {
  // 出手参数取运行时口径：y0=0.9（throwPlan 的起手高）· vy∈[12.4,13.6] · 落地读数高 ≈0.09（牌半厚+地面）。
  const flight = (vy: number) => flightTime(0.9, vy, 0.09);

  it('飞行时间随抛高单调增（公式自洽）', () => {
    expect(flight(13.6)).toBeGreaterThan(flight(12.4));
    expect(flight(13)).toBeCloseTo((13 + Math.sqrt(13 * 13 + 2 * 20 * 0.81)) / 20, 9);
  });
  it('**相位跨度 ≥1 个半圈** —— 调弱旋转不得把落面调回系统性偏向某一面', () => {
    const span = flipPhaseSpanHalfTurns(SPIN_BAND.min, SPIN_BAND.max, flight(12.4)); // 取最短飞行=最保守
    expect(span).toBeGreaterThanOrEqual(1);
  });
  it('**最慢的牌也必须转过至少半圈** —— 下限太低会让慢牌恒定正面落地', () => {
    expect((SPIN_BAND.min * flight(12.4)) / Math.PI).toBeGreaterThanOrEqual(1);
  });
  it('回归护栏：旧值 SPIN0=2.2 恒定（无跨度）正是「大多反面朝上」的病根', () => {
    expect(flipPhaseSpanHalfTurns(2.2, 2.2, flight(13))).toBe(0);       // 跨度 0 → 所有牌同相位
    expect((2.2 * 0.56) / Math.PI).toBeLessThan(0.5);                   // 当时飞行 ~0.56s → 连半圈都不到
  });
});

describe('throwPlan · 一对一空中对撞（owner「每张牌冲向对面对应那张」）', () => {
  const laneZ = 1.4, throwX = 2.6, vy = 8.6, tMeet = 0.36, stag = 0.05, zsp = 0.82, R = 1.55 / 2;
  const { a, b } = throwPlan(laneZ, throwX, vy, tMeet, stag, zsp);
  const at = (c: typeof a, t: number, g = 20): { x: number; y: number; z: number } =>
    ({ x: c.x + c.vx * t, y: c.y + c.vy * t - 0.5 * g * t * t, z: c.z + c.vz * t });

  it('① 交汇时刻 x 完全重合、z 恒差 zSpread —— 撞得上的几何保证', () => {
    const pa = at(a, tMeet), pb = at(b, tMeet);
    expect(pa.x).toBeCloseTo(pb.x, 9);
    expect(pa.x).toBeCloseTo(0, 9);
    expect(pa.z - pb.z).toBeCloseTo(zsp, 9);
    expect((pa.z + pb.z) / 2).toBeCloseTo(laneZ, 9); // 仍以本道中线为对称轴·不串道
  });
  it('② 速度严格镜像（等大反向的作用力·vz 恒 0）', () => {
    expect(a.vx).toBeCloseTo(-b.vx, 9);
    expect(a.vy).toBeCloseTo(b.vy, 9);
    expect(a.vz).toBe(0); expect(b.vz).toBe(0);
  });
  it('③ 全程 y 恒差 stagger、z 恒差 zSpread（静态错位·不随时间放大）', () => {
    for (const t of [0, 0.1, tMeet, 0.5]) {
      expect(at(a, t).y - at(b, t).y).toBeCloseTo(stag, 9);
      expect(at(a, t).z - at(b, t).z).toBeCloseTo(zsp, 9);
    }
  });
  it('④ 交汇距 = hypot(stagger, zSpread) 且 < 2R → 任何翻滚相位都必然接触', () => {
    const pa = at(a, tMeet), pb = at(b, tMeet);
    const d = Math.hypot(pa.x - pb.x, pa.y - pb.y, pa.z - pb.z);
    expect(d).toBeCloseTo(Math.hypot(stag, zsp), 9);
    expect(d).toBeLessThan(2 * R);   // ← zSpread 的上限由这条钉死：再大就撞不上了
    expect(isHit(d, R)).toBe(true);
  });
  it('⑤ 回归护栏：上一版「出手即侧向分离」的写法交汇距离超判据 → 根本撞不上（记死这个坑）', () => {
    // 上一版：起手 z 错位 ±0.35R，再叠 Z 向持续分离速度 ±1.15 —— 两者都在把牌推开。
    const R = 1.55 / 2, zOff0 = 0.35 * 1.12, VZ_BAD = 1.15;
    const zSep = 2 * (zOff0 + VZ_BAD * tMeet);              // 交汇时刻的 z 间距
    expect(isHit(Math.hypot(0, 0, zSep), R)).toBe(false);   // 实测对应「撞上 0/1 组·最近距 2.5+」
    // 只要去掉持续分离速度、把起手错位也归零，同样的抛法就必然撞上。
    expect(isHit(Math.hypot(0, stag, 0), R)).toBe(true);
  });
  it('⑥ 各组数下交汇点都落在本道中线上（不串道）', () => {
    for (const n of DUEL_COUNTS) {
      const L = layoutFor(n);
      const z = (n - 1) * L.laneGap;
      const p = throwPlan(z, 1.7 * L.scale + 0.9, vy, tMeet, stag * L.scale, zsp * L.scale);
      expect((p.a.z + p.b.z) / 2).toBeCloseTo(z, 9);              // 对称轴仍是本道中线
      expect(Math.abs(p.a.z - p.b.z)).toBeLessThan(L.laneGap);    // 错位不得超过道距·否则串到隔壁道
    }
  });
  it('⑦ 高度差必须 < 碰撞圆盘合厚，否则牌只是从对方上方掠过（owner「空中没有碰撞」的真因）', () => {
    const COLLIDER_HALF_H = 0.05;                 // 引擎把圆盘厚度钳到 0.1 → 半高恒 0.05
    expect(stag).toBeLessThan(2 * COLLIDER_HALF_H);
    expect(0.26).toBeGreaterThan(2 * COLLIDER_HALF_H); // ← 旧值，记死它为什么不行
  });
  it('⑧ 横向错位必须 < 2R，否则两盘侧向不重叠', () => {
    expect(zsp).toBeLessThan(2 * R);
  });
  it('HIT_DIST_RATIO 判据本身：≤1.2R 算撞上·超出不算', () => {
    expect(isHit(1.2 * 0.775, 0.775)).toBe(true);
    expect(isHit(1.2 * 0.775 + 0.01, 0.775)).toBe(false);
    expect(HIT_DIST_RATIO).toBe(1.2);
  });
});
