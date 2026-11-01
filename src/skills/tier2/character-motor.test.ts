import { overlapDetect3dCapability } from '../atoms/overlap-detect-3d/index.js';
import type { Overlap3D, DebugTrace } from '@engine/protocol/components.js';
import { Engine } from '@runtime/engine.js';
import { parseManifest } from '@assembly/manifest.js';
import { parseManifestAsync } from '@assembly/manifest-async.js';
import { collectAssetRefs } from '@assembly/derive-asset-index.js';
import { validateAssetRefs, validateComponentData } from '@assembly/validate-manifest.js';
import type { EntityBlueprint } from '@assembly/demo.assembly.js';
import { compileLocomotionDriver3D, createLocomotionDriver } from '@engine/animation/locomotion-driver.js';
import { validateLocomotionPlayback3D, validateLocomotionCommand3D } from '@engine/animation/locomotion-envelope.js';
import { LOCOMOTION_STATES, type LocomotionDriver3D } from '@engine/animation/locomotion-driver.js';
import type { LocomotionPlayback3D, LocomotionCommand3D } from '@engine/protocol/components/locomotion-driver.js';
import { collectRenderables } from '@renderer/renderable.js';
import { groundPose } from '@renderer/three-projection.js';
import { describe, it, expect, vi } from 'vitest';
import { World } from '@engine/core/world.js';
import { hashSnapshot } from '@net/determinism.js';
import { characterMotorCapability } from './character-motor.js';
import { motionApplyCapability } from '../tier1/motion-apply.js';
import type { CharacterMotor3D, CharacterMotorPlayback3D, CharacterMotorIntent3D } from '@engine/protocol/components/character-motor.js';
import type { Transform, Collider3D, Model3D } from '@engine/protocol/components.js';
function config(): CharacterMotor3D { return { type: 'CharacterMotor3D', version: 1, motion: { version: 1, unitsPerMeter: 10000, tickRate: 60, body: { kind: 'capsule', radiusQ: 2000, standingHeightQ: 18000, crouchedHeightQ: 10000, skinQ: 2 }, maxWalkSpeedQps: 20000, maxRunSpeedQps: 40000, maxCrouchSpeedQps: 10000, accelQps2: 40000, brakeQps2: 60000, airControlQps2: 20000, gravityQps2: 98000, jumpSpeedQps: 40000, terminalFallSpeedQps: 100000, recoverTicks: 2, collision: { kind: 'static-aabb', maxObstacles: 16, maxContacts: 8, maxSlideIterations: 8, maxDeltaQ: 1000000 } }, initial: { positionQ: { x: 0, y: 0, z: 0 }, stance: 'standing', yawUnits: 0 }, maxTurnUnitsPerSecond: 65536 }; }
function world() {
    const w = new World({ strict: true });
    for (const system of characterMotorCapability.systems)
        w.addSystem(system);
    w.createEntity('actor');
    w.addComponent('actor', config());
    w.createEntity('floor');
    w.addComponent('floor', { type: 'Transform', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });
    w.addComponent('floor', { type: 'Collider3D', kind: 'box', halfX: 100, halfY: .5, halfZ: 100, baseY: -1 });
    return w;
}
const playback = (w: World) => w.getComponent<CharacterMotorPlayback3D>('actor', 'CharacterMotorPlayback3D')!;
const move: CharacterMotorIntent3D = { type: 'CharacterMotorIntent3D', version: 1, move: { seq: 1, xQ: 10000, zQ: 0, gait: 'walk', stance: 'standing' } };
describe('D2 motor World authority', () => {
    it('boots actual projections and advances one physical clock with strict system declarations', () => {
        const w = world(), warn = vi.spyOn(console, 'warn');
        w.addComponent('actor', move);
        for (const system of motionApplyCapability.systems)
            w.addSystem(system);
        for (let i = 0; i < 60; i++)
            w.tick();
        const p = playback(w), tr = w.getComponent<Transform>('actor', 'Transform')!, body = w.getComponent<Collider3D>('actor', 'Collider3D')!;
        expect(p.motor.tick).toBe(60);
        expect(Math.abs(tr.x - 1.5)).toBeLessThanOrEqual(.0001);
        expect(tr.y).toBe(0);
        expect(body.baseY).toBe(p.motor.positionQ.y / 10000);
        expect(tr.rotation).toBe(-Math.PI / 2);
        expect(w.hasComponent('actor', 'Velocity')).toBe(false);
        expect(w.hasComponent('actor', 'CharacterMotorEnvironment3D')).toBe(true);
        expect(warn.mock.calls).toEqual([]);
        warn.mockRestore();
    });
    it('jumps and lands with collider foot height following the only accepted state', () => {
        const w = world();
        w.addComponent('actor', { type: 'CharacterMotorIntent3D', version: 1, jump: { seq: 1 } } as CharacterMotorIntent3D);
        const ids: string[] = [], modes = new Set<string>();
        for (let i = 0; i < 150; i++) {
            w.tick();
            const p = playback(w);
            ids.push(...p.events.map(e => e.id));
            modes.add(p.motor.mode);
            expect(w.getComponent<Collider3D>('actor', 'Collider3D')!.baseY).toBe(p.motor.positionQ.y / 10000);
        }
        expect(ids).toEqual(['actor:jump:1', 'actor:land:1']);
        expect([...modes]).toEqual(expect.arrayContaining(['rising', 'falling', 'landing', 'recovering', 'grounded']));
    });
    it('JSON snapshot restore reproduces all physical state, facts, scene identity and hash', () => {
        const w = world();
        w.addComponent('actor', move);
        for (let i = 0; i < 13; i++)
            w.tick();
        const saved = JSON.parse(JSON.stringify(w.snapshot())), order = w.snapshotOrder(), hashes = [];
        for (let i = 0; i < 30; i++) {
            w.tick();
            hashes.push(hashSnapshot(w.snapshot()));
        }
        const end = JSON.stringify(playback(w));
        w.restore(saved, order);
        for (let i = 0; i < 30; i++) {
            w.tick();
            expect(hashSnapshot(w.snapshot())).toBe(hashes[i]);
        }
        expect(JSON.stringify(playback(w))).toBe(end);
    });
    it('rejects conflicting movement before any motor projection or playback is committed', () => { const w = world(); w.addComponent('actor', { type: 'Velocity', vx: 1, vy: 0, angular: 0 }); expect(() => w.tick()).toThrow(/exclusive/); expect(playback(w)).toBeUndefined(); expect(w.getComponent('actor', 'Transform')).toBeUndefined(); expect(w.getComponent('actor', 'CharacterMotorEnvironment3D')).toBeUndefined(); });
    it('rejects multiple moving actors before first partial bootstrap', () => { const w = world(); w.createEntity('second'); w.addComponent('second', config()); expect(() => w.tick()).toThrow(/one motor/); expect(playback(w)).toBeUndefined(); expect(w.getComponent('second', 'CharacterMotorPlayback3D')).toBeUndefined(); });
    it('refuses static scene motion and unsupported geometry without advancing the prior motor snapshot', () => { const w = world(); w.tick(); const before = JSON.stringify(playback(w)); w.getComponent<Transform>('floor', 'Transform')!.x = 1; expect(() => w.tick()).toThrow(/scene changed/); expect(JSON.stringify(playback(w))).toBe(before); const bad = world(); bad.getComponent<Collider3D>('floor', 'Collider3D')!.kind = 'sphere'; expect(() => bad.tick()).toThrow(/box/); expect(playback(bad)).toBeUndefined(); });
    it('catches late external position writes before downstream animation can consume them', () => {
        const w = world();
        w.addSystem({ id: 'illegal-late-position', phase: 20, reads: ['Transform'], writes: ['Transform'], consumes: [], execute(view) {
                const tr = view.getComponent<Transform>('actor', 'Transform');
                if (tr)
                    tr.x += 1;
            } });
        expect(() => w.tick()).toThrow(/outside authority/);
        expect(playback(w).motor.positionQ.x).toBe(0);
    });
    it('requires playback and environment to restore together', () => { const w = world(); w.tick(); const before = JSON.stringify(playback(w)); w.removeComponent('actor', 'CharacterMotorEnvironment3D'); expect(() => w.tick()).toThrow(/restore together/); expect(JSON.stringify(playback(w))).toBe(before); });
});
function locomotionConfig(): LocomotionDriver3D {
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
    return { type: 'LocomotionDriver3D', version: 1, tickRate: 60, localAxes: { up: 'Y', forward: '+Z', lateral: '+X' }, stridePolicy: 'normalized-reference', thresholds: { moveEnterQps: 10, moveExitQps: 5, turnEnterUnits: 1000, turnExitUnits: 500 }, clips, states, spaces: { standing: space('idle'), crouched: space('crouched-idle') }, gait: { version: 1, id: 'body', referenceStrideDistanceQ: 100, markers: [{ id: 'L', phaseQ: 0, foot: 'left', kind: 'plant' }, { id: 'R', phaseQ: 500000, foot: 'right', kind: 'plant' }], members } };
}
describe('D2 atomic physical + locomotion transaction', () => {
    const loco = (w: World) => w.getComponent<LocomotionPlayback3D>('actor', 'LocomotionPlayback3D')!;
    it('commits matching fixed ticks, snapshot plant events and state transitions with actual movement', () => {
        const w = world();
        w.addComponent('actor', locomotionConfig());
        w.addComponent('actor', move);
        const states = new Set<string>(), events: string[] = [];
        for (let i = 0; i < 40; i++) {
            w.tick();
            expect(loco(w).playback.lastFactsSeq).toBe(playback(w).motor.tick);
            states.add(loco(w).playback.state);
            events.push(...loco(w).events.map(e => e.id));
        }
        expect([...states]).toEqual(expect.arrayContaining(['start', 'move']));
        expect(events.length).toBeGreaterThan(0);
        expect(new Set(events).size).toBe(events.length);
    });
    it('bad animation input rejects before position, collision body or animation is partially advanced', () => {
        const w = world();
        w.addComponent('actor', locomotionConfig());
        w.addComponent('actor', move);
        for (let i = 0; i < 4; i++)
            w.tick();
        const before = JSON.stringify([playback(w), loco(w), w.getComponent('actor', 'Transform'), w.getComponent('actor', 'Collider3D')]);
        const broken = JSON.parse(JSON.stringify(locomotionConfig()));
        delete broken.states.land;
        w.addComponent('actor', broken);
        expect(() => w.tick()).toThrow(/states/);
        expect(JSON.stringify([playback(w), loco(w), w.getComponent('actor', 'Transform'), w.getComponent('actor', 'Collider3D')])).toBe(before);
    });
    it('animation event budget failure also preserves the proposed physical move', () => {
        const w = world(), c = locomotionConfig(), small = JSON.parse(JSON.stringify(c));
        small.gait.referenceStrideDistanceQ = 1;
        for (const member of Object.values(small.gait.members) as {
            strideDistanceQ: number;
        }[])
            member.strideDistanceQ = 1;
        w.addComponent('actor', small);
        w.addComponent('actor', move);
        let failed = false;
        for (let i = 0; i < 10; i++) {
            const before = JSON.stringify([playback(w), loco(w), w.getComponent('actor', 'Transform'), w.getComponent('actor', 'Collider3D')]);
            try {
                w.tick();
            }
            catch (error) {
                expect(String(error)).toMatch(/budget/);
                expect(JSON.stringify([playback(w), loco(w), w.getComponent('actor', 'Transform'), w.getComponent('actor', 'Collider3D')])).toBe(before);
                failed = true;
                break;
            }
        }
        expect(failed).toBe(true);
    });
    it('JSON rollback replays combined state and event hashes; animation pause freezes pose without pausing physics', () => {
        const w = world();
        w.addComponent('actor', locomotionConfig());
        w.addComponent('actor', move);
        for (let i = 0; i < 8; i++)
            w.tick();
        const saved = JSON.parse(JSON.stringify(w.snapshot())), order = w.snapshotOrder(), hashes = [];
        for (let i = 0; i < 20; i++) {
            w.tick();
            hashes.push(hashSnapshot(w.snapshot()));
        }
        w.restore(saved, order);
        for (let i = 0; i < 20; i++) {
            w.tick();
            expect(hashSnapshot(w.snapshot())).toBe(hashes[i]);
        }
        const old = JSON.stringify(loco(w).playback.gait), oldX = playback(w).motor.positionQ.x;
        w.addComponent('actor', { type: 'LocomotionCommand3D', version: 1, commands: [{ seq: 1, op: 'pause' }] } as LocomotionCommand3D);
        for (let i = 0; i < 3; i++) {
            w.tick();
            expect(JSON.stringify(loco(w).playback.gait)).toBe(old);
            expect(loco(w).events).toEqual([]);
        }
        expect(playback(w).motor.positionQ.x).toBeGreaterThan(oldX);
    });
    it('projects the same accepted foot position and yaw into the actual renderer collector', () => {
        const w = world();
        w.addComponent('actor', { type: 'Model3D', modelKey: 'synthetic' });
        w.addComponent('actor', { type: 'CharacterMotorIntent3D', version: 1, jump: { seq: 1 } } as CharacterMotorIntent3D);
        for (let i = 0; i < 10; i++)
            w.tick();
        const p = playback(w), r = collectRenderables(w.readView()).find(r => r.entityId === 'actor')!, pose = groundPose(r, 0);
        expect(p.motor.positionQ.y).toBeGreaterThan(0);
        expect(pose.y).toBe(p.motor.positionQ.y / 10000);
        expect(pose.x).toBe(p.motor.positionQ.x / 10000);
        expect(pose.z).toBe(p.motor.positionQ.z / 10000);
        expect(pose.ry).toBe(p.yawUnits * (Math.PI * 2 / 65536));
    });
});
describe('D2 public load and envelope boundaries', () => {
    function entities() { const w = world(); const e = Object.fromEntries(w.query().map(([id, components]) => [id, Object.fromEntries(components)])); e.actor.Model3D = { type: 'Model3D', modelKey: 'synthetic' } as Model3D; e.actor.LocomotionDriver3D = locomotionConfig(); return e as unknown as Record<string, EntityBlueprint>; }
    it('infers and installs one complete driver through synchronous and asynchronous manifests', async () => {
        for (const parse of [parseManifest, parseManifestAsync]) {
            const blueprint = await parse({ meta: { tickRate: 60 }, entities: entities() });
            expect(blueprint.capabilities.map(c => c.id)).toContain('t2-character-motor');
            const engine = new Engine();
            engine.load(blueprint);
            engine.world.addComponent('actor', move);
            engine.world.tick();
            expect(playback(engine.world).motor.tick).toBe(1);
            expect(engine.world.getComponent<LocomotionPlayback3D>('actor', 'LocomotionPlayback3D')!.playback.lastFactsSeq).toBe(1);
        }
    });
    it('rejects missing capabilities, different clocks, movement conflicts and changed live scene before load mutation', () => { const engine = new Engine(), e = entities(); expect(() => engine.load({ capabilities: [], entities: e })).toThrow(/capability/); expect(engine.world.query()).toEqual([]); expect(engine.tickRate).toBe(60); const blueprint = parseManifest({ meta: { tickRate: 60 }, entities: e }); engine.load(blueprint); engine.world.tick(); const saved = JSON.stringify(engine.world.snapshot()); expect(() => engine.load({ meta: { tickRate: 30 }, capabilities: [], entities: {} })).toThrow(/tickRate/); expect(JSON.stringify(engine.world.snapshot())).toBe(saved); expect(engine.tickRate).toBe(60); expect(() => engine.load({ capabilities: [], entities: { extraWall: { Transform: { x: 1, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }, Collider3D: { kind: 'box', halfX: .1, halfY: 1, halfZ: 1 } } } })).toThrow(/scene/); expect(JSON.stringify(engine.world.snapshot())).toBe(saved); const bad = JSON.parse(JSON.stringify(e)); bad.actor.Velocity = { vx: 1, vy: 0, angular: 0 }; expect(() => new Engine().load({ capabilities: [characterMotorCapability], entities: bad })).toThrow(/Velocity/); });
    it('deduplicates motor installation across the same load and additive loads', () => { const engine = new Engine(), blueprint = parseManifest({ entities: entities() }); engine.load({ ...blueprint, capabilities: [...blueprint.capabilities, characterMotorCapability] }); engine.world.tick(); engine.load({ capabilities: [characterMotorCapability, characterMotorCapability], entities: { extra: { Color: { fill: '#ffffff' } } } }); engine.world.tick(); expect(playback(engine.world).motor.tick).toBe(2); expect(engine.world.getComponent<LocomotionPlayback3D>('actor', 'LocomotionPlayback3D')!.playback.tick).toBe(2); });
    it('discovers every configured nested animation key and rejects fabricated references', () => { const e = entities(), refs = collectAssetRefs([characterMotorCapability], e); expect(refs.some(r => r.key === 'motion-N' && r.assetType === 'animation' && r.field === 'clips.N.asset')).toBe(true); expect(validateAssetRefs([characterMotorCapability], e, new Set()).some(r => r.field === 'clips.N.asset')).toBe(true); const bad = JSON.parse(JSON.stringify(e)); delete bad.actor.LocomotionDriver3D.states.land; expect(validateComponentData([characterMotorCapability], bad).errors.length).toBeGreaterThan(0); });
    it('rejects forged envelope events and command hooks before invoking a callback', () => { const c = compileLocomotionDriver3D(locomotionConfig()), p = { type: 'LocomotionPlayback3D' as const, version: 1 as const, playback: createLocomotionDriver(c), events: [] }; expect(validateLocomotionPlayback3D(c, p)).toBe(p); const event = { id: 'body:1:0:L', groupId: 'body', instance: 1, cycle: 0, markerId: 'L', phaseQ: 0, kind: 'plant', foot: 'left' }; expect(() => validateLocomotionPlayback3D(c, { ...p, events: [event] })).toThrow(/identity/); let calls = 0; const command = Object.defineProperty({ type: 'LocomotionCommand3D', version: 1 }, 'commands', { enumerable: true, get() { calls++; return []; } }); expect(() => validateLocomotionCommand3D(command)).toThrow(/accessor/); const forged = Object.defineProperty({ validateState() { calls++; return p.playback; } }, 'configuration', { get() { calls++; return c.configuration; } }); expect(() => validateLocomotionPlayback3D(forged as unknown as typeof c, p)).toThrow(); expect(calls).toBe(0); });
});
it('drives crouch-in/out from accepted physical stance edges, including a transition during animation pause', () => {
    const w = world();
    w.addComponent('actor', locomotionConfig());
    w.tick();
    w.addComponent('actor', { ...move, move: { ...move.move!, xQ: 0, stance: 'crouched' } } as CharacterMotorIntent3D);
    w.tick();
    const loco = () => w.getComponent<LocomotionPlayback3D>('actor', 'LocomotionPlayback3D')!;
    expect(playback(w).motor.stance).toBe('crouched');
    expect(loco().playback.state).toBe('crouch-in');
    for (let i = 0; i < 5; i++)
        w.tick();
    expect(loco().playback.state).toBe('crouched-idle');
    w.addComponent('actor', { type: 'LocomotionCommand3D', version: 1, commands: [{ seq: 1, op: 'pause' }] } as LocomotionCommand3D);
    w.tick();
    w.addComponent('actor', { ...move, move: { ...move.move!, seq: 2, xQ: 0, stance: 'standing' } } as CharacterMotorIntent3D);
    w.tick();
    expect(playback(w).motor.stance).toBe('standing');
    expect(loco().playback.state).toBe('crouched-idle');
    w.addComponent('actor', { type: 'LocomotionCommand3D', version: 1, commands: [{ seq: 2, op: 'resume' }] } as LocomotionCommand3D);
    w.tick();
    expect(loco().playback.state).toBe('crouch-out');
    for (let i = 0; i < 5; i++)
        w.tick();
    expect(loco().playback.state).toBe('idle');
});
it('publishes the accepted collider before actual legacy overlap detection on the first tick', () => { const w = world(); for (const system of overlapDetect3dCapability.systems)
    w.addSystem(system); w.createEntity('zone'); w.addComponent('zone', { type: 'Transform', x: .1, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }); w.addComponent('zone', { type: 'Collider3D', kind: 'box', halfX: .01, halfY: 1, halfZ: .1, baseY: 0, trigger: true }); w.addComponent('actor', move); w.tick(); expect(w.query('Overlap3D').map(([id]) => w.getComponent<Overlap3D>(id, 'Overlap3D')!).some(o => [o.entityA, o.entityB].includes('actor') && [o.entityA, o.entityB].includes('zone'))).toBe(true); expect(playback(w).motor.tick).toBe(1); });
it('keeps rendering inputs and opt-in trace out of authority, with at most three motor log entries per tick', () => { const a = world(), b = world(); a.addComponent('actor', move); b.addComponent('actor', move); b.addComponent('actor', { type: 'DebugTrace', events: [] } as DebugTrace); b.addComponent('actor', { type: 'Transform3D', x: 123, y: 456, z: 789 }); for (let i = 0; i < 30; i++) {
    a.tick();
    b.tick();
    expect(hashSnapshot(b.snapshot())).toBe(hashSnapshot(a.snapshot()));
} const trace = b.getComponent<DebugTrace>('actor', 'DebugTrace')!; expect(trace.events.some(e => e.system === 'character-motor-step' && e.kind === 'commit')).toBe(true); const counts = new Map<string, number>(); for (const e of trace.events) {
    const key = e.system + ':' + e.tick;
    counts.set(key, (counts.get(key) ?? 0) + 1);
} expect([...counts.values()].every(n => n <= 3)).toBe(true); });
it('does not execute rejected entity getters while formatting component-validation errors', () => { let calls = 0; const raw = Object.defineProperty({}, 'actor', { enumerable: true, get() { calls++; return { CharacterMotor3D: config() }; } }); const report = validateComponentData([characterMotorCapability], raw as Record<string, EntityBlueprint>); expect(report.errors.length).toBeGreaterThan(0); expect(calls).toBe(0); });
it('rejects raw stale animation facts and phantom lifecycle counters before either driver commits', () => { for (const change of [(p: LocomotionPlayback3D) => ({ ...p, playback: { ...p.playback, lastFactsSeq: 1 } }), (p: LocomotionPlayback3D) => ({ ...p, playback: { ...p.playback, seenJumpInstance: 1 } })]) {
    const w = world();
    w.addComponent('actor', locomotionConfig());
    w.addComponent('actor', move);
    for (let i = 0; i < 5; i++)
        w.tick();
    const p = w.getComponent<LocomotionPlayback3D>('actor', 'LocomotionPlayback3D')!;
    w.addComponent('actor', change(p));
    const before = JSON.stringify([playback(w), w.getComponent('actor', 'LocomotionPlayback3D'), w.getComponent('actor', 'Transform')]);
    expect(() => w.tick()).toThrow(/snapshot tuple/);
    expect(JSON.stringify([playback(w), w.getComponent('actor', 'LocomotionPlayback3D'), w.getComponent('actor', 'Transform')])).toBe(before);
} });
it('rejects a raw saved ghost support with otherwise unchanged physical projection', () => { const w = world(); w.tick(); const p = playback(w); w.addComponent('actor', { ...p, motor: { ...p.motor, supportId: 'ghost' } }); const before = JSON.stringify(playback(w)); expect(() => w.tick()).toThrow(/saved support/); expect(JSON.stringify(playback(w))).toBe(before); });
it('rejects a forged raw environment discriminant without repairing it or advancing', () => { const w = world(); w.tick(); const snapshot = JSON.parse(JSON.stringify(w.snapshot())); snapshot.actor.CharacterMotorEnvironment3D.type = 'ForgedEnvironment'; w.restore(snapshot, w.snapshotOrder()); const before = JSON.stringify(playback(w)); expect(() => w.tick()).toThrow(/environment invalid/); expect(JSON.stringify(playback(w))).toBe(before); });
it('rejects late inconsistent locomotion clocks before a renderer can consume the world', () => { const w = world(); w.addComponent('actor', locomotionConfig()); w.addSystem({ id: 'illegal-late-animation', phase: 20, reads: ['LocomotionPlayback3D'], writes: ['LocomotionPlayback3D'], consumes: [], execute(view) { const p = view.getComponent<LocomotionPlayback3D>('actor', 'LocomotionPlayback3D'); if (p)
        view.addComponent('actor', { ...p, playback: { ...p.playback, lastFactsSeq: 0 } }); } }); expect(() => w.tick()).toThrow(/late inconsistent/); });
it('rejects a truthy string trigger before first raw bootstrap instead of dropping the floor', () => { const w = world(), body = w.getComponent<Collider3D>('floor', 'Collider3D')!; w.addComponent('floor', { ...body, trigger: 'false' } as unknown as Collider3D); expect(() => w.tick()).toThrow(/trigger must be boolean/); expect(playback(w)).toBeUndefined(); expect(w.hasComponent('actor', 'Transform')).toBe(false); });
