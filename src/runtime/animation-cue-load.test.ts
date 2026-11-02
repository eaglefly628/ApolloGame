import {describe,it,expect} from 'vitest';
import {Engine} from './engine.js';
import {parseManifest} from '@assembly/manifest.js';
import type {AnimationCueSignalsPlayback3D} from '@engine/protocol/components/animation-cue-signals.js';
const actor=()=>({Model3D:{modelKey:'synthetic'},AnimationDriver3D:{version:1,tickRate:30,initialState:'act',graph:{type:'AnimGraph3D',clips:{act:{clip:'act',loop:false}},states:{act:{clip:'act'}},params:{unused:'flag:unused'},transitions:[]},clips:{act:{durationTicks:3,notifies:[{id:'hit',atTick:1}]}}},AnimationCueSignals3D:{version:1,maxSignalsPerTick:1,bindings:[{id:'hit',match:{kind:'base-notify',clip:'act',cueId:'hit'},signal:'impact'}]}});
describe('additive actor animation event installation',()=>{
 it('installs shared cue phases once while routing each new actor independently',()=>{const e=new Engine({tickRate:30});for(const id of ['a','b'])e.load(parseManifest({meta:{tickRate:30},entities:{[id]:actor()}}));expect(()=>e.world.tick()).not.toThrow();expect(e.world.query('Signal').map(([id])=>id).sort()).toEqual(['animation-cue:a:1','animation-cue:b:1']);for(const id of ['a','b'])expect(e.world.getComponent<AnimationCueSignalsPlayback3D>(id,'AnimationCueSignalsPlayback3D')!.seq).toBe(1);expect(()=>e.world.tick()).not.toThrow();expect(e.world.query('Signal')).toEqual([]);});
});
