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

// ── 武器定义（M1 首发=飞镖 Kunai·gdd §4.1 / balance §2）──────────────────────
// dmg/cd/projSpeed/life 皆 tick 化；命中由 t2-hitbox 结算·飞行由 t2-launch(toward:target)+t1-motion-apply。
export interface WeaponDef {
  key: string;
  name: string;
  dmg: number;      // 基础伤害（× 全局 power 资源·升级固定强化）
  cd: number;       // 冷却 tick（60=1.0s）
  projSpeed: number;// 子弹初速 px/tick
  life: number;     // 子弹寿命 tick
  radius: number;   // 子弹判定半径
  tint: number;
  skin: string;
}
export const KUNAI: WeaponDef = {
  key: 'kunai', name: '飞镖 Kunai', dmg: 12, cd: 60, projSpeed: 8, life: 90, radius: 5,
  tint: TINT.proj, skin: '103/proj-kunai',
};

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

// ── 升级=固定强化占位（M1·三选一 draft 待 Lead 签 S2·E1）──────────────────
// 每级：经验环满 LEVEL_XP → 扣阈值 + 等级 +1 + 治疗 + 全局 power ×加成（子弹伤害 = dmg × power）。
export const LEVEL_XP = 5;        // 固定升级阈值（M1 占位·真曲线 expToNext=5+lvl×10 待 E1）
export const LEVEL_HEAL = 15;     // 每级固定治疗
export const LEVEL_POWER_ADD = 0.15; // 每级全局伤害系数 +0.15

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

// ── HUD 主题（UITheme·暗色战场·屏内文字恒亮·对齐 .dc.html 令牌）────────────
export const SURVIVOR_THEME: UITheme = {
  bg0: '#04070c', bg1: '#0e1116', bg2: '#161b22', bg3: '#1f2733', pageBg: '#04070c',
  line: 'rgba(120,160,190,0.18)',
  text: '#e6edf3', sub: '#9aa7b4', dim: '#66707c',
  jade: '#2fd6a5', jadeWash: 'rgba(47,214,165,0.12)', jadeLine: 'rgba(47,214,165,0.4)',
  gold: '#ffcf4a',
  ok: '#54e08a', okWash: 'rgba(84,224,138,0.14)', warn: '#f59e0b', warnWash: 'rgba(245,158,11,0.14)',
  danger: '#ff4d5e',
  ink: '#0a0d12',
  fontUi: "-apple-system,'Segoe UI',Roboto,'PingFang SC','Microsoft YaHei',sans-serif",
  fontMono: "ui-monospace,'SFMono-Regular',Menlo,monospace",
};
