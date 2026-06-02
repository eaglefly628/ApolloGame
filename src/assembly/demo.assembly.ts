import type { CapabilityDefinition } from '@engine/core/define-capability.js';
import type { Component } from '@engine/core/types.js';

export interface EntityBlueprint {
  [componentType: string]: Omit<Component, 'type'>;
}

export interface WorldBlueprint {
  capabilities: CapabilityDefinition[];
  entities: Record<string, EntityBlueprint>;
}

// 空白蓝图 —— 旧 skill 已移除，待 Tier 1 原子实现后重新组装。
// 参见 wiki/atom-skill-periodic-table.md
export const demoBlueprint: WorldBlueprint = {
  capabilities: [],
  entities: {},
};
