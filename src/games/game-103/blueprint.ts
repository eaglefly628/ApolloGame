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
import { keybindCapability } from '@skills/tier2/index.js';
import { prefabCapability, casterCapability, aggroCapability, flowCapability } from '@skills/tier3/index.js';
import {
  VIEW_W, VIEW_H, ARENA, START, TPS, MATCH_SECONDS,
  PLAYER, ENEMY, ZONE, COLLECTOR, KILLBOX, TINT,
  PLAYER_DEF, KUNAI, WEAPONS, SHAMBLER, GEM_BLUE, GEM_LIFE, SPAWNS,
  LEVEL_XP, DRAFT_POOL, PASSIVE_BY_KEY, type WeaponDef, type EnemyDef, type GemDef,
} from './theme.js';

const XF0 = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
const child = (parentId: string) => ({ parentId, localX: 0, localY: 0, localRotation: 0, localScaleX: 1, localScaleY: 1 });

// ── prefab 模板 ──────────────────────────────────────────────────────────────

// 子弹（按射法 pattern 组装·非运行时解释器·authoring 期 builder 同 game-q towerTemplate）：
//  straight=Launch 直飞·单发命中；beam=快速长条·穿一线(连续 per-tick)；boomerang=Launch 去 + Perception/Steering 拉回；
//  nova=自身大范围 Hitbox·短寿命扫全场(per-tick)。命中一律 ×power 系数·寿命回收。
function projByPattern(w: WeaponDef): { entities: Record<string, Record<string, unknown>> } {
  const base: Record<string, unknown> = {
    Transform: { ...XF0 },
    Sensor: {}, Tag: { flags: ZONE },
    Sprite: { textureKey: w.skin, anchorX: 0.5, anchorY: 0.5, zOrder: 2 }, // 皮肤槽
    Timer: { id: 'life', elapsed: 0, duration: w.life, loop: false },      // lifetime 回收
  };
  if (w.pattern === 'nova') {
    return { entities: { p: { ...base,
      Shape: { kind: 'circle', radius: w.radius },
      Color: { tint: w.tint, alpha: 0.26 },
      Hitbox: { resource: 'hp', amount: w.dmg, targetMask: ENEMY, scaleByResource: 'power' }, // per-tick·扫全范围
    } } };
  }
  const single = w.pattern === 'straight' || w.pattern === 'pet'; // 单发命中 vs 穿透 per-tick
  const p: Record<string, unknown> = { ...base,
    Velocity: { vx: 0, vy: 0, angular: 0 },
    Launch: { speed: w.projSpeed, toward: 'target', targetMask: ENEMY },
    Shape: w.pattern === 'beam' ? { kind: 'box', width: w.radius * 5, height: w.radius } : { kind: 'circle', radius: w.radius },
    Color: { tint: w.tint, alpha: 1 },
    Hitbox: { resource: 'hp', amount: w.dmg, targetMask: ENEMY, scaleByResource: 'power', ...(single ? { consumeOnHit: true } : {}) },
  };
  if (w.pattern === 'boomerang') { // Launch 一次定向飞出 → self-remove 后 steering 朝玩家拉回=往返
    p.Perception = { targetTag: PLAYER, sightRadius: 0 };
    p.Steering = { mode: 'seek', speed: w.projSpeed, stopRange: 6 };
  }
  return { entities: { p } };
}

// 武器挂点（draft 选中即 Caster spawn·child of player 跟随）：按 pattern 造持续伤/发射器。
//  orbit=环上静态光球 child（持续贴身 AoE）；pet=独立跟随子体（自带 Timer+SelfRule 自动射）；
//  其余=child 发射器（Timer 到点 SelfRule spawn proj_<key> at:self）。
function weaponMount(w: WeaponDef): { entities: Record<string, Record<string, unknown>> } {
  if (w.pattern === 'orbit') {
    const ents: Record<string, Record<string, unknown>> = {};
    for (let i = 0; i < w.amount; i++) {
      const a = (Math.PI * 2 * i) / w.amount;
      ents[`ball${i}`] = {
        Hierarchy: { parentId: 'player', localX: Math.round(Math.cos(a) * w.radius), localY: Math.round(Math.sin(a) * w.radius), localRotation: 0, localScaleX: 1, localScaleY: 1 },
        Transform: { ...XF0 },
        Sensor: {}, Tag: { flags: ZONE },
        Shape: { kind: 'circle', radius: 12 },
        Sprite: { textureKey: w.skin, anchorX: 0.5, anchorY: 0.5, zOrder: 1 }, // 皮肤槽
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
    Timer: { id: 'fire', elapsed: 0, duration: w.cd, loop: true },
    SelfRule: { when: { kind: 'timer', id: 'fire', cmp: 'gte', value: Math.max(1, w.cd - 1) }, do: [{ kind: 'spawn', template: `proj_${w.key}`, at: 'self' }], once: true, armed: false },
  } } };
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
      const targetId = p.kind === 'power' ? 'power' : 'hp';
      out[`fx-${u.id}`] = { Effect: { onSignal: u.effectSignal, kind: 'modify-resource', targetId, op: 'add', value: p.value } };
    } else {
      out[`cast-${u.id}`] = { Caster: { onSignal: u.effectSignal, template: `weapon_${u.id}`, at: 'self', originEntity: 'player' } };
    }
  }
  return out;
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

    // ── 升级机（xp 满阈值 edge → 等级 +1 + 扣阈值·自动记账；强化本身=三选一 draft 由玩家选·见 draftPickEntities）──
    'levelup-gate': { EventWhen: { signal: 'levelup', when: { kind: 'resource', id: 'xp', cmp: 'gte', value: LEVEL_XP }, mode: 'edge', armed: false } },
    'lv-fx-xp': { Effect: { onSignal: 'levelup', kind: 'modify-resource', targetId: 'xp', op: 'add', value: -LEVEL_XP } },
    'lv-fx-level': { Effect: { onSignal: 'levelup', kind: 'modify-resource', targetId: 'level', op: 'add', value: 1 } },

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
          [`enemy_${SHAMBLER.key}`]: enemyTemplate(SHAMBLER, `gem_${SHAMBLER.gem}`),
          [`gem_${GEM_BLUE.key}`]: gemTemplate(GEM_BLUE),
          // 全武器：每把一个 proj_<key>（射法模板）+ 非起始武器一个 weapon_<key>（挂点·draft 生成）。
          ...Object.fromEntries(WEAPONS.map((w) => [`proj_${w.key}`, projByPattern(w)])),
          ...Object.fromEntries(WEAPONS.filter((w) => w.key !== 'kunai').map((w) => [`weapon_${w.key}`, weaponMount(w)])),
        },
      },
    },

    ...draftPickEntities(),
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
      steeringCapability, launchCapability, selfRuleCapability, keybindCapability,
      prefabCapability, casterCapability, aggroCapability, flowCapability,
    ],
    entities,
  };
}
