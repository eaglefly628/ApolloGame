/** Shared read-only native readiness boundary. This observes a committed source;
 * previous->next terminal intervals remain the World planner's responsibility. */
import {driverFields,validateAnimationDriver3D,validateAnimationDriverPlayback3D,type AnimationDriver3D,type AnimationDriverPlayback3D} from '../protocol/components/animation-driver.js';
import {validateAnimationPerformance3D,validateAnimationPerformancePlayback3D,type AnimationPerformance3D,type AnimationPerformancePlayback3D} from '../protocol/components/animation-performance.js';
import {validateRootMotionSource3D,type RootMotion3D,type RootMotionSource3D,type RootMotionCursor} from '../protocol/components/root-motion.js';
import {validateRootMotion3D} from './root-motion.js';
export interface RootMotionSourceObservation {readonly active:boolean;readonly instance:number;readonly driverTick:number;readonly cursor:RootMotionCursor;readonly asset:string;readonly clipName:string;readonly retarget:'exact'|'humanoid';}
export interface RootMotionSourceSnapshots {readonly baseConfig?:AnimationDriver3D;readonly basePlayback?:AnimationDriverPlayback3D;readonly performanceConfig?:AnimationPerformance3D;readonly performancePlayback?:AnimationPerformancePlayback3D;}
function fail(s:string):never{throw Error('root-motion-source: '+s);}
export function inspectRootMotionSource(curve:RootMotion3D,source:RootMotionSource3D,snapshots:RootMotionSourceSnapshots):RootMotionSourceObservation {
 validateRootMotion3D(curve);validateRootMotionSource3D(source);
 driverFields(snapshots,['baseConfig','basePlayback','performanceConfig','performancePlayback'],'root source snapshots');
 if(source.driver.kind==='animation-driver'){
  const c=snapshots.baseConfig,p=snapshots.basePlayback;if(!c||!p)fail('D1 configuration and playback required');
  validateAnimationDriver3D(c);validateAnimationDriverPlayback3D(c,p);
  const alias=source.driver.clip,spec=c.graph.clips[alias],timing=c.clips[alias],cursor=p.clips[alias];
  if(!spec?.asset||!timing||!cursor)fail('external D1 source alias required');
  if(c.tickRate!==curve.tickRate||timing.durationTicks*1000!==curve.durationSubticks||(spec.loop?'repeat':'once')!==curve.loop)fail('D1 source clock/loop mismatch');
  const weight=p.weights[alias];if(weight>0&&(weight!==1||p.transition!==undefined))fail('mixed/fading D1 root unsupported');
  return{active:weight===1,instance:cursor.instance,driverTick:p.tick,cursor:{cycle:cursor.cycle,subtick:cursor.cursorSubticks},asset:spec.asset,clipName:spec.clip,retarget:spec.retarget==='humanoid'?'humanoid':'exact'};
 }
 const c=snapshots.performanceConfig,p=snapshots.performancePlayback;if(!c||!p)fail('performance configuration and playback required');
 validateAnimationPerformance3D(c);validateAnimationPerformancePlayback3D(c,p);
 const {slot,clip}=source.driver,spec=c.clips[clip],layer=c.slots[slot];if(!spec||!layer)fail('performance source alias/slot missing');
 if(c.tickRate!==curve.tickRate||spec.durationTicks*1000!==curve.durationSubticks||spec.sourceSha256!==curve.inPlaceClipSha256)fail('performance source clock/SHA mismatch');
 if(layer.mode!=='override'||layer.weightQ!==1000000)fail('root source must be a whole-weight override');
 const state=p.slots[slot];let active=false,instance=0,cursor:RootMotionCursor={cycle:0,subtick:0};
 if(state){if(state.outgoing&&state.outgoing.weightQ>0&&c.montages[state.outgoing.montage].sections[state.outgoing.sectionIndex].clip===clip)fail('mixed/fading outgoing performance root unsupported');
 const section=c.montages[state.montage].sections[state.sectionIndex];if(section.clip===clip){
  if(section.startTick!==0||section.endTick!==spec.durationTicks||(section.mode==='hold'?'repeat':'once')!==curve.loop)fail('root source cannot trim or change loop');
  if(state.weightQ>0&&(state.weightQ!==1000000||state.outgoing||state.phase!=='playing'))fail('mixed/fading performance root unsupported');
  active=state.weightQ===1000000;instance=state.instance;cursor={cycle:state.cycle,subtick:(section.startTick+state.cursorTick)*1000};
 }}
 return{active,instance,driverTick:p.tick,cursor,asset:spec.asset,clipName:spec.clipName,retarget:spec.retarget};
}
