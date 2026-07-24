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
  pickupRadius: 80,      // 拾取环半径（gdd pickupRadius 80）
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
  | 'pet';       // 宠物随从（跟随玩家的子体·自带 Timer+SelfRule 自动射）
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
  amount: number;    // orbit 光球数 / pet 数 / 多重发（默认 1）
  weight: number;    // draft 加权
  maxLevel: number;
  tint: number;
  skin: string;
}
export const WEAPONS: WeaponDef[] = [
  { key: 'kunai', name: '飞镖 Kunai', desc: '直线飞镖·自动索敌（起始武器）', pattern: 'straight', dmg: 12, cd: 60, projSpeed: 8, life: 90, radius: 5, amount: 1, weight: 0, maxLevel: 5, tint: 0xffffff, skin: '103/proj-kunai' },
  { key: 'shock', name: '冲击波', desc: '近身范围爆·震开贴身敌群（AoE）', pattern: 'nova', dmg: 8, cd: 90, projSpeed: 0, life: 8, radius: 120, amount: 1, weight: 8, maxLevel: 5, tint: 0x7fd0ff, skin: '103/proj-shock' },
  { key: 'laser', name: '激光', desc: '高速横扫直线·穿透一线敌（远程）', pattern: 'beam', dmg: 6, cd: 110, projSpeed: 16, life: 26, radius: 8, amount: 1, weight: 7, maxLevel: 5, tint: 0xff5a4a, skin: '103/proj-laser' },
  { key: 'boom', name: '回旋镖', desc: '飞出穿透一线敌（远程·回旋段待 capgap）', pattern: 'boomerang', dmg: 5, cd: 96, projSpeed: 7, life: 120, radius: 7, amount: 1, weight: 7, maxLevel: 5, tint: 0xffd23f, skin: '103/proj-boom' },
  { key: 'orbit', name: '护盾环', desc: '召唤环绕光球·持续灼烧贴身敌（近战）', pattern: 'orbit', dmg: 0.5, cd: 0, projSpeed: 0.045, life: 0, radius: 74, amount: 3, weight: 8, maxLevel: 3, tint: 0x7dff4d, skin: '103/proj-orbit' },
  { key: 'pet', name: '宠物随从', desc: '召唤随从·跟随并自动索敌开火（随从）', pattern: 'pet', dmg: 9, cd: 70, projSpeed: 7, life: 80, radius: 5, amount: 1, weight: 6, maxLevel: 3, tint: 0xc9a3ff, skin: '103/proj-pet' },
];
export const KUNAI = WEAPONS[0]; // 起始武器（内置武器挂点）
export const WEAPON_BY_KEY: Record<string, WeaponDef> = Object.fromEntries(WEAPONS.map((w) => [w.key, w]));

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
}
export const SHAMBLER: EnemyDef = {
  key: 'shambler', name: '蹒跚者', hp: 20, speed: 1.0, radius: 11, contact: 0.3, stopRange: 18,
  tint: TINT.enemyShambler, inTint: TINT.enemyShamblerIn, gem: 'blue', skin: '103/enemy-shambler',
};
// 难度分层（gdd §六·越晚出现越硬·让"一发打不死"成立）。runner=快脆·brute=慢肉（8 发才死）。
export const RUNNER: EnemyDef = {
  key: 'runner', name: '疾行者', hp: 30, speed: 1.9, radius: 9, contact: 0.25, stopRange: 15,
  tint: 0xff9a1f, inTint: 0xffd6a0, gem: 'blue', skin: '103/enemy-runner',
};
export const BRUTE: EnemyDef = {
  key: 'brute', name: '胖子', hp: 90, speed: 0.62, radius: 18, contact: 0.6, stopRange: 26,
  tint: 0xc9a3ff, inTint: 0xe6ccff, gem: 'green', skin: '103/enemy-brute',
};
// Boss（周期出现的大首领·gdd §六·无限局的 escalation 节点）：巨血巨体·撞脸重伤·掉一堆经验。
export const BOSS: EnemyDef = {
  key: 'boss', name: '首领', hp: 1400, speed: 0.5, radius: 36, contact: 1.2, stopRange: 44,
  tint: 0xff4d5e, inTint: 0xffd23f, gem: 'green', skin: '103/enemy-boss',
};
export const ENEMIES: EnemyDef[] = [SHAMBLER, RUNNER, BRUTE, BOSS];

// ── 宝石定义（gdd §七·蓝=1·绿=3 经验·肉敌掉更多）─────────────────────────
export interface GemDef { key: string; value: number; radius: number; tint: number; skin: string }
export const GEM_BLUE: GemDef = { key: 'blue', value: 1, radius: 6, tint: TINT.gemBlue, skin: '103/gem-blue' };
export const GEM_GREEN: GemDef = { key: 'green', value: 3, radius: 7, tint: 0x7dff4d, skin: '103/gem-green' };
export const GEMS: GemDef[] = [GEM_BLUE, GEM_GREEN];
export const GEM_LIFE = 1800; // 未拾取宝石寿命 tick（30s）

// ── 升级三选一（M2·draft-offer E1 已下沉·Lead 清 S2）────────────────────────
// 经验环满 LEVEL_XP → 等级 +1 + 扣阈值（自动记账）→ 时停三选一 draft（rollOffer 过滤候选 →
// 玩家选 → applyPick + 该项 effectSignal 应用到世界）。子弹伤害 = KUNAI.dmg × 全局 power 资源。
export const LEVEL_XP = 5;        // 升级阈值（M2 占位固定·真曲线 expToNext=5+lvl×10 后续）

// 被动册（gdd §五·modifier 类·选中即数值加成）。
export interface PassiveDef {
  key: string; name: string; desc: string;
  kind: 'power' | 'heal';  // power=全局伤害系数+ / heal=即时回血
  value: number;
  weight: number; maxLevel: number;
}
export const PASSIVES: PassiveDef[] = [
  { key: 'blade', name: '锋刃手册', desc: '全武器伤害 +20%', kind: 'power', value: 0.2, weight: 10, maxLevel: 5 },
  { key: 'crit', name: '暴击核心', desc: '全武器伤害 +35%（稀有）', kind: 'power', value: 0.35, weight: 5, maxLevel: 5 },
  { key: 'heart', name: '生命护心', desc: '立即回复 30 生命', kind: 'heal', value: 30, weight: 9, maxLevel: 9 },
  { key: 'vigor', name: '疾行护符', desc: '立即回复 15 生命', kind: 'heal', value: 15, weight: 9, maxLevel: 9 },
];

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
    rows.push({ at: 30, x: Math.round(START.x + Math.cos(a) * 320), y: Math.round(START.y + Math.sin(a) * 320), key: SHAMBLER.key });
  }
  return rows;
})();

// ── 无限流刷怪（BUG v2③修·跟随玩家的环形 spawner·Timer loop·永不停=无限）──────
// N 个 spawner=玩家的 Hierarchy child（散在出生环上·随玩家移动）；各 Timer(period,loop)+SelfRule 到点 spawn 敌 at:self。
// 难度递增：分层 spawner 用 SelfRule.whenGlobal(clock>=门) 时间门——越晚，疾行者/胖子才加入（一发打不死）。
// 全授权期纯数据（Timer+SelfRule+whenGlobal 现成能力）·非 E3 rate-cap director（那是同屏上限自适应·仍 Lead 域）。
export interface SpawnerTier { key: string; count: number; period: number; afterSec: number } // afterSec=whenGlobal clock 门（秒）
export const SPAWNER_RING = 360; // spawner 环半径（玩家周围·视口外缘）
export const SPAWN_CAP = 48;     // 同屏敌上限（GroupCount 计活敌·满则 spawner 暂停）——无限但有界·防实体爆炸/卡顿
export const SPAWNER_TIERS: SpawnerTier[] = [
  { key: 'shambler', count: 6, period: 78, afterSec: 0 },  // 常驻弱敌流
  { key: 'runner', count: 3, period: 132, afterSec: 25 },  // 25s 后疾行者加入
  { key: 'brute', count: 2, period: 240, afterSec: 55 },   // 55s 后胖子加入（肉·escalation）
  { key: 'boss', count: 1, period: 60 * 90, afterSec: 90 },// 90s 起每 ~90s 一个首领（周期 Boss·无限局节点）
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
