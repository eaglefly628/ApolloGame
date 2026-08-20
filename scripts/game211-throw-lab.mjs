#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  scripts/game211-throw-lab.mjs —— game211「大量牌随机抛掷」物理表现统计台
//
//  为什么要它（owner 2026-08-10「focus 在这个原型的验证上·大量的牌随机抛掷的物理表现」）：
//  试验台（`games/game211/duel-spike.ts`）一次最多 60 组 = 120 张牌，且要人在浏览器里点。
//  于是至今所有验收数字都建立在**极小样本**上——「正面 55%」是 20 组 = **40 张牌**数出来的。
//  40 张的 55% 意味着 22/40：在真 50/50 下，这个偏差的 p 值 ≈ 0.64，**完全是噪声**。
//  换句话说：老口径既证明不了公平、也证伪不了它。要回答「大量牌抛出去到底什么表现」，
//  必须把样本拉到几千张，并且给出**置信区间**而不是一个孤零零的百分数。
//
//  怎么保证测的是同一套物理（fidelity 是这个台子的全部价值）：逐条对齐引擎的翻译层，
//  而不是「另写一套差不多的」。对齐清单（每条都在代码里点了出处）：
//   · 世界档  = `duel-spike.ts` 挂的 PhysicsWorld3D：gravity −20 · restitution 0.22 · friction 0.5 · solverIterations 20
//   · 世界还自带一块 y=0 的 Plane（`three/physics.ts` initWorld 无条件加），且 allowSleep=true
//   · 宽相位 = cannon 缺省 NaiveBroadphase（`physics.ts` **没有**设 broadphase——别自作主张换 SAP，那会变成另一个东西）
//   · 牌刚体 = Cylinder(r=max(0.1,W/2)=0.775, h=max(0.1,T)=**0.1**, 12)（厚度被引擎下限钳住·薄盘法线沿 Y·实测确认）
//   · 睡眠   = allowSleep / sleepSpeedLimit 0.6 / sleepTimeLimit 0.4
//   · 地台   = box 半尺寸 (halfX+1.4, 0.4, halfZ+1.4) @ y=−0.4；围栏 = **无 Mesh3D** → 引擎回落 w=h=4 → Box(2,2,2) @ y=2
//   · 出手   = `throwPlan` 原式 + 同样的随机抽取**顺序**（顺序错了 = 换了一组牌·数字不可比）
//   · PRNG   = `src/skills/atoms/random/index.ts` 的 `nextRandom` 逐位复刻（同 seed 可与浏览器对账）
//
//  ⚠ 已知的一处**真差异**（不是本脚本的偷懒，是引擎的缺口，见下）：
//  `three/physics.ts` 的 spawn() **从不读 `RigidBody3D.restitution` / `.friction`**，尽管
//  `engine/protocol/components/render.ts:221-222` 明文声明了这两个字段并写了缺省值。
//  于是 `duel-spike.ts` 里 `CARD_RESTITUTION=0.34` 与 `friction:0.45` **全程是死旋钮**，
//  真正生效的一直是世界级的 0.22 / 0.5。本台默认走**引擎现状**（世界值·即真实表现）；
//  加 `--per-body` 则把牌上声明的值真的接成 cannon Material —— 用来量「这个缺口到底吞掉了多少表现」。
//
//  量什么（前三条是 owner 的验收口径，第 4 条是本台新增的**直接证据**）：
//   1. 正面朝上率 + **95% 置信区间**（目标 50%）——够不够公平，一眼看出，不再靠 40 张牌猜。
//   2. 未躺平率（|upY| < 0.7）——牌不许站住。
//   3. 相遇率（Δx 变号 or |Δx|min ≤ 2R）——沿用老口径，便于与浏览器读数对账。
//   4. **空中真接触率** —— 直接扫 cannon 的接触对，确认同组两张牌**真的碰上了**，
//      并区分「在空中碰」与「落地后才蹭到」。这条是新的：老口径 4 用的是中心距代理量，
//      而交接单 §4 亲自记着一次事故——仪表报「相遇 20/20」但物理上一次都没碰到。
//      代理量会骗人，接触对不会。
//
//  用法：
//    node scripts/game211-throw-lab.mjs                          # 缺省 200 轮 × 20 组 = 8000 张牌
//    node scripts/game211-throw-lab.mjs --rounds 50 --groups 60  # 按 60 组档跑
//    node scripts/game211-throw-lab.mjs --per-body               # 把牌上声明的 restitution/friction 真接上，对比
//    node scripts/game211-throw-lab.mjs --json                   # 机读
// ═══════════════════════════════════════════════════════════════

import * as CANNON from 'cannon-es';

// ── 引擎口径常量（逐条对 duel-spike.ts / three/physics.ts·改这里之前先去改那边）──
const GRAVITY = 20;
const CARD_W = 1.55, CARD_H = 2.15, CARD_T = 0.085;
const HULL_R = CARD_W / 2;                 // 0.775
const Y_STAGGER = 0.05, Z_SPREAD = 0.82;
const SPIN_FLIP_MIN = 7, SPIN_FLIP_MAX = 18, SPIN_SELF = 4;
const LANE_SPAN = 3.2;
const FLAT_MIN = 0.7;                      // |upY| < 此 = 未躺平
const CARD_RESTITUTION = 0.34, CARD_FRICTION = 0.45;   // 牌上声明值——引擎现状下**不生效**（见头注）
const WORLD_RESTITUTION = 0.22, WORLD_FRICTION = 0.5, SOLVER_ITERS = 20;
const STEP = 1 / 60;
const MAX_SIM_SEC = 12;                    // 落定超时兜底（正常 ~2.5s 全睡）
const AIR_Y = 0.6;                         // 高于此算「空中」（牌落地静止时质心 ≈ 0.05）

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(name);
  if (i < 0) return dflt;
  const v = args[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
};
const jsonOut = args.includes('--json');
const perBody = args.includes('--per-body');
const ROUNDS = parseInt(flag('--rounds', '200'), 10);
const GROUPS = parseInt(flag('--groups', '20'), 10);
const SEED0 = parseInt(flag('--seed', '20260810'), 10);
// 场地按「假装是 N 组」建（默认 = 真实组数）。用来把「密度」与「围栏距离」两个变量拆开：
// 同样抛 1 组，场地按 1 组建 vs 按 60 组建 —— 若未躺平率随之塌掉，根因就是围栏太近而非密度。
const ARENA = parseInt(flag('--arena', String(GROUPS)), 10);
// 场地最小半深（= duel-spike.ts 的 ARENA_MIN_HALF_Z）。**撤修验红用**：`--arena-floor 3.2` 还原修复前口径，
// 未躺平应当立刻从 ~0.4% 弹回 ~6.4%（且靠墙占比 ~99%）——弹不回来说明这个台子根本没测到围栏。
// 最外道到围栏内表面的目标余量（= duel-spike.ts 的 EDGE_CLEARANCE·实测阈值 6.6 ⇒ 取 6.0）。
// **撤修验红用**：`--edge-clearance 1.2` 还原修复前口径。
const EDGE_CLEARANCE = parseFloat(flag('--edge-clearance', '6.0'));
// x 向半宽（生产现值 6.6 → 围栏内表面 5.6）。牌沿 x 对冲飞行，落点在 x 上摊得更开，故单独可调。
const HALF_X = parseFloat(flag('--halfx', '6.6'));
// ── 落面「瞄准」实验（owner 2026-08-10「这是个数值游戏，怎么让正反面达到一定的控制」）──
// 原理：牌出生正面朝上，落面只由**总翻转角** θ=ω·T 决定（每转过半圈翻一次面）。ω 和 T 都是出手时给的，
// 所以不必改判定、不必作弊——**把 ω 解出来瞄准想要的那个半圈区间**即可。
// jitter = 在目标半圈内叠加的随机量（单位：半圈）。jitter→0 = 全控；jitter≥0.5 开始漏到隔壁半圈；
// 大 jitter 退化回 50/50。**这就是那个数值旋钮**：给定想要的胜率 p，反解 jitter。
// 真实物理还会被「空中对撞 + 落地回弹」扰动，所以实际能控到多少必须测——这就是本实验存在的理由。
const AIM = flag('--aim', '');            // '' | 'front' | 'back'
const JITTER = parseFloat(flag('--jitter', '0.3'));
// 横向错位覆盖：调到 > 2R(=1.55) 两牌就**不会相撞**（各飞各的）。用来把「空中对撞」这个变量单独摘出来，
// 回答「瞄不准到底是出手瞄不准，还是撞击把相位打乱了」。
const ZSPREAD = parseFloat(flag('--zspread', String(Z_SPREAD)));
// 世界弹性覆盖：落地回弹是落面的另一个打乱源，单独可关（0 = 落地不弹）。
const WREST = parseFloat(flag('--restitution', String(WORLD_RESTITUTION)));
// a 方牌的质量（b 方恒 1.0）。owner 2026-08-10 问「改变牌的重量会不会有影响」。
// 物理上：自由飞行段质量**完全无影响**（重力加速度与质量无关；自由自转只取决于惯量**比值**，
// 而比值由形状定不由质量定）。唯一可能起作用的是**空中对撞**——质量不等则动量交换不对称。
// 能不能传导到落面，只能测。本开关就是为此。
const MASS_A = parseFloat(flag('--mass-a', '1.0'));
// a 方的冲锋速度倍率（沿对撞轴）。质量与速度都进动量 p=mv，但速度**看得见**（冲得更猛），
// 是「相克 = 撞得动对方」更好的表达载体。owner 2026-08-10「核心是空中撞击」。
const SPEED_A = parseFloat(flag('--speed-a', '1.0'));
// ── 落地修正实验（owner 2026-08-10「不能在投掷上作弊，那能不能在落地的时候修改」）──
// 思路：出手/飞行/对撞**全程真物理不动**，只在**第一次触地那一刻**接管一次——
// 读当前朝向，若与判定不符，给一个小上抛 + 绕水平轴的翻转角速度，让它**自己翻过去**再落定。
// 为什么这样看起来不假：真牌落地本来就会弹一下、翻个身，这一步正是它自己的随机源；
// 我们只是把「往哪边翻」从掷骰改成按判定选，形态与自然落地一致。
// --land-fix front|back = 目标面；--flip-omega = 翻转角速度；--hop = 上抛速度。
const LAND_FIX = flag('--land-fix', '');
const FLIP_OMEGA = parseFloat(flag('--flip-omega', '9'));
const HOP = parseFloat(flag('--hop', '2.2'));

// ── PRNG：`src/skills/atoms/random/index.ts` nextRandom 逐位复刻（同 seed 可与浏览器对账）──
function makeRng(seed) {
  const st = { seed: seed | 0 };
  return () => {
    st.seed = (st.seed + 0x6d2b79f5) | 0;
    let t = st.seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── 纯函数：与 duel-spike.ts 同名同式（改那边要同步改这边·差一点数字就不可比）──
function layoutFor(n) {
  const laneGap = LANE_SPAN;
  const contentHalfZ = Math.max(3.2, (n * laneGap) / 2 + 1.2);
  return { scale: 1, laneGap, contentHalfZ, halfZ: (n * laneGap) / 2 + EDGE_CLEARANCE, halfX: HALF_X };
}
function throwPlan(laneZ, throwX, vy, tMeet, stagger, zSpread = 0) {
  const vxMag = throwX / tMeet;
  const mk = (dir) => ({ x: -dir * throwX, y: 0.9 + dir * (stagger / 2), z: laneZ + dir * (zSpread / 2), vx: dir * vxMag, vy, vz: 0 });
  return { a: mk(1), b: mk(-1) };
}
/** 牌正面法线(局部 +Y)转到世界后的竖直分量。+1=正面朝上·−1=反面·0=立着。 */
function upYOf(q) { return 1 - 2 * (q[0] * q[0] + q[2] * q[2]); }

// ── 建场：严格照 three/physics.ts initWorld + duel-spike rebuildArena ──
function buildWorld(n) {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -GRAVITY, 0) });
  world.defaultContactMaterial.restitution = WREST;
  world.defaultContactMaterial.friction = WORLD_FRICTION;
  world.solver.iterations = SOLVER_ITERS;
  world.allowSleep = true;
  // 引擎 initWorld 无条件加的 y=0 地平面（法线朝上）
  const plane = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
  plane.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(plane);

  const L = layoutFor(n);
  // 地台 box：Mesh3D width/height/depth → Box(w/2, h/2, d/2)
  const ground = new CANNON.Body({ mass: 0 });
  ground.addShape(new CANNON.Box(new CANNON.Vec3(L.halfX + 1.4, 0.4, L.halfZ + 1.4)));
  ground.position.set(0, -0.4, 0);
  world.addBody(ground);
  // 围栏：**无 Mesh3D** → 引擎 spawn() 回落 w=4,h=4,depth=w=4 → Box(2,2,2)
  const wallX = L.halfX + 1.0, wallZ = L.halfZ + 1.0;
  for (const [dx, dz] of [[wallX, 0], [-wallX, 0], [0, wallZ], [0, -wallZ]]) {
    const b = new CANNON.Body({ mass: 0 });
    b.addShape(new CANNON.Box(new CANNON.Vec3(2, 2, 2)));
    b.position.set(dx, 2, dz);
    world.addBody(b);
  }
  return { world, L };
}

const cardMaterial = perBody ? new CANNON.Material('card') : null;
if (perBody) {
  // 只有开 --per-body 才把牌上声明的值真接上（引擎现状是不接的）。
  const cc = new CANNON.ContactMaterial(cardMaterial, cardMaterial, { restitution: CARD_RESTITUTION, friction: CARD_FRICTION });
  buildWorld.__contact = cc;
}

/** 抛一轮 → 返回每道两张牌的刚体。随机抽取顺序严格照 duel-spike.throwAll。 */
function throwRound(world, L, n, rnd) {
  const throwX = 1.2 * L.scale + 0.6;
  const lanes = [];
  for (let lane = 0; lane < n; lane++) {
    const laneZ = (lane - (n - 1) / 2) * L.laneGap;
    const vy = 12.4 + rnd() * (13.6 - 12.4);                       // 抽 1
    const tMeet = (vy / GRAVITY) * (0.80 + rnd() * (0.92 - 0.80)); // 抽 2
    const plan = throwPlan(laneZ, throwX, vy, tMeet, Y_STAGGER * L.scale, ZSPREAD * L.scale);
    const pair = {};
    for (const s of ['a', 'b']) {
      const p0 = plan[s];
      const body = new CANNON.Body({ mass: s === 'a' ? MASS_A : 1.0 });
      body.addShape(new CANNON.Cylinder(Math.max(0.1, CARD_W / 2), Math.max(0.1, CARD_W / 2), Math.max(0.1, CARD_T), 12));
      body.position.set(p0.x, p0.y, p0.z);
      body.velocity.set(s === 'a' ? p0.vx * SPEED_A : p0.vx, p0.vy, p0.vz);
      // 抽 3/4（符号+大小）· 抽 5（自旋）· 抽 6/7（avz）——顺序与 duel-spike 一致
      let avx;
      if (AIM === 'front' || AIM === 'back') {
        // 飞行时间（与 duel-spike.flightTime 同式）：y0=0.9±stagger/2，落到 ≈0.09。
        const T = (vy + Math.sqrt(vy * vy + 2 * GRAVITY * (0.9 - 0.09))) / GRAVITY;
        // 目标半圈序号：偶数 = 正面朝上（出生即正面·每半圈翻一次）。取 k=6 附近，翻得够多才好看。
        const k = AIM === 'front' ? 6 : 7;
        // 落在该半圈**中点** + jitter（单位半圈）→ |jitter|<0.5 才不漏到隔壁。
        const halfTurns = k + 0.5 + (rnd() * 2 - 1) * JITTER;
        avx = (rnd() < 0.5 ? -1 : 1) * ((halfTurns * Math.PI) / T);
      } else {
        avx = (rnd() < 0.5 ? -1 : 1) * (SPIN_FLIP_MIN + rnd() * (SPIN_FLIP_MAX - SPIN_FLIP_MIN));
      }
      const avy = -SPIN_SELF + rnd() * (2 * SPIN_SELF);
      const avz = (rnd() < 0.5 ? -1 : 1) * (rnd() * SPIN_FLIP_MAX * 0.35);
      body.angularVelocity.set(avx, avy, avz);
      body.allowSleep = true; body.sleepSpeedLimit = 0.6; body.sleepTimeLimit = 0.4;
      if (cardMaterial) body.material = cardMaterial;
      world.addBody(body);
      pair[s] = body;
    }
    lanes.push(pair);
  }
  return lanes;
}

/** 跑一轮到全部落定，返回该轮统计。 */
function runRound(n, seed) {
  const { world, L: arenaL } = buildWorld(ARENA);       // 场地按 ARENA 建
  if (perBody && buildWorld.__contact) world.addContactMaterial(buildWorld.__contact);
  const rnd = makeRng(seed);
  const L = layoutFor(n);                                // 出手几何仍按真实组数
  const lanes = throwRound(world, L, n, rnd);
  const wallZ = arenaL.halfZ + 1.0, wallX = arenaL.halfX + 1.0; // 围栏中心（Box 半宽 2 → 内表面 −2）

  const bodyLane = new Map();   // body.id → lane 序号
  lanes.forEach((p, i) => { bodyLane.set(p.a.id, i); bodyLane.set(p.b.id, i); });

  const minDx = new Array(n).fill(Infinity);
  const crossed = new Array(n).fill(false);
  const touchedAir = new Array(n).fill(false);    // 同组两张在**空中**真接触
  const touchedAny = new Array(n).fill(false);    // 同组两张任意时刻真接触

  let simT = 0, stepMs = 0, steps = 0;
  while (simT < MAX_SIM_SEC) {
    const t0 = process.hrtime.bigint();
    world.step(STEP, STEP, 1);          // 固定步：headless 取「理想 60fps」，每次调用恰好一子步
    stepMs += Number(process.hrtime.bigint() - t0) / 1e6;
    steps += 1;
    simT += STEP;

    // 落地修正：每张牌只做一次（fixed 标记），且只在「已下落到贴地且仍朝下运动」那一刻。
    if (LAND_FIX === 'front' || LAND_FIX === 'back') {
      for (const p of lanes) {
        for (const key of ['a', 'b']) {
          const b = p[key];
          if (b.__fixed) continue;
          if (b.position.y > 0.35 || b.velocity.y > 0) continue;   // 还没到触地时刻
          b.__fixed = true;
          const q = b.quaternion;
          const up = upYOf([q.x, q.y, q.z, q.w]);
          const want = LAND_FIX === 'front';
          if ((up > 0) === want) continue;                          // 已经是想要的面 → 不动它（多数情况）
          // 小上抛 + 绕水平轴翻转：让它自己翻半圈落成想要的面。
          b.velocity.y = HOP;
          b.angularVelocity.set(FLIP_OMEGA, b.angularVelocity.y * 0.3, 0);
          b.wakeUp();
        }
      }
    }

    // 相遇代理量（沿用老口径·便于与浏览器对账）
    for (let i = 0; i < n; i++) {
      const dx = lanes[i].a.position.x - lanes[i].b.position.x;
      if (Math.abs(dx) < minDx[i]) minDx[i] = Math.abs(dx);
      if (dx > 0) crossed[i] = true;
    }
    // 真接触（直接证据）：扫 cannon 接触对，取「两端属于同一道」的
    for (const c of world.contacts) {
      const li = bodyLane.get(c.bi.id), lj = bodyLane.get(c.bj.id);
      if (li === undefined || li !== lj) continue;
      touchedAny[li] = true;
      if (c.bi.position.y > AIR_Y && c.bj.position.y > AIR_Y) touchedAir[li] = true;
    }

    if (steps % 15 === 0) {
      let allAsleep = true;
      for (const p of lanes) if (p.a.sleepState !== CANNON.Body.SLEEPING || p.b.sleepState !== CANNON.Body.SLEEPING) { allAsleep = false; break; }
      if (allAsleep) break;
    }
  }

  let front = 0, total = 0, notFlat = 0, met = 0, notFlatNearWall = 0;
  let frontA = 0, totA = 0, frontB = 0, totB = 0;
  let sxA = 0, sxB = 0;   // 沿对撞轴的最终 x（a 从 −x 冲向 +x，b 反之）
  for (let i = 0; i < n; i++) {
    for (const s of ['a', 'b']) {
      const b = lanes[i][s];
      const q = b.quaternion;
      const upY = upYOf([q.x, q.y, q.z, q.w]);
      total += 1;
      if (upY > 0) front += 1;
      if (s === 'a') { totA += 1; if (upY > 0) frontA += 1; sxA += b.position.x; } else { totB += 1; if (upY > 0) frontB += 1; sxB += b.position.x; }
      if (Math.abs(upY) < FLAT_MIN) {
        notFlat += 1;
        // 靠墙判据：牌中心到某面围栏**内表面**（中心 ∓2）的距离 < 一个牌长（2.15）→ 算「够得着墙」
        const dz = Math.min(Math.abs(Math.abs(b.position.z) - (wallZ - 2)), Infinity);
        const dx = Math.min(Math.abs(Math.abs(b.position.x) - (wallX - 2)), Infinity);
        if (Math.min(dz, dx) < CARD_H) notFlatNearWall += 1;
      }
    }
    if (crossed[i] || minDx[i] <= 2 * HULL_R) met += 1;
  }
  return {
    front, total, notFlat, notFlatNearWall, met, lanes: n, frontA, totA, frontB, totB, sxA, sxB,
    touchAir: touchedAir.filter(Boolean).length,
    touchAny: touchedAny.filter(Boolean).length,
    settleSec: simT, stepMsPerStep: stepMs / Math.max(1, steps),
  };
}

// ── Wilson 区间：小样本下比正态近似诚实（本台存在的理由就是不再拿 40 张牌下结论）──
function wilson(k, n, z = 1.96) {
  if (!n) return [0, 0];
  const p = k / n, d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n), m = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n);
  return [Math.max(0, (c - m) / d), Math.min(1, (c + m) / d)];
}
/** 双尾二项检验 p 值（对 50%）——回答「这个偏差是不是噪声」。 */
function binomP(k, n) {
  if (!n) return 1;
  const logC = (a, b) => { let s = 0; for (let i = 0; i < b; i++) s += Math.log(a - i) - Math.log(i + 1); return s; };
  const pmf = (i) => Math.exp(logC(n, i) - n * Math.LN2);
  const obs = pmf(k);
  let p = 0;
  for (let i = 0; i <= n; i++) { const v = pmf(i); if (v <= obs * (1 + 1e-9)) p += v; }
  return Math.min(1, p);
}

const agg = { sxA: 0, sxB: 0, frontA: 0, totA: 0, frontB: 0, totB: 0, front: 0, total: 0, notFlat: 0, notFlatNearWall: 0, met: 0, lanes: 0, touchAir: 0, touchAny: 0, settle: 0, stepMs: 0 };
for (let r = 0; r < ROUNDS; r++) {
  const s = runRound(GROUPS, (SEED0 + r * 7919) | 0);
  agg.frontA += s.frontA; agg.totA += s.totA; agg.frontB += s.frontB; agg.totB += s.totB;
  agg.sxA += s.sxA; agg.sxB += s.sxB;
  agg.front += s.front; agg.total += s.total; agg.notFlat += s.notFlat; agg.notFlatNearWall += s.notFlatNearWall;
  agg.met += s.met; agg.lanes += s.lanes; agg.touchAir += s.touchAir; agg.touchAny += s.touchAny;
  agg.settle += s.settleSec; agg.stepMs += s.stepMsPerStep;
  if (!jsonOut && (r + 1) % 25 === 0) process.stderr.write(`  …${r + 1}/${ROUNDS} 轮（累计 ${agg.total} 张）\n`);
}

const pct = (k, n) => ((k / Math.max(1, n)) * 100).toFixed(2);
const [lo, hi] = wilson(agg.front, agg.total);
const pv = binomP(agg.front, agg.total);
const result = {
  mode: perBody ? 'per-body 材质（假想·引擎现状不生效）' : '引擎现状（世界级材质）',
  aim: AIM || 'none', jitter: AIM ? JITTER : null,
  rounds: ROUNDS, groups: GROUPS, cards: agg.total, duels: agg.lanes,
  frontRate: agg.front / agg.total, frontCI95: [lo, hi], binomP: pv,
  notFlatRate: agg.notFlat / agg.total,
  notFlatNearWall: agg.notFlatNearWall, arena: ARENA,
  metRate: agg.met / agg.lanes,
  touchAirRate: agg.touchAir / agg.lanes,
  touchAnyRate: agg.touchAny / agg.lanes,
  meanSettleSec: agg.settle / ROUNDS,
  meanStepMs: agg.stepMs / ROUNDS,
  bodiesPerRound: GROUPS * 2,
};

if (jsonOut) { console.log(JSON.stringify(result, null, 2)); process.exit(0); }

console.log('');
console.log('══ game211 大量牌抛掷 · 物理表现统计 ══');
console.log(`  档位：${ROUNDS} 轮 × ${GROUPS} 组 = **${agg.total} 张牌** / ${agg.lanes} 场对决 · 材质档：${result.mode}`);
console.log(`  场地：按 ${ARENA} 组建 · 道-墙余量 ${EDGE_CLEARANCE}（围栏内表面距道心 ${(layoutFor(ARENA).halfZ - 1.0).toFixed(1)}）`);
console.log('');
console.log(`  ① 正面朝上   ${agg.front}/${agg.total} = ${pct(agg.front, agg.total)}%`);
console.log(`     95% CI    [${(lo * 100).toFixed(2)}%, ${(hi * 100).toFixed(2)}%]   对 50% 的双尾 p = ${pv < 1e-4 ? pv.toExponential(2) : pv.toFixed(4)}`);
console.log(`     判词      ${lo <= 0.5 && hi >= 0.5 ? '✅ 与 50/50 不矛盾（CI 覆盖 50%）' : '🔴 显著偏离 50/50（CI 不覆盖 50%）'}`);
{ const [al,ah]=wilson(agg.frontA,agg.totA), [bl,bh]=wilson(agg.frontB,agg.totB);
  console.log(`     逐方      a(质量 ${MASS_A}) ${pct(agg.frontA,agg.totA)}% [${(al*100).toFixed(1)},${(ah*100).toFixed(1)}]  ·  b(质量 1.0) ${pct(agg.frontB,agg.totB)}% [${(bl*100).toFixed(1)},${(bh*100).toFixed(1)}]`); }
{ const mA = agg.sxA/Math.max(1,agg.totA), mB = agg.sxB/Math.max(1,agg.totB);
  console.log(`  ⑥ 落点(对撞轴 x)  a 均 ${mA.toFixed(2)}  ·  b 均 ${mB.toFixed(2)}  ·  **战线偏移 ${((mA+mB)/2).toFixed(2)}**（正=推向 b 侧·a 占地盘）`); }
console.log('');
console.log(`  ② 未躺平     ${agg.notFlat}/${agg.total} = ${pct(agg.notFlat, agg.total)}%   ${agg.notFlat === 0 ? '✅ 零' : '（目标 0）'}`);
console.log(`     其中靠墙   ${agg.notFlatNearWall}/${agg.notFlat} = ${pct(agg.notFlatNearWall, Math.max(1, agg.notFlat))}%   ← 场地按 ${ARENA} 组建（围栏内表面距道心 ${(layoutFor(ARENA).halfZ - 1.0).toFixed(1)}）`);
console.log(`  ③ 相遇(代理) ${agg.met}/${agg.lanes} = ${pct(agg.met, agg.lanes)}%   ← 中心距口径·会骗人`);
console.log(`  ④ 真接触     空中 ${agg.touchAir}/${agg.lanes} = ${pct(agg.touchAir, agg.lanes)}%  ·  任意时刻 ${agg.touchAny}/${agg.lanes} = ${pct(agg.touchAny, agg.lanes)}%`);
console.log(`     判词      ${agg.touchAir / agg.lanes >= 0.95 ? '✅ 空中对撞成立' : '🔴 空中对撞不成立——代理量③与真接触④背离'}`);
console.log('');
console.log(`  ⑤ 落定耗时   均 ${result.meanSettleSec.toFixed(2)}s/轮 · 物理步 ${result.meanStepMs.toFixed(3)}ms/步（${result.bodiesPerRound} 刚体·理想 60fps 固定步）`);
console.log('');
