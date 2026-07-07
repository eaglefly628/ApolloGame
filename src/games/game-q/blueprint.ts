// Game Q · Neon Siege —— play-field 世界 = 纯数据（WorldBlueprint）。
//
// 塔防整套循环全部由**现有引擎能力**组合涌现，零游戏层系统代码：
//   敌人走道  = t2-pathfind(NavGraph+NavAgent+Relation) → t1-motion-apply
//   波次生怪  = t3-timeline(spawn cues) → t3-prefab
//   塔自动开火= e1-timer 节拍 → t2-self-rule(spawn·per-instance) → t2-launch 抛射 → t2-hitbox 结算
//   伤害/死亡 = d1-overlap-detect → t2-trigger-zone → t2-hitbox → t2-mortal → k2-destroy
//   经济      = f1-resource(gold) + t2-craft-recipe(造塔扣费) + timeline resource-cue(清波奖金/涓流)
//   造塔放置  = HUD 买(keybind→craft-recipe 置 pending 旗) → 点场(clickable onlyFlag 门) → caster at:pointer 生成
//   漏怪扣命  = 敌带 leak 探针子区(hitbox→base.lives) + 大本营 kill-zone(hitbox→敌 hp) 双区（几何见下）
//   胜负      = t2-group-count(存活敌数) + t3-flow(GameFlow 状态机)
//   血条/护盾 = t2-gauge(Resource→Shape 宽) + a2-hierarchy
// 能力总览审计：docs/design/game-q/capability-plan.md。
import type { WorldBlueprint, EntityBlueprint } from '../../assembly/demo.assembly.js';
import {
  transformCapability, hierarchyCapability, velocityCapability, shapeCapability,
  overlapDetectCapability, timerCapability, resourceCapability, flagCapability,
  tagCapability, relationCapability, destroyCapability, colorCapability, randomCapability,
} from '@atom-skills/index.js';
import { motionApplyCapability, lifetimeCapability, hierarchyResolveCapability, hierarchyCascadeCapability, tweenCapability } from '@skills/tier1/index.js';
import {
  pathfindCapability, triggerZoneCapability, hitboxCapability, mortalCapability, overTimeCapability,
  eventWhenCapability, effectApplyCapability, craftRecipeCapability, clickableCapability,
  launchCapability, keybindCapability, gaugeCapability, groupCountCapability, selfRuleCapability,
} from '@skills/tier2/index.js';
import { prefabCapability, casterCapability, flowCapability } from '@skills/tier3/index.js';
import {
  FIELD_W, FIELD_H, ZONE, ENEMY, TOWER, BASE, TICKET, TINT, TOWERS, ENEMIES,
  START_GOLD, START_LIVES, INCOME_PER, INCOME_EVERY, WAVE_SCHEDULE, LANE_NODES, LANE_EDGES,
  SPAWN, BASE_POS, LANE_WIDTH, PROBE_R, ARRIVE_RANGE, type TowerDef, type EnemyDef,
} from './theme.js';

const XF0 = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }; // prefab 内本地原点（展开时按 spawn xy 偏移）

// ── 几何小工具（authoring 期纯数据构造·非运行逻辑·无 Math.random）───────────
function hexVerts(r: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    out.push(Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r));
  }
  return out;
}

// ── prefab 模板：塔 / 弹 / 敌（纯数据·t3-prefab 展开）─────────────────────────
function towerTemplate(def: TowerDef): { entities: Record<string, Record<string, unknown>> } {
  return {
    entities: {
      body: {
        Transform: { ...XF0 },
        Tag: { flags: TOWER },
        Shape: { kind: 'polygon', vertices: hexVerts(def.radius) },
        Color: { tint: def.tint, alpha: 1 },
        Timer: { id: 'reload', elapsed: 0, duration: def.reload, loop: true },
        // per-instance 开火：读自身 reload 计时峰值 → 从自身生成一发弹；全局门=场上有敌才开火（省空放）。
        SelfRule: {
          when: { kind: 'timer', id: 'reload', cmp: 'gte', value: def.reload - 1 },
          do: [{ kind: 'spawn', template: `bolt_${def.key}`, at: 'self' }],
          once: true,
          whenGlobal: { kind: 'resource', id: 'enemies_alive', cmp: 'gte', value: 1 },
          armed: false,
        },
      },
      core: { // 装饰核心（render-only·亮点）
        Hierarchy: { parentId: '@local:body', localX: 0, localY: 0, localRotation: 0, localScaleX: 1, localScaleY: 1 },
        Transform: { ...XF0 },
        Shape: { kind: 'circle', radius: Math.round(def.radius * 0.42) },
        Color: { tint: 0xffffff, alpha: 0.9 },
      },
    },
  };
}

function boltTemplate(def: TowerDef): { entities: Record<string, Record<string, unknown>> } {
  return {
    entities: {
      glow: { // 能量光晕（render-only·先建=画在弹芯下）
        Hierarchy: { parentId: '@local:b', localX: 0, localY: 0, localRotation: 0, localScaleX: 1, localScaleY: 1 },
        Transform: { ...XF0 },
        Shape: { kind: 'circle', radius: def.bolt.radius * 2.2 },
        Color: { tint: def.bolt.tint, alpha: 0.28 },
      },
      b: {
        Transform: { ...XF0 },
        Velocity: { vx: 0, vy: 0, angular: 0 },
        Launch: { speed: def.bolt.speed, toward: 'target', targetMask: ENEMY }, // 出膛锁最近敌·直飞
        Shape: { kind: 'circle', radius: def.bolt.radius },
        Color: { tint: 0xffffff, alpha: 1 },
        Tag: { flags: ZONE },                                       // 伤害区
        Hitbox: { resource: 'hp', amount: def.bolt.dmg, targetMask: ENEMY },
        Timer: { id: 'life', elapsed: 0, duration: def.bolt.life, loop: false }, // 到寿命自毁（=射程）
      },
    },
  };
}

// 死亡爆闪（render-only·塔杀/漏怪皆放·纯表现无资源 → 不涉击杀记账缺口）：亮环随 alpha 淡出。
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

function enemyTemplate(def: EnemyDef): { entities: Record<string, Record<string, unknown>> } {
  return {
    entities: {
      body: {
        Transform: { ...XF0 },
        Velocity: { vx: 0, vy: 0, angular: 0 },
        NavAgent: { speed: def.speed, arriveRange: ARRIVE_RANGE },
        Relation: { kind: 'target', targetId: 'base' },            // 走向大本营
        Tag: { flags: ENEMY },
        Shape: { kind: 'circle', radius: def.radius },
        Color: { tint: def.tint, alpha: 1 },
        Resource: { id: 'hp', current: def.hp, min: 0, max: def.hp },
        Mortal: { resource: 'hp', atOrBelow: 0, dropTemplate: `burst_${def.key}` }, // hp≤0 自毁 + 死亡爆闪
      },
      hpbar: { // 头顶血条（gauge 写 Shape.width + Hierarchy.localX）
        Hierarchy: { parentId: '@local:body', localX: 0, localY: -(def.radius + 9), localRotation: 0, localScaleX: 1, localScaleY: 1 },
        Transform: { ...XF0 },
        Shape: { kind: 'box', width: def.radius * 2, height: 4 },
        Color: { tint: TINT.hpBar, alpha: 1 },
        Gauge: { resourceId: 'hp', fromParent: true, width: def.radius * 2 },
      },
      probe: { // 漏怪探针：抵达大本营时命中 base.lives（−1·一次性自毁）。
        Hierarchy: { parentId: '@local:body', localX: 0, localY: 0, localRotation: 0, localScaleX: 1, localScaleY: 1 },
        Transform: { ...XF0 },
        Shape: { kind: 'circle', radius: PROBE_R },
        Color: { tint: 0xffffff, alpha: 0 },                      // 不可见
        Tag: { flags: ZONE },
        Hitbox: { resource: 'lives', amount: 1, targetMask: BASE, consumeOnHit: true },
      },
    },
  };
}

// ── 车道轨道（render-only 装饰·NavGraph 的可视化）────────────────────────────
function laneTrackEntities(): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  const seg = (i: number): { mx: number; my: number; len: number; ang: number } => {
    const a = LANE_NODES[LANE_EDGES[i].a], b = LANE_NODES[LANE_EDGES[i].b];
    return { mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, len: Math.hypot(b.x - a.x, b.y - a.y), ang: Math.atan2(b.y - a.y, b.x - a.x) };
  };
  // pass 1：霓虹辉光底（更宽·亮青·低 alpha·画在最底）
  LANE_EDGES.forEach((_, i) => {
    const s = seg(i);
    out[`track-glow-${i}`] = {
      Transform: { x: s.mx, y: s.my, rotation: s.ang, scaleX: 1, scaleY: 1 },
      Shape: { kind: 'box', width: s.len, height: LANE_WIDTH + 12 },
      Color: { tint: TINT.laneEdge, alpha: 0.16 },
    };
  });
  LANE_NODES.forEach((n, i) => {
    out[`track-nglow-${i}`] = {
      Transform: { x: n.x, y: n.y, rotation: 0, scaleX: 1, scaleY: 1 },
      Shape: { kind: 'circle', radius: LANE_WIDTH / 2 + 6 },
      Color: { tint: TINT.laneEdge, alpha: 0.16 },
    };
  });
  // pass 2：道面填充（画在辉光之上、单位之下）
  LANE_EDGES.forEach((_, i) => {
    const s = seg(i);
    out[`track-seg-${i}`] = {
      Transform: { x: s.mx, y: s.my, rotation: s.ang, scaleX: 1, scaleY: 1 },
      Shape: { kind: 'box', width: s.len, height: LANE_WIDTH },
      Color: { tint: TINT.laneFill, alpha: 0.96 },
    };
  });
  LANE_NODES.forEach((n, i) => {
    out[`track-node-${i}`] = {
      Transform: { x: n.x, y: n.y, rotation: 0, scaleX: 1, scaleY: 1 },
      Shape: { kind: 'circle', radius: LANE_WIDTH / 2 },
      Color: { tint: TINT.laneFill, alpha: 0.96 },
    };
  });
  // 出生传送门（装饰）
  out['spawn-portal'] = {
    Transform: { x: SPAWN.x, y: SPAWN.y, rotation: 0, scaleX: 1, scaleY: 1 },
    Shape: { kind: 'circle', radius: 18 },
    Color: { tint: TINT.enemyBasic, alpha: 0.4 },
  };
  return out;
}

// ── 波次 = 数据驱动生怪票（每张票 = 一实体·Timer 到点 self-rule 展开一只怪·lifetime 回收自身）──
// 用 self-rule(spawn) + timer + lifetime 组合表达「第 N tick 生一只 X」——比 timeline 更纯（每次生成=一条数据），
// 且与全套逻辑系统天然可定序（timeline 声明写 Resource/Flag 会与 resource 管线互为 RMW 伪环·此路避开）。
function spawnTicketEntities(): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  WAVE_SCHEDULE.forEach((row, i) => {
    out[`spawn-${i}`] = {
      Transform: { x: SPAWN.x, y: SPAWN.y, rotation: 0, scaleX: 1, scaleY: 1 },
      Tag: { flags: TICKET },
      Timer: { id: 'life', elapsed: 0, duration: row.at, loop: false }, // 到点 → lifetime 回收（生成在前一 tick 先发）
      SelfRule: {
        when: { kind: 'timer', id: 'life', cmp: 'gte', value: Math.max(1, row.at - 1) },
        do: [{ kind: 'spawn', template: `enemy_${row.key}`, at: 'self' }],
        once: true,
        armed: false,
      },
    };
  });
  return out;
}

// ── 组装整个 play-field ─────────────────────────────────────────────────────
export function buildBlueprint(): WorldBlueprint {
  const entities: Record<string, EntityBlueprint> = {
    // 世界单例：确定性随机源
    rng: { RandomSeed: { seed: 0x9e37, sequence: 0 } },

    // 经济：金币池 + over-time 被动涓流收入（局部 ResourceModify → resource-apply 入账）
    gold: {
      Resource: { id: 'gold', current: START_GOLD, min: 0, max: 99999 },
      OverTime: { effects: [{ id: 'income', resource: 'gold', amountPerTick: INCOME_PER, period: INCOME_EVERY, duration: 999999999, elapsed: 0 }] },
    },
    // 存活敌数（胜利读）
    livecount: {
      Resource: { id: 'enemies_alive', current: 0, min: 0, max: 9999 },
      GroupCount: { countResource: 'enemies_alive', requiredTag: ENEMY },
    },
    // 剩余生怪票（全部展开 = 波次放完；胜利读）
    ticketcount: {
      Resource: { id: 'tickets_left', current: WAVE_SCHEDULE.length, min: 0, max: 9999 },
      GroupCount: { countResource: 'tickets_left', requiredTag: TICKET },
    },

    // 布尔态（每实体一个 Flag）
    'flag-pending-pulse': { Flag: { id: 'pending_pulse', active: false } },
    'flag-pending-cannon': { Flag: { id: 'pending_cannon', active: false } },
    'flag-victory': { Flag: { id: 'show_victory', active: false } },
    'flag-defeat': { Flag: { id: 'show_defeat', active: false } },

    // 大本营（非 zone·持 lives·被 leak 探针命中）+ 装饰核 + 护盾条
    base: {
      Transform: { x: BASE_POS.x, y: BASE_POS.y, rotation: 0, scaleX: 1, scaleY: 1 },
      Shape: { kind: 'box', width: 56, height: 120 },
      Color: { tint: TINT.base, alpha: 0.9 },
      Tag: { flags: BASE },
      Resource: { id: 'lives', current: START_LIVES, min: 0, max: START_LIVES },
    },
    'base-core': {
      Hierarchy: { parentId: 'base', localX: 0, localY: 0, localRotation: 0, localScaleX: 1, localScaleY: 1 },
      Transform: { ...XF0 },
      Shape: { kind: 'circle', radius: 20 },
      Color: { tint: TINT.baseCore, alpha: 1 },
    },
    'base-shield': {
      Hierarchy: { parentId: 'base', localX: 0, localY: -74, localRotation: 0, localScaleX: 1, localScaleY: 1 },
      Transform: { ...XF0 },
      Shape: { kind: 'box', width: 60, height: 6 },
      Color: { tint: TINT.base, alpha: 1 },
      Gauge: { resourceId: 'lives', fromParent: true, width: 60 },
    },
    // 大本营 kill-zone（zone·清掉抵达的敌人 body·几何保证 leak 探针先扣命再清怪）
    killzone: {
      Transform: { x: 940, y: BASE_POS.y, rotation: 0, scaleX: 1, scaleY: 1 },
      Shape: { kind: 'box', width: 110, height: 150 },
      Color: { tint: 0xffffff, alpha: 0 },
      Tag: { flags: ZONE },
      Hitbox: { resource: 'hp', amount: 9999, targetMask: ENEMY },
    },

    // 车道 NavGraph（敌人沿它寻路）
    lane: { NavGraph: { nodes: LANE_NODES, edges: LANE_EDGES } },

    // 胜负状态机：生怪票放完(tickets_left≤0) 且 场上清空(enemies_alive≤0) → 胜；lives≤0 → 败
    flow: {
      GameFlow: {
        id: 'match', current: 'playing',
        states: [
          {
            id: 'playing',
            transitions: [
              { when: { kind: 'resource', id: 'lives', cmp: 'lte', value: 0 }, to: 'defeat' },
              {
                when: {
                  kind: 'and', of: [
                    { kind: 'resource', id: 'tickets_left', cmp: 'lte', value: 0 },
                    { kind: 'resource', id: 'enemies_alive', cmp: 'lte', value: 0 },
                  ],
                }, to: 'victory',
              },
            ],
          },
          { id: 'victory', onEnter: [{ kind: 'set-flag', targetId: 'show_victory', value: true }] },
          { id: 'defeat', onEnter: [{ kind: 'set-flag', targetId: 'show_defeat', value: true }] },
        ],
      },
    },

    // 买塔配方（HUD 动作 → keybind → Signal → craft-recipe 扣金 + 置 pending 旗）
    'recipe-pulse': {
      CraftRecipe: { onSignal: 'buy_pulse', costs: [{ id: 'gold', amount: TOWERS.pulse.cost }], grantsFlag: 'pending_pulse' },
    },
    'recipe-cannon': {
      CraftRecipe: { onSignal: 'buy_cannon', costs: [{ id: 'gold', amount: TOWERS.cannon.cost }], grantsFlag: 'pending_cannon' },
    },
    'kb-buy-pulse': { KeyBinding: { key: 'buy_pulse', signal: 'buy_pulse' } },
    'kb-buy-cannon': { KeyBinding: { key: 'buy_cannon', signal: 'buy_cannon' } },

    // 放置场（点场·onlyFlag 门 → caster at:pointer 生成塔 → 清 pending 旗）。两张场各守自己的 pending 旗。
    'field-pulse': {
      Transform: { x: FIELD_W / 2, y: FIELD_H / 2, rotation: 0, scaleX: 1, scaleY: 1 },
      Shape: { kind: 'box', width: FIELD_W, height: FIELD_H },
      Color: { tint: 0xffffff, alpha: 0 },
      Tag: { flags: ZONE },
      Clickable: { action: 'place_pulse', onlyFlag: 'pending_pulse' },
      Caster: { onSignal: 'place_pulse', at: 'pointer', template: 'tower_pulse' },
      Effect: { onSignal: 'place_pulse', kind: 'set-flag', targetId: 'pending_pulse', value: false },
    },
    'field-cannon': {
      Transform: { x: FIELD_W / 2, y: FIELD_H / 2, rotation: 0, scaleX: 1, scaleY: 1 },
      Shape: { kind: 'box', width: FIELD_W, height: FIELD_H },
      Color: { tint: 0xffffff, alpha: 0 },
      Tag: { flags: ZONE },
      Clickable: { action: 'place_cannon', onlyFlag: 'pending_cannon' },
      Caster: { onSignal: 'place_cannon', at: 'pointer', template: 'tower_cannon' },
      Effect: { onSignal: 'place_cannon', kind: 'set-flag', targetId: 'pending_cannon', value: false },
    },

    // prefab 库（塔/弹/敌模板）
    library: {
      PrefabLibrary: {
        seq: 0,
        templates: {
          tower_pulse: towerTemplate(TOWERS.pulse),
          tower_cannon: towerTemplate(TOWERS.cannon),
          bolt_pulse: boltTemplate(TOWERS.pulse),
          bolt_cannon: boltTemplate(TOWERS.cannon),
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
    ...spawnTicketEntities(),
  };

  return {
    capabilities: [
      // atoms
      transformCapability, hierarchyCapability, velocityCapability, shapeCapability,
      overlapDetectCapability, timerCapability, resourceCapability, flagCapability,
      tagCapability, relationCapability, destroyCapability, colorCapability, randomCapability,
      // tier1
      motionApplyCapability, lifetimeCapability, hierarchyResolveCapability, hierarchyCascadeCapability, tweenCapability,
      // tier2
      pathfindCapability, triggerZoneCapability, hitboxCapability, mortalCapability, overTimeCapability,
      eventWhenCapability, effectApplyCapability, craftRecipeCapability, clickableCapability,
      launchCapability, keybindCapability, gaugeCapability, groupCountCapability, selfRuleCapability,
      // tier3
      prefabCapability, casterCapability, flowCapability,
    ],
    entities,
  };
}
