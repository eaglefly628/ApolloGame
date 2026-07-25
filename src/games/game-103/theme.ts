// game-103《幸存者核心原型》—— 视觉/数值常量 + 数据表（纯数据·零逻辑）。
// 参照 Survivor.io / Vampire Survivors 的俯视割草单局。M1 灰盒：走位 + 单武器自动开火 + 单敌群 +
// 经验拾取/等级 + 接触伤害/死亡 + 边界 + 相机跟随 + 胜负。升级=固定强化占位（三选一 draft 待 Lead 签 S2·E1）。
//
// 设计真相：docs/design/game-103/gdd.md · balance-design.md · ui-scene-design.md（+4 张 .dc.html）。
// 能力归属：docs/design/game-103/capability-plan.md。数据全摆成表，由现成引擎能力解释（见 blueprint.ts 头注）。
import type { UITheme } from '@ui/components/index.js';
import { ZONE_FLAG } from '@skills/tier2/index.js';

// ── 画布/世界尺寸（竖屏 9:16 相机视口 + 有界大场地·相机跟随玩家）──────────────
export const VIEW_W = 480;      // 相机视口宽（逻辑像素·CanvasRenderer 定尺盒）
export const VIEW_H = 854;      // 相机视口高（9:16 竖屏）
export const ARENA = 2400;      // 有界方形场地边长（gdd §二·2400×2400）
export const START = { x: ARENA / 2, y: ARENA / 2 } as const;

// ── Tag 位掩码（bit0 = ZONE_FLAG·引擎 trigger-zone 保留）─────────────────────
export const ZONE = ZONE_FLAG;   // 1<<0（判定区/子弹/宝石=Sensor 区）
export const PLAYER = 1 << 1;    // 玩家本体（承 hp·接触伤害目标）
export const ENEMY = 1 << 2;     // 敌人（子弹目标）
export const COLLECTOR = 1 << 3; // 拾取环（承 xp·跟随玩家的 child·宝石命中它入经验）
export const KILLBOX = 1 << 4;   // 计分环（承 score·单调累计击杀）
export const GEM = 1 << 12;      // 宝石（magnet 吸附标记·pull-anchor tagMask·位 12 避开武器位 5-11）

// ── 时间基准（引擎定步·HUD 计时/冷却/寿命一律用 tick）──────────────────────
export const TPS = 60;                       // ticks / 秒
export const MATCH_SECONDS = 900;            // 单局时长（15:00·活满即胜）
export const MATCH_TICKS = MATCH_SECONDS * TPS;

// ── 调色板（Color.tint）──────────────────────────────────────────────────────
export const TINT = {
  player: 0x4aa8ff, playerCore: 0x9fd0ff,
  enemyShambler: 0xff4d5e, enemyShamblerIn: 0xff9aa6,
  proj: 0xffffff,
  gemBlue: 0x4aa8ff,
  hpBar: 0xff4d5e,
} as const;

// ── 玩家定义（gdd §三 PLAYER 表）──────────────────────────────────────────────
export const PLAYER_DEF = {
  maxHp: 100,
  moveSpeed: 3,          // px/tick（≈180/s·gdd 200/s 起点·灰盒略调）
  radius: 13,
  pickupRadius: 34,      // 收取真空区半径（贴身·「接近才吃」·磁石被动 stat-bind 放大此值=更强吸力）。远距吸附另由宝石短程 attract 提供（见 blueprint gem）。
  skin: '103/player',
} as const;

// ── 武器册（gdd §4·统一数据表·pattern 声明射法）────────────────────────────
// 每把武器=一条纯数据；authoring 期 prefab builder（blueprint.ts）按 pattern 组装成现有能力的组件蓝图
// （Launch/Hitbox/Steering/Perception/rotation…）——非运行时游戏层解释器（同 game-q towerTemplate 先例·合规）。
// dmg/cd/projSpeed/life 皆 tick 化；命中由 t2-hitbox 结算（× 全局 power 系数）。
export type FirePattern =
  | 'straight'   // 直线飞弹（Launch toward:target·单发 consumeOnHit）
  | 'nova'       // 近身 AoE 爆（自身大范围 Hitbox·短寿命·扫全场贴身敌）
  | 'beam'       // 横扫直线（快速大穿透弹·短寿命扫穿一线）
  | 'boomerang'  // 往返回旋（Launch 去 + Perception/Steering 拉回玩家）
  | 'orbit'      // 环绕光球（旋转 hub + 环上光球 child·持续贴身伤）
  | 'pet'        // 宠物随从（跟随玩家的子体·自带 Timer+SelfRule 自动射）
  | 'homing';    // 追踪弹（Perception+Steering 锁敌·穿透·进化体质变）
export interface WeaponDef {
  key: string;
  name: string;
  desc: string;      // 三选一卡描述
  pattern: FirePattern;
  dmg: number;       // 基础伤害（× 全局 power）
  cd: number;        // 冷却 tick（发射节拍·orbit 忽略）
  projSpeed: number; // 子弹初速 px/tick（nova/orbit 忽略）
  life: number;      // 子弹寿命 tick
  radius: number;    // 判定半径（nova/orbit=范围半径）
  pierce?: boolean;  // 直线类是否穿透（true=不 consumeOnHit·per-tick 扫一线敌·起始武器清群用）
  amount: number;    // orbit 光球数 / pet 数 / 多重发（默认 1）
  weight: number;    // draft 加权（0=不进 draft 池·进化体/起始武器）
  maxLevel: number;
  tint: number;
  skin: string;
  // 进化（gdd §4.2·E2 重组·Lead 裁「重组」）：武器满级 + 持有 req 被动 → 满级下一次升级弹金卡·
  // 选中即 destroy-tagged 删基础武器挂点 + Caster spawn 进化体挂点（2.5–4× + 质变）。
  evo?: { to: string; req: string };
}
export const WEAPONS: WeaponDef[] = [
  { key: 'kunai', name: '飞镖 Kunai', desc: '直线飞镖·穿透索敌（起始武器·mow 一线）', pattern: 'straight', dmg: 7, cd: 34, projSpeed: 9, life: 90, radius: 7, amount: 1, weight: 0, maxLevel: 5, tint: 0xffffff, skin: '103/proj-kunai', pierce: true },
  { key: 'shock', name: '冲击波', desc: '近身范围爆·震开贴身敌群（AoE）', pattern: 'nova', dmg: 8, cd: 90, projSpeed: 0, life: 8, radius: 120, amount: 1, weight: 8, maxLevel: 5, tint: 0x7fd0ff, skin: '103/proj-shock' },
  { key: 'laser', name: '激光', desc: '高速横扫直线·穿透一线敌（远程）', pattern: 'beam', dmg: 6, cd: 110, projSpeed: 16, life: 26, radius: 8, amount: 1, weight: 7, maxLevel: 5, tint: 0xff5a4a, skin: '103/proj-laser' },
  { key: 'boom', name: '回旋镖', desc: '飞出穿透一线敌（远程·回旋段待 capgap）', pattern: 'boomerang', dmg: 5, cd: 96, projSpeed: 7, life: 120, radius: 7, amount: 1, weight: 7, maxLevel: 5, tint: 0xffd23f, skin: '103/proj-boom' },
  { key: 'orbit', name: '护盾环', desc: '召唤环绕光球·持续灼烧贴身敌（近战）', pattern: 'orbit', dmg: 0.5, cd: 0, projSpeed: 0.045, life: 0, radius: 74, amount: 3, weight: 8, maxLevel: 3, tint: 0x7dff4d, skin: '103/proj-orbit', evo: { to: 'orbitevo', req: 'blade' } },
  { key: 'pet', name: '宠物随从', desc: '召唤随从·跟随并自动索敌开火（随从）', pattern: 'pet', dmg: 9, cd: 70, projSpeed: 7, life: 80, radius: 5, amount: 1, weight: 6, maxLevel: 3, tint: 0xc9a3ff, skin: '103/proj-pet' },
  // ── 进化体（weight 0·不进 draft 池·由进化机制生成）──
  { key: 'orbitevo', name: '无限回环', desc: '常驻 5 枚光球·大环·灼烧翻倍（进化）', pattern: 'orbit', dmg: 1.1, cd: 0, projSpeed: 0.06, life: 0, radius: 96, amount: 5, weight: 0, maxLevel: 1, tint: 0x54e08a, skin: '103/proj-orbit' },
];
export const KUNAI = WEAPONS[0]; // 起始武器（内置武器挂点）
export const WEAPON_BY_KEY: Record<string, WeaponDef> = Object.fromEntries(WEAPONS.map((w) => [w.key, w]));

// ── 子弹序列帧皮肤（DCSS FreeArtLib 动画帧·vendored+packed·public/games/game-103/art/fx/*.png）──
// 每张 = 单行横条精灵表(32×frames · 32)；引擎 t2-anim-state 按 fps 推 Frame.index 循环播放（能量弹动起来）。
// 列了的武器/敌用动画帧盖过静态 skin；没列的保持原静态皮肤。
export interface FxAnim { sheet: string; frames: number; fps: number }
export const FX_SHEETS = {
  magic_dart:    { sheet: '103/fx-magic_dart', frames: 6, fps: 3 },   // 紫能量镖
  searing_ray:   { sheet: '103/fx-searing_ray', frames: 6, fps: 3 },  // 红灼热星
  flame:         { sheet: '103/fx-flame', frames: 3, fps: 4 },        // 火焰爆
  sting:         { sheet: '103/fx-sting', frames: 3, fps: 4 },        // 绿环
  sandblast:     { sheet: '103/fx-sandblast', frames: 3, fps: 4 },    // 黄沙爆
  gold_sparkles: { sheet: '103/fx-gold_sparkles', frames: 3, fps: 4 },// 金光
} as const;
// 武器 key → 子弹动画帧（配色区分：玩家多紫/绿/金/红·敌弹另用色以辨敌我）。
export const WEAPON_ANIM: Record<string, FxAnim> = {
  kunai: FX_SHEETS.magic_dart,   // 直线飞镖=紫能量镖
  shock: FX_SHEETS.flame,        // 近身 nova=火焰爆
  laser: FX_SHEETS.searing_ray,  // 激光=红灼热星
  boom:  FX_SHEETS.gold_sparkles,// 回旋镖=金光旋
  orbit: FX_SHEETS.sting,        // 护盾环=绿环（贴合环绕）
  orbitevo: FX_SHEETS.sting,     // 进化环=绿环
  pet:   FX_SHEETS.magic_dart,   // 随从弹=紫能量镖
};
// 敌 key → 敌弹动画帧（用黄/红=敌意色·和玩家紫绿分开）。
export const EBOLT_ANIM: Record<string, FxAnim> = {
  archer: FX_SHEETS.sandblast,   // 射手弹=黄沙爆
  boss:   FX_SHEETS.searing_ray, // 首领弹=红灼热星（大威胁）
};
// 每把武器一个 Tag 位（进化 destroy-tagged 按位删基础武器挂点）。位 5 起（0-4=ZONE/PLAYER/ENEMY/COLLECTOR/KILLBOX）。
export const WEAPON_BIT: Record<string, number> = Object.fromEntries(WEAPONS.map((w, i) => [w.key, 1 << (5 + i)]));

// ── 敌人定义（M1 单型=蹒跚者 E1·gdd §六）───────────────────────────────────
export interface EnemyDef {
  key: string;
  name: string;
  hp: number;
  speed: number;    // px/tick（steering 写 Velocity 模长）
  radius: number;
  contact: number;  // 接触伤害 / tick（连续接触 DPS·iframe=S7 打磨项）
  // BUG-02① PE 缓解：steering stopRange=贴身距离 → 敌到此距离即停 = 环绕玩家成圈，而非全挤到玩家那一点。
  // 真·群体分离(boid separation·敌间互斥)=引擎缺口·Lead 域 REQ-SURVIVOR群体；此为纯数据缓解（用现成 steering 字段）。
  // 取 ≈ 玩家半径+敌半径-小重叠 → 停在玩家表面外圈但接触区(radius)仍与玩家 Shape 相交=接触伤害照常。
  stopRange: number;
  tint: number;
  inTint: number;
  gem: string;      // 死亡掉落宝石类型（gem key）
  skin: string;
  // 远程攻击（gdd §六 E7·可选）：周期朝玩家射弹（Timer+SelfRule spawn ebolt·Launch toward:PLAYER）。
  // 「打你但打不远」=stopRange 大保持中距 kiting + bolt 寿命限射程（projSpeed×life≈射程）→ 玩家又紧张又能走位躲。
  ranged?: { cd: number; dmg: number; projSpeed: number; life: number; radius: number };
}
export const SHAMBLER: EnemyDef = {
  key: 'shambler', name: '蹒跚者', hp: 28, speed: 1.0, radius: 11, contact: 0.3, stopRange: 18,
  tint: TINT.enemyShambler, inTint: TINT.enemyShamblerIn, gem: 'blue', skin: '103/enemy-shambler',
};
// 难度分层（gdd §六·越晚出现越硬·让"一发打不死"成立）。runner=快脆·brute=慢肉（多发才死·血条看得见）。
export const RUNNER: EnemyDef = {
  key: 'runner', name: '疾行者', hp: 42, speed: 1.9, radius: 9, contact: 0.3, stopRange: 15,
  tint: 0xff9a1f, inTint: 0xffd6a0, gem: 'blue', skin: '103/enemy-runner',
};
export const BRUTE: EnemyDef = {
  key: 'brute', name: '胖子', hp: 220, speed: 0.62, radius: 18, contact: 0.9, stopRange: 26,
  tint: 0xc9a3ff, inTint: 0xe6ccff, gem: 'green', skin: '103/enemy-brute',
};
// E7 远程射手（gdd §六·M3 融合·打破"纯近战被追"）：保持中距(stopRange 200)、周期朝玩家射弹。
// 「打不了太远」= bolt 射程 ≈ projSpeed 4.2 × life 78 ≈ 330px，且 stopRange 200 保持中距（不跨屏狙）。子弹调大更清晰。
export const ARCHER: EnemyDef = {
  key: 'archer', name: '远程射手', hp: 60, speed: 1.15, radius: 10, contact: 0.2, stopRange: 200,
  tint: 0xb07bff, inTint: 0xe6ccff, gem: 'blue', skin: '103/enemy-archer',
  ranged: { cd: 84, dmg: 10, projSpeed: 4.2, life: 78, radius: 10 },
};
// 精英·狙击手（攻击性高的远程威胁·中期加入）：血厚、射得勤且狠、弹更大更快=真威胁（owner「攻击性高的敌人也要会远程」）。
export const SNIPER: EnemyDef = {
  key: 'sniper', name: '精英狙击', hp: 150, speed: 1.0, radius: 13, contact: 0.4, stopRange: 240,
  tint: 0x4de0ff, inTint: 0xd0f6ff, gem: 'green', skin: '103/enemy-archer',
  ranged: { cd: 60, dmg: 16, projSpeed: 5, life: 96, radius: 13 },
};
// 精英·重装（大肉·撞脸重伤·后期挤压空间）：血条超长、慢但压迫（升到高级也不速通）。
export const BRUISER: EnemyDef = {
  key: 'bruiser', name: '精英重装', hp: 620, speed: 0.7, radius: 24, contact: 1.6, stopRange: 30,
  tint: 0xa855ff, inTint: 0xe6ccff, gem: 'green', skin: '103/enemy-brute',
};
// Boss（周期出现的大首领·gdd §六）：巨血巨体·撞脸重伤 + 周期弹幕（远程威胁·让 Boss 战不是站桩）。
export const BOSS: EnemyDef = {
  key: 'boss', name: '首领', hp: 3200, speed: 0.52, radius: 36, contact: 2.0, stopRange: 60,
  tint: 0xff4d5e, inTint: 0xffd23f, gem: 'gold', skin: '103/enemy-boss',
  ranged: { cd: 54, dmg: 18, projSpeed: 3.8, life: 140, radius: 16 },
};
export const ENEMIES: EnemyDef[] = [SHAMBLER, RUNNER, BRUTE, ARCHER, SNIPER, BRUISER, BOSS];
export const EBOLT_SKIN = '103/enemy-bolt'; // 敌弹皮肤槽

// ── 宝石定义（gdd §七·蓝=1·绿=3 经验·肉敌掉更多）─────────────────────────
export interface GemDef { key: string; value: number; radius: number; tint: number; skin: string }
// 三档经验宝石·大小随价值递增（v3 修「掉的经验都一样大小」）：蓝(小)→绿(中)→金(大)。
export const GEM_BLUE: GemDef = { key: 'blue', value: 2, radius: 6, tint: TINT.gemBlue, skin: '103/gem-blue' };
export const GEM_GREEN: GemDef = { key: 'green', value: 8, radius: 10, tint: 0x7dff4d, skin: '103/gem-green' };
export const GEM_GOLD: GemDef = { key: 'gold', value: 30, radius: 15, tint: 0xffd23f, skin: '103/gem-gold' };
export const GEMS: GemDef[] = [GEM_BLUE, GEM_GREEN, GEM_GOLD];
export const GEM_LIFE = 1800; // 未拾取宝石寿命 tick（30s）

// ── 升级三选一 + 真经验曲线（v3 修·阈值随级递增·EventWhen vsResource 动态阈值）────
// 经验(xp)≥当前阈值(nextxp)→ 等级 +1 + xp 归零 + nextxp += XP_STEP（曲线爬升）→ 时停三选一 draft。
// expToNext(level) ≈ XP_BASE + level×XP_STEP（前期快·后期慢·雪球但不速通到顶就没事干）。
export const LEVEL_XP = 6;        // 兼容旧引用（=XP_BASE）
export const XP_BASE = 6;         // 首级阈值
export const XP_STEP = 6;         // 每级阈值增量（Lv1→6, Lv2→12, Lv3→18…真曲线·非扁平速升）

// 被动册（gdd §五·modifier 类·选中即数值加成）。
//  power=全局伤害系数+（Effect 直改 power 资源）/ heal=即时回血（Effect 改 hp）/
//  stat=属性轴（选中 +1 该被动的 lvl 资源 → modifier-stack 聚合 → t2-stat-bind 投影到具体组件字段）。
//  stat 类的 stat 字段=modifier target key（moveSpeed/attackSpeed/pickup/maxHp），value=每层贡献量。
export interface PassiveDef {
  key: string; name: string; desc: string;
  kind: 'power' | 'heal' | 'stat';
  value: number;
  stat?: string;   // kind:'stat' 时=modifier target key（对应 StatBind 投影）
  weight: number; maxLevel: number;
}
export const PASSIVES: PassiveDef[] = [
  { key: 'blade', name: '锋刃手册', desc: '全武器伤害 +20%', kind: 'power', value: 0.2, weight: 10, maxLevel: 5 },
  { key: 'crit', name: '暴击核心', desc: '全武器伤害 +35%（稀有）', kind: 'power', value: 0.35, weight: 5, maxLevel: 5 },
  { key: 'heart', name: '生命护心', desc: '立即回复 30 生命', kind: 'heal', value: 30, weight: 9, maxLevel: 9 },
  { key: 'vigor', name: '疾行护符', desc: '立即回复 15 生命', kind: 'heal', value: 15, weight: 9, maxLevel: 9 },
  // ── 属性轴被动（REQ-SURVIVOR被动轴·stat-bind 已下沉）→ build 多样性核心（gdd §五）──
  { key: 'swift', name: '疾风之靴', desc: '移动速度 +10%/层', kind: 'stat', stat: 'moveSpeed', value: 0.10, weight: 8, maxLevel: 5 },
  { key: 'magnet', name: '磁力护符', desc: '拾取范围 +30%/层', kind: 'stat', stat: 'pickup', value: 0.30, weight: 7, maxLevel: 5 },
  { key: 'fort', name: '铁壁体魄', desc: '最大生命 +12%/层', kind: 'stat', stat: 'maxHp', value: 0.12, weight: 7, maxLevel: 5 },
  // 注：攻速轴（attackSpeed→Timer.duration）暂缓——本游戏开火 = SelfRule 静态阈值(cd-1) fires·
  //     缩短 duration 会低于阈值致哑火；需 rate-friendly 开火原语或 when.value 可绑（引擎缺口·已记 requests）。
  // 常驻小强化（maxLevel 极大=永不满级）→ draft 池永不清空、升满级不断档（v3 修「升到10级没事干」）。
  { key: 'might', name: '力量精粹', desc: '全武器伤害 +8%（可叠）', kind: 'power', value: 0.08, weight: 6, maxLevel: 999 },
];
// 属性轴被动（供 blueprint 建 lvl 资源 + ModifierSource + StatBind 投影）。
export const STAT_PASSIVES = PASSIVES.filter((p) => p.kind === 'stat');

// 统一 draft 候选：武器（起始 Kunai 除外·slot=weapon·accent=红）+ 被动（slot=passive·accent=蓝）。
// effectSignal='pick_'+key → 宿主选中入队 → KeyBinding→（武器:Caster spawn 挂点 / 被动:Effect 改资源）。
export interface UpgradeDef {
  id: string; name: string; desc: string;
  slot: 'weapon' | 'passive';
  weight: number; maxLevel: number;
  effectSignal: string;
  accent: 'active' | 'passive';
}
export const DRAFT_POOL: UpgradeDef[] = [
  ...WEAPONS.filter((w) => w.key !== 'kunai').map((w): UpgradeDef => ({
    id: w.key, name: w.name, desc: w.desc, slot: 'weapon', weight: w.weight, maxLevel: w.maxLevel, effectSignal: `pick_${w.key}`, accent: 'active',
  })),
  ...PASSIVES.map((p): UpgradeDef => ({
    id: p.key, name: p.name, desc: p.desc, slot: 'passive', weight: p.weight, maxLevel: p.maxLevel, effectSignal: `pick_${p.key}`, accent: 'passive',
  })),
];
export const DRAFT_N = 3;                 // 三选一
export const SLOT_CAP = { weapon: 6, passive: 6 } as const; // 槽位上限（gdd §三）
export const PASSIVE_BY_KEY: Record<string, PassiveDef> = Object.fromEntries(PASSIVES.map((p) => [p.key, p]));

// ── 单敌群 spawn 时间表（授权期纯数据·无 Math.random·环绕出生）────────────
// M1「单敌群」：玩家四周确定性环上逐个刷怪，做出 Survivor.io「一睁眼就被围住 + 持续加压」的张力。
// 开局爆一圈(instant horde) + 之后半径带上稳定流。**非 E3 波次 rate/cap director**（那需 Lead 签 S2·E3）——
// 这里只是一张更长更密的授权期常量表，无运行时限速/同屏上限逻辑。
// 开局包围圈（一次性·环绕玩家出生点·"开屏即被围"）。
export interface SpawnRow { at: number; x: number; y: number; key: string }
export const SPAWNS: SpawnRow[] = (() => {
  const rows: SpawnRow[] = [];
  const RING0 = 12;
  for (let i = 0; i < RING0; i++) {
    const a = (Math.PI * 2 * i) / RING0;
    // 错峰起始（at 30 + i×5 tick）：开局 12 只不再同一帧齐生（一帧实例化 12×4 实体=瞬时尖峰=早期卡顿）→ 摊到 ~1s 平滑生出。
    rows.push({ at: 30 + i * 5, x: Math.round(START.x + Math.cos(a) * 320), y: Math.round(START.y + Math.sin(a) * 320), key: SHAMBLER.key });
  }
  return rows;
})();

// ── 无限流刷怪（BUG v2③修·跟随玩家的环形 spawner·Timer loop·永不停=无限）──────
// N 个 spawner=玩家的 Hierarchy child（散在出生环上·随玩家移动）；各 Timer(period,loop)+SelfRule 到点 spawn 敌 at:self。
// 难度递增：分层 spawner 用 SelfRule.whenGlobal(clock>=门) 时间门——越晚，疾行者/胖子才加入（一发打不死）。
// 全授权期纯数据（Timer+SelfRule+whenGlobal 现成能力）·非 E3 rate-cap director（那是同屏上限自适应·仍 Lead 域）。
// capBypass=true → 该层刷怪**不受同屏 cap 门**（boss/精英必现·否则弱敌占满 cap 导致 boss 永不刷·owner「全程没见过 boss」根因）。
export interface SpawnerTier { key: string; count: number; period: number; afterSec: number; capBypass?: boolean }
export const SPAWNER_RING = 360; // spawner 环半径（玩家周围·视口外缘）
export const SPAWN_CAP = 46;     // 同屏杂兵上限（大幅下调·难度改走 HP 分层非堆数量·且 overlap-detect 宽相位∝实体²→少实体=不卡·owner M5 都卡=680实体/2800 overlap/60ms一帧）
export const SPAWNER_TIERS: SpawnerTier[] = [
  // ── 杂兵流（受 cap 钳·horde 底噪·别太多免糊屏）──
  { key: 'shambler', count: 10, period: 46, afterSec: 0 },  // 常驻弱敌（略降杂兵·给精英腾同屏空间·owner「小怪太多」）
  { key: 'runner', count: 4, period: 90, afterSec: 20 },   // 20s 疾行者（快脆·施压走位）
  { key: 'shambler', count: 5, period: 54, afterSec: 90 }, // 90s 再叠一条蹒跚（中期加压）
  // ── 威胁/精英流（capBypass·必现·真难度来源·owner「攻击性高的敌人/远程/boss」）──
  { key: 'archer', count: 3, period: 150, afterSec: 30, capBypass: true },  // 30s 远程射手（中距弹幕·清晰大弹）
  { key: 'brute', count: 2, period: 165, afterSec: 45, capBypass: true },   // 45s 胖子（肉·血条看得见）
  { key: 'sniper', count: 2, period: 210, afterSec: 80, capBypass: true },  // 80s 精英狙击（攻击性高·射得勤且狠）
  { key: 'bruiser', count: 1, period: 260, afterSec: 120, capBypass: true },// 120s 精英重装（大肉·压空间·后期不速通）
  { key: 'boss', count: 1, period: 60 * 70, afterSec: 60, capBypass: true },// 60s 起每 ~70s 一个首领（必现·无视 cap）
];

// ── 皮肤槽 key（美术就绪即换装·未就绪回退 Shape 色块·art-pipeline 红线）────────
export const SKIN = {
  player: PLAYER_DEF.skin,
  enemyShambler: SHAMBLER.skin,
  projKunai: KUNAI.skin,
  gemBlue: GEM_BLUE.skin,
} as const;

// ── HUD 主题（UITheme·bright chunky cartoon·对齐 survivor-io-ui-kit 设计令牌）──
// 令牌照 survivor-io-ui-kit-handoff.md：gold #ffd23f/#f5a623·slate #5c6672/#39424d·
// hp-red #f0473a·xp-orange #ff9a1f·xp-green #7dff4d·accent-active #e0402e·accent-passive #2f9fe0。
export const SURVIVOR_THEME: UITheme = {
  bg0: '#14161b', bg1: '#2a2e35', bg2: '#3a3f48', bg3: '#47535f', pageBg: '#1e2127',
  line: 'rgba(255,255,255,0.14)',
  text: '#ffffff', sub: '#c7d0da', dim: '#8b93a1',
  jade: '#2f9fe0', jadeWash: 'rgba(47,159,224,0.16)', jadeLine: 'rgba(47,159,224,0.5)', // jade 槽=蓝 accent-passive
  gold: '#ffd23f',
  ok: '#7dff4d', okWash: 'rgba(125,255,77,0.16)', warn: '#ff9a1f', warnWash: 'rgba(255,154,31,0.16)',
  danger: '#e0402e',
  ink: '#12141a',
  fontUi: "'Baloo 2',-apple-system,'Segoe UI',Roboto,'PingFang SC','Microsoft YaHei',sans-serif",
  fontMono: "ui-monospace,'SFMono-Regular',Menlo,monospace",
};
