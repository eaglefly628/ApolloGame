// Game B · 娱乐圈乙游视觉小说（otome VN）。负责人：PB。
// v0.1：对话 / 选择 / 好感结算 / 分支核心闭环（用现成原子 + dialogue-runner 胶水）。
// 路线/引擎需求见 README.md / requests.md（R1–R8）。
export { buildGameBBlueprint } from './blueprint.js';
export { createDialogueRunnerCapability, renderNodeText, DIALOGUE_FSM } from './dialogue-runner.js';
export type { DialogueAdvance, DialogueChoose } from './dialogue-runner.js';
export { SCENE_01, START_NODE } from './data/dialogue.js';
export type { DialogueScript, DialogueNode, ChoiceOption, Effect } from './data/dialogue.js';
