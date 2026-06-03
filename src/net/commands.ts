import type { IWorld, EntityId } from '@engine/core/types.js';
import type { Velocity, Controllable, Action } from '@engine/protocol/components.js';

// ═══════════════════════════════════════════════════════════════
//  输入模型 — 联机的"接缝"
// ═══════════════════════════════════════════════════════════════
//
//  Command 是一个玩家在**某一个 tick** 的意图。它是真实联机里被序列化、
//  在对端之间逐 tick 交换的最小单位。把"实时键盘"和"网络对端"都抽象成
//  同一个 InputSource：现在喂本地键盘，以后换成网络源，引擎一行都不用动。
//
//  确定性铁律：所有对端必须以**完全相同的顺序**应用同一 tick 的命令，
//  否则状态分叉(desync)。所以应用前一律按 playerId 排序——顺序只由内容
//  决定，与网络到达次序无关。
// ═══════════════════════════════════════════════════════════════

export interface Command {
  readonly playerId: string;
  readonly tick: number;
  // 移动意图，dx/dy 各取 {-1, 0, 1}；真实速度 = move * Controllable.speed
  readonly move: { readonly dx: number; readonly dy: number };
  // 跳跃意图（平台类）。true 时 applyCommands 给目标打 Action{name:'jump'}，由 jump 系统在着地时转成向上冲量。
  readonly jump?: boolean;
}

// 每 tick 命令的来源。本地键盘 / 脚本 / 网络对端都实现它。
export interface InputSource {
  // 本源已知的、适用于 `tick` 的所有命令（可能为空）。
  commandsForTick(tick: number): Command[];
}

// 确定性排序：按 playerId 稳定排序，使应用顺序只由内容决定。
export function orderCommands(commands: readonly Command[]): Command[] {
  return [...commands].sort((a, b) =>
    a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0,
  );
}

// 把"意图"翻译成"世界写入"：input → simulation 的桥。
// 先把所有 Controllable 实体的速度清零（无输入即静止），再按命令写速度。
// reset-then-apply 让它无状态：本 tick 没收到某玩家命令 → 其实体速度归零。
export function applyCommands(world: IWorld, commands: readonly Command[]): void {
  // reset-then-apply：无输入即静止。但有重力(Acceleration)的实体，其垂直速度归重力/跳跃管，
  // 输入不清 vy（否则每 tick 抹掉重力，平台跳跃无从谈起）。Action 每 tick 重算，故起跳意图无状态。
  for (const [id] of world.query('Controllable', 'Velocity')) {
    const v = world.getComponent<Velocity>(id, 'Velocity')!;
    v.vx = 0;
    if (!world.hasComponent(id, 'Acceleration')) v.vy = 0;
    world.removeComponent(id, 'Action');
  }
  for (const cmd of orderCommands(commands)) {
    const target = findControlled(world, cmd.playerId);
    if (target === undefined) continue;
    const v = world.getComponent<Velocity>(target, 'Velocity');
    const c = world.getComponent<Controllable>(target, 'Controllable');
    if (!v || !c) continue;
    v.vx = cmd.move.dx * c.speed;
    // 俯视实体：vy 也由输入直接控制；平台实体（有重力）：vy 留给重力/跳跃，输入不碰。
    if (!world.hasComponent(target, 'Acceleration')) v.vy = cmd.move.dy * c.speed;
    // 跳跃意图 → 语义动作；jump 系统只在 Grounded 时把它转成向上冲量（离地即不可二段跳）。
    if (cmd.jump) world.addComponent(target, { type: 'Action', name: 'jump', value: 1 } as Action);
  }
}

function findControlled(world: IWorld, playerId: string): EntityId | undefined {
  for (const [id] of world.query('Controllable')) {
    const c = world.getComponent<Controllable>(id, 'Controllable')!;
    if (c.playerId === playerId) return id;
  }
  return undefined;
}
