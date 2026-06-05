import type { WorldBlueprint, EntityBlueprint } from '../../assembly/demo.assembly.js';
import type { CapabilityDefinition } from '@engine/core/define-capability.js';
import { stateCapability, resourceCapability, flagCapability, textCapability } from '@atom-skills/index.js';
import { eventWhenCapability, effectApplyCapability } from '@skills/tier2/index.js';
import { createDialogueRunnerCapability } from './dialogue-runner.js';
import { SCENE_01 } from './data/dialogue.js';
import manifest from './data/game-b.manifest.json';

// ═══════════════════════════════════════════════════════════════
//  Game B 加载器 —— 把纯数据清单(game-b.manifest.json)装配成 WorldBlueprint。
//  游戏内容全在数据里：modules(选哪些通用模块) + entities(初始组件数据) + content(脚本引用)。
//
//  ⚠ 本文件是 game-b 仅剩的"代码"，且**本质通用**：按 id 解析模块 + 从数据建实体，
//    应由引擎/框架的通用 module-loader 承担（见 R15 / modular-game-framework §6 Game Manifest）。
//    届时本文件删除，Game B = 纯数据。dialogue-runner 也将随 R15 移入共享库。
//    现保留为 game 层临时桩：唯一的特例是 dialogue-runner 需要喂脚本数据（用工厂注入）。
// ═══════════════════════════════════════════════════════════════

// 模块注册表：manifest 里的模块 id → 通用能力。dialogue-runner 用工厂(喂脚本数据)。
const MODULE_REGISTRY: Record<string, CapabilityDefinition | (() => CapabilityDefinition)> = {
  state: stateCapability,
  resource: resourceCapability,
  flag: flagCapability,
  text: textCapability,
  'event-when': eventWhenCapability,
  'effect-apply': effectApplyCapability,
  'dialogue-runner': () => createDialogueRunnerCapability(SCENE_01),
};

export function buildGameBBlueprint(): WorldBlueprint {
  const capabilities = manifest.modules.map((id) => {
    const entry = MODULE_REGISTRY[id];
    if (!entry) throw new Error(`Game B manifest: unknown module "${id}"`);
    return typeof entry === 'function' ? entry() : entry;
  });
  const entities = manifest.entities as unknown as Record<string, EntityBlueprint>;
  return { capabilities, entities };
}

// 属性 id 列表（供 UI 属性面板），从清单数据派生——不在代码里重复列举。
const entityData = manifest.entities as unknown as Record<string, { Resource?: { id: string } }>;
export const GAME_B_STATS: string[] = Object.values(entityData)
  .map((c) => c.Resource?.id)
  .filter((id): id is string => typeof id === 'string');
