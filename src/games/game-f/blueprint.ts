import type { WorldBlueprint, EntityBlueprint } from '../../assembly/demo.assembly.js';
import type { PrefabTemplate } from '@engine/protocol/components.js';
import { overlapDetectCapability } from '@skills/atoms/overlap-detect/index.js';
import { destroyCapability } from '@skills/atoms/destroy/index.js';
import { timerCapability } from '@skills/atoms/timer/index.js';
import { resourceCapability } from '@atom-skills/index.js';
import { lifetimeCapability, hierarchyResolveCapability, hierarchyCascadeCapability, motionApplyCapability } from '@skills/tier1/index.js';
import {
  trayCapability,
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
  textBindingCapability,
  groupCountCapability,
  cameraFollowCapability,
  gridMoveCapability,
  dragPlaceCapability,
  ZONE_FLAG,
} from '@skills/tier2/index.js';
import { prefabCapability, casterCapability, aggroCapability, flowCapability, mergeRuleCapability } from '@skills/tier3/index.js';
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
// 预留：PROTAG=1<<11 主角 / LOOT=1<<12 法球（§4.7，Phase 2.5）。商店面板槽位位 1<<13..1<<17（F-14 整槽清/重铺用）。
export const PROTAG = 1 << 11; // 主角（小小英雄，§4.7；Phase 2.5 批 C 接操控/拾取）
export const LOOT = 1 << 12; // 法球/掉落（野怪死亡掉，主角拾取）
const SHOPSLOT_BITS = [1 << 13, 1 << 14, 1 << 15]; // 三大框（用户钦定小丑牌式；1<<16/17 随 5 槽裁撤回收）
const RUNE = 1 << 18; // 开局符文卡（批D；选一发效后 destroy-tagged 整组收走=天然一次性）
const SHOPSLOT_ALL = SHOPSLOT_BITS.reduce((a, b) => a | b, 0);
// 席位 marker 位（F-17/F-18 统一架构，REQ-F-049 后）：所有星级 marker 都带；不含 TEAM 位 → 不被
// aggro 锁/打击命中/zone 计存活/wipe 清场。在席（无 HexPos）= 计备战席占用（gc onBoard:false）；
// 在板（有 HexPos）= 计上场人口（Draggable cap 数 Tag&此位∧HexPos ≤ level）。
// （旧 STAR2/STAR3/每将位 1<<19..24 随星级资源带契约删除回收——星级=模板家族本身，无需位面计数。）
const BENCH_OCC = 1 << 25;
// marker 显隐位（REQ-F-056）：seat + ★ 角标都带 → 战斗期 set-visible-tagged 隐藏（消除「武将复制、老的没删」
// 幽灵——marker 持久记布阵不能删，只能藏）、备战期再显。不与 BENCH_OCC 重叠（★ 角标不计席位占用）。
const MARKER_VIS = 1 << 19;

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
const strike = (targetMask: number, amount: number, fxKey: string, scaleId = 'dmg_scale_b'): PrefabTemplate => ({
  entities: {
    area: {
      Transform: xf(0, 0),
      Shape: { kind: 'box', width: 18, height: 18 },
      Sensor: {},
      Tag: { flags: ZONE_FLAG },
      Hitbox: { resource: 'hp', amount, targetMask, scaleByResource: scaleId }, // 047 羁绊乘区：×系数资源（缺省 1 零迁移）
      Timer: { id: 'life', elapsed: 0, duration: 2, loop: false },
      Sprite: sprite(fxKey, 6),
    },
  },
});

// DoT（灼烧/吸取）：命中后每 30 tick 掉血、持续 ~4s，由 over-time 处理。
const DOT = { dotPerTick: 25, dotPeriod: 30, dotDuration: 240 };

// 大招打击区：目标处大范围真伤（范围 size、伤害 amount），fxKey=主题特效，dot=是否附 DoT，
// freezeTicks>0=命中冰冻 N tick（八阵图类控制技：hitbox 置 FROZEN + 挂 OverTime 到点自动解，REQ-F-030）。
const ultTemplate = (targetMask: number, amount: number, size: number, fxKey: string, dot = false, freezeTicks = 0, scaleId = 'dmg_scale_b'): PrefabTemplate => ({
  entities: {
    area: {
      Transform: xf(0, 0),
      Shape: { kind: 'box', width: size, height: size },
      Sensor: {},
      Tag: { flags: ZONE_FLAG },
      Hitbox: { resource: 'hp', amount, targetMask, scaleByResource: scaleId, ...(dot ? DOT : {}), ...(freezeTicks > 0 ? { setMask: FROZEN, statusDuration: freezeTicks } : {}) },
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

// 站位金铲铲式（7×8 真规格：魏上半场 r0..3 / 蜀下半场 r4..7，中线 r3|r4 贴脸）+ 各英雄独立血量/攻击
// + 职业 + 势力(蜀魏吴) + 专属大招。每方 3 本势力 + 1 吴（跨势力羁绊样本）。
const ROSTER: HeroSpec[] = [
  // 蜀（TEAM_A，下半场 r4..7，红）+ 吴·周瑜（绿）：武将顶前排 r4、谋士蹲后排 r6
  { id: 'a_guanyu', name: '关羽', key: F_HERO.guan_yu, team: TEAM_A, enemy: TEAM_B, cls: WARRIOR, faction: FACT_SHU, tint: SHU_RED, q: 2, r: 4, hp: 240, atk: 12, ult: '青龙偃月', ultDmg: 45, ultSize: 80, atkType: 'melee', ultFx: F_FX_STRIKE, items: ['yuxi'] },
  { id: 'a_zhaoyun', name: '赵云', key: F_HERO.zhao_yun, team: TEAM_A, enemy: TEAM_B, cls: WARRIOR, faction: FACT_SHU, tint: SHU_RED, q: 4, r: 4, hp: 165, atk: 18, ult: '七进七出', ultDmg: 75, ultSize: 55, atkType: 'melee', ultFx: F_FX_STRIKE, items: ['qinggang'] },
  { id: 'a_zhuge', name: '诸葛亮', key: F_HERO.zhuge_liang, team: TEAM_A, enemy: TEAM_B, cls: TACTICIAN, faction: FACT_SHU, tint: SHU_RED, q: 2, r: 6, hp: 120, atk: 24, ult: '八阵图', ultDmg: 35, ultSize: 95, atkType: 'magic', ultFx: F_FX_FROST, ultFreeze: 120 },
  { id: 'a_zhouyu', name: '周瑜', key: F_HERO.zhou_yu, team: TEAM_A, enemy: TEAM_B, cls: TACTICIAN, faction: FACT_WU, tint: WU_GREEN, q: 4, r: 6, hp: 115, atk: 21, ult: '火烧赤壁', ultDmg: 38, ultSize: 92, atkType: 'magic', ultFx: F_FX_FLAME, ultDot: true },
  // 魏（TEAM_B，上半场 r0..3，蓝）+ 吴·甘宁（绿）：武将压中线 r3、谋士/刺客缩后排 r1
  { id: 'b_zhangliao', name: '张辽', key: F_HERO.zhang_liao, team: TEAM_B, enemy: TEAM_A, cls: WARRIOR, faction: FACT_WEI, tint: WEI_BLUE, q: 2, r: 3, hp: 200, atk: 15, ult: '突阵', ultDmg: 50, ultSize: 70, atkType: 'melee', ultFx: F_FX_STRIKE, items: ['fangtian'] },
  { id: 'b_xuchu', name: '许褚', key: F_HERO.xu_chu, team: TEAM_B, enemy: TEAM_A, cls: WARRIOR, faction: FACT_WEI, tint: WEI_BLUE, q: 4, r: 3, hp: 270, atk: 11, ult: '裸衣血战', ultDmg: 42, ultSize: 78, atkType: 'melee', ultFx: F_FX_STRIKE },
  { id: 'b_simayi', name: '司马懿', key: F_HERO.sima_yi, team: TEAM_B, enemy: TEAM_A, cls: TACTICIAN, faction: FACT_WEI, tint: WEI_BLUE, q: 3, r: 1, hp: 130, atk: 23, ult: '鬼谋', ultDmg: 40, ultSize: 88, atkType: 'magic', ultFx: F_FX_DRAIN, ultDot: true, items: ['qinggang'] },
  { id: 'b_ganning', name: '甘宁', key: F_HERO.gan_ning, team: TEAM_B, enemy: TEAM_A, cls: ASSASSIN, faction: FACT_WU, tint: WU_GREEN, q: 5, r: 1, hp: 145, atk: 20, ult: '锦帆突袭', ultDmg: 60, ultSize: 50, atkType: 'ranged', ultFx: F_FX_ARROW },
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

// ── 棋子 overrides 包（统一管道）：星级数值（血 ×1.8^(星-1)、strike/ult_s<星> 换弹=伤 ×1.5^(星-1)，
// SelfRule.do 字段级补丁保 when/whenGlobal）+ 阵营 Tag + HexPos——静态 {q,r}（敌槽烘死）或
// '@origin-hex' 哨兵（席位 marker 跟手，REQ-F-049：prefab 以持位者当拍格代入）。hpMul=§4.5 敌阵强度口径。
function heroOverrides(h: HeroSpec, star: number, hexPos: Record<string, unknown> | string, hpMul = 1): Record<string, unknown> {
  const hp = Math.round(finalHp(h) * hpMul * STAR_HP_MUL[star]);
  return {
    main: {
      HexPos: hexPos,
      Tag: { flags: h.team | h.cls | h.faction },
      Resource: { current: hp, max: hp },
      ...(star >= 2 ? { SelfRule: { do: [{ kind: 'spawn', template: `strike_${h.id}_s${star}`, at: 'target' }] } } : {}),
    },
    ...(star >= 2 ? { mana: { SelfRule: { do: [{ kind: 'spawn', template: `ult_${h.id}_s${star}`, at: 'target' }, { kind: 'modify-resource', op: 'set', value: 0 }] } } } : {}),
  };
}

// ── 敌方阵容槽位（持久数据，REQ-F-032）：无 TEAM 位 → wipe 清场不波及；跨回合常驻。──
// 收到展开信号 → 在自身 Transform（= project(q,r) 投影坐标，消除展开后一帧跳变）处展开自己的棋子，
// overrides 写真值（站位/阵营/数值）。我方不再用固定槽——席位 marker 即部署源（REQ-F-049 统一），见模板。
function slotEntity(h: HeroSpec, onSignal: string, col: number, row: number, hpMul = 1): EntityBlueprint {
  const a = offsetToAxial(col, row); // 摆子数据=视觉 (col,row)，sim 真相=axial（REQ-F-037 odd-r 迁移）
  const p = project(a.q, a.r);
  return {
    Transform: xf(p.x, p.y),
    Caster: { onSignal, template: `hero_${h.id}`, at: 'self', overrides: heroOverrides(h, 1, { q: a.q, r: a.r }, hpMul) },
  } as unknown as EntityBlueprint;
}

// ── 关卡表（flow-spec §4.5，前 2 阶段）：敌阵=数据条目、与我方槽位同构；扩阶段=加条目+一行 when_deploy_stage_N。──
// 注：敌方强度暂只缩放 HP（攻击力烘在 strike_<id> 模板 amount 里；按阶段缩攻=每阶段一套 strike 模板，真需要再加）。
const STAGES: { n: number; comp: { hero: string; q: number; r: number; hpMul: number }[] }[] = [
  // （阶段1 无 PvP 敌阵——按准则整段野怪化，黄巾散兵=PVE_WAVES[0]，见下；坐标=7×8 视觉 col 0..6 / row 0..3 敌半场）
  {
    n: 2, // 阶段2「董卓先锋」：4 子全强度（张辽自带方天画戟 ≈ §4.5 的"+1 件装"）
    comp: [
      { hero: 'b_zhangliao', q: 2, r: 3, hpMul: 1 },
      { hero: 'b_xuchu', q: 4, r: 3, hpMul: 1 },
      { hero: 'b_simayi', q: 3, r: 1, hpMul: 1 },
      { hero: 'b_ganning', q: 5, r: 1, hpMul: 1 },
    ],
  },
  {
    n: 3, // 阶段3「吕布陷阵」：5 子 + 2 星点缀（hpMul1.8≈2星）——同模板多实例（F-9 per-instance）
    comp: [
      { hero: 'b_zhangliao', q: 1, r: 3, hpMul: 1.8 },
      { hero: 'b_zhangliao', q: 5, r: 3, hpMul: 1 },
      { hero: 'b_xuchu', q: 3, r: 3, hpMul: 1 },
      { hero: 'b_simayi', q: 3, r: 1, hpMul: 1 },
      { hero: 'b_ganning', q: 5, r: 1, hpMul: 1 },
    ],
  },
  {
    n: 4, // 阶段4「官渡精锐」：6 子、整体 1.4×（羁绊成型近似——羁绊机制 Phase 3）
    comp: [
      { hero: 'b_zhangliao', q: 1, r: 3, hpMul: 1.4 },
      { hero: 'b_zhangliao', q: 5, r: 3, hpMul: 1.4 },
      { hero: 'b_xuchu', q: 2, r: 3, hpMul: 1.4 },
      { hero: 'b_xuchu', q: 4, r: 3, hpMul: 1.4 },
      { hero: 'b_simayi', q: 3, r: 1, hpMul: 1.4 },
      { hero: 'b_ganning', q: 5, r: 1, hpMul: 1.4 },
    ],
  },
  {
    n: 5, // 阶段5「赤壁决战」：7 子 + Boss 许褚（hpMul3，终关）
    comp: [
      { hero: 'b_xuchu', q: 3, r: 2, hpMul: 3 },
      { hero: 'b_zhangliao', q: 1, r: 3, hpMul: 1.8 },
      { hero: 'b_zhangliao', q: 5, r: 3, hpMul: 1.8 },
      { hero: 'b_xuchu', q: 2, r: 3, hpMul: 1.4 },
      { hero: 'b_simayi', q: 2, r: 1, hpMul: 1.8 },
      { hero: 'b_simayi', q: 4, r: 1, hpMul: 1.4 },
      { hero: 'b_ganning', q: 5, r: 0, hpMul: 1.8 },
    ],
  },
];
const heroOf = (id: string): HeroSpec => ROSTER.find((h) => h.id === id)!;

// ── 野怪波次（一图流：阶段1×4回合+每阶段末回合(r5)；固定阵容、死亡掉法球💰）──
// 强度随阶段爬坡；图暂借甘宁（真野怪皮=美术 pass，见 art-data 待办）。掉落链：Mortal.dropTemplate（引擎现成）。
const PVE_WAVES: { stage: number; count: number; hpMul: number; atk: number }[] = [
  { stage: 1, count: 3, hpMul: 0.35, atk: 6 },
  { stage: 2, count: 4, hpMul: 0.6, atk: 9 },
  { stage: 3, count: 4, hpMul: 0.9, atk: 13 },
  { stage: 4, count: 5, hpMul: 1.2, atk: 17 },
  { stage: 5, count: 6, hpMul: 1.6, atk: 22 },
];
const MOB_BASE_HP = 90; // ×HP_SCALE×hpMul = 实际血量
// 野怪模板：简化棋子（无大招/蓝条；带血条+名牌；死亡掉法球）。Tag/血量由槽位 overrides 写。
function mobTemplate(atk: number): PrefabTemplate {
  return {
    entities: {
      main: {
        Transform: xf(0, 0),
        Shape: { kind: 'box', width: 16, height: 16 },
        Tag: { flags: 0 },
        Resource: { id: 'hp', current: 1, min: 0, max: 1 },
        Perception: { targetTag: TEAM_A, sightRadius: 0 },
        HexPos: { q: 0, r: 0 },
        GridMover: { period: MOVE_PERIOD, elapsed: 0, haltStatusMask: FROZEN, glideSpeed: 0.8 },
        Mortal: { resource: 'hp', atOrBelow: 0, dropTemplate: 'loot_orb' }, // 死亡掉法球（§4.7 掉落源）
        Timer: { id: 'atk', elapsed: 0, duration: ATK_CD, loop: true },
        SelfRule: { when: { kind: 'timer', id: 'atk', cmp: 'gte', value: ATK_CD - 1 }, whenGlobal: { kind: 'flag', id: 'in_combat', equals: true }, do: [{ kind: 'spawn', template: `strike_mob_${atk}`, at: 'target' }], once: false, armed: false },
        Sprite: sprite(F_HERO.gan_ning, 4),
      },
      name: {
        Transform: xf(0, -34),
        Text: { content: '黄巾賊', fontSize: 9, fontFamily: 'sans-serif', anchor: 'center', lineSpacing: 0 },
        Color: { tint: 0xc9a86a, alpha: 1 },
        Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 30 },
        Hierarchy: { ...sidecarLink, localY: -34 },
      },
      hpbg: { Transform: xf(0, HP_Y), Shape: { kind: 'box', width: BAR_W, height: 5 }, Hierarchy: { ...sidecarLink, localY: HP_Y }, Color: { tint: trackColor, alpha: 0.85 } },
      hpbar: { Transform: xf(0, HP_Y), Shape: { kind: 'box', width: BAR_W, height: 5 }, Hierarchy: { ...sidecarLink, localY: HP_Y }, Color: { tint: 0x33cc33, alpha: 1 }, Gauge: { resourceId: 'hp', fromParent: true, width: BAR_W } },
    },
  } as unknown as PrefabTemplate;
}

// ── 商店（F-11 / REQ-F-040 + v2 §4.6）：英雄码 + 单人有限牌袋（预洗、确定性；§4.4 牌袋语义）──
// 码 0 保留为「无」（bought_code 复位值）。MVP 袋 = 我方 4 将各 3 张（卖出归还/按等级加权袋 = 后续）。
const HERO_CODE: Record<string, number> = { a_guanyu: 1, a_zhaoyun: 2, a_zhuge: 3, a_zhouyu: 4 };
// 每将 9 张：自动刷新每回合弃 5 补 5，有限袋按 v2 §4.6 语义随对局消耗（卖出归还袋底，048②）。
// F-17 升星后 3 星需同将 9 张 → 袋从 6/将扩到 9/将；**只追加不重排**——前 24 张次序锁死既有验收断言。
const SHOP_DECK = [3, 1, 4, 2, 2, 4, 1, 3, 1, 2, 3, 4, 4, 2, 1, 3, 3, 1, 2, 4, 2, 3, 4, 1, 1, 2, 3, 4, 4, 3, 2, 1, 2, 4, 1, 3];
// ── 升星数值（F-17/REQ-F-046，§4.6）：每星 血 ×1.8 / 攻与大招 ×1.5；卖价 1星=现行2金、2星=3×3−1、3星=3×9−1。──
const STAR_HP_MUL = [0, 1, 1.8, 3.24]; // 索引=星级
const STAR_DMG_MUL = [0, 1, 1.5, 2.25];
const SELL_PRICE = [0, 2, 8, 26];
const STAR_GLYPH = ['', '', '★★', '★★★'];
const STAR_SCALE = [1, 1, 1.18, 1.38]; // marker 按星级放大（索引=星级）——升星一眼可辨（用户报「看不出升级」）

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
// 横幅三选一：信号到 → 显 show、藏 hides（set-visible 矩阵，纯数据）。
function visSwap(sig: string, show: string, hides: string[]): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {
    [`eff_${sig}_show`]: { Effect: { onSignal: sig, kind: 'set-visible', targetId: '', targetEntity: show, value: true } } as unknown as EntityBlueprint,
  };
  hides.forEach((h, i) => {
    out[`eff_${sig}_hide${i}`] = { Effect: { onSignal: sig, kind: 'set-visible', targetId: '', targetEntity: h, value: false } } as unknown as EntityBlueprint;
  });
  return out;
}

// 每英雄三张模板：普攻打击区 + 大招打击区 + 棋子复合体（REQ-F-032 回合重展开用）。targetMask=敌队。
export const GAME_F_TEMPLATES: Record<string, PrefabTemplate> = Object.fromEntries(
  ROSTER.flatMap((h): [string, PrefabTemplate][] => [
    [`strike_${h.id}`, strike(h.enemy, finalAtk(h), FX_BY_TYPE[h.atkType], h.team === TEAM_A ? 'dmg_scale_a' : 'dmg_scale_b')],
    [`ult_${h.id}`, ultTemplate(h.enemy, h.ultDmg, h.ultSize, h.ultFx, h.ultDot, h.ultFreeze, h.team === TEAM_A ? 'dmg_scale_a' : 'dmg_scale_b')],
    [`hero_${h.id}`, heroTemplate(h)],
  ]).concat(
    // 备战席位模板（v2 §4.6 + F-17 升星家族 + F-18/REQ-F-049 统一架构）：**席位 marker 即上场槽**。
    // 每将三档星级模板（bench/bench2/bench3）= merge-rule「同模板才互相计数」家族（策划 F-17 原批注语义），
    // 星级数值烘在各档模板的 Caster.overrides 里——无星级资源/计数带，模板家族本身就是星级。
    // · 部署源：Caster{onSignal:'deploy', requireHexPos}——拖上板（有 HexPos）= 入战拍在自己格出兵
    //   （main.HexPos='@origin-hex' 哨兵跟手）；在席/拖回（无 HexPos）= 静默。
    // · 可拖（F-18/REQ-F-045 全量）：snap 六角格 + in_prep 相位门 + 上板限额（Tag&BENCH_OCC∧HexPos ≤ level）。
    // · 可点卖出（F-12/F-17）：sell[星]_<将> 信号 '@signal-source' 点谁卖谁（板上/席上均可卖）。
    // · 不参战：无 TEAM 位（zone/aggro/hitbox/wipe 全不沾）；REQ-F-051 后在板也不挡棋子寻路。
    ROSTER.filter((x) => x.team === TEAM_A).flatMap((h): [string, PrefabTemplate][] =>
      [1, 2, 3].map((s): [string, PrefabTemplate] => [
        s === 1 ? `bench_${h.id}` : `bench${s}_${h.id}`,
        {
          entities: {
            // 星级放大（用户报「升星看不出、像没发生」）：1/2/3 星 marker 按 1.0/1.18/1.38 缩放 → 一眼见大小差。
            seat: {
              Transform: { x: 0, y: 0, rotation: 0, scaleX: STAR_SCALE[s], scaleY: STAR_SCALE[s] },
              Sprite: sprite(h.key, 2),
              Shape: { kind: 'box', width: 30, height: 30 },
              Clickable: { action: s === 1 ? `sell_${h.id}` : `sell${s}_${h.id}`, phase: 'up' }, // 'up'=点拖互斥（REQ-F-053）：拖拽不产 up，按住起拖不会误卖
              Tag: { flags: BENCH_OCC | MARKER_VIS }, // MARKER_VIS：战斗期隐藏（REQ-F-056，消幽灵）
              Visibility: { visible: true, active: true }, // 备战可见；ph_combat→隐藏 / ph_prep→显
              Draggable: { snap: 'hex', onlyFlag: 'in_prep', capTagMask: BENCH_OCC, capResource: 'level' },
              Caster: { onSignal: 'deploy', template: `hero_${h.id}`, at: 'self', requireHexPos: true, overrides: heroOverrides(h, s, '@origin-hex') },
            },
            ...(s >= 2
              ? {
                  // ★ 角标：2 星银 / 3 星金，字号加大，带描边底板 —— 升星辨识度（合成功能本身已验证正确，纯视觉强化）。
                  star: {
                    Transform: xf(0, -26),
                    Text: { content: STAR_GLYPH[s], fontSize: s === 3 ? 16 : 14, fontFamily: 'sans-serif', anchor: 'center', lineSpacing: 0 },
                    Color: { tint: s === 3 ? 0xffd24a : 0xe8e8f0, alpha: 1 }, // 3星金 / 2星银
                    Tag: { flags: MARKER_VIS }, // ★ 角标随 seat 一起隐显（不带 BENCH_OCC=不计席位占用）
                    Visibility: { visible: true, active: true },
                    Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 31 },
                    Hierarchy: { parentId: '@local:seat', localX: 0, localY: -26, localRotation: 0, localScaleX: 1, localScaleY: 1 },
                  },
                }
              : {}),
          },
        } as unknown as PrefabTemplate,
      ]),
    ),
    // 升星武器模板（F-17）：二/三星普攻与大招打击区（伤害 ×1.5/×2.25），槽位 overrides 给棋子换弹（SelfRule.do）。
    ROSTER.filter((x) => x.team === TEAM_A).flatMap((h): [string, PrefabTemplate][] =>
      [2, 3].flatMap((s): [string, PrefabTemplate][] => [
        [`strike_${h.id}_s${s}`, strike(h.enemy, Math.round(finalAtk(h) * STAR_DMG_MUL[s]), FX_BY_TYPE[h.atkType], 'dmg_scale_a')],
        [`ult_${h.id}_s${s}`, ultTemplate(h.enemy, Math.round(h.ultDmg * STAR_DMG_MUL[s]), h.ultSize, h.ultFx, h.ultDot, h.ultFreeze, 'dmg_scale_a')],
      ]),
    ),
    // 野怪（批B）：每档攻一张 strike + 一张 mob 模板；法球=死亡掉落（LOOT 标记，主角拾取=批C；结算清场兜底）。
    PVE_WAVES.map((w): [string, PrefabTemplate] => [`strike_mob_${w.atk}`, strike(TEAM_A, w.atk, F_FX_BOLT)]),
    PVE_WAVES.map((w): [string, PrefabTemplate] => [`mob_s${w.stage}`, mobTemplate(w.atk)]),
    [[
      'loot_orb',
      { entities: { orb: { Transform: xf(0, 0), Shape: { kind: 'box', width: 10, height: 10 }, Sensor: {}, Sprite: sprite(F_FX_DRAIN, 5), Color: { tint: 0xffd700, alpha: 1 }, Tag: { flags: LOOT | ZONE_FLAG }, Hitbox: { resource: 'loot', amount: -5, targetMask: PROTAG, consumeOnHit: true } } } } as unknown as PrefabTemplate, // 044：真结算一次入账-5(负=给予)同拍自毁；主角零附件
    ]] as [string, PrefabTemplate][],
    // 商店大卡（F-14 重排/用户钦定）：在售英雄的可点大卡面（60×68 占满大框）+ 名字签 + **价签**（用户报缺）；
    // Clickable.action(买哪框)/Tag(槽位掩码) 由持位 Caster overrides 注入。价 = playCosts 金 3（统一费）。
    ROSTER.filter((x) => x.team === TEAM_A).map((h): [string, PrefabTemplate] => [
      `shopcard_${h.id}`,
      { entities: {
        card: { Transform: xf(0, 0), Shape: { kind: 'box', width: 58, height: 68 }, Sprite: sprite(h.key, 28), Color: { tint: 0xf0d27a, alpha: 1 }, Clickable: { action: 'ph' }, Tag: { flags: 0 } },
        cardname: { Transform: xf(0, -26), Text: { content: h.name, fontSize: 9, fontFamily: 'sans-serif', anchor: 'center', lineSpacing: 0 }, Color: { tint: 0x20140a, alpha: 1 }, Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 29 }, Hierarchy: { parentId: '@local:card', localX: 0, localY: -26, localRotation: 0, localScaleX: 1, localScaleY: 1 } },
        cardprice: { Transform: xf(0, 28), Text: { content: '💰3', fontSize: 11, fontFamily: 'sans-serif', anchor: 'center', lineSpacing: 0 }, Color: { tint: 0xffe28a, alpha: 1 }, Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 29 }, Hierarchy: { parentId: '@local:card', localX: 0, localY: 28, localRotation: 0, localScaleX: 1, localScaleY: 1 } },
      } } as unknown as PrefabTemplate,
    ]),
  ),
);

// 竞技场=棋盘区（7×8 盘 x≈±150 / y≈-155..95；下方托盘/商店带不在内——席上 marker 本就无 TEAM 位，双保险）。
const ARENA = { minX: -170, minY: -165, maxX: 170, maxY: 110 };
// 备战席托盘（用户钦定：下排英雄平台，非六角格；9 槽、可互换、买入自动落座；皮=placeholder 待 UI 资源）。
const TRAY = { originX: -176, originY: 118, gap: 44, capacity: 9 };
// 商店三大框（用户钦定：小丑牌式选卡页，替代金铲铲 5 小槽——形态偏离准则，按用户指令执行）。
const SHOP_XS = [-70, 0, 70];
const SHOP_Y = 168;

// L2 回合流程（flow-spec §3.3 round_flow 原样）：prep⟲combat⟲resolution⟲done 与 L1 round_done 握手。
// 回合重置（REQ-F-032）：prep 臂 deploy_armed → EventWhen(edge) → 'deploy'/'deploy_stage_<N>' → 槽位重展开；
// resolution 臂 wipe_armed → 'wipe' → destroy-tagged 清场。经济/伤害不再写死在 flow：prep 臂 income_armed、
// 败方臂 dmg_armed，由 banded EventWhen→Effect 按 §4.1/§4.2 表结算（见 goldBand/伤害 bands）。
// 尚缺 ready 开战输入（§6.2 P2，输入路由归主程）：prep 暂以 after 40 自动开战，接上后改读 ready Flag。
const makeRoundFlow = (PREP_TICKS: number, RESOLUTION_TICKS: number) => {
  // 开战倒计时（用户第 3 条）：prep 末尾恒有 3 秒读数（玩家档 180 拍；快速档按比例缩、总时长不变=
  // 既有时序断言零漂移）。ready 提前 → 也先进 countdown 数完再打，不许瞬开。
  const CD_TICKS = Math.min(180, Math.max(6, Math.floor(PREP_TICKS / 4)));
  const PREP_SECONDS = Math.max(3, Math.round(PREP_TICKS / 60));
  const TO_COMBAT = [
    { kind: 'set-flag', targetId: 'in_combat', value: true },
    { kind: 'set-flag', targetId: 'in_prep', value: false },
    { kind: 'set-flag', targetId: 'cap_armed', value: true },
    { kind: 'set-flag', targetId: 'deploy_armed', value: true }, // 入战拍臂 deploy：双方棋子此拍从 marker/敌槽成型
    { kind: 'set-flag', targetId: 'income_armed', value: false }, // 收入窗随备战关（利息带不吃战斗期金额波动）
    { kind: 'modify-resource', targetId: 'prep_left', op: 'set', value: 0 },
  ];
  return {
  id: 'round',
  current: 'prep',
  entered: false,
  elapsed: 0,
  states: [
    {
      id: 'prep', // 备战：臂收入（§4.1 banded 发钱），复位 wipe/伤害/ready；点「开战」或倒计时耗尽 → 3 秒读数 → 开打
      onEnter: [
        { kind: 'set-state', targetId: 'round_ui', value: 'prep' },
        { kind: 'set-flag', targetId: 'in_combat', value: false },
        { kind: 'set-flag', targetId: 'in_prep', value: true }, // 摆子/整理拖拽相位门（F-18 Draggable.onlyFlag）
        { kind: 'set-flag', targetId: 'ready', value: false }, // 每回合重臂（§3.3 操作表「开战」）
        { kind: 'set-flag', targetId: 'wipe_armed', value: false }, // 复位，下次结算再臂（edge 纪律）
        { kind: 'set-flag', targetId: 'dmg_armed', value: false },
        { kind: 'set-flag', targetId: 'cap_armed', value: false }, // 超员检查窗复位（F-17，入战拍再臂）
        { kind: 'set-flag', targetId: 'deploy_armed', value: false }, // 复位；部署窗在入战拍（REQ-F-049 拖拽即时反馈）
        { kind: 'set-flag', targetId: 'income_armed', value: true }, // → 基础收入/利息/连胜金 bands（§4.1）
        { kind: 'set-flag', targetId: 'shop_refresh_armed', value: true }, // → 自动刷新（锁店时门挡，v2 §4.6）
        { kind: 'modify-resource', targetId: 'prep_left', op: 'set', value: PREP_SECONDS }, // 倒计时表归位（OverTime -1/秒，0 钳停）
        { kind: 'modify-resource', targetId: 'xp', op: 'add', value: 2 }, // 每回合自动 +2 XP（§4.3）
        { kind: 'modify-resource', targetId: 'dmg_scale_a', op: 'set', value: 1 }, // 羁绊系数回 1（开战拍重新锁存）
      ],
      transitions: [
        { when: { kind: 'flag', id: 'ready', equals: true }, to: 'countdown' }, // 点「开战」→ 3 秒读数（不瞬开）
        { when: { kind: 'always' }, after: Math.max(1, PREP_TICKS - CD_TICKS), to: 'countdown' }, // 倒计时兜底（总时长 = PREP_TICKS 不变）
      ],
    },
    {
      id: 'countdown', // 开战读数 3-2-1（round_ui 仍 prep：横幅/商店不变，仅 hud_timer 跳数；摆子在读数期仍可调）
      onEnter: [{ kind: 'modify-resource', targetId: 'prep_left', op: 'set', value: 3 }],
      transitions: [{ when: { kind: 'always' }, after: CD_TICKS, to: 'combat', do: TO_COMBAT }],
    },
    {
      id: 'combat', // 战斗：自动互砍 + 蓝满放大招；某队团灭(present flag→false)→结算。胜→连胜+1；败→连胜清零+臂伤害
      onEnter: [{ kind: 'set-state', targetId: 'round_ui', value: 'combat' }],
      transitions: [
        // after 30 = 最短驻留（部署移入战拍后，棋子成型前 present 旗仍是备战期的 false——给 deploy→prefab→zone
        // 链 ~4 拍落定 + 余量；0.5s 玩家不可感知，真团灭以「拍」计照常生效）。
        { when: { kind: 'flag', id: 'team_b_present', equals: false }, after: 30, to: 'resolution', do: [{ kind: 'set-flag', targetId: 'won', value: true }, { kind: 'modify-resource', targetId: 'win_streak', op: 'add', value: 1 }, { kind: 'modify-resource', targetId: 'lose_streak', op: 'set', value: 0 }] },
        { when: { kind: 'flag', id: 'team_a_present', equals: false }, after: 30, to: 'resolution', do: [{ kind: 'set-flag', targetId: 'won', value: false }, { kind: 'modify-resource', targetId: 'win_streak', op: 'set', value: 0 }, { kind: 'modify-resource', targetId: 'lose_streak', op: 'add', value: 1 }, { kind: 'set-flag', targetId: 'dmg_armed', value: true }] },
        // 加时强制结束（30s+15s=2700拍，一图流；单人改编=按败方路径结算+连败，准则双伤的单人合理化）
        { when: { kind: 'timer', id: 'combat_clock', cmp: 'gte', value: 2700 }, to: 'resolution', do: [{ kind: 'set-flag', targetId: 'won', value: false }, { kind: 'modify-resource', targetId: 'win_streak', op: 'set', value: 0 }, { kind: 'modify-resource', targetId: 'lose_streak', op: 'add', value: 1 }, { kind: 'set-flag', targetId: 'dmg_armed', value: true }] },
      ],
    },
    {
      id: 'resolution', // 结算：停战 + 清场（wipe→destroy-tagged）；玩家血尽→gameover，否则数拍后进 done 与 L1 握手
      onEnter: [
        { kind: 'set-state', targetId: 'round_ui', value: 'resolution' },
        { kind: 'set-flag', targetId: 'in_combat', value: false },
        // 关部署窗（实测坑）：窗若跨 resolution 活到 advance，stage/round 指针翻转会让 deploy_stage_N 带
        // 在窗内 false→true 误发（清场后多铺一波=双倍敌阵）。窗语义=「恰本场战斗的入战拍」，结算即关。
        { kind: 'set-flag', targetId: 'deploy_armed', value: false },
        { kind: 'set-flag', targetId: 'wipe_armed', value: true }, // → 'wipe'
      ],
      transitions: [
        { when: { kind: 'resource', id: 'player_hp', cmp: 'lte', value: 0 }, to: 'gameover' },
        { when: { kind: 'always' }, after: RESOLUTION_TICKS, to: 'done' },
      ],
    },
    {
      id: 'done', // 通知 L1（round_done=true）；L1 advance 推进指针并复位 round_done → 回 prep 开下一回合
      onEnter: [{ kind: 'set-flag', targetId: 'round_done', value: true }],
      transitions: [{ when: { kind: 'flag', id: 'round_done', equals: false }, to: 'prep' }],
    },
    { id: 'gameover', onEnter: [{ kind: 'set-state', targetId: 'round_ui', value: 'gameover' }, { kind: 'set-flag', targetId: 'run_over', value: true }] },
  ],
  };
};

// L1 局流程（flow-spec §3.2 run_flow 原样）：boot 初始化 → round（等 L2 写 round_done）→ advance 推进
// 关卡指针 → 打穿关卡表胜利 / run_over 败北。round_idx>5 的进位（stage+1、round=1）由 when_stage_up banded 处理。
// 关卡表全 5 阶段（§4.5）→ stage_idx>5 即通关。
const STAGE_COUNT = 5;
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

// 节奏档（玩家视角修正：备战 ~30s 给操作时间——准则 §1.2；ready 可跳过；结算 4s 可读）。
// 测试传快速档 {prepTicks:40, resolutionTicks:60} 保持既有时序断言；缺省=玩家档。
export interface GameFPacing { prepTicks?: number; resolutionTicks?: number }
export function buildGameFBlueprint(pacing: GameFPacing = {}): WorldBlueprint {
  const PREP_TICKS = pacing.prepTicks ?? 1800; // 30s@60tps
  const RESOLUTION_TICKS = pacing.resolutionTicks ?? 240; // 4s
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
    flow_ctrl: { GameFlow: makeRoundFlow(PREP_TICKS, RESOLUTION_TICKS) } as unknown as EntityBlueprint, // L2 round_flow（节奏=装配参数）
    flow_run: { GameFlow: RUN_FLOW } as unknown as EntityBlueprint, // L1 run_flow（§3.2）
    f_in_combat: { Flag: { id: 'in_combat', active: false } } as unknown as EntityBlueprint,
    f_in_prep: { Flag: { id: 'in_prep', active: false } } as unknown as EntityBlueprint, // 备战相位（F-18 拖拽门；flow prep 进出维护）
    f_won: { Flag: { id: 'won', active: false } } as unknown as EntityBlueprint,
    f_over: { Flag: { id: 'run_over', active: false } } as unknown as EntityBlueprint,
    f_round_done: { Flag: { id: 'round_done', active: false } } as unknown as EntityBlueprint, // L1↔L2 握手
    f_run_won: { Flag: { id: 'run_won', active: false } } as unknown as EntityBlueprint, // 打穿关卡表=通关
    r_gold: { Resource: { id: 'gold', current: 0, min: 0, max: 999 } } as unknown as EntityBlueprint,
    r_player_hp: { Resource: { id: 'player_hp', current: 100, min: 0, max: 100 } } as unknown as EntityBlueprint, // §3.1：0..100（旧 20 是 MVP-0 占位）
    r_round_idx: { Resource: { id: 'round_idx', current: 1, min: 0, max: 999 } } as unknown as EntityBlueprint, // 回合序号（advance +1，>5 进位）
    r_stage_idx: { Resource: { id: 'stage_idx', current: 1, min: 0, max: 99 } } as unknown as EntityBlueprint, // 阶段序号（关卡表指针）
    r_win_streak: { Resource: { id: 'win_streak', current: 0, min: 0, max: 999 } } as unknown as EntityBlueprint, // 连胜数（§4.1 连胜金）
    r_lose_streak: { Resource: { id: 'lose_streak', current: 0, min: 0, max: 999 } } as unknown as EntityBlueprint, // 连败数（§4.1 连败金，准则 P2 与连胜同形）
    r_xp: { Resource: { id: 'xp', current: 0, min: 0, max: 999 } } as unknown as EntityBlueprint, // 经验（每回合 +2；买经验 $4=+4，§4.3）
    r_level: { Resource: { id: 'level', current: 4, min: 1, max: 8 } } as unknown as EntityBlueprint, // 等级=人口上限（起始 4=现固定阵容；摆子约束=输入域）
    // —— 回合重置接线（REQ-F-032）：flow 臂旗标 → EventWhen(edge) 产单拍信号 → 槽位展开 / destroy-tagged 清场 ——
    // —— ready 开战（§3.3 操作表，策划批注：输入→信号→set-flag 纯数据）：点按钮 → clickable 产 'ready_btn'
    // 信号 → Effect 置 ready → prep 的 ready 转移提前开战；不点则 40 拍倒计时兜底。按钮无 Tag 不参战不被清场。
    f_ready: { Flag: { id: 'ready', active: false } } as unknown as EntityBlueprint,
    btn_ready: {
      Transform: xf(300, 180), // 右下按钮列（视口 ±355×200；商店三大框居中后按钮整列右移）
      Shape: { kind: 'box', width: 64, height: 24 },
      Clickable: { action: 'ready_btn' },
      Text: { content: '开战', fontSize: 13, fontFamily: 'sans-serif', anchor: 'center', lineSpacing: 0 },
      Color: { tint: 0xd4a017, alpha: 1 },
      Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 30 }, // 只为抬 zOrder（文本模式不绘）
    } as unknown as EntityBlueprint,
    eff_ready: { Effect: { onSignal: 'ready_btn', kind: 'set-flag', targetId: 'ready', value: true } } as unknown as EntityBlueprint,
    // —— 开战倒计时（用户第 3 条：按下开战不许瞬开，要数 3-2-1；备战全程也有可见倒计时）——
    // 零引擎件重组：prep_left 资源被 min=0 钳住即自停 → OverTime 永久 -1/秒 = 自终止秒表；
    // flow 各相位 set 30 / 3 / 0（prep 进 / countdown 进 / combat 进）。HUD 数字 TextBinding 实时投影。
    r_prep_left: {
      Resource: { id: 'prep_left', current: 30, min: 0, max: 99 },
      OverTime: { effects: [{ id: 'cd_tick', resource: 'prep_left', amountPerTick: -1, period: 60, duration: 0, elapsed: 0 }] },
    } as unknown as EntityBlueprint,
    hud_timer: {
      Transform: xf(0, -160),
      Text: { content: '开战 30', fontSize: 18, fontFamily: 'sans-serif', anchor: 'center', lineSpacing: 0 },
      TextBinding: { resourceId: 'prep_left', prefix: '开战 ' },
      Color: { tint: 0xffd700, alpha: 1 },
      Visibility: { visible: true },
      Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 31 },
    } as unknown as EntityBlueprint,
    eff_timer_show: { Effect: { onSignal: 'ph_prep', kind: 'set-visible', targetId: '', targetEntity: 'hud_timer', value: true } } as unknown as EntityBlueprint,
    eff_timer_hide: { Effect: { onSignal: 'ph_combat', kind: 'set-visible', targetId: '', targetEntity: 'hud_timer', value: false } } as unknown as EntityBlueprint,
    eff_timer_hide2: { Effect: { onSignal: 'ph_res', kind: 'set-visible', targetId: '', targetEntity: 'hud_timer', value: false } } as unknown as EntityBlueprint,
    // —— marker 战斗期隐藏（REQ-F-056，消「武将复制、老的没删」幽灵）：开战拍藏全部 marker（seat+★），
    // 备战拍再显。marker 持久（记布阵不删），战斗期它的 Caster 生成会动的战斗棋子 → 不藏就双重显示。
    eff_marker_hide: { Effect: { onSignal: 'ph_combat', kind: 'set-visible-tagged', targetId: '', tagMask: MARKER_VIS, value: false } } as unknown as EntityBlueprint,
    eff_marker_show: { Effect: { onSignal: 'ph_prep', kind: 'set-visible-tagged', targetId: '', tagMask: MARKER_VIS, value: true } } as unknown as EntityBlueprint,
    // —— 商店（F-11，REQ-F-040；v2 §4.6 五件套之「买入核心」。刷新/锁店/卖出撞新缺口已提 REQ-F-041）——
    // 买 = 输入 play(槽下标)（点击→play 的指针路由属 launcher 输入域）：playCosts 原子验扣 金3 + 席位1
    // （钱不够/席满=拒单：牌不丢、金不动）→ 成交牌码写 bought_code → 每将 banded 分发 → marker 入备战席。
    shop: {
      // ⚠️ deck 必须取副本：装配是浅拷贝、嵌套数组按引用共享，发牌原地 shift 会跨 Engine/跨测试泄漏（确定性破口，实测踩过）
      // 三大框（用户钦定小丑牌式）：handSize 3；刷新=旧手回袋底（REQ-F-054 卡池守恒，连刷不枯竭）。
      CardPile: { owner: 'shop', deck: [...SHOP_DECK], hand: [], handSize: 3, playCosts: [{ id: 'gold', amount: 3 }, { id: 'bench_space', amount: 1 }], playedCodeResource: 'bought_code', refreshOnSignal: 'shop_refresh', returnOnSignal: 'card_sold', returnCodeResource: 'sold_code', handCodeResources: ['shop_slot_1', 'shop_slot_2', 'shop_slot_3'], playOnSignals: ['buy_slot_1', 'buy_slot_2', 'buy_slot_3'] },
      PlayedHand: { owner: 'shop', cards: [] },
      Flag: { id: 'shop', active: false },
    } as unknown as EntityBlueprint,
    r_bought_code: { Resource: { id: 'bought_code', current: 0, min: 0, max: 9999 } } as unknown as EntityBlueprint, // 最近一次成交牌码（0=无）
    // —— 备战席容量（F-17 改派生）：bench_space = bench_cap − bench_occupied，每拍 level 信号重算 ——
    // 仍作 playCosts 第二货币（席满=0 原子拒单）；marker 增（买）/减（卖/合成 3→1）全自动对账，
    // 手工 ± 漂移（合成回 2 席没人加）从根上消除。playCosts 扣的 1 会被下一拍重算覆盖（≤3 拍自愈，人手速不可感知）。
    r_bench_space: { Resource: { id: 'bench_space', current: 9, min: 0, max: 11 } } as unknown as EntityBlueprint,
    r_bench_cap: { Resource: { id: 'bench_cap', current: 9, min: 0, max: 11 } } as unknown as EntityBlueprint, // 容量（§4.6 席 9；符文「广纳」+2 改这里）
    r_bench_occupied: { Resource: { id: 'bench_occupied', current: 0, min: 0, max: 99 } } as unknown as EntityBlueprint,
    gc_bench: { GroupCount: { countResource: 'bench_occupied', requiredTag: BENCH_OCC, onBoard: false } } as unknown as EntityBlueprint, // **在席**（无 HexPos）marker 数（REQ-F-052 onBoard:false——拖上板即让席，TFT 席/板分账）
    when_bench_sync: { EventWhen: { signal: 'bench_sync', when: resCmp('bench_cap', 'gte', 0), mode: 'level', armed: false } } as unknown as EntityBlueprint, // 恒真 level=每拍重算
    eff_bench_set: { Effect: { onSignal: 'bench_sync', kind: 'modify-resource', targetId: 'bench_space', op: 'set', value: 0, valueFrom: { resourceId: 'bench_cap' }, order: 1 } } as unknown as EntityBlueprint,
    eff_bench_sub: { Effect: { onSignal: 'bench_sync', kind: 'modify-resource', targetId: 'bench_space', op: 'add', value: 0, valueFrom: { resourceId: 'bench_occupied', coeff: -1 }, order: 2 } } as unknown as EntityBlueprint,
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
    // —— 买经验/等级（§4.3，MVP-1 尾）：$4=+4XP（craft-recipe 原子）；升级=banded（xp 阈值→level set N，单调不回退）——
    btn_xp: {
      Transform: xf(300, 64),
      Shape: { kind: 'box', width: 40, height: 20 },
      Clickable: { action: 'buyxp_btn' },
      CraftRecipe: { onSignal: 'buyxp_btn', costs: [{ id: 'gold', amount: 4 }], gains: [{ id: 'xp', amount: 4 }] },
      Text: { content: '经验$4', fontSize: 11, fontFamily: 'sans-serif', anchor: 'center', lineSpacing: 0 },
      Color: { tint: 0x7ad17a, alpha: 1 },
      Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 30 },
    } as unknown as EntityBlueprint,
    ...band('lvl_5', resCmp('xp', 'gte', 20), 'level', 1),
    ...band('lvl_6', resCmp('xp', 'gte', 36), 'level', 1),
    ...band('lvl_7', resCmp('xp', 'gte', 56), 'level', 1),
    ...band('lvl_8', resCmp('xp', 'gte', 80), 'level', 1), // §4.3 阈值表（升到5/6/7/8）；edge 单发+1，单调封顶 8
    // 手动刷新（2 金）：按钮信号 → craft-recipe 原子扣 2 金置 reroll_paid → EventWhen(edge) → 'shop_refresh' → 复位。
    // 扣不起=配方整单不动（inbox 提示"扣不起就别发信号"的原子等价实现）；手动刷新不吃锁店门（锁住时也可花钱换牌）。
    btn_reroll: {
      Transform: xf(300, 150),
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
      Transform: xf(300, 120),
      Shape: { kind: 'box', width: 40, height: 20 },
      Clickable: { action: 'lock_btn' },
      Text: { content: '锁店', fontSize: 11, fontFamily: 'sans-serif', anchor: 'center', lineSpacing: 0 },
      Color: { tint: 0xd4a017, alpha: 1 },
      Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 30 },
    } as unknown as EntityBlueprint,
    btn_unlock: {
      Transform: xf(300, 92),
      Shape: { kind: 'box', width: 40, height: 20 },
      Clickable: { action: 'unlock_btn' },
      Text: { content: '解锁', fontSize: 11, fontFamily: 'sans-serif', anchor: 'center', lineSpacing: 0 },
      Color: { tint: 0x8a8a8a, alpha: 1 },
      Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 30 },
    } as unknown as EntityBlueprint,
    eff_lock: { Effect: { onSignal: 'lock_btn', kind: 'set-flag', targetId: 'shop_locked', value: true } } as unknown as EntityBlueprint,
    eff_unlock: { Effect: { onSignal: 'unlock_btn', kind: 'set-flag', targetId: 'shop_locked', value: false } } as unknown as EntityBlueprint,
    // 卖出（048② 袋归还版）：点席 → sell_<将>（source=被点席位）→ destroy '@signal-source' + 金2 + 席+1
    // + sold_code=码 → sold_code>0 边沿 → 'card_sold' → CardPile.returnOnSignal 袋底归还（引擎自清 sold_code）。
    r_sold_code: { Resource: { id: 'sold_code', current: 0, min: 0, max: 9999 } } as unknown as EntityBlueprint,
    when_sold: { EventWhen: { signal: 'card_sold', when: resCmp('sold_code', 'gt', 0), mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    // —— 商店 5 槽面板（F-14/REQ-F-042）：handCodeResources 终态镜像 → 两段脉冲（先整槽清、后按码重铺）→ 可点卡面。
    // 脉冲时序：刷新/买入信号 → 臂1 → T+1 'shop_marks'(destroy-tagged 全槽卡 + 臂2) → T+2 重铺带按码展开（清已落地，无同拍误杀）。
    f_marks_armed: { Flag: { id: 'shop_marks_armed', active: false } } as unknown as EntityBlueprint,
    f_marks2_armed: { Flag: { id: 'shop_marks2_armed', active: false } } as unknown as EntityBlueprint,
    eff_marks_on_refresh: { Effect: { onSignal: 'shop_refresh', kind: 'set-flag', targetId: 'shop_marks_armed', value: true } } as unknown as EntityBlueprint,
    when_marks: { EventWhen: { signal: 'shop_marks', when: flagIs('shop_marks_armed'), mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    eff_marks_clear: { Effect: { onSignal: 'shop_marks', kind: 'destroy-tagged', targetId: '', value: SHOPSLOT_ALL } } as unknown as EntityBlueprint,
    eff_marks_disarm: { Effect: { onSignal: 'shop_marks', kind: 'set-flag', targetId: 'shop_marks_armed', value: false } } as unknown as EntityBlueprint,
    eff_marks2_arm: { Effect: { onSignal: 'shop_marks', kind: 'set-flag', targetId: 'shop_marks2_armed', value: true } } as unknown as EntityBlueprint,
    when_marks2: { EventWhen: { signal: 'shop_marks2', when: flagIs('shop_marks2_armed'), mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    eff_marks2_disarm: { Effect: { onSignal: 'shop_marks2', kind: 'set-flag', targetId: 'shop_marks2_armed', value: false } } as unknown as EntityBlueprint,
    // —— 相位横幅（F-15 配套）：round_ui 状态镜像 → state 叶 edge → set-visible 三选一；胜/败终幕横幅走旗标。——
    f_round_state: { State: { fsmId: 'round_ui', current: 'prep' } } as unknown as EntityBlueprint,
    banner_prep: {
      Transform: xf(0, -186),
      Text: { content: '备 战 —— 买人/刷新/锁店，点「开战」或等倒计时', fontSize: 15, fontFamily: 'sans-serif', anchor: 'center', lineSpacing: 0 },
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
    banner_resolution: {
      Transform: xf(0, -186),
      Text: { content: '回 合 结 算', fontSize: 15, fontFamily: 'sans-serif', anchor: 'center', lineSpacing: 0 },
      Color: { tint: 0x9ad1ff, alpha: 1 },
      Visibility: { visible: false },
      Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 31 },
    } as unknown as EntityBlueprint,
    banner_gameover: {
      Transform: xf(0, -60),
      Text: { content: '败 局 —— 玩家血量耗尽', fontSize: 22, fontFamily: 'sans-serif', anchor: 'center', lineSpacing: 0 },
      Color: { tint: 0xff5050, alpha: 1 },
      Visibility: { visible: false },
      Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 32 },
    } as unknown as EntityBlueprint,
    banner_victory: {
      Transform: xf(0, -60),
      Text: { content: '通 关 —— 打穿关卡表！', fontSize: 22, fontFamily: 'sans-serif', anchor: 'center', lineSpacing: 0 },
      Color: { tint: 0x77e08a, alpha: 1 },
      Visibility: { visible: false },
      Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 32 },
    } as unknown as EntityBlueprint,
    when_ph_prep: { EventWhen: { signal: 'ph_prep', when: { kind: 'state', fsmId: 'round_ui', equals: 'prep' }, mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    when_ph_combat: { EventWhen: { signal: 'ph_combat', when: { kind: 'state', fsmId: 'round_ui', equals: 'combat' }, mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    when_ph_res: { EventWhen: { signal: 'ph_res', when: { kind: 'state', fsmId: 'round_ui', equals: 'resolution' }, mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    when_ph_over: { EventWhen: { signal: 'ph_over', when: flagIs('run_over'), mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    when_ph_won: { EventWhen: { signal: 'ph_won', when: flagIs('run_won'), mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    ...visSwap('ph_prep', 'banner_prep', ['banner_combat', 'banner_resolution']),
    ...visSwap('ph_combat', 'banner_combat', ['banner_prep', 'banner_resolution']),
    ...visSwap('ph_res', 'banner_resolution', ['banner_prep', 'banner_combat']),
    ...visSwap('ph_over', 'banner_gameover', []),
    ...visSwap('ph_won', 'banner_victory', []),
    // —— HUD 数字（F-15 / REQ-F-043 t2-text-binding）：左上角金币/血/等级/经验 + 阶段-回合 ——
    hud_gold: { Transform: xf(-340, -186), Text: { content: '金币 0', fontSize: 13, fontFamily: 'sans-serif', anchor: 'left', lineSpacing: 0 }, TextBinding: { resourceId: 'gold', prefix: '金币 ' }, Color: { tint: 0xf0d27a, alpha: 1 }, Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 30 } } as unknown as EntityBlueprint,
    hud_hp: { Transform: xf(-340, -168), Text: { content: '血量 100', fontSize: 13, fontFamily: 'sans-serif', anchor: 'left', lineSpacing: 0 }, TextBinding: { resourceId: 'player_hp', prefix: '血量 ' }, Color: { tint: 0xff8a8a, alpha: 1 }, Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 30 } } as unknown as EntityBlueprint,
    hud_level: { Transform: xf(-340, -150), Text: { content: '等级 4', fontSize: 13, fontFamily: 'sans-serif', anchor: 'left', lineSpacing: 0 }, TextBinding: { resourceId: 'level', prefix: '等级 ' }, Color: { tint: 0x9ad1ff, alpha: 1 }, Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 30 } } as unknown as EntityBlueprint,
    hud_xp: { Transform: xf(-340, -132), Text: { content: '经验 0', fontSize: 13, fontFamily: 'sans-serif', anchor: 'left', lineSpacing: 0 }, TextBinding: { resourceId: 'xp', prefix: '经验 ' }, Color: { tint: 0x7ad17a, alpha: 1 }, Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 30 } } as unknown as EntityBlueprint,
    hud_stage: { Transform: xf(-340, -114), Text: { content: '阶段 1', fontSize: 13, fontFamily: 'sans-serif', anchor: 'left', lineSpacing: 0 }, TextBinding: { resourceId: 'stage_idx', prefix: '阶段 ' }, Color: { tint: 0xd0d0d0, alpha: 1 }, Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 30 } } as unknown as EntityBlueprint,
    hud_round: { Transform: xf(-275, -114), Text: { content: '回合 1', fontSize: 13, fontFamily: 'sans-serif', anchor: 'left', lineSpacing: 0 }, TextBinding: { resourceId: 'round_idx', prefix: '回合 ' }, Color: { tint: 0xd0d0d0, alpha: 1 }, Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 30 } } as unknown as EntityBlueprint,
    hud_bench: { Transform: xf(-340, -96), Text: { content: '空席 9', fontSize: 13, fontFamily: 'sans-serif', anchor: 'left', lineSpacing: 0 }, TextBinding: { resourceId: 'bench_space', prefix: '空席 ' }, Color: { tint: 0xc9a86a, alpha: 1 }, Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 30 } } as unknown as EntityBlueprint, // F-17：席位空余可视（派生资源）
    f_deploy_armed: { Flag: { id: 'deploy_armed', active: false } } as unknown as EntityBlueprint,
    f_wipe_armed: { Flag: { id: 'wipe_armed', active: false } } as unknown as EntityBlueprint,
    f_income_armed: { Flag: { id: 'income_armed', active: false } } as unknown as EntityBlueprint, // §4.1 结算窗
    f_dmg_armed: { Flag: { id: 'dmg_armed', active: false } } as unknown as EntityBlueprint, // §4.2 败方结算窗
    // 我方部署带：入战拍窗（deploy_armed 于 prep→combat 臂）→ 'deploy' → 全部在板 marker 的 Caster
    // （requireHexPos 门：在席不响应）各自出兵。窗内无其它条件叶 → edge 一窗一发，无复燃面。
    when_deploy: { EventWhen: { signal: 'deploy', when: flagIs('deploy_armed'), mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    // —— 超员自动卖（F-17/REQ-F-048①）：入战拍 destroy-tagged 保额——保最早入场的 level 个我方（挂件级联）。
    // 棋子在部署后 ~3 拍才成型 → 检查带以 count_team_a≥1 为门（部署落地才查，不空放）；拖拽限额已在执行点
    // 强制 ≤level，此带=纵深保险丝（level 中途掉档/未来多源入场仍兜得住）。
    f_cap_armed: { Flag: { id: 'cap_armed', active: false } } as unknown as EntityBlueprint,
    r_count_team_a: { Resource: { id: 'count_team_a', current: 0, min: 0, max: 99 } } as unknown as EntityBlueprint,
    gc_team_a: { GroupCount: { countResource: 'count_team_a', requiredTag: TEAM_A } } as unknown as EntityBlueprint, // 我方在场棋子数（§4.2 真值伤害将来同源）
    when_cap: { EventWhen: { signal: 'enforce_cap', when: and(flagIs('cap_armed'), resCmp('count_team_a', 'gte', 1)), mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    eff_cap: { Effect: { onSignal: 'enforce_cap', kind: 'destroy-tagged', targetId: '', value: TEAM_A, keepResource: 'level' } } as unknown as EntityBlueprint,
    when_deploy_stage2: { EventWhen: { signal: 'deploy_stage_2', when: and(flagIs('deploy_armed'), resCmp('stage_idx', 'eq', 2), resCmp('round_idx', 'lte', 4)), mode: 'edge', armed: false } } as unknown as EntityBlueprint, // 普通回合=各阶段 r1-4（r5 野怪）
    when_deploy_stage3: { EventWhen: { signal: 'deploy_stage_3', when: and(flagIs('deploy_armed'), resCmp('stage_idx', 'eq', 3), resCmp('round_idx', 'lte', 4)), mode: 'edge', armed: false } } as unknown as EntityBlueprint, // 普通回合=各阶段 r1-4（r5 野怪）
    when_deploy_stage4: { EventWhen: { signal: 'deploy_stage_4', when: and(flagIs('deploy_armed'), resCmp('stage_idx', 'eq', 4), resCmp('round_idx', 'lte', 4)), mode: 'edge', armed: false } } as unknown as EntityBlueprint, // 普通回合=各阶段 r1-4（r5 野怪）
    when_deploy_stage5: { EventWhen: { signal: 'deploy_stage_5', when: and(flagIs('deploy_armed'), resCmp('stage_idx', 'eq', 5), resCmp('round_idx', 'lte', 4)), mode: 'edge', armed: false } } as unknown as EntityBlueprint, // 普通回合=各阶段 r1-4（r5 野怪）
    // —— 野怪回合分流（一图流：阶段1 全部 + 各阶段 r5）——
    when_deploy_pve1: { EventWhen: { signal: 'deploy_pve_1', when: and(flagIs('deploy_armed'), resCmp('stage_idx', 'eq', 1)), mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    when_deploy_pve2: { EventWhen: { signal: 'deploy_pve_2', when: and(flagIs('deploy_armed'), resCmp('stage_idx', 'eq', 2), resCmp('round_idx', 'gte', 5)), mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    when_deploy_pve3: { EventWhen: { signal: 'deploy_pve_3', when: and(flagIs('deploy_armed'), resCmp('stage_idx', 'eq', 3), resCmp('round_idx', 'gte', 5)), mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    when_deploy_pve4: { EventWhen: { signal: 'deploy_pve_4', when: and(flagIs('deploy_armed'), resCmp('stage_idx', 'eq', 4), resCmp('round_idx', 'gte', 5)), mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    when_deploy_pve5: { EventWhen: { signal: 'deploy_pve_5', when: and(flagIs('deploy_armed'), resCmp('stage_idx', 'eq', 5), resCmp('round_idx', 'gte', 5)), mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    wipe_loot: { Effect: { onSignal: 'wipe', kind: 'destroy-tagged', targetId: '', value: LOOT } } as unknown as EntityBlueprint, // 未拾取法球随结算清（主角拾取=批C）
    // —— 主角小小英雄（批C，§4.7 映射零新能力）：WASD/方向键自由移动（Controllable→Velocity→motion-apply）。
    // 不带队伍位 → 不被 aggro 锁/打击区命中/wipe 清场；常驻跨回合。拾取（过渡版）：主角=zone，碰球即收走
    // （trigger-zone"恰好一方 zone"互斥 + hitbox 无 consume 语义 → 赏金两清的原子缺口已提 REQ-F-044
    //  `Hitbox.consumeOnHit`；落地后球改 zone 单发写 loot 自毁，下方入账链即时生效——链已就位）。
    protag: {
      Transform: xf(-250, 40),
      Velocity: { vx: 0, vy: 0, angular: 0 },
      Controllable: { playerId: 'p1', speed: 1.6 },
      Shape: { kind: 'box', width: 14, height: 14 },
      Tag: { flags: PROTAG }, // 044 后主角零附件：球自带 consumeOnHit 两清
      Resource: { id: 'loot', current: 0, min: 0, max: 999 },
      Sprite: sprite(F_FX_DRAIN, 12),
    } as unknown as EntityBlueprint,
    protag_name: {
      Transform: xf(-250, 24),
      Text: { content: '主公', fontSize: 10, fontFamily: 'sans-serif', anchor: 'center', lineSpacing: 0 },
      Color: { tint: 0xffe28a, alpha: 1 },
      Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 30 },
      Hierarchy: { parentId: 'protag', localX: 0, localY: -16, localRotation: 0, localScaleX: 1, localScaleY: 1 },
    } as unknown as EntityBlueprint,
    when_loot: { EventWhen: { signal: 'loot_cash', when: resCmp('loot', 'gt', 0), mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    eff_loot_gold: { Effect: { onSignal: 'loot_cash', kind: 'modify-resource', targetId: 'gold', op: 'add', value: 0, valueFrom: { resourceId: 'loot' }, order: 1 } } as unknown as EntityBlueprint, // order 钉死：先搬运后清零（effect-apply 按 id 序，'clear'<'gold' 会先清——实测踩到的搬运 0 坑）
    eff_loot_clear: { Effect: { onSignal: 'loot_cash', kind: 'modify-resource', targetId: 'loot', op: 'set', value: 0, order: 2 } } as unknown as EntityBlueprint,
    // —— 开局强化符文三选一（批D，一图流入口；单人化=三选一无争抢）：回合1备战期顶部三卡，点选即生效，
    // 整组 destroy-tagged 收走（天然一次性，无需 armed 旗）。效果=经济型（全现有词汇，无 buff 施加依赖）。
    // 开局强化三选一（一次性，仅回合1）：加标题说明 + 开战拍自动收走（用户报「永远在中央、不知何意」——
    // 真打的时候就去掉）。Tag RUNE → 点选生效后 destroy-tagged 整组收（含标题），没点则 ph_combat 兜底收走。
    rune_title: { Transform: xf(0, -128), Shape: { kind: 'box', width: 340, height: 18 }, Tag: { flags: RUNE }, Text: { content: '◆ 开局强化 · 三选一（点击生效，开战后消失）', fontSize: 13, fontFamily: 'sans-serif', anchor: 'center', lineSpacing: 0 }, Color: { tint: 0xffe28a, alpha: 1 }, Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 33 } } as unknown as EntityBlueprint,
    rune_a: { Transform: xf(-110, -100), Shape: { kind: 'box', width: 96, height: 40 }, Clickable: { action: 'rune_a' }, Tag: { flags: RUNE }, Text: { content: '屯粮：+10 金', fontSize: 12, fontFamily: 'sans-serif', anchor: 'center', lineSpacing: 0 }, Color: { tint: 0xf0d27a, alpha: 1 }, Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 33 } } as unknown as EntityBlueprint,
    rune_b: { Transform: xf(0, -100), Shape: { kind: 'box', width: 96, height: 40 }, Clickable: { action: 'rune_b' }, Tag: { flags: RUNE }, Text: { content: '砺兵：+8 经验', fontSize: 12, fontFamily: 'sans-serif', anchor: 'center', lineSpacing: 0 }, Color: { tint: 0x7ad17a, alpha: 1 }, Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 33 } } as unknown as EntityBlueprint,
    rune_c: { Transform: xf(110, -100), Shape: { kind: 'box', width: 96, height: 40 }, Clickable: { action: 'rune_c' }, Tag: { flags: RUNE }, Text: { content: '广纳：备战席 +2', fontSize: 12, fontFamily: 'sans-serif', anchor: 'center', lineSpacing: 0 }, Color: { tint: 0x9ad1ff, alpha: 1 }, Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 33 } } as unknown as EntityBlueprint,
    eff_rune_a: { Effect: { onSignal: 'rune_a', kind: 'modify-resource', targetId: 'gold', op: 'add', value: 10 } } as unknown as EntityBlueprint,
    eff_rune_b: { Effect: { onSignal: 'rune_b', kind: 'modify-resource', targetId: 'xp', op: 'add', value: 8 } } as unknown as EntityBlueprint,
    eff_rune_c: { Effect: { onSignal: 'rune_c', kind: 'modify-resource', targetId: 'bench_cap', op: 'add', value: 2 } } as unknown as EntityBlueprint, // F-17 后席位空余是派生值 → 扩容改容量源
    eff_rune_a_done: { Effect: { onSignal: 'rune_a', kind: 'destroy-tagged', targetId: '', value: RUNE } } as unknown as EntityBlueprint,
    eff_rune_b_done: { Effect: { onSignal: 'rune_b', kind: 'destroy-tagged', targetId: '', value: RUNE } } as unknown as EntityBlueprint,
    eff_rune_c_done: { Effect: { onSignal: 'rune_c', kind: 'destroy-tagged', targetId: '', value: RUNE } } as unknown as EntityBlueprint,
    // 兜底收走：没点也在开战拍清掉（回合1 后无 RUNE 实体 → 后续 ph_combat 空转无害）。
    eff_rune_sweep: { Effect: { onSignal: 'ph_combat', kind: 'destroy-tagged', targetId: '', value: RUNE } } as unknown as EntityBlueprint,
    // —— 羁绊（F-16/REQ-F-047，Phase 3 先行最小版）：蜀魂——场上蜀将 ≥3 → 我方伤害 ×1.2（开战拍 edge 锁存，
    // 战斗中减员不掉档；prep 复位 ×1）。计数=group-count（REQ-022）；施加=hitbox scaleByResource 乘区。——
    bond_counter_shu: { GroupCount: { countResource: 'count_shu', requiredTag: FACT_SHU } } as unknown as EntityBlueprint,
    r_count_shu: { Resource: { id: 'count_shu', current: 0, min: 0, max: 99 } } as unknown as EntityBlueprint,
    r_dmg_scale_a: { Resource: { id: 'dmg_scale_a', current: 1, min: 0, max: 9 } } as unknown as EntityBlueprint,
    r_dmg_scale_b: { Resource: { id: 'dmg_scale_b', current: 1, min: 0, max: 9 } } as unknown as EntityBlueprint, // 敌方系数占位（关卡羁绊 TUNE 位）
    when_bond_shu: { EventWhen: { signal: 'bond_shu', when: and({ kind: 'state', fsmId: 'round_ui', equals: 'combat' }, resCmp('count_shu', 'gte', 3)), mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    eff_bond_shu: { Effect: { onSignal: 'bond_shu', kind: 'modify-resource', targetId: 'dmg_scale_a', op: 'set', value: 1.2 } } as unknown as EntityBlueprint,
    // —— 加时强制结束（一图流：30s+15s；单人改编=超时按败方路径结算，注记于 flow-spec）——
    overtime_clock: { Timer: { id: 'combat_clock', elapsed: 0, duration: 999999, loop: false } } as unknown as EntityBlueprint,
    when_ot_reset: { EventWhen: { signal: 'ot_reset', when: { kind: 'state', fsmId: 'round_ui', equals: 'combat' }, mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    eff_ot_reset: { Effect: { onSignal: 'ot_reset', kind: 'reset-timer', targetId: '', targetEntity: 'overtime_clock' } } as unknown as EntityBlueprint,
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
    // —— §4.1 连败金（准则 P2，与连胜同形档位）——
    ...band('lstreak_1', and(flagIs('income_armed'), resCmp('lose_streak', 'gte', 2), resCmp('lose_streak', 'lte', 3)), 'gold', 1),
    ...band('lstreak_2', and(flagIs('income_armed'), resCmp('lose_streak', 'eq', 4)), 'gold', 2),
    ...band('lstreak_3', and(flagIs('income_armed'), resCmp('lose_streak', 'gte', 5)), 'gold', 3),
    // —— §4.2 玩家伤害（败方）：阶段基础伤(1/2 阶段=0/2) + 存活敌数近似 2（REQ-022 group-count 接入后换真值，队列 P1 注记）——
    ...band('dmg_stage_1', and(flagIs('dmg_armed'), resCmp('stage_idx', 'eq', 1)), 'player_hp', -2),
    ...band('dmg_stage_2', and(flagIs('dmg_armed'), resCmp('stage_idx', 'gt', 1)), 'player_hp', -4),
    // 静态相机（表现，排除出 hash）。720p 画布 + zoom 把棋盘放大填满视口。
    camera: { Transform: xf(0, 0), Camera: { zoom: 1.8, offsetX: 0, offsetY: 0, rotation: 0, viewportW: 1280, viewportH: 720 } } as unknown as EntityBlueprint,
  };
  // 开局阵容播种（REQ-F-049 统一架构）：4 个 bootcast 在经典站位上各放一个 **在板** 1 星 marker
  // （'@origin-hex' 哨兵把 bootcast 自身的格写进 seat——marker 经 prefab 出身戳，与买入 marker 同族可合成）。
  // when_boot：stage_idx≥1 自世界首拍恒真 → edge 恰发一次。旧固定槽 slot_<将> 系列由此整段替代：
  // 上场=「板上有 marker」一个事实源，拖动/买卖/合成全自动跟。
  entities['when_boot'] = { EventWhen: { signal: 'boot_roster', when: resCmp('stage_idx', 'gte', 1), mode: 'edge', armed: false } } as unknown as EntityBlueprint;
  for (const h of ROSTER.filter((x) => x.team === TEAM_A)) {
    const a = offsetToAxial(h.q, h.r);
    const p = project(a.q, a.r);
    entities[`bootcast_${h.id}`] = {
      Transform: xf(p.x, p.y),
      HexPos: { q: a.q, r: a.r }, // 持位者的格（无 GridMover → F-051 不占格不挡路）
      Caster: { onSignal: 'boot_roster', template: `bench_${h.id}`, at: 'self', requireHexPos: true, overrides: { seat: { HexPos: '@origin-hex' } } },
    } as unknown as EntityBlueprint;
  }
  // 商店买入分发（每将一组，F-11 ②③）：bought_code 命中码 → buy_<将> 信号 → 备战席位生成 marker
  // + 复位 bought_code=0（F-11 坑：防同码二连买 edge 不触发）。席位 x 按将错开（重复购买同将暂叠同位）。
  ROSTER.filter((x) => x.team === TEAM_A).forEach((h, i) => {
    const sig = `buy_${h.id}`;
    entities[`when_${sig}`] = { EventWhen: { signal: sig, when: resCmp('bought_code', 'eq', HERO_CODE[h.id]), mode: 'edge', armed: false } } as unknown as EntityBlueprint;
    entities[`buycast_${h.id}`] = { Transform: xf(0, TRAY.originY), Caster: { onSignal: sig, template: `bench_${h.id}`, at: 'self' } } as unknown as EntityBlueprint;
    entities[`eff_${sig}_reset`] = { Effect: { onSignal: sig, kind: 'modify-resource', targetId: 'bought_code', op: 'set', value: 0 } } as unknown as EntityBlueprint;
    // 048② 每将卖出链（点席=sell_<将>）；席位归还不再手工 +1——bench_space 派生自 marker 计数（F-17）
    const sell = `sell_${h.id}`;
    entities[`eff_${sell}_destroy`] = { Effect: { onSignal: sell, kind: 'destroy', targetId: '', targetEntity: '@signal-source' } } as unknown as EntityBlueprint;
    entities[`eff_${sell}_gold`] = { Effect: { onSignal: sell, kind: 'modify-resource', targetId: 'gold', op: 'add', value: SELL_PRICE[1] } } as unknown as EntityBlueprint;
    entities[`eff_${sell}_code`] = { Effect: { onSignal: sell, kind: 'modify-resource', targetId: 'sold_code', op: 'set', value: HERO_CODE[h.id] } } as unknown as EntityBlueprint;
    // —— F-17 升星（REQ-F-046 接入）：席位 marker 三连合成（最老 3 个原子换 1，挂件级联、while 连锁；
    // 板上合成产物留板上原格、席上合成留席——merge-rule 出身格继承，REQ-F-049）。星级数值烘在
    // bench2/bench3 模板的 Caster.overrides 里（模板家族即星级，旧星级资源带契约已删）。——
    entities[`mr2_${h.id}`] = { MergeRule: { template: `bench_${h.id}`, need: 3, into: `bench2_${h.id}`, intoOverrides: { seat: { HexPos: '@origin-hex' } } } } as unknown as EntityBlueprint;
    entities[`mr3_${h.id}`] = { MergeRule: { template: `bench2_${h.id}`, need: 3, into: `bench3_${h.id}`, intoOverrides: { seat: { HexPos: '@origin-hex' } } } } as unknown as EntityBlueprint;
    // 合成品卖出链（点席=sell<星>_<将>，@signal-source 点谁卖谁）：星级卖价；袋**不**归还
    // ——3 张已熔毁成 1 个高星 marker，按张归还语义不成立（known wart，回执/TUNE 注记）。
    for (const s of [2, 3]) {
      const sk = `sell${s}_${h.id}`;
      entities[`eff_${sk}_destroy`] = { Effect: { onSignal: sk, kind: 'destroy', targetId: '', targetEntity: '@signal-source' } } as unknown as EntityBlueprint;
      entities[`eff_${sk}_gold`] = { Effect: { onSignal: sk, kind: 'modify-resource', targetId: 'gold', op: 'add', value: SELL_PRICE[s] } } as unknown as EntityBlueprint;
    }
  });
  // 商店三大框（F-14 重排，用户钦定小丑牌式选卡页）：3 槽镜像资源 + 每槽×每将 重铺带
  // （and(臂2, 槽码=将码) edge → 持位 Caster 展开大卡面）+ 买入后面板再臂。卡面 Clickable=buy_slot_i 即购买。
  for (let i = 0; i < 3; i++) {
    entities[`r_shop_slot_${i + 1}`] = { Resource: { id: `shop_slot_${i + 1}`, current: 0, min: 0, max: 9999 } } as unknown as EntityBlueprint;
    ROSTER.filter((x) => x.team === TEAM_A).forEach((h) => {
      const sig = `s${i + 1}_${h.id}`;
      entities[`when_${sig}`] = { EventWhen: { signal: sig, when: and(flagIs('shop_marks2_armed'), resCmp(`shop_slot_${i + 1}`, 'eq', HERO_CODE[h.id])), mode: 'edge', armed: false } } as unknown as EntityBlueprint;
      entities[`cardcast_${sig}`] = { Transform: xf(SHOP_XS[i], SHOP_Y), Caster: { onSignal: sig, template: `shopcard_${h.id}`, at: 'self', overrides: { card: { Clickable: { action: `buy_slot_${i + 1}` }, Tag: { flags: SHOPSLOT_BITS[i] } } } } } as unknown as EntityBlueprint;
    });
  }
  // 商店页底板 + 三个大框（placeholder：Shape+Color 占位，待用户给 UI 资源后换皮）。
  entities['shop_panel'] = { Transform: xf(0, SHOP_Y), Shape: { kind: 'box', width: 240, height: 80 }, Color: { tint: 0x141a22, alpha: 0.92 }, Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 26 } } as unknown as EntityBlueprint;
  for (let i = 0; i < 3; i++) {
    entities[`shop_frame_${i + 1}`] = { Transform: xf(SHOP_XS[i], SHOP_Y), Shape: { kind: 'box', width: 62, height: 72 }, Color: { tint: 0x2a3442, alpha: 1 }, Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 27 } } as unknown as EntityBlueprint;
  }
  // 备战席托盘（REQ-F-055）：9 槽英雄平台（非六角；placeholder 槽框）。买入自动落座/席内拖拽互换/上板让座。
  entities['bench_tray'] = { Tray: { ...TRAY, requiredTag: BENCH_OCC } } as unknown as EntityBlueprint;
  for (let i = 0; i < TRAY.capacity; i++) {
    entities[`bench_frame_${i}`] = { Transform: xf(TRAY.originX + i * TRAY.gap, TRAY.originY), Shape: { kind: 'box', width: 38, height: 38 }, Color: { tint: 0x223041, alpha: 0.95 }, Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 1 } } as unknown as EntityBlueprint;
  }
  for (const h of ROSTER.filter((x) => x.team === TEAM_A)) {
    entities[`eff_marks_on_buy_${h.id}`] = { Effect: { onSignal: `buy_${h.id}`, kind: 'set-flag', targetId: 'shop_marks_armed', value: true } } as unknown as EntityBlueprint;
  }
  // 敌方关卡槽（持久）：每阶段一组，prep 按 stage_idx 分流的 deploy_stage_<N> 展开（§4.5 敌阵=数据）。
  for (const st of STAGES) {
    st.comp.forEach((c, ci) => {
      // id 带序号：同阶段同名敌将（F-9 后同模板多实例合法）不撞键
      entities[`slot_s${st.n}_${ci}_${c.hero}`] = slotEntity(heroOf(c.hero), `deploy_stage_${st.n}`, c.q, c.r, c.hpMul);
    });
  }
  // 野怪槽（批B）：每阶段一组，count 只横向铺位（7×8 盘敌前排 r3、col 1 起）；血量=MOB_BASE_HP×HP_SCALE×hpMul 经 overrides
  for (const w of PVE_WAVES) {
    for (let i = 0; i < w.count; i++) {
      const col = 1 + i;
      const a = offsetToAxial(col, 3);
      const p2 = project(a.q, a.r);
      const hp = Math.round(MOB_BASE_HP * HP_SCALE * w.hpMul);
      entities[`pveslot_s${w.stage}_${i}`] = {
        Transform: xf(p2.x, p2.y),
        Caster: { onSignal: `deploy_pve_${w.stage}`, template: `mob_s${w.stage}`, at: 'self', overrides: { main: { HexPos: { q: a.q, r: a.r }, Tag: { flags: TEAM_B }, Resource: { current: hp, max: hp } } } },
      } as unknown as EntityBlueprint;
    }
  }

  return {
    capabilities: [
      // 金铲铲回合流程机（备战→战斗→结算→结束/gameover；战斗用 in_combat 门控普攻/攒蓝）
      flowCapability,
      // AI：索敌 + 六边形网格寻路走位（aggro 写目标 → grid-move 沿确定性 A* 逐格走，REQ-024）
      aggroCapability,
      gridMoveCapability,
      motionApplyCapability, // 主角自由移动（批C：Controllable dx/dy→Velocity→Transform；棋子仍走 grid-move）
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
      textBindingCapability, // HUD 数字（F-15/REQ-F-043）：Resource → Text.content 投影
      groupCountCapability, // 羁绊计数（F-16/REQ-022+047）+ 升星 marker 计数 + 备战席占用派生（F-17）
      mergeRuleCapability, // 升星合成（F-17/REQ-F-046）：席位 marker 三连 N 换 1（最老先合、挂件级联、出身格继承）
      dragPlaceCapability, // 摆子拖拽（F-18/REQ-F-045+049+050）：备战期拖 marker 上板/调位/回席；snap 六角格+人口限额
      trayCapability, // 备战席托盘（REQ-F-055）：9 槽英雄平台——买入自动落座/席内拖拽互换/上板让座/无效落点弹回
      hierarchyResolveCapability,
      hierarchyCascadeCapability, // 子随父死（REQ-F-026）：棋子死亡→头顶名字一并消失
      cameraFollowCapability,
    ],
    entities,
  };
}

export const GAME_F_HERO_IDS = ROSTER.map((h) => h.id);
