// Tier 3 — 系统级玩法 (Mechanics)
// 跨实体的复合逻辑：多个 Tier 2 串联成完整的游戏机制（如开关→门→限时通道、
// 检定→分支→结算、好感阈值→事件链）。详见 wiki/atom-skill-periodic-table.md「Tier 3」。
//
// dialogue（R15）：解释器型机制的第一个——读声明式对话图（数据）推进游标、驱动 state/text/effect。
// 由真实游戏（Game B）的 request 拉动落地；让 VN/RPG 的剧情变成纯数据 JSON。
export {
  dialogueCapability,
  renderNodeText,
  optionAvailable,
  resourceValue,
  DIALOGUE_FSM,
} from './dialogue.js';
export type { DialogueScript, DialogueAdvance, DialogueChoose, DialogueNode, DialogueGraph, DialogueChoiceOption, DialogueEffect } from './dialogue.js';
