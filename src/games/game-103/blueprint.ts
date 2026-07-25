// game-103《幸存者核心原型》—— play-field 世界 = 纯数据（WorldBlueprint）。零幸存者专属系统代码。
//
//   走位     = Controllable(net applyCommands 写 Velocity) → t1-motion-apply（+ t2-bounds-clamp 钳场地）
//   相机跟随 = 玩家挂 CameraTarget → t2-camera-follow 写 Camera.offset（+ Bounds 视野钳场地）
//   自动开火 = 玩家 Timer(cd,loop) + t2-self-rule{spawn proj at:self} → 子弹 t2-launch(toward:target,ENEMY)
//              直飞 → t2-hitbox(targetMask:ENEMY·×全局 power 系数) 命中扣血·consumeOnHit 单发
//   敌群刷怪 = 生怪票(Timer + SelfRule spawn at:self·授权期纯数据环·非 E3 波次 director)
//   敌人追击 = t3-aggro(Perception→Relation:target=玩家) + t2-steering(seek) → Velocity
//   接触伤害 = 敌 child 触伤区(Sensor+ZONE+Hitbox targetMask:PLAYER·连续 DPS)
//   死亡     = t2-mortal(hp<=0 销毁 + dropTemplate 掉宝石)
//   经验拾取 = 宝石(Sensor+ZONE+Hitbox targetMask:COLLECTOR·-value=加经验) 命中玩家拾取环 child
//   等级     = t2-event-when(xp>=阈值 edge)→signal → t2-effect-apply(扣阈值/等级+1/治疗/power+·固定强化占位)
//   计时/胜负= clock 资源(t2-over-time 每秒+1) + t3-flow(hp<=0 败 / 活满 15:00 胜)
// 能力总览：docs/design/game-103/capability-plan.md。（E1–E4 编排=三选一 draft/进化/波次 director 待 Lead 签 S2·未接。）
import type { WorldBlueprint, EntityBlueprint } from '../../assembly/demo.assembly.js';
import {
  transformCapability, hierarchyCapability, velocityCapability, shapeCapability,
  overlapDetectCapability, timerCapability, resourceCapability, tagCapability,
  relationCapability, destroyCapability, colorCapability, controllableCapability, cameraCapability,
} from '@atom-skills/index.js';
import { motionApplyCapability, lifetimeCapability, hierarchyResolveCapability, hierarchyCascadeCapability } from '@skills/tier1/index.js';
import {
  boundsClampCapability, triggerZoneCapability, eventWhenCapability, effectApplyCapability,
  cameraFollowCapability, hitboxCapability, overTimeCapability, mortalCapability,
  steeringCapability, launchCapability, selfRuleCapability,
} from '@skills/tier2/index.js';
import { keybindCapability, gaugeCapability, groupCountCapability, orbitMotionCapability, orbitAt, animStateCapability, modifierStackCapability, statBindCapability } from '@skills/tier2/index.js';
import { prefabCapability, casterCapability, aggroCapability, flowCapability } from '@skills/tier3/index.js';
import {
  VIEW_W, VIEW_H, ARENA, START, TPS, MATCH_SECONDS,
  PLAYER, ENEMY, ZONE, COLLECTOR, KILLBOX, GEM, TINT,
  PLAYER_DEF, KUNAI, WEAPONS, WEAPON_BIT, ENEMIES, GEMS, GEM_LIFE, SPAWNS, SPAWNER_TIERS, SPAWNER_RING, SPAWN_CAP,
  XP_BASE, XP_STEP, DRAFT_POOL, PASSIVE_BY_KEY, STAT_PASSIVES, EBOLT_SKIN, WEAPON_ANIM, EBOLT_ANIM,
  type WeaponDef, type EnemyDef, type GemDef, type FxAnim,
} from './theme.js';

const XF0 = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
const child = (parentId: string) => ({ parentId, localX: 0, localY: 0, localRotation: 0, localScaleX: 1, localScaleY: 1 });

// 序列帧动画组件（t2-anim-state）：单 clip 'fly' 循环覆盖全帧；move/idle 都指它→无论有无 Velocity 都常播。
// 返回空对象=无动画（保持静态 skin）。皮肤槽已由调用处按 anim.sheet 覆盖 textureKey。
function fxAnimComps(anim: FxAnim | undefined): Record<string, unknown> {
  if (!anim) return {};
  return {
    Frame: { index: 0, total: anim.frames },
    AnimState: { clips: { fly: { from: 0, count: anim.frames, fps: anim.fps, loop: true } }, moveClip: 'fly', idleClip: 'fly', current: 'fly', elapsed: 0 },
  };
}

// ── prefab 模板 ──────────────────────────────────────────────────────────────

// 子弹（按射法 pattern 组装·非运行时解释器·authoring 期 builder 同 game-q towerTemplate）：
//  straight=Launch 直飞·单发命中；beam=快速长条·穿一线(连续 per-tick)；boomerang=Launch 去 + Perception/Steering 拉回；
//  nova=自身大范围 Hitbox·短寿命扫全场(per-tick)。命中一律 ×power 系数·寿命回收。
function projByPattern(w: WeaponDef): { entities: Record<string, Record<string, unknown>> } {
  const anim = WEAPON_ANIM[w.key]; // 子弹序列帧（在则盖过静态 skin）
  const base: Record<string, unknown> = {
    Transform: { ...XF0 },
    Sensor: {}, Tag: { flags: ZONE },
    Sprite: { textureKey: anim ? anim.sheet : w.skin, anchorX: 0.5, anchorY: 0.5, zOrder: 2 }, // 皮肤槽（动画帧优先）
    ...fxAnimComps(anim),
    Timer: { id: 'life', elapsed: 0, duration: w.life, loop: false },      // lifetime 回收
  };
  if (w.pattern === 'nova') {
    return { entities: { p: { ...base,
      Shape: { kind: 'circle', radius: w.radius },
      Color: { tint: w.tint, alpha: 0.26 },
      Hitbox: { resource: 'hp', amount: w.dmg, targetMask: ENEMY, scaleByResource: 'power' }, // per-tick·扫全范围
    } } };
  }
  const single = (w.pattern === 'straight' || w.pattern === 'pet') && !w.pierce; // 单发命中 vs 穿透 per-tick（pierce=强制穿透扫线）
  const p: Record<string, unknown> = { ...base,
    Velocity: { vx: 0, vy: 0, angular: 0 },
    // fallbackDir（Lead 交付·REQ-SURVIVOR被动轴同批）：索敌落空不再冻原地→朝上默认发射（修 owner「没敌人时子弹不动」）。
    Launch: { speed: w.projSpeed, toward: 'target', targetMask: ENEMY, fallbackDir: { x: 0, y: -1 } },
    // RBUG-01② 子弹朝向：t2-facing 与 bounds-clamp 都在 Commit 写 Transform→调度器成环（facing 未声明相对定序·
    // 回报 Lead 补 facing 定序）。暂不挂 Facing（次要·水平翻转）；orbit/separation 已接。
    Shape: w.pattern === 'beam' ? { kind: 'box', width: w.radius * 5, height: w.radius } : { kind: 'circle', radius: w.radius },
    Color: { tint: w.tint, alpha: 1 },
    Hitbox: { resource: 'hp', amount: w.dmg, targetMask: ENEMY, scaleByResource: 'power', ...(single ? { consumeOnHit: true } : {}) },
  };
  // BUG-03 修：boomerang 原来同挂 Launch(去)+Steering(回玩家)·两者每 tick 都写 Velocity·方向相反→抵消停原地。
  // 干净往返(飞出→到点回旋)是 launch 缺的 out-return 段（已报 capgap·见 requests REQ-SURVIVOR武器缺口）。
  // 此处先让它真飞：Launch 定向飞出 + 穿透(single=false·不 consumeOnHit)·长寿命=穿一线的回旋刃。
  return { entities: { p } };
}

// 武器挂点（draft 选中即 Caster spawn·child of player 跟随）：按 pattern 造持续伤/发射器。
//  orbit=环上静态光球 child（持续贴身 AoE）；pet=独立跟随子体（自带 Timer+SelfRule 自动射）；
//  其余=child 发射器（Timer 到点 SelfRule spawn proj_<key> at:self）。
function weaponMount(w: WeaponDef): { entities: Record<string, Record<string, unknown>> } {
  if (w.pattern === 'orbit') {
    // VBUG-02 真接（Lead 已修 orbit-motion 定序·PostResolve+runsAfter→不再成环）：光球挂 Orbit 绕玩家真圆周运动。
    // orbit-motion 每 tick 写光球 Transform.x/y（绕 centerId=player 半径 radius·相位差 startAngle）；Hitbox 随位置=命中位置。
    const wbit = WEAPON_BIT[w.key] ?? 0; // 武器 Tag 位（进化 destroy-tagged 按位删）
    const anim = WEAPON_ANIM[w.key];     // 光球序列帧（绿环动画）
    const ents: Record<string, Record<string, unknown>> = {};
    for (let i = 0; i < w.amount; i++) {
      ents[`ball${i}`] = {
        Transform: { ...XF0 },
        Orbit: orbitAt(w.radius, (Math.PI * 2 * i) / w.amount, w.projSpeed, 'player'), // projSpeed=每 tick 角步(rad)
        Sensor: {}, Tag: { flags: ZONE | wbit },
        Shape: { kind: 'circle', radius: 12 },
        Sprite: { textureKey: anim ? anim.sheet : w.skin, anchorX: 0.5, anchorY: 0.5, zOrder: 1 }, // 皮肤槽（动画帧优先）
        ...fxAnimComps(anim),
        Color: { tint: w.tint, alpha: 0.9 },
        Hitbox: { resource: 'hp', amount: w.dmg, targetMask: ENEMY, scaleByResource: 'power' },
      };
    }
    return { entities: ents };
  }
  if (w.pattern === 'pet') {
    return { entities: { pet: {
      Transform: { ...XF0 }, Velocity: { vx: 0, vy: 0, angular: 0 },
      Perception: { targetTag: PLAYER, sightRadius: 0 }, Steering: { mode: 'seek', speed: 2.4, stopRange: 56 }, // 跟随玩家
      Tag: { flags: WEAPON_BIT[w.key] ?? 0 },
      Shape: { kind: 'circle', radius: 10 },
      Sprite: { textureKey: w.skin, anchorX: 0.5, anchorY: 0.5, zOrder: 2 }, Color: { tint: w.tint, alpha: 1 },
      Timer: { id: 'fire', elapsed: 0, duration: w.cd, loop: true },
      SelfRule: { when: { kind: 'timer', id: 'fire', cmp: 'gte', value: Math.max(1, w.cd - 1) }, do: [{ kind: 'spawn', template: `proj_${w.key}`, at: 'self' }], once: true, armed: false },
    } } };
  }
  // straight/nova/beam/boomerang：child 发射器（跟随玩家·按 cd 发 proj）
  return { entities: { m: {
    Hierarchy: { parentId: 'player', localX: 0, localY: 0, localRotation: 0, localScaleX: 1, localScaleY: 1 },
    Transform: { ...XF0 },
    Tag: { flags: WEAPON_BIT[w.key] ?? 0 },
    Timer: { id: 'fire', elapsed: 0, duration: w.cd, loop: true },
    SelfRule: { when: { kind: 'timer', id: 'fire', cmp: 'gte', value: Math.max(1, w.cd - 1) }, do: [{ kind: 'spawn', template: `proj_${w.key}`, at: 'self' }], once: true, armed: false },
  } } };
}

// 进化接线（E2·重组）：每把可进化武器一条 KeyBinding 'evo_<key>' → Effect destroy-tagged(删基础武器挂点)
// + Caster spawn 进化体挂点（child of player）。宿主满级+持有 req 被动时弹金卡·选中入队 evo_<key>。
function evoPickEntities(): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  for (const w of WEAPONS) {
    if (!w.evo) continue;
    const sig = `evo_${w.key}`;
    out[`kb-evo-${w.key}`] = { KeyBinding: { key: sig, signal: sig } };
    out[`fx-evo-del-${w.key}`] = { Effect: { onSignal: sig, kind: 'destroy-tagged', targetId: '', value: WEAPON_BIT[w.key] } }; // 删基础武器挂点（Tag 位）
    out[`cast-evo-${w.key}`] = { Caster: { onSignal: sig, template: `weapon_${w.evo.to}`, at: 'self', originEntity: 'player' } };
  }
  return out;
}

// 敌弹（E7 远程·朝玩家直飞·寿命限射程=「打你但打不远」）：Launch toward:PLAYER + Hitbox targetMask:PLAYER·单发命中。
//  射程 ≈ projSpeed × life（px）；玩家可走位躲。皮肤 EBOLT_SKIN·未就绪回退敌色圆点。
function eboltTemplate(e: EnemyDef): { entities: Record<string, Record<string, unknown>> } {
  const r = e.ranged!;
  const anim = EBOLT_ANIM[e.key]; // 敌弹序列帧（黄沙爆/红灼热·辨敌我）
  return { entities: { p: {
    Transform: { ...XF0 },
    Velocity: { vx: 0, vy: 0, angular: 0 },
    Sensor: {}, Tag: { flags: ZONE },
    Shape: { kind: 'circle', radius: r.radius },
    Sprite: { textureKey: anim ? anim.sheet : EBOLT_SKIN, anchorX: 0.5, anchorY: 0.5, zOrder: 2 },
    ...fxAnimComps(anim),
    Color: { tint: anim ? 0xffffff : e.tint, alpha: 1 },
    Launch: { speed: r.projSpeed, toward: 'target', targetMask: PLAYER },
    Hitbox: { resource: 'hp', amount: r.dmg, targetMask: PLAYER, consumeOnHit: true },
    Timer: { id: 'life', elapsed: 0, duration: r.life, loop: false }, // 寿命=射程上限
  } } };
}

// 敌人：aggro(Perception)→Relation(target=玩家) + steering(seek) 追击；接触伤害在隐形 child 触伤区；死亡掉宝石。
// E7 远程敌（e.ranged）：body 额外挂 Timer('shoot')+SelfRule 周期 spawn ebolt_<key>（stopRange 大=保持中距 kiting）。
function enemyTemplate(e: EnemyDef, gemTemplate: string): { entities: Record<string, Record<string, unknown>> } {
  // 视觉体型（owner「Boss 该 scale 大一点」）：emoji 皮为定尺 → 用 Transform.scale 按半径缩放
  // → Boss 巨大、精英大、杂兵小=层级一眼可辨。hierarchy 会把 scale 传给子体，故 hpbar 反向缩放抵消保正常尺寸。
  const artScale = Math.max(0.6, e.radius / 15); // shambler≈0.73 / brute≈1.2 / boss≈2.4
  const body: Record<string, unknown> = {
    Transform: { x: 0, y: 0, rotation: 0, scaleX: artScale, scaleY: artScale },
    Velocity: { vx: 0, vy: 0, angular: 0 },
    Tag: { flags: ENEMY },
    Shape: { kind: 'circle', radius: e.radius },
    Sprite: { textureKey: e.skin, anchorX: 0.5, anchorY: 0.5, zOrder: 1 }, // 皮肤槽
    Color: { tint: e.tint, alpha: 1 },
    Resource: { id: 'hp', current: e.hp, min: 0, max: e.hp },
    Mortal: { resource: 'hp', atOrBelow: 0, dropTemplate: gemTemplate },
    Perception: { targetTag: PLAYER, sightRadius: 0 },     // 0=无限视野·恒追玩家
    // BUG-02①真解（Lead 交付 t2-steering.separation）：敌群互斥斥力→环绕玩家而非全叠一点（幸存者手感）。
    Steering: { mode: 'seek', speed: e.speed, stopRange: Math.min(e.stopRange, e.ranged ? e.stopRange : 10), separation: { radius: e.radius * 2.4, weight: 1.6, tagMask: ENEMY } },
  };
  if (e.ranged) { // 远程敌：到点朝玩家射弹（Timer loop + SelfRule spawn ebolt·body 本无 SelfRule 故安全）
    body.Timer = { id: 'shoot', elapsed: 0, duration: e.ranged.cd, loop: true };
    body.SelfRule = { when: { kind: 'timer', id: 'shoot', cmp: 'gte', value: Math.max(1, e.ranged.cd - 1) }, do: [{ kind: 'spawn', template: `ebolt_${e.key}`, at: 'self' }], once: true, armed: false };
  }
  return {
    entities: {
      body,
      inner: { // 内芯（render-only·体积感）
        Hierarchy: child('@local:body'),
        Transform: { ...XF0 },
        Shape: { kind: 'circle', radius: Math.round(e.radius * 0.5) },
        Color: { tint: e.inTint, alpha: 0.9 },
      },
      hpbar: { // 头顶血条（Gauge 绑 hp·随受击缩短）。反向缩放(1/artScale)抵消 body 体型缩放→血条保持正常尺寸不被 Boss 放大。
        Hierarchy: { parentId: '@local:body', localX: 0, localY: -(e.radius + 9), localRotation: 0, localScaleX: 1 / artScale, localScaleY: 1 / artScale },
        Transform: { ...XF0 },
        Shape: { kind: 'box', width: Math.max(28, e.radius * 2.6), height: 5 },
        Color: { tint: 0x54e08a, alpha: 1 },
        Gauge: { resourceId: 'hp', fromParent: true, width: Math.max(28, e.radius * 2.6) },
      },
      touch: { // 接触伤害区（隐形·连续 DPS·targetMask:PLAYER）
        Hierarchy: child('@local:body'),
        Transform: { ...XF0 },
        Visibility: { visible: false, active: true },
        Sensor: {},
        Tag: { flags: ZONE },
        Shape: { kind: 'circle', radius: e.radius },
        Color: { tint: 0xffffff, alpha: 0 },
        Hitbox: { resource: 'hp', amount: e.contact, targetMask: PLAYER },
      },
    },
  };
}

// 宝石：命中拾取环(COLLECTOR) 入经验(-value=加)、命中计分环(KILLBOX) 计一杀；均 consumeOnHit·寿命兜底回收。
function gemTemplate(g: GemDef): { entities: Record<string, Record<string, unknown>> } {
  return {
    entities: {
      body: {
        Transform: { ...XF0 },
        Sensor: {},
        Tag: { flags: ZONE | GEM }, // GEM 位=magnet pull-anchor 命中筛选
        Shape: { kind: 'circle', radius: g.radius },
        Sprite: { textureKey: g.skin, anchorX: 0.5, anchorY: 0.5, zOrder: 0 }, // 皮肤槽
        Color: { tint: g.tint, alpha: 1 },
        Hitbox: { resource: 'xp', amount: -g.value, targetMask: COLLECTOR, consumeOnHit: true },
        Timer: { id: 'life', elapsed: 0, duration: GEM_LIFE, loop: false },
        // 磁力吸附（重组·aggro+steering）：宝石带 Perception(只看玩家·sightRadius=吸附半径) → t3-aggro 在半径内
        // 写 Relation(target)=玩家 → t2-steering seek 把它飞向玩家（经典「经验飞过来」）；半径外无目标=静止不动。
        // 飞到玩家拾取真空区(collector Shape)即被 Hitbox 收取。半径 260 > 收取区 → 有可见飞行段。
        Velocity: { vx: 0, vy: 0, angular: 0 },
        Perception: { targetTag: PLAYER, sightRadius: 260 },
        Steering: { mode: 'seek', speed: 7.5, stopRange: 0 },
      },
      kill: { // 计分区（隐形·随 body 级联销毁）
        Hierarchy: child('@local:body'),
        Transform: { ...XF0 },
        Visibility: { visible: false, active: true },
        Sensor: {},
        Tag: { flags: ZONE },
        Shape: { kind: 'circle', radius: g.radius },
        Color: { tint: 0xffffff, alpha: 0 },
        Hitbox: { resource: 'score', amount: -1, targetMask: KILLBOX, consumeOnHit: true },
      },
    },
  };
}

// 护盾环（升级三选一「新武器」·跟随玩家的灼烧光环·child of player·持续 AoE 贴身敌）。
// 升级三选一 pick 接线（纯数据·每候选一条 KeyBinding + 效果）：
//  被动(power/heal)→Effect 改资源；武器→Caster spawn 该武器挂点（child of player·at:self）。
//  宿主 draft 选中 → hudQueue.enqueueAction(effectSignal) → KeyBinding→Signal → 下面消费。
function draftPickEntities(): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  for (const u of DRAFT_POOL) {
    out[`kb-${u.id}`] = { KeyBinding: { key: u.effectSignal, signal: u.effectSignal } };
    if (u.slot === 'passive') {
      const p = PASSIVE_BY_KEY[u.id];
      if (p.kind === 'stat') {
        // 属性轴：选中 → +1 该被动的层数资源 lvl_<key>（modifier-stack 读它 → totals → stat-bind 投影）。
        out[`fx-${u.id}`] = { Effect: { onSignal: u.effectSignal, kind: 'modify-resource', targetId: `lvl_${u.id}`, op: 'add', value: 1 } };
      } else {
        // power=改全局伤害系数 power / heal=即时改 hp。
        const targetId = p.kind === 'power' ? 'power' : 'hp';
        out[`fx-${u.id}`] = { Effect: { onSignal: u.effectSignal, kind: 'modify-resource', targetId, op: 'add', value: p.value } };
      }
    } else {
      out[`cast-${u.id}`] = { Caster: { onSignal: u.effectSignal, template: `weapon_${u.id}`, at: 'self', originEntity: 'player' } };
    }
  }
  return out;
}

// ── 属性轴（REQ-SURVIVOR被动轴·stat-bind 已下沉）───────────────────────────────
// 管线：被动 pick +1 到 lvl_<key> 资源 → t2-modifier-stack 聚合全场 ModifierSource → 写 ModifierTotals.totals →
// t2-stat-bind 把 totals[key] 投影到玩家/拾取环/武器挂点的具体组件字段（幂等·从 base 重算）。零游戏层 system。
// 每个 stat target 两条 ModifierSource：base（add 1·0 层=系数 1=无变化）+ scaled（add·valueFrom lvl×每层量）。
// → totals[key] = 1 + value×层数。消费方 base×totals（moveSpeed/pickup/maxHp）或 base÷totals（attackSpeed·攻速越高冷却越短）。
function modifierAxisEntities(): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {
    mods: { ModifierTotals: { totals: {} } }, // 世界单例聚合表（modifier-stack 每 tick 重算写入）
  };
  for (const p of STAT_PASSIVES) {
    const target = p.stat!;
    out[`lvl-${p.key}`] = { Resource: { id: `lvl_${p.key}`, current: 0, min: 0, max: p.maxLevel } }; // 该被动层数
    out[`mod-base-${p.key}`] = { ModifierSource: { id: `${target}-base`, target, op: 'add', value: 1 } };        // 系数底 1
    out[`mod-lvl-${p.key}`] = { ModifierSource: { id: `${target}-lvl`, target, op: 'add', valueFrom: { resourceId: `lvl_${p.key}`, scale: p.value } } }; // +value×层
  }
  return out;
}

// BUG v2⑤修：世界空间地砖网格（render-only·随相机卷动→相对位移明显）。原 faint 点太淡=像没背景；
// 改成贯穿全场的**网格线**（长细 box·横竖各一组·世界坐标），相机跟随时线条卷动=清晰的地面参照。
function groundGridEntities(): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  const STEP = 160; // 网格间距（px·世界坐标）
  let i = 0;
  for (let x = 0; x <= ARENA; x += STEP) {
    out[`gridv-${i++}`] = { Transform: { x, y: ARENA / 2, rotation: 0, scaleX: 1, scaleY: 1 }, Shape: { kind: 'box', width: 2, height: ARENA }, Color: { tint: 0x2b3a48, alpha: 0.7 } };
  }
  for (let y = 0; y <= ARENA; y += STEP) {
    out[`gridh-${i++}`] = { Transform: { x: ARENA / 2, y, rotation: 0, scaleX: 1, scaleY: 1 }, Shape: { kind: 'box', width: ARENA, height: 2 }, Color: { tint: 0x2b3a48, alpha: 0.7 } };
  }
  return out;
}

// ── 开局包围圈（一次性生怪票·授权期纯数据）──
function openingBurstEntities(): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  SPAWNS.forEach((row, i) => {
    out[`spawn-${i}`] = {
      Transform: { x: row.x, y: row.y, rotation: 0, scaleX: 1, scaleY: 1 },
      Timer: { id: 'life', elapsed: 0, duration: row.at, loop: false },
      SelfRule: {
        when: { kind: 'timer', id: 'life', cmp: 'gte', value: Math.max(1, row.at - 1) },
        do: [{ kind: 'spawn', template: `enemy_${row.key}`, at: 'self' }],
        once: true, armed: false,
      },
    };
  });
  return out;
}

// ── 无限流刷怪（BUG v2③修）：跟随玩家的环形 spawner（Timer loop 永不停=无限）+ 分层时间门（难度递增）──
function ringSpawnerEntities(): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  let idx = 0;
  SPAWNER_TIERS.forEach((tier, ti) => {
    for (let i = 0; i < tier.count; i++) {
      const a = (Math.PI * 2 * i) / tier.count + idx * 0.7;
      // whenGlobal 全局门（AND）：① 同屏敌 < cap（杂兵防爆炸·capBypass 层跳过=boss/精英必现·修「全程没 boss」）② 时间门（难度递增）。
      const gates: Array<Record<string, unknown>> = [];
      if (!tier.capBypass) gates.push({ kind: 'resource', id: 'enemies_alive', cmp: 'lt', value: SPAWN_CAP });
      if (tier.afterSec > 0) gates.push({ kind: 'resource', id: 'clock', cmp: 'gte', value: tier.afterSec });
      const rule: Record<string, unknown> = {
        when: { kind: 'timer', id: 'spawn', cmp: 'gte', value: Math.max(1, tier.period - 1) },
        do: [{ kind: 'spawn', template: `enemy_${tier.key}`, at: 'self' }],
        once: true, armed: false,
      };
      if (gates.length === 1) rule.whenGlobal = gates[0]; // 单门直挂
      else if (gates.length > 1) rule.whenGlobal = { kind: 'and', of: gates }; // 多门 AND；无门(capBypass+afterSec0)=不挂=恒真
      out[`spawner-${ti}-${tier.key}-${i}`] = { // ti=层序（同 key 多层不撞 id）
        Hierarchy: { parentId: 'player', localX: Math.round(Math.cos(a) * SPAWNER_RING), localY: Math.round(Math.sin(a) * SPAWNER_RING), localRotation: 0, localScaleX: 1, localScaleY: 1 },
        Transform: { ...XF0 },
        Timer: { id: 'spawn', elapsed: Math.floor((tier.period * i) / Math.max(1, tier.count)), duration: tier.period, loop: true }, // 错峰起始=不同时刻齐刷
        SelfRule: rule,
      };
      idx++;
    }
  });
  return out;
}

// ── 组装 ────────────────────────────────────────────────────────────────────
export function buildBlueprint(): WorldBlueprint {
  const entities: Record<string, EntityBlueprint> = {
    // ── 全局计数（各一实体一 Resource·组件模型每型一份）──
    level: { Resource: { id: 'level', current: 1, min: 1, max: 999 } },
    'alive-count': { Resource: { id: 'enemies_alive', current: 0, min: 0, max: 9999 }, GroupCount: { countResource: 'enemies_alive', requiredTag: ENEMY } }, // 同屏活敌计数→spawner cap 门
    power: { Resource: { id: 'power', current: 1, min: 0, max: 99 } }, // 子弹伤害 = dmg × power（升级固定强化）
    clock: {
      Resource: { id: 'clock', current: 0, min: 0, max: MATCH_SECONDS },
      OverTime: { effects: [{ id: 'tick', resource: 'clock', amountPerTick: 1, period: TPS, duration: 999999999, elapsed: 0 }] },
    },

    // ── 升级机（xp 满阈值 edge → 等级 +1 + 扣阈值·自动记账；强化本身=三选一 draft 由玩家选·见 draftPickEntities）──
    // v3 真经验曲线：xp≥当前阈值 nextxp（EventWhen vsResource 动态阈值）→ 等级+1 + xp 归零 + 阈值+XP_STEP（爬升）。
    nextxp: { Resource: { id: 'nextxp', current: XP_BASE, min: 1, max: 99999 } },
    'levelup-gate': { EventWhen: { signal: 'levelup', when: { kind: 'resource', id: 'xp', cmp: 'gte', value: XP_BASE, vsResource: 'nextxp' }, mode: 'edge', armed: false } },
    'lv-fx-xp': { Effect: { onSignal: 'levelup', kind: 'modify-resource', targetId: 'xp', op: 'set', value: 0 } },
    'lv-fx-level': { Effect: { onSignal: 'levelup', kind: 'modify-resource', targetId: 'level', op: 'add', value: 1 } },
    'lv-fx-curve': { Effect: { onSignal: 'levelup', kind: 'modify-resource', targetId: 'nextxp', op: 'add', value: XP_STEP } },

    // ── 相机（跟随玩家·视野钳场地）──
    camera: {
      Camera: { zoom: 1, offsetX: START.x, offsetY: START.y, rotation: 0, viewportW: VIEW_W, viewportH: VIEW_H },
      Bounds: { minX: 0, minY: 0, maxX: ARENA, maxY: ARENA },
    },

    // ── 玩家（走位 + 自动开火 + 承 hp + 拾取/计分环 child）──
    player: {
      Transform: { x: START.x, y: START.y, rotation: 0, scaleX: 1, scaleY: 1 },
      Velocity: { vx: 0, vy: 0, angular: 0 },
      Controllable: { playerId: 'p1', speed: PLAYER_DEF.moveSpeed }, // net applyCommands 写 Velocity（WASD/摇杆）
      Tag: { flags: PLAYER },
      Shape: { kind: 'circle', radius: PLAYER_DEF.radius },
      Sprite: { textureKey: PLAYER_DEF.skin, anchorX: 0.5, anchorY: 0.5, zOrder: 3 }, // 皮肤槽
      Color: { tint: TINT.player, alpha: 1 },
      Resource: { id: 'hp', current: PLAYER_DEF.maxHp, min: 0, max: PLAYER_DEF.maxHp },
      Bounds: { minX: 0, minY: 0, maxX: ARENA, maxY: ARENA },
      CameraTarget: {},
      Timer: { id: 'atk', elapsed: 0, duration: KUNAI.cd, loop: true }, // 武器冷却节拍
      SelfRule: { // 冷却到点自动开火（spawn 子弹 at:self·loop 复位再射）
        when: { kind: 'timer', id: 'atk', cmp: 'gte', value: Math.max(1, KUNAI.cd - 1) },
        do: [{ kind: 'spawn', template: `proj_${KUNAI.key}`, at: 'self' }],
        once: true, armed: false,
      },
      // 属性轴投影（REQ-SURVIVOR被动轴·t2-stat-bind）：移速→Controllable.speed、最大生命→Resource.max。
      // 幂等：每 tick 从 base 重算（0 层 totals=1→无变化）。attackSpeed 暂不投影（见 theme 注·哑火风险）。
      StatBind: { bindings: [
        { source: 'ModifierTotals', key: 'moveSpeed', component: 'Controllable', field: 'speed', op: 'mul', base: PLAYER_DEF.moveSpeed },
        { source: 'ModifierTotals', key: 'maxHp', component: 'Resource', field: 'max', op: 'mul', base: PLAYER_DEF.maxHp },
      ] },
    },
    'player-core': { // 呼吸核（render-only）
      Hierarchy: child('player'), Transform: { ...XF0 },
      Shape: { kind: 'circle', radius: Math.round(PLAYER_DEF.radius * 0.5) },
      Color: { tint: TINT.playerCore, alpha: 1 },
    },
    collector: { // 拾取环（承 xp·宝石命中它入经验）
      Hierarchy: child('player'), Transform: { ...XF0 },
      Visibility: { visible: false, active: true },
      Tag: { flags: COLLECTOR },
      Shape: { kind: 'circle', radius: PLAYER_DEF.pickupRadius },
      Color: { tint: 0xffffff, alpha: 0 },
      Resource: { id: 'xp', current: 0, min: 0, max: 99999 }, // 累积经验（阈值由 nextxp 动态门·非 max）
      // 磁力护符：拾取吸真空区 = base × totals.pickup（t2-stat-bind 投影·磁石层数越高真空越大）。
      StatBind: { bindings: [{ source: 'ModifierTotals', key: 'pickup', component: 'Shape', field: 'radius', op: 'mul', base: PLAYER_DEF.pickupRadius }] },
    },
    killbox: { // 计分环（承 score·单调累计击杀）
      Hierarchy: child('player'), Transform: { ...XF0 },
      Visibility: { visible: false, active: true },
      Tag: { flags: KILLBOX },
      Shape: { kind: 'circle', radius: PLAYER_DEF.pickupRadius },
      Color: { tint: 0xffffff, alpha: 0 },
      Resource: { id: 'score', current: 0, min: 0, max: 999999 },
    },

    // ── 胜负流程 ──
    flow: {
      GameFlow: {
        id: 'match', current: 'playing',
        states: [
          {
            id: 'playing',
            transitions: [
              { when: { kind: 'resource', id: 'hp', cmp: 'lte', value: 0 }, to: 'defeat' },
              { when: { kind: 'resource', id: 'clock', cmp: 'gte', value: MATCH_SECONDS }, to: 'victory' },
            ],
          },
          { id: 'victory' },
          { id: 'defeat' },
        ],
      },
    },

    // ── prefab 库 ──
    library: {
      PrefabLibrary: {
        seq: 0,
        templates: {
          ...Object.fromEntries(ENEMIES.map((e) => [`enemy_${e.key}`, enemyTemplate(e, `gem_${e.gem}`)])),
          ...Object.fromEntries(ENEMIES.filter((e) => e.ranged).map((e) => [`ebolt_${e.key}`, eboltTemplate(e)])), // E7 敌弹
          ...Object.fromEntries(GEMS.map((g) => [`gem_${g.key}`, gemTemplate(g)])),
          // 全武器：每把一个 proj_<key>（射法模板）+ 非起始武器一个 weapon_<key>（挂点·draft 生成）。
          ...Object.fromEntries(WEAPONS.map((w) => [`proj_${w.key}`, projByPattern(w)])),
          ...Object.fromEntries(WEAPONS.filter((w) => w.key !== 'kunai').map((w) => [`weapon_${w.key}`, weaponMount(w)])),
        },
      },
    },

    ...groundGridEntities(),
    ...draftPickEntities(),
    ...evoPickEntities(),
    ...modifierAxisEntities(),
    ...openingBurstEntities(),
    ...ringSpawnerEntities(),
  };

  return {
    capabilities: [
      transformCapability, hierarchyCapability, velocityCapability, shapeCapability,
      overlapDetectCapability, timerCapability, resourceCapability, tagCapability,
      relationCapability, destroyCapability, colorCapability, controllableCapability, cameraCapability,
      motionApplyCapability, lifetimeCapability, hierarchyResolveCapability, hierarchyCascadeCapability,
      boundsClampCapability, triggerZoneCapability, eventWhenCapability, effectApplyCapability,
      cameraFollowCapability, hitboxCapability, overTimeCapability, mortalCapability,
      steeringCapability, launchCapability, selfRuleCapability, keybindCapability, gaugeCapability, groupCountCapability, orbitMotionCapability, animStateCapability,
      modifierStackCapability, statBindCapability,
      prefabCapability, casterCapability, aggroCapability, flowCapability,
    ],
    entities,
  };
}
