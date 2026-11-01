import type { LocomotionMotorFacts } from './locomotion-facts.js';
export type { LocomotionMotorFacts } from './locomotion-facts.js';
/** D2b pure composition candidate; no motor, renderer or asset-measurement side effects.
 * normalized-reference preserves the original strict equal-stride path.
 * weighted-measured converts actual distance using the reviewed member strides,
 * a fixed micro-reference-Q carry, and a serialized conservative loss bound.
 * Neither policy measures assets or approves calibration metadata.
 */
import { createWeightedGaitDistance, stepWeightedGaitDistance, type WeightedGaitDistanceState } from './weighted-gait-distance.js';
import { compileBlendSpace2D, evaluateBlendSpace2D, type BlendSpaceDefinition2D, type CompiledBlendSpace2D } from './blend-space-2d.js';
import { createGaitPhaseGroup, startGaitPhaseGroup, GAIT_MAX_EVENTS, stepGaitPhaseGroup, projectGaitPhaseGroup, seekGaitPhaseGroup, validateGaitPhaseGroup, validateGaitPhaseState, type GaitPhaseGroupV1, type GaitPhaseStateV1, type GaitPlantEvent } from './gait-phase.js';
export const LOCOMOTION_STATES = ['idle', 'start', 'move', 'stop', 'turn-positive', 'turn-negative', 'crouch-in', 'crouched-idle', 'crouched-move', 'crouch-out', 'jump-start', 'rising', 'falling', 'land', 'recover'] as const;
export type LocomotionStateId = typeof LOCOMOTION_STATES[number];
const TRANSIENT = new Set<LocomotionStateId>(['start', 'stop', 'turn-positive', 'turn-negative', 'crouch-in', 'crouch-out', 'jump-start', 'land', 'recover']);
const Q = 1000000, SUB = 1000, LIMIT = 1000000000;
export interface LocomotionClip {
    readonly asset: string;
    readonly clipName: string;
    readonly loop: boolean;
    readonly durationTicks: number;
    readonly sourceSha256: string;
    readonly motionSpace: 'in-place';
    readonly sync: 'gait' | 'free';
}
export interface LocomotionStateSpec {
    readonly node: {
        readonly kind: 'clip';
        readonly clip: string;
    } | {
        readonly kind: 'blend2d';
        readonly space: 'standing' | 'crouched';
    };
    readonly minTicks: number;
    readonly interruptible: boolean;
    readonly restartOnEnter: boolean;
    readonly onComplete: 'stay' | 'motor' | LocomotionStateId;
}
export interface LocomotionDriver3D {
    readonly type: 'LocomotionDriver3D';
    readonly version: 1;
    readonly tickRate: number;
    readonly localAxes: {
        readonly up: 'Y';
        readonly forward: '+Z';
        readonly lateral: '+X';
    };
    readonly stridePolicy: 'normalized-reference' | 'weighted-measured';
    readonly thresholds: {
        readonly moveEnterQps: number;
        readonly moveExitQps: number;
        readonly turnEnterUnits: number;
        readonly turnExitUnits: number;
    };
    readonly clips: Readonly<Record<string, LocomotionClip>>;
    readonly states: Readonly<Record<LocomotionStateId, LocomotionStateSpec>>;
    readonly spaces: {
        readonly standing: BlendSpaceDefinition2D;
        readonly crouched: BlendSpaceDefinition2D;
    };
    readonly gait: GaitPhaseGroupV1;
}
export type LocomotionCommand = {
    readonly seq: number;
    readonly op: 'pause';
} | {
    readonly seq: number;
    readonly op: 'resume';
} | {
    readonly seq: number;
    readonly op: 'preview-seek';
    readonly state: LocomotionStateId;
    readonly tick: number;
    readonly phaseQ: number;
    readonly cycle: number;
};
export interface LocomotionPlayback {
    readonly version: 1;
    readonly configCanonical: string;
    readonly tick: number;
    readonly lastFactsSeq: number;
    readonly lastCommandSeq: number;
    readonly paused: boolean;
    readonly state: LocomotionStateId;
    readonly stateTicks: number;
    readonly stateInstance: number;
    readonly nextInstance: number;
    readonly seenJumpInstance: number;
    readonly seenLandingInstance: number;
    readonly lastStance: LocomotionMotorFacts['stance'];
    readonly stopLatched: boolean;
    readonly cursors: Readonly<Record<string, {
        readonly timeSubticks: number;
        readonly cycle: number;
    }>>;
    readonly weightsQ: Readonly<Record<string, number>>;
    readonly gait: GaitPhaseStateV1;
    /** Only weighted-measured snapshots contain this field; normalized v1 bytes stay compatible. */
    readonly distanceAdapter?: WeightedGaitDistanceState;
}
type Mutable<T> = {
    -readonly [P in keyof T]: T[P] extends object ? Mutable<T[P]> : T[P];
};
function reject(s: string): never { throw new Error(`LocomotionDriver3D: ${s}`); }
function tree(v: unknown): void {
    let n = 0;
    const seen = new WeakSet<object>();
    function walk(x: unknown, d: number): void {
        if (++n > 100000 || d > 20)
            reject('data budget');
        if (typeof x === 'number') {
            if (!Number.isFinite(x))
                reject('finite data required');
            return;
        }
        if (typeof x === 'string') {
            if (x.length > 1000000)
                reject('string budget');
            return;
        }
        if (x === null || typeof x === 'boolean')
            return;
        if (!x || typeof x !== 'object')
            reject('JSON data required');
        if (seen.has(x))
            reject('shared/cyclic data');
        seen.add(x);
        const names = Object.getOwnPropertyNames(x), keys = Object.keys(x);
        if (Object.getOwnPropertySymbols(x).length)
            reject('symbol data');
        if (Array.isArray(x)) {
            if (Object.getPrototypeOf(x) !== Array.prototype || x.length > 4096 || names.length !== x.length + 1 || keys.length !== x.length)
                reject('dense array required');
            for (let i = 0; i < x.length; i++)
                if (!Object.hasOwn(x, String(i)))
                    reject('sparse array');
        }
        else if (![Object.prototype, null].includes(Object.getPrototypeOf(x)) || names.length !== keys.length)
            reject('plain enumerable data required');
        for (const k of keys) {
            if (['__proto__', 'constructor', 'prototype'].includes(k))
                reject('unsafe field');
            const q = Object.getOwnPropertyDescriptor(x, k)!;
            if (!('value' in q))
                reject('accessor');
            walk(q.value, d + 1);
        }
    }
    walk(v, 0);
}
function fields(v: unknown, keys: readonly string[], label: string): Record<string, unknown> {
    if (!v || typeof v !== 'object' || Array.isArray(v))
        reject(`${label} object`);
    const r = v as Record<string, unknown>;
    if (Object.keys(r).length !== keys.length || keys.some(k => !Object.hasOwn(r, k)))
        reject(`${label} closed fields`);
    return r;
}
function int(v: unknown, label: string, min = 0, max = LIMIT): asserts v is number {
    if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < min || v > max || Object.is(v, -0))
        reject(`${label} integer ${min}..${max}`);
}
function bool(v: unknown): asserts v is boolean {
    if (typeof v !== 'boolean')
        reject('boolean required');
}
function text(v: unknown): asserts v is string {
    if (typeof v !== 'string' || !v.trim() || v.length > 256 || /[\u0000-\u001f]/u.test(v))
        reject('bounded text required');
}
function alias(v: unknown): asserts v is string {
    if (typeof v !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(v))
        reject('stable alias');
}
function stateId(v: unknown): asserts v is LocomotionStateId {
    if (!LOCOMOTION_STATES.includes(v as LocomotionStateId))
        reject('unknown state');
}
function canonical(v: unknown): string {
    if (v === null || typeof v !== 'object')
        return JSON.stringify(v);
    if (Array.isArray(v))
        return '[' + v.map(canonical).join(',') + ']';
    const r = v as Record<string, unknown>;
    return '{' + Object.keys(r).sort().map(k => JSON.stringify(k) + ':' + canonical(r[k])).join(',') + '}';
}
const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
function freeze<T>(v: T): T {
    if (v && typeof v === 'object') {
        for (const x of Object.values(v))
            freeze(x);
        Object.freeze(v);
    }
    return v;
}
function validate(raw: unknown): LocomotionDriver3D {
    tree(raw);
    const d = fields(raw, ['type', 'version', 'tickRate', 'localAxes', 'stridePolicy', 'thresholds', 'clips', 'states', 'spaces', 'gait'], 'config');
    if (d.type !== 'LocomotionDriver3D' || d.version !== 1)
        reject('version/type');
    int(d.tickRate, 'tickRate', 1, 240);
    const axes = fields(d.localAxes, ['up', 'forward', 'lateral'], 'axes');
    if (axes.up !== 'Y' || axes.forward !== '+Z' || axes.lateral !== '+X')
        reject('explicit local axes required');
    if (d.stridePolicy !== 'normalized-reference' && d.stridePolicy !== 'weighted-measured')
        reject('unsupported stride policy');
    const ts = fields(d.thresholds, ['moveEnterQps', 'moveExitQps', 'turnEnterUnits', 'turnExitUnits'], 'thresholds');
    int(ts.moveEnterQps, 'move enter', 1);
    int(ts.moveExitQps, 'move exit', 0, ts.moveEnterQps);
    int(ts.turnEnterUnits, 'turn enter', 1, 32768);
    int(ts.turnExitUnits, 'turn exit', 0, ts.turnEnterUnits);
    if (!d.clips || typeof d.clips !== 'object' || Array.isArray(d.clips))
        reject('clips');
    const clips = d.clips as Record<string, LocomotionClip>;
    if (Object.keys(clips).length < 1 || Object.keys(clips).length > 64)
        reject('clip budget');
    for (const [id, rawClip] of Object.entries(clips)) {
        alias(id);
        const c = fields(rawClip, ['asset', 'clipName', 'loop', 'durationTicks', 'sourceSha256', 'motionSpace', 'sync'], 'clip');
        text(c.asset);
        text(c.clipName);
        bool(c.loop);
        int(c.durationTicks, 'durationTicks', 1, 10000000);
        if (typeof c.sourceSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(c.sourceSha256))
            reject('clip source SHA');
        if (c.motionSpace !== 'in-place')
            reject('paired in-place clip required; root translation is not consumed here');
        if (c.sync !== 'gait' && c.sync !== 'free')
            reject('clip sync');
    }
    const states = fields(d.states, LOCOMOTION_STATES, 'states') as unknown as Record<LocomotionStateId, LocomotionStateSpec>;
    for (const id of LOCOMOTION_STATES) {
        const s = fields(states[id], ['node', 'minTicks', 'interruptible', 'restartOnEnter', 'onComplete'], 'state');
        int(s.minTicks, 'minimum ticks', 0, 36000);
        bool(s.interruptible);
        bool(s.restartOnEnter);
        const node = s.node as any;
        if (node?.kind === 'clip') {
            fields(node, ['kind', 'clip'], 'clip node');
            if (typeof node.clip !== 'string' || !Object.hasOwn(clips, node.clip))
                reject('state clip reference');
            if (clips[node.clip].sync !== 'free')
                reject('standalone states require free clip clocks');
            if (TRANSIENT.has(id) && (clips[node.clip].loop || !s.restartOnEnter || s.onComplete === 'stay' || s.minTicks > clips[node.clip].durationTicks))
                reject('once-state explicit completion/restart required');
        }
        else if (node?.kind === 'blend2d') {
            fields(node, ['kind', 'space'], 'blend node');
            if ((id !== 'move' && id !== 'crouched-move') || node.space !== (id === 'move' ? 'standing' : 'crouched'))
                reject('blend state/space mismatch');
            if (s.restartOnEnter)
                reject('shared blend phase must not reset');
        }
        else
            reject('closed node required');
        if (id === 'move' || id === 'crouched-move') {
            if (node.kind !== 'blend2d' || s.onComplete !== 'stay')
                reject('moving states require continuous 2D spaces');
        }
        else if (node.kind !== 'clip')
            reject('non-move state clip required');
        if (s.onComplete !== 'stay' && s.onComplete !== 'motor') {
            stateId(s.onComplete);
            if (s.onComplete === id)
                reject('completion cannot return to itself');
        }
        if (!TRANSIENT.has(id) && s.onComplete !== 'stay')
            reject('persistent states must stay until motor transition');
    }
    fields(d.spaces, ['standing', 'crouched'], 'spaces');
    const cfg = d as unknown as LocomotionDriver3D;
    const used = new Set<string>();
    for (const space of [cfg.spaces.standing, cfg.spaces.crouched]) {
        const compiled = compileBlendSpace2D(space);
        for (const sample of compiled.canonical.samples) {
            if (!Object.hasOwn(clips, sample.clip) || !clips[sample.clip].loop)
                reject('blend clip must exist and loop');
            used.add(sample.clip);
        }
    }
    validateGaitPhaseGroup(cfg.gait);
    for (const [id, c] of Object.entries(clips)) {
        if (c.sync === 'gait') {
            const m = cfg.gait.members[id];
            if (!m || !used.has(id) || !c.loop || m.sourceSha256 !== c.sourceSha256 || m.durationSubticks !== c.durationTicks * SUB)
                reject('gait binding/SHA/duration mismatch');
            if (cfg.stridePolicy === 'normalized-reference' && m.strideDistanceQ !== cfg.gait.referenceStrideDistanceQ)
                reject('stride-incompatible: normalized reference requires real reviewed equal strides');
        }
        else if (Object.hasOwn(cfg.gait.members, id))
            reject('free clip must not claim gait calibration');
    }
    for (const id of Object.keys(cfg.gait.members))
        if (!Object.hasOwn(clips, id) || clips[id].sync !== 'gait')
            reject('unknown gait member');
    return cfg;
}
export function validateLocomotionDriver3D(raw: unknown): LocomotionDriver3D { return validate(raw); }
function facts(raw: unknown): LocomotionMotorFacts {
    tree(raw);
    const f = fields(raw, ['seq', 'localLateralQps', 'localForwardQps', 'acceptedDistanceQ', 'desiredSpeedQps', 'mode', 'stance', 'yawErrorUnits', 'jumpInstance', 'landingInstance'], 'facts');
    int(f.seq, 'facts sequence', 1);
    int(f.localLateralQps, 'lateral', -LIMIT);
    int(f.localForwardQps, 'forward', -LIMIT);
    int(f.acceptedDistanceQ, 'distance');
    int(f.desiredSpeedQps, 'desired speed');
    int(f.yawErrorUnits, 'yaw error', -32768, 32768);
    int(f.jumpInstance, 'jump instance');
    int(f.landingInstance, 'landing instance');
    if (!['grounded', 'rising', 'falling'].includes(f.mode as string) || !['standing', 'crouch-in', 'crouched', 'crouch-out'].includes(f.stance as string))
        reject('motor mode/stance');
    return f as unknown as LocomotionMotorFacts;
}
function commands(raw: unknown): readonly LocomotionCommand[] {
    tree(raw);
    if (!Array.isArray(raw) || raw.length > 64)
        reject('command budget');
    let seq = 0;
    for (const c of raw) {
        fields(c, c?.op === 'preview-seek' ? ['seq', 'op', 'state', 'tick', 'phaseQ', 'cycle'] : ['seq', 'op'], 'command');
        int(c.seq, 'command seq', 1);
        if (c.seq <= seq)
            reject('command sequences strictly increasing');
        seq = c.seq;
        if (c.op === 'preview-seek') {
            stateId(c.state);
            int(c.tick, 'seek tick', 0, 10000000);
            int(c.phaseQ, 'seek phase', 0, Q - 1);
            int(c.cycle, 'seek cycle');
        }
        else if (c.op !== 'pause' && c.op !== 'resume')
            reject('command op');
    }
    return raw;
}
class CompiledLocomotion {
    readonly configuration: LocomotionDriver3D;
    readonly #identity: string;
    readonly #standing: CompiledBlendSpace2D;
    readonly #crouched: CompiledBlendSpace2D;
    constructor(raw: unknown) { const c = validate(raw); this.#standing = compileBlendSpace2D(c.spaces.standing); this.#crouched = compileBlendSpace2D(c.spaces.crouched); const normalized = { ...c, spaces: { standing: this.#standing.canonical, crouched: this.#crouched.canonical } }; this.configuration = freeze(copy(normalized)); this.#identity = canonical(normalized); Object.freeze(this); }
    assertBrand(): void { void this.#identity; if (Object.getPrototypeOf(this) !== CompiledLocomotion.prototype)
        reject('invalid compiled prototype'); }
    create(instance = 1): LocomotionPlayback {
        CompiledLocomotion.prototype.assertBrand.call(this);
        int(instance, 'gait instance', 1);
        const c = this.configuration;
        const p: Mutable<LocomotionPlayback> = { version: 1, configCanonical: this.#identity, tick: 0, lastFactsSeq: 0, lastCommandSeq: 0, paused: false, state: 'idle', stateTicks: 0, stateInstance: 1, nextInstance: 2, seenJumpInstance: 0, seenLandingInstance: 0, lastStance: 'standing', stopLatched: false, cursors: Object.fromEntries(Object.keys(c.clips).sort().map(a => [a, { timeSubticks: 0, cycle: 0 }])), weightsQ: Object.fromEntries(Object.keys(c.clips).sort().map(a => [a, 0])), gait: copy(createGaitPhaseGroup(c.gait, instance)), ...(c.stridePolicy === 'weighted-measured' ? { distanceAdapter: copy(createWeightedGaitDistance(c.gait)) } : {}) };
        const n = c.states.idle.node;
        if (n.kind !== 'clip')
            reject('idle clip required');
        p.weightsQ[n.clip] = Q;
        return p;
    }
    validateState(raw: unknown): LocomotionPlayback {
        CompiledLocomotion.prototype.assertBrand.call(this);
        tree(raw);
        const p = fields(raw, ['version', 'configCanonical', 'tick', 'lastFactsSeq', 'lastCommandSeq', 'paused', 'state', 'stateTicks', 'stateInstance', 'nextInstance', 'seenJumpInstance', 'seenLandingInstance', 'lastStance', 'stopLatched', 'cursors', 'weightsQ', 'gait', ...(this.configuration.stridePolicy === 'weighted-measured' ? ['distanceAdapter'] : [])], 'playback');
        if (p.version !== 1 || p.configCanonical !== this.#identity)
            reject('snapshot config identity/version');
        stateId(p.state);
        for (const n of ['tick', 'lastFactsSeq', 'lastCommandSeq', 'stateTicks', 'seenJumpInstance', 'seenLandingInstance'] as const)
            int(p[n], n);
        int(p.stateInstance, 'state instance', 1);
        int(p.nextInstance, 'next instance', 2);
        if (p.stateInstance >= p.nextInstance)
            reject('state instance order');
        bool(p.paused);
        bool(p.stopLatched);
        if (!['standing', 'crouch-in', 'crouched', 'crouch-out'].includes(p.lastStance as string))
            reject('snapshot stance');
        const c = this.configuration, aliases = Object.keys(c.clips);
        const cursors = fields(p.cursors, aliases, 'cursors'), weights = fields(p.weightsQ, aliases, 'weights');
        let sum = 0;
        for (const a of aliases) {
            const cur = fields(cursors[a], ['timeSubticks', 'cycle'], 'cursor');
            int(cur.timeSubticks, 'cursor', 0, c.clips[a].durationTicks * SUB);
            int(cur.cycle, 'clip cycle');
            if (c.clips[a].loop && cur.timeSubticks === c.clips[a].durationTicks * SUB)
                reject('loop cursor half-open');
            if (!c.clips[a].loop && cur.cycle !== 0)
                reject('once clip cycle');
            int(weights[a], 'weight', 0, Q);
            sum += weights[a] as number;
        }
        if (sum !== Q)
            reject('weights sum must be one');
        validateGaitPhaseState(c.gait, p.gait);
        if (c.stridePolicy === 'weighted-measured') {
            // The adapter is pure: an inactive zero-distance call validates its
            // full identity and budgets; its returned tick is deliberately discarded.
            stepWeightedGaitDistance(c.gait, p.distanceAdapter as WeightedGaitDistanceState, {}, 0);
        }
        const spec = c.states[p.state], node = spec.node;
        if (node.kind === 'clip' && aliases.some(a => weights[a] !== (a === node.clip ? Q : 0)))
            reject('state weight binding');
        if (node.kind === 'blend2d') {
            const allowed = new Set((node.space === 'standing' ? this.#standing : this.#crouched).canonical.samples.map(s => s.clip));
            if (aliases.some(a => !allowed.has(a) && (weights[a] as number) > 0))
                reject('blend weight alias binding');
        }
        return p as unknown as LocomotionPlayback;
    }
    private base(f: LocomotionMotorFacts, p: LocomotionPlayback): LocomotionStateId {
        if (f.mode !== 'grounded')
            return f.mode;
        const c = this.configuration, threshold = (['move', 'crouched-move', 'start', 'stop'].includes(p.state)) ? c.thresholds.moveExitQps : c.thresholds.moveEnterQps;
        const moving = BigInt(f.localLateralQps) ** 2n + BigInt(f.localForwardQps) ** 2n > BigInt(threshold) ** 2n;
        return f.stance === 'crouched' || f.stance === 'crouch-in' ? (moving ? 'crouched-move' : 'crouched-idle') : (moving ? 'move' : 'idle');
    }
    private complete(p: LocomotionPlayback): boolean { const spec = this.configuration.states[p.state]; return spec.node.kind === 'clip' && !this.configuration.clips[spec.node.clip].loop && p.cursors[spec.node.clip].timeSubticks === this.configuration.clips[spec.node.clip].durationTicks * SUB; }
    private enter(p: Mutable<LocomotionPlayback>, target: LocomotionStateId): void {
        const spec = this.configuration.states[target];
        if (p.nextInstance >= LIMIT)
            reject('state instance budget');
        p.state = target;
        p.stateTicks = 0;
        p.stateInstance = p.nextInstance++;
        if (spec.node.kind === 'clip' && spec.restartOnEnter)
            p.cursors[spec.node.clip] = { timeSubticks: 0, cycle: 0 };
        if (target === 'stop')
            p.stopLatched = true;
    }
    private select(p: LocomotionPlayback, f: LocomotionMotorFacts): LocomotionStateId {
        const spec = this.configuration.states[p.state], completed = this.complete(p), base = this.base(f, p);
        // Physical mode/impact always overrides cinematic minTicks and noninterruptibility.
        if (f.mode !== 'grounded') {
            if (f.mode === 'falling')
                return 'falling';
            if (f.jumpInstance > p.seenJumpInstance)
                return 'jump-start';
            if (p.state === 'jump-start' && !completed)
                return 'jump-start';
            return 'rising';
        }
        if (f.landingInstance > p.seenLandingInstance)
            return 'land';
        if ((f.stance === 'crouch-in' || f.stance === 'crouch-out') && f.stance !== p.lastStance)
            return f.stance;
        if (TRANSIENT.has(p.state)) {
            if (completed && p.stateTicks >= spec.minTicks) {
                if (spec.onComplete === 'motor')
                    return base;
                if (spec.onComplete !== 'stay')
                    return spec.onComplete;
            }
            if (p.stateTicks < spec.minTicks || !spec.interruptible)
                return p.state;
        }
        if (base === 'move' && p.state === 'idle' && f.desiredSpeedQps > this.configuration.thresholds.moveExitQps)
            return 'start';
        if (base === 'move' && f.desiredSpeedQps <= this.configuration.thresholds.moveExitQps && !p.stopLatched)
            return 'stop';
        if (base === 'idle' && f.desiredSpeedQps <= this.configuration.thresholds.moveExitQps) {
            const limit = p.state === 'turn-positive' || p.state === 'turn-negative' ? this.configuration.thresholds.turnExitUnits : this.configuration.thresholds.turnEnterUnits;
            if (Math.abs(f.yawErrorUnits) > limit)
                return f.yawErrorUnits > 0 ? 'turn-positive' : 'turn-negative';
        }
        return base;
    }
    private setWeights(p: Mutable<LocomotionPlayback>, f?: LocomotionMotorFacts): void {
        for (const a of Object.keys(p.weightsQ))
            p.weightsQ[a] = 0;
        const node = this.configuration.states[p.state].node;
        if (node.kind === 'clip')
            p.weightsQ[node.clip] = Q;
        else {
            if (!f)
                reject('blend seek requires previous weights or motor facts');
            const space = node.space === 'standing' ? this.#standing : this.#crouched;
            const projected = evaluateBlendSpace2D(space, { xQps: f.localLateralQps, yQps: f.localForwardQps });
            for (const [a, w] of Object.entries(projected.clips))
                p.weightsQ[a] = w;
        }
    }
    step(raw: unknown, input: unknown): {
        state: LocomotionPlayback;
        events: readonly GaitPlantEvent[];
    } {
        CompiledLocomotion.prototype.assertBrand.call(this);
        const previous = this.validateState(raw);
        tree(input);
        const data = fields(input, ['facts', 'commands'], 'step input');
        const f = facts(data.facts), ops = commands(data.commands);
        if (f.seq < previous.lastFactsSeq || f.jumpInstance < previous.seenJumpInstance || f.landingInstance < previous.seenLandingInstance)
            reject('stale motor facts');
        const p = copy(previous) as Mutable<LocomotionPlayback>;
        let controlled = false, changed = false;
        for (const op of ops) {
            if (op.seq <= p.lastCommandSeq)
                continue;
            p.lastCommandSeq = op.seq;
            changed = true;
            if (op.op === 'pause')
                p.paused = true;
            else if (op.op === 'resume')
                p.paused = false;
            else {
                this.enter(p, op.state);
                const node = this.configuration.states[p.state].node;
                if (node.kind === 'clip') {
                    const clip = this.configuration.clips[node.clip], total = op.tick * SUB, d = clip.durationTicks * SUB;
                    p.cursors[node.clip] = { timeSubticks: clip.loop ? total % d : Math.min(total, d), cycle: clip.loop ? Math.floor(total / d) : 0 };
                }
                p.stateTicks = op.tick;
                p.gait = copy(seekGaitPhaseGroup(this.configuration.gait, p.gait, { phaseQ: op.phaseQ, cycle: op.cycle }));
                // A preview seek starts at an explicit position: discard pre-seek
                // fractional distance, retain diagnostic history and adapter tick.
                if (p.distanceAdapter)
                    p.distanceAdapter = { ...p.distanceAdapter, referenceRemainderMicroQ: 0 };
                this.setWeights(p, f);
                controlled = true;
            }
        }
        const newFacts = f.seq > p.lastFactsSeq;
        if (newFacts) {
            p.lastFactsSeq = f.seq;
            changed = true;
        }
        if (!changed)
            return { state: copy(previous), events: [] };
        if (p.tick >= LIMIT)
            reject('tick budget');
        p.tick++;
        if (p.paused || controlled || !newFacts) {
            this.validateState(p);
            return { state: p, events: [] };
        }
        if (f.desiredSpeedQps > this.configuration.thresholds.moveEnterQps)
            p.stopLatched = false;
        const target = this.select(p, f);
        if (target !== p.state)
            this.enter(p, target);
        p.seenJumpInstance = f.jumpInstance;
        p.seenLandingInstance = f.landingInstance;
        p.lastStance = f.stance;
        this.setWeights(p, f);
        const c = this.configuration;
        const gaitWeights = Object.fromEntries(Object.keys(c.gait.members).map(a => [a, p.weightsQ[a]]));
        let referenceDistanceQ = f.acceptedDistanceQ;
        const startEvents: GaitPlantEvent[] = [];
        if (c.stridePolicy === 'weighted-measured') {
            referenceDistanceQ = 0;
            // Inactive/stop groups preserve carry and adapter tick, rather than
            // collecting unseen travel or issuing invisible plant events.
            if (Object.values(gaitWeights).some(w => w > 0)) {
                // Physical movement starts contact even if conversion has not
                // yet accumulated one integer reference-Q. Never fabricate 1Q.
                if (f.acceptedDistanceQ > 0) {
                    const started = startGaitPhaseGroup(c.gait, p.gait, gaitWeights);
                    p.gait = copy(started.state);
                    startEvents.push(...started.events);
                }
                const distance = stepWeightedGaitDistance(c.gait, p.distanceAdapter!, gaitWeights, f.acceptedDistanceQ);
                p.distanceAdapter = copy(distance.state);
                referenceDistanceQ = distance.referenceDistanceQ;
            }
        }
        const advanced = stepGaitPhaseGroup(c.gait, p.gait, { acceptedDistanceQ: referenceDistanceQ, weightsQ: gaitWeights });
        p.gait = copy(advanced.state);
        for (const [a, w] of Object.entries(p.weightsQ)) {
            if (!w || c.clips[a].sync === 'gait')
                continue;
            const cur = p.cursors[a], d = c.clips[a].durationTicks * SUB, total = cur.timeSubticks + SUB;
            if (c.clips[a].loop) {
                cur.timeSubticks = total % d;
                cur.cycle += Math.floor(total / d);
                if (cur.cycle > LIMIT)
                    reject('clip cycle budget');
            }
            else
                cur.timeSubticks = Math.min(total, d);
        }
        if (p.stateTicks >= LIMIT)
            reject('state clock budget');
        p.stateTicks++;
        const events = [...startEvents, ...advanced.events];
        if (events.length > GAIT_MAX_EVENTS) reject('plant event budget exceeded');
        this.validateState(p);
        return { state: p, events };
    }
    project(raw: unknown): {
        samples: Readonly<Record<string, {
            timeSeconds: number;
            weight: number;
        }>>;
    } { CompiledLocomotion.prototype.assertBrand.call(this); const p = this.validateState(raw), c = this.configuration, gait = projectGaitPhaseGroup(c.gait, p.gait); return { samples: Object.fromEntries(Object.keys(c.clips).sort().map(a => [a, { timeSeconds: (c.clips[a].sync === 'gait' ? gait.samples[a].timeSubticks : p.cursors[a].timeSubticks) / (SUB * c.tickRate), weight: p.weightsQ[a] / Q }])) }; }
}
Object.freeze(CompiledLocomotion.prototype);
export type CompiledLocomotionDriver = CompiledLocomotion;
export function compileLocomotionDriver3D(raw: unknown): CompiledLocomotionDriver { return new CompiledLocomotion(raw); }
export function createLocomotionDriver(compiled: CompiledLocomotionDriver, instance = 1): LocomotionPlayback { return CompiledLocomotion.prototype.create.call(compiled, instance); }
export function stepLocomotionDriver(compiled: CompiledLocomotionDriver, state: LocomotionPlayback, input: {
    readonly facts: LocomotionMotorFacts;
    readonly commands: readonly LocomotionCommand[];
}): {
    state: LocomotionPlayback;
    events: readonly GaitPlantEvent[];
} { return CompiledLocomotion.prototype.step.call(compiled, state, input); }
export function projectLocomotionDriver(compiled: CompiledLocomotionDriver, state: LocomotionPlayback): {
    samples: Readonly<Record<string, {
        timeSeconds: number;
        weight: number;
    }>>;
} { return CompiledLocomotion.prototype.project.call(compiled, state); }
