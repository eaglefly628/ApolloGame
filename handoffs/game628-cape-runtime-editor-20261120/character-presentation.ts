import type {IWorld} from '@engine/core/types.js';
import { modelYawFromFaceDir, turnModelYaw } from '@renderer/three/model-motion.js';
import type {AnimState3D,FaceDir,Transform,Transform3D} from '@engine/protocol/components.js';
export type CharacterRecipe={entity:string;idle:string;walk:string;nominalSpeedPerTick:number;gesture?:{action:string;clip:string;durationMs:number}};
/** Projects simulation motion to the rendered actors and selects their clips. */
export class CharacterPresentation{
 private gestures=new Map<string,number>();
 private previous=new Map<string,{x:number;y:number;version:number;speed:number}>();
 private lastFrameMs?: number;
 private yaw = 0;

 constructor(private world:IWorld,private recipes:CharacterRecipe[], private motionRoot?: string){
  if (motionRoot && (!world.getComponent(motionRoot, 'Transform') || !world.getComponent(motionRoot, 'FaceDir'))) {
   throw Error('Invalid presentation motion root: ' + motionRoot);
  }
  for(const r of recipes){if(!world.getComponent(r.entity,'Transform')||!world.getComponent(r.entity,'AnimState3D')||!world.getComponent(r.entity,'Velocity')||!r.idle||!r.walk||!Number.isFinite(r.nominalSpeedPerTick)||r.nominalSpeedPerTick<=0)throw Error('Invalid character recipe: '+r.entity);
   if(r.gesture&&(!Number.isFinite(r.gesture.durationMs)||r.gesture.durationMs<=0))throw Error('Invalid character gesture');const t=world.getComponent<Transform>(r.entity,'Transform')!;this.previous.set(r.entity,{x:t.x,y:t.y,version:world.getVersion(),speed:0});}
 }
 select(action:string,now:number):boolean{
  let found=false;for(const r of this.recipes)if(r.gesture?.action===action){if((this.gestures.get(r.entity)??-Infinity)>now){console.info('[character:reject]',r.entity,'gesture already active');found=true;continue;}this.gestures.set(r.entity,now+r.gesture.durationMs);console.info('[character:gesture]',r.entity,r.gesture.clip);found=true;}return found;
 }
 update(now:number){
  const root = this.motionRoot ? this.world.getComponent<Transform>(this.motionRoot, 'Transform') : undefined;
  if (root) {
   const direction = this.world.getComponent<FaceDir>(this.motionRoot!, 'FaceDir')!;
   const target = modelYawFromFaceDir(direction, this.yaw);
   const delta = Math.min(.05, (now - (this.lastFrameMs ?? now)) / 1000);
   this.yaw = turnModelYaw(this.yaw, target, delta * 9);
   this.lastFrameMs = now;
  }
  for(const r of this.recipes){
  const a=this.world.getComponent<AnimState3D>(r.entity,'AnimState3D')!;
  const t=root ?? this.world.getComponent<Transform>(r.entity,'Transform')!;
  if (root) {
   const pose = this.world.getComponent<Transform3D>(r.entity, 'Transform3D')!;
   pose.x = root.x;
   pose.z = root.y;
   pose.rotY = this.yaw;
  }
  const previous=this.previous.get(r.entity)!,version=this.world.getVersion();
  if(version!==previous.version){previous.speed=Math.hypot(t.x-previous.x,t.y-previous.y)/Math.max(1,version-previous.version);previous.x=t.x;previous.y=t.y;previous.version=version;}
  const speed=previous.speed,moving=Number.isFinite(speed)&&speed>1e-6;
  if(moving)this.gestures.delete(r.entity);
  const gesture=r.gesture&&(this.gestures.get(r.entity)??-Infinity)>now;
  const clip=moving?r.walk:gesture?r.gesture!.clip:r.idle;
  if(a.clip!==clip)console.info('[character:transition]',r.entity,a.clip,clip);
  a.clip=clip;a.speed=moving?Math.min(2.5,speed/r.nominalSpeedPerTick):1;a.loop=!gesture;delete a.speedAtVelocity;
 }}
}
