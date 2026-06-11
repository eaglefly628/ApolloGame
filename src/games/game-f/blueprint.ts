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
  clickableCapability,
  selfRuleCapability,
  cardPileCapability,
  craftRecipeCapability,
  cameraFollowCapability,
  gridMoveCapability,
  ZONE_FLAG,
} from '@skills/tier2/index.js';
import { prefabCapability, casterCapability, aggroCapability, flowCapability } from '@skills/tier3/index.js';
import { GAME_F_ASSETS, F_HERO, F_FX_STRIKE, F_FX_ARROW, F_FX_BOLT, F_FX_FLAME, F_FX_FROST, F_FX_DRAIN, F_HEX_WARM, F_HEX_COOL } from './assets.js';
import { boardEntities, project, offsetToAxial, COLS, ROWS, TILE, ORIGIN_X, ORIGIN_Y, LAYOUT } from './hex.js';

// ═══════════════════════════════════════════════════════════════
//  Game F —— 《像素三分天下》自走棋 MVP-0 骨架 + 多回合循环（REQ-F-032）。**纯数据装配**，零自走棋专属代码。
//  整套战斗循环由通用能力涌现（= Game D 暗黑切片的数据，减去玩家操控、加一支镜像敌队）：
//
//    · 索敌走位 = aggro(Perception→Relation target) + steering(seek) + motion-apply   —— ai-chase（数据）
//    · 普攻     = 自身 loop Timer{id:'atk'} → SelfRule{timer ∧ whenGlobal(in_combat) → spawn strike at:'target'}
//                 （F-9 self 化，REQ-021/035/036；同模板多实例各按自身节拍不串台）      —— 自动普攻（数据）
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
//  普攻链已 self 化（F-9：timer id 共享 'atk' + SelfRule spawn + whenGlobal 阶段门）——重复棋子/三星的
//  **普攻与回蓝**不串台；大招半截（mp_<英雄> 蓝满→放→清）仍全局唯一 id，完整 self 化等 REQ-F-039。零自走棋 system。
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
// 回蓝（F-9 后普攻无信号可挂攒蓝 → 时基回蓝，节奏对齐旧"5 攻一大招"≈3.75s 蓝满；整数节拍免浮点累积）。
// 历史：50/攻=1.5s 整循环（满屏频闪+诸葛近永冻，用户实测）→ 20/攻 → 现 +4/9 拍 ≈0.44/拍。
const MANA_REGEN = { period: 9, amount: 4 };
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
  q: number; // 视觉列 col（odd-r 迁移后摆子数据用视觉坐标，slotEntity 经 offsetToAxial 换算成 sim 的 axial）
  r: number; // 视觉行 row（r0-3=魏上半场, r4-7=蜀下半场，中线 r3/4）
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

// ── 棋子复合模板（REQ-F-032/033）：单位+名牌+血蓝条×4+蓝 sidecar = 一个 PrefabTemplate 整体生灭 ──
// 内部互指一律 '@local:main'（REQ-F-033，展开时重映射为实例 id）；sidecar 虽可无 Transform
// 也必须挂 Hierarchy{parentId:'@local:main'} 才随主体级联（主程坑提示：级联只沿 Hierarchy 边走）。
// Tag/Resource(hp)/HexPos 是占位，由槽位 Caster.overrides 写真值（星级数值进槽位数据，Phase 2 复用）。
// 全链已 per-instance（F-9 完结）：timer 'atk'/资源 'mp' 皆普通共享 id，self/局部作用域各读各的——
// 同模板任意多实例（重复购买/三星合体）普攻、回蓝、放大招全不串台，零唯一 id。
const BAR_W = 28;
const trackColor = 0x18181c;
const HP_Y = -26, MP_Y = -20;
const sidecarLink = { parentId: '@local:main', localX: 0, localY: 0, localRotation: 0, localScaleX: 1, localScaleY: 1 };
function heroTemplate(h: HeroSpec): PrefabTemplate {
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
        // 被冻定身（REQ-F-030）；glideSpeed=平滑滑行（REQ-F-034：HexPos 逻辑瞬步不变，Transform 恒速滑向格点）。
        // 取值按策划审查：相邻格 ~33px / period 48 ≈ 0.7 px/tick 为追上逻辑步的下限，0.8 留余量（瞬移=不设）。
        GridMover: { period: MOVE_PERIOD, elapsed: 0, haltStatusMask: FROZEN, glideSpeed: 0.8 },
        Mortal: { resource: 'hp', atOrBelow: 0 },
        // 普攻链（F-9 self 化，REQ-021 spawn + REQ-F-035 whenGlobal 阶段门 + REQ-F-036 二刷定序）：
        // 自身 loop Timer 到点 ∧ 全局 in_combat → SelfRule 在自身 Relation(target) 处展开打击区。
        // timer id 共享 'atk'（self 作用域读自身那份，同模板多实例不串台——唯一 id 脚手架已拆）；
        // 备战/结算不动手 = whenGlobal 门（策划第 9 轮裁定）；目标存在性兜底（胜方目标死光即停手）。
        Timer: { id: 'atk', elapsed: 0, duration: ATK_CD, loop: true },
        SelfRule: { when: { kind: 'timer', id: 'atk', cmp: 'gte', value: ATK_CD - 1 }, whenGlobal: { kind: 'flag', id: 'in_combat', equals: true }, do: [{ kind: 'spawn', template: `strike_${h.id}`, at: 'target' }], once: false, armed: false },
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
      mpbar: { ...bar(MP_Y, 3), Color: { tint: 0x3aa0ff, alpha: 1 }, Gauge: { resourceId: 'mp', fromParent: true, width: BAR_W }, Hierarchy: { ...sidecarLink, parentId: '@local:mana', localY: MP_Y } },
      // 大招接线（F-9 完结篇，REQ-F-039 回驳给的重组路线，全 per-instance 零唯一 id）：
      // · 回蓝 = over-time 永久 regen（duration<=0、amountPerTick 正、局部寻址自身 mp——现有能力字面覆盖，
      //   Lead 等价写法原样）；· 蓝满→放→清 = sidecar 仅有的一条 SelfRule（whenGlobal 阶段门同普攻纪律）；
      // · at:'target' 的目标 = sidecar 自带 Perception 由 aggro 锁敌（位置经 Hierarchy 随主，锁的即近敌）。
      // mp 为普通共享 id：无全局读者（蓝条 fromParent 读本 sidecar、清蓝施于自身）→ 重复棋子大招不串台。
      mana: {
        Transform: xf(0, 0),
        Resource: { id: 'mp', current: 0, min: 0, max: 100 },
        OverTime: { effects: [{ id: 'mp_regen', resource: 'mp', amountPerTick: MANA_REGEN.amount, period: MANA_REGEN.period, duration: 0, elapsed: 0 }] },
        Perception: { targetTag: h.enemy, sightRadius: 0 },
        SelfRule: { when: { kind: 'resource', id: 'mp', cmp: 'gte', value: 100 }, whenGlobal: { kind: 'flag', id: 'in_combat', equals: true }, do: [{ kind: 'spawn', template: `ult_${h.id}`, at: 'target' }, { kind: 'modify-resource', op: 'set', value: 0 }], once: false, armed: false },
        Hierarchy: { ...sidecarLink },
      },
    },
  } as unknown as PrefabTemplate;
}

// ── 阵容槽位（持久数据，REQ-F-032）：无 Tag → wipe 清场不波及；跨回合常驻。──
// 收到展开信号 → 在自身 Transform（= project(q,r) 投影坐标，消除展开后一帧跳变）处展开自己的棋子，
// overrides 写真值（站位/阵营/数值）。买/卖/挪位/换星 = 增删改槽实体数据（MVP-1 商店接这里）。
// hpMul：§4.5 敌阵强度 / 未来星级同一口径（全走 overrides，模板不动）。
function slotEntity(h: HeroSpec, onSignal: string, col: number, row: number, hpMul = 1): EntityBlueprint {
  const a = offsetToAxial(col, row); // 摆子数据=视觉 (col,row)，sim 真相=axial（REQ-F-037 odd-r 迁移）
  const p = project(a.q, a.r);
  const hp = Math.round(finalHp(h) * hpMul);
  return {
    Transform: xf(p.x, p.y),
    Caster: {
      onSignal,
      template: `hero_${h.id}`,
      at: 'self',
      overrides: { main: { HexPos: { q: a.q, r: a.r }, Tag: { flags: h.team | h.cls | h.faction }, Resource: { current: hp, max: hp } } },
    },
  } as unknown as EntityBlueprint;
}

// ── 关卡表（flow-spec §4.5，前 2 阶段）：敌阵=数据条目、与我方槽位同构；扩阶段=加条目+一行 when_deploy_stage_N。──
// 注：敌方强度暂只缩放 HP（攻击力烘在 strike_<id> 模板 amount 里；按阶段缩攻=每阶段一套 strike 模板，真需要再加）。
const STAGES: { n: number; comp: { hero: string; q: number; r: number; hpMul: number }[] }[] = [
  {
    n: 1, // 阶段1「黄巾散兵」：3 子、弱（×0.45，教学局）
    comp: [
      { hero: 'b_zhangliao', q: 4, r: 4, hpMul: 0.45 },
      { hero: 'b_xuchu', q: 7, r: 4, hpMul: 0.45 },
      { hero: 'b_ganning', q: 9, r: 3, hpMul: 0.45 },
    ],
  },
  {
    n: 2, // 阶段2「董卓先锋」：4 子全强度（张辽自带方天画戟 ≈ §4.5 的"+1 件装"）
    comp: [
      { hero: 'b_zhangliao', q: 4, r: 4, hpMul: 1 },
      { hero: 'b_xuchu', q: 7, r: 4, hpMul: 1 },
      { hero: 'b_simayi', q: 6, r: 2, hpMul: 1 },
      { hero: 'b_ganning', q: 9, r: 3, hpMul: 1 },
    ],
  },
];
const heroOf = (id: string): HeroSpec => ROSTER.find((h) => h.id === id)!;

// ── 商店（F-11 / REQ-F-040 + v2 §4.6）：英雄码 + 单人有限牌袋（预洗、确定性；§4.4 牌袋语义）──
// 码 0 保留为「无」（bought_code 复位值）。MVP 袋 = 我方 4 将各 3 张（卖出归还/按等级加权袋 = 后续）。
const HERO_CODE: Record<string, number> = { a_guanyu: 1, a_zhaoyun: 2, a_zhuge: 3, a_zhouyu: 4 };
// 每将 6 张（TUNE）：自动刷新每回合弃 5 补 5，有限袋按 v2 §4.6 语义随对局消耗（卖出归还袋 = 后续，见 F-12 回执）。
const SHOP_DECK = [3, 1, 4, 2, 2, 4, 1, 3, 1, 2, 3, 4, 4, 2, 1, 3, 3, 1, 2, 4, 2, 3, 4, 1];

// ── §4.1/§4.2 banded 结算（Game E 已证形态）：armed 旗开窗 → EventWhen(edge) 带条件命中 → Effect 改资源一次。──
// 带宽语义注记：同窗内资源被前一 band 改写后，后续 band 的阈值按"改写后的值"再判（如利息可能含同回合收入）——
// 确定性单调、每 band 每窗至多一次；TUNE 嫌宽就调阈值，不改逻辑。
function band(sig: string, when: Record<string, unknown>, targetId: string, value: number): Record<string, EntityBlueprint> {
  return {
    [`when_${sig}`]: { EventWhen: { signal: sig, when, mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    [`eff_${sig}`]: { Effect: { onSignal: sig, kind: 'modify-resource', targetId, op: 'add', value } } as unknown as EntityBlueprint,
  };
}
const flagIs = (id: string): Record<string, unknown> => ({ kind: 'flag', id, equals: true });
const resCmp = (id: string, cmp: string, value: number): Record<string, unknown> => ({ kind: 'resource', id, cmp, value });
const and = (...of: Record<string, unknown>[]): Record<string, unknown> => ({ kind: 'and', of });
const or = (...of: Record<string, unknown>[]): Record<string, unknown> => ({ kind: 'or', of });

// 每英雄三张模板：普攻打击区 + 大招打击区 + 棋子复合体（REQ-F-032 回合重展开用）。targetMask=敌队。
export const GAME_F_TEMPLATES: Record<string, PrefabTemplate> = Object.fromEntries(
  ROSTER.flatMap((h): [string, PrefabTemplate][] => [
    [`strike_${h.id}`, strike(h.enemy, finalAtk(h), FX_BY_TYPE[h.atkType])],
    [`ult_${h.id}`, ultTemplate(h.enemy, h.ultDmg, h.ultSize, h.ultFx, h.ultDot, h.ultFreeze)],
    [`hero_${h.id}`, heroTemplate(h)],
  ]).concat(
    // 备战席位模板（v2 §4.6 买入→入席）：marker 实体持有英雄（可见、不参战、无 Tag 不被清场）。
    // 上场=「摆子」输入域把席位换成上场槽（主程输入路由后接）；重复购买同将暂同席位叠放（已知 wart）。
    ROSTER.filter((x) => x.team === TEAM_A).map((h): [string, PrefabTemplate] => [
      `bench_${h.id}`,
      // seat 可点卖出（F-12）：Clickable 产 sell_seat 信号，source=被点席位 → '@signal-source' 点谁卖谁。
      { entities: { seat: { Transform: xf(0, 0), Sprite: sprite(h.key, 2), Shape: { kind: 'box', width: 30, height: 30 }, Clickable: { action: 'sell_seat' } } } } as unknown as PrefabTemplate,
    ]),
  ),
);

const ARENA = { minX: -280, minY: -200, maxX: 280, maxY: 200 };

// L2 回合流程（flow-spec §3.3 round_flow 原样）：prep⟲combat⟲resolution⟲done 与 L1 round_done 握手。
// 回合重置（REQ-F-032）：prep 臂 deploy_armed → EventWhen(edge) → 'deploy'/'deploy_stage_<N>' → 槽位重展开；
// resolution 臂 wipe_armed → 'wipe' → destroy-tagged 清场。经济/伤害不再写死在 flow：prep 臂 income_armed、
// 败方臂 dmg_armed，由 banded EventWhen→Effect 按 §4.1/§4.2 表结算（见 goldBand/伤害 bands）。
// 尚缺 ready 开战输入（§6.2 P2，输入路由归主程）：prep 暂以 after 40 自动开战，接上后改读 ready Flag。
const GAME_FLOW = {
  id: 'round',
  current: 'prep',
  entered: false,
  elapsed: 0,
  states: [
    {
      id: 'prep', // 备战：臂收入（§4.1 banded 发钱）+ 臂展开，复位 wipe/伤害/ready；点「开战」提前打或 40 拍兜底
      onEnter: [
        { kind: 'set-flag', targetId: 'in_combat', value: false },
        { kind: 'set-flag', targetId: 'ready', value: false }, // 每回合重臂（§3.3 操作表「开战」）
        { kind: 'set-flag', targetId: 'wipe_armed', value: false }, // 复位，下次结算再臂（edge 纪律）
        { kind: 'set-flag', targetId: 'dmg_armed', value: false },
        { kind: 'set-flag', targetId: 'deploy_armed', value: true }, // → 'deploy' + 'deploy_stage_<当前阶段>'
        { kind: 'set-flag', targetId: 'income_armed', value: true }, // → 基础收入/利息/连胜金 bands（§4.1）
        { kind: 'set-flag', targetId: 'shop_refresh_armed', value: true }, // → 自动刷新（锁店时门挡，v2 §4.6）
      ],
      transitions: [
        // ready 优先（玩家点「开战」提前开打，§3.3 操作表）；after 40 = PvE 倒计时兜底（金铲铲本体也是倒计时自动开战）
        { when: { kind: 'flag', id: 'ready', equals: true }, to: 'combat', do: [{ kind: 'set-flag', targetId: 'in_combat', value: true }, { kind: 'set-flag', targetId: 'deploy_armed', value: false }, { kind: 'set-flag', targetId: 'income_armed', value: false }] },
        { when: { kind: 'always' }, after: 40, to: 'combat', do: [{ kind: 'set-flag', targetId: 'in_combat', value: true }, { kind: 'set-flag', targetId: 'deploy_armed', value: false }, { kind: 'set-flag', targetId: 'income_armed', value: false }] },
      ],
    },
    {
      id: 'combat', // 战斗：自动互砍 + 蓝满放大招；某队团灭(present flag→false)→结算。胜→连胜+1；败→连胜清零+臂伤害
      transitions: [
        { when: { kind: 'flag', id: 'team_b_present', equals: false }, to: 'resolution', do: [{ kind: 'set-flag', targetId: 'won', value: true }, { kind: 'modify-resource', targetId: 'win_streak', op: 'add', value: 1 }] },
        { when: { kind: 'flag', id: 'team_a_present', equals: false }, to: 'resolution', do: [{ kind: 'set-flag', targetId: 'won', value: false }, { kind: 'modify-resource', targetId: 'win_streak', op: 'set', value: 0 }, { kind: 'set-flag', targetId: 'dmg_armed', value: true }] },
      ],
    },
    {
      id: 'resolution', // 结算：停战 + 清场（wipe→destroy-tagged）；玩家血尽→gameover，否则 60 拍后进 done 与 L1 握手
      onEnter: [
        { kind: 'set-flag', targetId: 'in_combat', value: false },
        { kind: 'set-flag', targetId: 'wipe_armed', value: true }, // → 'wipe'
      ],
      transitions: [
        { when: { kind: 'resource', id: 'player_hp', cmp: 'lte', value: 0 }, to: 'gameover' },
        { when: { kind: 'always' }, after: 60, to: 'done' },
      ],
    },
    {
      id: 'done', // 通知 L1（round_done=true）；L1 advance 推进指针并复位 round_done → 回 prep 开下一回合
      onEnter: [{ kind: 'set-flag', targetId: 'round_done', value: true }],
      transitions: [{ when: { kind: 'flag', id: 'round_done', equals: false }, to: 'prep' }],
    },
    { id: 'gameover', onEnter: [{ kind: 'set-flag', targetId: 'run_over', value: true }] },
  ],
};

// L1 局流程（flow-spec §3.2 run_flow 原样）：boot 初始化 → round（等 L2 写 round_done）→ advance 推进
// 关卡指针 → 打穿关卡表胜利 / run_over 败北。round_idx>5 的进位（stage+1、round=1）由 when_stage_up banded 处理。
// 关卡表现含前 2 阶段（§4.5）→ stage_idx>2 即通关；表扩到 5 阶段时改 STAGE_COUNT 与 STAGES 数据即可。
const STAGE_COUNT = 2;
const RUN_FLOW = {
  id: 'run',
  current: 'boot',
  entered: false,
  elapsed: 0,
  states: [
    {
      id: 'boot', // 开局初始化（重开局语义：资源/指针归位；与实体初值幂等）
      onEnter: [
        { kind: 'modify-resource', targetId: 'player_hp', op: 'set', value: 100 },
        { kind: 'modify-resource', targetId: 'stage_idx', op: 'set', value: 1 },
        { kind: 'modify-resource', targetId: 'round_idx', op: 'set', value: 1 },
      ],
      transitions: [{ when: { kind: 'always' }, to: 'round' }],
    },
    {
      id: 'round', // 控制权在 L2 round_flow；其打完写 round_done
      onEnter: [{ kind: 'set-flag', targetId: 'round_done', value: false }],
      transitions: [
        { when: { kind: 'flag', id: 'run_over', equals: true }, to: 'defeat' },
        { when: { kind: 'and', of: [{ kind: 'flag', id: 'round_done', equals: true }, { kind: 'resource', id: 'stage_idx', cmp: 'gt', value: STAGE_COUNT }] }, to: 'victory' },
        { when: { kind: 'flag', id: 'round_done', equals: true }, to: 'advance' },
      ],
    },
    {
      id: 'advance', // 推进：round_idx+1（满 5 进位走 banded；进位后的"空阶段巡场回合"≤1 个，victory 检查在下轮 round_done 拍兜住）
      onEnter: [{ kind: 'modify-resource', targetId: 'round_idx', op: 'add', value: 1 }],
      transitions: [{ when: { kind: 'always' }, to: 'round' }],
    },
    { id: 'victory', onEnter: [{ kind: 'set-flag', targetId: 'run_won', value: true }] },
    { id: 'defeat' },
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
    flow_ctrl: { GameFlow: GAME_FLOW } as unknown as EntityBlueprint, // L2 round_flow
    flow_run: { GameFlow: RUN_FLOW } as unknown as EntityBlueprint, // L1 run_flow（§3.2）
    f_in_combat: { Flag: { id: 'in_combat', active: false } } as unknown as EntityBlueprint,
    f_won: { Flag: { id: 'won', active: false } } as unknown as EntityBlueprint,
    f_over: { Flag: { id: 'run_over', active: false } } as unknown as EntityBlueprint,
    f_round_done: { Flag: { id: 'round_done', active: false } } as unknown as EntityBlueprint, // L1↔L2 握手
    f_run_won: { Flag: { id: 'run_won', active: false } } as unknown as EntityBlueprint, // 打穿关卡表=通关
    r_gold: { Resource: { id: 'gold', current: 0, min: 0, max: 999 } } as unknown as EntityBlueprint,
    r_player_hp: { Resource: { id: 'player_hp', current: 100, min: 0, max: 100 } } as unknown as EntityBlueprint, // §3.1：0..100（旧 20 是 MVP-0 占位）
    r_round_idx: { Resource: { id: 'round_idx', current: 1, min: 0, max: 999 } } as unknown as EntityBlueprint, // 回合序号（advance +1，>5 进位）
    r_stage_idx: { Resource: { id: 'stage_idx', current: 1, min: 0, max: 99 } } as unknown as EntityBlueprint, // 阶段序号（关卡表指针）
    r_win_streak: { Resource: { id: 'win_streak', current: 0, min: 0, max: 999 } } as unknown as EntityBlueprint, // 连胜数（§4.1 连胜金）
    // —— 回合重置接线（REQ-F-032）：flow 臂旗标 → EventWhen(edge) 产单拍信号 → 槽位展开 / destroy-tagged 清场 ——
    // —— ready 开战（§3.3 操作表，策划批注：输入→信号→set-flag 纯数据）：点按钮 → clickable 产 'ready_btn'
    // 信号 → Effect 置 ready → prep 的 ready 转移提前开战；不点则 40 拍倒计时兜底。按钮无 Tag 不参战不被清场。
    f_ready: { Flag: { id: 'ready', active: false } } as unknown as EntityBlueprint,
    btn_ready: {
      Transform: xf(240, 170), // 棋盘右下角（视口 ±355×200 内）
      Shape: { kind: 'box', width: 64, height: 24 },
      Clickable: { action: 'ready_btn' },
      Text: { content: '开战', fontSize: 13, fontFamily: 'sans-serif', anchor: 'center', lineSpacing: 0 },
      Color: { tint: 0xd4a017, alpha: 1 },
      Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 30 }, // 只为抬 zOrder（文本模式不绘）
    } as unknown as EntityBlueprint,
    eff_ready: { Effect: { onSignal: 'ready_btn', kind: 'set-flag', targetId: 'ready', value: true } } as unknown as EntityBlueprint,
    // —— 商店（F-11，REQ-F-040；v2 §4.6 五件套之「买入核心」。刷新/锁店/卖出撞新缺口已提 REQ-F-041）——
    // 买 = 输入 play(槽下标)（点击→play 的指针路由属 launcher 输入域）：playCosts 原子验扣 金3 + 席位1
    // （钱不够/席满=拒单：牌不丢、金不动）→ 成交牌码写 bought_code → 每将 banded 分发 → marker 入备战席。
    shop: {
      // ⚠️ deck 必须取副本：装配是浅拷贝、嵌套数组按引用共享，发牌原地 shift 会跨 Engine/跨测试泄漏（确定性破口，实测踩过）
      CardPile: { owner: 'shop', deck: [...SHOP_DECK], hand: [], handSize: 5, playCosts: [{ id: 'gold', amount: 3 }, { id: 'bench_space', amount: 1 }], playedCodeResource: 'bought_code', refreshOnSignal: 'shop_refresh' },
      PlayedHand: { owner: 'shop', cards: [] },
      Flag: { id: 'shop', active: false },
    } as unknown as EntityBlueprint,
    r_bought_code: { Resource: { id: 'bought_code', current: 0, min: 0, max: 9999 } } as unknown as EntityBlueprint, // 最近一次成交牌码（0=无）
    r_bench_space: { Resource: { id: 'bench_space', current: 9, min: 0, max: 9 } } as unknown as EntityBlueprint, // 备战席 9（§4.6）；作 playCosts 第二货币——席满=0 即原子拒单（卖出时 +1 归还）
    // —— 商店余三件（F-12，REQ-F-041）：刷新 / 锁店 / 卖出 ——
    // 自动刷新：prep 臂 shop_refresh_armed → EventWhen(¬锁店 门) → 'shop_refresh' → CardPile.refreshOnSignal 弃全手补满；
    // 自动解锁/撤臂 = 门判定脉冲同拍 Commit（见 when_shop_gate 注，躲"解锁先于门判定"与"解锁复燃 edge"双坑）。
    f_shop_refresh_armed: { Flag: { id: 'shop_refresh_armed', active: false } } as unknown as EntityBlueprint,
    f_shop_locked: { Flag: { id: 'shop_locked', active: false } } as unknown as EntityBlueprint,
    when_shop_refresh: { EventWhen: { signal: 'shop_refresh', when: and(flagIs('shop_refresh_armed'), { kind: 'not', of: flagIs('shop_locked') }), mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    // 门判定脉冲（次序坑正解）：armed 升沿当拍先「判」（上行 refresh 门读 Commit 前的 locked 值），同拍 Commit
    // 再「拆」（撤臂+解锁）——armed 一拍即逝，解锁不会让 edge 复燃补刷；锁存活到下个 prep 的门判定拍=恰跳过一次（v2 §4.6）。
    when_shop_gate: { EventWhen: { signal: 'shop_gate_done', when: flagIs('shop_refresh_armed'), mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    eff_gate_disarm: { Effect: { onSignal: 'shop_gate_done', kind: 'set-flag', targetId: 'shop_refresh_armed', value: false } } as unknown as EntityBlueprint,
    eff_gate_unlock: { Effect: { onSignal: 'shop_gate_done', kind: 'set-flag', targetId: 'shop_locked', value: false } } as unknown as EntityBlueprint,
    // 手动刷新（2 金）：按钮信号 → craft-recipe 原子扣 2 金置 reroll_paid → EventWhen(edge) → 'shop_refresh' → 复位。
    // 扣不起=配方整单不动（inbox 提示"扣不起就别发信号"的原子等价实现）；手动刷新不吃锁店门（锁住时也可花钱换牌）。
    btn_reroll: {
      Transform: xf(150, 170),
      Shape: { kind: 'box', width: 56, height: 20 },
      Clickable: { action: 'reroll_btn' },
      CraftRecipe: { onSignal: 'reroll_btn', costs: [{ id: 'gold', amount: 2 }], grantsFlag: 'reroll_paid' },
      Text: { content: '刷新$2', fontSize: 11, fontFamily: 'sans-serif', anchor: 'center', lineSpacing: 0 },
      Color: { tint: 0x9ad1ff, alpha: 1 },
      Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 30 },
    } as unknown as EntityBlueprint,
    f_reroll_paid: { Flag: { id: 'reroll_paid', active: false } } as unknown as EntityBlueprint,
    when_reroll: { EventWhen: { signal: 'shop_refresh', when: flagIs('reroll_paid'), mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    eff_reroll_reset: { Effect: { onSignal: 'shop_refresh', kind: 'set-flag', targetId: 'reroll_paid', value: false } } as unknown as EntityBlueprint,
    // 锁店/解锁（v2"翻转"用两按钮达成——Effect 无 toggle，零缺口拼法）；每回合 prep→combat 自动解锁。
    btn_lock: {
      Transform: xf(96, 170),
      Shape: { kind: 'box', width: 40, height: 20 },
      Clickable: { action: 'lock_btn' },
      Text: { content: '锁店', fontSize: 11, fontFamily: 'sans-serif', anchor: 'center', lineSpacing: 0 },
      Color: { tint: 0xd4a017, alpha: 1 },
      Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 30 },
    } as unknown as EntityBlueprint,
    btn_unlock: {
      Transform: xf(96, 146),
      Shape: { kind: 'box', width: 40, height: 20 },
      Clickable: { action: 'unlock_btn' },
      Text: { content: '解锁', fontSize: 11, fontFamily: 'sans-serif', anchor: 'center', lineSpacing: 0 },
      Color: { tint: 0x8a8a8a, alpha: 1 },
      Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 30 },
    } as unknown as EntityBlueprint,
    eff_lock: { Effect: { onSignal: 'lock_btn', kind: 'set-flag', targetId: 'shop_locked', value: true } } as unknown as EntityBlueprint,
    eff_unlock: { Effect: { onSignal: 'unlock_btn', kind: 'set-flag', targetId: 'shop_locked', value: false } } as unknown as EntityBlueprint,
    // 卖出（点席卖谁）：marker Clickable 产 'sell_seat'（source=被点席位）→ destroy '@signal-source' + 返还（金2/席+1）。
    // 卖价 MVP 统一 2（买 3 卖 2，TUNE）；袋归还 = 后续（deck 写回无数据接缝，F-12 回执注记）。
    eff_sell_destroy: { Effect: { onSignal: 'sell_seat', kind: 'destroy', targetId: '', targetEntity: '@signal-source' } } as unknown as EntityBlueprint,
    eff_sell_gold: { Effect: { onSignal: 'sell_seat', kind: 'modify-resource', targetId: 'gold', op: 'add', value: 2 } } as unknown as EntityBlueprint,
    eff_sell_space: { Effect: { onSignal: 'sell_seat', kind: 'modify-resource', targetId: 'bench_space', op: 'add', value: 1 } } as unknown as EntityBlueprint,
    // —— 阶段横幅（HUD 快赢：现有词汇 set-visible 可拼；金币/回合数字与商店 5 槽可视化 = REQ-F-042/043 待引擎）——
    banner_prep: {
      Transform: xf(0, -186),
      Text: { content: '备 战 —— 点「开战」或等待倒计时（商店：刷新/锁店/卖出可用）', fontSize: 15, fontFamily: 'sans-serif', anchor: 'center', lineSpacing: 0 },
      Color: { tint: 0xf0d27a, alpha: 1 },
      Visibility: { visible: true },
      Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 31 },
    } as unknown as EntityBlueprint,
    banner_combat: {
      Transform: xf(0, -186),
      Text: { content: '战 斗 中', fontSize: 16, fontFamily: 'sans-serif', anchor: 'center', lineSpacing: 0 },
      Color: { tint: 0xff7a6a, alpha: 1 },
      Visibility: { visible: false },
      Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 31 },
    } as unknown as EntityBlueprint,
    when_phase_combat: { EventWhen: { signal: 'phase_combat', when: flagIs('in_combat'), mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    when_phase_prep: { EventWhen: { signal: 'phase_prep', when: { kind: 'flag', id: 'in_combat', equals: false }, mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    eff_pc_show: { Effect: { onSignal: 'phase_combat', kind: 'set-visible', targetId: '', targetEntity: 'banner_combat', value: true } } as unknown as EntityBlueprint,
    eff_pc_hide: { Effect: { onSignal: 'phase_combat', kind: 'set-visible', targetId: '', targetEntity: 'banner_prep', value: false } } as unknown as EntityBlueprint,
    eff_pp_show: { Effect: { onSignal: 'phase_prep', kind: 'set-visible', targetId: '', targetEntity: 'banner_prep', value: true } } as unknown as EntityBlueprint,
    eff_pp_hide: { Effect: { onSignal: 'phase_prep', kind: 'set-visible', targetId: '', targetEntity: 'banner_combat', value: false } } as unknown as EntityBlueprint,
    f_deploy_armed: { Flag: { id: 'deploy_armed', active: false } } as unknown as EntityBlueprint,
    f_wipe_armed: { Flag: { id: 'wipe_armed', active: false } } as unknown as EntityBlueprint,
    f_income_armed: { Flag: { id: 'income_armed', active: false } } as unknown as EntityBlueprint, // §4.1 结算窗
    f_dmg_armed: { Flag: { id: 'dmg_armed', active: false } } as unknown as EntityBlueprint, // §4.2 败方结算窗
    when_deploy: { EventWhen: { signal: 'deploy', when: flagIs('deploy_armed'), mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    when_deploy_stage1: { EventWhen: { signal: 'deploy_stage_1', when: and(flagIs('deploy_armed'), resCmp('stage_idx', 'eq', 1)), mode: 'edge', armed: false } } as unknown as EntityBlueprint, // 敌阵按 stage_idx 分流
    when_deploy_stage2: { EventWhen: { signal: 'deploy_stage_2', when: and(flagIs('deploy_armed'), resCmp('stage_idx', 'eq', 2)), mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    when_wipe: { EventWhen: { signal: 'wipe', when: flagIs('wipe_armed'), mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    wipe_team_a: { Effect: { onSignal: 'wipe', kind: 'destroy-tagged', targetId: '', value: TEAM_A } } as unknown as EntityBlueprint, // 清场：按阵营批量销毁，级联连名牌/条/sidecar
    wipe_team_b: { Effect: { onSignal: 'wipe', kind: 'destroy-tagged', targetId: '', value: TEAM_B } } as unknown as EntityBlueprint,
    // —— 关卡进位（§3.2 注：advance 只 +1，满 5 进位走 banded）——
    when_stage_up: { EventWhen: { signal: 'stage_up', when: resCmp('round_idx', 'gt', 5), mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    eff_stage_up_stage: { Effect: { onSignal: 'stage_up', kind: 'modify-resource', targetId: 'stage_idx', op: 'add', value: 1 } } as unknown as EntityBlueprint,
    eff_stage_up_round: { Effect: { onSignal: 'stage_up', kind: 'modify-resource', targetId: 'round_idx', op: 'set', value: 1 } } as unknown as EntityBlueprint,
    // —— §4.1 基础收入（按回合全局序 1,2,3,4,≥5 → 2,2,3,4,5 金；全局序≥5 ⇔ 阶段>1 或 round≥5）——
    ...band('income_2', and(flagIs('income_armed'), resCmp('stage_idx', 'eq', 1), resCmp('round_idx', 'lte', 2)), 'gold', 2),
    ...band('income_3', and(flagIs('income_armed'), resCmp('stage_idx', 'eq', 1), resCmp('round_idx', 'eq', 3)), 'gold', 3),
    ...band('income_4', and(flagIs('income_armed'), resCmp('stage_idx', 'eq', 1), resCmp('round_idx', 'eq', 4)), 'gold', 4),
    ...band('income_5', and(flagIs('income_armed'), or(resCmp('stage_idx', 'gt', 1), resCmp('round_idx', 'gte', 5))), 'gold', 5),
    // —— §4.1 利息 ⌊gold/10⌋ 上限 +5（5 条 banded）——
    ...band('interest_1', and(flagIs('income_armed'), resCmp('gold', 'gte', 10), resCmp('gold', 'lt', 20)), 'gold', 1),
    ...band('interest_2', and(flagIs('income_armed'), resCmp('gold', 'gte', 20), resCmp('gold', 'lt', 30)), 'gold', 2),
    ...band('interest_3', and(flagIs('income_armed'), resCmp('gold', 'gte', 30), resCmp('gold', 'lt', 40)), 'gold', 3),
    ...band('interest_4', and(flagIs('income_armed'), resCmp('gold', 'gte', 40), resCmp('gold', 'lt', 50)), 'gold', 4),
    ...band('interest_5', and(flagIs('income_armed'), resCmp('gold', 'gte', 50)), 'gold', 5),
    // —— §4.1 连胜金：2–3 连 +1；4 连 +2；5+ 连 +3 ——
    ...band('streak_1', and(flagIs('income_armed'), resCmp('win_streak', 'gte', 2), resCmp('win_streak', 'lte', 3)), 'gold', 1),
    ...band('streak_2', and(flagIs('income_armed'), resCmp('win_streak', 'eq', 4)), 'gold', 2),
    ...band('streak_3', and(flagIs('income_armed'), resCmp('win_streak', 'gte', 5)), 'gold', 3),
    // —— §4.2 玩家伤害（败方）：阶段基础伤(1/2 阶段=0/2) + 存活敌数近似 2（REQ-022 group-count 接入后换真值，队列 P1 注记）——
    ...band('dmg_stage_1', and(flagIs('dmg_armed'), resCmp('stage_idx', 'eq', 1)), 'player_hp', -2),
    ...band('dmg_stage_2', and(flagIs('dmg_armed'), resCmp('stage_idx', 'gt', 1)), 'player_hp', -4),
    // 静态相机（表现，排除出 hash）。720p 画布 + zoom 把棋盘放大填满视口。
    camera: { Transform: xf(0, 0), Camera: { zoom: 1.8, offsetX: 0, offsetY: 0, rotation: 0, viewportW: 1280, viewportH: 720 } } as unknown as EntityBlueprint,
  };
  // 我方阵容槽（持久）：蜀方 4 将；买/卖/挪位/升星 = 改这些槽数据（MVP-1 商店接这里）。
  for (const h of ROSTER.filter((x) => x.team === TEAM_A)) {
    entities[`slot_${h.id}`] = slotEntity(h, 'deploy', h.q, h.r);
  }
  // 商店买入分发（每将一组，F-11 ②③）：bought_code 命中码 → buy_<将> 信号 → 备战席位生成 marker
  // + 复位 bought_code=0（F-11 坑：防同码二连买 edge 不触发）。席位 x 按将错开（重复购买同将暂叠同位）。
  ROSTER.filter((x) => x.team === TEAM_A).forEach((h, i) => {
    const sig = `buy_${h.id}`;
    entities[`when_${sig}`] = { EventWhen: { signal: sig, when: resCmp('bought_code', 'eq', HERO_CODE[h.id]), mode: 'edge', armed: false } } as unknown as EntityBlueprint;
    entities[`buycast_${h.id}`] = { Transform: xf(-66 + i * 44, 178), Caster: { onSignal: sig, template: `bench_${h.id}`, at: 'self' } } as unknown as EntityBlueprint;
    entities[`eff_${sig}_reset`] = { Effect: { onSignal: sig, kind: 'modify-resource', targetId: 'bought_code', op: 'set', value: 0 } } as unknown as EntityBlueprint;
  });
  // 敌方关卡槽（持久）：每阶段一组，prep 按 stage_idx 分流的 deploy_stage_<N> 展开（§4.5 敌阵=数据）。
  for (const st of STAGES) {
    for (const c of st.comp) {
      entities[`slot_s${st.n}_${c.hero}`] = slotEntity(heroOf(c.hero), `deploy_stage_${st.n}`, c.q, c.r, c.hpMul);
    }
  }

  return {
    capabilities: [
      // 金铲铲回合流程机（备战→战斗→结算→结束/gameover；战斗用 in_combat 门控普攻/攒蓝）
      flowCapability,
      // AI：索敌 + 六边形网格寻路走位（aggro 写目标 → grid-move 沿确定性 A* 逐格走，REQ-024）
      aggroCapability,
      gridMoveCapability,
      // 自动普攻（F-9 self 化）：timer → self-rule(whenGlobal 门 + spawn at target) → prefab；
      // 大招半截 + deploy/wipe/banded：event-when → caster/effect-apply（大招完整 self 化等 REQ-F-039）
      timerCapability,
      selfRuleCapability,
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
      // 胜负 + 表现 + 输入
      zoneOccupancyCapability,
      gaugeCapability, // 实时血条/蓝条（REQ-F-029）：Resource 比例 → 条宽，PostResolve 终态投影（REQ-F-031 定序）
      clickableCapability, // ready 开战按钮：指针命中 → 'ready_btn' 信号（引擎已对 event-when 定序）
      cardPileCapability, // 商店（F-11/REQ-F-040）：牌袋发牌/play 原子验扣/据码写 bought_code（引擎已按"输入先行"钉七件套定序）
      craftRecipeCapability, // 手动刷新 $2（F-12）：reroll_btn 信号 → 原子扣金置 reroll_paid（扣不起整单不动）
      hierarchyResolveCapability,
      hierarchyCascadeCapability, // 子随父死（REQ-F-026）：棋子死亡→头顶名字一并消失
      cameraFollowCapability,
    ],
    entities,
  };
}

export const GAME_F_HERO_IDS = ROSTER.map((h) => h.id);
