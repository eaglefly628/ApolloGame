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
  tint: number;
  inTint: number;
  gem: 'blue';      // 死亡掉落宝石类型
  skin: string;
}
export const SHAMBLER: EnemyDef = {
  key: 'shambler', name: '蹒跚者', hp: 20, speed: 1.0, radius: 11, contact: 0.3,
  tint: TINT.enemyShambler, inTint: TINT.enemyShamblerIn, gem: 'blue', skin: '103/enemy-shambler',
};

// ── 宝石定义（gdd §七·蓝=1 经验）───────────────────────────────────────────
export interface GemDef { key: string; value: number; radius: number; tint: number; skin: string }
export const GEM_BLUE: GemDef = { key: 'blue', value: 1, radius: 6, tint: TINT.gemBlue, skin: '103/gem-blue' };
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
const GOLDEN = 2.399963; // 黄金角（rad·授权期常量·均匀铺角度·非随机）
export interface SpawnRow { at: number; x: number; y: number; key: string }
export const SPAWNS: SpawnRow[] = (() => {
  const rows: SpawnRow[] = [];
  const put = (at: number, ang: number, r: number): void => {
    rows.push({ at, x: Math.round(START.x + Math.cos(ang) * r), y: Math.round(START.y + Math.sin(ang) * r), key: SHAMBLER.key });
  };
  // ① 开局包围圈：t≈0.5s 一次性铺满 360°（22 只·半径带 260–360）——开屏即被群围。
  const RING0 = 22;
  for (let i = 0; i < RING0; i++) put(30, (Math.PI * 2 * i) / RING0, 260 + (i % 3) * 50);
  // ② 持续加压流：每 ~0.25s 一只，黄金角铺满四周、半径带循环，一直刷到 ~40s（M1 灰盒足够展示雪球）。
  const STREAM = 150;
  for (let i = 0; i < STREAM; i++) put(75 + i * 15, i * GOLDEN, 300 + (i % 5) * 40);
  return rows;
})();

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
