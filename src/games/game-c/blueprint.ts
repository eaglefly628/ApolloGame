import type { WorldBlueprint, EntityBlueprint } from '../../assembly/demo.assembly.js';
import { resourceCapability, flagCapability, stateCapability, textCapability } from '@atom-skills/index.js';
import { eventWhenCapability, effectApplyCapability } from '@skills/tier2/index.js';
import type { ConditionExpr } from '@engine/protocol/components.js';
import {
  MATERIALS,
  GARMENTS,
  COIN_ID,
  BASE_LOOK,
  LOOK_FSM,
  garmentFlagId,
  garmentSignal,
  type Garment,
} from './theme.js';

// ═══════════════════════════════════════════════════════════════
//  Game C ·《缝纫物语》v0.1 蓝图 —— 缝纫店「数据玩法」装配 (纯 DATA)
//
//  ⛔ 第一性原则：游戏是数据。本文件**只装配现成引擎能力**，不写任何 system。
//  能表达的（已装配，全部现成能力）：
//    · 材料经济      = resource(F1)：6 种材料 + 针线币，各一个 Resource。
//    · 缝纫店升级链  = Condition→Event→Effect（event-when + effect-apply）：
//                      攒够材料(AND 阈值) → 上升沿信号 → 置「解锁 flag」+ 推进「当前外观」状态。
//    · 当前外观      = state(J1) + text(L6)：女孩穿到哪一档，供爱诗展示读取。
//  不能表达、已提需求（不在此 hack）：
//    · 三消棋盘机制（找连/交换/重力/补块/消除产材料）→ REQ-C-001
//    · 棋格点击命中 → 语义动作                        → REQ-C-002
//    · 主动缝制消费（花材料换衣服）                    → REQ-C-003
//  这些落地后，棋盘 capability 只需往这些 Resource 灌 ResourceModify，整条链即自动点亮。
// ═══════════════════════════════════════════════════════════════

const GAME_C_CAPABILITIES = [
  resourceCapability, // F1：材料/货币数值 + resource-apply（全局按 id 路由）
  flagCapability, // F2：衣服解锁位
  stateCapability, // J1：女孩当前外观指针
  textCapability, // L6：外观文字（展示用）
  eventWhenCapability, // 条件→信号（阈值满足 → 发解锁信号）
  effectApplyCapability, // 信号→改世界（置 flag + set-state 推进外观）
];

// 一件衣服的「需求阈值」→ 一棵 AND 条件树（resource 叶子，全部现成 ConditionExpr 数据）。
function requireExpr(g: Garment): ConditionExpr {
  return {
    kind: 'and',
    of: g.requires.map((r) => ({ kind: 'resource', id: r.material, cmp: 'gte', value: r.amount }) as const),
  };
}

export function buildGameCBlueprint(): WorldBlueprint {
  const entities: Record<string, EntityBlueprint> = {};

  // ── 材料经济：6 种材料 + 针线币，各一个 Resource（消除产出灌到这里）。
  for (const m of MATERIALS) {
    entities[`mat_${m.id}`] = { Resource: { id: m.id, current: 0, min: 0, max: 9999 } };
  }
  entities[`mat_${COIN_ID}`] = { Resource: { id: COIN_ID, current: 0, min: 0, max: 999999 } };

  // ── 女孩当前外观：一个 look 状态机 + 一行展示文字。
  entities.girl = {
    State: { fsmId: LOOK_FSM, current: BASE_LOOK, previous: BASE_LOOK },
    Text: { content: '练习服', fontSize: 20, fontFamily: 'serif', anchor: 'center', lineSpacing: 4 },
  };

  // ── 缝纫店升级链（Condition→Event→Effect，每件衣服一组，全是数据）。
  for (const g of GARMENTS) {
    const sig = garmentSignal(g);
    // 解锁 flag（初始关）。
    entities[`flag_${g.id}`] = { Flag: { id: garmentFlagId(g), active: false } };
    // 条件：攒够材料(AND) → 上升沿发信号（只解锁一次）。
    entities[`watch_${g.id}`] = {
      EventWhen: { signal: sig, when: requireExpr(g), mode: 'edge', armed: false },
    };
    // 效果①：置该衣服的解锁 flag。
    entities[`fx_unlock_${g.id}`] = {
      Effect: { onSignal: sig, kind: 'set-flag', targetId: garmentFlagId(g), value: true },
    };
    // 效果②：把女孩当前外观推进到这件衣服（阈值递增 → 越华丽越晚触发 → 外观自然向上走）。
    entities[`fx_look_${g.id}`] = {
      Effect: { onSignal: sig, kind: 'set-state', targetId: LOOK_FSM, value: g.lookId },
    };
  }

  return { capabilities: GAME_C_CAPABILITIES, entities };
}

// 供 UI / 测试引用的稳定 id。
export const GIRL_ENTITY = 'girl';
export const MATERIAL_IDS = MATERIALS.map((m) => m.id);
