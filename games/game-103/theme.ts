// game-103《幸存者核心原型》—— 视觉/数值常量 + 数据表（纯数据·零逻辑）。
// 参照 Survivor.io / Vampire Survivors 的俯视割草单局。M1 灰盒：走位 + 单武器自动开火 + 单敌群 +
// 经验拾取/等级 + 接触伤害/死亡 + 边界 + 相机跟随 + 胜负。升级=固定强化占位（三选一 draft 待 Lead 签 S2·E1）。
//
// 设计真相：docs/design/game-103/gdd.md · balance-design.md · ui-scene-design.md（+4 张 .dc.html）。
// 能力归属：docs/design/game-103/capability-plan.md。数据全摆成表，由现成引擎能力解释（见 blueprint.ts 头注）。
import type { UITheme } from '@zerocraft/engine/ui/components/index.js';
import { ZONE_FLAG } from '@zerocraft/engine/skills/tier2/index.js';

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

// ── 碰撞层（Shape.category/mask·独立于 Tag·REQ-OVERLAP-LAYER 已下沉）───────────────
// overlap-detect 只在「互相 mask 命中」的层间配对（(catA&maskB)&&(catB&maskA)）→ ① 敌↔敌不配对=省 churn/perf
// ② 玩家穿过敌群(不配对)但撞障碍(配对) ③ 飞行敌不含 OBSTACLE 位=穿墙。缺省不设=全配对(零回归)。
export const CL = {
  PLAYER: 1 << 0, ENEMY: 1 << 1, BULLET: 1 << 2, EBOLT: 1 << 3, TOUCH: 1 << 4,
  GEM: 1 << 5, COLLECTOR: 1 << 6, KILLBOX: 1 << 7, OBSTACLE: 1 << 8,
} as const;

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
  moveSpeed: 2.7,        // px/tick（3→2.7 收紧·让追猎者(2.8)能咬住·反「移速远大于怪·无脑绕圈」·配障碍/远程/成群=真张力）
  radius: 13,
  pickupRadius: 62,      // 收取真空区半径（贴身走过即吃·磁石被动 stat-bind 放大它=更强吸力）。飞入动画待引擎空间索引后复接。
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
  | 'bomb'       // 抛掷炸弹（飞向落点·寿命末 SelfRule spawn 爆炸 nova·大范围 AoE）
  | 'homing'     // 追踪弹（Perception+Steering 锁敌·穿透·进化体质变）
  | 'trail';     // 移动尾迹（跟随玩家的发射器按 cd 在当前位置落静态灼烧段·走位画出伤害尾迹·movement=weapon）
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
  // 升级半径调制（owner「冲击波升级范围越来越大」·数据配方·零引擎活）：拿一层 +radiusPerLevel×base 半径。
  // 管线=pick +1 lvl_<key> → ModifierSource(<key>Radius=1+scale×层) → nova proj StatBind 投影 Shape.radius。
  radiusPerLevel?: number;
}
export const WEAPONS: WeaponDef[] = [
  { key: 'kunai', name: '飞镖 Kunai', desc: '直线飞镖·穿透索敌（起始武器·mow 一线）', pattern: 'straight', dmg: 7, cd: 34, projSpeed: 9, life: 90, radius: 7, amount: 1, weight: 0, maxLevel: 5, tint: 0xffffff, skin: '103/proj-kunai', pierce: true },
  { key: 'shock', name: '冲击波', desc: '近身范围爆·震开贴身敌群（AoE·升级范围越来越大）', pattern: 'nova', dmg: 8, cd: 90, projSpeed: 0, life: 8, radius: 120, amount: 1, weight: 8, maxLevel: 5, tint: 0x7fd0ff, skin: '103/proj-shock', radiusPerLevel: 0.22 },
  { key: 'laser', name: '激光', desc: '巨长激光·瞬穿一线敌（远程·贯穿）', pattern: 'beam', dmg: 6, cd: 110, projSpeed: 26, life: 16, radius: 13, amount: 1, weight: 7, maxLevel: 5, tint: 0xff5a4a, skin: '103/proj-laser' },
  { key: 'boom', name: '回旋镖', desc: '飞出穿透一线敌（远程·回旋段待 capgap）', pattern: 'boomerang', dmg: 5, cd: 96, projSpeed: 7, life: 120, radius: 7, amount: 1, weight: 7, maxLevel: 5, tint: 0xffd23f, skin: '103/proj-boom' },
  { key: 'orbit', name: '护盾环', desc: '召唤环绕光球·持续灼烧贴身敌（近战）', pattern: 'orbit', dmg: 0.5, cd: 0, projSpeed: 0.045, life: 0, radius: 74, amount: 3, weight: 8, maxLevel: 3, tint: 0x7dff4d, skin: '103/proj-orbit', evo: { to: 'orbitevo', req: 'blade' } },
  { key: 'pet', name: '宠物随从', desc: '召唤随从·跟随并自动索敌开火（随从）', pattern: 'pet', dmg: 9, cd: 70, projSpeed: 7, life: 80, radius: 5, amount: 1, weight: 6, maxLevel: 3, tint: 0xc9a3ff, skin: '103/proj-pet' },
  // 炸弹：抛向敌·飞行 life=45 tick 后落点爆炸 nova（radius=爆炸半径·dmg=爆炸伤害/tick·大范围清群）。
  { key: 'bomb', name: '炸弹', desc: '抛掷炸弹·落点大爆炸·范围炸伤（AoE 清群）', pattern: 'bomb', dmg: 16, cd: 128, projSpeed: 6, life: 45, radius: 104, amount: 1, weight: 7, maxLevel: 5, tint: 0xffa53f, skin: '103/proj-bomb' },
  // 追踪导弹（homing·Perception+Steering 锁最近敌·慢速但拐弯咬人·单发高伤）。升级=多一枚（挂点重复=更多导弹）。
  { key: 'missile', name: '追踪导弹', desc: '锁定最近敌·拐弯追击·单发高伤（慢速追踪）', pattern: 'homing', dmg: 24, cd: 104, projSpeed: 3.2, life: 130, radius: 7, amount: 1, weight: 7, maxLevel: 5, tint: 0xff8fe0, skin: '103/proj-missile' },
  // 移动尾迹刃（微创新·movement=weapon）：跟随发射器每 cd 在玩家当前位置落一段静态灼烧圈·寿命内 per-tick 穿透伤·渐隐。
  // 走位越多=尾迹越长=杀得越多；站定=原地烧一摊。cd 小=尾迹密·life 长=尾巴长。
  { key: 'trail', name: '尾迹刃', desc: '移动时身后拖出灼烧尾迹·走位即是刀（画圈套敌）', pattern: 'trail', dmg: 3, cd: 5, projSpeed: 0, life: 42, radius: 15, amount: 1, weight: 8, maxLevel: 5, tint: 0x00e5ff, skin: '103/proj-trail' },
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
  // shock(冲击波 nova) 不用 fx 帧：32px 团帧撑不满 120 半径爆炸圈=看不见→改画大爆炸圈本体+渐隐闪（见 blueprint nova 分支）。
  // laser 不用 fx 动画帧 → 画**箭形多边形** Shape 本体=有头箭激光（细尾→宽箭头·FaceRotate 随开火方向整体转向）。
  //   scaleX 0→1 沿箭身射出显形，避开生成帧水平闪（见 blueprint beam 分支）。
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
  flying?: boolean; // 飞行敌（幽灵/龙）：碰撞不含 OBSTACLE 层→穿墙飘过；地面敌绕障碍。
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
  tint: 0xff9a1f, inTint: 0xffd6a0, gem: 'blue', skin: '103/enemy-runner', flying: true,
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
// 追猎者（反 kiting·owner「移速远大于怪·无脑绕圈无趣」）：**几乎和玩家同速**(2.8 vs 3)的地面快敌·贴身缠斗·
// 逼你不能慢慢绕——必须用武器清、用障碍甩、用走位躲，而非无脑跑。中期成群加入=真张力。
export const STALKER: EnemyDef = {
  key: 'stalker', name: '追猎者', hp: 58, speed: 2.8, radius: 10, contact: 0.55, stopRange: 12,
  tint: 0xff5ea8, inTint: 0xffd0e6, gem: 'blue', skin: '103/enemy-shambler',
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
  tint: 0xff4d5e, inTint: 0xffd23f, gem: 'gold', skin: '103/enemy-boss', flying: true,
  ranged: { cd: 54, dmg: 18, projSpeed: 3.8, life: 140, radius: 16 },
};
// ── 时间缩放变体（难度=血量·VS「Curse/HP×Level」精髓·参照 vampire-survivors.wiki）──────
// 割草难度真相（网搜实证·VS）：敌人 HP 在**出生瞬间**按玩家等级/时间乘一个系数并冻结；全局「Curse」
// 随时间涨（+150%@10min）推 hp/速度/密度。引擎当前不支持"出生时按全局值缩放 hp"（stat-bind 只改 max 非 current）
// → 用**时间门分层的更肉变体**离散逼近这条曲线：越晚的怪血越厚（玩家火力涨·敌人也涨=不速通）。
const scaledEnemy = (base: EnemyDef, mult: number, suffix: string): EnemyDef => ({
  ...base,
  key: base.key + suffix,
  name: `${base.name}+`,
  hp: Math.round(base.hp * mult),
  contact: Math.round(base.contact * Math.min(mult, 1.8) * 100) / 100,
  gem: mult >= 4 ? 'gold' : mult >= 2 ? 'green' : base.gem,
  ...(base.ranged ? { ranged: { ...base.ranged, dmg: Math.round(base.ranged.dmg * Math.min(mult, 1.8)) } } : {}),
});
// 蹒跚者三档血量升级（中/后期换血更厚的同型·血条肉眼可见变长）。
export const SHAMBLER_T2 = scaledEnemy(SHAMBLER, 2.6, '_t2'); // hp≈73
export const SHAMBLER_T3 = scaledEnemy(SHAMBLER, 5.5, '_t3'); // hp≈154
export const RUNNER_T2 = scaledEnemy(RUNNER, 3.0, '_t2');     // hp≈126
export const BRUTE_T2 = scaledEnemy(BRUTE, 2.4, '_t2');       // hp≈528
export const ARCHER_T2 = scaledEnemy(ARCHER, 3.2, '_t2');     // hp≈192·弹更狠
export const STALKER_T2 = scaledEnemy(STALKER, 3.0, '_t2');   // hp≈174·后期快敌换厚血

export const ENEMIES: EnemyDef[] = [
  SHAMBLER, RUNNER, BRUTE, ARCHER, STALKER, SNIPER, BRUISER, BOSS,
  SHAMBLER_T2, SHAMBLER_T3, RUNNER_T2, BRUTE_T2, ARCHER_T2, STALKER_T2, // 时间缩放变体（难度=血量）
];
export const EBOLT_SKIN = '103/enemy-bolt'; // 敌弹皮肤槽

// ── 宝石定义（gdd §七·蓝=1·绿=3 经验·肉敌掉更多）─────────────────────────
export interface GemDef { key: string; value: number; radius: number; tint: number; skin: string }
// 三档经验宝石·大小随价值递增（v3 修「掉的经验都一样大小」）：蓝(小)→绿(中)→金(大)。
// 大小与经验数量成正比（owner「很小的经验应更小」）：蓝(2)→小·绿(8)→中·金(30)→大。
export const GEM_BLUE: GemDef = { key: 'blue', value: 2, radius: 5, tint: TINT.gemBlue, skin: '103/gem-blue' };
export const GEM_GREEN: GemDef = { key: 'green', value: 8, radius: 9, tint: 0x7dff4d, skin: '103/gem-green' };
export const GEM_GOLD: GemDef = { key: 'gold', value: 30, radius: 16, tint: 0xffd23f, skin: '103/gem-gold' };
export const GEMS: GemDef[] = [GEM_BLUE, GEM_GREEN, GEM_GOLD];
export const GEM_LIFE = 2700;      // 未拾取宝石寿命 tick（45s·比原 30s 长·但不永久=不能一直等你回来捡）
export const GEM_BLINK_FROM = 900; // 最后 900 tick(15s) 起渐隐闪烁警告（Tween Color.alpha easeIn·消失前提示）

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
  icon: string; // 三选一卡图标 emoji（owner「纯色块换成有意义的图」·按武器/被动语义）
}
// 升级卡图标集（emoji·同敌人 twemoji 图形语言）：武器按射法/形态、被动按效果轴——一眼认出这张卡是什么。
export const DRAFT_ICON: Record<string, string> = {
  // 武器
  kunai: '🔪', shock: '💥', laser: '⚡', boom: '🪃', orbit: '💫', pet: '🐺', bomb: '💣', missile: '🚀', orbitevo: '🌀', trail: '🐍',
  // 被动
  blade: '🗡️', crit: '🎯', heart: '❤️', vigor: '💗', swift: '👟', magnet: '🧲', fort: '🛡️', might: '💪',
};
export const DRAFT_POOL: UpgradeDef[] = [
  ...WEAPONS.filter((w) => w.key !== 'kunai').map((w): UpgradeDef => ({
    id: w.key, name: w.name, desc: w.desc, slot: 'weapon', weight: w.weight, maxLevel: w.maxLevel, effectSignal: `pick_${w.key}`, accent: 'active', icon: DRAFT_ICON[w.key] ?? '⭐',
  })),
  ...PASSIVES.map((p): UpgradeDef => ({
    id: p.key, name: p.name, desc: p.desc, slot: 'passive', weight: p.weight, maxLevel: p.maxLevel, effectSignal: `pick_${p.key}`, accent: 'passive', icon: DRAFT_ICON[p.key] ?? '⭐',
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
// ── 场地障碍物（少量·gdd §六 地形战术·owner「加几个简单阻挡」）──────────────────
// 静态碰撞体（无 Velocity=collision-resolve 视为不可动·把动态体推出）。玩家/地面敌撞它绕行·飞行敌穿过。
// 也是反 kiting 工具：开阔场无脑绕圈=无趣，障碍逼你走位/卡位/被逼墙角=真张力（owner「乐趣不在数量」）。
export interface ObstacleDef { x: number; y: number; radius: number }
export const OBSTACLES: ObstacleDef[] = [
  { x: START.x + 280, y: START.y - 180, radius: 52 },
  { x: START.x - 320, y: START.y + 140, radius: 60 },
  { x: START.x + 120, y: START.y + 380, radius: 46 },
  { x: START.x - 220, y: START.y - 360, radius: 54 },
  { x: START.x + 460, y: START.y + 280, radius: 64 },
  { x: START.x - 480, y: START.y - 140, radius: 48 },
];

export interface SpawnRow { at: number; x: number; y: number; key: string }
export const SPAWNS: SpawnRow[] = (() => {
  const rows: SpawnRow[] = [];
  const RING0 = 5;
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
export const SPAWN_CAP = 140;    // 同屏杂兵上限（空间索引下沉后 645实体仍 13ms/60fps→可放大 horde·精英/Boss 另 capBypass·真机可再上探）
// 慢起步·梯度递增（owner「一开始不该这么多·慢慢来」+ VS 精髓：密度/血量随时间涨=难度曲线）。
// 前 30s 稀疏弱敌（学操作）→ 每 30-60s 加一层（更多/更快/更肉/远程/精英）→ 后期同型换更厚血变体（难度=血量）。
export const SPAWNER_TIERS: SpawnerTier[] = [
  // ── 阶段①（0-60s·稀疏·学操作·别糊屏）──
  { key: 'shambler', count: 3, period: 96, afterSec: 0 },   // 开局很少·慢慢来
  { key: 'runner', count: 2, period: 150, afterSec: 30 },   // 30s 疾行者点缀
  // ── 阶段②（60-150s·成群 + 首批威胁）──
  { key: 'shambler', count: 5, period: 66, afterSec: 60 },  // 60s 密度上来=真 horde
  { key: 'archer', count: 2, period: 168, afterSec: 60, capBypass: true },  // 60s 远程射手（中距弹幕）
  { key: 'brute', count: 2, period: 190, afterSec: 90, capBypass: true },   // 90s 胖子（肉·血条看得见）
  { key: 'runner', count: 4, period: 96, afterSec: 120 },   // 120s 疾行者加压
  { key: 'stalker', count: 3, period: 120, afterSec: 100, capBypass: true }, // 100s 追猎者(几乎同速)=反 kiting 核心威胁
  // ── 阶段③（150-300s·血量升级 + 精英·难度=血量）──
  { key: 'shambler_t2', count: 5, period: 60, afterSec: 150 }, // 150s 蹒跚换更厚血
  { key: 'stalker', count: 3, period: 96, afterSec: 200, capBypass: true }, // 200s 追猎者加压
  { key: 'sniper', count: 2, period: 200, afterSec: 180, capBypass: true },  // 180s 精英狙击（攻击性高）
  { key: 'archer_t2', count: 2, period: 168, afterSec: 210, capBypass: true },// 210s 射手升级
  { key: 'bruiser', count: 1, period: 240, afterSec: 240, capBypass: true }, // 240s 精英重装（大肉压空间）
  // ── 阶段④（300s+·高压·同型再换更厚血）──
  { key: 'shambler_t3', count: 6, period: 54, afterSec: 300 }, // 300s 蹒跚再升血（后期不速通）
  { key: 'brute_t2', count: 2, period: 200, afterSec: 330, capBypass: true },// 330s 胖子升级
  { key: 'runner_t2', count: 4, period: 90, afterSec: 360 },  // 360s 疾行者升血
  // ── 周期 Boss（capBypass 必现·60s 起每 ~80s 一个）──
  { key: 'boss', count: 1, period: 60 * 80, afterSec: 60, capBypass: true },
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
