import type { WorldBlueprint, EntityBlueprint } from '../../assembly/demo.assembly.js';
import { resourceCapability, flagCapability, stateCapability, textCapability } from '@atom-skills/index.js';
import { eventWhenCapability, effectApplyCapability } from '@skills/tier2/index.js';
import type { ConditionExpr } from '@engine/protocol/components.js';
import {
  MATERIALS,
  GARMENTS,
  ACCESSORIES,
  COIN_ID,
  BASE_LOOK,
  LOOK_FSM,
  SHOP_LEVEL_ID,
  SHOP_LEVEL_MAX,
  SHOP_LEVEL_ENTITY,
  garmentFlagId,
  garmentSignal,
  accessoryFlagId,
  accessorySignal,
  type Garment,
  type Accessory,
} from './theme.js';

// ═══════════════════════════════════════════════════════════════
//  Game C ·《缝纫物语》v0.2 蓝图 —— 缝纫店「数据玩法」装配 (纯 DATA)
//
//  ⛔ 第一性原则：游戏是数据。本文件**只装配现成引擎能力**，不写任何 system。
//  v0.2 数据深化（仍全部现成能力，零游戏系统代码）：
//    · 材料经济      = resource(F1)：6 材料 + 针线币。
//    · 缝纫店等级    = resource(F1)：shop_level；每解锁一件衣服 → effect-apply modify-resource +1。
//    · 升级链        = Condition→Event→Effect：攒够材料(AND 阈值) → 信号 → 置 flag + 推进外观 + 店铺+1。
//    · 高定门控      = 多步涌现：高定衣 requires 含 shop_level≥4（reads 由别的解锁 +1 喂出来，
//                      一拍反馈）→ "升级店铺才能做更好的衣服"，纯数据涌现，压测逻辑底座。
//    · 配饰多槽      = 与衣服并行的独立解锁链（flag），可叠加；爱诗提示词据已解锁配饰组合。
//  不能表达、已提需求（不在此 hack）：三消棋盘 REQ-C-001 / 点击命中 REQ-C-002 /
//    主动缝制消费 REQ-C-003 / 爱诗视频后端 REQ-C-004。
// ═══════════════════════════════════════════════════════════════

const GAME_C_CAPABILITIES = [
  resourceCapability, // F1：材料/货币/店铺等级 + resource-apply（全局按 id 路由）
  flagCapability, // F2：衣服/配饰解锁位
  stateCapability, // J1：女孩当前外观指针
  textCapability, // L6：外观文字（展示用）
  eventWhenCapability, // 条件→信号（阈值满足 → 发解锁信号）
  effectApplyCapability, // 信号→改世界（置 flag + set-state 外观 + 店铺等级 +1）
];

// 材料阈值(+可选店铺等级阈值) → 一棵 AND 条件树（全部现成 ConditionExpr 数据）。
function requireExpr(g: Garment): ConditionExpr {
  const leaves: ConditionExpr[] = g.requires.map(
    (r) => ({ kind: 'resource', id: r.material, cmp: 'gte', value: r.amount }) as const,
  );
  if (g.requiresShopLevel) {
    leaves.push({ kind: 'resource', id: SHOP_LEVEL_ID, cmp: 'gte', value: g.requiresShopLevel });
  }
  return { kind: 'and', of: leaves };
}

function accRequireExpr(a: Accessory): ConditionExpr {
  return {
    kind: 'and',
    of: a.requires.map((r) => ({ kind: 'resource', id: r.material, cmp: 'gte', value: r.amount }) as const),
  };
}

export function buildGameCBlueprint(): WorldBlueprint {
  const entities: Record<string, EntityBlueprint> = {};

  // ── 材料经济：6 材料 + 针线币。
  for (const m of MATERIALS) {
    entities[`mat_${m.id}`] = { Resource: { id: m.id, current: 0, min: 0, max: 9999 } };
  }
  entities[`mat_${COIN_ID}`] = { Resource: { id: COIN_ID, current: 0, min: 0, max: 999999 } };

  // ── 缝纫店等级（每解锁一件衣服 +1）。
  entities[SHOP_LEVEL_ENTITY] = { Resource: { id: SHOP_LEVEL_ID, current: 0, min: 0, max: SHOP_LEVEL_MAX } };

  // ── 女孩当前外观：一个 look 状态机 + 一行展示文字。
  entities.girl = {
    State: { fsmId: LOOK_FSM, current: BASE_LOOK, previous: BASE_LOOK },
    Text: { content: '练习服', fontSize: 20, fontFamily: 'serif', anchor: 'center', lineSpacing: 4 },
  };

  // ── 缝纫店升级链（Condition→Event→Effect，每件衣服一组，全是数据）。
  for (const g of GARMENTS) {
    const sig = garmentSignal(g);
    entities[`flag_${g.id}`] = { Flag: { id: garmentFlagId(g), active: false } };
    entities[`watch_${g.id}`] = {
      EventWhen: { signal: sig, when: requireExpr(g), mode: 'edge', armed: false },
    };
    // ① 置解锁 flag。
    entities[`fx_unlock_${g.id}`] = {
      Effect: { onSignal: sig, kind: 'set-flag', targetId: garmentFlagId(g), value: true },
    };
    // ② 推进女孩外观（阈值递增 → 越华丽越晚触发 → 外观自然向上走）。
    entities[`fx_look_${g.id}`] = {
      Effect: { onSignal: sig, kind: 'set-state', targetId: LOOK_FSM, value: g.lookId },
    };
    // ③ 缝纫店升一级（养成"升级店铺"维度；高定衣以 shop_level 反向门控）。
    entities[`fx_shoplv_${g.id}`] = {
      Effect: { onSignal: sig, kind: 'modify-resource', targetId: SHOP_LEVEL_ID, value: 1 },
    };
  }

  // ── 配饰解锁链（与衣服并行，可叠加；攒够材料 → 置配饰 flag）。
  for (const a of ACCESSORIES) {
    const sig = accessorySignal(a);
    entities[`accflag_${a.id}`] = { Flag: { id: accessoryFlagId(a), active: false } };
    entities[`accwatch_${a.id}`] = {
      EventWhen: { signal: sig, when: accRequireExpr(a), mode: 'edge', armed: false },
    };
    entities[`accfx_${a.id}`] = {
      Effect: { onSignal: sig, kind: 'set-flag', targetId: accessoryFlagId(a), value: true },
    };
  }

  return { capabilities: GAME_C_CAPABILITIES, entities };
}

// 供 UI / 测试引用的稳定 id。
export const GIRL_ENTITY = 'girl';
export const MATERIAL_IDS = MATERIALS.map((m) => m.id);
export { SHOP_LEVEL_ENTITY };
