import type { Engine } from '../../src/runtime/engine.js';
import type { NavAgent, Status } from '../../src/engine/protocol/components.js';
import { CharacterPresentation as BasePresentation } from './character-presentation.js';
import { pedestrianFacingSystem, pedestrianResponseSystem, pedestrianState } from './pedestrian-response.js';
import type { Resident, StreetResponse } from './pedestrian-response.js';

type SocialConfig = {
  rules: StreetResponse;
  seed: number;
  residents: { entity: string; curiosity: number; sociability: number; readyAt: number }[];
};

export function installStreetResponse(engine: Engine, config?: SocialConfig) {
  if (!config) return;
  const { world } = engine;
  world.createEntity('street-response');
  world.addComponent('street-response', structuredClone(config.rules));
  for (const profile of config.residents) {
    const { entity, curiosity, sociability, readyAt } = profile;
    const nav = world.getComponent<NavAgent>(entity, 'NavAgent');
    const status = world.getComponent<Status>(entity, 'Status');
    if (!nav || !world.getComponent(entity, 'Transform') || !world.getComponent(entity, 'FaceDir') ||
      ((status?.flags ?? 0) & config.rules.haltMask) !== 0) throw new Error('Invalid resident binding: ' + entity);
    nav.haltStatusMask = (nav.haltStatusMask ?? 0) | config.rules.haltMask;
    if (!status) world.addComponent<Status>(entity, { type: 'Status', flags: 0 });
    world.addComponent(entity, pedestrianState(config.seed, entity, curiosity, sociability, readyAt));
  }
  world.addSystem(pedestrianResponseSystem);
  world.addSystem(pedestrianFacingSystem);
}

/** Only presentation reads the activity. Navigation and interaction remain on fixed ticks. */
export class CharacterPresentation extends BasePresentation {
  constructor(engine: Engine, recipes: ConstructorParameters<typeof BasePresentation>[1]) {
    super(engine.world, recipes, (entity) => {
      const activity = engine.world.getComponent<Resident>(entity, 'PedestrianResponse')?.activity;
      if (!activity) return undefined;
      const clock = engine.world.getComponent<StreetResponse>('street-response', 'StreetResponse')!;
      const age = clock.tick - activity.start;
      if (activity.kind === 'chat') {
        const speaking = activity.reply ? age >= 60 : age < 60;
        return speaking ? { clip: 'street-chat', speed: 1, loop: false } : { speed: 1, loop: true };
      }
      return activity.reply ? { clip: 'wave', speed: 1.75, loop: false } : { speed: 1, loop: true };
    });
  }
}
