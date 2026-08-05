#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  game107《逆位·深渊》平衡模拟器 —— 多英雄「牧养」版
//  先例：scripts/game-d-balance-sim.mjs · game-103 balance-design §9 sim spec。
//
//  设计命题（owner 2026-08-04 口述定向）：
//    场上不是一个英雄，而是一群不断涌入的 game-103 幸存者，各自独立成长。
//    你（深渊之主）资源有限，每隔十几秒就要重做一次分诊：
//      · 割初级英雄  = 便宜，永久掐掉一条未来的指数曲线，但赏金薄；
//      · 拖强力英雄  = 断经验 / 夺经验 / 封 farm 空间，不求击杀只求压住曲线；
//      · 收割高级英雄= 昂贵且危险，但赏金最厚 —— 这是你自己的增长主引擎。
//    英雄成长到「讨伐级」会转而进攻深渊之心；核心破 = 你失败。
//
//  ★ 核心张力 = 牧养：英雄等级越高赏金越厚（你想养肥），但越肥越难杀，
//    且越接近讨伐级（会来拆你）。放任 = 被讨伐波推平；杀光 = 没有赏金来源。
//
//  验证判据：
//    A 纯龟缩              → 必败（不进攻＝零赏金＝零腐化度）
//    B 见谁杀谁·不分诊     → 应劣（资源摊薄，谁也没处理干净）
//    C 只割最弱            → 应劣（赏金太薄；强者无人看管长到讨伐级）
//    D 只集火最强          → 应劣（太贵，期间放任一群小的长大）
//    E 分诊：拖强+割弱+收割 → 应稳定守住
//
//  抽象声明（诚实标注·非全保真）：
//    · 武器不模拟弹道，按「冷却到 → 命中范围内 N 个最近目标」结算。
//    · 英雄走位=威胁斥力 + 切向绕行 + 宝石引力 + 腐化区/边界斥力（近似 t2-steering）。
//    · 三选一由估值表确定性选取（近似 AI 消费 t2-draft-offer）。
//  确定性：全程 mulberry32 种子 PRNG，禁裸 Math.random（CLAUDE.md randomness 红线）。
//  用法：node scripts/game107-balance-sim.mjs [--seed N] [--diag]
// ═══════════════════════════════════════════════════════════════

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/* ═══════════════ 数值表（纯数据 · 与 balance-design.md 同源） ═══════════════ */

const ARENA_H = 640;         // 矩形竞技场半宽/半高（1280×1280）：对角 905 ≈ 裂隙环 560+腐化圈 340 的触及半径
                             //   ——四角必须可被合围，否则角落=永久安全区（矩形化实测踩坑）——Lead Y1 裁：bounds-clamp 纯 AABB，无圆形
const RIFT_RING = 560;       // 裂隙环
const MATCH_TIME = 900;      // 15:00 一局

// 英雄 = game-103 的幸存者玩家（数值取 game-103 gdd §3 / balance-design §2）
// ★ 属性闭集：每种怪物只打其中一条防御条。三个动词各对应一条。
//   锐 = 处决（魂蛆/疾影/魔王）· 蚀 = 消磨（腐蚀者/腐化领地）· 缚 = 控制夺取（缚锁者/缚魂者/食晶蛭）
const ATTRS = ['rui', 'shi', 'fu'];
const ATTR_NAME = { rui: '锐', shi: '蚀', fu: '缚' };

// 英雄「防御侧写」：入场时抽一种。三条防御强弱不同 ⇒ 每个英雄是一道不同的题。
//   这就是「要能看到他的数值」为什么是玩法而不是装饰——你得读面板才知道该投什么。
const DEF_PROFILES = [
  { id: 'bulwark', name: '铁壁', mul: { rui: 2.2, shi: 1.0, fu: 0.3 } },
  { id: 'warden',  name: '守誓', mul: { rui: 0.3, shi: 2.2, fu: 1.0 } },
  { id: 'zealot',  name: '狂信', mul: { rui: 1.0, shi: 0.3, fu: 2.2 } },
  { id: 'even',    name: '游侠', mul: { rui: 1.0, shi: 1.0, fu: 1.0 } },
];

const HERO = {
  // NPC 化：不再受 game-103 玩家平衡约束（owner 2026-08-05「毕竟他只是个 npc」）
  baseHp: 120, hpPerLevel: 22,
  defBase: 30, defPerLevel: 8,     // 每条防御条的基准（再乘侧写系数）
  defRegen: 0.06,                   // 脱离该属性伤害 4s 后，每秒回复 6% 该条上限
  defRegenDelay: 4,
  breakBonus: 1.5,                  // ★ 破防后该属性伤害转入 HP 并 ×1.5
  moveSpeed: 200, pickupRadius: 80,
  iframe: 0.5,               // ★ 0.5s 无敌帧 → 接触伤害上限 2 次/秒（堆量无法提 DPS）
  radius: 16,
  xpToNext: lv => 5 + lv * 10,
  ambientXp: 0.25,            // ★ 探索自得的经验：不靠你也会长。所以「拖成长」是必须做的事，龟缩＝等死
  raidLevel: 7,              // 成长到此级转为「讨伐」：不再 farm，直扑深渊之心
  raidDps: 26,               // 讨伐时每把武器对核心的输出
};

const COHORT = {
  startCount: 4,             // 开局在场英雄数
  maxAlive: 8,
  total: 22,                 // ★ 一局只有这么多英雄会进入深渊 —— 兽群是有限的。
                             //   所以「每头养到多肥再收割」是唯一的经济变量：
                             //   全在 Lv1 割掉 = 22×66 ≈ 1452 < 配额，必然收不满。
  entryEvery: 26,
  respawnDelay: 18,
  entryGrace: 6,             // 入场无敌时间：防止蹲守出生点白嫖
};

const WEAPONS = [
  { id: 'kunai',  mode: 'nearest', range: 420, base: { dmg: 12, cd: 1.0, amount: 1, pierce: 1 }, max: { dmg: 22, cd: 0.85, amount: 2, pierce: 2 }, evo: { dmg: 30, cd: 0.40, amount: 3, pierce: 99 }, key: 'tome' },
  { id: 'boomer', mode: 'nearest', range: 350, base: { dmg: 18, cd: 1.6, amount: 1, pierce: 3 }, max: { dmg: 34, cd: 1.20, amount: 2, pierce: 4 }, evo: { dmg: 40, cd: 0.60, amount: 3, pierce: 6 }, key: 'gale' },
  { id: 'orbit',  mode: 'aoe',     range: 90,  base: { dmg: 10, cd: 0.30, amount: 2, pierce: 1 }, max: { dmg: 18, cd: 0.25, amount: 4, pierce: 1 }, evo: { dmg: 26, cd: 0.20, amount: 6, pierce: 1 }, key: 'core' },
  { id: 'shock',  mode: 'aoe',     range: 150, base: { dmg: 20, cd: 2.5, amount: 1, pierce: 1 }, max: { dmg: 40, cd: 1.80, amount: 1, pierce: 1 }, evo: { dmg: 55, cd: 1.20, amount: 1, pierce: 1 }, key: 'rune' },
  { id: 'laser',  mode: 'line',    range: 700, base: { dmg: 35, cd: 2.2, amount: 1, pierce: 99 }, max: { dmg: 60, cd: 1.60, amount: 1, pierce: 99 }, evo: { dmg: 85, cd: 1.10, amount: 3, pierce: 99 }, key: 'prism' },
  { id: 'pet',    mode: 'nearest', range: 300, base: { dmg: 14, cd: 0.8, amount: 1, pierce: 1 }, max: { dmg: 26, cd: 0.65, amount: 2, pierce: 1 }, evo: null, key: null },
];
const PASSIVES = [
  { id: 'tome',  stat: 'dmgAdd',  per: 0.08 }, { id: 'gale',   stat: 'cdRed',   per: 0.06 },
  { id: 'core',  stat: 'areaAdd', per: 0.10 }, { id: 'rune',   stat: 'areaAdd', per: 0.08 },
  { id: 'prism', stat: 'amtAdd',  per: 1 },    { id: 'heart',  stat: 'hpMul',   per: 0.15 },
  { id: 'boots', stat: 'spdMul',  per: 0.08 }, { id: 'magnet', stat: 'pickMul', per: 0.25 },
];

// 怪物谱系：T1 只能压制，T3 才有处决力（接触伤害受无敌帧封顶 → 每击伤害才是真战力）
const MONSTERS = [
  { id: 'grub',   name: '魂蛆',     tier: 1, attr: 'rui', cost: 10,  pop: 2, hp: 18,   contact: 6,  speed: 70,  radius: 12, gem: 1,  role: 'chase' },
  { id: 'spider', name: '缠影',     tier: 1, attr: 'fu', cost: 24,  pop: 1, hp: 40,   contact: 3,  speed: 210, radius: 11, gem: 2,  role: 'chase' },
  { id: 'spore',  name: '孢蚀虫',   tier: 1, attr: 'shi', cost: 18,  pop: 1, hp: 26,   contact: 4,  speed: 120, radius: 11, gem: 1,  role: 'chase' },
  { id: 'binder', name: '缚锁者',   tier: 2, attr: 'fu', cost: 55,  pop: 2, hp: 45,   contact: 5,  speed: 205, radius: 13, gem: 3,  role: 'chase', slow: { mul: 0.68, dur: 2.0 } },
  { id: 'leech',  name: '食晶蛭',   tier: 2, attr: 'fu', cost: 30,  pop: 1, hp: 30,   contact: 3,  speed: 150, radius: 11, gem: 1,  role: 'eatgem' },
  { id: 'golem',  name: '酸蚀巨躯', tier: 2, attr: 'shi', cost: 90,  pop: 4, hp: 420,  contact: 22, speed: 55,  radius: 24, gem: 6,  role: 'chase' },
  { id: 'corr',   name: '腐蚀者',   tier: 3, attr: 'shi', cost: 70,  pop: 2, hp: 60,   contact: 0,  speed: 90,  radius: 13, gem: 4,  role: 'ranged', atkRange: 300, atkCd: 1.6, dot: { dps: 6, dur: 4, max: 3 } },
  { id: 'stalk',  name: '疾影',     tier: 3, attr: 'rui', cost: 120, pop: 3, hp: 90,   contact: 26, speed: 215, radius: 13, gem: 5,  role: 'chase' },
  { id: 'soul',   name: '缚魂者',   tier: 3, attr: 'fu', cost: 140, pop: 3, hp: 80,   contact: 0,  speed: 95,  radius: 14, gem: 5,  role: 'ranged', atkRange: 320, atkCd: 1.4, xpDrain: 8 },
  { id: 'fiend',  name: '深渊魔王', tier: 4, attr: 'rui', cost: 340, pop: 8, hp: 1600, contact: 45, speed: 90,  radius: 30, gem: 20, role: 'chase' },
];
const MBY = Object.fromEntries(MONSTERS.map(m => [m.id, m]));

const ECON = {
  startSouls: 180, baseIncome: 8.0,
  rift: { cost: 70, costStep: 45, income: 4.0, pop: 3, hp: 600, gem: 12 },
  riftSites: 8, popBase: 6,
  core: { hp: 2200 },
  // ★ 胜利条件 = 收割配额，不是「活下来」。
  //   纯龟缩 → 收不满 → 输；乱杀小怪 → 赏金太薄也收不满；
  //   只有「养到高等级再收割」才够量（Lv6 赏金 196 ≈ 3 个 Lv1）。
  quota: 1800,   // 全在 Lv1 割掉 = 22×66 = 1452 < 1800 ⇒ 数学上强制养肥
  // ★ 赏金随等级暴涨 —— 「养肥再收割」是你的增长主引擎
  bountySouls: lv => 40 + 26 * lv,
  bountyCorrupt: lv => 10 + 6 * lv,
  // 阵亡英雄把一部分成长洒在地上：杀在人堆里 = 亲手把另一个英雄喂大
  spillGem: lv => Math.round(lv * 3),
  corruptPerDamage: 0.6,
  corruptPerPressureSec: 1.2,
  pressureRadius: 260,
  tierReq: [0, 40, 150, 360],
  zoneBase: 200, zonePerCorrupt: 0.35, zoneMax: 340,
  zoneDps: 5, zoneSlow: 0.75, zonePressure: 3.0,   // zoneDps 只作用于蚀防（见 step()）——领地封空间，不代替怪物杀人
  // ★ 深渊科技：腐化度不只是解锁门槛，还持续强化全体怪物 ——
  //   否则你的曲线是线性的，追不上英雄的指数成长（中后期必然停摆）。
  techPerTier: 0.22,
  gemLife: 45,                 // 经验宝石存在时限：过期即消散（让「断经验/拖时间」成为真手段）
  recallRefund: 0.4,
  spawnCd: { grub: 0.8, spider: 1.4, spore: 1.0, binder: 2.0, leech: 1.6, golem: 5.0, corr: 2.4, stalk: 4.0, soul: 5.0, fiend: 22 },
};

/* ═══════════════ 世界 ═══════════════ */

function makeHero(S, id) {
  const a = S.rnd() * Math.PI * 2;
  const prof = DEF_PROFILES[Math.floor(S.rnd() * DEF_PROFILES.length)];
  const h = {
    id, prof, x: Math.cos(a) * 600, y: Math.sin(a) * 600, vx: 0, vy: 0,
    hp: 0, maxHp: 0, level: 1, xp: 0,
    def: {}, defMax: {}, defQuiet: {},   // 当前值 / 上限 / 距上次受该属性伤害的时间
    iframe: COHORT.entryGrace, dots: [], slowT: 0, slowMul: 1, alive: true,
    weapons: [{ w: WEAPONS[0], lv: 1, cd: 0 }], passives: {},
    mods: { dmgAdd: 0, cdRed: 0, areaAdd: 0, amtAdd: 0, hpMul: 0, spdMul: 0, pickMul: 0 },
  };
  recomputeHero(h);
  h.hp = h.maxHp;
  for (const a2 of ATTRS) { h.def[a2] = h.defMax[a2]; h.defQuiet[a2] = 0; }
  return h;
}

function createSim(seed) {
  const rnd = mulberry32(seed);
  const riftSites = [];
  for (let i = 0; i < ECON.riftSites; i++) {
    const a = (i / ECON.riftSites) * Math.PI * 2;
    riftSites.push({ i, x: Math.cos(a) * RIFT_RING, y: Math.sin(a) * RIFT_RING, built: false, hp: 0 });
  }
  const S = {
    t: 0, rnd, over: false, result: null,
    souls: ECON.startSouls, corruption: 0,
    core: { x: 0, y: 0, hp: ECON.core.hp, maxHp: ECON.core.hp },
    riftSites, monsters: [], gems: [], heals: [], cds: {},
    heroes: [], nextHeroId: 1, entryTimer: COHORT.entryEvery, pending: [],
    stats: { spawned: 0, recalled: 0, xpFed: 0, xpDrained: 0, gemsEaten: 0, dmgToHeroes: 0, heroKills: 0, killsByLevel: [], soulsEarned: 0, harvest: 0, defStripped: 0, breaks: 0 },
  };
  for (let i = 0; i < COHORT.startCount; i++) S.heroes.push(makeHero(S, S.nextHeroId++));
  return S;
}

const popUsed = S => S.monsters.reduce((s, m) => s + m.def.pop, 0);
const popCap = S => ECON.popBase + S.riftSites.filter(r => r.built).length * ECON.rift.pop;
const income = S => ECON.baseIncome + S.riftSites.filter(r => r.built).length * ECON.rift.income;
const riftCost = S => ECON.rift.cost + ECON.rift.costStep * S.riftSites.filter(r => r.built).length;
const zoneRadius = S => ECON.zoneBase + Math.min(ECON.zoneMax - ECON.zoneBase, S.corruption * ECON.zonePerCorrupt);
function techMul(S) { return 1 + ECON.techPerTier * (tier(S) - 1); }
function tier(S) { let t = 1; for (let i = 0; i < ECON.tierReq.length; i++) if (S.corruption >= ECON.tierReq[i]) t = i + 1; return t; }
function inZone(S, p) { const R = zoneRadius(S); for (const r of S.riftSites) if (r.built && Math.hypot(p.x - r.x, p.y - r.y) < R) return true; return false; }

/* ---------------- 玩家操作 ---------------- */
function canSpawn(S, id) {
  const d = MBY[id];
  if (d.tier > tier(S)) return 'locked';
  if ((S.cds[id] || 0) > 0) return 'cd';
  if (popUsed(S) + d.pop > popCap(S)) return 'pop';
  if (S.souls < d.cost) return 'poor';
  if (!S.riftSites.some(r => r.built)) return 'norift';
  return 'ok';
}

// target 可选：指定压向哪个英雄（= 集火）。不给就打最近的。
function spawn(S, id, target) {
  if (canSpawn(S, id) !== 'ok') return false;
  const d = MBY[id];
  const built = S.riftSites.filter(r => r.built);
  const aim = target || S.heroes[0];
  const pred = aim ? { x: aim.x + aim.vx * 1.6, y: aim.y + aim.vy * 1.6 } : { x: 0, y: 0 };
  let site = built[0], best = Infinity;
  for (const r of built) { const dd = dist(r, pred); if (dd < best) { best = dd; site = r; } }
  S.souls -= d.cost; S.cds[id] = ECON.spawnCd[id]; S.stats.spawned++;
  const tm = techMul(S);
  S.monsters.push({
    def: d, hp: d.hp * tm, maxHp: d.hp * tm, dmgMul: tm,
    x: site.x + (S.rnd() - 0.5) * 60, y: site.y + (S.rnd() - 0.5) * 60,
    atkCd: 0, focus: target ? target.id : null,
  });
  return true;
}

function recall(S, m) {
  const i = S.monsters.indexOf(m);
  if (i < 0) return false;
  S.souls += m.def.cost * ECON.recallRefund;
  S.stats.recalled++;
  S.monsters.splice(i, 1);       // ★ 不掉经验宝石 —— 对抗「经验反噬」的核心操作
  return true;
}

function buildRift(S, idx) {
  const r = S.riftSites[idx], c = riftCost(S);
  if (r.built || S.souls < c) return false;
  S.souls -= c; r.built = true; r.hp = ECON.rift.hp;
  return true;
}

/* ---------------- 英雄成长 ---------------- */
function recomputeHero(h) {
  const lv = h.level - 1;
  h.maxHp = Math.round((HERO.baseHp + HERO.hpPerLevel * lv) * (1 + h.mods.hpMul));
  if (h.hp > h.maxHp) h.hp = h.maxHp;
  const base = HERO.defBase + HERO.defPerLevel * lv;
  for (const a of ATTRS) {
    const nm = Math.round(base * h.prof.mul[a]);
    const ratio = h.defMax[a] ? h.def[a] / h.defMax[a] : 1;
    h.defMax[a] = nm;
    h.def[a] = Math.min(nm, nm * ratio);
  }
}

function gainXp(S, h, n) {
  S.stats.xpFed += n; h.xp += n;
  while (h.xp >= HERO.xpToNext(h.level)) { h.xp -= HERO.xpToNext(h.level); h.level++; draft(S, h); }
}
function drainXp(S, h, n) {
  S.stats.xpDrained += n; h.xp -= n;
  while (h.xp < 0 && h.level > 1) { h.level--; h.xp += HERO.xpToNext(h.level); }
  if (h.xp < 0) h.xp = 0;
}

function draft(S, h) {
  const cand = [];
  for (const wep of h.weapons) if (wep.lv < 5) cand.push({ kind: 'wlv', ref: wep, w: 10 });
  if (h.weapons.length < 6) for (const W of WEAPONS) if (!h.weapons.find(x => x.w.id === W.id)) cand.push({ kind: 'wnew', ref: W, w: 6 });
  for (const P of PASSIVES) if ((h.passives[P.id] || 0) < 5) cand.push({ kind: 'pass', ref: P, w: 7 });
  if (!cand.length) { h.hp = Math.min(h.maxHp, h.hp + 20); return; }
  const offer = [], pool = cand.slice();
  for (let k = 0; k < 3 && pool.length; k++) {
    let tot = pool.reduce((s, c) => s + c.w, 0), r = S.rnd() * tot, pick = 0;
    for (let i = 0; i < pool.length; i++) { r -= pool[i].w; if (r <= 0) { pick = i; break; } }
    offer.push(pool.splice(pick, 1)[0]);
  }
  const score = c => c.kind === 'wlv' ? 100 + c.ref.lv * 10
    : c.kind === 'pass' ? (h.weapons.some(w => w.w.key === c.ref.id && w.lv >= 4) ? 120 : 40) + (c.ref.stat === 'dmgAdd' ? 20 : 0)
    : 60;
  offer.sort((a, b) => score(b) - score(a));
  const p = offer[0];
  if (p.kind === 'wlv') p.ref.lv++;
  else if (p.kind === 'wnew') h.weapons.push({ w: p.ref, lv: 1, cd: 0 });
  else { h.passives[p.ref.id] = (h.passives[p.ref.id] || 0) + 1; h.mods[p.ref.stat] += p.ref.per; recomputeHero(h); }
}

function weaponStats(h, wep) {
  const W = wep.w;
  const evolved = W.evo && wep.lv >= 5 && W.key && (h.passives[W.key] || 0) >= 1;
  let s;
  if (evolved) s = { ...W.evo };
  else {
    const k = (wep.lv - 1) / 4;
    s = {
      dmg: W.base.dmg + (W.max.dmg - W.base.dmg) * k,
      cd: W.base.cd + (W.max.cd - W.base.cd) * k,
      amount: Math.round(W.base.amount + (W.max.amount - W.base.amount) * k),
      pierce: Math.round(W.base.pierce + (W.max.pierce - W.base.pierce) * k),
    };
  }
  s.dmg *= 1 + h.mods.dmgAdd;
  s.cd = Math.max(0.1, s.cd * (1 - Math.min(0.7, h.mods.cdRed)));
  s.amount += h.mods.amtAdd;
  s.range = W.range * (1 + h.mods.areaAdd);
  return s;
}

// 英雄战力指数（分诊排序 / 报表用）
const power = h => h.weapons.reduce((a, w) => { const s = weaponStats(h, w); return a + s.dmg / s.cd; }, 0);

/* ---------------- 伤害 ---------------- */
function damageMonster(S, m, dmg) {
  m.hp -= dmg;
  if (m.hp <= 0) {
    const i = S.monsters.indexOf(m);
    if (i >= 0) S.monsters.splice(i, 1);
    S.gems.push({ x: m.x, y: m.y, v: m.def.gem, die: S.t + ECON.gemLife });  // ★ 经验反噬
    if (S.rnd() < 0.08) S.heals.push({ x: m.x, y: m.y });
  }
}

// attr = 这一击的属性。★ 伤害先打对应防御条；该条见底才落到 HP（并 ×breakBonus）。
//   ⇒ 「属性怪的叠加」＝ 先用便宜的同属性怪剥防，再让高伤同属性怪穿进去。
// 战果结算：伤害/剥防 → 魂能 + 腐化度
function credit(S, amount) {
  if (amount <= 0) return;
  S.souls += amount * 0.4; S.stats.soulsEarned += amount * 0.4;
  S.corruption += amount * ECON.corruptPerDamage;
}

function damageHero(S, h, dmg, attr, bypassIframe) {
  if (!h.alive) return;
  if (!bypassIframe) { if (h.iframe > 0) return; h.iframe = HERO.iframe; }
  if (attr && ATTRS.includes(attr)) {
    h.defQuiet[attr] = 0;
    if (h.def[attr] > 0) {
      const absorbed = Math.min(dmg, h.def[attr]);
      h.def[attr] -= absorbed;
      dmg -= absorbed;
      S.stats.defStripped += absorbed;
      // ★ 剥防也是战果：按 60% 计入魂能/腐化度。
      //   否则「打在防御条上的伤害」全是白干，腐化度经济会整体塌掉（实测踩坑）。
      credit(S, absorbed * 0.6);
      if (h.def[attr] <= 0) S.stats.breaks++;
      if (dmg <= 0) return;
    }
    dmg *= HERO.breakBonus;              // 破防增伤
  }
  const dealt = Math.min(dmg, h.hp);
  h.hp -= dmg;
  S.stats.dmgToHeroes += dealt;
  credit(S, dealt);
  if (h.hp <= 0) heroDies(S, h);
}

function heroDies(S, h) {
  h.alive = false;
  S.stats.heroKills++;
  S.stats.killsByLevel.push(h.level);
  const b = ECON.bountySouls(h.level), c = ECON.bountyCorrupt(h.level);
  S.souls += b; S.stats.soulsEarned += b; S.stats.harvest += b; S.corruption += c;
  const spill = ECON.spillGem(h.level);
  if (spill > 0) S.gems.push({ x: h.x, y: h.y, v: spill, die: S.t + ECON.gemLife });
  S.pending.push({ at: S.t + COHORT.respawnDelay });
}

/* ---------------- 每 tick ---------------- */
function step(S, dt) {
  S.t += dt;
  if (S.t >= MATCH_TIME) { S.over = true; S.result = S.stats.harvest >= ECON.quota ? 'win' : 'quota'; return; }

  const inc = income(S) * dt;
  S.souls += inc; S.stats.soulsEarned += inc;
  for (const k in S.cds) if (S.cds[k] > 0) S.cds[k] = Math.max(0, S.cds[k] - dt);

  // 英雄涌入
  const entered = () => S.nextHeroId - 1;
  S.entryTimer -= dt;
  if (S.entryTimer <= 0 && S.heroes.length < COHORT.maxAlive && entered() < COHORT.total) {
    S.entryTimer = COHORT.entryEvery; S.heroes.push(makeHero(S, S.nextHeroId++));
  }
  for (let i = S.pending.length - 1; i >= 0; i--) {
    if (S.t >= S.pending[i].at) {
      S.pending.splice(i, 1);
      if (S.heroes.length < COHORT.maxAlive && entered() < COHORT.total) S.heroes.push(makeHero(S, S.nextHeroId++));
    }
  }

  // 宝石过期消散
  for (let i = S.gems.length - 1; i >= 0; i--) if (S.t >= S.gems[i].die) S.gems.splice(i, 1);

  const ZR = zoneRadius(S);

  /* --- 英雄 --- */
  for (const h of S.heroes) {
    if (!h.alive) continue;
    if (h.iframe > 0) h.iframe -= dt;
    for (const a of ATTRS) {
      h.defQuiet[a] += dt;
      if (h.defQuiet[a] > HERO.defRegenDelay && h.def[a] < h.defMax[a]) {
        h.def[a] = Math.min(h.defMax[a], h.def[a] + h.defMax[a] * HERO.defRegen * dt);
      }
    }
    if (h.slowT > 0) { h.slowT -= dt; if (h.slowT <= 0) h.slowMul = 1; }

    if (h.dots.length) {
      let dps = 0;
      for (const d of h.dots) { dps += d.dps; d.t -= dt; }
      h.dots = h.dots.filter(d => d.t > 0);
      if (dps > 0) damageHero(S, h, dps * dt, 'shi', true);
      if (!h.alive) continue;
    }

    if (h.level < HERO.raidLevel) gainXp(S, h, HERO.ambientXp * dt);
    const raiding = h.level >= HERO.raidLevel;
    let vx = 0, vy = 0, nearest = Infinity;

    if (raiding) {
      // ★ 讨伐级：不再 farm，直扑深渊之心
      const d = Math.max(1, Math.hypot(h.x, h.y));
      if (d > 120) { vx = -h.x / d; vy = -h.y / d; }
      else {
        S.core.hp -= HERO.raidDps * h.weapons.length * (1 + h.mods.dmgAdd) * dt;
        if (S.core.hp <= 0) { S.over = true; S.result = 'lose'; return; }
      }
      for (const m of S.monsters) nearest = Math.min(nearest, dist(m, h));
    } else {
      for (const m of S.monsters) {
        const d = Math.max(24, dist(m, h));
        nearest = Math.min(nearest, d - m.def.radius);
        if (d > 600) continue;
        const w = (m.def.contact + 4) / (d * d) * 14000 * (d < 130 ? 2.4 : 1);
        const ux = (h.x - m.x) / d, uy = (h.y - m.y) / d;
        vx += ux * w; vy += uy * w;
        if (d >= 130 && d < 300) { vx += -uy * w * 0.9; vy += ux * w * 0.9; }
      }
      for (const r of S.riftSites) {
        if (!r.built) continue;
        const d = Math.max(30, dist(r, h));
        if (d > ZR + 220) continue;
        const pen = Math.max(24, d - ZR + 200);
        const w = 90 * Math.pow(260 / pen, 2);
        vx += (h.x - r.x) / d * w; vy += (h.y - r.y) / d * w;
      }
      if (nearest > 130) {
        let g = null, gd = 900;
        for (const q of S.gems) { const d = dist(q, h); if (d < gd) { gd = d; g = q; } }
        if (g) { const d = Math.max(1, gd); vx += (g.x - h.x) / d * 5.0; vy += (g.y - h.y) / d * 5.0; }
      }
    }

    // 矩形边界斥力（四边各算·与怪物斥力同量级，防被逼进角落卡死）
    const wall = d => 80 * Math.pow(300 / Math.max(d, 22), 2);
    if (h.x > ARENA_H - 240) vx -= wall(ARENA_H - h.x);
    if (h.x < -ARENA_H + 240) vx += wall(h.x + ARENA_H);
    if (h.y > ARENA_H - 240) vy -= wall(ARENA_H - h.y);
    if (h.y < -ARENA_H + 240) vy += wall(h.y + ARENA_H);

    const zoned = inZone(S, h);
    // ★ 腐化领地只剥蚀防 + 减速，不直接打 HP —— 否则「造完裂隙等地形闷死英雄」会成为退化解
    // 领地压制：英雄站在腐化区里持续为你产腐化度（不打 HP）——「封空间」本身就是战果
    if (zoned) S.corruption += ECON.zonePressure * dt;
    if (zoned && h.def.shi > 0) {
      const d = Math.min(ECON.zoneDps * dt, h.def.shi);
      h.def.shi -= d; h.defQuiet.shi = 0;
      S.stats.defStripped += d;
      credit(S, d * 0.6);
      if (h.def.shi <= 0) S.stats.breaks++;
    }

    const vm = Math.hypot(vx, vy);
    if (vm > 0.001) {
      const sp = HERO.moveSpeed * (1 + h.mods.spdMul) * h.slowMul * (zoned ? ECON.zoneSlow : 1);
      h.vx = (vx / vm) * sp; h.vy = (vy / vm) * sp;
      h.x += h.vx * dt; h.y += h.vy * dt;
    } else { h.vx = 0; h.vy = 0; }
    h.x = Math.max(-ARENA_H, Math.min(ARENA_H, h.x));
    h.y = Math.max(-ARENA_H, Math.min(ARENA_H, h.y));

    if (nearest < ECON.pressureRadius) S.corruption += ECON.corruptPerPressureSec * dt;

    const pr = HERO.pickupRadius * (1 + h.mods.pickMul);
    for (let i = S.gems.length - 1; i >= 0; i--) if (dist(S.gems[i], h) <= pr) { gainXp(S, h, S.gems[i].v); S.gems.splice(i, 1); }
    for (let i = S.heals.length - 1; i >= 0; i--) if (dist(S.heals[i], h) <= pr) { h.hp = Math.min(h.maxHp, h.hp + 15); S.heals.splice(i, 1); }

    for (const wep of h.weapons) {
      wep.cd -= dt;
      if (wep.cd > 0) continue;
      const s = weaponStats(h, wep);
      wep.cd = s.cd;
      const inR = S.monsters.map(m => ({ m, d: dist(m, h) })).filter(o => o.d <= s.range + o.m.def.radius).sort((a, b) => a.d - b.d);
      if (!inR.length) continue;
      const targets = wep.w.mode === 'aoe' ? inR : wep.w.mode === 'line' ? inR.slice(0, 8) : inR.slice(0, Math.max(1, s.amount * s.pierce));
      for (const o of targets) damageMonster(S, o.m, s.dmg);
    }

    for (const r of S.riftSites) {
      if (!r.built || dist(r, h) >= 240) continue;
      r.hp -= 12 * (1 + h.mods.dmgAdd) * dt * h.weapons.length;
      if (r.hp <= 0) { r.built = false; S.gems.push({ x: r.x, y: r.y, v: ECON.rift.gem, die: S.t + ECON.gemLife }); }
    }
  }

  if (S.over) return;
  S.heroes = S.heroes.filter(h => h.alive);

  /* --- 怪物 --- */
  for (const m of S.monsters.slice()) {
    const d = m.def;
    if (d.role === 'eatgem') {
      let g = null, gd = Infinity;
      for (const q of S.gems) { const dd = dist(q, m); if (dd < gd) { gd = dd; g = q; } }
      if (!g) continue;
      if (gd < 22) { S.gems.splice(S.gems.indexOf(g), 1); S.stats.gemsEaten++; }
      else { m.x += (g.x - m.x) / gd * d.speed * dt; m.y += (g.y - m.y) / gd * d.speed * dt; }
      continue;
    }
    let tgt = m.focus ? S.heroes.find(h => h.id === m.focus) : null;
    if (!tgt) { let bd = Infinity; for (const h of S.heroes) { const dd = dist(h, m); if (dd < bd) { bd = dd; tgt = h; } } }
    if (!tgt) continue;
    const dd = Math.max(1, dist(m, tgt));

    if (d.role === 'ranged') {
      if (dd > d.atkRange) { m.x += (tgt.x - m.x) / dd * d.speed * dt; m.y += (tgt.y - m.y) / dd * d.speed * dt; }
      m.atkCd -= dt;
      if (m.atkCd <= 0 && dd <= d.atkRange) {
        m.atkCd = d.atkCd;
        if (d.dot) { if (tgt.dots.length < d.dot.max) tgt.dots.push({ dps: d.dot.dps * (m.dmgMul || 1), t: d.dot.dur }); else tgt.dots[0].t = d.dot.dur; }
        if (d.xpDrain) drainXp(S, tgt, d.xpDrain);
      }
      continue;
    }
    if (dd > d.radius + HERO.radius) { m.x += (tgt.x - m.x) / dd * d.speed * dt; m.y += (tgt.y - m.y) / dd * d.speed * dt; }
    else {
      damageHero(S, tgt, d.contact * (m.dmgMul || 1), d.attr);
      if (d.slow) { tgt.slowMul = d.slow.mul; tgt.slowT = d.slow.dur; }
    }
  }
  S.heroes = S.heroes.filter(h => h.alive);
}

/* ═══════════════ 策略机器人 ═══════════════ */

const builtCount = S => S.riftSites.filter(r => r.built).length;
const buildAll = S => { for (let i = 0; i < ECON.riftSites; i++) if (!S.riftSites[i].built && S.souls >= riftCost(S)) { buildRift(S, i); return true; } return false; };
// 经济优先：前 4 座裂隙没建完就别把魂能烧在出兵上
const econFirst = S => { buildAll(S); return builtCount(S) < 4; };
const weakest = S => S.heroes.slice().sort((a, b) => a.level - b.level || a.hp - b.hp)[0];
const strongest = S => S.heroes.slice().sort((a, b) => b.level - a.level || power(b) - power(a))[0];
const CHAFF = ['grub', 'spider'];
// 按属性归类可投放的怪物（同属性才能剥同一条防御条）
const BY_ATTR = {};
for (const m of MONSTERS) (BY_ATTR[m.attr] ||= []).push(m.id);
// 该英雄最好剥的那条：当前值最低 = 最快破防
const weakAttr = h => ATTRS.slice().sort((a, b) => h.def[a] - h.def[b])[0];
// 破防收益 = 赏金 / 需要剥掉的防御量（越高越值得动手）
const ripeness = h => ECON.bountySouls(h.level) / Math.max(20, h.def[weakAttr(h)]);

function deploy(S, target, wallRatio, order) {
  const cap = popCap(S);
  const wallPop = S.monsters.filter(m => CHAFF.includes(m.def.id)).reduce((a, m) => a + m.def.pop, 0);
  if (wallPop < cap * wallRatio) {
    for (const id of CHAFF) if (canSpawn(S, id) === 'ok') { spawn(S, id, target); return; }
  }
  for (const id of order) if (canSpawn(S, id) === 'ok') { spawn(S, id, target); return; }
}

const STRATS = [
  ['A 纯龟缩·只造裂隙', S => { buildAll(S); }],

  ['B 见谁杀谁·不分诊', S => {
    if (econFirst(S)) return;
    deploy(S, null, 0.5, ['fiend', 'stalk', 'corr', 'binder', 'soul', 'golem', 'leech']);
  }],

  ['C 只割最弱', S => {
    if (econFirst(S)) return;
    deploy(S, weakest(S), 0.5, ['stalk', 'binder', 'corr', 'fiend', 'soul', 'golem', 'leech']);
  }],

  ['D 只集火最强', S => {
    if (econFirst(S)) return;
    deploy(S, strongest(S), 0.5, ['fiend', 'stalk', 'corr', 'binder', 'soul', 'golem', 'leech']);
  }],

  ['E 分诊：拖强+割弱+收割', S => {
    if (econFirst(S)) return;
    for (const m of S.monsters.slice())
      if (m.hp / m.maxHp < 0.25 && S.heroes.every(h => dist(m, h) > 260)) { recall(S, m); break; }

    const top = strongest(S), low = weakest(S);
    if (!top) return;
    // ① 强者只「拖」不硬杀：夺经验 + 断宝石，把他的成长曲线压住
    const suppressors = S.monsters.filter(m => ['leech', 'soul'].includes(m.def.id)).length;
    if (top.level >= 4 && suppressors < 4) {
      for (const id of ['soul', 'leech']) if (canSpawn(S, id) === 'ok') { spawn(S, id, top); return; }
    }
    // ② 养到讨伐边缘 → 集火收割（赏金最厚，且必须赶在他拆核心前）
    if (top.level >= HERO.raidLevel - 1) { deploy(S, top, 0.55, ['fiend', 'stalk', 'corr', 'binder', 'golem']); return; }
    // ③ 平时割最弱的：便宜、永久掐掉一条未来曲线
    deploy(S, low, 0.45, ['stalk', 'binder', 'corr', 'fiend', 'golem']);
  }],

  ['F 牧养：养到 Lv5+ 再收割', S => {
    if (econFirst(S)) return;
    for (const m of S.monsters.slice())
      if (m.hp / m.maxHp < 0.25 && S.heroes.every(h => dist(m, h) > 260)) { recall(S, m); break; }
    if (!S.heroes.length) return;

    const ripe = S.heroes.filter(h => h.level >= 5).sort((a, b) => b.level - a.level)[0];
    const nearRaid = S.heroes.filter(h => h.level >= HERO.raidLevel - 1)[0];

    // ① 逼近讨伐级 = 必须立刻收割（既是最厚赏金，也是核心的威胁）
    if (nearRaid) { deploy(S, nearRaid, 0.5, ['fiend', 'stalk', 'corr', 'binder', 'golem']); return; }
    // ② 已养熟（Lv5+）→ 集火收割
    if (ripe) { deploy(S, ripe, 0.45, ['stalk', 'fiend', 'corr', 'binder', 'golem']); return; }
    // ③ 没熟的一律不杀，只挂压制单位换腐化度（顺便别让他们吃太多宝石）
    const supp = S.monsters.filter(m => ['spider', 'leech', 'soul'].includes(m.def.id)).length;
    if (supp < 6) for (const id of ['spider', 'leech', 'soul']) if (canSpawn(S, id) === 'ok') { spawn(S, id, null); return; }
  }],

  ['G 读面板·打弱防', S => {
    if (econFirst(S)) return;
    for (const m of S.monsters.slice())
      if (m.hp / m.maxHp < 0.25 && S.heroes.every(h => dist(m, h) > 260)) { recall(S, m); break; }
    if (!S.heroes.length) return;

    // 讨伐级优先处理；否则挑「破防收益」最高的那个下手
    const raid = S.heroes.filter(h => h.level >= HERO.raidLevel - 1).sort((a, b) => b.level - a.level)[0];
    const tgt = raid || S.heroes.slice().sort((a, b) => ripeness(b) - ripeness(a))[0];
    const a = weakAttr(tgt);

    // 同属性阶梯：未破防 → 先上最便宜的剥防手；已破防 → 换最贵的载荷穿进去
    const cheapFirst = BY_ATTR[a].slice().sort((x, y) => MBY[x].cost - MBY[y].cost);
    const order = tgt.def[a] <= 0 ? cheapFirst.slice().reverse() : cheapFirst;
    // 同属性的廉价怪同时充当围堵墙
    const cap = popCap(S);
    const same = S.monsters.filter(m => m.def.attr === a).reduce((x, m) => x + m.def.pop, 0);
    if (same < cap * 0.55) {
      for (const id of cheapFirst) if (canSpawn(S, id) === 'ok') { spawn(S, id, tgt); return; }
    }
    for (const id of order) if (canSpawn(S, id) === 'ok') { spawn(S, id, tgt); return; }
  }],

  ['H 读面板 + 牧养', S => {
    if (econFirst(S)) return;
    for (const m of S.monsters.slice())
      if (m.hp / m.maxHp < 0.25 && S.heroes.every(h => dist(m, h) > 260)) { recall(S, m); break; }
    if (!S.heroes.length) return;

    const raid = S.heroes.filter(h => h.level >= HERO.raidLevel - 1).sort((a, b) => b.level - a.level)[0];
    const ripe = S.heroes.filter(h => h.level >= 4).sort((a, b) => ripeness(b) - ripeness(a))[0];
    const tgt = raid || ripe;
    if (!tgt) {
      // 还没有够肥的：只挂压制单位换腐化度，不下杀手（让他们长）
      const supp = S.monsters.filter(m => ['leech', 'soul', 'spider'].includes(m.def.id)).length;
      if (supp < 5) for (const id of ['spider', 'leech', 'soul']) if (canSpawn(S, id) === 'ok') { spawn(S, id, null); return; }
      return;
    }
    const a = weakAttr(tgt);
    const cheapFirst = BY_ATTR[a].slice().sort((x, y) => MBY[x].cost - MBY[y].cost);
    const order = tgt.def[a] <= 0 ? cheapFirst.slice().reverse() : cheapFirst;
    const cap = popCap(S);
    const same = S.monsters.filter(m => m.def.attr === a).reduce((x, m) => x + m.def.pop, 0);
    if (same < cap * 0.55) { for (const id of cheapFirst) if (canSpawn(S, id) === 'ok') { spawn(S, id, tgt); return; } }
    for (const id of order) if (canSpawn(S, id) === 'ok') { spawn(S, id, tgt); return; }
  }],
];

/* ═══════════════ 入口 ═══════════════ */
const args = process.argv.slice(2);
const seeds = args.includes('--seed') ? [Number(args[args.indexOf('--seed') + 1])] : [1, 2, 3, 4, 5];

function run(strategy, seed) {
  const S = createSim(seed);
  const dt = 1 / 30;
  while (!S.over) { strategy(S); step(S, dt); }
  return S;
}

if (args.includes('--diag')) {
  const S = createSim(1); const dt = 1 / 30; let next = 0;
  const fn = STRATS[4][1];
  while (!S.over) {
    fn(S); step(S, dt);
    if (S.t >= next) {
      next += 60;
      const lv = S.heroes.map(h => h.level).sort((a, b) => b - a).join(',');
      console.log(`t=${S.t.toFixed(0).padStart(3)} 核心=${Math.max(0, S.core.hp | 0).toString().padStart(4)} 魂能=${(S.souls | 0).toString().padStart(4)} 腐化=${(S.corruption | 0).toString().padStart(4)}(T${tier(S)}) 英雄Lv=[${lv}] 怪=${S.monsters.length} 裂隙=${S.riftSites.filter(r => r.built).length} 击杀=${S.stats.heroKills}`);
    }
  }
  console.log('结果', S.result, S.t.toFixed(0) + 's');
  process.exit(0);
}

console.log('game107《逆位·深渊》多英雄牧养模拟 —— 15:00 内收割够养分且核心不破 = 胜利\n');
for (const [label, fn] of STRATS) {
  const runs = seeds.map(s => run(fn, s));
  const wins = runs.filter(r => r.result === 'win').length;
  const r = runs[0];
  const kl = r.stats.killsByLevel;
  const avg = kl.length ? (kl.reduce((a, b) => a + b, 0) / kl.length).toFixed(1) : '-';
  const maxLv = Math.max(0, ...kl, ...r.heroes.map(h => h.level));
  console.log(
    `${label.padEnd(22)} ${(r.result === 'win' ? '达标' : r.result === 'quota' ? '配额不足' : '核心破').padEnd(6)} t=${r.t.toFixed(0).padStart(3)}s ` +
    `养分=${String(Math.round(r.stats.harvest)).padStart(4)}/${ECON.quota} ` +
    `击杀=${String(r.stats.heroKills).padStart(3)}(均Lv${avg}) 最高Lv=${String(maxLv).padStart(2)} ` +
    `腐化=${(r.corruption | 0).toString().padStart(4)} 喂经验=${String(r.stats.xpFed).padStart(4)} 夺回=${String(r.stats.xpDrained).padStart(3)} 吞宝石=${String(r.stats.gemsEaten).padStart(3)}` +
    `   [${wins}/${seeds.length} 达标]`
  );
}
console.log('\n判据：A 必败（零收割）；B/C/D 应明显劣于 E；E 分诊策略应稳定达标。');
