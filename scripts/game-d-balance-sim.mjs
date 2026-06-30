// scripts/game-d-balance-sim.mjs —— 《骰途》平衡性蒙特卡洛模拟器（纯 node·无引擎依赖）。
//
// 配套 docs/design/game-d/balance-design.md。把那套五行/伤害公式/骰子/敌人/单双人数值跑成数据，
// 验证难度曲线 + 平衡，回调数字。常量与设计文档 §2/§5/§6 一一对应（一处调两处同步）。
//
// 用法：node scripts/game-d-balance-sim.mjs [--runs=2000] [--floors=4] [--seed=1]
// 输出：每模式(单/双)×每 build 原型 的 登顶率 / 平均到达间 / 每层存活率；+ 选对色 vs 随机色伤害差。

// ── 可调常量（= 设计文档数值）──────────────────────────────────────────────
const MULT_BY_M = { 1: 1.0, 2: 1.4, 3: 1.8, 4: 2.2, 5: 2.6 };       // 元素组合倍率（压平·别让堆单色暴力碾压）
const COUNTER_HIT = 2.2, COUNTER_BAD = 0.3, COUNTER_NEU = 1.0;       // 克制系数 ×2.2/×0.3/×1（加重被克→颜色真的要选对）
const BASE_HP = 22, GROWTH = 1.18, BOSS_MULT = 1.9, ELITE_MULT = 1.6; // 敌人 HP 曲线
const COOP_HP = 1.9;                                                  // 双人敌人 HP 倍率（非 ×2·留协作红利）
const SOLO_HEARTS = 5, COOP_HEARTS = 7;                              // 队伍生命
const FIGHT_CAP = 8;                                                  // 单场最多回合（超=被磨死）
const STUCK_PENALTY = 2;                                              // 打不过(超 cap)额外扣心

// ── 五行 + 相克五环（金→木→土→水→火→金）─────────────────────────────────
const ELEMENTS = ['jin', 'mu', 'shui', 'huo', 'tu'];
const BEATS = { jin: 'mu', mu: 'tu', tu: 'shui', shui: 'huo', huo: 'jin' }; // A 克 BEATS[A]
function counterMult(atk, def) {
  if (atk === 'none' || atk === 'wild') return COUNTER_NEU;
  if (BEATS[atk] === def) return COUNTER_HIT;   // 你克它
  if (BEATS[def] === atk) return COUNTER_BAD;   // 它克你
  return COUNTER_NEU;
}
function multByM(m) { return m >= 6 ? 3.0 : (MULT_BY_M[m] ?? 1.0); }

// ── 种子 PRNG（mulberry32·可复现）──────────────────────────────────────────
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

// ── 骰子（6 面·每面 {v 点数, el 元素}）────────────────────────────────────
const mk = (vals, el) => ({ faces: vals.map((v) => ({ v, el })) });
const plain = () => mk([1, 2, 3, 4, 5, 6], 'none');
const elemDie = (c) => mk([1, 2, 3, 4, 5, 6], c);
const dual = (a, b) => ({ faces: [{ v: 1, el: a }, { v: 2, el: a }, { v: 3, el: a }, { v: 4, el: b }, { v: 5, el: b }, { v: 6, el: b }] });
const heavy = () => mk([4, 5, 6, 7, 8, 9], 'none');
const steady = () => mk([3, 3, 4, 4, 5, 5], 'none');
const wild = () => mk([1, 2, 3, 4, 5, 6], 'wild');
const DUAL_PAIRS = [['jin', 'mu'], ['shui', 'huo'], ['tu', 'jin'], ['mu', 'shui'], ['huo', 'tu']];

const rollPool = (pool, rng) => pool.map((d) => d.faces[Math.floor(rng() * 6)]);

// ── 贪心选最优攻击（会选克制色·会权衡 base×mult×克制）────────────────────
function bestAttack(rolled, enemyEl) {
  let best = 0;
  // 中性攻击：只投 none 骰（mult1·counter1）
  let baseNone = 0;
  for (const r of rolled) if (r.el === 'none') baseNone += r.v;
  best = baseNone;
  // 元素攻击：每个元素 E 试一遍（投 E + wild + none·off-element 不投以免稀释）
  for (const E of ELEMENTS) {
    let base = 0, m = 0;
    for (const r of rolled) {
      if (r.el === E || r.el === 'wild') { base += r.v; m += 1; }
      else if (r.el === 'none') { base += r.v; }
    }
    if (m === 0) continue;
    const dmg = base * multByM(m) * counterMult(E, enemyEl);
    if (dmg > best) best = dmg;
  }
  return Math.round(best);
}

// ── 敌人 ────────────────────────────────────────────────────────────────
function makeEnemy(f, r, mode, rng) {
  const globalRoom = (f - 1) * 3 + r;
  const isBoss = r === 3;
  let hp = BASE_HP * Math.pow(GROWTH, globalRoom - 1);
  if (isBoss) hp *= BOSS_MULT;
  if (mode === 'coop') hp *= COOP_HP;
  return { hp: Math.round(hp), el: pick(rng, ELEMENTS), isBoss, shiftEvery: isBoss ? (mode === 'coop' ? 1 : 2) : Infinity };
}

// ── 一场战斗：每回合掷池→最优攻击→砸血；存活回合扣心（威胁）──────────────
function simulateFight(pool, enemy, rng) {
  let hp = enemy.hp, el = enemy.el, round = 0, threats = 0;
  while (hp > 0 && round < FIGHT_CAP) {
    round++;
    if (enemy.isBoss && round > 1 && (round - 1) % enemy.shiftEvery === 0) el = pick(rng, ELEMENTS); // BOSS 弱点漂移
    hp -= bestAttack(rollPool(pool, rng), el);
    if (hp > 0) threats++; // 没打死 → 这回合吃威胁
  }
  return { killed: hp <= 0, threats };
}

// ── 起手骰库 + 过关加骰策略（build 原型）────────────────────────────────
function startPool(mode) {
  const n = mode === 'coop' ? 8 : 5; // 双人 = 两套各 4 合掷
  return Array.from({ length: n }, plain);
}
function addReward(pool, archetype, rng, room) {
  switch (archetype) {
    case 'mono': pool.push(elemDie('huo')); break;                       // 纯色流（固定火）
    case 'dual': pool.push(dual(...pick(rng, DUAL_PAIRS))); break;       // 双色流（灵活克制）
    case 'heavy': pool.push(room % 2 ? heavy() : steady()); break;      // 重骰流（高地板·无组合）
    case 'flex': pool.push(room % 4 === 0 ? wild() : elemDie(pick(rng, ELEMENTS))); break; // 混合流（多色+偶尔百搭）
    default: break;
  }
}

// ── 一局 run ─────────────────────────────────────────────────────────────
function simulateRun(mode, archetype, rng, floors) {
  const pool = startPool(mode);
  let hearts = mode === 'coop' ? COOP_HEARTS : SOLO_HEARTS;
  for (let f = 1; f <= floors; f++) {
    for (let r = 1; r <= 3; r++) {
      const globalRoom = (f - 1) * 3 + r;
      const enemy = makeEnemy(f, r, mode, rng);
      const res = simulateFight(pool, enemy, rng);
      hearts -= res.threats;
      if (!res.killed) hearts -= STUCK_PENALTY;
      if (hearts <= 0) return { reachedRoom: globalRoom, top: false };
      if (enemy.isBoss) hearts = Math.min(mode === 'coop' ? COOP_HEARTS : SOLO_HEARTS, hearts + 1); // BOSS 回 1 心
      addReward(pool, archetype, rng, globalRoom);
    }
  }
  return { reachedRoom: floors * 3, top: true };
}

// ── 跑 + 报告 ────────────────────────────────────────────────────────────
function arg(name, def) { const a = process.argv.find((x) => x.startsWith(`--${name}=`)); return a ? Number(a.split('=')[1]) : def; }
const RUNS = arg('runs', 2000), FLOORS = arg('floors', 4), SEED = arg('seed', 1);
const ARCHES = ['mono', 'dual', 'heavy', 'flex'];
const ARCH_CN = { mono: '纯色流', dual: '双色流', heavy: '重骰流', flex: '混合流' };

function runBatch(mode, archetype) {
  const rng = mulberry32(SEED + mode.length * 7 + archetype.length * 13);
  const totalRooms = FLOORS * 3;
  const reachedAt = new Array(totalRooms + 1).fill(0); // 到达过第 i 间的次数
  let tops = 0, sumRoom = 0;
  for (let i = 0; i < RUNS; i++) {
    const res = simulateRun(mode, archetype, rng, FLOORS);
    if (res.top) tops++;
    sumRoom += res.reachedRoom;
    for (let k = 1; k <= res.reachedRoom; k++) reachedAt[k]++;
  }
  // 每层存活率 = 到达过该层 BOSS 间(第 f*3 间)的比例
  const floorSurv = [];
  for (let f = 1; f <= FLOORS; f++) floorSurv.push((reachedAt[f * 3] / RUNS * 100));
  return { top: tops / RUNS * 100, avgRoom: sumRoom / RUNS, floorSurv };
}

console.log(`\n=== 《骰途》平衡模拟 ===  runs=${RUNS}  floors=${FLOORS}(=${FLOORS * 3}间·每层2战+1BOSS)  seed=${SEED}`);
console.log(`敌人HP: BASE=${BASE_HP} growth=${GROWTH} boss×${BOSS_MULT} | 双人敌HP×${COOP_HP} | 心 单${SOLO_HEARTS}/双${COOP_HEARTS}\n`);
for (const mode of ['single', 'coop']) {
  console.log(`── ${mode === 'single' ? '单人' : '双人'} ──  (每层存活% = 打到该层BOSS的比例)`);
  console.log(`  build      登顶%   平均到达间   ` + Array.from({ length: FLOORS }, (_, i) => `第${i + 1}层`).join('  '));
  for (const a of ARCHES) {
    const r = runBatch(mode, a);
    console.log(`  ${ARCH_CN[a]}      ${r.top.toFixed(1).padStart(5)}   ${r.avgRoom.toFixed(1).padStart(7)}      ` + r.floorSurv.map((s) => s.toFixed(0).padStart(4) + '%').join(' '));
  }
  console.log('');
}

// ── 微测：选对色 vs 随机色 的伤害差（体现策略价值）────────────────────────
function colorValueTest() {
  const rng = mulberry32(SEED + 999);
  const pool = [elemDie('huo'), elemDie('huo'), elemDie('huo'), plain(), plain()]; // 火 build
  const enemyEl = 'jin'; // 火克金 → 选火=克制
  let smart = 0, random = 0; const N = 5000;
  for (let i = 0; i < N; i++) {
    const rolled = rollPool(pool, rng);
    smart += bestAttack(rolled, enemyEl); // 贪心(会选火·吃克制)
    // 随机色策略：强行按一个随机元素结算（模拟不动脑）
    const E = pick(rng, ELEMENTS);
    let base = 0, m = 0; for (const r of rolled) { if (r.el === E || r.el === 'wild') { base += r.v; m += 1; } else if (r.el === 'none') base += r.v; }
    random += Math.round((m ? base * multByM(m) : base) * counterMult(m ? E : 'none', enemyEl));
  }
  console.log(`── 策略价值微测（火build 打金敌·N=${N}）──`);
  console.log(`  选对色(贪心)均伤 ${(smart / N).toFixed(1)}  vs  随机色均伤 ${(random / N).toFixed(1)}  → 倍率 ${(smart / random).toFixed(2)}×\n`);
}
colorValueTest();
