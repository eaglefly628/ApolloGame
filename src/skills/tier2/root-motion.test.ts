import { describe, it, expect } from 'vitest';
import { World } from '@engine/core/world.js';
import type { Component } from '@engine/core/types.js';
import { hashSnapshot } from '@net/determinism.js';
import { characterMotorCapability } from './character-motor.js';
import { animationDriverCapability } from './animation-driver.js';
import { animationPerformanceCapability } from './animation-performance.js';
import { rootMotionCapability } from './root-motion.js';
import type { RootMotion3D } from '@engine/protocol/components/root-motion.js';
import type { CharacterMotor3D, CharacterMotorPlayback3D } from '@engine/protocol/components/character-motor.js';
import type { AnimationDriver3D, AnimationDriverPlayback3D } from '@engine/protocol/components/animation-driver.js';
export function rootMotor(): CharacterMotor3D { return { type: 'CharacterMotor3D', version: 1, motion: { version: 1, unitsPerMeter: 10000, tickRate: 30, body: { kind: 'capsule', radiusQ: 1000, standingHeightQ: 18000, crouchedHeightQ: 10000, skinQ: 2 }, maxWalkSpeedQps: 12000, maxRunSpeedQps: 24000, maxCrouchSpeedQps: 6000, accelQps2: 40000, brakeQps2: 60000, airControlQps2: 20000, gravityQps2: 98000, jumpSpeedQps: 40000, terminalFallSpeedQps: 100000, recoverTicks: 2, collision: { kind: 'static-aabb', maxObstacles: 16, maxContacts: 8, maxSlideIterations: 8, maxDeltaQ: 1000000 } }, initial: { positionQ: { x: 0, y: 0, z: 0 }, stance: 'standing', yawUnits: 0 }, maxTurnUnitsPerSecond: 65536 }; }
export function rootConfig(loop: 'once' | 'repeat' = 'once'): RootMotion3D { return { type: 'RootMotion3D', version: 1, sourceSha256: 'a'.repeat(64), inPlaceClipSha256: 'b'.repeat(64), carrier: { policy: 'hips-linear-xz-v1', bone: 'Hips', vertical: 'motor' }, tickRate: 30, durationSubticks: 4000, loop, endpointPolicy: 'accumulate-se2', samples: [{ atSubtick: 0, positionQ: { x: 0, z: 0 }, yawUnits: 0 }, { atSubtick: 4000, positionQ: { x: 0, z: 4000 }, yawUnits: 0 }], limits: { maxDeltaQ: 100000, maxYawDeltaUnits: 0, maxCyclesPerStep: 4 } }; }
export function rootDriver(loop = false): AnimationDriver3D { return { type: 'AnimationDriver3D', version: 1, tickRate: 30, initialState: 'go', graph: { type: 'AnimGraph3D', clips: { step: { asset: 'inplace/step', clip: 'step', loop } }, states: { go: { clip: 'step' }, idle: { clip: 'step' } }, params: { speed: 'speed' }, transitions: [] }, clips: { step: { durationTicks: 4, notifies: [{ id: 'cue', atTick: 1 }] } } }; }
export function rootWorld(loop = false) { const w = new World({ strict: true }); for (const cap of [rootMotionCapability, characterMotorCapability, animationDriverCapability, animationPerformanceCapability])
    for (const s of cap.systems)
        w.addSystem(s); w.createEntity('actor'); for (const c of [rootMotor(), rootConfig(loop ? 'repeat' : 'once'), rootDriver(loop), { type: 'RootMotionSource3D', version: 1, driver: { kind: 'animation-driver', clip: 'step' } }, { type: 'Model3D', modelKey: 'synthetic' }])
    w.addComponent('actor', c as Component); w.createEntity('floor'); w.addComponent('floor', { type: 'Transform', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }); w.addComponent('floor', { type: 'Collider3D', kind: 'box', halfX: 100, halfY: .5, halfZ: 100, baseY: -1 }); return w; }
const m = (w: World) => w.getComponent<CharacterMotorPlayback3D>('actor', 'CharacterMotorPlayback3D')!;
const d = (w: World) => w.getComponent<AnimationDriverPlayback3D>('actor', 'AnimationDriverPlayback3D')!;
describe('D4 actual World root/motor/base atomic transaction', () => {
    it('moves from the real D1 cursor once per tick, clamps once endpoint, and never applies root a second time', () => { const w = rootWorld(); for (let i = 1; i <= 8; i++) {
        w.tick();
        expect(m(w).motor.positionQ.z).toBe(Math.min(i, 4) * 1000);
        expect(d(w).tick).toBe(i);
        expect(w.getComponent<any>('actor', 'RootMotionPlayback3D').lastDriverTick).toBe(i);
        expect(w.getComponent<any>('actor', 'RootMotionPlayback3D').pending).toBeUndefined();
    } expect(m(w).motor.positionQ.y).toBe(0); });
    it('uses capsule CCD wall acceptance, consumes blocked cursor and never repays the missed displacement', () => { const w = rootWorld(true); w.createEntity('wall'); w.addComponent('wall', { type: 'Transform', x: 0, y: .25, rotation: 0, scaleX: 1, scaleY: 1 }); w.addComponent('wall', { type: 'Collider3D', kind: 'box', halfX: 1, halfY: 2, halfZ: .001, baseY: 0 }); for (let i = 0; i < 8; i++)
        w.tick(); expect(m(w).motor.positionQ.z).toBeLessThan(1500); expect(m(w).result.blockedReasons).toContain('collision'); expect(w.getComponent<any>('actor', 'RootMotionPlayback3D').lastFeedback.blocked).toBe(true); expect(w.getComponent<any>('actor', 'RootMotionPlayback3D').cursor).toEqual({ cycle: 2, subtick: 0 }); });
    it('seek moves neither body nor emits base cue; next normal tick starts from sought cursor', () => { const w = rootWorld(); w.tick(); w.tick(); const z = m(w).motor.positionQ.z; w.addComponent('actor', { type: 'AnimationDriverCommand3D', version: 1, commands: [{ seq: 1, op: 'seek', tick: 0 }] }); w.tick(); expect(m(w).motor.positionQ.z).toBe(z); expect(d(w).events).toEqual([]); expect(w.getComponent<any>('actor', 'RootMotionPlayback3D').epoch).toBe(1); w.tick(); expect(m(w).motor.positionQ.z).toBe(z + 1000); });
    it('JSON restore replays body, driver, root feedback and actor event IDs exactly', () => { const a = rootWorld(true); a.tick(); a.tick(); const snapshot = JSON.parse(JSON.stringify(a.snapshot())), order = a.snapshotOrder(); a.tick(); const expected = a.snapshot(); a.restore(snapshot, order); a.tick(); expect(a.snapshot()).toEqual(expected); });
    it('bad source timing/alias or late driver command rejects before any movement or source commit', () => { for (const mutate of [(w: World) => w.addComponent('actor', { ...rootConfig(), durationSubticks: 8000, samples: [{ atSubtick: 0, positionQ: { x: 0, z: 0 }, yawUnits: 0 }, { atSubtick: 8000, positionQ: { x: 0, z: 4000 }, yawUnits: 0 }] }), (w: World) => w.addComponent('actor', { type: 'RootMotionSource3D', version: 1, driver: { kind: 'animation-driver', clip: 'missing' } }), (w: World) => w.addComponent('actor', { type: 'AnimationDriverCommand3D', version: 1, commands: [{ seq: 1, op: 'play', state: 'unknown' }] })]) {
        const w = rootWorld();
        mutate(w);
        const before = hashSnapshot(w.snapshot());
        expect(() => w.tick()).toThrow();
        expect(hashSnapshot(w.snapshot())).toBe(before);
        expect(w.getComponent('actor', 'CharacterMotorPlayback3D')).toBeUndefined();
    } });
    it('move/facing remain exclusive while jump Y is still owned by the same capsule channel', () => { for (const intent of [{ move: { seq: 1, xQ: 0, zQ: 10000, gait: 'walk', stance: 'standing' } }, { facing: { seq: 1, mode: 'direction', xQ: 0, zQ: 10000 } }]) {
        const w = rootWorld();
        w.addComponent('actor', { type: 'CharacterMotorIntent3D', version: 1, ...intent });
        const before = hashSnapshot(w.snapshot());
        expect(() => w.tick()).toThrow(/exclusive|excludes/);
        expect(hashSnapshot(w.snapshot())).toBe(before);
    } const w = rootWorld(); w.addComponent('actor', { type: 'CharacterMotorIntent3D', version: 1, jump: { seq: 1 } }); w.tick(); expect(m(w).motor.positionQ.y).toBeGreaterThan(0); expect(m(w).motor.positionQ.z).toBe(1000); });
    it('inactive D1 source advances driverTick at zero displacement, then retriggers without a debt', () => { const w = rootWorld(), c = rootDriver(); (c.graph.clips as any).idle = { asset: 'inplace/idle', clip: 'idle', loop: true }; (c.clips as any).idle = { durationTicks: 4 }; (c.graph.states as any).wait = { clip: 'idle' }; w.addComponent('actor', { ...c, initialState: 'wait' }); for (let i = 0; i < 3; i++)
        w.tick(); expect(m(w).motor.positionQ.z).toBe(0); expect(d(w).tick).toBe(3); expect(w.getComponent<any>('actor','RootMotionPlayback3D').lastFeedback).toBeUndefined(); w.addComponent('actor', { type: 'AnimationDriverCommand3D', version: 1, commands: [{ seq: 1, op: 'play', state: 'go' }] }); w.tick(); expect(m(w).motor.positionQ.z).toBe(0); w.tick(); expect(m(w).motor.positionQ.z).toBe(1000); });
});
it('performance full-body source drives the same motor and consumes its final once interval before clean return', () => {
    const w = rootWorld(), bones = ['Hips', 'Spine', 'Chest', 'Neck', 'Head', 'LeftUpperArm', 'LeftLowerArm', 'LeftHand', 'RightUpperArm', 'RightLowerArm', 'RightHand', 'LeftUpperLeg', 'LeftLowerLeg', 'LeftFoot', 'RightUpperLeg', 'RightLowerLeg', 'RightFoot'];
    w.addComponent('actor', { type: 'AnimationPerformance3D', version: 1, tickRate: 30, clips: { root: { asset: 'inplace/root', clipName: 'root', sourceSha256: 'b'.repeat(64), retarget: 'exact', durationTicks: 4 } }, slots: { body: { order: 0, mode: 'override', bones, weightQ: 1000000 } }, montages: { action: { slot: 'body', priority: 1, blendInTicks: 0, blendOutTicks: 0, sections: [{ id: 'body', clip: 'root', startTick: 0, endTick: 4, mode: 'once' }] } } });
    w.addComponent('actor', { type: 'RootMotionSource3D', version: 1, driver: { kind: 'performance-slot', slot: 'body', clip: 'root' } });
    w.tick();
    expect(m(w).motor.positionQ.z).toBe(0);
    w.addComponent('actor', { type: 'AnimationPerformanceCommand3D', version: 1, commands: [{ seq: 1, op: 'play', montage: 'action' }] });
    w.tick();
    expect(m(w).motor.positionQ.z).toBe(0);
    for (let i = 1; i <= 4; i++) {
        w.tick();
        expect(m(w).motor.positionQ.z).toBe(i * 1000);
    }
    expect(w.getComponent<any>('actor', 'AnimationPerformancePlayback3D').slots.body).toBeUndefined();
    w.tick();
    expect(m(w).motor.positionQ.z).toBe(4000);
});
it('warp reads a sim Transform anchor in XZ, ignores render yaw, and reaches its bounded endpoint', () => { const w = rootWorld(); w.createEntity('anchor'); w.addComponent('anchor', { type: 'Transform', x: .1, y: .5, rotation: Math.PI, scaleX: 1, scaleY: 1 }); w.addComponent('anchor', { type: 'Transform3D', x: 99, y: 99, z: 99, rotY: 2 }); w.addComponent('actor', { ...rootConfig(), warp: { startSubtick: 0, endSubtick: 4000, maxCorrectionQ: 5000, maxYawCorrectionUnits: 0 } }); w.addComponent('actor', { type: 'RootMotionSource3D', version: 1, driver: { kind: 'animation-driver', clip: 'step' }, warpAnchorId: 'anchor' }); for (let i = 0; i < 4; i++)
    w.tick(); expect(m(w).motor.positionQ.x).toBe(1000); expect(m(w).motor.positionQ.z).toBe(5000); expect(m(w).yawUnits).toBe(0); });
it('mixed D1 root and half-restored root/driver tuple reject atomically', () => { const w = rootWorld(); w.tick(); const saved = w.getComponent<any>('actor', 'RootMotionPlayback3D'); w.addComponent('actor', { ...saved, lastDriverTick: 0 }); const before = hashSnapshot(w.snapshot()); expect(() => w.tick()).toThrow(/tick|lifecycle/); expect(hashSnapshot(w.snapshot())).toBe(before); const a = rootWorld(), c = rootDriver(); (c.graph.clips as any).other = { asset: 'other', clip: 'other', loop: false }; (c.clips as any).other = { durationTicks: 4 }; (c.graph.states as any).mixed = { clip: 'other' }; (c.graph.params as any).switch = 'flag:blend'; (c.graph.transitions as any).push({ from: 'go', to: 'mixed', whenParam: 'switch', cmp: 'eq', value: true, fade: 2 / 30 }); a.addComponent('actor', c); a.createEntity('blend'); a.addComponent('blend', { type: 'Flag', id: 'blend', active: true }); const old = hashSnapshot(a.snapshot()); expect(() => a.tick()).toThrow(/mixed|fading/); expect(hashSnapshot(a.snapshot())).toBe(old); });
it('root request limit overflow and corrupted feedback leave both body and source unadvanced', () => { const w = rootWorld(); w.addComponent('actor', { ...rootConfig(), limits: { ...rootConfig().limits, maxDeltaQ: 100 } }); const before = hashSnapshot(w.snapshot()); expect(() => w.tick()).toThrow(/limit/); expect(hashSnapshot(w.snapshot())).toBe(before); const a = rootWorld(); a.tick(); const p = JSON.parse(JSON.stringify(a.getComponent<any>('actor', 'RootMotionPlayback3D'))); p.lastFeedback.actorId = 'wrong'; a.addComponent('actor', p); const saved = hashSnapshot(a.snapshot()); expect(() => a.tick()).toThrow(/feedback/); expect(hashSnapshot(a.snapshot())).toBe(saved); });
it('ordinary non-root D1 actors still advance in their existing phase21 system', () => { const w = new World({ strict: true }); for (const s of animationDriverCapability.systems)
    w.addSystem(s); w.createEntity('plain'); w.addComponent('plain', rootDriver()); w.tick(); expect(w.getComponent<any>('plain', 'AnimationDriverPlayback3D').tick).toBe(1); expect(w.getComponent<any>('plain', 'AnimationDriverPlayback3D').clips.step.cursorSubticks).toBe(1000); });
it('inactive root container has no feedback identity; active-idle-retrigger rebinds real instance without paying idle distance',()=>{
 const w=rootWorld(),c=rootDriver();(c.graph.clips as any).idle={asset:'inplace/idle',clip:'idle',loop:true};(c.clips as any).idle={durationTicks:4};(c.graph.states as any).wait={clip:'idle'};w.addComponent('actor',c);w.tick();w.tick();const firstInstance=d(w).clips.step.instance,z=m(w).motor.positionQ.z;
 w.addComponent('actor',{type:'AnimationDriverCommand3D',version:1,commands:[{seq:1,op:'play',state:'wait'}]});for(let i=0;i<4;i++){w.tick();expect(m(w).motor.positionQ.z).toBe(z);expect(w.getComponent<any>('actor','RootMotionPlayback3D').lastFeedback).toBeUndefined();expect(d(w).weights.step).toBe(0);}
 w.addComponent('actor',{type:'AnimationDriverCommand3D',version:1,commands:[{seq:2,op:'play',state:'go'}]});w.tick();expect(d(w).clips.step.instance).toBeGreaterThan(firstInstance);expect(w.getComponent<any>('actor','RootMotionPlayback3D').instance).toBe(d(w).clips.step.instance);expect(m(w).motor.positionQ.z).toBe(z);w.tick();expect(m(w).motor.positionQ.z).toBe(z+1000);
});
it('a forged physics result cannot be accepted or mutate the World/root proposal',async()=>{
 const {prepareRootMotionWorldStep,acceptRootMotionWorldStep}=await import('./root-motion-plan.js'),{prepareAnimationDriverStep}=await import('./animation-driver.js'),{createCharacterMotorPlayback3D,stepCharacterMotorPlayback3D}=await import('@engine/spatial/character-motor-driver.js'),{motorStaticObstacles}=await import('@engine/spatial/character-motor-world.js');const w=rootWorld(),config=rootMotor(),obstacles=motorStaticObstacles(w.readView(),'actor'),previous=createCharacterMotorPlayback3D(config,obstacles),base=prepareAnimationDriverStep(w,'actor')!,plan=prepareRootMotionWorldStep(w,'actor',config,previous,{base})!,request=plan.request!,accepted=stepCharacterMotorPlayback3D(config,previous,'actor',undefined,obstacles,{requestId:'local-test',deltaQ:request.deltaQ,yawDeltaUnits:request.yawDeltaUnits}),bad=JSON.parse(JSON.stringify(accepted));bad.result.acceptedDeltaQ.z++;
 const worldBefore=hashSnapshot(w.snapshot()),pendingBefore=JSON.stringify(plan);expect(()=>acceptRootMotionWorldStep(plan,previous,bad)).toThrow(/feedback/);expect(hashSnapshot(w.snapshot())).toBe(worldBefore);expect(JSON.stringify(plan)).toBe(pendingBefore);expect(acceptRootMotionWorldStep(plan,previous,accepted).pose?.positionQ.z).toBe(1000);
});
