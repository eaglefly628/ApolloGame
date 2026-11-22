import type { IWorld } from '@engine/core/types.js';
import type { ConditionExpr } from '@engine/protocol/components.js';
import { buildConditionLookup, evaluateCondition } from '@skills/tier2/condition.js';
import { resolveBindings, type LayoutNode } from '@ui/components/index.js';
import { sceneLayout } from './transition-layout.js';

export function readUiFlags(world: IWorld, conditions: Record<string, ConditionExpr> = {}): ReadonlyMap<string, boolean> {
  const lookup = buildConditionLookup(world);
  return new Map(Object.entries(conditions).map(([id, condition]) => [id, evaluateCondition(world, condition, lookup)]));
}

export function projectSceneUi(layout: LayoutNode, flags: ReadonlyMap<string, boolean> = new Map()): LayoutNode {
  return sceneLayout(resolveBindings(layout, { flag: id => flags.get(id) }));
}
