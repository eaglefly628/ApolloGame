/** D4 read-only source pairing. No independent root clock or World writes. */
import type { IWorld } from '@engine/core/types.js';
import type { CharacterMotor3D, CharacterMotorPlayback3D } from '@engine/protocol/components/character-motor.js';
import type { AnimationDriver3D, AnimationDriverPlayback3D } from '@engine/protocol/components/animation-driver.js';
import { validateAnimationDriver3D, validateAnimationDriverPlayback3D, validateDriverTree } from '@engine/protocol/components/animation-driver.js';
import type { AnimationPerformance3D, AnimationPerformancePlayback3D } from '@engine/protocol/components/animation-performance.js';
import { validateAnimationPerformance3D, validateAnimationPerformancePlayback3D } from '@engine/protocol/components/animation-performance.js';
import type { RootMotion3D, RootMotionSource3D, RootMotionPlayback3D, RootMotionRequest, RootMotionCursor, RootMotionAnchor } from '@engine/protocol/components/root-motion.js';
import { validateRootMotionSource3D } from '@engine/protocol/components/root-motion.js';
import { validateRootMotion3D, validateRootMotionPlayback, createRootMotionPlayback, proposeRootMotion, acceptRootMotion } from '@engine/animation/root-motion.js';
export type RootMotionWorldView = Pick<IWorld, 'getComponent'>;
const BODY = ['Hips', 'Spine', 'Chest', 'Neck', 'Head', 'LeftUpperArm', 'LeftLowerArm', 'LeftHand', 'RightUpperArm', 'RightLowerArm', 'RightHand', 'LeftUpperLeg', 'LeftLowerLeg', 'LeftFoot', 'RightUpperLeg', 'RightLowerLeg', 'RightFoot'];
function fail(s: string): never { throw Error('root-motion: ' + s); }
/** Actual skeleton-wide coverage and GLB SHA pairing are the native bind gate. */
export function validateRootMotionBinding(c: RootMotion3D, source: RootMotionSource3D, motor: CharacterMotor3D, base?: AnimationDriver3D, performance?: AnimationPerformance3D): void {
    validateRootMotion3D(c);
    validateRootMotionSource3D(source);
    if (c.tickRate !== motor.motion.tickRate)
        fail('root/motor tickRate mismatch');
    if (c.limits.maxDeltaQ > motor.motion.collision.maxDeltaQ)
        fail('root limit exceeds motor budget');
    if (c.warp && !source.warpAnchorId)
        fail('warp requires sim anchor id');
    if (!c.warp && source.warpAnchorId)
        fail('anchor without warp');
    if (source.driver.kind === 'animation-driver') {
        if (!base)
            fail('D1 source configuration required');
        validateAnimationDriver3D(base);
        const timing = base.clips[source.driver.clip], clip = base.graph.clips[source.driver.clip];
        if (!timing || !clip || !clip.asset)
            fail('explicit external D1 clip alias required');
        if (base.tickRate !== c.tickRate || timing.durationTicks * 1000 !== c.durationSubticks || (clip.loop ? 'repeat' : 'once') !== c.loop)
            fail('D1 timing/loop pairing');
    }
    else {
        if (!performance)
            fail('performance configuration required');
        validateAnimationPerformance3D(performance);
        const { slot, clip } = source.driver, s = performance.slots[slot], timing = performance.clips[clip];
        if (!s || !timing)
            fail('performance slot/clip missing');
        if (performance.tickRate !== c.tickRate || timing.durationTicks * 1000 !== c.durationSubticks || timing.sourceSha256 !== c.inPlaceClipSha256)
            fail('performance timing/SHA pairing');
        if (s.mode !== 'override' || s.weightQ !== 1000000 || BODY.some(b => !s.bones.includes(b)))
            fail('performance root needs explicit full-body override mask');
        let found = false;
        for (const m of Object.values(performance.montages))
            if (m.slot === slot)
                for (const section of m.sections)
                    if (section.clip === clip) {
                        found = true;
                        if (m.blendInTicks !== 0 || m.blendOutTicks !== 0 || section.startTick !== 0 || section.endTick !== timing.durationTicks || (section.mode === 'hold' ? 'repeat' : 'once') !== c.loop)
                            fail('performance root cannot blend/trim or change loop');
                    }
        if (!found)
            fail('performance clip has no playable section');
    }
}
interface SourcePose {
    instance: number;
    cursor: RootMotionCursor;
    active: boolean;
    driverTick: number;
    terminal?: boolean;
}
function d1Source(c: RootMotion3D, source: RootMotionSource3D, p: AnimationDriverPlayback3D): SourcePose { if (source.driver.kind !== 'animation-driver')
    fail('D1 kind'); const alias = source.driver.clip, s = p.clips[alias], weight = p.weights[alias]; if (!s)
    fail('source cursor missing'); if (weight > 0 && (weight !== 1 || p.transition !== undefined))
    fail('mixed/fading D1 root unsupported'); return { instance: s.instance, cursor: { cycle: s.cycle, subtick: s.cursorSubticks }, active: weight === 1, driverTick: p.tick }; }
function performanceSource(c: RootMotion3D, source: RootMotionSource3D, config: AnimationPerformance3D, p: AnimationPerformancePlayback3D, prior?: SourcePose, old?: AnimationPerformancePlayback3D): SourcePose {
    if (source.driver.kind !== 'performance-slot')
        fail('performance kind');
    const { slot, clip } = source.driver, s = p.slots[slot];
    if (s) {
        if (s.outgoing && s.outgoing.weightQ > 0 && config.montages[s.outgoing.montage].sections[s.outgoing.sectionIndex].clip === clip)
            fail('mixed/fading outgoing performance root unsupported');
        const section = config.montages[s.montage].sections[s.sectionIndex];
        if (section.clip === clip) {
            if (s.weightQ > 0 && (s.weightQ !== 1000000 || s.outgoing || s.phase !== 'playing'))
                fail('mixed/fading performance root unsupported');
            return { instance: s.instance, cursor: { cycle: s.cycle, subtick: (section.startTick + s.cursorTick) * 1000 }, active: s.weightQ === 1000000, driverTick: p.tick };
        }
    }
    // Completing a once section may remove the slot in the same source tick. The
    // authoritative complete/section transition proves that final interval, never a free host counter.
    if (prior?.active && c.loop === 'once' && old) {
        const before = old.slots[slot];
        if (before) {
            const terminal = p.events.some(e => e.montage === before.montage && e.instance === before.instance && e.sectionIndex === before.sectionIndex && e.kind === 'complete' && e.atTick === c.durationSubticks / 1000) || !!s && s.instance === before.instance && s.sectionIndex === before.sectionIndex + 1;
            if (terminal)
                return { instance: prior.instance, cursor: { cycle: 0, subtick: c.durationSubticks }, active: false, driverTick: p.tick, terminal: true };
        }
    }
    return { instance: prior?.instance ?? 0, cursor: prior?.cursor ?? { cycle: 0, subtick: 0 }, active: false, driverTick: p.tick };
}
export interface RootMotionWorldPlan {
    readonly config: RootMotion3D;
    readonly playback: RootMotionPlayback3D;
    readonly request: RootMotionRequest | null;
    readonly sourceActive: boolean;
    readonly seek: boolean;
}
/** Prepared base/performance are from THIS transaction. Source snapshots from
 * view are the prior committed tick, never render mixer times. */
export function prepareRootMotionWorldStep(view: RootMotionWorldView, id: string, motor: CharacterMotor3D, previous: CharacterMotorPlayback3D, drivers: {
    readonly base?: {
        readonly previous: AnimationDriverPlayback3D;
        readonly playback: AnimationDriverPlayback3D;
    };
    readonly performance?: AnimationPerformancePlayback3D;
}): RootMotionWorldPlan | undefined {
    const raw = view.getComponent<RootMotion3D>(id, 'RootMotion3D'), rawSource = view.getComponent<RootMotionSource3D>(id, 'RootMotionSource3D'), saved = view.getComponent<RootMotionPlayback3D>(id, 'RootMotionPlayback3D');
    if (!raw) {
        if (rawSource || saved)
            fail('orphan source/playback');
        return undefined;
    }
    if (!rawSource)
        fail('RootMotionSource3D required');
    const c = validateRootMotion3D(raw), source = validateRootMotionSource3D(rawSource), base = view.getComponent<AnimationDriver3D>(id, 'AnimationDriver3D'), perf = view.getComponent<AnimationPerformance3D>(id, 'AnimationPerformance3D');
    validateRootMotionBinding(c, source, motor, base, perf);
    if (base && view.getComponent(id, 'LocomotionDriver3D'))
        fail('authoritative base drivers are exclusive');
    if (drivers.base && drivers.base.previous.tick !== previous.motor.tick)
        fail('base/motor snapshot tick mismatch');
    // Render-only ownership/Model existence is checked at assembly and native binding, never used as sim input.
    if (view.getComponent(id, 'CharacterMotorIntent3D')) {
        const intent = view.getComponent<{
            type: string;
            move?: unknown;
            facing?: unknown;
        }>(id, 'CharacterMotorIntent3D')!;
        if (intent.move || intent.facing)
            fail('root motion excludes move/facing intent');
    }
    let before: SourcePose, next: SourcePose, seek = false;
    if (source.driver.kind === 'animation-driver') {
        if (!drivers.base || !base)
            fail('same-tick D1 plan missing');
        validateAnimationDriverPlayback3D(base, drivers.base.previous);
        validateAnimationDriverPlayback3D(base, drivers.base.playback);
        before = d1Source(c, source, drivers.base.previous);
        next = d1Source(c, source, drivers.base.playback);
        const command = view.getComponent<{
            type: string;
            commands: readonly {
                seq: number;
                op: string;
            }[];
        }>(id, 'AnimationDriverCommand3D');
        seek = !!command?.commands.some(x => x.seq > drivers.base!.previous.lastCommandSeq && x.op === 'seek');
    }
    else {
        if (!perf || !drivers.performance)
            fail('same-tick performance missing');
        const old = view.getComponent<AnimationPerformancePlayback3D>(id, 'AnimationPerformancePlayback3D');
        if (old) {
            validateAnimationPerformancePlayback3D(perf, old);
            if (old.actorId !== id)
                fail('performance actor mismatch');
        }
        validateAnimationPerformancePlayback3D(perf, drivers.performance);
        if (drivers.performance.actorId !== id)
            fail('performance actor mismatch');
        before = old ? performanceSource(c, source, perf, old) : { instance: 0, cursor: { cycle: 0, subtick: 0 }, active: false, driverTick: 0 };
        next = performanceSource(c, source, perf, drivers.performance, before, old);
        const command = view.getComponent<{
            type: string;
            commands: readonly {
                seq: number;
                op: string;
            }[];
        }>(id, 'AnimationPerformanceCommand3D');
        seek = !!command?.commands.some(x => x.seq > (old?.lastCommandSeq ?? 0) && x.op === 'preview-seek');
    }
    // Root-bearing Hips cannot simultaneously come from a second performance slot.
    if (perf && drivers.performance)
        for (const [slot, s] of Object.entries(drivers.performance.slots))
            if ((source.driver.kind !== 'performance-slot' || slot !== source.driver.slot) && s.weightQ > 0 && perf.slots[slot].bones.includes('Hips'))
                fail('another performance layer controls root body');
    if (before.driverTick !== previous.motor.tick || next.driverTick !== before.driverTick + 1)
        fail('source/motor driver tick mismatch');
    const hasMotor = !!view.getComponent(id, 'CharacterMotorPlayback3D');
    if (!!saved !== hasMotor)
        fail('root/motor/source snapshot tuple must restore together');
    if (saved) {
        validateRootMotionPlayback(c, saved);
        if(saved.lastDriverTick>0&&!saved.pose)fail('root accepted body pose required');
        if (saved.actorId !== id || saved.lastDriverTick !== before.driverTick || saved.pending)
            fail('root snapshot actor/tick/pending mismatch');
        if (saved.pose && (saved.pose.positionQ.x !== previous.motor.positionQ.x || saved.pose.positionQ.z !== previous.motor.positionQ.z || saved.pose.yawUnits !== previous.yawUnits))
            fail('root accepted body pose mismatch');
    }
    const reactivated = next.active && (!before.active || next.instance !== before.instance), instance = next.instance || saved?.instance || 1;
    let prior = saved ?? createRootMotionPlayback(c, id, before.instance || instance, before.cursor, before.driverTick);
    if (reactivated && next.instance !== prior.instance)
        prior = createRootMotionPlayback(c, id, next.instance, { cycle: 0, subtick: 0 }, before.driverTick);
    else if (reactivated && !before.active)
        prior = createRootMotionPlayback(c, id, instance, { cycle: 0, subtick: 0 }, before.driverTick);
    if (next.active && next.instance !== prior.instance)
        fail('source instance mismatch');
    const cursor = next.active || next.terminal ? next.cursor : prior.cursor;
    let anchor: RootMotionAnchor | undefined;
    if (!seek && next.active && c.warp && cursor.subtick > c.warp.startSubtick && prior.cursor.subtick < c.warp.endSubtick) {
        const target = view.getComponent<{
            type: string;
            x: number;
            y: number;
        }>(source.warpAnchorId!, 'Transform'), targetMotor = view.getComponent<CharacterMotorPlayback3D>(source.warpAnchorId!, 'CharacterMotorPlayback3D');
        if (!target)
            fail('sim warp Transform missing');
        validateDriverTree(target);
        const x = target.x * 10000, z = target.y * 10000;
        if (!Number.isSafeInteger(x) || !Number.isSafeInteger(z))
            fail('warp anchor must lie on Q10000 grid');
        anchor = { id: source.warpAnchorId!, positionQ: { x, z }, yawUnits: targetMotor?.yawUnits ?? 0 };
    }
    const result = proposeRootMotion(c, prior, { actorId: id, instance: prior.instance, epoch: prior.epoch, driverTick: next.driverTick, cursor, mode: seek || (!next.active && !next.terminal) ? 'seek' : 'advance', pose: { positionQ: { x: previous.motor.positionQ.x, z: previous.motor.positionQ.z }, yawUnits: previous.yawUnits }, ...(anchor ? { anchor } : {}) });
    return { config: c, ...result, sourceActive: next.active, seek };
}
export function acceptRootMotionWorldStep(plan: RootMotionWorldPlan, previous: CharacterMotorPlayback3D, accepted: CharacterMotorPlayback3D): RootMotionPlayback3D {
    if (accepted.motor.tick !== previous.motor.tick + 1 || (['x', 'y', 'z'] as const).some(k => accepted.motor.positionQ[k] - previous.motor.positionQ[k] !== accepted.result.acceptedDeltaQ[k]))
        fail('motor accepted feedback position/tick mismatch');
    if (!plan.request) {
        if (accepted.result.acceptedDeltaQ.x !== 0 || accepted.result.acceptedDeltaQ.z !== 0 || accepted.yawUnits !== previous.yawUnits)
            fail('preview seek moved root body');
        return plan.playback;
    }
    const r = plan.request;
    if (accepted.yawUnits !== ((previous.yawUnits + r.yawDeltaUnits) % 65536 + 65536) % 65536)
        fail('motor accepted feedback yaw mismatch');
    const acceptedDeltaQ = { x: accepted.result.acceptedDeltaQ.x, z: accepted.result.acceptedDeltaQ.z }, acceptedYawDeltaUnits = r.yawDeltaUnits;
    const blocked = acceptedDeltaQ.x !== r.deltaQ.x || acceptedDeltaQ.z !== r.deltaQ.z;
    return acceptRootMotion(plan.config, plan.playback, { requestId: r.requestId, actorId: r.actorId, instance: r.instance, epoch: r.epoch, driverTick: r.driverTick, acceptedDeltaQ, acceptedYawDeltaUnits, blocked });
}
/** Shared restore boundary; no systems, providers or World writes. */
export function validateRootMotionWorldSnapshot(view: RootMotionWorldView, id: string): void {
    const c = view.getComponent<RootMotion3D>(id, 'RootMotion3D'), source = view.getComponent<RootMotionSource3D>(id, 'RootMotionSource3D'), saved = view.getComponent<RootMotionPlayback3D>(id, 'RootMotionPlayback3D');
    if (!c) {
        if (source || saved)
            fail('orphan root source/playback');
        return;
    }
    if (!source)
        fail('RootMotionSource3D required');
    const motor = view.getComponent<CharacterMotor3D>(id, 'CharacterMotor3D');
    if (!motor)
        fail('CharacterMotor3D required');
    const base = view.getComponent<AnimationDriver3D>(id, 'AnimationDriver3D'), perf = view.getComponent<AnimationPerformance3D>(id, 'AnimationPerformance3D');
    validateRootMotionBinding(c, source, motor, base, perf);
    const body = view.getComponent<CharacterMotorPlayback3D>(id, 'CharacterMotorPlayback3D'), environment = view.getComponent(id, 'CharacterMotorEnvironment3D');
    if (!!saved !== !!body || !!saved !== !!environment)
        fail('root/motor/environment snapshot tuple');
    if (!saved)
        return;
    if (base) {
        const bp = view.getComponent<AnimationDriverPlayback3D>(id, 'AnimationDriverPlayback3D');
        if (!bp || bp.tick !== saved.lastDriverTick)
            fail('base/root restore tick mismatch');
    }
    else {
        const lp = view.getComponent<{
            type: string;
            playback: {
                lastFactsSeq: number;
            };
        }>(id, 'LocomotionPlayback3D');
        if (!lp || lp.playback.lastFactsSeq !== saved.lastDriverTick)
            fail('locomotion/root restore tick mismatch');
    }
    validateRootMotionPlayback(c, saved);
        if(saved.lastDriverTick>0&&!saved.pose)fail('root accepted body pose required');
    if (saved.pending || saved.actorId !== id || saved.lastDriverTick !== body!.motor.tick)
        fail('root snapshot actor/tick/pending mismatch');
    if (saved.pose && (saved.pose.positionQ.x !== body!.motor.positionQ.x || saved.pose.positionQ.z !== body!.motor.positionQ.z || saved.pose.yawUnits !== body!.yawUnits))
        fail('root/body accepted pose mismatch');
    let current: SourcePose;
    if (source.driver.kind === 'animation-driver') {
        const p = view.getComponent<AnimationDriverPlayback3D>(id, 'AnimationDriverPlayback3D');
        if (!base || !p)
            fail('root restore requires D1 playback');
        validateAnimationDriverPlayback3D(base, p);
        current = d1Source(c, source, p);
    }
    else {
        const p = view.getComponent<AnimationPerformancePlayback3D>(id, 'AnimationPerformancePlayback3D');
        if (!perf || !p)
            fail('root restore requires performance playback');
        validateAnimationPerformancePlayback3D(perf, p);
        if (p.actorId !== id)
            fail('performance actor mismatch');
        current = performanceSource(c, source, perf, p);
    }
    if (current.driverTick !== saved.lastDriverTick)
        fail('root source snapshot tick mismatch');
    if (current.active && (saved.instance !== current.instance || saved.cursor.cycle !== current.cursor.cycle || saved.cursor.subtick !== current.cursor.subtick))
        fail('root source instance/cursor mismatch');
}
