import type { WorldBlueprint, EntityBlueprint } from '../../assembly/demo.assembly.js';
import { stateCapability, resourceCapability, flagCapability, textCapability } from '@atom-skills/index.js';
import { createDialogueRunnerCapability, DIALOGUE_FSM } from './dialogue-runner.js';
import { SCENE_01, START_NODE, type DialogueScript } from './data/dialogue.js';

// ═══════════════════════════════════════════════════════════════
//  Game B v0.1 蓝图 —— 乙游对话核心闭环（验证现成原子可组合出 VN）。
//  用到的引擎能力全部现成：state / resource / flag / text（+ 游戏层 dialogue-runner 胶水）。
//  未碰引擎/共享层（符合 Game Creator 边界）。背景/立绘待 R1 资产 + 占位 provider。
//
//  约定：资源实体名 === resourceId，flag 实体名 === flagId（runner 据此路由 ResourceModify / Flag）。
// ═══════════════════════════════════════════════════════════════

export function buildGameBBlueprint(script: DialogueScript = SCENE_01, start: string = START_NODE): WorldBlueprint {
  const capabilities = [
    stateCapability, // J1：对话指针状态机（fsmId='dialogue'）+ state-sync 发 StateChanged
    resourceCapability, // F1：好感/属性数值 + resource-apply 结算 ResourceModify
    flagCapability, // F2：剧情条件位（见过谁/解锁了什么）
    textCapability, // L6：当前对话行文本
    createDialogueRunnerCapability(script), // 游戏层胶水
  ];

  const entities: Record<string, EntityBlueprint> = {
    // 对话状态机实体：State 指针 + Text 当前行。
    dialogue: {
      State: { fsmId: DIALOGUE_FSM, current: start, previous: start },
      Text: { content: '', fontSize: 22, fontFamily: 'serif', anchor: 'left', lineSpacing: 6 },
    },
    // 资源各占一实体（资源原子约定一实体一 Resource）。MVP 先两种：好感_S + 魅力。
    affection_S: { Resource: { id: 'affection_S', current: 0, min: 0, max: 100 } },
    charm: { Resource: { id: 'charm', current: 10, min: 0, max: 100 } },
    // 剧情 flag：是否已认识 S。
    met_S: { Flag: { id: 'met_S', active: false } },
  };

  return { capabilities, entities };
}
