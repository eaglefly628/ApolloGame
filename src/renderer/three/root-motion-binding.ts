import type{RootMotion3D,RootMotionSource3D}from'@engine/protocol/components/root-motion.js';
import{driverFields,validateAnimationDriver3D,validateAnimationDriverPlayback3D}from'@engine/protocol/components/animation-driver.js';
import{validateAnimationPerformance3D,validateAnimationPerformancePlayback3D}from'@engine/protocol/components/animation-performance.js';
import{inspectRootMotionSource,type RootMotionSourceSnapshots,type RootMotionSourceObservation}from'@engine/animation/root-motion-source.js';
/** Only committed snapshots; no World/skill import, pending request or render clock. */
export interface NativeRootMotionBinding extends RootMotionSourceSnapshots {readonly curve:RootMotion3D;readonly source:RootMotionSource3D}
export function prepareNativeRootMotion(raw:unknown,entityId:string):{binding:NativeRootMotionBinding;observation:RootMotionSourceObservation}{
 const r=driverFields(raw,['curve','source','baseConfig','basePlayback','performanceConfig','performancePlayback'],'native root binding');
 if(!r.curve||!r.source)throw Error('RootMotion3D and RootMotionSource3D pair required');
 if(r.baseConfig)validateAnimationDriver3D(r.baseConfig);if(r.basePlayback){if(!r.baseConfig)throw Error('root base config missing');validateAnimationDriverPlayback3D(r.baseConfig as never,r.basePlayback);}
 if(r.performanceConfig)validateAnimationPerformance3D(r.performanceConfig);if(r.performancePlayback){if(!r.performanceConfig)throw Error('root performance config missing');const p=validateAnimationPerformancePlayback3D(r.performanceConfig as never,r.performancePlayback);if(p.actorId!==entityId)throw Error('root performance actor identity mismatch');}
 // Shared inspector validates curve/source and all used source fields before copy.
 const observation=inspectRootMotionSource(r.curve as RootMotion3D,r.source as RootMotionSource3D,{baseConfig:r.baseConfig,basePlayback:r.basePlayback,performanceConfig:r.performanceConfig,performancePlayback:r.performancePlayback} as RootMotionSourceSnapshots);
 const binding=JSON.parse(JSON.stringify(r)) as NativeRootMotionBinding;return{binding,observation};
}
