import { describe, it, expect } from 'vitest';
import { validate, type Schema } from '../../core/schema.js';
import { validateAnimationPerformance3D, validateAnimationPerformanceCommand3D, validateAnimationPerformancePlayback3D, ANIMATION_PERFORMANCE_SCHEMAS, performanceIdentity, performanceEventId } from './animation-performance.js';
import { createAnimationPerformance, stepAnimationPerformance } from '../../animation/performance-driver.js';
import type { AnimationPerformance3D } from './animation-performance.js';
function fixture(): AnimationPerformance3D { return { type: 'AnimationPerformance3D', version: 1, tickRate: 30, clips: { act: { asset: 'motion', clipName: 'act', sourceSha256: 'a'.repeat(64), retarget: 'exact', durationTicks: 4, notifies: [{ id: 'hit', atTick: 1 }] }, ref: { asset: 'reference', clipName: 'ref', sourceSha256: 'b'.repeat(64), retarget: 'exact', durationTicks: 1 } }, slots: { upper: { order: 0, mode: 'override', bones: ['Spine', 'RightHand'], weightQ: 1000000 }, add: { order: 1, mode: 'additive', bones: ['Head'], weightQ: 500000, reference: { clip: 'ref', atTick: 0 } } }, montages: { once: { slot: 'upper', priority: 1, blendInTicks: 1, blendOutTicks: 1, sections: [{ id: 'body', clip: 'act', startTick: 0, endTick: 4, mode: 'once' }] } } }; }
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
describe('D3 closed protocol and untrusted JSON snapshots', () => {
    it('has exact versioned config, actual nested schemas, and no any/string placeholders', () => { const c = fixture(); expect(validateAnimationPerformance3D(c)).toBe(c); const { type, ...raw } = c; expect(type).toBe('AnimationPerformance3D'); expect(validate(ANIMATION_PERFORMANCE_SCHEMAS.AnimationPerformance3D, raw)).toEqual([]); const walk = (s: Schema): void => { expect(s.k).not.toBe('any'); if (s.k === 'obj')
        Object.values(s.props).forEach(walk); if (s.k === 'rec' || s.k === 'arr' || s.k === 'opt')
        walk(s.of); if (s.k === 'union')
        s.of.forEach(walk); }; Object.values(ANIMATION_PERFORMANCE_SCHEMAS).forEach(walk); });
    it('canonical identity is stable for key order and checks exact canonical bytes as well as digest', () => { const c = fixture(), reordered = Object.fromEntries(Object.entries(c).reverse()) as unknown as AnimationPerformance3D; expect(performanceIdentity(c)).toEqual(performanceIdentity(reordered)); const p = clone(createAnimationPerformance(c, 'a')) as any; p.configIdentity.canonical += ' '; expect(() => validateAnimationPerformancePlayback3D(c, p)).toThrow(/identity/); });
    it.each([
        (c: any) => c.version = 2, (c: any) => c.tickRate = 0, (c: any) => c.foo = 1, (c: any) => c.clips.act.sourceSha256 = 'bad',
        (c: any) => c.slots.upper.bones = [], (c: any) => c.slots.upper.bones = ['*'], (c: any) => c.slots.upper.bones = ['Head', 'Head'], (c: any) => c.slots.add.order = 0,
        (c: any) => delete c.slots.add.reference, (c: any) => c.slots.add.reference.clip = 'unknown', (c: any) => c.slots.add.reference.atTick = 2, (c: any) => c.slots.upper.reference = { clip: 'ref', atTick: 0 },
        (c: any) => c.slots.upper.order = 3, (c: any) => c.montages.once.sections[0].endTick = 0, (c: any) => c.montages.once.sections[0].endTick = 5,
        (c: any) => c.montages.once.sections.push({ ...c.montages.once.sections[0] }), (c: any) => c.clips.act.notifies.push({ id: 'hit', atTick: 2 }),
        (c: any) => c.clips.act.notifies[0].atTick = 5,
    ])('refuses bad config cross-field case %#', mutate => { const c = clone(fixture()); mutate(c); expect(() => validateAnimationPerformance3D(c)).toThrow(); });
    it('refuses multiple hold loops, unknown modes and oversized masks instead of implicit fullbody', () => { for (const mode of ['fullbody', 'aimoffset']) {
        const c = clone(fixture()) as any;
        c.slots.upper.mode = mode;
        expect(() => validateAnimationPerformance3D(c)).toThrow();
    } const c = clone(fixture()) as any; c.montages.once.sections = [{ id: 'a', clip: 'act', startTick: 0, endTick: 2, mode: 'hold' }, { id: 'b', clip: 'act', startTick: 2, endTick: 4, mode: 'hold' }]; expect(() => validateAnimationPerformance3D(c)).toThrow(/hold/); });
    it('uses formal three-key command envelope; rejects unknown refs/duplicate seq/invalid op/extra props', () => { const c = fixture(); const command = { type: 'AnimationPerformanceCommand3D', version: 1, commands: [{ seq: 1, op: 'play', montage: 'once' }] }; expect(validateAnimationPerformanceCommand3D(c, command)).toBe(command); const { type, ...raw } = command; expect(validate(ANIMATION_PERFORMANCE_SCHEMAS.AnimationPerformanceCommand3D, raw)).toEqual([]); for (const bad of [{ ...command, extra: 1 }, { ...command, commands: [{ seq: 1, op: 'play', montage: 'other' }] }, { ...command, commands: [{ seq: 1, op: 'pause' }, { seq: 1, op: 'resume' }] }, { ...command, commands: [{ seq: 1, op: 'eval', code: 'anything' }] }])
        expect(() => validateAnimationPerformanceCommand3D(c, bad)).toThrow(); });
    it('no getter, hidden serializer, symbol, cyclic/shared object or nonfinite executes/escapes', () => { let calls = 0; const hook = () => { calls++; return 'Head'; }; for (const where of ['getter', 'hidden', 'symbol', 'nan', 'cycle', 'shared']) {
        const c = clone(fixture()) as any;
        if (where === 'getter')
            Object.defineProperty(c.slots.upper, 'weightQ', { get: hook, enumerable: true });
        if (where === 'hidden')
            Object.defineProperty(c, 'toJSON', { value: hook });
        if (where === 'symbol')
            c[Symbol('x')] = 1;
        if (where === 'nan')
            c.tickRate = NaN;
        if (where === 'cycle')
            c.loop = c;
        if (where === 'shared')
            c.clips.ref = c.clips.act;
        expect(() => validateAnimationPerformance3D(c)).toThrow();
    } expect(calls).toBe(0); });
    it('validates playback weights, instance, exact slot ownership, cursors and actor-scoped cue source', () => { const c = fixture(); let p = createAnimationPerformance(c, 'actor'); p = stepAnimationPerformance(c, p, { commands: [{ seq: 1, op: 'play', montage: 'once' }] }); p = stepAnimationPerformance(c, p); const { type, ...raw } = p; expect(validate(ANIMATION_PERFORMANCE_SCHEMAS.AnimationPerformancePlayback3D, raw)).toEqual([]); for (const mutate of [(x: any) => x.slots.upper.weightQ = 123, (x: any) => x.slots.upper.instance = x.nextInstance, (x: any) => x.slots.upper.cursorTick = 99, (x: any) => x.slots.add = x.slots.upper, (x: any) => x.events[0].actorId = 'another', (x: any) => x.events.find((e: any) => e.kind === 'notify').cueId = 'unknown']) {
        const bad = clone(p);
        mutate(bad);
        expect(() => validateAnimationPerformancePlayback3D(c, bad)).toThrow();
    } });
    it('checks cue timestamp against the clip metadata rather than accepting a stable-looking event ID', () => { const c = fixture(); let p = stepAnimationPerformance(c, createAnimationPerformance(c, 'a'), { commands: [{ seq: 1, op: 'play', montage: 'once' }] }); p = stepAnimationPerformance(c, p); const bad = clone(p) as any, e = bad.events.find((e: any) => e.kind === 'notify'); e.atTick = 2; e.id = performanceEventId(e); expect(() => validateAnimationPerformancePlayback3D(c, bad)).toThrow(/source/); });
});
it('rejects impossible unstarted blend progress and fabricated command provenance on a source notify',()=>{const c=fixture();let p=stepAnimationPerformance(c,createAnimationPerformance(c,'a'),{commands:[{seq:1,op:'play',montage:'once'}]});const bad=clone(p) as any;bad.slots.upper.blendElapsedTicks=1;bad.slots.upper.weightQ=1000000;expect(()=>validateAnimationPerformancePlayback3D(c,bad)).toThrow(/unstarted/);p=stepAnimationPerformance(c,p);const q=clone(p) as any,e=q.events.find((x:any)=>x.kind==='notify');e.commandSeq=1;e.id=performanceEventId(e);expect(()=>validateAnimationPerformancePlayback3D(c,q)).toThrow(/provenance/);});
it.each([{seq:1,op:'play',montage:'once'},{seq:1,op:'release',slot:'upper'},{seq:1,op:'cancel',slot:'upper'},{seq:1,op:'pause'},{seq:1,op:'resume'},{seq:1,op:'preview-seek',slot:'upper',section:'body',tick:1}])('all command tags use real literal schema branches: $op',command=>{const raw={version:1,commands:[command]};expect(validate(ANIMATION_PERFORMANCE_SCHEMAS.AnimationPerformanceCommand3D,raw)).toEqual([]);expect(()=>validateAnimationPerformanceCommand3D(fixture(),{type:'AnimationPerformanceCommand3D',...raw})).not.toThrow();});
it('requires a retarget policy for every action and reference clip, accepting only exact or humanoid',()=>{for(const name of ['act','ref']){const c=clone(fixture()) as any;delete c.clips[name].retarget;expect(()=>validateAnimationPerformance3D(c)).toThrow();c.clips[name].retarget='guess';expect(()=>validateAnimationPerformance3D(c)).toThrow();c.clips[name].retarget='humanoid';expect(()=>validateAnimationPerformance3D(c)).not.toThrow();}});
