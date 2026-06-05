// net — 多人地基：固定步长 + tick 索引输入模型 + 确定性守卫 + lockstep
export type { Command, InputSource, RawInputData } from './commands.js';
export { orderCommands, applyCommands, applyMovement, applyRawActions, INPUT_QUEUE_ENTITY, MultiInputSource } from './commands.js';
export { QueuedInputSource, PointerInputSource } from './queued-input.js';
export { hashSnapshot } from './determinism.js';
export { FixedStepClock } from './fixed-step.js';
export type { FixedStepOptions } from './fixed-step.js';
export { LockstepSession } from './lockstep.js';
export type { PeerHash, StepReport } from './lockstep.js';
export { KeyboardInputSource, DEFAULT_KEYMAP } from './local-input.js';
export type { KeyMap, KeyBinding } from './local-input.js';
// 帧同步（lockstep）双标签页：各端各跑确定性世界，只交换输入。
export { LockstepClient } from './lockstep-tab.js';
export type { Channel, NetMsg, ClientView, LockstepOptions, Dir } from './lockstep-tab.js';
export { buildMpWorld, addPlayer, playerEntityId, renderEnts, PLAYER_COLORS } from './mp-world.js';
export type { RenderEnt } from './mp-world.js';
