import type {IWorld} from '../../src/engine/core/types.js';
import type {AnimState3D,Transform} from '../../src/engine/protocol/components.js';
export type CharacterRecipe={entity:string;idle:string;walk:string;nominalSpeedPerTick:number;gesture?:{action:string;clip:string;durationMs:number}};
/** Prototype host presentation adapter. Only AnimState3D is written; simulation remains authoritative. */
export class CharacterPresentation{
 private gestures=new Map<string,number>();
 private previous=new Map<string,{x:number;y:number;version:number;speed:number}>();
 constructor(private world:IWorld,private recipes:CharacterRecipe[]){
  for(const r of recipes){if(!world.getComponent(r.entity,'Transform')||!world.getComponent(r.entity,'AnimState3D')||!world.getComponent(r.entity,'Velocity')||!r.idle||!r.walk||!Number.isFinite(r.nominalSpeedPerTick)||r.nominalSpeedPerTick<=0)throw Error('Invalid character recipe: '+r.entity);
   if(r.gesture&&(!Number.isFinite(r.gesture.durationMs)||r.gesture.durationMs<=0))throw Error('Invalid character gesture');const t=world.getComponent<Transform>(r.entity,'Transform')!;this.previous.set(r.entity,{x:t.x,y:t.y,version:world.getVersion(),speed:0});}
 }
 select(action:string,now:number):boolean{
  let found=false;for(const r of this.recipes)if(r.gesture?.action===action){if((this.gestures.get(r.entity)??-Infinity)>now){console.info('[character:reject]',r.entity,'gesture already active');found=true;continue;}this.gestures.set(r.entity,now+r.gesture.durationMs);console.info('[character:gesture]',r.entity,r.gesture.clip);found=true;}return found;
 }
 update(now:number){for(const r of this.recipes){
  const a=this.world.getComponent<AnimState3D>(r.entity,'AnimState3D')!;
  const t=this.world.getComponent<Transform>(r.entity,'Transform')!,previous=this.previous.get(r.entity)!,version=this.world.getVersion();
  if(version!==previous.version){previous.speed=Math.hypot(t.x-previous.x,t.y-previous.y)/Math.max(1,version-previous.version);previous.x=t.x;previous.y=t.y;previous.version=version;}
  const speed=previous.speed,moving=Number.isFinite(speed)&&speed>1e-6;
  if(moving)this.gestures.delete(r.entity);
  const gesture=r.gesture&&(this.gestures.get(r.entity)??-Infinity)>now;
  const clip=moving?r.walk:gesture?r.gesture!.clip:r.idle;
  if(a.clip!==clip)console.info('[character:transition]',r.entity,a.clip,clip);
  a.clip=clip;a.speed=moving?Math.min(2.5,speed/r.nominalSpeedPerTick):1;a.loop=!gesture;delete a.speedAtVelocity;
 }}
}
