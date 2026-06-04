import type { IWorld } from '@engine/core/types.js';
import type { ConditionExpr, CmpOp, Resource, Flag, State } from '@engine/protocol/components.js';

// Condition —— 布尔条件树的确定性求值（纯函数，无副作用）。
//
// 叶子按「语义 id」在世界里全局查找（Resource.id / Flag.id / State.fsmId），与实体插入顺序无关。
// 只做确定性比较（数 / bool / 字符串相等），不碰浮点超越函数 → lockstep / 录放安全。
// 这是 B 轴的逻辑底座：threshold（resource ≥ N）、状态判定（state == X）、机关门控（flagA ∧ flagB）
// 都是它的特例；event-when 用它把「条件 → 信号」串起来，Effect 后续再接。

function findResource(world: IWorld, id: string): Resource | undefined {
  for (const [e] of world.query('Resource')) {
    const r = world.getComponent<Resource>(e, 'Resource');
    if (r && r.id === id) return r;
  }
  return undefined;
}

function findFlag(world: IWorld, id: string): Flag | undefined {
  for (const [e] of world.query('Flag')) {
    const f = world.getComponent<Flag>(e, 'Flag');
    if (f && f.id === id) return f;
  }
  return undefined;
}

function findState(world: IWorld, fsmId: string): State | undefined {
  for (const [e] of world.query('State')) {
    const s = world.getComponent<State>(e, 'State');
    if (s && s.fsmId === fsmId) return s;
  }
  return undefined;
}

function compare(a: number, op: CmpOp, b: number): boolean {
  switch (op) {
    case 'lt':
      return a < b;
    case 'lte':
      return a <= b;
    case 'eq':
      return a === b;
    case 'ne':
      return a !== b;
    case 'gte':
      return a >= b;
    case 'gt':
      return a > b;
  }
}

/** 求值一棵条件树。缺失的叶子（找不到对应 id）按「不成立」处理。 */
export function evaluateCondition(world: IWorld, expr: ConditionExpr): boolean {
  switch (expr.kind) {
    case 'and':
      return expr.of.every((e) => evaluateCondition(world, e));
    case 'or':
      return expr.of.some((e) => evaluateCondition(world, e));
    case 'not':
      return !evaluateCondition(world, expr.of);
    case 'resource': {
      const r = findResource(world, expr.id);
      return r ? compare(r.current, expr.cmp, expr.value) : false;
    }
    case 'flag': {
      const f = findFlag(world, expr.id);
      const want = expr.equals ?? true;
      return (f?.active ?? false) === want;
    }
    case 'state': {
      const s = findState(world, expr.fsmId);
      return s ? s.current === expr.equals : false;
    }
  }
}
