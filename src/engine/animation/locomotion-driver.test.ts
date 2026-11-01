import { describe, it, expect } from 'vitest';
import { LOCOMOTION_STATES, compileLocomotionDriver3D, createLocomotionDriver, stepLocomotionDriver, projectLocomotionDriver, type LocomotionDriver3D, type LocomotionStateSpec, type LocomotionMotorFacts, type LocomotionPlayback, type LocomotionCommand } from './locomotion-driver.js';
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
function fixture(): LocomotionDriver3D {
    const once = new Set(['start', 'stop', 'turn-positive', 'turn-negative', 'crouch-in', 'crouch-out', 'jump-start', 'land', 'recover']);
    const clips: any = {}, states: any = {};
    for (const id of LOCOMOTION_STATES) {
        if (id === 'move' || id === 'crouched-move') {
            states[id] = { node: { kind: 'blend2d', space: id === 'move' ? 'standing' : 'crouched' }, minTicks: 0, interruptible: true, restartOnEnter: false, onComplete: 'stay' };
            continue;
        }
        clips[id] = { asset: `asset-${id}`, clipName: `synthetic-${id}`, loop: !once.has(id), durationTicks: 2, sourceSha256: 'a'.repeat(64), motionSpace: 'in-place', sync: 'free' };
        states[id] = { node: { kind: 'clip', clip: id }, minTicks: once.has(id) ? 1 : 0, interruptible: false, restartOnEnter: once.has(id), onComplete: once.has(id) ? id === 'land' ? 'recover' : 'motor' : 'stay' };
    }
    const members: any = {};
    for (const id of ['N', 'E', 'S', 'W']) {
        clips[id] = { asset: `motion-${id}`, clipName: id, loop: true, durationTicks: 4, sourceSha256: 'b'.repeat(64), motionSpace: 'in-place', sync: 'gait' };
        members[id] = { durationSubticks: 4000, markers: [{ id: 'L', atSubtick: 0 }, { id: 'R', atSubtick: 2000 }], strideDistanceQ: 100, sourceSha256: 'b'.repeat(64), calibrationStatus: 'reviewed', provenance: 'Synthetic explicit +Z/+X calibration; not a real measured clip.' };
    }
    const space = (idle: string) => ({ samples: [{ id: 'O', clip: idle, xQps: 0, yQps: 0 }, { id: 'N', clip: 'N', xQps: 0, yQps: 100 }, { id: 'E', clip: 'E', xQps: 100, yQps: 0 }, { id: 'S', clip: 'S', xQps: 0, yQps: -100 }, { id: 'W', clip: 'W', xQps: -100, yQps: 0 }], triangles: [{ id: 'a', vertices: ['O', 'E', 'N'] as const }, { id: 'b', vertices: ['O', 'N', 'W'] as const }, { id: 'c', vertices: ['O', 'W', 'S'] as const }, { id: 'd', vertices: ['O', 'S', 'E'] as const }] });
    return { type: 'LocomotionDriver3D', version: 1, tickRate: 30, localAxes: { up: 'Y', forward: '+Z', lateral: '+X' }, stridePolicy: 'normalized-reference', thresholds: { moveEnterQps: 10, moveExitQps: 5, turnEnterUnits: 1000, turnExitUnits: 500 }, clips, states, spaces: { standing: space('idle'), crouched: space('crouched-idle') }, gait: { version: 1, id: 'body', referenceStrideDistanceQ: 100, markers: [{ id: 'L', phaseQ: 0, foot: 'left', kind: 'plant' }, { id: 'R', phaseQ: 500000, foot: 'right', kind: 'plant' }], members } };
}
function fact(seq: number, patch: Partial<LocomotionMotorFacts> = {}): LocomotionMotorFacts { return { seq, localLateralQps: 0, localForwardQps: 0, acceptedDistanceQ: 0, desiredSpeedQps: 0, mode: 'grounded', stance: 'standing', yawErrorUnits: 0, jumpInstance: 0, landingInstance: 0, ...patch }; }
const moving = { localForwardQps: 100, desiredSpeedQps: 100, acceptedDistanceQ: 25 };
function driver(config = fixture()) { const compiled = compileLocomotionDriver3D(config); let state = createLocomotionDriver(compiled), seq = 0; return { compiled, get state() { return state; }, set state(p: LocomotionPlayback) { state = p; }, step(patch: Partial<LocomotionMotorFacts> = {}, commands: readonly LocomotionCommand[] = []) { const r = stepLocomotionDriver(compiled, state, { facts: fact(++seq, patch), commands }); state = r.state; return r; } }; }
describe('D2b closed pure locomotion lifecycle + blend-space + calibrated gait composition', () => {
    it('requires the complete 15-state configuration and preserves initial idle exact first pose', () => { const d = driver(); expect(LOCOMOTION_STATES).toHaveLength(15); expect(d.state.state).toBe('idle'); expect(projectLocomotionDriver(d.compiled, d.state).samples.idle).toEqual({ timeSeconds: 0, weight: 1 }); expect(d.state.gait.started).toBe(false); });
    it('uses one-shot completion to leave start, blend movement and brake to idle without a frozen final frame', () => { const d = driver(); d.step(moving); expect(d.state.state).toBe('start'); expect(projectLocomotionDriver(d.compiled, d.state).samples.start.timeSeconds).toBeCloseTo(1 / 30); d.step(moving); expect(d.state.cursors.start.timeSubticks).toBe(2000); d.step(moving); expect(d.state.state).toBe('move'); expect(d.state.gait.phaseQ).toBe(250000); d.step({ ...moving, desiredSpeedQps: 0 }); expect(d.state.state).toBe('stop'); d.step(); d.step(); expect(d.state.state).toBe('idle'); d.step(); expect(d.state.state).toBe('idle'); });
    it('mixes actual local direction/speed, not desired speed or English clip labels', () => { const d = driver(); d.step(moving); d.step(moving); const r = d.step({ localLateralQps: 25, localForwardQps: 25, desiredSpeedQps: 1000, acceptedDistanceQ: 25 }); expect(r.state.weightsQ.E).toBe(250000); expect(r.state.weightsQ.N).toBe(250000); expect(r.state.weightsQ.idle).toBe(500000); expect(projectLocomotionDriver(d.compiled, r.state).samples.N.weight).toBe(.25); });
    it('uses exit hysteresis during an already-started movement, while idle needs the enter threshold', () => { const d = driver(); d.step(moving); d.step({ ...moving, localForwardQps: 6 }); d.step({ ...moving, localForwardQps: 6 }); expect(d.state.state).toBe('move'); d.step({ ...moving, localForwardQps: 6 }); expect(d.state.state).toBe('move'); const idle = driver(); idle.step({ localForwardQps: 6, desiredSpeedQps: 100, acceptedDistanceQ: 1 }); expect(idle.state.state).toBe('idle'); });
    it('does not moonwalk into a wall when desired speed is positive but accepted speed/distance are zero', () => {
        const d = driver();
        for (let i = 0; i < 5; i++)
            d.step({ desiredSpeedQps: 100 });
        expect(d.state.state).toBe('idle');
        expect(d.state.gait.started).toBe(false);
    });
    it('tracks shared gait phase across direction changes and crouched movement without resetting streams', () => { const d = driver(); d.step(moving); d.step(moving); d.step(moving); const before = d.state.gait.phaseQ; const r = d.step({ localLateralQps: 100, desiredSpeedQps: 100, acceptedDistanceQ: 25, stance: 'crouched' }); expect(r.state.state).toBe('crouched-move'); expect(before).toBe(250000); expect(r.state.gait.phaseQ).toBe(500000); const p = projectLocomotionDriver(d.compiled, r.state); expect(p.samples.E.timeSeconds).toBeCloseTo(2 / 30); expect(r.events.map(e => e.markerId)).toEqual(['R']); });
    it('freezes all-zero gait contribution at an idle center while free idle clock can advance', () => { const d = driver(); const state = clone(d.state) as any; state.state = 'move'; state.weightsQ = Object.fromEntries(Object.keys(state.weightsQ).map(a => [a, a === 'idle' ? 1000000 : 0])); const p = stepLocomotionDriver(d.compiled, state, { facts: fact(1), commands: [] }); expect(p.state.gait).toEqual(state.gait); expect(p.events).toEqual([]); });
    it('runs both signed turn states to completion and honors yaw hysteresis', () => { const d = driver(); d.step({ yawErrorUnits: 2000 }); expect(d.state.state).toBe('turn-positive'); d.step({ yawErrorUnits: 900 }); expect(d.state.state).toBe('turn-positive'); d.step({ yawErrorUnits: 0 }); expect(d.state.state).toBe('idle'); d.step({ yawErrorUnits: -2000 }); expect(d.state.state).toBe('turn-negative'); d.step(); d.step(); expect(d.state.state).toBe('idle'); });
    it('uses physical stance transition facts, and does not repeatedly restart a completed crouch-in clip', () => { const d = driver(); d.step({ stance: 'crouch-in' }); expect(d.state.state).toBe('crouch-in'); d.step({ stance: 'crouch-in' }); d.step({ stance: 'crouch-in' }); expect(d.state.state).toBe('crouched-idle'); d.step({ stance: 'crouch-in' }); expect(d.state.state).toBe('crouched-idle'); d.step({ stance: 'crouch-out' }); expect(d.state.state).toBe('crouch-out'); d.step({ stance: 'standing' }); d.step({ stance: 'standing' }); expect(d.state.state).toBe('idle'); });
    it('hard physical airborne/landing transitions override once-state noninterruptibility and return through recover', () => { const d = driver(); d.step(moving); expect(d.state.state).toBe('start'); d.step({ mode: 'rising', jumpInstance: 1 }); expect(d.state.state).toBe('jump-start'); d.step({ mode: 'rising', jumpInstance: 1 }); d.step({ mode: 'rising', jumpInstance: 1 }); expect(d.state.state).toBe('rising'); d.step({ mode: 'falling', jumpInstance: 1 }); expect(d.state.state).toBe('falling'); d.step({ jumpInstance: 1, landingInstance: 1 }); expect(d.state.state).toBe('land'); d.step({ jumpInstance: 1, landingInstance: 1 }); d.step({ jumpInstance: 1, landingInstance: 1 }); expect(d.state.state).toBe('recover'); d.step({ jumpInstance: 1, landingInstance: 1 }); d.step({ jumpInstance: 1, landingInstance: 1 }); expect(d.state.state).toBe('idle'); });
    it('top collision can immediately replace jump-start with falling and a new jump interrupts recovery', () => { const d = driver(); d.step({ mode: 'rising', jumpInstance: 1 }); d.step({ mode: 'falling', jumpInstance: 1 }); expect(d.state.state).toBe('falling'); d.step({ jumpInstance: 1, landingInstance: 1 }); d.step({ mode: 'rising', jumpInstance: 2, landingInstance: 1 }); expect(d.state.state).toBe('jump-start'); expect(d.state.seenJumpInstance).toBe(2); });
    it('does not replay a landing for the same landing instance or repeatedly play stop while coasting', () => { const d = driver(); d.step(moving); d.step(moving); d.step(moving); d.step({ ...moving, desiredSpeedQps: 0 }); expect(d.state.state).toBe('stop'); d.step({ ...moving, desiredSpeedQps: 0 }); d.step({ ...moving, desiredSpeedQps: 0 }); expect(d.state.state).toBe('move'); d.step({ ...moving, desiredSpeedQps: 0 }); expect(d.state.state).toBe('move'); });
    it('freezes clip and gait clocks during pause and suppresses preview-seek footsteps; resume uses the new snapshot', () => { const d = driver(); d.step(moving); d.step(moving); d.step(moving); const old = clone(d.state); d.step(moving, [{ seq: 1, op: 'pause' }]); d.step(moving); expect(d.state.gait).toEqual(old.gait); expect(d.state.cursors).toEqual(old.cursors); expect(d.state.stateTicks).toBe(old.stateTicks); const r = d.step(moving, [{ seq: 2, op: 'preview-seek', state: 'move', tick: 0, phaseQ: 500000, cycle: 3 }]); expect(r.events).toEqual([]); expect(r.state.gait).toMatchObject({ phaseQ: 500000, cycle: 3, started: true }); const resumed = d.step(moving, [{ seq: 3, op: 'resume' }]); expect(resumed.state.gait.phaseQ).toBe(750000); expect(resumed.events).toEqual([]); });
    it('repeated facts and command sequences are idempotent, stale facts reject without partial writes', () => { const c = compileLocomotionDriver3D(fixture()), s = createLocomotionDriver(c); const first = stepLocomotionDriver(c, s, { facts: fact(1, moving), commands: [] }); const again = stepLocomotionDriver(c, first.state, { facts: fact(1, moving), commands: [] }); expect(again.state).toEqual(first.state); expect(again.events).toEqual([]); const before = JSON.stringify(first.state); expect(() => stepLocomotionDriver(c, first.state, { facts: fact(0), commands: [] })).toThrow(); expect(JSON.stringify(first.state)).toBe(before); });
    it('JSON restoration replays exact phase, source times, lifecycle and event identities', () => { const d = driver(); d.step(moving); d.step(moving); d.step(moving); const snapshot = JSON.stringify(d.state), next = fact(d.state.lastFactsSeq + 1, moving); const a = stepLocomotionDriver(d.compiled, d.state, { facts: next, commands: [] }), b = stepLocomotionDriver(d.compiled, JSON.parse(snapshot), { facts: next, commands: [] }); expect(a).toEqual(b); expect(projectLocomotionDriver(d.compiled, a.state)).toEqual(projectLocomotionDriver(d.compiled, b.state)); expect(JSON.stringify(d.state)).toBe(snapshot); });
    it('separates independent actor epochs in gait event IDs', () => {
        const c = compileLocomotionDriver3D(fixture());
        const a = createLocomotionDriver(c, 1), b = createLocomotionDriver(c, 2);
        const run = (s: LocomotionPlayback) => {
            let x = s;
            for (let i = 1; i <= 3; i++)
                x = stepLocomotionDriver(c, x, { facts: fact(i, moving), commands: [] }).state;
            return x;
        };
        expect(run(a).gait.instance).toBe(1);
        expect(run(b).gait.instance).toBe(2);
    });
    it('normalizes topology insertion order, does not mutate source and rejects mismatched restored config', () => { const cfg = fixture(), before = JSON.stringify(cfg), c = compileLocomotionDriver3D(cfg); expect(JSON.stringify(cfg)).toBe(before); const rearranged = clone(cfg) as any; rearranged.spaces.standing.samples.reverse(); rearranged.spaces.standing.triangles.reverse(); const other = compileLocomotionDriver3D(rearranged); expect(createLocomotionDriver(c).configCanonical).toBe(createLocomotionDriver(other).configCanonical); const changed = clone(cfg) as any; changed.clips.N.asset = 'different'; expect(() => projectLocomotionDriver(compileLocomotionDriver3D(changed), createLocomotionDriver(c))).toThrow(/identity/); });
    it.each([
        ['missing state', (c: any) => delete c.states.land], ['unknown state', (c: any) => c.states.fly = clone(c.states.idle)], ['wrong axes', (c: any) => c.localAxes.lateral = '-X'], ['root motion', (c: any) => c.clips.N.motionSpace = 'root-motion'],
        ['unreviewed gait', (c: any) => c.gait.members.N.calibrationStatus = 'draft'], ['source SHA mismatch', (c: any) => c.gait.members.N.sourceSha256 = 'c'.repeat(64)], ['duration mismatch', (c: any) => c.gait.members.N.durationSubticks = 5000], ['unequal real stride', (c: any) => c.gait.members.N.strideDistanceQ = 120], ['unsupported effective stride', (c: any) => c.stridePolicy = 'weighted-effective'],
        ['looped once action', (c: any) => c.clips.land.loop = true], ['once stays forever', (c: any) => c.states.start.onComplete = 'stay'], ['once no restart', (c: any) => c.states.start.restartOnEnter = false], ['minimum longer than clip', (c: any) => c.states.start.minTicks = 5], ['blend resets phase', (c: any) => c.states.move.restartOnEnter = true], ['bad return', (c: any) => c.states.stop.onComplete = 'flying'],
    ])('rejects %s explicitly', (_name, mutate) => { const c = clone(fixture()); mutate(c); expect(() => compileLocomotionDriver3D(c)).toThrow(); });
    it('rejects hidden hooks/getters and malformed facts/commands without invoking them', () => {
        let calls = 0;
        const c: any = clone(fixture());
        Object.defineProperty(c, 'toJSON', { value() { calls++; return {}; } });
        expect(() => compileLocomotionDriver3D(c)).toThrow();
        const d = driver(), input: any = fact(1);
        Object.defineProperty(input, 'localForwardQps', { enumerable: true, get() { calls++; return 0; } });
        expect(() => stepLocomotionDriver(d.compiled, d.state, { facts: input, commands: [] })).toThrow(/accessor/);
        expect(calls).toBe(0);
        for (const commands of [[{ seq: 1, op: 'execute' }], [{ seq: 2, op: 'pause' }, { seq: 1, op: 'resume' }]])
            expect(() => stepLocomotionDriver(d.compiled, d.state, { facts: fact(1), commands: commands as any })).toThrow();
    });
    it('rejects forged snapshot weights, aliases, instance identities and unsupported facts', () => {
        const d = driver();
        for (const change of [(s: any) => s.nextInstance = 1, (s: any) => s.weightsQ.idle = 1, (s: any) => s.cursors.idle.timeSubticks = 2000, (s: any) => s.weightsQ.evil = 0]) {
            const s = clone(d.state);
            change(s);
            expect(() => projectLocomotionDriver(d.compiled, s)).toThrow();
        }
        expect(() => d.step({ mode: 'flying' as any })).toThrow();
        expect(() => d.step({ acceptedDistanceQ: -1 })).toThrow();
    });
});
function weightedFixture(): LocomotionDriver3D {
    const c = clone(fixture()) as any;
    c.stridePolicy = 'weighted-measured';
    c.gait.referenceStrideDistanceQ = 1000;
    c.gait.members.N.strideDistanceQ = 1000;
    c.gait.members.S.strideDistanceQ = 1000;
    c.gait.members.E.strideDistanceQ = 2000;
    c.gait.members.W.strideDistanceQ = 2000;
    return c;
}
function startWeighted() { const d = driver(weightedFixture()); d.step({ ...moving, acceptedDistanceQ: 0 }); d.step({ ...moving, acceptedDistanceQ: 0 }); return d; }
describe('weighted-measured stride adapter is serialized as part of locomotion playback', () => {
    it('mixes 1000/2000 declared reviewed strides at equal weights using effective 1500 without falsifying the measurements', () => {
        const d = startWeighted(), r = d.step({ localLateralQps: 50, localForwardQps: 50, desiredSpeedQps: 100, acceptedDistanceQ: 1500 });
        expect(r.state.state).toBe('move');
        expect(r.state.gait).toMatchObject({ cycle: 1, phaseQ: 0, remainder: 0 });
        expect(r.events.map(e => [e.markerId, e.cycle])).toEqual([['L', 0], ['R', 0], ['L', 1]]);
        expect(d.compiled.configuration.gait.members.N.strideDistanceQ).toBe(1000);
        expect(d.compiled.configuration.gait.members.E.strideDistanceQ).toBe(2000);
        expect(r.state.distanceAdapter).toMatchObject({ referenceRemainderMicroQ: 0, discardedDivisionSteps: 0, tick: 1 });
    });
    it('starts the physical first plant before the first integer reference-Q without advancing phase or duplicating the anchor', () => {
        const d = startWeighted();
        const first = d.step({ localLateralQps: 100, desiredSpeedQps: 100, acceptedDistanceQ: 1 });
        expect(first.state.gait).toMatchObject({ started: true, phaseQ: 0, cycle: 0, remainder: 0 });
        expect(first.events.map(e => [e.markerId, e.cycle])).toEqual([['L', 0]]);
        expect(first.state.distanceAdapter!.referenceRemainderMicroQ).toBe(500000);
        const next = d.step({ localLateralQps: 100, desiredSpeedQps: 100, acceptedDistanceQ: 1 });
        expect(next.state.gait.phaseQ).toBe(1000); expect(next.events).toEqual([]);
    });
    it('counts explicit start plus crossed events together against the single gait event budget', () => {
        const d = startWeighted(), input = { localForwardQps: 100, desiredSpeedQps: 100, acceptedDistanceQ: 31500 };
        expect(d.step(input).events).toHaveLength(64);
        const other = startWeighted(), saved = JSON.stringify(other.state);
        expect(() => other.step({ ...input, acceptedDistanceQ: 32000 })).toThrow(/event budget/);
        expect(JSON.stringify(other.state)).toBe(saved);
    });
    it('normalizes only active gait weights when the blend includes free idle weight', () => {
        const d = startWeighted();
        const r = d.step({ localLateralQps: 25, localForwardQps: 25, desiredSpeedQps: 100, acceptedDistanceQ: 1500 });
        expect(r.state.weightsQ.idle).toBe(500000);
        expect(r.state.gait.cycle).toBe(1);
        expect(r.state.gait.phaseQ).toBe(0);
    });
    it('preserves fixed-denominator carry across leader switches instead of reinterpreting a stride denominator', () => {
        const d = startWeighted();
        d.step({ localLateralQps: 100, desiredSpeedQps: 100, acceptedDistanceQ: 1 });
        expect(d.state.distanceAdapter!.referenceRemainderMicroQ).toBe(500000);
        expect(d.state.gait.started).toBe(true);
        d.step({ localForwardQps: 100, desiredSpeedQps: 100, acceptedDistanceQ: 1 });
        expect(d.state.gait.phaseQ).toBe(1000);
        expect(d.state.distanceAdapter!.referenceRemainderMicroQ).toBe(500000);
        d.step({ localLateralQps: 100, desiredSpeedQps: 100, acceptedDistanceQ: 1 });
        expect(d.state.gait.phaseQ).toBe(2000);
        expect(d.state.distanceAdapter!.referenceRemainderMicroQ).toBe(0);
    });
    it('stop/idle and pause freeze the adapter, retaining fractional carry without collecting invisible travel', () => {
        const d = startWeighted();
        d.step({ localLateralQps: 100, desiredSpeedQps: 100, acceptedDistanceQ: 1 });
        const saved = clone(d.state.distanceAdapter);
        const stop = d.step({ localLateralQps: 100, desiredSpeedQps: 0, acceptedDistanceQ: 1000 });
        expect(stop.state.state).toBe('stop');
        expect(stop.events).toEqual([]);
        expect(stop.state.distanceAdapter).toEqual(saved);
        d.step();
        d.step();
        expect(d.state.state).toBe('idle');
        expect(d.state.distanceAdapter).toEqual(saved);
        d.step(moving, [{ seq: 1, op: 'pause' }]);
        d.step(moving);
        expect(d.state.distanceAdapter).toEqual(saved);
    });
    it('previewseek drops only pre-seek carry; diagnostic bound/tick persist and no steps or feet fire', () => {
        const d = startWeighted();
        d.step({ localLateralQps: 50, localForwardQps: 50, desiredSpeedQps: 100, acceptedDistanceQ: 1 });
        expect(d.state.distanceAdapter).toMatchObject({ referenceRemainderMicroQ: 666666, discardedDivisionSteps: 1, tick: 1 });
        const r = d.step(moving, [{ seq: 1, op: 'preview-seek', state: 'move', tick: 0, phaseQ: 250000, cycle: 7 }]);
        expect(r.events).toEqual([]);
        expect(r.state.gait).toMatchObject({ phaseQ: 250000, cycle: 7, remainder: 0, started: true });
        expect(r.state.distanceAdapter).toMatchObject({ referenceRemainderMicroQ: 0, discardedDivisionSteps: 1, tick: 1 });
    });
    it('restores the adapter carry and loss bound, producing identical phase and plant IDs on replay', () => {
        const d = startWeighted();
        d.step({ localLateralQps: 50, localForwardQps: 50, desiredSpeedQps: 100, acceptedDistanceQ: 1 });
        const saved = JSON.stringify(d.state);
        const f = fact(d.state.lastFactsSeq + 1, { localLateralQps: 100, desiredSpeedQps: 100, acceptedDistanceQ: 999 });
        const a = stepLocomotionDriver(d.compiled, d.state, { facts: f, commands: [] }), b = stepLocomotionDriver(d.compiled, JSON.parse(saved), { facts: f, commands: [] });
        expect(a).toEqual(b);
        expect(JSON.stringify(d.state)).toBe(saved);
    });
    it('duplicate/stale facts and rejected budget never partly advance the distance adapter', () => {
        const d = startWeighted();
        d.step({ localLateralQps: 100, desiredSpeedQps: 100, acceptedDistanceQ: 1 });
        const state = clone(d.state), saved = JSON.stringify(state);
        const duplicate = stepLocomotionDriver(d.compiled, state, { facts: fact(state.lastFactsSeq, { localLateralQps: 100, desiredSpeedQps: 100, acceptedDistanceQ: 999 }), commands: [] });
        expect(duplicate.state).toEqual(state);
        expect(duplicate.events).toEqual([]);
        expect(() => stepLocomotionDriver(d.compiled, state, { facts: fact(state.lastFactsSeq - 1), commands: [] })).toThrow(/stale/);
        expect(() => stepLocomotionDriver(d.compiled, state, { facts: fact(state.lastFactsSeq + 1, { localForwardQps: 100, desiredSpeedQps: 100, acceptedDistanceQ: 1000000 }), commands: [] })).toThrow(/event budget/);
        expect(JSON.stringify(state)).toBe(saved);
    });
    it('binds adapter state to the actual profile and rejects omitted/forged carry fields', () => {
        const d = startWeighted();
        for (const mutate of [(s: any) => delete s.distanceAdapter, (s: any) => s.distanceAdapter.referenceRemainderMicroQ = 1000000, (s: any) => s.distanceAdapter.configCanonical = 'forged', (s: any) => s.distanceAdapter.extra = true]) {
            const s = clone(d.state);
            mutate(s);
            expect(() => projectLocomotionDriver(d.compiled, s)).toThrow();
        }
    });
    it('keeps normalized-reference snapshot shape and policy unchanged', () => {
        const d = driver();
        expect(Object.hasOwn(d.state, 'distanceAdapter')).toBe(false);
        const restored = JSON.parse(JSON.stringify(d.state));
        expect(projectLocomotionDriver(d.compiled, restored)).toEqual(projectLocomotionDriver(d.compiled, d.state));
        const wrong = clone(d.state) as any;
        wrong.distanceAdapter = {};
        expect(() => projectLocomotionDriver(d.compiled, wrong)).toThrow(/closed fields/);
        const c = weightedFixture() as any;
        c.stridePolicy = 'normalized-reference';
        expect(() => compileLocomotionDriver3D(c)).toThrow(/stride-incompatible/);
    });
    it('rejects forged compiled wrappers and subclass dispatch before any user getter or method executes', () => {
        const d = driver();
        let calls = 0;
        const fake: any = { validateState() { calls++; return d.state; } };
        Object.defineProperty(fake, 'configuration', { get() { calls++; return d.compiled.configuration; } });
        expect(() => createLocomotionDriver(fake)).toThrow();
        expect(() => stepLocomotionDriver(fake, d.state, { facts: fact(1), commands: [] })).toThrow();
        expect(() => projectLocomotionDriver(fake, d.state)).toThrow();
        expect(calls).toBe(0);
        const Parent = d.compiled.constructor as any;
        class Subclass extends Parent { constructor(value: unknown) { super(value); }
            validateState() { calls++; return d.state; }
        }
        const child = new Subclass(fixture()) as unknown as typeof d.compiled;
        expect(() => stepLocomotionDriver(child, d.state, { facts: fact(1), commands: [] })).toThrow(/prototype/);
        expect(() => projectLocomotionDriver(child, d.state)).toThrow(/prototype/);
        expect(calls).toBe(0);
    });
});
