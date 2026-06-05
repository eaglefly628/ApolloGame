import type { ConditionExpr } from '@engine/protocol/components.js';
import sceneData from './scene_01.json';

// 对话脚本的**数据 schema 契约**（不是游戏逻辑——纯类型定义，描述 JSON 数据的形状）。
// 实际内容是纯数据：`scene_01.json`。本文件只做"类型 + 加载 JSON 再导出"，无任何逻辑。
// 待 Lead 把"叙事运行器"收编为通用模块后，此 schema 应上移为该通用模块的公共数据契约（R15）。

export interface Effect {
  resource: string; // 目标 Resource 的 id（按 id 全局路由）
  amount: number;
}

export interface ChoiceOption {
  text: string;
  effects?: Effect[];
  setFlag?: string; // 目标 Flag 的 id
  next: string;
  requires?: ConditionExpr; // 出现/可选的条件门（检定/阈值解锁）
}

export type DialogueNode =
  | { kind: 'line'; speaker: string; emotion?: string; text: string; next: string | null }
  | { kind: 'choice'; speaker?: string; emotion?: string; prompt?: string; options: ChoiceOption[] };

export type DialogueScript = Record<string, DialogueNode>;

// 纯数据脚本（来自 JSON）。
export const SCENE_01: DialogueScript = sceneData as unknown as DialogueScript;
