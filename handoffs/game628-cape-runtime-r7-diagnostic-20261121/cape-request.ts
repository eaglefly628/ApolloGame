import type { IWorld } from '@engine/core/types.js';
import type { Flag, State, Visibility } from '@engine/protocol/components.js';
import contract from './cape-contract.json';

export function readCapeRequest(world: IWorld, actorBodies: Readonly<Record<string, string>>) {
  const flags = new Map(world.query('Flag').map(([id]) => {
    const flag = world.getComponent<Flag>(id, 'Flag')!;
    return [flag.id, flag.active];
  }));
  const states = new Map(world.query('State').map(([id]) => {
    const state = world.getComponent<State>(id, 'State')!;
    return [state.fsmId, state.current];
  }));
  const tier = states.get(contract.request.tierStateId);
  const visible = world.query('Model3D', 'Visibility').filter(([id]) =>
    world.getComponent<Visibility>(id, 'Visibility')?.visible);
  if (visible.length !== 1 || !tier || !contract.request.tiers.includes(tier)) return undefined;
  const avatarId = visible[0]![0];
  const bodyId = actorBodies[avatarId];
  if (!bodyId || !contract.avatar.bodyByIndex.includes(bodyId)) return undefined;
  return {
    avatarId,
    bodyId,
    enabled: flags.get(contract.request.enabledFlagId) === true,
    requestedTier: tier,
  };
}
