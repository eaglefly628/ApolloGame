// game101 ·《海港绯闻》—— play-field 世界 = 纯数据（WorldBlueprint）。零游戏专属系统代码。
//
//   拖放合并    = t2-merge-on-place（玩家拖同类才合·MergeRule 提供 template→into 链数据·非自动合并）
//   物品产出戳  = t3-prefab（PrefabLibrary 模板 → SpawnRequest 展开 → PrefabOrigin 供 merge 计数）
//   货币/资源   = f1-resource（体力 energy / 金币 coins / 星星 stars / 经验 exp）
//   体力恢复    = t2-over-time（每 regenIntervalSec +1·涓流·钳进 cap）
//
//   生成器        = t2-clickable(点) → t2-craft-recipe(可负担才扣体力+置旗) → t2-event-when(旗真)
//                   → t3-caster at:self(**固定产出** L1) → prefab 展开 → merge 计数（原子·非加权）
//
// ⚠ 接线状态（capability-plan §6 Lead 已过审·S4 可玩核已接）：
//   生成器点击产出=组合表达成功（clickable+craft-recipe+event-when+caster·**固定产出**）；
//   合并=merge-rule **自动合并**（2 同类即合·非拖拽触发）。
//   两处引擎缺口（引擎/主程域·非 PE·数据已备待接）：
//     ① 加权掉落 `weighted-spawn`（REQ-TAPSPAWN·⏸缓建·owner 定 M1 不急）→ 生成器暂固定产出（掉表首项）；
//     ② 真·拖拽合并 `merge-on-place`（拖同类才合·方格 drop→combine·现无能力）→ REQ-MERGE-ON-PLACE·暂自动合并。
//   G2 订单 / G3 气泡（bubble-wrapper 零引擎改动路）=后续 slice。初始物由 game.json.seedItems 数据摆放。
//
// 能力总览：docs/design/game101/capability-plan.md。
import type { WorldBlueprint, EntityBlueprint } from '@assembly/demo.assembly.js';
import {
  transformCapability, tagCapability, shapeCapability, colorCapability,
  spriteCapability, resourceCapability, destroyCapability, flagCapability, timerCapability,
} from '@atom-skills/index.js';
import { lifetimeCapability } from '@skills/tier1/index.js';
import {
  overTimeCapability, clickableCapability, craftRecipeCapability,
  effectApplyCapability, eventWhenCapability, keybindCapability, mergeOnPlaceCapability, orderFulfillCapability, mergeProximityClearCapability,
  weightedSpawnCapability,
} from '@skills/tier2/index.js';
import { prefabCapability, casterCapability } from '@skills/tier3/index.js';
import {
  GAME, RES, ENERGY, ENERGY_REGEN_TICKS, ITEMS, GENERATORS, ORDERS, ORDER_SAT_MAX, TIMED_ITEM, MENU_TIMER_SEC, TICKS_PER_SEC, type OrderReward,
  BOARD_COVER, coverReveal, BUBBLES, BUBBLE_TAG, PROGRESSION, milestoneTag, LEVEL_DONE_FLAG,
  cellCenter, mergeRules, itemTemplates, timedTemplates, CELL, GEN_TAG, GEN_TINT,
} from './theme.js';

// ── 资源单例（f1-resource）───────────────────────────────────────────────────
function resourceEntities(): Record<string, EntityBlueprint> {
  return {
    energy: {
      Resource: { id: RES.energy, current: GAME.startEnergy, min: 0, max: ENERGY.cap },
      // 体力涓流恢复（over-time·local 改自身 Resource）：每 ENERGY_REGEN_TICKS 拍 +regenPerTick，钳进 cap。
      OverTime: {
        effects: [
          { id: 'regen', resource: RES.energy, amountPerTick: ENERGY.regenPerTick, period: ENERGY_REGEN_TICKS, duration: 0, elapsed: 0 },
        ],
      },
    },
    coins: { Resource: { id: RES.coins, current: GAME.startCoins, min: 0, max: 9999999 } },
    stars: { Resource: { id: RES.stars, current: GAME.startStars, min: 0, max: 9999999 } },
    exp: { Resource: { id: RES.exp, current: GAME.startExp, min: 0, max: 9999999 } },
  };
}

// ── 初始棋盘物品（数据摆放·seedItems）→ SpawnRequest 载体，prefab 首拍展开后自回收。──
// 从生成器行之后开始铺（cell 偏移 = 板宽·避开顶排生成器），给玩家开局几个可合的物。
function seedItemEntities(): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  let i = GAME.board.cols; // 从第二行起（顶排 = 生成器）
  for (const seed of GAME.seedItems) {
    if (!ITEMS[seed.item]) continue; // 未知物品静默跳过（数据卫生）
    for (let k = 0; k < seed.count; k++) {
      const p = cellCenter(i);
      out[`seed-${seed.item}-${k}`] = { SpawnRequest: { templateId: seed.item, x: p.x, y: p.y } };
      i++;
    }
  }
  return out;
}

// ── 生成器实体（点击→耗体力→固定产出·原子·非加权）──────────────────────────
// 接线（调研 §3·原子性）：clickable 发 tap 信号 → craft-recipe 可负担才扣体力 + 置 spawn 旗
//   → 次拍 event-when(旗真) 发 do_spawn → caster at:self 产出固定 L1 → prefab 展开盖 PrefabOrigin
//   → merge-rule 计数。effect 复位 spawn 旗。体力不足 = craft-recipe 整单不动 = 不扣不产（原子）。
// 冷却 CD（G4）暂略：体力 cost 已限刷；CD 作后续 slice。加权掉落 = weighted-spawn 落地后接。
function generatorEntities(): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  for (const g of GENERATORS) {
    const p = cellCenter(g.cell);
    const tapSig = `tap_${g.id}`;
    const spawnFlag = `spawn_${g.id}`;
    const doSig = `do_spawn_${g.id}`;
    // ── 冷却 CD（G4·组合·owner：每个生成器产出后要有冷却）──────────────────────────
    // 门=**每生成器一个 charge 资源**列进 craft-recipe.costs（afford 原子·charge=0 则整单不动=不扣体力不产）。
    // 关键：真游戏点生成器走 Panel.action→keybind→**craft-recipe**（非 Clickable 指针命中）→ 门必须在 craft-recipe
    // 才对两条路都生效。产出瞬间 charge 已被 craft-recipe 扣光 + reset-timer 起冷却；event-when 检 timer 到 cdTicks
    // → modify-resource 把 charge 补回 1（可再产）。全 craft-recipe/timer/event-when/effect-apply 组合·零游戏层 solver。
    const hasCd = (g.cooldownSec ?? 0) > 0;
    const cdTicks = Math.round((g.cooldownSec ?? 0) * TICKS_PER_SEC);
    const chargeId = `charge_${g.id}`;
    const cdTimerId = `cd_${g.id}`;
    const rdySig = `rdy_${g.id}`;
    out[`flag-${spawnFlag}`] = { Flag: { id: spawnFlag, active: false } };
    out[`gen-${g.id}`] = {
      Transform: { x: p.x, y: p.y, rotation: 0, scaleX: 1, scaleY: 1 },
      Tag: { flags: GEN_TAG },
      Shape: { kind: 'box', width: CELL - 6, height: CELL - 6 }, // clickable 命中体
      Sprite: { textureKey: g.sprite, anchorX: 0.5, anchorY: 0.5, zOrder: 2 }, // 皮肤槽·gen 皮就绪即换装
      Color: { tint: GEN_TINT, alpha: 1 },
      Clickable: { action: tapSig },
      // craft-recipe 管 afford 门：扣全局体力 + （有 CD 则）扣 1 charge（冷却中 charge=0 → 整单不动）。weighted-spawn 管加权产出。
      CraftRecipe: { onSignal: tapSig, costs: [{ id: RES.energy, amount: g.energyCost }, ...(hasCd ? [{ id: chargeId, amount: 1 }] : [])], grantsFlag: spawnFlag },
      WeightedSpawn: { onSignal: doSig, table: g.dropTable.map((d) => ({ templateId: d.item, weight: d.w })) },
    };
    out[`ew-${g.id}`] = { EventWhen: { signal: doSig, when: { kind: 'flag', id: spawnFlag }, mode: 'edge', armed: false } };
    out[`fx-reset-${g.id}`] = { Effect: { onSignal: doSig, kind: 'set-flag', targetId: spawnFlag, value: false } };
    // LayoutNode 活板：生成器格 Panel.action → mountUI ActionSink 入队 → KeyBinding 转成 tap 信号 → craft-recipe。
    out[`kb-${g.id}`] = { KeyBinding: { key: tapSig, signal: tapSig } };
    if (hasCd) {
      // charge 资源起始满 1（可产）；cd 计时器起始 done（elapsed=cdTicks·不占冷却）。charge 实体 key = 资源 id。
      out[chargeId] = { Resource: { id: chargeId, current: 1, min: 0, max: 1 } };
      out[`cd-${g.id}`] = { Timer: { id: cdTimerId, elapsed: cdTicks, duration: cdTicks, loop: false } };
      // 产出瞬间：reset-timer 起冷却计（charge 已被 craft-recipe 扣为 0）。
      out[`fx-cdstart-${g.id}`] = { Effect: { onSignal: doSig, kind: 'reset-timer', targetEntity: `cd-${g.id}` } };
      // 计时到 cdTicks → 发 rdy → modify-resource 把 charge 补回 +1（钳 max 1·冷却结束可再产）。
      out[`ew-cd-${g.id}`] = { EventWhen: { signal: rdySig, when: { kind: 'timer', id: cdTimerId, cmp: 'gte', value: cdTicks }, mode: 'edge', armed: false } };
      out[`fx-charge-${g.id}`] = { Effect: { onSignal: rdySig, kind: 'modify-resource', targetId: chargeId, value: 1 } };
    }
  }
  return out;
}

// ── 泡泡锁实体（bubble-wrapper·G3·点破扣金币→spawn 真物→destroy 泡泡）──────────────
// capability-plan §6：锁=独立泡泡实体（非物品本体）→ merge 按模板天然不碰。接线同生成器：
//   clickable 发 pop 信号 → craft-recipe 原子扣金币 + 置 popped 旗 → event-when(旗) 发 do_pop
//   → caster at:self 产真物 + effect destroy 泡泡自身。金币不足=craft-recipe 整单不动=不扣不破（金币回收出口）。
function bubbleEntities(): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  for (const b of BUBBLES) {
    const p = cellCenter(b.cell);
    const popSig = `pop_${b.id}`; const doSig = `do_pop_${b.id}`; const popFlag = `popped_${b.id}`;
    out[`flag-${popFlag}`] = { Flag: { id: popFlag, active: false } };
    out[`bubble-${b.id}`] = {
      Transform: { x: p.x, y: p.y, rotation: 0, scaleX: 1, scaleY: 1 },
      Tag: { flags: BUBBLE_TAG },
      Shape: { kind: 'box', width: CELL - 6, height: CELL - 6 },
      Sprite: { textureKey: 'bubble', anchorX: 0.5, anchorY: 0.5, zOrder: 3 }, // 皮肤槽·泡泡皮就绪即换
      Color: { tint: 0xbfe4ff, alpha: 0.85 },
      Clickable: { action: popSig },
      CraftRecipe: { onSignal: popSig, costs: [{ id: RES.coins, amount: b.cost }], grantsFlag: popFlag },
      Caster: { onSignal: doSig, template: b.item, at: 'self' },
    };
    out[`ew-${b.id}`] = { EventWhen: { signal: doSig, when: { kind: 'flag', id: popFlag }, mode: 'edge', armed: false } };
    out[`fx-pop-${b.id}`] = { Effect: { onSignal: doSig, kind: 'destroy', targetEntity: `bubble-${b.id}` } };
    out[`kb-${b.id}`] = { KeyBinding: { key: popSig, signal: popSig } };
  }
  return out;
}

// ── 进度推进（②·组合·零引擎改动）：星锁区 marker + 里程碑阈值触发 + 关卡完成旗 ─────────
// capability-plan：进度=复用交付发的 `stars` 资源；阈值→解锁=`event-when{resource gte, edge}`
//   发里程碑信号 → `effect-apply destroy-tagged`(清该区 marker=开出新工作区)；达标同法置 level_done 旗。
//   星锁格=独立 marker 实体（Tag·非 Blocker → 免被挖掘二消误减·仅靠攒星解锁）·宿主按 Tag 排除拖放。
function progressionEntities(): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  PROGRESSION.milestones.forEach((m, i) => {
    const tag = milestoneTag(i);
    // 每格一个星锁 marker（Tag 归属该里程碑区·Transform 定位·渲染/宿主据此显锁+排除拖放）。
    for (const cell of m.cells) {
      const p = cellCenter(cell);
      out[`starlock-${m.id}-${cell}`] = {
        Transform: { x: p.x, y: p.y, rotation: 0, scaleX: 1, scaleY: 1 },
        Tag: { flags: tag },
      };
    }
    // 攒够 atStars ⭐ → edge 发解锁信号 → destroy-tagged 清该区全部 marker（开区）。
    out[`ms-ew-${m.id}`] = { EventWhen: { signal: `unlock_${m.id}`, when: { kind: 'resource', id: RES.stars, cmp: 'gte', value: m.atStars }, mode: 'edge', armed: false } };
    out[`ms-fx-${m.id}`] = { Effect: { onSignal: `unlock_${m.id}`, kind: 'destroy-tagged', value: tag } };
  });
  // 关卡完成：攒够 goalStars ⭐ → edge 发 level_done → 置旗（readState 读旗 → 关卡完成横幅）。
  out['level-flag'] = { Flag: { id: LEVEL_DONE_FLAG, active: false } };
  out['level-ew'] = { EventWhen: { signal: LEVEL_DONE_FLAG, when: { kind: 'resource', id: RES.stars, cmp: 'gte', value: PROGRESSION.goalStars }, mode: 'edge', armed: false } };
  out['level-fx'] = { Effect: { onSignal: LEVEL_DONE_FLAG, kind: 'set-flag', targetId: LEVEL_DONE_FLAG, value: true } };
  return out;
}

// ── 棋盘格背景（render-only·纯装饰·非 sim 逻辑）：7×9 每格一块半透白圆角底，画出板。──
function boardCellEntities(): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  const n = GAME.board.cols * GAME.board.rows;
  for (let i = 0; i < n; i++) {
    const p = cellCenter(i);
    out[`cellbg-${i}`] = {
      Transform: { x: p.x, y: p.y, rotation: 0, scaleX: 1, scaleY: 1 },
      Shape: { kind: 'box', width: CELL - 6, height: CELL - 6 },
      Sprite: { textureKey: 'board_cell', anchorX: 0.5, anchorY: 0.5, zOrder: 0 }, // 皮肤槽·板格底皮就绪即换装（63 格共用一皮）
      Color: { tint: 0xffffff, alpha: 0.5 }, // 半透白格底（回退·物品/生成器在其上）
    };
  }
  return out;
}

// ── 订单实体（多槽交付·order-fulfill 消费 DeliverDrop）──────────────────────────
// 每单一个 Order 实体：needItems=各 slot 要的成品模板·filled 初始全 false·reward=集齐发的资源增量表（数据）。
// 交付=宿主拖成品落顾客卡 → DeliverDrop{item,order} → order-fulfill 匹配未满 slot→销毁实例+置满·集齐发奖重置。
function orderEntities(): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  for (const o of ORDERS) {
    const satId = `sat_${o.id}`;
    // 发奖表映射（coins/stars/exp + 每单顾客满意度 +1）：顶层单与 pool 每单同口径复用。
    const mapReward = (r: OrderReward) => [
      { resourceId: RES.coins, amount: r.coins },
      ...(r.stars ? [{ resourceId: RES.stars, amount: r.stars }] : []),
      ...(r.exp ? [{ resourceId: RES.exp, amount: r.exp }] : []),
      { resourceId: satId, amount: 1 }, // 每完成一单 → 该顾客满意度 +1（心情涨·发奖表数据·钳进 max）
    ];
    out[satId] = { Resource: { id: satId, current: 0, min: 0, max: ORDER_SAT_MAX } }; // 实体 key = 资源 id（order-fulfill 按 id 定位）
    // 续单池（①订单轮换·REQ-ORDERROT）：pool 各单 needItems + 映射 reward → 集齐后 sequence 环回换下一单。
    const pool = o.pool?.map((p) => ({ needItems: p.needItems, reward: mapReward(p.reward) }));
    out[`order-${o.id}`] = {
      Order: {
        orderId: o.id, needItems: o.needItems, filled: o.needItems.map(() => false), reward: mapReward(o.reward),
        resetOnComplete: true,
        ...(pool && pool.length ? { pool, rotateMode: 'sequence' as const, cursor: 0 } : {}),
      },
    };
  }
  // 限时特惠订单倒计时（循环刷新）：一个共享菜单 Timer{id:'menu',loop}·timer-advance 每拍推进·到期归零重来。
  // 纯 e1-timer·不销毁（区别 life）；宿主读其剩余秒渲染 ⏱。有 timed 订单才建。
  if (ORDERS.some((o) => o.timed)) {
    out['menu-timer'] = { Timer: { id: 'menu', elapsed: 0, duration: MENU_TIMER_SEC * TICKS_PER_SEC, loop: true } };
  }
  return out;
}

// ── 挖掘阻碍层实体（board-cover·merge-proximity-clear）──────────────────────────
// 每覆盖格一个 Blocker+Transform 实体（layers>0=盖住·不可拖）；+ 一个 MergeProximity 单例定空间参数。
// 「合并→减 3×3 邻格阻碍」全在引擎 merge-proximity-clear 里做（游戏层只摆数据·零手写扫格）。
function coverEntities(): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  for (const cc of BOARD_COVER.cells) {
    const p = cellCenter(cc.cell);
    out[`cover-${cc.cell}`] = {
      Transform: { x: p.x, y: p.y, rotation: 0, scaleX: 1, scaleY: 1 },
      Blocker: { layers: cc.layers, reveal: coverReveal(cc.reveal) },
    };
  }
  // 空间参数单例：cellSize=格边长·radius=影响半径(格)·dec=每次二消减层。
  out['merge-proximity'] = { MergeProximity: { cellSize: CELL, radius: BOARD_COVER.radius, dec: BOARD_COVER.decPerMerge } };
  return out;
}

// ── 合并规则实体（每条 MergeRule 一个承载实体）────────────────────────────────
function mergeRuleEntities(): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  mergeRules().forEach((r, i) => { out[`rule-${i}`] = { MergeRule: { template: r.template, need: r.need, into: r.into } }; });
  return out;
}

export function buildBlueprint(): WorldBlueprint {
  const entities: Record<string, EntityBlueprint> = {
    ...resourceEntities(),
    library: { PrefabLibrary: { seq: 0, templates: { ...itemTemplates(), ...timedTemplates() } } },
    // 限时鲜货 seed（物件级倒计时·到期 lifetime 自毁）：摆一个在板上第三行空位。
    'seed-timed': { SpawnRequest: { templateId: TIMED_ITEM, ...cellCenter(GAME.board.cols * 2) } },
    // 世界随机种子单例（weighted-spawn 生成器加权抽的唯一随机源·确定性/回放安全·禁游戏层裸 Math.random）。
    'random-seed': { RandomSeed: { seed: 0x1a2b3c4d, sequence: 0 } },
    ...boardCellEntities(),
    ...mergeRuleEntities(),
    ...orderEntities(),
    ...coverEntities(),
    ...bubbleEntities(),
    ...progressionEntities(),
    ...generatorEntities(),
    ...seedItemEntities(),
  };

  return {
    capabilities: [
      transformCapability, tagCapability, shapeCapability, colorCapability,
      spriteCapability, resourceCapability, destroyCapability, flagCapability, timerCapability, lifetimeCapability,
      overTimeCapability, clickableCapability, craftRecipeCapability, effectApplyCapability, eventWhenCapability, keybindCapability,
      mergeOnPlaceCapability, orderFulfillCapability, mergeProximityClearCapability, weightedSpawnCapability, prefabCapability, casterCapability,
    ],
    entities,
  };
}
