import type { WorldBlueprint, EntityBlueprint } from '../../assembly/demo.assembly.js';
import { resourceCapability, textCapability, stateCapability } from '@atom-skills/index.js';
import { clickableCapability } from '@skills/tier2/index.js';
import {
  DECK_ID,
  PLAYER_CARDS_ID,
  PLAYER_SCORE_ID,
  DEALER_CARDS_ID,
  DEALER_SCORE_ID,
  INITIAL_DECK_SIZE,
  GAME_STATES,
} from './theme.js';

// ═══════════════════════════════════════════════════════════════
//  Game H ·《二十一点》v0.1 蓝图 —— 纯数据装配
//
//  ⛔ 第一性原则：游戏是数据。本文件**只装配现成引擎能力**，不写任何系统。
//  装配方案（最小化）：
//    · 资源追踪 = resource capability：牌堆/玩家手牌/庄家手牌/点数。
//    · 点数显示 = text capability：玩家点数/庄家点数（游戏逻辑在 UI 层计算）。
//    · 游戏状态 = state capability：初始化 → 玩家回合 → 庄家回合 → 结束。
//    · 操作按钮 = clickable capability：要牌（Hit）、停牌（Stand）、重新开始。
//  注：实际点数计算（A 计 1 或 11）、胜负判定、庄家 AI 由 UI 层 React 组件处理
//  （这是最小的"数据表达不了"部分，记为技术债，未来可下沉成 capability）。
// ═══════════════════════════════════════════════════════════════

const GAME_H_CAPABILITIES = [
  resourceCapability, // 资源追踪（牌堆、手牌、点数）
  clickableCapability, // 交互按钮
  stateCapability, // 游戏状态机
  textCapability, // 点数/信息文字
];

// ── 游戏实体 ────────────────────────────────────────────────────
export const GAME_STATE_ENTITY = 'game_state';
export const PLAYER_ENTITY = 'player';
export const DEALER_ENTITY = 'dealer';
export const DECK_ENTITY = 'deck';

// ── 按钮实体 ID ────────────────────────────────────────────────
export const HIT_BUTTON_ID = 'hit_button';
export const STAND_BUTTON_ID = 'stand_button';
export const RESTART_BUTTON_ID = 'restart_button';

// ── 蓝图构建函数 ────────────────────────────────────────────────
export function buildGameHBlueprint(): WorldBlueprint {
  const entities: Record<string, any> = {};

  // ── 游戏状态实体（状态机 + 提示文字）────────────────────────────
  entities[GAME_STATE_ENTITY] = {
    State: {
      current: GAME_STATES.INIT,
    },
    Text: {
      content: '游戏开始！',
      fontSize: 16,
      fontFamily: 'Arial',
      anchor: 'left',
    },
  };

  // ── 玩家实体（点数显示）────────────────────────────────────────
  entities[PLAYER_ENTITY] = {
    Text: {
      content: `玩家点数: 0`,
      fontSize: 18,
      fontFamily: 'Arial',
      anchor: 'left',
    },
  };

  // ── 庄家实体（点数显示）────────────────────────────────────────
  entities[DEALER_ENTITY] = {
    Text: {
      content: `庄家点数: 0`,
      fontSize: 18,
      fontFamily: 'Arial',
      anchor: 'left',
    },
  };

  // ── 交互按钮实体 ────────────────────────────────────────────────
  entities[HIT_BUTTON_ID] = {
    Clickable: {
      action: 'hit',
    },
    Text: {
      content: '要牌',
      fontSize: 16,
      fontFamily: 'Arial',
      anchor: 'center',
    },
  };

  entities[STAND_BUTTON_ID] = {
    Clickable: {
      action: 'stand',
    },
    Text: {
      content: '停牌',
      fontSize: 16,
      fontFamily: 'Arial',
      anchor: 'center',
    },
  };

  entities[RESTART_BUTTON_ID] = {
    Clickable: {
      action: 'restart',
    },
    Text: {
      content: '重新开始',
      fontSize: 16,
      fontFamily: 'Arial',
      anchor: 'center',
    },
  };

  return {
    capabilities: GAME_H_CAPABILITIES,
    entities,
  };
}
