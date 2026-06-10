import type { WorldBlueprint, EntityBlueprint } from '../../assembly/demo.assembly.js';
import type { PrefabTemplate } from '@engine/protocol/components.js';
import { overlapDetectCapability } from '@skills/atoms/overlap-detect/index.js';
import { destroyCapability } from '@skills/atoms/destroy/index.js';
import { timerCapability } from '@skills/atoms/timer/index.js';
import { resourceCapability } from '@atom-skills/index.js';
import { lifetimeCapability, hierarchyResolveCapability, hierarchyCascadeCapability } from '@skills/tier1/index.js';
import {
  triggerZoneCapability,
  hitboxCapability,
  overTimeCapability,
  mortalCapability,
  eventWhenCapability,
  effectApplyCapability,
  zoneOccupancyCapability,
  gaugeCapability,
  cameraFollowCapability,
  gridMoveCapability,
  ZONE_FLAG,
} from '@skills/tier2/index.js';
import { prefabCapability, casterCapability, aggroCapability, flowCapability } from '@skills/tier3/index.js';
import { GAME_F_ASSETS, F_HERO, F_FX_STRIKE, F_FX_ARROW, F_FX_BOLT, F_FX_FLAME, F_FX_FROST, F_FX_DRAIN, F_HEX_WARM, F_HEX_COOL } from './assets.js';
import { boardEntities, project, COLS, ROWS, TILE, ORIGIN_X, ORIGIN_Y, LAYOUT } from './hex.js';

// ═══════════════════════════════════════════════════════════════
//  Game F —— 《像素三分天下》自走棋 MVP-0 骨架 + 多回合循环（REQ-F-032）。**纯数据装配**，零自走棋专属代码。
//  整套战斗循环由通用能力涌现（= Game D 暗黑切片的数据，减去玩家操控、加一支镜像敌队）：
//
//    · 索敌走位 = aggro(Perception→Relation target) + steering(seek) + motion-apply   —— ai-chase（数据）
//    · 普攻     = 本地 loop Timer → 自身唯一 EventWhen(timer 叶子,edge) 产唯一信号
//                 → 自身 Caster(at:'target') → prefab 在目标处展开瞬时打击区              —— 自动普攻（数据）
//    · 结算     = overlap-detect → trigger-zone → hitbox(阵营 targetMask 过滤 + 伤害)
//    · 打击自毁 = Timer{id:'life'} → lifetime → destroy（瞬时 burst，无孤儿）
//    · 死亡     = resource-apply → mortal(hp≤0 销毁自己) → destroy
//    · 判胜负   = Zone{requiredTag:TEAM, count:1} 数某队存活 → 写 present Flag（存活=0 → flag false）
//    · 头顶名字 = Text + 队伍色 Color + Hierarchy 跟随单位（红=我方蜀/蓝=敌方魏；势力色留羁绊期，user 定）
//    · 血条蓝条 = gauge(REQ-F-029)：Resource 比例 → 条实体 Shape.width（PostResolve 终态投影，随走随死全自动）
//    · 控制定身 = 八阵图 Hitbox{setMask:FROZEN,statusDuration} + GridMover.haltStatusMask(REQ-F-030)，到点 over-time 自动解
//    · 回合重置 = 持久槽位 Caster{overrides} 每 prep 重展开复合棋子模板（'@local:' 内部引用，REQ-F-033）
//                 + resolution 'wipe' → destroy-tagged 按阵营清场，级联连名牌/条/sidecar（REQ-F-032）
//
//  MVP-0 用一组**互不相同**的英雄、每英雄**唯一** timer/signal id，规避「逻辑链按全局 id 寻址」串台
//  （重复棋子/三星合体 待引擎 REQ-021 self 作用域，主程已落地，下一阶段接）。零自走棋 system。
//  简化（已知，后续）：① 普攻无距离门（condition 无距离叶子）→ 打击在目标处展开，移动仅表现；
//  ② 经济/商店/多回合循环 = MVP-1（被 REQ-F-032 回合重置阻塞，落地后按 flow-spec §6.2 队列接，见 inbox F-7）。
// ═══════════════════════════════════════════════════════════════

// 阵营（Tag.flags）。蜀=TEAM_A，魏=TEAM_B。ZONE_FLAG(=1<<0) 由 trigger-zone 约定，留给打击区。
export const TEAM_A = 1 << 1; // 蜀
export const TEAM_B = 1 << 2; // 魏
// 势力色（Color.tint；drawImage 不吃 tint，由头顶名字 Text 承担分色，见 art-data.md §二）。
export const SHU_RED = 0xb02a28;
export const WEI_BLUE = 0x2962c8;
export const WU_GREEN = 0x1e8c5a;
// 职业位（Tag.flags，特色/羁绊基础；与队伍位独立，不影响阵营索敌/伤害）。
export const WARRIOR = 1 << 6; // 武将
export const TACTICIAN = 1 << 7; // 谋士
export const ASSASSIN = 1 << 8; // 刺客
// 势力位（羁绊基础；与队伍/职业位独立，不影响阵营索敌/伤害）。
export const FACT_SHU = 1 << 3; // 蜀
export const FACT_WEI = 1 << 4; // 魏
export const FACT_WU = 1 << 5; // 吴
// CC 状态位：写在 Status.flags（与 Tag.flags 分属两个字段/位空间；位值仍避开上面 1<<0..1<<8 防读混）。
export const FROZEN = 1 << 10; // 冰冻定身（REQ-F-030）：GridMover.haltStatusMask 命中 → 不走且节奏时钟暂停

// 战斗节奏（数据）：30 tick ≈ 0.5s/动作，看得清（此前 10/24 太快）。
const MOVE_PERIOD = 48; // 每 48 tick 走一格 ≈ 0.8s（慢一点看清走位）
const ATK_CD = 45; // 普攻间隔 45 tick ≈ 0.75s
const MANA_FILL = 20; // 每次普攻攒蓝（0→100 = 5 攻一大招 ≈3.75s）。旧 50=1.5s 整循环：8 子异步充清，满屏蓝条频闪+大招刷屏（用户实测反馈），非 bug 是节奏数据。
const HP_SCALE = 18; // 全局血量倍率（调战斗时长，目标一局 ~20s；越大越久）

const xf = (x: number, y: number): Record<string, unknown> => ({ x, y, rotation: 0, scaleX: 1, scaleY: 1 });
const sprite = (textureKey: string, zOrder: number): Record<string, unknown> => ({ textureKey, anchorX: 0.5, anchorY: 0.5, zOrder });

// 普攻打击区：目标处小 sensor 伤害区，2 tick 自毁。fxKey=按攻击类型的特效（近战斩/远程箭/法术弹）。
const strike = (targetMask: number, amount: number, fxKey: string): PrefabTemplate => ({
  entities: {
    area: {
      Transform: xf(0, 0),
      Shape: { kind: 'box', width: 18, height: 18 },
      Sensor: {},
      Tag: { flags: ZONE_FLAG },
      Hitbox: { resource: 'hp', amount, targetMask },
      Timer: { id: 'life', elapsed: 0, duration: 2, loop: false },
      Sprite: sprite(fxKey, 6),
    },
  },
});

// DoT（灼烧/吸取）：命中后每 30 tick 掉血、持续 ~4s，由 over-time 处理。
const DOT = { dotPerTick: 25, dotPeriod: 30, dotDuration: 240 };

// 大招打击区：目标处大范围真伤（范围 size、伤害 amount），fxKey=主题特效，dot=是否附 DoT，
// freezeTicks>0=命中冰冻 N tick（八阵图类控制技：hitbox 置 FROZEN + 挂 OverTime 到点自动解，REQ-F-030）。
const ultTemplate = (targetMask: number, amount: number, size: number, fxKey: string, dot = false, freezeTicks = 0): PrefabTemplate => ({
  entities: {
    area: {
      Transform: xf(0, 0),
      Shape: { kind: 'box', width: size, height: size },
      Sensor: {},
      Tag: { flags: ZONE_FLAG },
      Hitbox: { resource: 'hp', amount, targetMask, ...(dot ? DOT : {}), ...(freezeTicks > 0 ? { setMask: FROZEN, statusDuration: freezeTicks } : {}) },
      Timer: { id: 'life', elapsed: 0, duration: 3, loop: false },
      Sprite: sprite(fxKey, 7),
    },
  },
});

interface HeroSpec {
  id: string;
  name: string;
  key: string;
  team: number;
  enemy: number;
  cls: number; // 职业位（WARRIOR/TACTICIAN/ASSASSIN）
  faction: number; // 势力位（FACT_SHU/WEI/WU）—— 羁绊
  tint: number; // 势力色（羁绊期徽记/描边备用；名牌现读队伍色——用户实测三色分不清阵营）
  q: number; // axial q（列）
  r: number; // axial r（行；r0-3=魏上半场, r4-7=蜀下半场，中线 r3/4）
  hp: number; // 血量
  atk: number; // 攻击力（每次普攻伤害）
  ult: string; // 大招名（三国感）
  ultDmg: number; // 大招伤害
  ultSize: number; // 大招范围(px)
  atkType: 'melee' | 'ranged' | 'magic'; // 攻击类型 → 普攻特效（近战斩/远程箭/法术弹）
  ultFx: string; // 大招主题特效 key
  ultDot?: boolean; // 大招附 DoT（灼烧/吸取）
  ultFreeze?: number; // 大招冰冻时长(tick)：命中置 FROZEN、到点自动解（八阵图类控制技，REQ-F-030）
  items?: string[]; // 装备（ITEMS id；装配期把 hp/atk 加上）
}

// 站位金铲铲式 + 各英雄独立血量/攻击 + 职业 + 势力(蜀魏吴) + 专属大招。每方 3 本势力 + 1 吴（跨势力羁绊样本）。
const ROSTER: HeroSpec[] = [
  // 蜀（TEAM_A，下半场，红）+ 吴·周瑜（绿）
  { id: 'a_guanyu', name: '关羽', key: F_HERO.guan_yu, team: TEAM_A, enemy: TEAM_B, cls: WARRIOR, faction: FACT_SHU, tint: SHU_RED, q: 4, r: 7, hp: 240, atk: 12, ult: '青龙偃月', ultDmg: 45, ultSize: 80, atkType: 'melee', ultFx: F_FX_STRIKE, items: ['yuxi'] },
  { id: 'a_zhaoyun', name: '赵云', key: F_HERO.zhao_yun, team: TEAM_A, enemy: TEAM_B, cls: WARRIOR, faction: FACT_SHU, tint: SHU_RED, q: 7, r: 7, hp: 165, atk: 18, ult: '七进七出', ultDmg: 75, ultSize: 55, atkType: 'melee', ultFx: F_FX_STRIKE, items: ['qinggang'] },
  { id: 'a_zhuge', name: '诸葛亮', key: F_HERO.zhuge_liang, team: TEAM_A, enemy: TEAM_B, cls: TACTICIAN, faction: FACT_SHU, tint: SHU_RED, q: 5, r: 9, hp: 120, atk: 24, ult: '八阵图', ultDmg: 35, ultSize: 95, atkType: 'magic', ultFx: F_FX_FROST, ultFreeze: 120 },
  { id: 'a_zhouyu', name: '周瑜', key: F_HERO.zhou_yu, team: TEAM_A, enemy: TEAM_B, cls: TACTICIAN, faction: FACT_WU, tint: WU_GREEN, q: 9, r: 8, hp: 115, atk: 21, ult: '火烧赤壁', ultDmg: 38, ultSize: 92, atkType: 'magic', ultFx: F_FX_FLAME, ultDot: true },
  // 魏（TEAM_B，上半场，蓝）+ 吴·甘宁（绿）
  { id: 'b_zhangliao', name: '张辽', key: F_HERO.zhang_liao, team: TEAM_B, enemy: TEAM_A, cls: WARRIOR, faction: FACT_WEI, tint: WEI_BLUE, q: 4, r: 4, hp: 200, atk: 15, ult: '突阵', ultDmg: 50, ultSize: 70, atkType: 'melee', ultFx: F_FX_STRIKE, items: ['fangtian'] },
  { id: 'b_xuchu', name: '许褚', key: F_HERO.xu_chu, team: TEAM_B, enemy: TEAM_A, cls: WARRIOR, faction: FACT_WEI, tint: WEI_BLUE, q: 7, r: 4, hp: 270, atk: 11, ult: '裸衣血战', ultDmg: 42, ultSize: 78, atkType: 'melee', ultFx: F_FX_STRIKE },
  { id: 'b_simayi', name: '司马懿', key: F_HERO.sima_yi, team: TEAM_B, enemy: TEAM_A, cls: TACTICIAN, faction: FACT_WEI, tint: WEI_BLUE, q: 6, r: 2, hp: 130, atk: 23, ult: '鬼谋', ultDmg: 40, ultSize: 88, atkType: 'magic', ultFx: F_FX_DRAIN, ultDot: true, items: ['qinggang'] },
  { id: 'b_ganning', name: '甘宁', key: F_HERO.gan_ning, team: TEAM_B, enemy: TEAM_A, cls: ASSASSIN, faction: FACT_WU, tint: WU_GREEN, q: 9, r: 3, hp: 145, atk: 20, ult: '锦帆突袭', ultDmg: 60, ultSize: 50, atkType: 'ranged', ultFx: F_FX_ARROW },
];

// 装备（数据）：物品=属性加成；英雄装配期把 hp/atk 加上（静态）。合成(2件→1件)走商店 craft-recipe，待商店阶段。
const ITEMS: Record<string, { name: string; hp?: number; atk?: number }> = {
  yuxi: { name: '玉玺', hp: 120 }, // +120 血（坦克件）
  qinggang: { name: '青釭剑', atk: 12 }, // +12 攻（输出件）
  fangtian: { name: '方天画戟', hp: 60, atk: 8 }, // +60 血 +8 攻
};
const sumItem = (ids: string[] | undefined, k: 'hp' | 'atk'): number => (ids ?? []).reduce((s, id) => s + (ITEMS[id]?.[k] ?? 0), 0);
const finalHp = (h: HeroSpec): number => h.hp * HP_SCALE + sumItem(h.items, 'hp');
const finalAtk = (h: HeroSpec): number => h.atk + sumItem(h.items, 'atk');

// 普攻特效按攻击类型：近战斩光 / 远程箭 / 法术弹。
const FX_BY_TYPE: Record<HeroSpec['atkType'], string> = { melee: F_FX_STRIKE, ranged: F_FX_ARROW, magic: F_FX_BOLT };

// （模板库 GAME_F_TEMPLATES 在 heroTemplate 定义之后构建，见下；普攻/大招/棋子复合 每英雄三张。）

// ── 棋子复合模板（REQ-F-032/033）：单位+名牌+血蓝条×4+蓝 sidecar+大招接线 = 一个 PrefabTemplate 整体生灭 ──
// 内部互指一律 '@local:main'（REQ-F-033，展开时重映射为实例 id）；sidecar（蓝/攒/放/清）虽无 Transform
// 也必须挂 Hierarchy{parentId:'@local:main'} 才随主体级联（主程坑提示：级联只沿 Hierarchy 边走）。
// Tag/Resource(hp)/HexPos 是占位，由槽位 Caster.overrides 写真值（星级数值进槽位数据，Phase 2 复用）。
// 唯一 id 策略不变：atk_<id>/mp_<id>/ult_<id> 烘进各英雄专属模板（一英雄一槽一实例，不串台；重复棋子待 REQ-021 接入）。
const BAR_W = 28;
const trackColor = 0x18181c;
const HP_Y = -26, MP_Y = -20;
const sidecarLink = { parentId: '@local:main', localX: 0, localY: 0, localRotation: 0, localScaleX: 1, localScaleY: 1 };
function heroTemplate(h: HeroSpec): PrefabTemplate {
  const atk = `atk_${h.id}`;
  const mp = `mp_${h.id}`;
  const ultSig = `ult_${h.id}`;
  const bar = (localY: number, height: number): Record<string, unknown> => ({
    Transform: xf(0, localY), // instantiate 统一偏移到槽位投影坐标
    Shape: { kind: 'box', width: BAR_W, height },
    Hierarchy: { ...sidecarLink, localY },
  });
  return {
    entities: {
      main: {
        Transform: xf(0, 0),
        Shape: { kind: 'box', width: 16, height: 16 }, // 供打击区 overlap 命中
        Tag: { flags: 0 }, // 占位 ← 槽位 overrides
        Resource: { id: 'hp', current: 1, min: 0, max: 1 }, // 占位 ← 槽位 overrides（星级数值）
        Perception: { targetTag: h.enemy, sightRadius: 0 }, // 无限视野 → aggro 锁最近敌写 Relation(target)
        HexPos: { q: 0, r: 0 }, // 占位 ← 槽位 overrides（grid-move 每拍据 HexPos 重投影）
        GridMover: { period: MOVE_PERIOD, elapsed: 0, haltStatusMask: FROZEN }, // 被冻定身（REQ-F-030）
        Mortal: { resource: 'hp', atOrBelow: 0 },
        // 普攻链（自身闭环）：loop Timer 到点 AND in_combat → 唯一信号 → Caster 在目标处展开打击区。
        Timer: { id: atk, elapsed: 0, duration: ATK_CD, loop: true },
        EventWhen: { signal: atk, when: { kind: 'and', of: [{ kind: 'timer', id: atk, cmp: 'gte', value: ATK_CD - 1 }, { kind: 'flag', id: 'in_combat', equals: true }] }, mode: 'edge', armed: false },
        Caster: { onSignal: atk, template: `strike_${h.id}`, at: 'target', targetTag: h.enemy },
        Sprite: sprite(h.key, 4),
      },
      // 头顶名牌：Text+队伍色（我方蜀=红 / 敌方魏=蓝——用户实测"三色势力分不清谁打谁"，名牌只读阵营；
      // 势力色仍在 ROSTER.tint，留羁绊期徽记/描边用）；Sprite 仅抬 zOrder（文本模式不绘）。-34 给两条让位。
      name: {
        Transform: xf(0, -34),
        Text: { content: h.name, fontSize: 9, fontFamily: 'sans-serif', anchor: 'center', lineSpacing: 0 },
        Color: { tint: h.team === TEAM_A ? SHU_RED : WEI_BLUE, alpha: 1 },
        Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 30 },
        Hierarchy: { ...sidecarLink, localY: -34 },
      },
      // 实时血条/蓝条（REQ-F-029 gauge）：暗轨道(先插=在下)+彩填充(后插=在上)，同 zOrder 按插入序叠放。
      // hp 读父（共享 id，fromParent）；mp 读全局唯一 mp_<id>。条无 Tag/Sensor/Hitbox：不参战不计 Zone 不被 wipe 直击（随级联走）。
      hpbg: { ...bar(HP_Y, 5), Color: { tint: trackColor, alpha: 0.85 } },
      hpbar: { ...bar(HP_Y, 5), Color: { tint: 0x33cc33, alpha: 1 }, Gauge: { resourceId: 'hp', fromParent: true, width: BAR_W } },
      mpbg: { ...bar(MP_Y, 3), Color: { tint: trackColor, alpha: 0.85 } },
      mpbar: { ...bar(MP_Y, 3), Color: { tint: 0x3aa0ff, alpha: 1 }, Gauge: { resourceId: mp, width: BAR_W } },
      // 大招接线（蓝条→大招）：普攻信号攒蓝 → 蓝满发大招信号 → Caster 复用 main 的 aggro 目标展开大招 + 清蓝。
      mana: {
        Resource: { id: mp, current: 0, min: 0, max: 100 },
        EventWhen: { signal: ultSig, when: { kind: 'resource', id: mp, cmp: 'gte', value: 100 }, mode: 'edge', armed: false },
        Hierarchy: { ...sidecarLink },
      },
      fill: { Effect: { onSignal: atk, kind: 'modify-resource', targetId: mp, op: 'add', value: MANA_FILL }, Hierarchy: { ...sidecarLink } },
      ultcast: { Caster: { onSignal: ultSig, template: `ult_${h.id}`, at: 'target', targetTag: h.enemy, originEntity: '@local:main' }, Hierarchy: { ...sidecarLink } },
      drain: { Effect: { onSignal: ultSig, kind: 'modify-resource', targetId: mp, op: 'set', value: 0 }, Hierarchy: { ...sidecarLink } },
    },
  } as unknown as PrefabTemplate;
}

// ── 阵容槽位（持久数据，REQ-F-032）：无 Tag → wipe 清场不波及；跨回合常驻。──
// 收到展开信号 → 在自身 Transform（= project(q,r) 投影坐标，消除展开后一帧跳变）处展开自己的棋子，
// overrides 写真值（站位/阵营/星级数值）。买/卖/挪位/换星 = 增删改槽实体数据（MVP-1 商店接这里）。
function slotEntity(h: HeroSpec): EntityBlueprint {
  const p = project(h.q, h.r);
  return {
    Transform: xf(p.x, p.y),
    Caster: {
      onSignal: h.team === TEAM_A ? 'deploy' : 'deploy_stage_1', // 敌方按关卡分信号（关卡表多阶段=多组敌槽，纯数据）
      template: `hero_${h.id}`,
      at: 'self',
      overrides: {
        main: {
          HexPos: { q: h.q, r: h.r },
          Tag: { flags: h.team | h.cls | h.faction },
          Resource: { current: finalHp(h), max: finalHp(h) }, // 星级=换这套数值（Phase 2）
        },
      },
    },
  } as unknown as EntityBlueprint;
}

// 每英雄三张模板：普攻打击区 + 大招打击区 + 棋子复合体（REQ-F-032 回合重展开用）。targetMask=敌队。
export const GAME_F_TEMPLATES: Record<string, PrefabTemplate> = Object.fromEntries(
  ROSTER.flatMap((h): [string, PrefabTemplate][] => [
    [`strike_${h.id}`, strike(h.enemy, finalAtk(h), FX_BY_TYPE[h.atkType])],
    [`ult_${h.id}`, ultTemplate(h.enemy, h.ultDmg, h.ultSize, h.ultFx, h.ultDot, h.ultFreeze)],
    [`hero_${h.id}`, heroTemplate(h)],
  ]),
);

const ARENA = { minX: -280, minY: -200, maxX: 280, maxY: 200 };

// 金铲铲回合流程（flow-spec §3.3 round_flow，多回合循环版）：prep⟲combat⟲resolution 循环到 gameover。
// 回合重置（REQ-F-032）：prep onEnter 臂 deploy_armed → EventWhen(edge) 发 'deploy'/'deploy_stage_1' →
// 槽位各自展开满状态棋子；resolution onEnter 臂 wipe_armed → 'wipe' → destroy-tagged 按阵营清场（级联连挂件）。
// L1 run_flow（§3.2 关卡推进/胜利判定）+ ready 开战输入 = MVP-1 队列后续项；现 prep after 40 自动开战、循环常驻。
const GAME_FLOW = {
  id: 'round',
  current: 'prep',
  entered: false,
  elapsed: 0,
  states: [
    {
      id: 'prep', // 备战：发钱（MVP 占位 +5）+ 回合计数 + 重展开两队（满血满蓝新实例）；40 拍后开战
      onEnter: [
        { kind: 'modify-resource', targetId: 'gold', op: 'add', value: 5 },
        { kind: 'modify-resource', targetId: 'round_idx', op: 'add', value: 1 },
        { kind: 'set-flag', targetId: 'in_combat', value: false },
        { kind: 'set-flag', targetId: 'wipe_armed', value: false }, // 复位，下次结算再臂（edge 纪律）
        { kind: 'set-flag', targetId: 'deploy_armed', value: true }, // → 'deploy' + 'deploy_stage_1'
      ],
      transitions: [{ when: { kind: 'always' }, after: 40, to: 'combat', do: [{ kind: 'set-flag', targetId: 'in_combat', value: true }, { kind: 'set-flag', targetId: 'deploy_armed', value: false }] }],
    },
    {
      id: 'combat', // 战斗：自动互砍 + 蓝满放大招；某队团灭(present flag→false)→结算
      transitions: [
        { when: { kind: 'flag', id: 'team_b_present', equals: false }, to: 'resolution', do: [{ kind: 'set-flag', targetId: 'won', value: true }] },
        { when: { kind: 'flag', id: 'team_a_present', equals: false }, to: 'resolution', do: [{ kind: 'set-flag', targetId: 'won', value: false }, { kind: 'modify-resource', targetId: 'player_hp', op: 'add', value: -5 }] },
      ],
    },
    {
      id: 'resolution', // 结算：停战 + 清场（wipe→destroy-tagged）；玩家血尽→gameover，否则 60 拍后回 prep（多回合循环）
      onEnter: [
        { kind: 'set-flag', targetId: 'in_combat', value: false },
        { kind: 'set-flag', targetId: 'wipe_armed', value: true }, // → 'wipe'
      ],
      transitions: [
        { when: { kind: 'resource', id: 'player_hp', cmp: 'lte', value: 0 }, to: 'gameover' },
        { when: { kind: 'always' }, after: 60, to: 'prep' },
      ],
    },
    { id: 'gameover', onEnter: [{ kind: 'set-flag', targetId: 'run_over', value: true }] },
  ],
};

export function buildGameFBlueprint(): WorldBlueprint {
  const entities: Record<string, EntityBlueprint> = {
    // 技能/打击库（数据，单例）。
    library: { PrefabLibrary: { templates: GAME_F_TEMPLATES, seq: 0 } } as unknown as EntityBlueprint,
    // 六边形棋盘（56 格，表现层底；金铲铲 7×8 布局，蜀半场暖/魏半场冷）。
    ...boardEntities(F_HEX_WARM, F_HEX_COOL),
    // 棋盘配置单例（喂引擎 grid-move：尺寸 + 投影原点）。
    board: { HexBoard: { cols: COLS, rows: ROWS, tileSize: TILE, originX: ORIGIN_X, originY: ORIGIN_Y, layout: LAYOUT } } as unknown as EntityBlueprint,
    // 胜负旗标 + 竞技场存活计数 Zone（存活=0 → present flag 落 false；下游接 flow 阶段机，后续）。
    team_a_flag: { Flag: { id: 'team_a_present', active: true } } as unknown as EntityBlueprint,
    team_b_flag: { Flag: { id: 'team_b_present', active: true } } as unknown as EntityBlueprint,
    zone_a: { Zone: { outFlag: 'team_a_present', ...ARENA, requiredTag: TEAM_A, count: 1 } } as unknown as EntityBlueprint,
    zone_b: { Zone: { outFlag: 'team_b_present', ...ARENA, requiredTag: TEAM_B, count: 1 } } as unknown as EntityBlueprint,
    // —— 金铲铲回合流程（flow）+ 其读写的旗标/资源单例 ——
    flow_ctrl: { GameFlow: GAME_FLOW } as unknown as EntityBlueprint,
    f_in_combat: { Flag: { id: 'in_combat', active: false } } as unknown as EntityBlueprint,
    f_won: { Flag: { id: 'won', active: false } } as unknown as EntityBlueprint,
    f_over: { Flag: { id: 'run_over', active: false } } as unknown as EntityBlueprint,
    r_gold: { Resource: { id: 'gold', current: 0, min: 0, max: 999 } } as unknown as EntityBlueprint,
    r_player_hp: { Resource: { id: 'player_hp', current: 20, min: 0, max: 20 } } as unknown as EntityBlueprint,
    r_round_idx: { Resource: { id: 'round_idx', current: 0, min: 0, max: 999 } } as unknown as EntityBlueprint, // 回合序号（§3.1 已注册；关卡表指针 MVP-1 接）
    // —— 回合重置接线（REQ-F-032）：flow 臂旗标 → EventWhen(edge) 产单拍信号 → 槽位展开 / destroy-tagged 清场 ——
    f_deploy_armed: { Flag: { id: 'deploy_armed', active: false } } as unknown as EntityBlueprint,
    f_wipe_armed: { Flag: { id: 'wipe_armed', active: false } } as unknown as EntityBlueprint,
    when_deploy: { EventWhen: { signal: 'deploy', when: { kind: 'flag', id: 'deploy_armed', equals: true }, mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    when_deploy_stage1: { EventWhen: { signal: 'deploy_stage_1', when: { kind: 'flag', id: 'deploy_armed', equals: true }, mode: 'edge', armed: false } } as unknown as EntityBlueprint, // 多阶段=按 round_idx/stage_idx 加条件分流（MVP-1 关卡表）
    when_wipe: { EventWhen: { signal: 'wipe', when: { kind: 'flag', id: 'wipe_armed', equals: true }, mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    wipe_team_a: { Effect: { onSignal: 'wipe', kind: 'destroy-tagged', targetId: '', value: TEAM_A } } as unknown as EntityBlueprint, // 清场：按阵营批量销毁，级联连名牌/条/sidecar
    wipe_team_b: { Effect: { onSignal: 'wipe', kind: 'destroy-tagged', targetId: '', value: TEAM_B } } as unknown as EntityBlueprint,
    // 静态相机（表现，排除出 hash）。720p 画布 + zoom 把棋盘放大填满视口。
    camera: { Transform: xf(0, 0), Camera: { zoom: 1.8, offsetX: 0, offsetY: 0, rotation: 0, viewportW: 1280, viewportH: 720 } } as unknown as EntityBlueprint,
  };
  // 棋子不再烘进装配期（REQ-F-032）：每英雄一个持久槽位，prep 拍按信号展开复合实例（单位+名牌+条+大招接线）。
  for (const h of ROSTER) {
    entities[`slot_${h.id}`] = slotEntity(h);
  }

  return {
    capabilities: [
      // 金铲铲回合流程机（备战→战斗→结算→结束/gameover；战斗用 in_combat 门控普攻/攒蓝）
      flowCapability,
      // AI：索敌 + 六边形网格寻路走位（aggro 写目标 → grid-move 沿确定性 A* 逐格走，REQ-024）
      aggroCapability,
      gridMoveCapability,
      // 自动普攻 + 大招：timer → event-when → caster → prefab；蓝条 攒蓝/清蓝 = effect-apply
      timerCapability,
      eventWhenCapability,
      effectApplyCapability,
      casterCapability,
      prefabCapability,
      // 结算：overlap → trigger-zone → hitbox → resource
      overlapDetectCapability,
      triggerZoneCapability,
      hitboxCapability,
      overTimeCapability, // 大招 DoT（灼烧/吸取）持续伤害
      resourceCapability,
      // 生命周期：打击区自毁 + 单位死亡
      lifetimeCapability,
      destroyCapability,
      mortalCapability,
      // 胜负 + 表现
      zoneOccupancyCapability,
      gaugeCapability, // 实时血条/蓝条（REQ-F-029）：Resource 比例 → 条宽，PostResolve 终态投影（REQ-F-031 定序）
      hierarchyResolveCapability,
      hierarchyCascadeCapability, // 子随父死（REQ-F-026）：棋子死亡→头顶名字一并消失
      cameraFollowCapability,
    ],
    entities,
  };
}

export const GAME_F_HERO_IDS = ROSTER.map((h) => h.id);
