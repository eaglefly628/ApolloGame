import type { CapabilityDefinition } from '@engine/core/define-capability.js';
import { allAtomCapabilities, extensionAtomCapabilities } from '@atom-skills/index.js';
import {
  motionApplyCapability,
  accelApplyCapability,
  lifetimeCapability,
  rotationApplyCapability,
  animationCapability,
  hierarchyResolveCapability,
  tweenCapability,
} from '@skills/tier1/index.js';
import {
  collisionResolveCapability,
  groundSenseCapability,
  jumpCapability,
  boundsClampCapability,
  triggerZoneCapability,
  frictionCapability,
  eventWhenCapability,
  effectApplyCapability,
  cameraFollowCapability,
  clickableCapability,
  craftRecipeCapability,
  zoneOccupancyCapability,
} from '@skills/tier2/index.js';
import { dialogueCapability, match3BoardCapability } from '@skills/tier3/index.js';

// ═══════════════════════════════════════════════════════════════
//  能力注册表 (Capability Registry) —— manifest 加载的地基
//
//  「游戏=数据」要闭环：导出的 manifest 只存 capability **id 列表**(纯数据)，
//  要把它变回可运行的 WorldBlueprint，就得有一张 id → 能力**对象** 的表。
//  这里把引擎全部能力聚成单一注册表(同一组 import 单例 → 与各游戏 build 用的是同一对象，
//  重建后行为/哈希一致)。新增能力时在此登记一次即可被 manifest 引用。
// ═══════════════════════════════════════════════════════════════

export const ALL_CAPABILITIES: readonly CapabilityDefinition[] = [
  ...allAtomCapabilities,
  ...extensionAtomCapabilities,
  // tier1
  motionApplyCapability,
  accelApplyCapability,
  lifetimeCapability,
  rotationApplyCapability,
  animationCapability,
  hierarchyResolveCapability,
  tweenCapability,
  // tier2
  collisionResolveCapability,
  groundSenseCapability,
  jumpCapability,
  boundsClampCapability,
  triggerZoneCapability,
  frictionCapability,
  eventWhenCapability,
  effectApplyCapability,
  cameraFollowCapability,
  clickableCapability,
  craftRecipeCapability,
  zoneOccupancyCapability,
  // tier3
  dialogueCapability,
  match3BoardCapability,
];

export const CAPABILITY_REGISTRY: ReadonlyMap<string, CapabilityDefinition> = new Map(
  ALL_CAPABILITIES.map((c) => [c.id, c]),
);

/** id 列表 → 能力对象列表；任一 id 未注册即抛错(早失败、信息明确)。 */
export function resolveCapabilities(ids: readonly string[]): CapabilityDefinition[] {
  const out: CapabilityDefinition[] = [];
  const unknown: string[] = [];
  for (const id of ids) {
    const cap = CAPABILITY_REGISTRY.get(id);
    if (cap) out.push(cap);
    else unknown.push(id);
  }
  if (unknown.length) {
    throw new Error(`manifest: 未知 capability id: ${unknown.join(', ')}（不在能力注册表内）`);
  }
  return out;
}

/** 组件类型 → 提供它的 capability id（先登记者胜）。供从 entities 反推所需能力。 */
export const COMPONENT_PROVIDERS: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>();
  for (const cap of ALL_CAPABILITIES) {
    for (const type of Object.keys(cap.components?.provides ?? {})) {
      if (!m.has(type)) m.set(type, cap.id);
    }
  }
  return m;
})();

/**
 * 从 entities 用到的组件类型，反推"提供这些组件"的能力 id 集合。
 * 注意：只覆盖**提供组件**的能力；纯行为系统(如 motion-apply 把 Velocity 施加到 Transform)
 * 不提供组件、推不出来——所以 manifest 最好显式带 capabilities，inference 仅作兜底/提示。
 */
export function inferCapabilityIds(entities: Record<string, Record<string, unknown>>): string[] {
  const ids = new Set<string>();
  for (const comps of Object.values(entities)) {
    for (const type of Object.keys(comps)) {
      const capId = COMPONENT_PROVIDERS.get(type);
      if (capId) ids.add(capId);
    }
  }
  return [...ids];
}
