// game101 ·《海港绯闻》—— play-field 世界 = 纯数据（WorldBlueprint）。零游戏专属系统代码。
//
//   合并        = t3-merge-rule（每链每级一条 need:2·跨级连锁·distinct-seq 最老先合·确定）
//   物品产出戳  = t3-prefab（PrefabLibrary 模板 → SpawnRequest 展开 → PrefabOrigin 供 merge 计数）
//   货币/资源   = f1-resource（体力 energy / 金币 coins / 星星 stars / 经验 exp）
//   体力恢复    = t2-over-time（每 regenIntervalSec +1·涓流·钳进 cap）
//
// ⚠ 生成器/订单/气泡接线状态（capability-plan §6 Lead 已过审 2026-07-23·零预下沉）：
//   本 M1a groundwork 接未涉门能力面（merge/resource/over-time/prefab/seed）。
//   G1 生成器按 §6「组合」接线经源码复核**撞墙**：扣费半场(clickable+craft-recipe)可组合，但
//   「加权运行时 spawn」无引擎原语(caster/self-rule 固定 template·effect-apply 不能 spawn·
//   draft-offer 未接世界 RandomSeed/未接线)→ 按 §6「撞墙→下沉 tap-cost-spawn」报引擎池
//   docs/workflow/requests.md REQ-TAPSPAWN；generators.json 已备数据·待该能力落地再接线。
//   G2 订单 / G3 气泡=后续 slice（G3 bubble-wrapper 零引擎改动路）。
//   初始棋盘物品由 game.json.seedItems 数据摆放（初始态·非生成器机制）。
//
// 能力总览：docs/design/game101/capability-plan.md。
import type { WorldBlueprint, EntityBlueprint } from '../../assembly/demo.assembly.js';
import {
  transformCapability, tagCapability, shapeCapability, colorCapability,
  spriteCapability, resourceCapability, destroyCapability,
} from '@atom-skills/index.js';
import { overTimeCapability } from '@skills/tier2/index.js';
import { prefabCapability, mergeRuleCapability } from '@skills/tier3/index.js';
import {
  GAME, RES, ENERGY, ENERGY_REGEN_TICKS, ITEMS, cellCenter, mergeRules, itemTemplates,
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
function seedItemEntities(): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  let i = 0;
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

// ── 合并规则实体（每条 MergeRule 一个承载实体）────────────────────────────────
function mergeRuleEntities(): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  mergeRules().forEach((r, i) => { out[`rule-${i}`] = { MergeRule: { template: r.template, need: r.need, into: r.into } }; });
  return out;
}

export function buildBlueprint(): WorldBlueprint {
  const entities: Record<string, EntityBlueprint> = {
    ...resourceEntities(),
    library: { PrefabLibrary: { seq: 0, templates: itemTemplates() } },
    ...mergeRuleEntities(),
    ...seedItemEntities(),
  };

  return {
    capabilities: [
      transformCapability, tagCapability, shapeCapability, colorCapability,
      spriteCapability, resourceCapability, destroyCapability,
      overTimeCapability,
      prefabCapability, mergeRuleCapability,
    ],
    entities,
  };
}
