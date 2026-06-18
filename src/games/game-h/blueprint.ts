import type { WorldBlueprint } from '../../assembly/demo.assembly.js';
import { resourceCapability, stateCapability } from '@atom-skills/index.js';
import { CHIPS_ID, BET_ID, INITIAL_CHIPS, GAME_STATES } from './theme.js';

// ═══════════════════════════════════════════════════════════════
//  Game H ·《二十一点》v1.0 蓝图 —— 纯数据装配
//
//  ⛔ 第一性原则：游戏是数据。本文件**只装配现成引擎能力**，不写任何系统。
//  装配方案（完整版）：
//    · 资源追踪 = resource capability：牌堆、筹码、当前押注。
//    · 游戏状态 = state capability：押注 → 发牌 → 玩家回合 → 庄家回合 → 结束。
//  注：游戏逻辑由 UI 层 React 组件处理（点数计算、分牌、胜负判定）。
// ═══════════════════════════════════════════════════════════════

const GAME_H_CAPABILITIES = [
  resourceCapability, // 资源追踪（筹码、押注、牌堆）
  stateCapability,    // 游戏状态机
];

// ── 游戏实体 ID ────────────────────────────────────────────────────
export const GAME_STATE_ENTITY = 'game_state';
export const CHIPS_ENTITY = 'chips';
export const BET_ENTITY = 'bet';

// ── 蓝图构建函数 ────────────────────────────────────────────────
export function buildGameHBlueprint(): WorldBlueprint {
  const entities: Record<string, any> = {};

  // ── 游戏状态实体 ────────────────────────────────────────────────
  entities[GAME_STATE_ENTITY] = {
    State: {
      current: GAME_STATES.BETTING,
    },
  };

  // ── 筹码资源 ────────────────────────────────────────────────────
  entities[CHIPS_ENTITY] = {
    Resource: {
      id: CHIPS_ID,
      current: INITIAL_CHIPS,
      min: 0,
      max: 999999,
    },
  };

  // ── 当前押注 ────────────────────────────────────────────────────
  entities[BET_ENTITY] = {
    Resource: {
      id: BET_ID,
      current: 0,
      min: 0,
      max: INITIAL_CHIPS,
    },
  };

  return {
    capabilities: GAME_H_CAPABILITIES,
    entities,
  };
}
