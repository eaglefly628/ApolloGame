/** Public component envelopes, with the same finite boundaries as the pure driver.
 * Event identity is scoped by the containing world entity plus the group event id.
 */
import { LOCOMOTION_STATES, projectLocomotionDriver, type LocomotionPlayback, type CompiledLocomotionDriver } from './locomotion-driver.js';
import type { LocomotionPlayback3D, LocomotionCommand3D } from '../protocol/components/locomotion-driver.js';
import { validateDriverTree } from '../protocol/components/animation-driver.js';
function fail(s: string): never { throw new Error('Locomotion3D: ' + s); }
function fields(value: unknown, keys: string[]): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value))
    fail('object required'); const row = value as Record<string, unknown>; if (Object.keys(row).length !== keys.length || keys.some(k => !Object.hasOwn(row, k)))
    fail('closed fields'); return row; }
function int(v: unknown, min = 0, max = 1e9): asserts v is number { if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < min || v > max)
    fail('integer range'); }
export function validateLocomotionCommand3D(value: unknown): LocomotionCommand3D {
    validateDriverTree(value);
    const v = fields(value, ['type', 'version', 'commands']);
    if (v.type !== 'LocomotionCommand3D' || v.version !== 1 || !Array.isArray(v.commands) || v.commands.length > 64)
        fail('command type/version/budget');
    let previous = 0;
    for (const op of v.commands) {
        const c = fields(op, op?.op === 'preview-seek' ? ['seq', 'op', 'state', 'tick', 'phaseQ', 'cycle'] : ['seq', 'op']);
        int(c.seq, 1);
        if (c.seq <= previous)
            fail('strictly increasing sequence');
        previous = c.seq;
        if (c.op === 'preview-seek') {
            if (!LOCOMOTION_STATES.includes(c.state as typeof LOCOMOTION_STATES[number]))
                fail('seek state');
            int(c.tick, 0, 1e7);
            int(c.phaseQ, 0, 999999);
            int(c.cycle);
        }
        else if (c.op !== 'pause' && c.op !== 'resume')
            fail('command op');
    }
    return value as LocomotionCommand3D;
}
export function validateLocomotionPlayback3D(compiled: CompiledLocomotionDriver, value: unknown): LocomotionPlayback3D {
    validateDriverTree(value);
    const v = fields(value, ['type', 'version', 'playback', 'events']);
    if (v.type !== 'LocomotionPlayback3D' || v.version !== 1 || !Array.isArray(v.events) || v.events.length > 64)
        fail('playback type/version/budget');
    projectLocomotionDriver(compiled, v.playback as LocomotionPlayback);
    const p = v.playback as LocomotionPlayback, g = compiled.configuration.gait;
    let cycle = -1, phase = -1;
    if (p.paused && v.events.length)
        fail('paused snapshot cannot contain events');
    for (const raw of v.events) {
        const e = fields(raw, ['id', 'groupId', 'instance', 'cycle', 'markerId', 'phaseQ', 'kind', 'foot']);
        int(e.cycle, 0, p.gait.cycle);
        const marker = g.markers.find(m => m.id === e.markerId);
        if (!marker || marker.kind !== 'plant' || e.kind !== 'plant' || e.groupId !== g.id || e.instance !== p.gait.instance || e.foot !== marker.foot || e.phaseQ !== marker.phaseQ || e.id !== `${g.id}:${p.gait.instance}:${e.cycle}:${marker.id}` || !p.gait.started)
            fail('event identity');
        if ((e.cycle === p.gait.cycle && marker.phaseQ > p.gait.phaseQ) || e.cycle < cycle || (e.cycle === cycle && marker.phaseQ <= phase))
            fail('event order/range');
        cycle = e.cycle;
        phase = marker.phaseQ;
    }
    return value as LocomotionPlayback3D;
}
