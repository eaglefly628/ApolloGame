// Game Q · Neon Siege —— play-field 世界 = 纯数据（WorldBlueprint）。零塔防专属系统代码。
//
// 【3D 盒庭版·render-only 换渲染方法·sim 一字未改】
//   同一份 2D sim（pathfind/命中制/经济/放置）驱动逻辑；挂 Camera3D 单例 → 引擎 2D→3D 桥把带 Mesh3D 的
//   2D 实体 groundPose 落到地面（sim x→X、sim y→Z、地面 y=0），换 ThreeRenderer 当微缩盒庭渲。
//   霓虹辉光 = 自发光材质(Material3D emissive) + 后处理泛光(Post3D.bloom)；金属高光 = PBR + Sky3D.env(IBL)。
//   大本营/装饰用 Transform3D 真三维多层堆叠（authored 静态）；敌/塔/FX 走 groundPose（跟 2D sim 位）。
//   3D 组件全是 render-only（不进 hash·不被 Condition 读）→ 确定性/回放/lockstep 与 2D 版逐 tick 同哈希。
//
//   敌人走道  = t2-pathfind(NavGraph+NavAgent+Relation) → t1-motion-apply（+collision-resolve 分离防叠）
//   波次生怪  = 生怪票实体(Timer+SelfRule spawn+lifetime)
//   塔开火    = t3-aggro(Perception 射程索敌→Relation) + e1-timer 节拍 → t2-self-rule spawn at:'target'
//               （命中制·仅射程内有敌才发·无空放）→ zap 命中区 t2-hitbox{consumeOnHit}（单发结算·精确伤害）
//   死亡      = overlap→trigger-zone→hitbox→mortal→destroy（+死亡爆闪 dropTemplate）
//   经济      = f1-resource(gold) + t2-over-time(涓流) + t2-craft-recipe(扣费置 pending 旗)
//   放置      = 车道旁离散建造位 pad（只此可点·各自唯一信号→caster at:self 生成→自毁占位·防叠/防布路）
//   漏怪扣命  = 敌 leak 探针子区(hitbox→base.lives) + 大本营 kill-zone(hitbox→敌 hp)
//   胜负      = t2-group-count(存活敌/剩余票) + t3-flow(GameFlow)
// 能力总览：docs/design/game-q/capability-plan.md。
import type { WorldBlueprint, EntityBlueprint } from '../../assembly/demo.assembly.js';
import {
  transformCapability, hierarchyCapability, velocityCapability, shapeCapability,
  overlapDetectCapability, timerCapability, resourceCapability, flagCapability,
  tagCapability, relationCapability, destroyCapability, colorCapability,
} from '@atom-skills/index.js';
import { motionApplyCapability, lifetimeCapability, hierarchyResolveCapability, hierarchyCascadeCapability, tweenCapability } from '@skills/tier1/index.js';
import {
  pathfindCapability, triggerZoneCapability, hitboxCapability, mortalCapability, overTimeCapability,
  effectApplyCapability, craftRecipeCapability, clickableCapability,
  keybindCapability, gaugeCapability, groupCountCapability, selfRuleCapability,
} from '@skills/tier2/index.js';
import { prefabCapability, casterCapability, aggroCapability, flowCapability } from '@skills/tier3/index.js';
import {
  ZONE, ENEMY, TOWER, BASE, TICKET, TINT, TOWERS, ENEMIES,
  START_GOLD, START_LIVES, INCOME_PER, INCOME_EVERY, WAVE_SCHEDULE, LANE_NODES, LANE_EDGES,
  SPAWN, BASE_POS, LANE_WIDTH, PROBE_R, ARRIVE_RANGE, PAD_SPOTS, type TowerDef, type EnemyDef, type Mesh3DSpec,
  CAMERA_3D, SUN_3D, FILL_3D, AMBIENT_3D, SKY_3D, FOG_3D, POST_3D, GROUND_3D, BASE_3D,
} from './theme.js';

const XF0 = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };

// ── 几何小工具（authoring 期纯数据构造·无 Math.random）───────────────────────
function hexVerts(r: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < 6; i++) { const a = (Math.PI / 3) * i - Math.PI / 6; out.push(Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r)); }
  return out;
}
function diamondVerts(r: number): number[] { return [0, -r, r, 0, 0, r, -r, 0]; }

function enemyBodyShape(def: EnemyDef): Record<string, unknown> {
  if (def.shape === 'circle') return { kind: 'circle', radius: def.radius };
  return { kind: 'polygon', vertices: def.shape === 'diamond' ? diamondVerts(def.radius) : hexVerts(def.radius) };
}

// ── 3D 渲染小工具（render-only）───────────────────────────────────────────────
// Mesh3D：groundPose(2D Transform) 落地面（y=height/2·下沿坐地）；sphere 取 width=直径、height=直径正球。
function mesh3d(m: Mesh3DSpec, tint: number): Record<string, unknown> {
  return { shape: m.shape, width: m.w, height: m.h, frontTint: tint, backTint: tint };
}
function emissiveMat(preset: string, color: number, emissive: number, ei = 0.85): Record<string, unknown> {
  return { preset, color, emissive, emissiveIntensity: ei };
}
// 平台圆盘（薄圆柱·落地面·发光边）。
function disc(dia: number, h: number, tint: number, emissive: number, ei = 0.7): Record<string, unknown> {
  return { Mesh3D: { shape: 'cylinder', width: dia, height: h, frontTint: tint, backTint: tint }, Material3D: emissiveMat('steel', tint, emissive, ei) };
}

// ── prefab 模板 ──────────────────────────────────────────────────────────────
// 塔身 = 单尊雕琢图元（cone/cylinder·PBR 金属 + 自发光霓虹）+ 脚下发光平台盘。sim 用 Perception/Timer/SelfRule（无 Shape）。
function towerTemplate(def: TowerDef): { entities: Record<string, Record<string, unknown>> } {
  return {
    entities: {
      pad: { // 脚下发光平台盘（render-only·随 body 级联销毁）
        Hierarchy: { parentId: '@local:body', localX: 0, localY: 0, localRotation: 0, localScaleX: 1, localScaleY: 1 },
        Transform: { ...XF0 },
        ...disc(def.radius * 2.6, 5, def.tint, def.emissive, 0.85),
      },
      body: {
        Transform: { ...XF0 },
        Tag: { flags: TOWER },
        Mesh3D: mesh3d(def.mesh, def.tint),
        Material3D: emissiveMat(def.mat, def.tint, def.emissive, 0.9),
        Perception: { targetTag: ENEMY, sightRadius: def.range },        // aggro → Relation(target)（仅射程内）
        Timer: { id: 'reload', elapsed: 0, duration: def.reload, loop: true },
        // 命中制开火：装填峰值 → 若射程内有敌(Relation 存在)则在其位置生成 zap；无敌 → 空转不放（省空放/无空炮）。
        SelfRule: {
          when: { kind: 'timer', id: 'reload', cmp: 'gte', value: def.reload - 1 },
          do: [{ kind: 'spawn', template: `zap_${def.key}`, at: 'target' }],
          once: true,
          armed: false,
        },
      },
      core: { // 顶灯（呼吸核·render-only·小发光球坐塔尖：height=2·塔高 → groundPose 把球心抬到 y≈塔高）
        Hierarchy: { parentId: '@local:body', localX: 0, localY: 0, localRotation: 0, localScaleX: 1, localScaleY: 1 },
        Transform: { ...XF0 },
        Mesh3D: { shape: 'sphere', width: def.radius * 0.9, height: def.mesh.h * 1.95, frontTint: def.coreTint },
        Material3D: emissiveMat('emissive', def.coreTint, def.coreTint, 1.4),
        Color: { tint: def.coreTint, alpha: 1 },
        Tween: { target: 'Color.alpha', from: 1, to: 0.5, elapsed: 0, duration: 42, easing: 'easeInOut', loop: 'pingpong', done: false },
      },
    },
  };
}

// 命中特效：hit=单发伤害区(consumeOnHit·精确一次·render 隐形)；flash=落地发光球淡出。均生成在目标位置。
function zapTemplate(def: TowerDef): { entities: Record<string, Record<string, unknown>> } {
  return {
    entities: {
      hit: {
        Transform: { ...XF0 },
        Visibility: { visible: false, active: true }, // 隐形 sim 判定区（不渲染·Hitbox 仍生效）
        Shape: { kind: 'circle', radius: 11 },
        Sensor: {},
        Tag: { flags: ZONE },
        Hitbox: { resource: 'hp', amount: def.dmg, targetMask: ENEMY, consumeOnHit: true }, // 单发结算·精确 dmg
        Timer: { id: 'life', elapsed: 0, duration: 6, loop: false },                        // 未命中兜底回收
      },
      flash: {
        Transform: { ...XF0 },
        Mesh3D: { shape: 'sphere', width: 30, height: 18, frontTint: def.zapTint },
        Color: { tint: def.zapTint, alpha: 0.92 },
        Tween: { target: 'Color.alpha', from: 0.92, to: 0, elapsed: 0, duration: 12, easing: 'easeOut', done: false },
        Timer: { id: 'life', elapsed: 0, duration: 12, loop: false },
      },
    },
  };
}

// 敌 = 2D sim 本体（pathfind/命中/漏怪）+ 3D 图元（groundPose 落地面·自发光霓虹）。血条落 3D 世界锚是缺口→暂省（详见 capability-plan）。
function enemyTemplate(def: EnemyDef): { entities: Record<string, Record<string, unknown>> } {
  return {
    entities: {
      body: {
        Transform: { ...XF0 },
        Velocity: { vx: 0, vy: 0, angular: 0 },
        NavAgent: { speed: def.speed, arriveRange: ARRIVE_RANGE },
        Relation: { kind: 'target', targetId: 'base' },
        Tag: { flags: ENEMY },
        Shape: enemyBodyShape(def),                    // 2D 碰撞轮廓（sensor 命中·render 走 Mesh3D）
        Mesh3D: mesh3d(def.mesh, def.tint),
        Material3D: emissiveMat(def.mat, def.tint, def.emissive, 0.7),
        Resource: { id: 'hp', current: def.hp, min: 0, max: def.hp },
        Mortal: { resource: 'hp', atOrBelow: 0, dropTemplate: `burst_${def.key}` },
      },
      probe: {
        Hierarchy: { parentId: '@local:body', localX: 0, localY: 0, localRotation: 0, localScaleX: 1, localScaleY: 1 },
        Transform: { ...XF0 },
        Visibility: { visible: false, active: true }, // 隐形漏怪探针（不渲染·Hitbox 仍生效）
        Shape: { kind: 'circle', radius: PROBE_R },
        Sensor: {},
        Tag: { flags: ZONE },
        Hitbox: { resource: 'lives', amount: 1, targetMask: BASE, consumeOnHit: true },
      },
    },
  };
}

// 死亡爆闪：落地发光球（淡出·render-only）。
function burstTemplate(tint: number, dia: number): { entities: Record<string, Record<string, unknown>> } {
  return {
    entities: {
      f: {
        Transform: { ...XF0 },
        Mesh3D: { shape: 'sphere', width: dia * 2, height: dia, frontTint: tint },
        Color: { tint, alpha: 0.9 },
        Tween: { target: 'Color.alpha', from: 0.9, to: 0, elapsed: 0, duration: 16, easing: 'easeOut', done: false },
        Timer: { id: 'life', elapsed: 0, duration: 16, loop: false },
      },
    },
  };
}

// ── 车道轨道（render-only·落地面发光道 + 节点盘 + 出生门）─────────────────────
function laneTrackEntities(): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  const seg = (i: number): { mx: number; my: number; len: number; ang: number } => {
    const a = LANE_NODES[LANE_EDGES[i].a], b = LANE_NODES[LANE_EDGES[i].b];
    return { mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, len: Math.hypot(b.x - a.x, b.y - a.y), ang: Math.atan2(b.y - a.y, b.x - a.x) };
  };
  // 道面（落地面薄板·rotation → 绕 Y 朝向·发光边金属道）
  LANE_EDGES.forEach((_, i) => {
    const s = seg(i);
    out[`track-seg-${i}`] = {
      Transform: { x: s.mx, y: s.my, rotation: s.ang, scaleX: 1, scaleY: 1 },
      Mesh3D: { shape: 'box', width: s.len, height: 5, depth: LANE_WIDTH, frontTint: TINT.laneFill, backTint: TINT.laneFill, edgeTint: TINT.laneEdge },
      Material3D: emissiveMat('steel', TINT.laneFill, TINT.laneEdge, 0.35),
    };
  });
  // 节点盘（拐点圆盘·亮一档接缝）
  LANE_NODES.forEach((n, i) => {
    out[`track-node-${i}`] = {
      Transform: { x: n.x, y: n.y, rotation: 0, scaleX: 1, scaleY: 1 },
      ...disc(LANE_WIDTH + 6, 6, TINT.laneFill, TINT.laneEdge, 0.5),
    };
  });
  // 出生门（发光圆盘·敌从此涌出）
  out['spawn-portal'] = {
    Transform: { x: SPAWN.x, y: SPAWN.y, rotation: 0, scaleX: 1, scaleY: 1 },
    ...disc(46, 7, TINT.enemyBasic, TINT.enemyBasic, 1.1),
  };
  return out;
}

// ── 建造位（每个 spot = 一组实体·只此可布塔·点击生成塔并自毁=防叠/防布路）─────
// pad-p = 可见发光平台 + pulse 建造钮；pad-c = 同位隐形 + cannon 建造钮。放置任一 → 两者皆销毁（占位）。
function padEntities(): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  PAD_SPOTS.forEach((s, n) => {
    const P = `pad-${n}-p`, C = `pad-${n}-c`;
    out[P] = {
      Transform: { x: s.x, y: s.y, rotation: 0, scaleX: 1, scaleY: 1 },
      Shape: { kind: 'polygon', vertices: hexVerts(18) },   // 2D 点击命中区（render 走 Mesh3D 盘）
      ...disc(40, 8, TINT.padRim, TINT.padGlow, 0.6),
      Clickable: { action: `pp${n}`, onlyFlag: 'pending_pulse' },
      Caster: { onSignal: `pp${n}`, at: 'self', template: 'tower_pulse' },
      Effect: { onSignal: `pp${n}`, kind: 'destroy', targetEntity: '@signal-source' },
    };
    out[`pad-${n}-pc`] = { // 平台亮心（render-only·随 pad-p 级联销毁）
      Hierarchy: { parentId: P, localX: 0, localY: 0, localRotation: 0, localScaleX: 1, localScaleY: 1 },
      Transform: { ...XF0 },
      Mesh3D: { shape: 'sphere', width: 12, height: 12, frontTint: TINT.padCore },
      Material3D: emissiveMat('emissive', TINT.padCore, TINT.padCore, 1.2),
    };
    out[C] = {
      Transform: { x: s.x, y: s.y, rotation: 0, scaleX: 1, scaleY: 1 },
      Visibility: { visible: false, active: true }, // 隐形 cannon 建造钮（同位·Clickable 仍生效）
      Shape: { kind: 'polygon', vertices: hexVerts(18) },
      Clickable: { action: `pc${n}`, onlyFlag: 'pending_cannon' },
      Caster: { onSignal: `pc${n}`, at: 'self', template: 'tower_cannon' },
      Effect: { onSignal: `pc${n}`, kind: 'destroy', targetEntity: '@signal-source' },
    };
    // 放置副作用（各一实体一 Effect）：清 pending 旗 + 销毁同位另一建造钮（占位）。
    out[`pad-${n}-fx-clp`] = { Effect: { onSignal: `pp${n}`, kind: 'set-flag', targetId: 'pending_pulse', value: false } };
    out[`pad-${n}-fx-kilc`] = { Effect: { onSignal: `pp${n}`, kind: 'destroy', targetEntity: C } };
    out[`pad-${n}-fx-clc`] = { Effect: { onSignal: `pc${n}`, kind: 'set-flag', targetId: 'pending_cannon', value: false } };
    out[`pad-${n}-fx-kilp`] = { Effect: { onSignal: `pc${n}`, kind: 'destroy', targetEntity: P } };
  });
  return out;
}

// ── 生怪票（Timer 到点 self-rule 展开一只怪·lifetime 回收自身）────────────────
function spawnTicketEntities(): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  WAVE_SCHEDULE.forEach((row, i) => {
    out[`spawn-${i}`] = {
      Transform: { x: SPAWN.x, y: SPAWN.y, rotation: 0, scaleX: 1, scaleY: 1 },
      Tag: { flags: TICKET },
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

// ── 3D 盒庭渲染单例 + 大本营堡（render-only·全不进 hash）──────────────────────
function scene3dEntities(): Record<string, EntityBlueprint> {
  return {
    // 轨道相机（在场即开盒庭模式：2D 实体落地面 + 柔和阴影 + 数据化取景）。
    cam3d: { Camera3D: {
      yaw: CAMERA_3D.yaw, pitch: CAMERA_3D.pitch, projection: CAMERA_3D.projection,
      orthoSize: CAMERA_3D.orthoSize, distance: CAMERA_3D.distance,
      pivotX: CAMERA_3D.pivotX, pivotY: CAMERA_3D.pivotY, pivotZ: CAMERA_3D.pivotZ,
      near: CAMERA_3D.near, far: CAMERA_3D.far,
    } },
    sun: { Light3D: { kind: 'directional', color: SUN_3D.color, intensity: SUN_3D.intensity, dirX: SUN_3D.dirX, dirY: SUN_3D.dirY, dirZ: SUN_3D.dirZ, castShadow: true } },
    fill: { Light3D: { kind: 'directional', color: FILL_3D.color, intensity: FILL_3D.intensity, dirX: FILL_3D.dirX, dirY: FILL_3D.dirY, dirZ: FILL_3D.dirZ } },
    amb: { Light3D: { kind: 'ambient', color: AMBIENT_3D.color, intensity: AMBIENT_3D.intensity } },
    sky: { Sky3D: { top: SKY_3D.top, bottom: SKY_3D.bottom, env: SKY_3D.env } },
    fog: { Fog3D: { color: FOG_3D.color, near: FOG_3D.near, far: FOG_3D.far } },
    post: { Post3D: { bloom: POST_3D.bloom, tiltShift: POST_3D.tiltShift, ao: POST_3D.ao, aa: POST_3D.aa } },
    // 地台（大平板·顶在 y=0·程序化起伏·掠光下有质感）。
    ground: {
      Transform3D: { x: CAMERA_3D.pivotX, y: -GROUND_3D.h / 2, z: CAMERA_3D.pivotZ },
      Mesh3D: { shape: 'box', width: GROUND_3D.w, height: GROUND_3D.h, depth: GROUND_3D.d, frontTint: GROUND_3D.side, backTint: GROUND_3D.side, edgeTint: GROUND_3D.top },
      Material3D: { preset: 'matte', color: GROUND_3D.top, surface: { pattern: 'noise', tiles: 16, normal: 0.28, rough: 0.7, scale: 1.2 } },
    },
    // 大本营堡（Transform3D 真三维·三层堆叠·独立于碰撞 base 实体·同 XZ 位）。
    'base-tier': {
      Transform3D: { x: BASE_POS.x, y: BASE_3D.h / 2, z: BASE_POS.y },
      Mesh3D: { shape: 'box', width: BASE_3D.w, height: BASE_3D.h, depth: BASE_3D.d, frontTint: TINT.base, backTint: TINT.base, edgeTint: TINT.baseCore },
      Material3D: emissiveMat('steel', TINT.base, TINT.baseRim, 0.4),
    },
    'base-spire': {
      Transform3D: { x: BASE_POS.x, y: BASE_3D.h + 22, z: BASE_POS.y },
      Mesh3D: { shape: 'cylinder', width: 30, height: 44, frontTint: TINT.base, backTint: TINT.base },
      Material3D: emissiveMat('steel', TINT.base, TINT.base, 0.6),
    },
    'base-core': {
      Transform3D: { x: BASE_POS.x, y: BASE_3D.h + 52, z: BASE_POS.y },
      Mesh3D: { shape: 'sphere', width: 22, height: 22, frontTint: TINT.baseCore },
      Material3D: emissiveMat('emissive', TINT.baseCore, TINT.baseCore, 1.6),
      Glow3D: { color: TINT.baseCore, scale: 90, opacity: 0.5 },
    },
  };
}

// ── 组装 ────────────────────────────────────────────────────────────────────
export function buildBlueprint(): WorldBlueprint {
  const entities: Record<string, EntityBlueprint> = {
    gold: {
      Resource: { id: 'gold', current: START_GOLD, min: 0, max: 99999 },
      OverTime: { effects: [{ id: 'income', resource: 'gold', amountPerTick: INCOME_PER, period: INCOME_EVERY, duration: 999999999, elapsed: 0 }] },
    },
    livecount: { Resource: { id: 'enemies_alive', current: 0, min: 0, max: 9999 }, GroupCount: { countResource: 'enemies_alive', requiredTag: ENEMY } },
    ticketcount: { Resource: { id: 'tickets_left', current: WAVE_SCHEDULE.length, min: 0, max: 9999 }, GroupCount: { countResource: 'tickets_left', requiredTag: TICKET } },

    'flag-pending-pulse': { Flag: { id: 'pending_pulse', active: false } },
    'flag-pending-cannon': { Flag: { id: 'pending_cannon', active: false } },

    // 大本营碰撞体（2D Transform + Shape·持 lives·render 走 base-tier/spire/core 3D 堡·此实体隐形）
    base: {
      Transform: { x: BASE_POS.x, y: BASE_POS.y, rotation: 0, scaleX: 1, scaleY: 1 },
      Visibility: { visible: false, active: true },
      Shape: { kind: 'box', width: 56, height: 120 },
      Tag: { flags: BASE },
      Resource: { id: 'lives', current: START_LIVES, min: 0, max: START_LIVES },
    },
    killzone: {
      Transform: { x: 940, y: BASE_POS.y, rotation: 0, scaleX: 1, scaleY: 1 },
      Visibility: { visible: false, active: true },
      Shape: { kind: 'box', width: 120, height: 150 },
      Sensor: {},
      Tag: { flags: ZONE },
      Hitbox: { resource: 'hp', amount: 99999, targetMask: ENEMY },
    },

    lane: { NavGraph: { nodes: LANE_NODES, edges: LANE_EDGES } },

    flow: {
      GameFlow: {
        id: 'match', current: 'playing',
        states: [
          {
            id: 'playing',
            transitions: [
              { when: { kind: 'resource', id: 'lives', cmp: 'lte', value: 0 }, to: 'defeat' },
              { when: { kind: 'and', of: [{ kind: 'resource', id: 'tickets_left', cmp: 'lte', value: 0 }, { kind: 'resource', id: 'enemies_alive', cmp: 'lte', value: 0 }] }, to: 'victory' },
            ],
          },
          { id: 'victory' },
          { id: 'defeat' },
        ],
      },
    },

    'recipe-pulse': { CraftRecipe: { onSignal: 'buy_pulse', costs: [{ id: 'gold', amount: TOWERS.pulse.cost }], grantsFlag: 'pending_pulse' } },
    'recipe-cannon': { CraftRecipe: { onSignal: 'buy_cannon', costs: [{ id: 'gold', amount: TOWERS.cannon.cost }], grantsFlag: 'pending_cannon' } },
    'kb-buy-pulse': { KeyBinding: { key: 'buy_pulse', signal: 'buy_pulse' } },
    'kb-buy-cannon': { KeyBinding: { key: 'buy_cannon', signal: 'buy_cannon' } },

    library: {
      PrefabLibrary: {
        seq: 0,
        templates: {
          tower_pulse: towerTemplate(TOWERS.pulse),
          tower_cannon: towerTemplate(TOWERS.cannon),
          zap_pulse: zapTemplate(TOWERS.pulse),
          zap_cannon: zapTemplate(TOWERS.cannon),
          enemy_basic: enemyTemplate(ENEMIES.basic),
          enemy_fast: enemyTemplate(ENEMIES.fast),
          enemy_tank: enemyTemplate(ENEMIES.tank),
          burst_basic: burstTemplate(ENEMIES.basic.emissive, ENEMIES.basic.radius * 1.5),
          burst_fast: burstTemplate(ENEMIES.fast.emissive, ENEMIES.fast.radius * 1.5),
          burst_tank: burstTemplate(ENEMIES.tank.emissive, ENEMIES.tank.radius * 1.5),
        },
      },
    },

    ...scene3dEntities(),
    ...laneTrackEntities(),
    ...padEntities(),
    ...spawnTicketEntities(),
  };

  return {
    capabilities: [
      transformCapability, hierarchyCapability, velocityCapability, shapeCapability,
      overlapDetectCapability, timerCapability, resourceCapability, flagCapability,
      tagCapability, relationCapability, destroyCapability, colorCapability,
      motionApplyCapability, lifetimeCapability, hierarchyResolveCapability, hierarchyCascadeCapability, tweenCapability,
      pathfindCapability, triggerZoneCapability, hitboxCapability, mortalCapability, overTimeCapability,
      effectApplyCapability, craftRecipeCapability, clickableCapability,
      keybindCapability, gaugeCapability, groupCountCapability, selfRuleCapability,
      prefabCapability, casterCapability, aggroCapability, flowCapability,
    ],
    entities,
  };
}
