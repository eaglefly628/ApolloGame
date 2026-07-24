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
import type { WorldBlueprint, EntityBlueprint } from '../../assembly/demo.assembly.js';
import {
  transformCapability, tagCapability, shapeCapability, colorCapability,
  spriteCapability, resourceCapability, destroyCapability, flagCapability, timerCapability,
} from '@atom-skills/index.js';
import {
  overTimeCapability, clickableCapability, craftRecipeCapability,
  effectApplyCapability, eventWhenCapability, keybindCapability, mergeOnPlaceCapability,
} from '@skills/tier2/index.js';
import { prefabCapability, casterCapability } from '@skills/tier3/index.js';
import {
  GAME, RES, ENERGY, ENERGY_REGEN_TICKS, ITEMS, GENERATORS, generatorOutput,
  cellCenter, mergeRules, itemTemplates, CELL, GEN_TAG, GEN_TINT,
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
    const out1 = generatorOutput(g);
    const tapSig = `tap_${g.id}`;
    const spawnFlag = `spawn_${g.id}`;
    const doSig = `do_spawn_${g.id}`;
    out[`flag-${spawnFlag}`] = { Flag: { id: spawnFlag, active: false } };
    out[`gen-${g.id}`] = {
      Transform: { x: p.x, y: p.y, rotation: 0, scaleX: 1, scaleY: 1 },
      Tag: { flags: GEN_TAG },
      Shape: { kind: 'box', width: CELL - 6, height: CELL - 6 }, // clickable 命中体
      Sprite: { textureKey: g.sprite, anchorX: 0.5, anchorY: 0.5, zOrder: 2 }, // 皮肤槽·gen 皮就绪即换装
      Color: { tint: GEN_TINT, alpha: 1 },
      Clickable: { action: tapSig },
      CraftRecipe: { onSignal: tapSig, costs: [{ id: RES.energy, amount: g.energyCost }], grantsFlag: spawnFlag },
      Caster: { onSignal: doSig, template: out1, at: 'self' },
    };
    out[`ew-${g.id}`] = { EventWhen: { signal: doSig, when: { kind: 'flag', id: spawnFlag }, mode: 'edge', armed: false } };
    out[`fx-reset-${g.id}`] = { Effect: { onSignal: doSig, kind: 'set-flag', targetId: spawnFlag, value: false } };
    // LayoutNode 活板：生成器格 Panel.action → mountUI ActionSink 入队 → KeyBinding 转成 tap 信号 → craft-recipe。
    out[`kb-${g.id}`] = { KeyBinding: { key: tapSig, signal: tapSig } };
  }
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
    ...boardCellEntities(),
    ...mergeRuleEntities(),
    ...generatorEntities(),
    ...seedItemEntities(),
  };

  return {
    capabilities: [
      transformCapability, tagCapability, shapeCapability, colorCapability,
      spriteCapability, resourceCapability, destroyCapability, flagCapability, timerCapability,
      overTimeCapability, clickableCapability, craftRecipeCapability, effectApplyCapability, eventWhenCapability, keybindCapability,
      mergeOnPlaceCapability, prefabCapability, casterCapability,
    ],
    entities,
  };
}
