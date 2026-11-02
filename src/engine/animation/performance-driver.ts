/** D3 fixed-tick montage/slots only. D1 or locomotion base clocks remain separate.
 * Commands in ascending seq precede clocks. play/release/seek freeze that slot's
 * advancement for the command step. Pause consumes seq/host tick but no cues.
 * Markers use (old,new]; section entry start fires once. Hold endpoint belongs
 * to old cycle, then entry marker belongs to new cycle. Outgoing poses freeze.
 */
import { validateDriverTree } from '../protocol/components/animation-driver.js';
import type { AnimationPerformance3D, AnimationPerformancePlayback3D, PerformanceSlotPlayback, PerformanceEvent, PerformanceOperation, PerformanceOutgoing } from '../protocol/components/animation-performance.js';
import { performanceIdentity, performanceEventId, performanceReject, PERFORMANCE_MAX_EVENTS, validateAnimationPerformance3D, validateAnimationPerformancePlayback3D, validateAnimationPerformanceCommand3D } from '../protocol/components/animation-performance.js';
type Mutable<T> = {
    -readonly [K in keyof T]: T[K] extends object ? Mutable<T[K]> : T[K];
};
type Slot = Omit<Mutable<PerformanceSlotPlayback>, 'outgoing'> & {
    outgoing?: Mutable<PerformanceOutgoing>;
};
type Playback = Omit<Mutable<AnimationPerformancePlayback3D>, 'slots'> & {
    slots: Record<string, Slot>;
};
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const slotOrder = (c: AnimationPerformance3D) => Object.keys(c.slots).sort((a, b) => c.slots[a].order - c.slots[b].order);
export function createAnimationPerformance(config: AnimationPerformance3D, actorId: string): AnimationPerformancePlayback3D {
    validateAnimationPerformance3D(config);
    const p: AnimationPerformancePlayback3D = { type: 'AnimationPerformancePlayback3D', version: 1, configIdentity: performanceIdentity(config), actorId, tick: 0, paused: false, lastCommandSeq: 0, nextInstance: 1, slots: {}, events: [] };
    validateAnimationPerformancePlayback3D(config, p);
    return p;
}
/** seq<=lastCommandSeq is stale after structural/reference validation. This is
 * bounded replay suppression, not authentication of historical command payload. */
export function stepAnimationPerformance(config: AnimationPerformance3D, previous: AnimationPerformancePlayback3D, input: {
    readonly commands?: readonly PerformanceOperation[];
} = {}): AnimationPerformancePlayback3D {
    validateAnimationPerformancePlayback3D(config, previous);
    validateDriverTree(input);
    const keys = Object.keys(input);
    if (keys.some(k => k !== 'commands'))
        performanceReject('unknown step input');
    const commands = validateAnimationPerformanceCommand3D(config, { type: 'AnimationPerformanceCommand3D', version: 1, commands: input.commands ?? [] }).commands;
    const p = clone(previous) as Playback;
    p.events = [];
    if (p.tick >= 1e9)
        performanceReject('host tick overflow');
    p.tick++;
    const frozen = new Set<string>();
    let seek = false, clockCommand = false;
    const event = (slot: string, s: Slot, kind: PerformanceEvent['kind'], extra: Partial<PerformanceEvent> = {}) => {
        const section = config.montages[s.montage].sections[s.sectionIndex];
        const e = { actorId: p.actorId, kind, slot, montage: s.montage, instance: s.instance, sectionIndex: s.sectionIndex, cycle: s.cycle, atTick: section.startTick + s.cursorTick, ...extra };
        const id = performanceEventId(e);
        if (p.events.length >= PERFORMANCE_MAX_EVENTS)
            performanceReject('event budget');
        p.events.push({ ...e, id });
    };
    const cues = (slot: string, s: Slot, from: number, to: number) => { if (seek || p.paused || config.slots[slot].weightQ === 0)
        return; const section = config.montages[s.montage].sections[s.sectionIndex], notifies = config.clips[section.clip].notifies ?? []; for (const cue of [...notifies].sort((a, b) => a.atTick - b.atTick || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)))
        if (cue.atTick >= section.startTick && cue.atTick <= section.endTick && cue.atTick > from && cue.atTick <= to)
            event(slot, s, 'notify', { atTick: cue.atTick, cueId: cue.id }); };
    const enter = (slot: string, s: Slot) => { s.started = true; event(slot, s, 'section'); const section = config.montages[s.montage].sections[s.sectionIndex]; cues(slot, s, section.startTick - 1, section.startTick); };
    const finish = (slot: string, s: Slot) => { event(slot, s, 'complete'); delete p.slots[slot]; };
    const fadeOut = (slot: string, s: Slot) => { if (s.phase === 'blend-out')
        return; s.phase = 'blend-out'; s.blendElapsedTicks = 0; s.blendFromWeightQ = s.weightQ; if (s.outgoing)
        s.outgoing.fromWeightQ = s.outgoing.weightQ; if (config.montages[s.montage].blendOutTicks === 0)
        finish(slot, s); };
    const nextSection = (slot: string, s: Slot) => { const montage = config.montages[s.montage]; if (s.sectionIndex + 1 >= montage.sections.length) {
        fadeOut(slot, s);
        return;
    } s.sectionIndex++; s.cursorTick = 0; s.cycle = 0; s.started = false; if (!seek && !p.paused && !clockCommand)
        enter(slot, s); };
    // A preview seek suppresses all cues/section events for this step, even if a
    // preceding command entered a section; authoritative rollback is a plain restore.
    seek = commands.some(c => c.seq > p.lastCommandSeq && c.op === 'preview-seek');
    clockCommand = commands.some(c => c.seq > p.lastCommandSeq && (c.op === 'pause' || c.op === 'resume'));
    for (const command of commands) {
        if (command.seq <= p.lastCommandSeq)
            continue;
        p.lastCommandSeq = command.seq;
        if (command.op === 'pause' || command.op === 'resume') {
            p.paused = command.op === 'pause';
            clockCommand = true;
            continue;
        }
        if (command.op === 'play') {
            const montage = config.montages[command.montage], slot = montage.slot, old = p.slots[slot];
            if (old && (old.outgoing || montage.priority < config.montages[old.montage].priority)) {
                const s: Slot = { montage: command.montage, instance: 0, sectionIndex: 0, cursorTick: 0, cycle: 0, started: false, phase: 'playing', weightQ: 0, blendElapsedTicks: 0, blendFromWeightQ: 0 };
                event(slot, s, 'blocked', { commandSeq: command.seq, reason: old.outgoing ? 'transition-busy' : 'priority' });
                continue;
            }
            if (p.nextInstance >= 1e9)
                performanceReject('instance overflow');
            if (old)
                event(slot, old, 'interrupted', { commandSeq: command.seq });
            const s: Slot = { montage: command.montage, instance: p.nextInstance++, sectionIndex: 0, cursorTick: 0, cycle: 0, started: false, phase: 'playing', weightQ: montage.blendInTicks === 0 ? config.slots[slot].weightQ : 0, blendElapsedTicks: 0, blendFromWeightQ: 0 };
            if (old && old.weightQ > 0 && montage.blendInTicks > 0)
                s.outgoing = { montage: old.montage, instance: old.instance, sectionIndex: old.sectionIndex, cursorTick: old.cursorTick, cycle: old.cycle, weightQ: old.weightQ, fromWeightQ: old.weightQ };
            p.slots[slot] = s;
            frozen.add(slot);
            continue;
        }
        const slot = command.slot, s = p.slots[slot];
        if (command.op === 'preview-seek') {
            if (!s)
                performanceReject('seek requires active slot');
            const montage = config.montages[s.montage], index = montage.sections.findIndex(x => x.id === command.section);
            if (index < 0)
                performanceReject('seek section missing');
            const section = montage.sections[index], duration = section.endTick - section.startTick;
            if (command.tick > duration || (section.mode === 'hold' && command.tick === duration))
                performanceReject('seek cursor out of section');
            s.sectionIndex = index;
            s.cursorTick = command.tick;
            s.cycle = 0;
            s.started = true;
            frozen.add(slot);
            continue;
        }
        if (!s)
            continue;
        if (command.op === 'cancel') {
            event(slot, s, 'interrupted', { commandSeq: command.seq });
            fadeOut(slot, s);
            frozen.add(slot);
        }
        else if (command.op === 'release' && s.phase === 'playing') {
            const section = config.montages[s.montage].sections[s.sectionIndex];
            if (section.mode === 'hold') {
                nextSection(slot, s);
                frozen.add(slot);
            }
        }
    }
    if (!p.paused && !clockCommand)
        for (const slot of slotOrder(config)) {
            const s = p.slots[slot];
            if (!s || frozen.has(slot))
                continue;
            const montage = config.montages[s.montage];
            if (s.phase === 'blend-out') {
                s.blendElapsedTicks++;
                s.weightQ = Math.floor(s.blendFromWeightQ * (montage.blendOutTicks - s.blendElapsedTicks) / montage.blendOutTicks);
                if (s.outgoing) {
                    s.outgoing.weightQ = Math.floor(s.outgoing.fromWeightQ * (montage.blendOutTicks - s.blendElapsedTicks) / montage.blendOutTicks);
                    if (s.outgoing.weightQ === 0)
                        delete s.outgoing;
                }
                if (s.blendElapsedTicks === montage.blendOutTicks)
                    finish(slot, s);
                continue;
            }
            if (s.blendElapsedTicks < montage.blendInTicks)
                s.blendElapsedTicks++;
            s.weightQ = montage.blendInTicks === 0 ? config.slots[slot].weightQ : Math.floor(config.slots[slot].weightQ * s.blendElapsedTicks / montage.blendInTicks);
            if (s.outgoing) {
                s.outgoing.weightQ = Math.floor(s.outgoing.fromWeightQ * (montage.blendInTicks - s.blendElapsedTicks) / montage.blendInTicks);
                if (s.outgoing.weightQ === 0)
                    delete s.outgoing;
            }
            if (!s.started)
                enter(slot, s);
            const section = montage.sections[s.sectionIndex];
            // A preview may intentionally display the once-section endpoint.
            // The following step transitions instead of advancing out of range.
            if (s.cursorTick === section.endTick - section.startTick) {
                nextSection(slot, s);
                continue;
            }
            const old = section.startTick + s.cursorTick;
            s.cursorTick++;
            cues(slot, s, old, section.startTick + s.cursorTick);
            if (s.cursorTick === section.endTick - section.startTick) {
                if (section.mode === 'hold') {
                    if (s.cycle >= 1e9)
                        performanceReject('cycle overflow');
                    s.cycle++;
                    s.cursorTick = 0;
                    enter(slot, s);
                }
                else
                    nextSection(slot, s);
            }
        }
    if (clockCommand)
        p.events = p.events.filter(e => e.kind !== 'notify');
    if (seek)
        p.events = p.events.filter(e => e.kind !== 'notify' && e.kind !== 'section');
    if (p.paused)
        p.events = p.events.filter(e => e.kind !== 'notify');
    validateAnimationPerformancePlayback3D(config, p);
    return p;
}
export interface PerformancePoseLayer {
    readonly slot: string;
    readonly order: number;
    readonly mode: 'override' | 'additive';
    readonly bones: readonly string[];
    readonly weightQ: number;
    readonly clip: string;
    readonly timeSeconds: number;
    readonly instance: number;
    readonly outgoing: boolean;
    readonly reference?: {
        readonly clip: string;
        readonly timeSeconds: number;
    };
}
/** Base -> explicit ordered overrides -> additive reference deltas -> caller IK.
 * These alphas are never normalized together with base or other slots. */
export function projectAnimationPerformance(config: AnimationPerformance3D, playback: AnimationPerformancePlayback3D): {
    readonly layers: readonly PerformancePoseLayer[];
} {
    validateAnimationPerformancePlayback3D(config, playback);
    const layers: PerformancePoseLayer[] = [];
    for (const slot of slotOrder(config)) {
        const state = playback.slots[slot];
        if (!state)
            continue;
        const spec = config.slots[slot];
        const add = (s: {
            montage: string;
            sectionIndex: number;
            cursorTick: number;
            instance: number;
            weightQ: number;
        }, outgoing: boolean) => { const section = config.montages[s.montage].sections[s.sectionIndex]; layers.push({ slot, order: spec.order, mode: spec.mode, bones: [...spec.bones], weightQ: s.weightQ, clip: section.clip, timeSeconds: (section.startTick + s.cursorTick) / config.tickRate, instance: s.instance, outgoing, ...(spec.reference ? { reference: { clip: spec.reference.clip, timeSeconds: spec.reference.atTick / config.tickRate } } : {}) }); };
        if (state.outgoing)
            add(state.outgoing, true);
        add(state, false);
    }
    return { layers };
}
