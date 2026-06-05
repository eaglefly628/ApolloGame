import type { WorldBlueprint, EntityBlueprint } from '../../assembly/demo.assembly.js';
import type { CapabilityDefinition } from '@engine/core/define-capability.js';
import { stateCapability, resourceCapability, flagCapability, textCapability } from '@atom-skills/index.js';
import { eventWhenCapability, effectApplyCapability } from '@skills/tier2/index.js';
import { dialogueCapability, DIALOGUE_FSM } from '@skills/tier3/index.js';
import type { DialogueGraph } from '@skills/tier3/index.js';
import { SCENE_01 } from './data/dialogue.js';
import manifest from './data/game-b.manifest.json';

// ═══════════════════════════════════════════════════════════════
//  Game B 加载器 —— 把纯数据清单(game-b.manifest.json)装配成 WorldBlueprint。
//  游戏内容全在数据里：modules(选哪些通用模块) + entities(初始组件数据) + content(脚本引用)。
//
//  ⚠ 本文件是 game-b 仅剩的"代码"，且**本质通用**：按 id 解析模块 + 从数据建实体 + 把内容脚本注入为
//    数据组件，应由引擎/框架的通用 module-loader 承担（见 modular-game-framework §6 Game Manifest）。
//    届时本文件删除，Game B = 纯数据。
//    R15 已落地：对话运行器下沉为通用 @skills/tier3 dialogueCapability，**脚本作为 DialogueScript
//    数据组件注入世界**（不再工厂闭包注入代码常量）——game-b 不再有对话运行器代码。
// ═══════════════════════════════════════════════════════════════

// 模块注册表：manifest 里的模块 id → 通用能力（全部静态，无工厂、无闭包注入）。
const MODULE_REGISTRY: Record<string, CapabilityDefinition> = {
  state: stateCapability,
  resource: resourceCapability,
  flag: flagCapability,
  text: textCapability,
  'event-when': eventWhenCapability,
  'effect-apply': effectApplyCapability,
  dialogue: dialogueCapability,
};

// 内容脚本注册表：manifest.content.dialogueScript（引用名）→ 纯数据脚本图。
const SCRIPT_REGISTRY: Record<string, DialogueGraph> = { scene_01: SCENE_01 };

export function buildGameBBlueprint(): WorldBlueprint {
  const capabilities = manifest.modules.map((id) => {
    const entry = MODULE_REGISTRY[id];
    if (!entry) throw new Error(`Game B manifest: unknown module "${id}"`);
    return entry;
  });
  // 浅拷贝实体表以便注入对话脚本数据组件（不改原 manifest 对象）。
  const entities: Record<string, EntityBlueprint> = { ...(manifest.entities as unknown as Record<string, EntityBlueprint>) };
  // 把对话脚本作为**数据组件** DialogueScript 注入到声明了对话 FSM 的实体上——
  // 运行器从世界读这棵图（数据），不再由工厂闭包注入代码常量（R15 数据驱动）。
  const scriptRef = manifest.content?.dialogueScript;
  if (scriptRef) {
    const nodes = SCRIPT_REGISTRY[scriptRef];
    if (!nodes) throw new Error(`Game B manifest: unknown dialogueScript "${scriptRef}"`);
    for (const [id, comps] of Object.entries(entities)) {
      const stateData = (comps as Record<string, { fsmId?: string }>).State;
      if (stateData?.fsmId === DIALOGUE_FSM) {
        entities[id] = { ...comps, DialogueScript: { fsmId: DIALOGUE_FSM, nodes } };
        break;
      }
    }
  }
  return { capabilities, entities };
}

// 属性 id 列表（供 UI 属性面板），从清单数据派生——不在代码里重复列举。
const entityData = manifest.entities as unknown as Record<string, { Resource?: { id: string } }>;
export const GAME_B_STATS: string[] = Object.values(entityData)
  .map((c) => c.Resource?.id)
  .filter((id): id is string => typeof id === 'string');
