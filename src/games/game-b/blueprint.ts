import type { WorldBlueprint, EntityBlueprint } from '../../assembly/demo.assembly.js';
import { stateCapability, resourceCapability, flagCapability, textCapability } from '@atom-skills/index.js';
import { eventWhenCapability, effectApplyCapability } from '@skills/tier2/index.js';
import { createDialogueRunnerCapability, DIALOGUE_FSM } from './dialogue-runner.js';
import { SCENE_01, START_NODE, type DialogueScript } from './data/dialogue.js';

// ═══════════════════════════════════════════════════════════════
//  Game B v0.2 蓝图 —— 乙游对话循环 + 7 属性 + 阈值事件链。
//  用到的引擎能力全部现成：state/resource/flag/text + event-when + effect-apply（+ 游戏层 dialogue-runner）。
//  未碰引擎/共享层。背景/立绘待资产流程；本版聚焦系统与数据。
//
//  阈值事件链（Condition→Event→Effect，纯配置、零游戏代码）：
//    event-when: 好感_S ≥ 5（edge）→ 发信号 'S_warmed'
//    effect-apply: 信号 'S_warmed' → set-flag 'S_warmed_flag' = true
//    → 之后 dialogue 的"顺势靠近"选项 requires 该 flag 才出现（阈值解锁）。
// ═══════════════════════════════════════════════════════════════

// 7 属性（对照 game-b-otome-vn.md §2.3）。id 即语义键，全局按 id 路由。
const STATS: Array<{ id: string; current: number; min: number; max: number }> = [
  { id: 'charm', current: 10, min: 0, max: 100 }, // 魅力（初始 10 < 12 → 检定选项暂隐藏）
  { id: 'wisdom', current: 5, min: 0, max: 100 }, // 智慧
  { id: 'stamina', current: 20, min: 0, max: 20 }, // 体力
  { id: 'career', current: 0, min: 0, max: 100 }, // 事业值
  { id: 'affection_S', current: 0, min: 0, max: 100 }, // 好感 S
  { id: 'affection_T', current: 0, min: 0, max: 100 }, // 好感 T
  { id: 'affection_U', current: 0, min: 0, max: 100 }, // 好感 U
];

export function buildGameBBlueprint(script: DialogueScript = SCENE_01, start: string = START_NODE): WorldBlueprint {
  const capabilities = [
    stateCapability, // J1：对话指针状态机 + state-sync
    resourceCapability, // F1：属性/好感 + resource-apply（全局按 id 路由）
    flagCapability, // F2：剧情条件位
    textCapability, // L6：当前对话行
    eventWhenCapability, // 条件→信号（阈值事件链中段）
    effectApplyCapability, // 信号→改世界（阈值事件链合龙）
    createDialogueRunnerCapability(script), // 游戏层胶水
  ];

  const entities: Record<string, EntityBlueprint> = {
    dialogue: {
      State: { fsmId: DIALOGUE_FSM, current: start, previous: start },
      Text: { content: '', fontSize: 22, fontFamily: 'serif', anchor: 'left', lineSpacing: 6 },
    },
    // 剧情 flag。
    met_S: { Flag: { id: 'met_S', active: false } },
    S_warmed_flag: { Flag: { id: 'S_warmed_flag', active: false } },
    // 阈值事件链：好感_S 越过 5（上升沿）→ 信号 → 置 S_warmed_flag。
    warm_watch: {
      EventWhen: { signal: 'S_warmed', when: { kind: 'resource', id: 'affection_S', cmp: 'gte', value: 5 }, mode: 'edge', armed: false },
    },
    warm_effect: {
      Effect: { onSignal: 'S_warmed', kind: 'set-flag', targetId: 'S_warmed_flag', value: true },
    },
  };

  // 7 属性各占一实体（资源原子约定一实体一 Resource）。
  for (const s of STATS) {
    entities[s.id] = { Resource: { id: s.id, current: s.current, min: s.min, max: s.max } };
  }

  return { capabilities, entities };
}

export const GAME_B_STATS = STATS.map((s) => s.id);
