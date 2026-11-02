import type { Component } from '../../core/types.js';
import { t } from '../../core/schema.js';
import { fnv1a32 } from '../../math/hash.js';
import { validateDriverTree, driverFields, driverInt, ANIMATION_MAX_EVENTS } from './animation-driver.js';
export const PERFORMANCE_Q = 1000000;
export const PERFORMANCE_MAX_EVENTS = ANIMATION_MAX_EVENTS;
export interface PerformanceClip {
    readonly asset: string;
    readonly clipName: string;
    readonly sourceSha256: string;
    readonly retarget: 'exact' | 'humanoid';
    readonly durationTicks: number;
    readonly notifies?: readonly {
        readonly id: string;
        readonly atTick: number;
    }[];
}
export interface PerformanceSlot {
    readonly order: number;
    readonly mode: 'override' | 'additive';
    readonly bones: readonly string[];
    readonly weightQ: number;
    readonly reference?: {
        readonly clip: string;
        readonly atTick: number;
    };
}
export interface PerformanceSection {
    readonly id: string;
    readonly clip: string;
    readonly startTick: number;
    readonly endTick: number;
    readonly mode: 'once' | 'hold';
}
export interface PerformanceMontage {
    readonly slot: string;
    readonly priority: number;
    readonly blendInTicks: number;
    readonly blendOutTicks: number;
    readonly sections: readonly PerformanceSection[];
}
export interface AnimationPerformance3D extends Component {
    readonly type: 'AnimationPerformance3D';
    readonly version: 1;
    readonly tickRate: number;
    readonly clips: Readonly<Record<string, PerformanceClip>>;
    readonly slots: Readonly<Record<string, PerformanceSlot>>;
    readonly montages: Readonly<Record<string, PerformanceMontage>>;
}
export type PerformanceOperation = {
    readonly seq: number;
    readonly op: 'play';
    readonly montage: string;
} | {
    readonly seq: number;
    readonly op: 'release';
    readonly slot: string;
} | {
    readonly seq: number;
    readonly op: 'cancel';
    readonly slot: string;
} | {
    readonly seq: number;
    readonly op: 'pause';
} | {
    readonly seq: number;
    readonly op: 'resume';
} | {
    readonly seq: number;
    readonly op: 'preview-seek';
    readonly slot: string;
    readonly section: string;
    readonly tick: number;
};
export interface AnimationPerformanceCommand3D extends Component {
    readonly type: 'AnimationPerformanceCommand3D';
    readonly version: 1;
    readonly commands: readonly PerformanceOperation[];
}
export interface PerformanceOutgoing {
    readonly montage: string;
    readonly instance: number;
    readonly sectionIndex: number;
    readonly cursorTick: number;
    readonly cycle: number;
    readonly weightQ: number;
    readonly fromWeightQ: number;
}
export interface PerformanceSlotPlayback {
    readonly montage: string;
    readonly instance: number;
    readonly sectionIndex: number;
    readonly cursorTick: number;
    readonly cycle: number;
    readonly started: boolean;
    readonly phase: 'playing' | 'blend-out';
    readonly weightQ: number;
    readonly blendElapsedTicks: number;
    readonly blendFromWeightQ: number;
    readonly outgoing?: PerformanceOutgoing;
}
export interface PerformanceEvent {
    readonly id: string;
    readonly actorId: string;
    readonly kind: 'notify' | 'section' | 'complete' | 'interrupted' | 'blocked';
    readonly slot: string;
    readonly montage: string;
    readonly instance: number;
    readonly sectionIndex: number;
    readonly cycle: number;
    readonly atTick: number;
    readonly cueId?: string;
    readonly commandSeq?: number;
    readonly reason?: 'priority' | 'transition-busy';
}
export interface AnimationPerformancePlayback3D extends Component {
    readonly type: 'AnimationPerformancePlayback3D';
    readonly version: 1;
    readonly configIdentity: {
        readonly canonical: string;
        readonly fnv: number;
    };
    readonly actorId: string;
    readonly tick: number;
    readonly paused: boolean;
    readonly lastCommandSeq: number;
    readonly nextInstance: number;
    readonly slots: Readonly<Record<string, PerformanceSlotPlayback>>;
    readonly events: readonly PerformanceEvent[];
}
export function performanceReject(message: string): never { throw new Error('AnimationPerformance3D: ' + message); }
const own = (v: object, k: string) => Object.hasOwn(v, k);
function fields(v: unknown, keys: readonly string[], required: readonly string[] = keys): Record<string, unknown> { const r = driverFields(v, keys, 'performance'); if (required.some(k => !own(r, k)))
    performanceReject('missing fields'); return r; }
function stable(v: unknown): asserts v is string { if (typeof v !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,127}$/.test(v))
    performanceReject('stable identifier required'); }
function text(v: unknown): asserts v is string { if (typeof v !== 'string' || !v.trim() || v.length > 256)
    performanceReject('bounded text required'); }
function table(v: unknown, max: number): Record<string, unknown> { if (!v || typeof v !== 'object' || Array.isArray(v))
    performanceReject('table required'); const r = v as Record<string, unknown>, keys = Object.keys(r); if (!keys.length || keys.length > max)
    performanceReject('table budget'); keys.forEach(stable); return r; }
function ref(v: unknown, table: object): asserts v is string { if (typeof v !== 'string' || !own(table, v))
    performanceReject('missing reference'); }
function canonical(v: unknown): string { if (v === null || typeof v !== 'object')
    return JSON.stringify(v); if (Array.isArray(v))
    return '[' + v.map(canonical).join(',') + ']'; return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonical((v as Record<string, unknown>)[k])).join(',') + '}'; }
export function performanceIdentity(c: AnimationPerformance3D): {
    canonical: string;
    fnv: number;
} { const s = canonical(c); return { canonical: s, fnv: fnv1a32(s) }; }
export function performanceEventId(e: Omit<PerformanceEvent, 'id'>): string { return JSON.stringify([e.actorId, e.slot, e.montage, e.instance, e.sectionIndex, e.cycle, e.atTick, e.kind, e.cueId ?? '', e.commandSeq ?? 0, e.reason ?? '']); }
export function validateAnimationPerformance3D(value: unknown): AnimationPerformance3D {
    validateDriverTree(value);
    const c = fields(value, ['type', 'version', 'tickRate', 'clips', 'slots', 'montages']);
    if (c.type !== 'AnimationPerformance3D' || c.version !== 1)
        performanceReject('config version/type');
    driverInt(c.tickRate, 'tickRate', 1, 240);
    const clips = table(c.clips, 64), slots = table(c.slots, 8), montages = table(c.montages, 64);
    for (const raw of Object.values(clips)) {
        const x = fields(raw, ['asset', 'clipName', 'sourceSha256', 'retarget', 'durationTicks', 'notifies'], ['asset', 'clipName', 'sourceSha256', 'retarget', 'durationTicks']);
        text(x.asset);
        text(x.clipName);
        if (x.retarget !== 'exact' && x.retarget !== 'humanoid') performanceReject('explicit clip retarget policy required');
        if (typeof x.sourceSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(x.sourceSha256))
            performanceReject('source SHA256 required');
        driverInt(x.durationTicks, 'duration', 1, 1e7);
        if (x.notifies !== undefined) {
            if (!Array.isArray(x.notifies) || x.notifies.length > 64)
                performanceReject('notify budget');
            const ids = new Set();
            for (const n of x.notifies) {
                const q = fields(n, ['id', 'atTick']);
                stable(q.id);
                if (ids.has(q.id))
                    performanceReject('duplicate notify');
                ids.add(q.id);
                driverInt(q.atTick, 'notify tick', 0, x.durationTicks);
            }
        }
    }
    const orders = new Set<number>();
    let lastOverride = -1, firstAdditive = Infinity;
    for (const raw of Object.values(slots)) {
        const x = fields(raw, ['order', 'mode', 'bones', 'weightQ', 'reference'], ['order', 'mode', 'bones', 'weightQ']);
        driverInt(x.order, 'layer order', 0, 31);
        if (orders.has(x.order))
            performanceReject('duplicate layer order');
        orders.add(x.order);
        if (!['override', 'additive'].includes(x.mode as string))
            performanceReject('layer mode');
        driverInt(x.weightQ, 'slot weight', 0, PERFORMANCE_Q);
        if (!Array.isArray(x.bones) || !x.bones.length || x.bones.length > 128 || new Set(x.bones).size !== x.bones.length)
            performanceReject('explicit nonempty unique bone mask');
        for (const b of x.bones) {
            text(b);
            if (!/^[A-Za-z][A-Za-z0-9_:-]*$/.test(b))
                performanceReject('literal bone mask; no wildcard');
        }
        if (x.mode === 'additive') {
            firstAdditive = Math.min(firstAdditive, x.order);
            const r = fields(x.reference, ['clip', 'atTick']);
            ref(r.clip, clips);
            driverInt(r.atTick, 'reference tick', 0, (clips[r.clip] as PerformanceClip).durationTicks);
        }
        else {
            lastOverride = Math.max(lastOverride, x.order);
            if (x.reference !== undefined)
                performanceReject('override cannot declare additive reference');
        }
    }
    if (lastOverride > firstAdditive)
        performanceReject('override layers precede additive layers');
    for (const raw of Object.values(montages)) {
        const x = fields(raw, ['slot', 'priority', 'blendInTicks', 'blendOutTicks', 'sections']);
        ref(x.slot, slots);
        driverInt(x.priority, 'priority', 0, 65535);
        driverInt(x.blendInTicks, 'blend-in', 0, 14400);
        driverInt(x.blendOutTicks, 'blend-out', 0, 14400);
        if (!Array.isArray(x.sections) || !x.sections.length || x.sections.length > 32)
            performanceReject('section budget');
        const names = new Set();
        let holds = 0;
        for (const rawS of x.sections) {
            const s = fields(rawS, ['id', 'clip', 'startTick', 'endTick', 'mode']);
            stable(s.id);
            if (names.has(s.id))
                performanceReject('duplicate section');
            names.add(s.id);
            ref(s.clip, clips);
            driverInt(s.startTick, 'section start', 0, (clips[s.clip] as PerformanceClip).durationTicks - 1);
            driverInt(s.endTick, 'section end', (s.startTick as number) + 1, (clips[s.clip] as PerformanceClip).durationTicks);
            if (s.mode !== 'once' && s.mode !== 'hold')
                performanceReject('section mode');
            if (s.mode === 'hold')
                holds++;
        }
        if (holds > 1)
            performanceReject('at most one hold section');
    }
    return value as AnimationPerformance3D;
}
export function validateAnimationPerformanceCommand3D(config: AnimationPerformance3D, value: unknown): AnimationPerformanceCommand3D {
    validateAnimationPerformance3D(config);
    validateDriverTree(value);
    const c = fields(value, ['type', 'version', 'commands']);
    if (c.type !== 'AnimationPerformanceCommand3D' || c.version !== 1 || !Array.isArray(c.commands) || c.commands.length > 64)
        performanceReject('command envelope/budget');
    let previous = 0;
    for (const raw of c.commands) {
        const op = (raw as {
            op?: unknown;
        }).op, keys = op === 'play' ? ['seq', 'op', 'montage'] : op === 'cancel' || op === 'release' ? ['seq', 'op', 'slot'] : op === 'preview-seek' ? ['seq', 'op', 'slot', 'section', 'tick'] : ['seq', 'op'];
        const x = fields(raw, keys);
        driverInt(x.seq, 'command seq', 1, 1e9);
        if (x.seq <= previous)
            performanceReject('commands strictly increasing');
        previous = x.seq;
        if (op === 'play')
            ref(x.montage, config.montages);
        else if (op === 'release' || op === 'cancel' || op === 'preview-seek') {
            ref(x.slot, config.slots);
            if (op === 'preview-seek') {
                stable(x.section);
                driverInt(x.tick, 'seek relative tick', 0, 1e7);
            }
        }
        else if (op !== 'pause' && op !== 'resume')
            performanceReject('command operation');
    }
    return value as AnimationPerformanceCommand3D;
}
export function validateAnimationPerformancePlayback3D(config: AnimationPerformance3D, value: unknown): AnimationPerformancePlayback3D {
    validateAnimationPerformance3D(config);
    validateDriverTree(value);
    const p = fields(value, ['type', 'version', 'configIdentity', 'actorId', 'tick', 'paused', 'lastCommandSeq', 'nextInstance', 'slots', 'events']);
    if (p.type !== 'AnimationPerformancePlayback3D' || p.version !== 1)
        performanceReject('playback envelope/version');
    const id = fields(p.configIdentity, ['canonical', 'fnv']), expected = performanceIdentity(config);
    if (id.canonical !== expected.canonical || id.fnv !== expected.fnv)
        performanceReject('configuration identity');
    text(p.actorId);
    driverInt(p.tick, 'host tick', 0, 1e9);
    driverInt(p.lastCommandSeq, 'last command', 0, 1e9);
    driverInt(p.nextInstance, 'next instance', 1, 1e9);
    if (typeof p.paused !== 'boolean')
        performanceReject('paused boolean');
    const active = driverFields(p.slots, Object.keys(config.slots), 'active slots'), instances = new Set();
    for (const [slot, raw] of Object.entries(active)) {
        const s = fields(raw, ['montage', 'instance', 'sectionIndex', 'cursorTick', 'cycle', 'started', 'phase', 'weightQ', 'blendElapsedTicks', 'blendFromWeightQ', 'outgoing'], ['montage', 'instance', 'sectionIndex', 'cursorTick', 'cycle', 'started', 'phase', 'weightQ', 'blendElapsedTicks', 'blendFromWeightQ']);
        ref(s.montage, config.montages);
        const m = config.montages[s.montage];
        if (m.slot !== slot)
            performanceReject('slot ownership');
        driverInt(s.instance, 'instance', 1, (p.nextInstance as number) - 1);
        if (instances.has(s.instance))
            performanceReject('duplicate instance');
        instances.add(s.instance);
        driverInt(s.sectionIndex, 'section index', 0, m.sections.length - 1);
        const section = m.sections[s.sectionIndex];
        driverInt(s.cursorTick, 'cursor', 0, section.endTick - section.startTick);
        driverInt(s.cycle, 'cycle', 0, 1e9);
        if (typeof s.started !== 'boolean' || (!s.started && (s.cursorTick !== 0 || s.cycle !== 0)))
            performanceReject('unstarted cursor');
        if (s.phase !== 'playing' && s.phase !== 'blend-out')
            performanceReject('phase');
        driverInt(s.weightQ, 'weight', 0, config.slots[slot].weightQ);
        driverInt(s.blendFromWeightQ, 'blend source', 0, config.slots[slot].weightQ);
        driverInt(s.blendElapsedTicks, 'blend elapsed', 0, s.phase === 'playing' ? m.blendInTicks : m.blendOutTicks);
        if (section.mode === 'once' && s.cycle !== 0)
            performanceReject('once section cycle');
        if (section.mode === 'hold' && s.cursorTick === section.endTick - section.startTick)
            performanceReject('hold cursor wraps');
        if (s.outgoing !== undefined) {
            const o = fields(s.outgoing, ['montage', 'instance', 'sectionIndex', 'cursorTick', 'cycle', 'weightQ', 'fromWeightQ']);
            ref(o.montage, config.montages);
            const old = config.montages[o.montage];
            if (old.slot !== slot)
                performanceReject('outgoing slot ownership');
            driverInt(o.instance, 'outgoing instance', 1, (p.nextInstance as number) - 1);
            if (instances.has(o.instance) || (o.instance as number) >= (s.instance as number))
                performanceReject('outgoing instance identity');
            instances.add(o.instance);
            driverInt(o.sectionIndex, 'outgoing section', 0, old.sections.length - 1);
            const sec = old.sections[o.sectionIndex];
            driverInt(o.cursorTick, 'outgoing cursor', 0, sec.endTick - sec.startTick);
            driverInt(o.cycle, 'outgoing cycle', 0, 1e9);
            if (sec.mode === 'once' && o.cycle !== 0)
                performanceReject('outgoing once cycle');
            if (sec.mode === 'hold' && o.cursorTick === sec.endTick - sec.startTick)
                performanceReject('outgoing hold cursor wraps');
            driverInt(o.fromWeightQ, 'outgoing source weight', 1, config.slots[slot].weightQ);
            driverInt(o.weightQ, 'outgoing weight', 1, o.fromWeightQ);
            const duration = s.phase === 'playing' ? m.blendInTicks : m.blendOutTicks;
            if (!duration || o.weightQ !== Math.floor((o.fromWeightQ as number) * (duration - (s.blendElapsedTicks as number)) / duration))
                performanceReject('outgoing fade identity');
            if ((o.weightQ as number) + (s.weightQ as number) > config.slots[slot].weightQ)
                performanceReject('slot composite weight');
        }
        if (s.phase === 'playing') {
            if (!s.started && s.blendElapsedTicks !== 0)
                performanceReject('unstarted blend progress');
            if (s.blendFromWeightQ !== 0)
                performanceReject('entry blend source');
            const expected = m.blendInTicks === 0 ? config.slots[slot].weightQ : Math.floor(config.slots[slot].weightQ * (s.blendElapsedTicks as number) / m.blendInTicks);
            if (s.weightQ !== expected)
                performanceReject('entry weight identity');
        }
        else {
            if (m.blendOutTicks === 0 || (s.blendElapsedTicks as number) >= m.blendOutTicks)
                performanceReject('completed/zero-duration exit must clear slot');
            if (s.weightQ !== Math.floor((s.blendFromWeightQ as number) * (m.blendOutTicks - (s.blendElapsedTicks as number)) / m.blendOutTicks))
                performanceReject('exit weight identity');
        }
    }
    if (!Array.isArray(p.events) || p.events.length > PERFORMANCE_MAX_EVENTS)
        performanceReject('event budget');
    const ids = new Set();
    for (const raw of p.events) {
        const e = fields(raw, ['id', 'actorId', 'kind', 'slot', 'montage', 'instance', 'sectionIndex', 'cycle', 'atTick', 'cueId', 'commandSeq', 'reason'], ['id', 'actorId', 'kind', 'slot', 'montage', 'instance', 'sectionIndex', 'cycle', 'atTick']);
        if (e.actorId !== p.actorId || !['notify', 'section', 'complete', 'interrupted', 'blocked'].includes(e.kind as string))
            performanceReject('event actor/kind');
        ref(e.slot, config.slots);
        ref(e.montage, config.montages);
        const m = config.montages[e.montage];
        if (m.slot !== e.slot)
            performanceReject('event slot');
        driverInt(e.instance, 'event instance', e.kind === 'blocked' ? 0 : 1, (p.nextInstance as number) - 1);
        driverInt(e.sectionIndex, 'event section', 0, m.sections.length - 1);
        driverInt(e.cycle, 'event cycle', 0, 1e9);
        const section = m.sections[e.sectionIndex];
        driverInt(e.atTick, 'event tick', section.startTick, section.endTick);
        if (e.commandSeq !== undefined)
            driverInt(e.commandSeq, 'event command', 1, p.lastCommandSeq as number);
        if ((e.kind === 'interrupted' || e.kind === 'blocked') !== (e.commandSeq !== undefined))
            performanceReject('event command provenance');
        if (e.kind === 'blocked') {
            if (e.instance !== 0 || !['priority', 'transition-busy'].includes(e.reason as string) || e.commandSeq === undefined)
                performanceReject('blocked decision identity');
        }
        else if (e.reason !== undefined)
            performanceReject('unexpected reason');
        if (e.kind === 'section' && e.atTick !== section.startTick)
            performanceReject('section boundary');
        if (e.kind === 'notify') {
            ref(e.cueId, Object.fromEntries((config.clips[section.clip].notifies ?? []).map(n => [n.id, n.atTick])));
            if (!(config.clips[section.clip].notifies ?? []).some(n => n.id === e.cueId && n.atTick === e.atTick))
                performanceReject('notify source identity');
        }
        else if (e.cueId !== undefined)
            performanceReject('only notify can name cue');
        if (e.id !== performanceEventId(e as unknown as Omit<PerformanceEvent, 'id'>) || ids.has(e.id))
            performanceReject('event identity/duplicate');
        ids.add(e.id);
    }
    if (p.paused && (p.events as unknown[]).some(e => (e as PerformanceEvent).kind === 'notify'))
        performanceReject('paused cue');
    return value as AnimationPerformancePlayback3D;
}
const event = t.obj({ id: t.str(), actorId: t.str(), kind: t.enum(['notify', 'section', 'complete', 'interrupted', 'blocked']), slot: t.str(), montage: t.str(), instance: t.num(), sectionIndex: t.num(), cycle: t.num(), atTick: t.num(), cueId: t.opt(t.str()), commandSeq: t.opt(t.num()), reason: t.opt(t.enum(['priority', 'transition-busy'])) });
export const ANIMATION_PERFORMANCE_SCHEMAS = {
    AnimationPerformance3D: t.obj({ version: t.lit(1), tickRate: t.num(), clips: t.rec(t.obj({ asset: t.asset('skeletal-animation'), clipName: t.str(), sourceSha256: t.str(), retarget: t.enum(['exact', 'humanoid']), durationTicks: t.num(), notifies: t.opt(t.arr(t.obj({ id: t.str(), atTick: t.num() }))) })), slots: t.rec(t.obj({ order: t.num(), mode: t.enum(['override', 'additive']), bones: t.arr(t.str()), weightQ: t.num(), reference: t.opt(t.obj({ clip: t.str(), atTick: t.num() })) })), montages: t.rec(t.obj({ slot: t.str(), priority: t.num(), blendInTicks: t.num(), blendOutTicks: t.num(), sections: t.arr(t.obj({ id: t.str(), clip: t.str(), startTick: t.num(), endTick: t.num(), mode: t.enum(['once', 'hold']) })) })) }),
    AnimationPerformanceCommand3D: t.obj({ version: t.lit(1), commands: t.arr(t.union([t.obj({ seq: t.num(), op: t.lit('play'), montage: t.str() }), t.obj({ seq: t.num(), op: t.lit('release'), slot: t.str() }), t.obj({ seq: t.num(), op: t.lit('cancel'), slot: t.str() }), t.obj({ seq: t.num(), op: t.lit('pause') }), t.obj({ seq: t.num(), op: t.lit('resume') }), t.obj({ seq: t.num(), op: t.lit('preview-seek'), slot: t.str(), section: t.str(), tick: t.num() })], 'op')) }),
    AnimationPerformancePlayback3D: t.obj({ version: t.lit(1), configIdentity: t.obj({ canonical: t.str(), fnv: t.num() }), actorId: t.str(), tick: t.num(), paused: t.bool(), lastCommandSeq: t.num(), nextInstance: t.num(), slots: t.rec(t.obj({ montage: t.str(), instance: t.num(), sectionIndex: t.num(), cursorTick: t.num(), cycle: t.num(), started: t.bool(), phase: t.enum(['playing', 'blend-out']), weightQ: t.num(), blendElapsedTicks: t.num(), blendFromWeightQ: t.num(), outgoing: t.opt(t.obj({ montage: t.str(), instance: t.num(), sectionIndex: t.num(), cursorTick: t.num(), cycle: t.num(), weightQ: t.num(), fromWeightQ: t.num() })) })), events: t.arr(event) })
} as const;
