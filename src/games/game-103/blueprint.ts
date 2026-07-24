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
import { prefabCapability, aggroCapability, flowCapability } from '@skills/tier3/index.js';
import {
  VIEW_W, VIEW_H, ARENA, START, TPS, MATCH_SECONDS,
  PLAYER, ENEMY, ZONE, COLLECTOR, KILLBOX, TINT,
  PLAYER_DEF, KUNAI, SHAMBLER, GEM_BLUE, GEM_LIFE, SPAWNS,
  LEVEL_XP, LEVEL_HEAL, LEVEL_POWER_ADD, type WeaponDef, type EnemyDef, type GemDef,
} from './theme.js';

const XF0 = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
const child = (parentId: string) => ({ parentId, localX: 0, localY: 0, localRotation: 0, localScaleX: 1, localScaleY: 1 });

// ── prefab 模板 ──────────────────────────────────────────────────────────────

// 子弹：spawn 即 Launch 朝最近敌人一次定向直飞 → hitbox 命中扣血（×power 系数·单发 consumeOnHit）→ 寿命回收。
function projTemplate(w: WeaponDef): { entities: Record<string, Record<string, unknown>> } {
  return {
    entities: {
      p: {
        Transform: { ...XF0 },
        Velocity: { vx: 0, vy: 0, angular: 0 },
        Launch: { speed: w.projSpeed, toward: 'target', targetMask: ENEMY },
        Sensor: {},
        Tag: { flags: ZONE },
        Shape: { kind: 'circle', radius: w.radius },
        Sprite: { textureKey: w.skin, anchorX: 0.5, anchorY: 0.5, zOrder: 2 }, // 皮肤槽
        Color: { tint: w.tint, alpha: 1 },
        Hitbox: { resource: 'hp', amount: w.dmg, targetMask: ENEMY, consumeOnHit: true, scaleByResource: 'power' },
        Timer: { id: 'life', elapsed: 0, duration: w.life, loop: false }, // lifetime 回收
      },
    },
  };
}

// 敌人：aggro(Perception)→Relation(target=玩家) + steering(seek) 追击；接触伤害在隐形 child 触伤区；死亡掉宝石。
function enemyTemplate(e: EnemyDef, gemTemplate: string): { entities: Record<string, Record<string, unknown>> } {
  return {
    entities: {
      body: {
        Transform: { ...XF0 },
        Velocity: { vx: 0, vy: 0, angular: 0 },
        Tag: { flags: ENEMY },
        Shape: { kind: 'circle', radius: e.radius },
        Sprite: { textureKey: e.skin, anchorX: 0.5, anchorY: 0.5, zOrder: 1 }, // 皮肤槽
        Color: { tint: e.tint, alpha: 1 },
        Resource: { id: 'hp', current: e.hp, min: 0, max: e.hp },
        Mortal: { resource: 'hp', atOrBelow: 0, dropTemplate: gemTemplate },
        Perception: { targetTag: PLAYER, sightRadius: 0 },     // 0=无限视野·恒追玩家
        Steering: { mode: 'seek', speed: e.speed, stopRange: 0 },
      },
      inner: { // 内芯（render-only·体积感）
        Hierarchy: child('@local:body'),
        Transform: { ...XF0 },
        Shape: { kind: 'circle', radius: Math.round(e.radius * 0.5) },
        Color: { tint: e.inTint, alpha: 0.9 },
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
        Tag: { flags: ZONE },
        Shape: { kind: 'circle', radius: g.radius },
        Sprite: { textureKey: g.skin, anchorX: 0.5, anchorY: 0.5, zOrder: 0 }, // 皮肤槽
        Color: { tint: g.tint, alpha: 1 },
        Hitbox: { resource: 'xp', amount: -g.value, targetMask: COLLECTOR, consumeOnHit: true },
        Timer: { id: 'life', elapsed: 0, duration: GEM_LIFE, loop: false },
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

// ── 生怪票（授权期纯数据·Timer 到点 self-rule 展开一只怪·非 E3 rate/cap director）──
function spawnTicketEntities(): Record<string, EntityBlueprint> {
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

// ── 组装 ────────────────────────────────────────────────────────────────────
export function buildBlueprint(): WorldBlueprint {
  const entities: Record<string, EntityBlueprint> = {
    // ── 全局计数（各一实体一 Resource·组件模型每型一份）──
    level: { Resource: { id: 'level', current: 1, min: 1, max: 999 } },
    power: { Resource: { id: 'power', current: 1, min: 0, max: 99 } }, // 子弹伤害 = dmg × power（升级固定强化）
    clock: {
      Resource: { id: 'clock', current: 0, min: 0, max: MATCH_SECONDS },
      OverTime: { effects: [{ id: 'tick', resource: 'clock', amountPerTick: 1, period: TPS, duration: 999999999, elapsed: 0 }] },
    },

    // ── 升级机（xp 满阈值 edge → 固定强化占位·三选一 draft 待 S2/E1）──
    'levelup-gate': { EventWhen: { signal: 'levelup', when: { kind: 'resource', id: 'xp', cmp: 'gte', value: LEVEL_XP }, mode: 'edge', armed: false } },
    'lv-fx-xp': { Effect: { onSignal: 'levelup', kind: 'modify-resource', targetId: 'xp', op: 'add', value: -LEVEL_XP } },
    'lv-fx-level': { Effect: { onSignal: 'levelup', kind: 'modify-resource', targetId: 'level', op: 'add', value: 1 } },
    'lv-fx-heal': { Effect: { onSignal: 'levelup', kind: 'modify-resource', targetId: 'hp', op: 'add', value: LEVEL_HEAL } },
    'lv-fx-power': { Effect: { onSignal: 'levelup', kind: 'modify-resource', targetId: 'power', op: 'add', value: LEVEL_POWER_ADD } },

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
      Resource: { id: 'xp', current: 0, min: 0, max: LEVEL_XP },
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
          [`proj_${KUNAI.key}`]: projTemplate(KUNAI),
          [`enemy_${SHAMBLER.key}`]: enemyTemplate(SHAMBLER, `gem_${SHAMBLER.gem}`),
          [`gem_${GEM_BLUE.key}`]: gemTemplate(GEM_BLUE),
        },
      },
    },

    ...spawnTicketEntities(),
  };

  return {
    capabilities: [
      transformCapability, hierarchyCapability, velocityCapability, shapeCapability,
      overlapDetectCapability, timerCapability, resourceCapability, tagCapability,
      relationCapability, destroyCapability, colorCapability, controllableCapability, cameraCapability,
      motionApplyCapability, lifetimeCapability, hierarchyResolveCapability, hierarchyCascadeCapability,
      boundsClampCapability, triggerZoneCapability, eventWhenCapability, effectApplyCapability,
      cameraFollowCapability, hitboxCapability, overTimeCapability, mortalCapability,
      steeringCapability, launchCapability, selfRuleCapability,
      prefabCapability, aggroCapability, flowCapability,
    ],
    entities,
  };
}
