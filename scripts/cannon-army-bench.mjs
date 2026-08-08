#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  scripts/cannon-army-bench.mjs —— cannon-es「军队规模」承载量基准（game211 物理自动战斗 B 线选型）
//
//  为什么要它：owner 拍板 game211 走 **B 线 = 真实物理（cannon-es · render-only）**。B 线的成败只取决于
//  一个数：**同场能步进多少个刚体还保 60fps**。这个数决定「RTS」是 30 人小队战还是 300 人军团战——
//  它必须**测**出来，不能拍脑袋（3d.md 只说了渲染侧 InstancedMesh 合批，物理侧 CPU 开销从没量过）。
//
//  测什么：两军 capsule 兵正面冲锋、撞在一起挤成一团（= 真实战场最坏情况：大量持续接触对），
//  外加地面。逐规模测「每物理步耗时」，对 16.7ms/帧的预算给出判词。
//
//  为什么这么测才算数：
//   · **capsule** —— 3d.md 明写 capsule=角色，非 sphere（sphere 便宜得多，用它测=自欺）。
//   · **撞成一团** —— 给相向初速并测到交汇后，接触对数达峰值；只测自由下落是测不出真实负载的。
//   · **量 step 本身** —— 不含渲染，隔离出「物理能不能扛」这一个变量。
//   · 参数取 3d.md「堆叠必配」档（gravity −9.82 / restitution 0 / solverIterations 40）与默认掷骰档
//     （−42 / 0.4 / 10）两组：前者是密集接触的推荐档、也是更贵的档，两组都报，避免只报好看的那组。
//
//  用法：node scripts/cannon-army-bench.mjs [--sizes 50,100,200,400] [--json]
// ═══════════════════════════════════════════════════════════════

import * as CANNON from 'cannon-es';

const args = process.argv.slice(2);
const jsonOut = args.includes('--json');
const sizeArg = args[args.indexOf('--sizes') + 1];
const SIZES = args.includes('--sizes') && sizeArg
  ? sizeArg.split(',').map((s) => parseInt(s.trim(), 10)).filter(Number.isFinite)
  : [50, 100, 200, 400, 800];

const STEP = 1 / 60;
const FRAME_BUDGET_MS = 16.7;
// 物理独占预算：渲染/UI/sim 也要吃帧。给物理 1/3 帧 ≈ 5.5ms 作「安全」线，满帧 16.7ms 作「破」线。
const SAFE_MS = FRAME_BUDGET_MS / 3;

// 两组世界档（3d.md「物理世界配置」）：默认掷骰档 vs 密集接触推荐档。
const PROFILES = [
  { name: '默认档(掷骰)', gravity: -42, restitution: 0.4, friction: 0.35, iters: 10 },
  { name: '密集接触档', gravity: -9.82, restitution: 0, friction: 0.35, iters: 40 },
];

/** 建一场两军对冲：n 个 capsule 兵分左右两阵相向冲锋 + 一块静态地面。返回 {world, bodies}。 */
function buildBattle(n, prof) {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, prof.gravity, 0) });
  world.solver.iterations = prof.iters;
  world.defaultContactMaterial.restitution = prof.restitution;
  world.defaultContactMaterial.friction = prof.friction;
  // 宽相位：SAPBroadphase 是 cannon 对「多体」的标准选择（NaiveBroadphase 是 O(n²) 对拍基线）。
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.allowSleep = true;

  world.addBody(new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), quaternion: new CANNON.Quaternion().setFromEuler(-Math.PI / 2, 0, 0) }));

  // 兵：capsule ≈ 圆柱 + 两端半球（cannon 无原生 capsule → 复合体，与 three/physics.ts 同构）。
  const R = 0.35, H = 1.1;
  const mkSoldier = (x, z, vx) => {
    const b = new CANNON.Body({ mass: 70, position: new CANNON.Vec3(x, H / 2 + R, z) });
    b.addShape(new CANNON.Cylinder(R, R, H, 8));
    b.addShape(new CANNON.Sphere(R), new CANNON.Vec3(0, H / 2, 0));
    b.addShape(new CANNON.Sphere(R), new CANNON.Vec3(0, -H / 2, 0));
    b.velocity.set(vx, 0, 0);
    b.sleepSpeedLimit = 0.3;
    return b;
  };

  const perSide = Math.floor(n / 2);
  const cols = Math.max(1, Math.round(Math.sqrt(perSide)));
  const bodies = [];
  for (let side = 0; side < 2; side++) {
    const dir = side === 0 ? 1 : -1;
    for (let i = 0; i < perSide; i++) {
      const row = Math.floor(i / cols), col = i % cols;
      const b = mkSoldier(dir * (12 + row * 1.0), (col - cols / 2) * 1.0, -dir * 6);
      world.addBody(b);
      bodies.push(b);
    }
  }
  return { world, bodies };
}

/** 跑 frames 步，返回 {meanMs, p95Ms, peakContacts, awakeEnd}。前 warmup 步不计（JIT 预热）。 */
function measure(world, frames, warmup) {
  const samples = [];
  let peakContacts = 0;
  for (let f = 0; f < frames + warmup; f++) {
    const t0 = process.hrtime.bigint();
    world.step(STEP);
    const t1 = process.hrtime.bigint();
    if (f >= warmup) samples.push(Number(t1 - t0) / 1e6);
    if (world.contacts.length > peakContacts) peakContacts = world.contacts.length;
  }
  samples.sort((a, b) => a - b);
  const mean = samples.reduce((s, x) => s + x, 0) / samples.length;
  return { meanMs: mean, p95Ms: samples[Math.floor(samples.length * 0.95)], peakContacts };
}

/** 稳态肉搏（**混合方案定预算用的最坏情况**）：n 个兵挤在接触带里持续互推——
 *  没有行军阶段稀释，每一步都是满接触。混合方案里「真刚体」只有前排肉搏那一撮，
 *  所以要按这个最坏情况给它定额，不能拿「对冲平均值」糊弄。 */
function buildMelee(n, prof) {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, prof.gravity, 0) });
  world.solver.iterations = prof.iters;
  world.defaultContactMaterial.restitution = prof.restitution;
  world.defaultContactMaterial.friction = prof.friction;
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.allowSleep = false; // 肉搏中不许睡（睡了就不是最坏情况）
  world.addBody(new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), quaternion: new CANNON.Quaternion().setFromEuler(-Math.PI / 2, 0, 0) }));
  const R = 0.35, H = 1.1;
  const cols = Math.max(1, Math.round(Math.sqrt(n)));
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols), col = i % cols;
    const b = new CANNON.Body({ mass: 70, position: new CANNON.Vec3((row - cols / 2) * 0.62, H / 2 + R, (col - cols / 2) * 0.62) }); // 0.62 < 2R=0.7 → 出生即互相挤压
    b.addShape(new CANNON.Cylinder(R, R, H, 8));
    b.addShape(new CANNON.Sphere(R), new CANNON.Vec3(0, H / 2, 0));
    b.addShape(new CANNON.Sphere(R), new CANNON.Vec3(0, -H / 2, 0));
    b.velocity.set((i % 2 ? 1 : -1) * 1.5, 0, 0); // 持续对推·不静止
    world.addBody(b);
  }
  return { world };
}

const results = [];
for (const prof of PROFILES) {
  for (const n of SIZES) {
    const { world } = buildBattle(n, prof);
    // 冲锋 → 交汇 → 挤压：120 步足够两阵撞上并堆成接触峰（初速 6m/s·相距 24m）。
    const r = measure(world, 120, 20);
    const awake = world.bodies.filter((b) => b.mass > 0 && b.sleepState !== CANNON.Body.SLEEPING).length;
    results.push({ mode: '对冲全场', profile: prof.name, n, ...r, awake });
  }
}
// 稳态肉搏（混合方案的「真刚体」定额依据）
const MELEE_SIZES = [24, 48, 72, 100, 150];
for (const prof of PROFILES) {
  for (const n of MELEE_SIZES) {
    const { world } = buildMelee(n, prof);
    const r = measure(world, 120, 20);
    results.push({ mode: '稳态肉搏', profile: prof.name, n, ...r, awake: n });
  }
}

if (jsonOut) {
  console.log(JSON.stringify({ frameBudgetMs: FRAME_BUDGET_MS, safeMs: SAFE_MS, results }, null, 2));
} else {
  console.log('cannon-es 军队规模承载量（两军 capsule 对冲·量 world.step 本身·不含渲染）\n');
  console.log(`帧预算 ${FRAME_BUDGET_MS}ms · 物理安全线 ${SAFE_MS.toFixed(1)}ms（留 2/3 帧给渲染/UI/sim）\n`);
  let cur = '';
  for (const r of results) {
    const key = `${r.mode} · ${r.profile}`;
    if (key !== cur) { cur = key; console.log(`── ${cur} ──`); console.log('  兵数   均值ms   p95ms   接触峰   判词'); }
    const verdict = r.p95Ms <= SAFE_MS ? '✅ 安全' : r.p95Ms <= FRAME_BUDGET_MS ? '🟡 吃满帧(需减渲染开销)' : '❌ 掉帧';
    console.log(`  ${String(r.n).padStart(4)}  ${r.meanMs.toFixed(2).padStart(7)} ${r.p95Ms.toFixed(2).padStart(7)}  ${String(r.peakContacts).padStart(6)}   ${verdict}`);
  }
  console.log('\n注：这是**物理独占**耗时。真游戏还要加 three 渲染 + InstancedMesh 上传 + sim + UI。');
}
