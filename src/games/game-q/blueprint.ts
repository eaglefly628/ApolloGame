// Game Q · Neon Siege —— play-field 世界 = 纯数据（WorldBlueprint）。零塔防专属系统代码。
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
  FIELD_W, ZONE, ENEMY, TOWER, BASE, TICKET, TINT, TOWERS, ENEMIES,
  START_GOLD, START_LIVES, INCOME_PER, INCOME_EVERY, WAVE_SCHEDULE, LANE_NODES, LANE_EDGES,
  SPAWN, BASE_POS, LANE_WIDTH, PROBE_R, ARRIVE_RANGE, PAD_SPOTS, type TowerDef, type EnemyDef,
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

// ── prefab 模板 ──────────────────────────────────────────────────────────────
function towerTemplate(def: TowerDef): { entities: Record<string, Record<string, unknown>> } {
  return {
    entities: {
      ring: { // 射程/底座光环（render-only）
        Hierarchy: { parentId: '@local:body', localX: 0, localY: 0, localRotation: 0, localScaleX: 1, localScaleY: 1 },
        Transform: { ...XF0 },
        Shape: { kind: 'circle', radius: Math.round(def.radius * 1.5) },
        Color: { tint: def.tint, alpha: 0.16 },
      },
      body: {
        Transform: { ...XF0 },
        Tag: { flags: TOWER },
        Shape: { kind: 'polygon', vertices: hexVerts(def.radius) },
        Color: { tint: def.tint, alpha: 1 },
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
      core: { // 呼吸核（render-only·pingpong tween）
        Hierarchy: { parentId: '@local:body', localX: 0, localY: 0, localRotation: 0, localScaleX: 1, localScaleY: 1 },
        Transform: { ...XF0 },
        Shape: { kind: 'circle', radius: Math.round(def.radius * 0.5) },
        Color: { tint: def.coreTint, alpha: 1 },
        Tween: { target: 'Color.alpha', from: 1, to: 0.5, elapsed: 0, duration: 42, easing: 'easeInOut', loop: 'pingpong', done: false },
      },
    },
  };
}

// 命中特效：hit=单发伤害区(consumeOnHit·精确一次)；flash=纯表现闪环(淡出)。均生成在目标位置。
function zapTemplate(def: TowerDef): { entities: Record<string, Record<string, unknown>> } {
  return {
    entities: {
      hit: {
        Transform: { ...XF0 },
        Visibility: { visible: false, active: true }, // 隐形单发判定区（不渲染·非美术需求·Hitbox 仍 sim 生效）
        Shape: { kind: 'circle', radius: 11 },
        Color: { tint: 0xffffff, alpha: 0 },
        Sensor: {},
        Tag: { flags: ZONE },
        Hitbox: { resource: 'hp', amount: def.dmg, targetMask: ENEMY, consumeOnHit: true }, // 单发结算·精确 dmg
        Timer: { id: 'life', elapsed: 0, duration: 6, loop: false },                        // 未命中兜底回收
      },
      flash: {
        Transform: { x: 0, y: 0, rotation: 0, scaleX: 1.6, scaleY: 1.6 },
        Shape: { kind: 'circle', radius: 13 },
        Color: { tint: def.zapTint, alpha: 0.92 },
        Tween: { target: 'Color.alpha', from: 0.92, to: 0, elapsed: 0, duration: 12, easing: 'easeOut', done: false },
        Timer: { id: 'life', elapsed: 0, duration: 12, loop: false },
      },
    },
  };
}

function enemyTemplate(def: EnemyDef): { entities: Record<string, Record<string, unknown>> } {
  return {
    entities: {
      body: {
        Transform: { ...XF0 },
        Velocity: { vx: 0, vy: 0, angular: 0 },
        NavAgent: { speed: def.speed, arriveRange: ARRIVE_RANGE },
        Relation: { kind: 'target', targetId: 'base' },
        Tag: { flags: ENEMY },
        Shape: enemyBodyShape(def),
        Color: { tint: def.tint, alpha: 1 },
        Resource: { id: 'hp', current: def.hp, min: 0, max: def.hp },
        Mortal: { resource: 'hp', atOrBelow: 0, dropTemplate: `burst_${def.key}` },
      },
      inner: { // 内芯细节（render-only·增加体积感）
        Hierarchy: { parentId: '@local:body', localX: 0, localY: 0, localRotation: 0, localScaleX: 1, localScaleY: 1 },
        Transform: { ...XF0 },
        Shape: { kind: 'circle', radius: Math.round(def.radius * 0.45) },
        Color: { tint: def.inTint, alpha: 0.9 },
      },
      hpbar: {
        Hierarchy: { parentId: '@local:body', localX: 0, localY: -(def.radius + 9), localRotation: 0, localScaleX: 1, localScaleY: 1 },
        Transform: { ...XF0 },
        Shape: { kind: 'box', width: def.radius * 2, height: 4 },
        Color: { tint: TINT.hpBar, alpha: 1 },
        Gauge: { resourceId: 'hp', fromParent: true, width: def.radius * 2 },
      },
      probe: {
        Hierarchy: { parentId: '@local:body', localX: 0, localY: 0, localRotation: 0, localScaleX: 1, localScaleY: 1 },
        Transform: { ...XF0 },
        Visibility: { visible: false, active: true }, // 隐形漏怪探针（不渲染·非美术需求·Hitbox 仍 sim 生效）
        Shape: { kind: 'circle', radius: PROBE_R },
        Color: { tint: 0xffffff, alpha: 0 },
        Sensor: {},
        Tag: { flags: ZONE },
        Hitbox: { resource: 'lives', amount: 1, targetMask: BASE, consumeOnHit: true },
      },
    },
  };
}

function burstTemplate(tint: number, r: number): { entities: Record<string, Record<string, unknown>> } {
  return {
    entities: {
      f: {
        Transform: { x: 0, y: 0, rotation: 0, scaleX: 1.7, scaleY: 1.7 },
        Shape: { kind: 'circle', radius: r },
        Color: { tint, alpha: 0.9 },
        Tween: { target: 'Color.alpha', from: 0.9, to: 0, elapsed: 0, duration: 16, easing: 'easeOut', done: false },
        Timer: { id: 'life', elapsed: 0, duration: 16, loop: false },
      },
    },
  };
}

// ── 车道轨道（render-only·辉光底 + 道面 + 出生门）─────────────────────────────
function laneTrackEntities(): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  const seg = (i: number): { mx: number; my: number; len: number; ang: number } => {
    const a = LANE_NODES[LANE_EDGES[i].a], b = LANE_NODES[LANE_EDGES[i].b];
    return { mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, len: Math.hypot(b.x - a.x, b.y - a.y), ang: Math.atan2(b.y - a.y, b.x - a.x) };
  };
  LANE_EDGES.forEach((_, i) => { const s = seg(i); out[`track-glow-${i}`] = { Transform: { x: s.mx, y: s.my, rotation: s.ang, scaleX: 1, scaleY: 1 }, Shape: { kind: 'box', width: s.len, height: LANE_WIDTH + 12 }, Color: { tint: TINT.laneEdge, alpha: 0.16 } }; });
  LANE_NODES.forEach((n, i) => { out[`track-nglow-${i}`] = { Transform: { x: n.x, y: n.y, rotation: 0, scaleX: 1, scaleY: 1 }, Shape: { kind: 'circle', radius: LANE_WIDTH / 2 + 6 }, Color: { tint: TINT.laneEdge, alpha: 0.16 } }; });
  LANE_EDGES.forEach((_, i) => { const s = seg(i); out[`track-seg-${i}`] = { Transform: { x: s.mx, y: s.my, rotation: s.ang, scaleX: 1, scaleY: 1 }, Shape: { kind: 'box', width: s.len, height: LANE_WIDTH }, Color: { tint: TINT.laneFill, alpha: 0.96 } }; });
  LANE_NODES.forEach((n, i) => { out[`track-node-${i}`] = { Transform: { x: n.x, y: n.y, rotation: 0, scaleX: 1, scaleY: 1 }, Shape: { kind: 'circle', radius: LANE_WIDTH / 2 }, Color: { tint: TINT.laneFill, alpha: 0.96 } }; });
  out['spawn-portal'] = { Transform: { x: SPAWN.x, y: SPAWN.y, rotation: 0, scaleX: 1, scaleY: 1 }, Shape: { kind: 'circle', radius: 18 }, Color: { tint: TINT.enemyBasic, alpha: 0.4 } };
  return out;
}

// ── 建造位（每个 spot = 一组实体·只此可布塔·点击生成塔并自毁=防叠/防布路）─────
// pad-p = 可见平台 + pulse 建造钮；pad-c = 同位透明 + cannon 建造钮。放置任一 → 两者皆销毁（占位）。
function padEntities(): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  PAD_SPOTS.forEach((s, n) => {
    const P = `pad-${n}-p`, C = `pad-${n}-c`;
    out[P] = {
      Transform: { x: s.x, y: s.y, rotation: 0, scaleX: 1, scaleY: 1 },
      Shape: { kind: 'polygon', vertices: hexVerts(18) },
      Color: { tint: TINT.padRim, alpha: 0.9 },
      Clickable: { action: `pp${n}`, onlyFlag: 'pending_pulse' },
      Caster: { onSignal: `pp${n}`, at: 'self', template: 'tower_pulse' },
      Effect: { onSignal: `pp${n}`, kind: 'destroy', targetEntity: '@signal-source' },
    };
    out[`pad-${n}-pc`] = { // 平台亮心（render-only·随 pad-p 级联销毁）
      Hierarchy: { parentId: P, localX: 0, localY: 0, localRotation: 0, localScaleX: 1, localScaleY: 1 },
      Transform: { ...XF0 },
      Shape: { kind: 'circle', radius: 6 },
      Color: { tint: TINT.padCore, alpha: 0.85 },
    };
    out[C] = {
      Transform: { x: s.x, y: s.y, rotation: 0, scaleX: 1, scaleY: 1 },
      Visibility: { visible: false, active: true }, // 隐形 cannon 建造钮（同位·不渲染·非美术需求·Clickable 仍生效）
      Shape: { kind: 'polygon', vertices: hexVerts(18) },
      Color: { tint: 0xffffff, alpha: 0 },
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

    // 大本营（非 zone·持 lives）+ 装饰环/核 + 护盾条
    base: {
      Transform: { x: BASE_POS.x, y: BASE_POS.y, rotation: 0, scaleX: 1, scaleY: 1 },
      Shape: { kind: 'box', width: 56, height: 120 },
      Color: { tint: TINT.base, alpha: 0.9 },
      Tag: { flags: BASE },
      Resource: { id: 'lives', current: START_LIVES, min: 0, max: START_LIVES },
    },
    'base-rim': { Hierarchy: { parentId: 'base', localX: 0, localY: 0, localRotation: 0, localScaleX: 1, localScaleY: 1 }, Transform: { ...XF0 }, Shape: { kind: 'polygon', vertices: hexVerts(40) }, Color: { tint: TINT.baseRim, alpha: 0.55 } },
    'base-core': { Hierarchy: { parentId: 'base', localX: 0, localY: 0, localRotation: 0, localScaleX: 1, localScaleY: 1 }, Transform: { ...XF0 }, Shape: { kind: 'circle', radius: 19 }, Color: { tint: TINT.baseCore, alpha: 1 }, Tween: { target: 'Color.alpha', from: 1, to: 0.55, elapsed: 0, duration: 46, easing: 'easeInOut', loop: 'pingpong', done: false } },
    'base-shield': { Hierarchy: { parentId: 'base', localX: 0, localY: -74, localRotation: 0, localScaleX: 1, localScaleY: 1 }, Transform: { ...XF0 }, Shape: { kind: 'box', width: 60, height: 6 }, Color: { tint: TINT.base, alpha: 1 }, Gauge: { resourceId: 'lives', fromParent: true, width: 60 } },
    killzone: {
      Transform: { x: 940, y: BASE_POS.y, rotation: 0, scaleX: 1, scaleY: 1 },
      Visibility: { visible: false, active: true }, // 隐形大本营清怪区（不渲染·非美术需求·Hitbox 仍 sim 生效）
      Shape: { kind: 'box', width: 120, height: 150 },
      Color: { tint: 0xffffff, alpha: 0 },
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
          burst_basic: burstTemplate(ENEMIES.basic.tint, ENEMIES.basic.radius * 1.5),
          burst_fast: burstTemplate(ENEMIES.fast.tint, ENEMIES.fast.radius * 1.5),
          burst_tank: burstTemplate(ENEMIES.tank.tint, ENEMIES.tank.radius * 1.5),
        },
      },
    },

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
