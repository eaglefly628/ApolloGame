import {defineCapability} from '@engine/core/define-capability.js';
import {defineComponent} from '@engine/core/define-component.js';
import {defineSystem} from '@engine/core/define-system.js';
import {SystemPhase,type IWorld} from '@engine/core/types.js';
import {ANIMATION_PERFORMANCE_SCHEMAS,validateAnimationPerformance3D,validateAnimationPerformancePlayback3D,validateAnimationPerformanceCommand3D,type AnimationPerformance3D,type AnimationPerformancePlayback3D,type AnimationPerformanceCommand3D} from '@engine/protocol/components/animation-performance.js';
import {createAnimationPerformance,stepAnimationPerformance} from '@engine/animation/performance-driver.js';
import {findDebugTrace,appendTrace} from '../debug-trace.js';

/** Shared with the motor transaction: motor actors commit their movement and
 * performance together. This function is pure with respect to the World. */
export function prepareAnimationPerformanceStep(view:Pick<IWorld,'getComponent'>,id:string):AnimationPerformancePlayback3D|undefined {
 const config=view.getComponent<AnimationPerformance3D>(id,'AnimationPerformance3D');
 if(!config){
  if(view.getComponent(id,'AnimationPerformancePlayback3D')||view.getComponent(id,'AnimationPerformanceCommand3D'))throw Error('animation-performance: orphan playback/command');
  return undefined;
 }
 validateAnimationPerformance3D(config);
 const previous=view.getComponent<AnimationPerformancePlayback3D>(id,'AnimationPerformancePlayback3D');
 if(previous){validateAnimationPerformancePlayback3D(config,previous);if(previous.actorId!==id)throw Error('animation-performance: snapshot actor mismatch');}
 const command=view.getComponent<AnimationPerformanceCommand3D>(id,'AnimationPerformanceCommand3D');
 if(command)validateAnimationPerformanceCommand3D(config,command);
 return stepAnimationPerformance(config,previous??createAnimationPerformance(config,id),{commands:command?.commands??[]});
}
const schema=ANIMATION_PERFORMANCE_SCHEMAS;
const provides={
 AnimationPerformance3D:defineComponent('AnimationPerformance3D',schema.AnimationPerformance3D.props,{category:'config',sim:true,describe:'Fixed-tick montage sections, ordered explicit bone masks, override/additive slots, interrupt priorities and bounded two-source crossfades. Layers are applied over the separate authoritative base driver.',refine(value){try{validateAnimationPerformance3D({...value,type:'AnimationPerformance3D'});return [];}catch(error){return [{path:'',severity:'error' as const,message:String(error)}];}}}),
 AnimationPerformancePlayback3D:defineComponent('AnimationPerformancePlayback3D',schema.AnimationPerformancePlayback3D.props,{category:'config',sim:true,describe:'Snapshot-owned actor and montage instances, section/hold cursors, fades, outgoing poses and current-tick cue identities. Renderer never advances these cursors.'}),
 AnimationPerformanceCommand3D:defineComponent('AnimationPerformanceCommand3D',schema.AnimationPerformanceCommand3D.props,{category:'intent',sim:true,describe:'Monotonic sequence play/release/cancel/pause/resume/preview-seek operations; validated against the same actor performance configuration. Preview seeking emits no gameplay cue.'}),
};
const reads=['AnimationPerformance3D','AnimationPerformancePlayback3D','AnimationPerformanceCommand3D','CharacterMotor3D'];
export const animationPerformanceCapability=defineCapability({
 id:'t2-animation-performance',version:'1.0.0',
 describe:{name:'animation-performance',summary:'Authoritative montage slots and section lifecycle layered over D1/Locomotion, with explicit masks, additive reference poses and snapshot-owned cues.',semantic:['tier2','animation','deterministic','cinematic'],whenToUse:'Attach to a Model3D actor with one D1 or Locomotion base. Use explicit bone masks and verified source clip hashes. CharacterMotor actors stage this clock atomically in their motor transaction; other actors advance once after the base clock.',examples:['Walk while holding an upper-body interaction montage, release the hold section and return to locomotion.','Interrupt an attack montage with a higher-priority reaction and restore both fade sources from a snapshot.']},
 components:{provides,reads,writes:['AnimationPerformancePlayback3D'],consumes:[]},config:{},
 systems:[defineSystem({id:'animation-performance',phase:SystemPhase.Commit+3,reads,writes:['AnimationPerformancePlayback3D'],run(view){
  const actors=view.query('AnimationPerformance3D').map(([id])=>id).sort();if(!actors.length)return;
  const trace=findDebugTrace(view as unknown as IWorld),staged:Array<[string,AnimationPerformancePlayback3D]>=[];
  try{for(const id of actors){
   if(view.getComponent(id,'CharacterMotor3D'))continue;
   const playback=prepareAnimationPerformanceStep(view,id);if(playback)staged.push([id,playback]);
  }}catch(error){appendTrace(trace,view.getVersion(),'animation-performance','reject','performance batch not advanced',String(error));throw error;}
  let cues=0,changes=0;
  for(const[id,playback]of staged){if(trace)for(const event of playback.events){if(event.kind==='notify')cues++;else changes++;}view.addComponent(id,playback);}
  if(trace&&changes)appendTrace(trace,view.getVersion(),'animation-performance','transition',`${changes} montage lifecycle decisions committed`);
  if(trace&&cues)appendTrace(trace,view.getVersion(),'animation-performance','commit',`${cues} snapshot-owned cues committed`);
 }})],
});
