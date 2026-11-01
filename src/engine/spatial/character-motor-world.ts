import type { CharacterMotorEnvironment3D } from '../protocol/components/character-motor-environment.js';
/** Read-only collision scene and pose boundary shared by loader and motor system. */
import type { IWorld } from '../core/types.js';
import type { Transform, Collider3D } from '../protocol/components.js';
import type { CharacterMotor3D, CharacterMotorPlayback3D } from '../protocol/components/character-motor.js';
import { createCharacterMotor, type CharacterMotorObstacle } from './character-motor.js';
import { validateDriverTree } from '../protocol/components/animation-driver.js';
const Q = 10000;
export const MOTOR_EXCLUSIVE_SIM = ['Velocity', 'Acceleration', 'GroundWalker3D', 'GroundContact3D', 'GroundTeleport3D', 'Bounds', 'Hierarchy', 'FaceDir', 'Sensor'] as const;
function fail(s: string): never { throw new Error('character-motor: ' + s); }
function q(n: unknown): number {
    if (typeof n !== 'number' || !Number.isFinite(n))
        fail('finite meter coordinate required');
    const value = Math.round(n * Q) || 0;
    if (!Number.isSafeInteger(value) || Math.abs(value) > 1e9 || Math.abs(n - value / Q) > 1e-9)
        fail('coordinate must be on Q10000 grid within +/-100000m');
    return value;
}
export function motorCanonical(v: unknown): string {
    if (v === null || typeof v !== 'object')
        return JSON.stringify(v);
    if (Array.isArray(v))
        return '[' + v.map(motorCanonical).join(',') + ']';
    return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + motorCanonical((v as Record<string, unknown>)[k])).join(',') + '}';
}
export function motorProjections(c: CharacterMotor3D, p: CharacterMotorPlayback3D): {
    transform: Transform;
    collider: Collider3D;
} {
    const position = p.motor.positionQ, height = p.motor.stance === 'standing' ? c.motion.body.standingHeightQ : c.motion.body.crouchedHeightQ;
    return { transform: { type: 'Transform', x: position.x / Q, y: position.z / Q, rotation: -p.yawUnits * (Math.PI * 2 / 65536), scaleX: 1, scaleY: 1 }, collider: { type: 'Collider3D', kind: 'capsule', radius: c.motion.body.radiusQ / Q, height: height / Q, baseY: position.y / Q, offsetX: 0, offsetZ: 0, trigger: false } };
}
export function validateMotorProjection(world: IWorld, id: string, c: CharacterMotor3D, p: CharacterMotorPlayback3D, allowMissing = false): void {
    for (const type of MOTOR_EXCLUSIVE_SIM)
        if (world.hasComponent(id, type))
            fail(`${id}: exclusive movement authority conflicts with ${type}`);
    const expected = motorProjections(c, p), transform = world.getComponent<Transform>(id, 'Transform'), body = world.getComponent<Collider3D>(id, 'Collider3D');
    if (!transform || !body) {
        if (allowMissing && !transform && !body)
            return;
        fail(`${id}: missing motor projection`);
    }
    validateDriverTree(transform);
    validateDriverTree(body);
    if (motorCanonical(transform) !== motorCanonical(expected.transform) || motorCanonical(body) !== motorCanonical(expected.collider))
        fail(`${id}: motor projection changed outside authority`);
}
export function motorStaticObstacles(world: IWorld, actor: string): readonly CharacterMotorObstacle[] {
    const rows: CharacterMotorObstacle[] = [];
    for (const [id] of world.query('Collider3D').sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
        if (id === actor)
            continue;
        const body = world.getComponent<Collider3D>(id, 'Collider3D')!;
        validateDriverTree(body);
        if (body.trigger !== undefined && typeof body.trigger !== 'boolean')
            throw new Error('character-motor: Collider3D.trigger must be boolean');
        if (!['box', 'sphere', 'capsule', 'hull'].includes(body.kind))
            throw new Error('character-motor: invalid Collider3D kind');
        if (body.trigger || world.hasComponent(id, 'Sensor'))
            continue;
        if (world.hasComponent(id, 'CharacterMotor3D') || world.hasComponent(id, 'Velocity') || world.hasComponent(id, 'GroundWalker3D') || world.hasComponent(id, 'Hierarchy'))
            fail(`${id}: dynamic collision is unsupported by static-aabb motor`);
        const tr = world.getComponent<Transform>(id, 'Transform');
        if (!tr || body.kind !== 'box')
            fail(`${id}: static motor obstacles require Transform + box Collider3D`);
        validateDriverTree(tr);
        const x = q(tr.x) + q(body.offsetX ?? 0), z = q(tr.y) + q(body.offsetZ ?? 0), y = q(body.baseY ?? 0), hx = q(body.halfX), hy = q(body.halfY), hz = q(body.halfZ);
        if (hx <= 0 || hy <= 0 || hz <= 0)
            fail(`${id}: positive box dimensions required`);
        rows.push({ kind: 'static-aabb', id, min: { x: x - hx, y, z: z - hz }, max: { x: x + hx, y: y + 2 * hy, z: z + hz } });
    }
    return rows;
}
/** A restored supported mode must name the actual current support, not a ghost.
 * Recompute only an occupancy/support probe; never replace saved velocity/counters.
 */
export function validateMotorSceneSnapshot(c: CharacterMotor3D, p: CharacterMotorPlayback3D, obstacles: readonly CharacterMotorObstacle[]): void {
    const probe = createCharacterMotor(c.motion, { positionQ: p.motor.positionQ, stance: p.motor.stance }, obstacles);
    if (['grounded', 'landing', 'recovering'].includes(p.motor.mode) && (!probe.supportId || probe.supportId !== p.motor.supportId))
        throw new Error('character-motor: saved support does not match scene');
}
export function validateMotorEnvironment(value: unknown, scene: string): CharacterMotorEnvironment3D {
    validateDriverTree(value);
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('character-motor: static collision scene environment required');
    const e = value as Record<string, unknown>;
    if (e.type !== 'CharacterMotorEnvironment3D' || e.version !== 1 || Object.keys(e).sort().join(',') !== 'staticSceneCanonical,type,version')
        throw new Error('character-motor: static collision scene environment invalid');
    if (e.staticSceneCanonical !== scene)
        throw new Error('character-motor: static collision scene changed');
    return value as CharacterMotorEnvironment3D;
}
