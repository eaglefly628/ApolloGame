// scripts/game-d-balance-sim.mjs —— 《骰途》平衡模拟器 v2（HP + 门槛挑战 + 反制·统一模型·纯 node）。
//
// 配套 docs/design/game-d/combat-design.md §12 + balance-design.md。建模 combat.ts 的统一战斗，跑大量 run
// 验证「可行性 + 成长曲线」。常量与 combat.ts 一一对应（一处调两处同步）。
// 用法：node scripts/game-d-balance-sim.mjs [--runs=3000] [--floors=4] [--seed=1]

// ── 可调常量（= combat.ts）─────────────────────────────────────────────
const REROLLS = 2;
const SOLO_HEARTS = 6, COOP_HEARTS = 9;
const SOLO_START = 5, COOP_START = 8;
const COOP_HP = 1.9;
const FIGHT_CAP = 14;            // 单场最多回合（超=磨死）
// 敌人：tSum = 8 + g*3；砸血(0): sum≥0.7t, hp=2.4t | pattern(1): sum≥t+含6, hp=1.1t | BOSS(2): sum≥1.25t+对, hp=2.2t+弃高低
const tSumOf = (g) => Math.round(8 + g * 3);

const FIVE = ['jin', 'mu', 'shui', 'huo', 'tu'];
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (rng, a) => a[Math.floor(rng() * a.length)];

// ── 骰子 ───────────────────────────────────────────────────────────────
const mk = (vals, el) => ({ faces: vals.map((v) => ({ v, el })) });
const plain = () => mk([1, 2, 3, 4, 5, 6], 'none');
const elem = (c) => mk([1, 2, 3, 4, 5, 6], c);
const heavy = () => mk([4, 5, 6, 7, 8, 9], 'none');
const wild = () => mk([1, 2, 3, 4, 5, 6], 'wild');
const roll = (pool, rng) => pool.map((d) => d.faces[Math.floor(rng() * 6)]);

// ── 敌人 ───────────────────────────────────────────────────────────────
function makeFoe(g, roomInAct) {
  const t = tSumOf(g);
  if (roomInAct === 0) return { conds: [{ k: 'sum', t: Math.round(t * 0.7) }], hp: Math.round(t * 2.4), counter: 'none', kind: '砸血' };
  if (roomInAct === 1) return { conds: [{ k: 'sum', t }, { k: 'contains', v: 6 }], hp: Math.round(t * 1.1), counter: 'none', kind: 'pattern' };
  return { conds: [{ k: 'sum', t: Math.round(t * 1.25) }, { k: 'pair' }], hp: Math.round(t * 2.2), counter: 'discardHighLow', kind: 'BOSS' };
}
function disabledIdx(rolled, counter) {
  const dis = new Set();
  if (counter === 'discardHighLow' && rolled.length >= 2) {
    let hi = 0, lo = 0;
    rolled.forEach((r, i) => { if (r.v > rolled[hi].v) hi = i; if (r.v < rolled[lo].v) lo = i; });
    dis.add(hi); dis.add(lo);
  }
  return dis;
}
function hasPair(dice) {
  const seen = new Map(); let wilds = 0;
  for (const r of dice) { if (r.el === 'wild') { wilds++; continue; } const k = r.el + '-' + r.v; seen.set(k, (seen.get(k) || 0) + 1); if (seen.get(k) >= 2) return true; }
  if (wilds >= 1 && dice.some((r) => r.el !== 'wild')) return true;
  return wilds >= 2;
}
const sumOf = (d) => d.reduce((s, r) => s + r.v, 0);
function meets(dice, conds) {
  return conds.every((c) => c.k === 'sum' ? sumOf(dice) >= c.t : c.k === 'contains' ? dice.some((r) => r.v === c.v) : hasPair(dice));
}

// ── 一场战斗（贪心玩家：投全部可用·重掷凑门槛）──────────────────────────
function fight(pool, foe, rng) {
  let hp = foe.hp, hearts_lost = 0, rounds = 0;
  while (hp > 0 && rounds < FIGHT_CAP) {
    rounds++;
    let rolled = roll(pool, rng);
    let usable = rolled.filter((_, i) => !disabledIdx(rolled, foe.counter).has(i));
    let rr = REROLLS;
    while (!meets(usable, foe.conds) && rr > 0) {
      rr--; rolled = roll(pool, rng); const dis = disabledIdx(rolled, foe.counter); usable = rolled.filter((_, i) => !dis.has(i));
    }
    if (meets(usable, foe.conds)) hp -= sumOf(usable);
    else hearts_lost++;
  }
  return { killed: hp <= 0, hearts_lost, rounds };
}

// ── build 原型加骰策略 ───────────────────────────────────────────────────
function addDie(pool, arch, rng) {
  if (arch === 'mono') pool.push(elem('huo'));
  else if (arch === 'flex') pool.push(rng() < 0.25 ? wild() : elem(pick(rng, FIVE)));
  else if (arch === 'heavy') pool.push(rng() < 0.5 ? heavy() : plain());
  else if (arch === 'wildy') pool.push(rng() < 0.5 ? wild() : elem(pick(rng, FIVE)));
}
function startPool(mode) { return Array.from({ length: mode === 'coop' ? COOP_START : SOLO_START }, plain); }

function run(mode, arch, rng, floors) {
  const pool = startPool(mode);
  let hearts = mode === 'coop' ? COOP_HEARTS : SOLO_HEARTS;
  for (let f = 1; f <= floors; f++) {
    for (let r = 0; r < 3; r++) {
      const g = (f - 1) * 3 + r + 1;
      const foe = makeFoe(g, r);
      if (mode === 'coop') foe.hp = Math.round(foe.hp * COOP_HP);
      const res = fight(pool, foe, rng);
      hearts -= res.hearts_lost;
      if (!res.killed) hearts -= 2;       // 磨不死=大罚
      if (hearts <= 0) return { reached: g, top: false };
      if (r === 2) hearts = Math.min(mode === 'coop' ? COOP_HEARTS : SOLO_HEARTS, hearts + 1); // BOSS 回心
      addDie(pool, arch, rng);
    }
  }
  return { reached: floors * 3, top: true };
}

// ── 跑 + 报告 ────────────────────────────────────────────────────────────
const arg = (n, d) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? Number(a.split('=')[1]) : d; };
const RUNS = arg('runs', 3000), FLOORS = arg('floors', 4), SEED = arg('seed', 1);
const ARCHES = [['mono', '纯色流'], ['flex', '混合流'], ['heavy', '重骰流'], ['wildy', '百搭流']];

console.log(`\n=== 《骰途》平衡模拟 v2（HP+门槛+反制）===  runs=${RUNS} floors=${FLOORS}(${FLOORS * 3}间) seed=${SEED}`);
console.log(`门槛 tSum=8+3g | 砸血 sum≥0.7t·hp2.4t | pattern sum≥t+含6·hp1.1t | BOSS sum≥1.25t+同色对·hp2.2t+弃高低`);
console.log(`重掷 ${REROLLS} | 心 单${SOLO_HEARTS}/双${COOP_HEARTS} | 起手骰 单${SOLO_START}/双${COOP_START} | 双人敌HP×${COOP_HP}\n`);
for (const mode of ['single', 'coop']) {
  console.log(`── ${mode === 'single' ? '单人' : '双人'} ──  (每层存活% = 打到该层BOSS的比例)`);
  console.log(`  build      登顶%   平均到达间   ` + Array.from({ length: FLOORS }, (_, i) => `第${i + 1}层`).join('  '));
  for (const [a, cn] of ARCHES) {
    const rng = mulberry32(SEED + mode.length * 7 + a.length * 13);
    const reachedAt = new Array(FLOORS * 3 + 1).fill(0); let tops = 0, sumR = 0;
    for (let i = 0; i < RUNS; i++) { const res = run(mode, a, rng, FLOORS); if (res.top) tops++; sumR += res.reached; for (let k = 1; k <= res.reached; k++) reachedAt[k]++; }
    const surv = []; for (let f = 1; f <= FLOORS; f++) surv.push((reachedAt[f * 3] / RUNS * 100));
    console.log(`  ${cn}      ${(tops / RUNS * 100).toFixed(1).padStart(5)}   ${(sumR / RUNS).toFixed(1).padStart(7)}      ` + surv.map((s) => s.toFixed(0).padStart(4) + '%').join(' '));
  }
  console.log('');
}

// ── 可行性微测：每种敌人门槛·当前骰库的满足率（看曲线是否"可达"）──────────
function feasTest() {
  const rng = mulberry32(SEED + 777);
  console.log('── 可行性微测（满足门槛率·骰库随层成长·N=2000/格）──');
  console.log('  层  骰库  砸血  pattern  BOSS');
  for (let f = 1; f <= FLOORS; f++) {
    const g0 = (f - 1) * 3;
    const pool = Array.from({ length: SOLO_START + g0 }, plain).map((p, i) => i < SOLO_START ? p : elem(pick(rng, FIVE))); // 近似：起手朴 + 每关一五行骰
    const rate = [0, 1, 2].map((r) => {
      const foe = makeFoe(g0 + r + 1, r); let ok = 0; const N = 2000;
      for (let i = 0; i < N; i++) {
        let rolled = roll(pool, rng); let dis = disabledIdx(rolled, foe.counter); let usable = rolled.filter((_, j) => !dis.has(j)); let rr = REROLLS;
        while (!meets(usable, foe.conds) && rr > 0) { rr--; rolled = roll(pool, rng); dis = disabledIdx(rolled, foe.counter); usable = rolled.filter((_, j) => !dis.has(j)); }
        if (meets(usable, foe.conds)) ok++;
      }
      return (ok / N * 100).toFixed(0) + '%';
    });
    console.log(`  ${f}   ${String(pool.length).padStart(2)}颗  ${rate[0].padStart(4)}  ${rate[1].padStart(5)}   ${rate[2].padStart(4)}`);
  }
  console.log('  （满足率太低=卡死·太高=无脑·理想中段层 70~95% 拼一拼）\n');
}
feasTest();
