import sceneData from './scene_01.json';
import type { DialogueGraph } from '@skills/tier3/index.js';

// 对话脚本内容 = 纯数据（`scene_01.json`）。本文件只做"加载 JSON + 标注类型再导出"，无任何逻辑。
// schema 契约（DialogueNode/DialogueChoiceOption/...）已随 R15 上移为引擎通用叙事模块 @skills/tier3/dialogue 的
// 公共数据契约（DialogueGraph）。运行器本身也已下沉为通用 dialogueCapability，game-b 不再有对话运行器代码。

// 纯数据脚本（来自 JSON）。
export const SCENE_01: DialogueGraph = sceneData as unknown as DialogueGraph;

// 向后兼容的类型别名（旧引用名 → 引擎通用契约）。
export type { DialogueGraph as DialogueScript, DialogueNode, DialogueChoiceOption as ChoiceOption, DialogueEffect as Effect } from '@skills/tier3/index.js';
