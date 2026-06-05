// Game B · 娱乐圈乙游视觉小说（otome VN）。负责人：PB。
// v0.2：对话循环 + 7 属性 + 条件门控选项（检定/阈值解锁，走 Condition→Event→Effect 链）。
// 路线/引擎需求见 README.md / requests.md。
export { buildGameBBlueprint, GAME_B_STATS } from './blueprint.js';
export { createDialogueRunnerCapability, renderNodeText, optionAvailable, resourceValue, DIALOGUE_FSM } from './dialogue-runner.js';
export type { DialogueAdvance, DialogueChoose } from './dialogue-runner.js';
export { SCENE_01, START_NODE } from './data/dialogue.js';
export type { DialogueScript, DialogueNode, ChoiceOption, Effect } from './data/dialogue.js';
