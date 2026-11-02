import { describe, it, expect } from 'vitest';
import { validateRootMotions } from './root-motions.js';
import { World } from '@engine/core/world.js';
import type { Component } from '@engine/core/types.js';
import type { RootMotion3D } from '@engine/protocol/components/root-motion.js';
import type { CharacterMotor3D } from '@engine/protocol/components/character-motor.js';
import type { AnimationDriver3D } from '@engine/protocol/components/animation-driver.js';
import { characterMotorCapability } from '@skills/tier2/character-motor.js';
import { animationDriverCapability } from '@skills/tier2/animation-driver.js';
import { animationPerformanceCapability } from '@skills/tier2/animation-performance.js';
import { rootMotionCapability } from '@skills/tier2/root-motion.js';
function rootMotor(): CharacterMotor3D { return { type: 'CharacterMotor3D', version: 1, motion: { version: 1, unitsPerMeter: 10000, tickRate: 30, body: { kind: 'capsule', radiusQ: 1000, standingHeightQ: 18000, crouchedHeightQ: 10000, skinQ: 2 }, maxWalkSpeedQps: 12000, maxRunSpeedQps: 24000, maxCrouchSpeedQps: 6000, accelQps2: 40000, brakeQps2: 60000, airControlQps2: 20000, gravityQps2: 98000, jumpSpeedQps: 40000, terminalFallSpeedQps: 100000, recoverTicks: 2, collision: { kind: 'static-aabb', maxObstacles: 16, maxContacts: 8, maxSlideIterations: 8, maxDeltaQ: 1000000 } }, initial: { positionQ: { x: 0, y: 0, z: 0 }, stance: 'standing', yawUnits: 0 }, maxTurnUnitsPerSecond: 65536 }; }
function rootConfig(loop: 'once' | 'repeat' = 'once'): RootMotion3D { return { type: 'RootMotion3D', version: 1, sourceSha256: 'a'.repeat(64), inPlaceClipSha256: 'b'.repeat(64), carrier: { policy: 'hips-linear-xz-v1', bone: 'Hips', vertical: 'motor' }, tickRate: 30, durationSubticks: 4000, loop, endpointPolicy: 'accumulate-se2', samples: [{ atSubtick: 0, positionQ: { x: 0, z: 0 }, yawUnits: 0 }, { atSubtick: 4000, positionQ: { x: 0, z: 4000 }, yawUnits: 0 }], limits: { maxDeltaQ: 100000, maxYawDeltaUnits: 0, maxCyclesPerStep: 4 } }; }
function rootDriver(loop = false): AnimationDriver3D { return { type: 'AnimationDriver3D', version: 1, tickRate: 30, initialState: 'go', graph: { type: 'AnimGraph3D', clips: { step: { asset: 'inplace/step', clip: 'step', loop } }, states: { go: { clip: 'step' }, idle: { clip: 'step' } }, params: { speed: 'speed' }, transitions: [] }, clips: { step: { durationTicks: 4, notifies: [{ id: 'cue', atTick: 1 }] } } }; }
function rootWorld(loop = false) { const w = new World({ strict: true }); for (const cap of [rootMotionCapability, characterMotorCapability, animationDriverCapability, animationPerformanceCapability])
    for (const s of cap.systems)
        w.addSystem(s); w.createEntity('actor'); for (const c of [rootMotor(), rootConfig(loop ? 'repeat' : 'once'), rootDriver(loop), { type: 'RootMotionSource3D', version: 1, driver: { kind: 'animation-driver', clip: 'step' } }, { type: 'Model3D', modelKey: 'synthetic' }])
    w.addComponent('actor', c as Component); w.createEntity('floor'); w.addComponent('floor', { type: 'Transform', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }); w.addComponent('floor', { type: 'Collider3D', kind: 'box', halfX: 100, halfY: .5, halfZ: 100, baseY: -1 }); return w; }
const scene = (): Record<string, any> => ({ actor: { RootMotion3D: rootConfig(), RootMotionSource3D: { version: 1, driver: { kind: 'animation-driver', clip: 'step' } }, CharacterMotor3D: rootMotor(), AnimationDriver3D: rootDriver(), Model3D: { modelKey: 'synthetic' } } });
describe('root-motion atomic scene import/directload boundary', () => {
    it('leaves legacy scene semantics untouched and accepts structural root bootstrap without initializing it', () => { expect(() => validateRootMotions({ legacy: { Other: { n: NaN } } }, NaN)).not.toThrow(); const s = scene(), before = JSON.stringify(s); validateRootMotions(s, 30); expect(JSON.stringify(s)).toBe(before); expect(s.actor.RootMotionPlayback3D).toBeUndefined(); });
    it.each(['RootMotionSource3D', 'RootMotionPlayback3D'])('orphan %s rejects', type => { expect(() => validateRootMotions({ actor: { [type]: { version: 1 } } })).toThrow(/orphan/); });
    it('requires same motor/source/base/model and exact clock, timing and loop metadata', () => { for (const mutate of [(s: any) => delete s.actor.CharacterMotor3D, (s: any) => delete s.actor.RootMotionSource3D, (s: any) => delete s.actor.AnimationDriver3D, (s: any) => delete s.actor.Model3D, (s: any) => s.actor.RootMotion3D.tickRate = 60, (s: any) => s.actor.RootMotion3D.loop = 'repeat']) {
        const s = scene();
        mutate(s);
        expect(() => validateRootMotions(s, 30)).toThrow();
    } });
    it('accepts JSON snapshot tuple and rejects wrong actor, pending/tick/cursor or missing body pair', () => {
        const w = rootWorld();
        w.tick();
        const saved = w.snapshot() as any;
        const toScene = () => Object.fromEntries(Object.entries(saved.entities ?? saved).map(([id, v]: any) => [id, v.components ?? v]));
        const current = toScene();
        // World snapshots are component arrays; use public component reads to make the blueprint envelope.
        const row: any = {};
        for (const type of ['RootMotion3D', 'RootMotionSource3D', 'RootMotionPlayback3D', 'CharacterMotor3D', 'CharacterMotorPlayback3D', 'CharacterMotorEnvironment3D', 'AnimationDriver3D', 'AnimationDriverPlayback3D', 'Model3D', 'Transform', 'Collider3D']) {
            const c = w.getComponent('actor', type);
            if (c)
                row[type] = JSON.parse(JSON.stringify(c));
        }
        expect(current).toBeTruthy();
        validateRootMotions({ actor: row }, 30);
        for (const change of [(r: any) => delete r.CharacterMotorPlayback3D, (r: any) => r.RootMotionPlayback3D.actorId = 'other', (r: any) => r.RootMotionPlayback3D.lastDriverTick = 0, (r: any) => r.RootMotionPlayback3D.cursor.subtick = 0]) {
            const r = JSON.parse(JSON.stringify(row));
            change(r);
            expect(() => validateRootMotions({ actor: r }, 30)).toThrow();
        }
    });
    it('whole new scene rejects late invalid actor without changing original bytes and executes no getter', () => { const s = scene(); s.zzLate = { RootMotionSource3D: { version: 1, driver: { kind: 'animation-driver', clip: 'x' } } }; const before = JSON.stringify(s); expect(() => validateRootMotions(s)).toThrow(); expect(JSON.stringify(s)).toBe(before); let calls = 0; const raw = scene(); Object.defineProperty(raw.actor.RootMotion3D, 'tickRate', { get() { calls++; return 30; }, enumerable: true }); expect(() => validateRootMotions(raw)).toThrow(); expect(calls).toBe(0); });
    it('warp requires a real sim Transform on Q grid; render-only anchor cannot satisfy it', () => { const s = scene(); s.actor.RootMotion3D.warp = { startSubtick: 0, endSubtick: 4000, maxCorrectionQ: 1000, maxYawCorrectionUnits: 0 }; s.actor.RootMotionSource3D.warpAnchorId = 'anchor'; s.anchor = { Transform3D: { x: 0, y: 0, z: 0 } }; expect(() => validateRootMotions(s)).toThrow(/sim Transform/); s.anchor.Transform = { x: 0, y: .1, rotation: 5, scaleX: 1, scaleY: 1 }; expect(() => validateRootMotions(s)).not.toThrow(); });
});
it('performance root mask cannot be partial and performance curves require exact in-place SHA', () => { const s = scene(); s.actor.AnimationPerformance3D = { type: 'AnimationPerformance3D', version: 1, tickRate: 30, clips: { body: { asset: 'body', clipName: 'body', sourceSha256: 'b'.repeat(64), retarget: 'exact', durationTicks: 4 } }, slots: { body: { order: 0, mode: 'override', bones: ['Head'], weightQ: 1000000 } }, montages: { m: { slot: 'body', priority: 0, blendInTicks: 0, blendOutTicks: 0, sections: [{ id: 'body', clip: 'body', startTick: 0, endTick: 4, mode: 'once' }] } } }; s.actor.RootMotionSource3D = { version: 1, driver: { kind: 'performance-slot', slot: 'body', clip: 'body' } }; expect(() => validateRootMotions(s)).toThrow(/full-body/); s.actor.AnimationPerformance3D.clips.body.sourceSha256 = 'c'.repeat(64); expect(() => validateRootMotions(s)).toThrow(/SHA/); });
