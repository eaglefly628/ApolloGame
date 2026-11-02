import { validateDriverTree } from '@engine/protocol/components/animation-driver.js';
import { validateCharacterMotor3D, validateCharacterMotorPlayback3D } from '@engine/spatial/character-motor-driver.js';
import { validateRootMotionWorldSnapshot } from '@skills/tier2/root-motion-plan.js';
import { animationDriverData } from './animation-drivers.js';
const TYPES = ['RootMotion3D', 'RootMotionSource3D', 'RootMotionPlayback3D'];
/** Whole merged scene before load/import. Model/legacy references are loader
 * guards, never render-only inputs to root/motor simulation. Actual GLB pairing
 * and complete skeleton mask coverage remain the native binding gate. */
export function validateRootMotions(entities: Record<string, unknown>, tickRate?: number): void {
    if (!entities || typeof entities !== 'object' || Array.isArray(entities))
        throw Error('root-motions: entities object');
    const descriptors = Object.getOwnPropertyDescriptors(entities);
    for (const [id, d] of Object.entries(descriptors))
        if (!('value' in d))
            throw Error('root-motions: entity accessor ' + id);
    const involved = Object.entries(descriptors).filter(([, d]) => d.value && typeof d.value === 'object' && !Array.isArray(d.value) && TYPES.some(k => Object.hasOwn(d.value, k)));
    if (!involved.length)
        return;
    validateDriverTree(entities);
    const maps = new Map<string, Record<string, unknown>>();
    for (const [id, d] of Object.entries(descriptors)) {
        if (!d.value || typeof d.value !== 'object' || Array.isArray(d.value))
            throw Error('root-motions: entity map ' + id);
        const r: Record<string, unknown> = {};
        for (const [type, raw] of Object.entries(d.value))
            r[type] = animationDriverData(raw, type);
        maps.set(id, r);
    }
    const view = { getComponent: (id: string, type: string) => maps.get(id)?.[type] } as Parameters<typeof validateRootMotionWorldSnapshot>[0];
    for (const [id] of involved) {
        try {
            if(id.length<1||id.length>128)throw Error('root actor id budget');
            const row = maps.get(id)!;
            if (!row.RootMotion3D)
                throw Error('orphan source/playback');
            const motor = validateCharacterMotor3D(row.CharacterMotor3D);
            if (tickRate !== undefined && motor.motion.tickRate !== tickRate)
                throw Error('root Engine tickRate mismatch');
            if (row.CharacterMotorPlayback3D)
                validateCharacterMotorPlayback3D(motor, row.CharacterMotorPlayback3D);
            if (row.LocomotionDriver3D && row.AnimationDriver3D)
                throw Error('base drivers are exclusive');
            if (!row.AnimationDriver3D && !row.LocomotionDriver3D)
                throw Error('authoritative base required');
            if (row.AnimState3D || row.AnimGraph3D)
                throw Error('legacy animation conflicts');
            const model = row.Model3D as {
                modelKey?: unknown;
            } | undefined;
            if (!model || typeof model.modelKey !== 'string' || !model.modelKey.trim())
                throw Error('Model3D required');
            validateRootMotionWorldSnapshot(view, id);
            const source = row.RootMotionSource3D as {
                warpAnchorId?: string;
            };
            if (source.warpAnchorId) {
                const target = maps.get(source.warpAnchorId)?.Transform as {
                    x?: unknown;
                    y?: unknown;
                } | undefined;
                if (!target || typeof target.x !== 'number' || typeof target.y !== 'number' || !Number.isSafeInteger(target.x * 10000) || !Number.isSafeInteger(target.y * 10000))
                    throw Error('warp anchor requires sim Transform on Q grid');
            }
        }
        catch (error) {
            throw Error(`root-motions: ${id}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
