import type {IWorld} from '../../src/engine/core/types.js';
import type {AnimState3D, Transform} from '../../src/engine/protocol/components.js';

type Gesture = {action: string; clip: string; durationMs: number};
export type CharacterRecipe = {
 entity: string;
 idle: string;
 walk: string;
 nominalSpeedPerTick: number;
 gesture?: Gesture;
 performances?: Gesture[];
 stopAction?: string;
};

/** Prototype host presentation adapter. Only AnimState3D is written. */
export class CharacterPresentation {
 private gestures = new Map<string, {clip: string; until: number}>();
 private previous = new Map<string, {x: number; y: number; version: number; speed: number}>();
 private actions = new Map<string, Array<{entity: string; gesture?: Gesture}>>();

 constructor(private world: IWorld, private recipes: CharacterRecipe[], private socialPose?: (entity: string, tick: number) => { clip?: string; speed: number; loop: boolean } | undefined) {
  for (const recipe of recipes) {
   const {entity, idle, walk, nominalSpeedPerTick, gesture, performances = [], stopAction} = recipe;
   const transform = world.getComponent<Transform>(entity, 'Transform');
   if (!transform || !world.getComponent(entity, 'AnimState3D') || !world.getComponent(entity, 'Velocity') ||
       !idle || !walk || !Number.isFinite(nominalSpeedPerTick) || nominalSpeedPerTick <= 0) {
    throw Error('Invalid character recipe: ' + entity);
   }
   this.previous.set(entity, {x: transform.x, y: transform.y, version: world.getVersion(), speed: 0});
   for (const item of [...(gesture ? [gesture] : []), ...performances]) {
    if (!item.action || !item.clip || !Number.isFinite(item.durationMs) || item.durationMs <= 0) {
     throw Error('Invalid character gesture');
    }
    this.bind(item.action, {entity, gesture: item});
   }
   if (stopAction) this.bind(stopAction, {entity});
  }
 }

 private bind(action: string, target: {entity: string; gesture?: Gesture}) {
  const targets = this.actions.get(action) ?? [];
  targets.push(target);
  this.actions.set(action, targets);
 }

 select(action: string, now: number): boolean {
  const targets = this.actions.get(action);
  if (!targets) return false;
  for (const {entity, gesture} of targets) {
   if (!gesture) {
    if (this.gestures.delete(entity)) console.info('[character:gesture-stop]', entity);
    continue;
   }
   const previous = this.gestures.get(entity);
   if (previous && previous.clip === gesture.clip && previous.until > now) {
    console.info('[character:reject]', entity, 'gesture already active');
    continue;
   }
   this.gestures.set(entity, {clip: gesture.clip, until: now + gesture.durationMs});
   console.info('[character:gesture]', entity, gesture.clip);
  }
  return true;
 }

 update(now: number) {
  for (const recipe of this.recipes) {
   const {entity} = recipe;
   const anim = this.world.getComponent<AnimState3D>(entity, 'AnimState3D')!;
   const transform = this.world.getComponent<Transform>(entity, 'Transform')!;
   const previous = this.previous.get(entity)!;
   const version = this.world.getVersion();
   if (version !== previous.version) {
    previous.speed = Math.hypot(transform.x - previous.x, transform.y - previous.y) / Math.max(1, version - previous.version);
    previous.x = transform.x;
    previous.y = transform.y;
    previous.version = version;
   }
   const speed = previous.speed;
   const moving = Number.isFinite(speed) && speed > 1e-6;
   let gesture = this.gestures.get(entity);
   if (gesture && (moving || gesture.until <= now)) {
    this.gestures.delete(entity);
    gesture = undefined;
   }
   const social = this.socialPose?.(recipe.entity, version);
   const clip = social ? social.clip ?? recipe.idle : moving ? recipe.walk : gesture?.clip ?? recipe.idle;
   if (anim.clip !== clip) console.info('[character:transition]', entity, anim.clip, clip);
   anim.clip = clip;
   anim.speed = social ? social.speed : moving ? Math.min(2.5, speed / recipe.nominalSpeedPerTick) : 1;
   anim.loop = social ? social.loop : !gesture;
   delete anim.speedAtVelocity;
  }
 }
}
