// Game B · 娱乐圈乙游视觉小说（otome VN）。负责人：PB。
// v0.2：对话循环 + 7 属性 + 条件门控选项（检定/阈值解锁，走 Condition→Event→Effect 链）。
// 路线/引擎需求见 README.md / requests.md。
export { buildGameBBlueprint, GAME_B_STATS } from './blueprint.js';
// 对话运行器已随 R15 下沉为引擎通用模块 @skills/tier3/dialogue；此处转出供 UI/测试复用。
export { renderNodeText, optionAvailable, resourceValue, DIALOGUE_FSM } from '@skills/tier3/index.js';
export type { DialogueScript, DialogueAdvance, DialogueChoose, DialogueNode, DialogueGraph, DialogueChoiceOption, DialogueEffect } from '@skills/tier3/index.js';
export { SCENE_01 } from './data/dialogue.js';
