import type { IWorld, EntityId, Component } from './types.js';

// 按"组件某字段的值"找实体 / 取组件（R13/R14）。游戏层反复要"按 id 取实体"（resource/flag/state/
// string/单例 fsm…），与 Condition 的 buildConditionLookup 同源；这里给**单次查找**的便捷版。
// 假定该 id 全局唯一，返回第一个匹配（与全局路由约定一致）。纯查询、无副作用、确定性。

export function findByComponentId(
  world: IWorld,
  type: string,
  idField: string,
  id: string,
): EntityId | undefined {
  for (const e of world.queryEntities(type)) {
    const c = world.getComponent(e, type) as (Component & Record<string, unknown>) | undefined;
    if (c && c[idField] === id) return e;
  }
  return undefined;
}

export function getComponentById<T extends Component>(
  world: IWorld,
  type: string,
  idField: string,
  id: string,
): T | undefined {
  const e = findByComponentId(world, type, idField, id);
  return e === undefined ? undefined : world.getComponent<T>(e, type);
}
