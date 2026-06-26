// 选项可见性 helper：用引擎 dialogue 能力的 optionAvailable 过滤 requires 不满足的选项，
// 但**保留原始下标**（信号 actionArg 用原始下标，dialogue.choose 才能命中正确选项）。
import type { IWorld } from '@engine/core/types.js';
import { optionAvailable, type DialogueNode } from '@skills/tier3/index.js';

export function optionAvailableIndices(world: IWorld, node: DialogueNode): number[] {
  if (node.kind !== 'choice') return [];
  const out: number[] = [];
  node.options.forEach((opt, i) => { if (optionAvailable(world, opt)) out.push(i); });
  return out;
}
