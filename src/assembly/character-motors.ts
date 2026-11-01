import {createCharacterMotor} from '@engine/spatial/character-motor.js';
import { World } from '@engine/core/world.js';
import type { Component } from '@engine/core/types.js';
import { validateDriverTree } from '@engine/protocol/components/animation-driver.js';
import type { CharacterMotor3D, CharacterMotorPlayback3D } from '@engine/protocol/components/character-motor.js';
import {
  validateCharacterMotor3D, validateCharacterMotorIntent3D,
  validateCharacterMotorPlayback3D, createCharacterMotorPlayback3D,
} from '@engine/spatial/character-motor-driver.js';
import {
  MOTOR_EXCLUSIVE_SIM, motorStaticObstacles,
  validateMotorProjection, motorCanonical,
} from '@engine/spatial/character-motor-world.js';

const MOTOR_TYPES = ['CharacterMotor3D', 'CharacterMotorIntent3D', 'CharacterMotorPlayback3D', 'CharacterMotorEnvironment3D'] as const;
const RENDER_POSITION_DRIVERS = ['Transform3D', 'Anim3D', 'Path3D', 'RigidBody3D', 'Pivot3D', 'Attach3D'] as const;
const TEMP_COMPONENTS = [...new Set<string>([...MOTOR_TYPES, ...MOTOR_EXCLUSIVE_SIM, 'Transform', 'Collider3D'])];
const own = (row: object, key: string): boolean => Object.hasOwn(row, key);
function reject(message: string): never { throw new Error(`character-motors: ${message}`); }
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
/** Container inspection never calls getters. Existing legacy component payloads are not validated here. */
function dataRows(entities: Record<string, unknown>): Array<[string, Record<string, unknown>]> {
  if (!record(entities)) reject('entities object required');
  const rows: Array<[string, Record<string, unknown>]> = [];
  for (const [id, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(entities))) {
    if (!('value' in descriptor)) reject(`${id}: entity accessor is not data`);
    const value = descriptor.value;
    if (record(value)) rows.push([id, value]);
  }
  return rows;
}
/** Blueprint discriminants are optional; a supplied conflicting type is never overwritten. */
function component(raw: unknown, type: string): Component {
  if (!record(raw)) reject(`${type}: component object required`);
  if (own(raw, 'type') && raw.type !== type) reject(`${type}: conflicting component type`);
  // The complete batch was validated before normalization. Own the temporary copies,
  // so even an accidental future helper write cannot mutate caller scene data.
  return { ...JSON.parse(JSON.stringify(raw)), type } as Component;
}

/** Validate the complete merged scene before any real World/metadata commit.
 * No systems, providers, capabilities or asset loaders are installed in the temporary World.
 * V1 supports one motor actor in a static-AABB collision world. Legacy-only scenes
 * retain their existing semantic validation path; hostile accessor containers still reject.
 */
export function validateCharacterMotors(entities: Record<string, unknown>, tickRate?: number): void {
  const rows = dataRows(entities);
  const involved = rows.filter(([, row]) => MOTOR_TYPES.some(type => own(row, type)));
  if (involved.length === 0) return;
  validateDriverTree(entities);
  for (const [id, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(entities))) {
    if (!record(descriptor.value)) reject(`${id}: entity component map required`);
  }
  if (tickRate !== undefined && (!Number.isInteger(tickRate) || tickRate < 1 || tickRate > 240)) reject('Engine tickRate must be an integer in 1..240');

  const actors = involved.filter(([, row]) => own(row, 'CharacterMotor3D'));
  if (actors.length > 1) reject('static-aabb V1 supports one motor actor per collision world');
  for (const [id, row] of involved) {
    if (!own(row, 'CharacterMotor3D')) reject(`${id}: orphan intent/playback/environment requires CharacterMotor3D`);
    const playback = own(row, 'CharacterMotorPlayback3D');
    const environment = own(row, 'CharacterMotorEnvironment3D');
    if (playback !== environment) reject(`${id}: playback/environment must restore together`);
    for (const type of [...MOTOR_EXCLUSIVE_SIM, ...RENDER_POSITION_DRIVERS]) {
      if (own(row, type)) reject(`${id}: ${type} conflicts with motor movement authority`);
    }
    if (own(row, 'Transform') !== own(row, 'Collider3D')) reject(`${id}: Transform and Collider3D must both be supplied or both omitted`);
  }

  const actorId = actors[0][0];
  for (const [id, row] of rows) {
    if (own(row, 'Pivot3D')) {
      const pivot = row.Pivot3D;
      if (record(pivot) && Array.isArray(pivot.children) && pivot.children.includes(actorId)) reject(`${actorId}: render pivot ${id} drives motor position`);
    }
  }

  const temporary = new World({ strict: true });
  for (const [id, row] of rows) {
    temporary.createEntity(id);
    for (const type of TEMP_COMPONENTS) {
      if (!own(row, type)) continue;
      const data = component(row[type], type);
      // A string such as trigger:'false' must not evade helper's dynamic/solid check.
      if (type === 'Collider3D') {
        const collider = data as Component & { trigger?: unknown; kind?: unknown };
        if (collider.trigger !== undefined && typeof collider.trigger !== 'boolean') reject(`${id}: Collider3D.trigger must be boolean`);
        if (!['box', 'sphere', 'capsule', 'hull'].includes(collider.kind as string)) reject(`${id}: Collider3D kind is invalid`);
      }
      temporary.addComponent(id, data);
    }
  }

  const world = temporary.readView();
  for (const [id, row] of actors) {
    try {
      const config: CharacterMotor3D = validateCharacterMotor3D(temporary.getComponent(id, 'CharacterMotor3D'));
      if (tickRate !== undefined && config.motion.tickRate !== tickRate) reject(`${id}: motion.tickRate ${config.motion.tickRate} differs from Engine tickRate ${tickRate}`);
      const intent = temporary.getComponent(id, 'CharacterMotorIntent3D');
      if (intent) validateCharacterMotorIntent3D(intent);
      const obstacles = motorStaticObstacles(world, id);
      const saved = temporary.getComponent<CharacterMotorPlayback3D>(id, 'CharacterMotorPlayback3D');
      const playback = saved ? validateCharacterMotorPlayback3D(config, saved) : createCharacterMotorPlayback3D(config, obstacles);
      // Restore must occupy legal geometry too. This probe does not replace the
      // saved velocity, airborne mode, counters, support or integration remainders.
      if (saved) {
        const occupancy = createCharacterMotor(config.motion, {positionQ: playback.motor.positionQ, stance: playback.motor.stance}, obstacles);
        // Only supported lifecycle modes assert a support. An airborne capsule may
        // be near the floor without adopting the probe's initial grounded mode.
        if (['grounded', 'landing', 'recovering'].includes(playback.motor.mode) &&
            (!occupancy.supportId || playback.motor.supportId !== occupancy.supportId)) {
          reject(`${id}: saved support identity does not match static scene support`);
        }
      }
      // No user projections are synthesized or returned. Both missing is a legal
      // bootstrap; supplying either means the exact complete projection is required.
      validateMotorProjection(world, id, config, playback, true);
      const environment = temporary.getComponent(id, 'CharacterMotorEnvironment3D') as (Component & { version?: unknown; staticSceneCanonical?: unknown }) | undefined;
      if (environment) {
        if (environment.type !== 'CharacterMotorEnvironment3D' || environment.version !== 1 || Object.keys(environment).sort().join(',') !== 'staticSceneCanonical,type,version') reject(`${id}: invalid environment version/shape`);
        if (environment.staticSceneCanonical !== motorCanonical(obstacles)) reject(`${id}: static collision scene snapshot mismatch`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`character-motors: ${id}: ${message}`);
    }
  }
}
