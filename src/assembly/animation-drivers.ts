import {
  validateDriverTree, validateAnimationDriver3D, validateAnimationDriverPlayback3D, validateAnimationDriverCommand3D,
  type AnimationDriver3D,
} from '@engine/protocol/components/animation-driver.js';

/** Blueprint components omit their discriminant. Validate the input tree before
 * adding it so getters/prototypes cannot execute while normalizing author data. */
export function animationDriverData<T extends string>(raw: unknown, type: T): Record<string, unknown> & { type: T } {
  validateDriverTree(raw);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`${type}: component object required`);
  const data = raw as Record<string, unknown>;
  if (Object.hasOwn(data, 'type') && data.type !== type) throw new Error(`${type}: conflicting component type`);
  return { ...data, type };
}

/** Same semantic boundary for manifest, imports and direct Engine.load. Pure and
 * batch-wide; never initializes playback or mutates an asset/component. */
export function validateAnimationDrivers(entities: Record<string, unknown>, tickRate?: number): void {
  for (const [id, raw] of Object.entries(entities)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const entity = raw as Record<string, unknown>;
    const configPresent = Object.hasOwn(entity, 'AnimationDriver3D');
    const playbackPresent = Object.hasOwn(entity, 'AnimationDriverPlayback3D');
    const commandPresent = Object.hasOwn(entity, 'AnimationDriverCommand3D');
    if (!configPresent && !playbackPresent && !commandPresent) continue;
    try {
      if (!configPresent) throw new Error('playback/command requires same-entity AnimationDriver3D');
      const config: AnimationDriver3D = validateAnimationDriver3D(animationDriverData(entity.AnimationDriver3D, 'AnimationDriver3D'));
      if (tickRate !== undefined && config.tickRate !== tickRate) throw new Error(`driver tickRate ${config.tickRate} differs from Engine tickRate ${tickRate}`);
      const model = entity.Model3D;
      if (!model || typeof model !== 'object' || Array.isArray(model) || typeof (model as {modelKey?:unknown}).modelKey !== 'string' || !(model as {modelKey:string}).modelKey.trim())
        throw new Error('driver requires Model3D with nonempty modelKey');
      if (Object.hasOwn(entity, 'AnimGraph3D') || Object.hasOwn(entity, 'AnimState3D')) throw new Error('driver requires exclusive animation ownership (no AnimGraph3D/AnimState3D)');
      if (playbackPresent) validateAnimationDriverPlayback3D(config, animationDriverData(entity.AnimationDriverPlayback3D, 'AnimationDriverPlayback3D'));
      if (commandPresent) {
        const command = validateAnimationDriverCommand3D(animationDriverData(entity.AnimationDriverCommand3D, 'AnimationDriverCommand3D'));
        for (const op of command.commands) if (op.op === 'play' && !Object.hasOwn(config.graph.states, op.state)) throw new Error(`command references unknown state ${op.state}`);
      }
    } catch (error) {
      throw new Error(`animation-drivers: ${id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
