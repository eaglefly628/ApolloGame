import fs from 'node:fs';import * as T from 'three';import {loadBody} from './inspect.mjs';
const profiles=JSON.parse(fs.readFileSync(new URL('./profiles-r7.json',import.meta.url))),report=[];
const signed=(p,cs)=>{let min=Infinity;for(const c of cs){const dx=c.b[0]-c.a[0],dy=c.b[1]-c.a[1],dz=c.b[2]-c.a[2],t=T.MathUtils.clamp(((p[0]-c.a[0])*dx+(p[1]-c.a[1])*dy+(p[2]-c.a[2])*dz)/(dx*dx+dy*dy+dz*dz||1),0,1);min=Math.min(min,Math.hypot(p[0]-c.a[0]-t*dx,p[1]-c.a[1]-t*dy,p[2]-c.a[2]-t*dz)-c.radius);}return min;};
for(const bodyId of ['slim','full']){
 const a=await loadBody(bodyId),avatar=a.scene,mixer=new T.AnimationMixer(avatar),frames=[];let previous,globalFrame=0;
 for(const name of ['idle','walk','wave']){const clip=a.animations.find(c=>c.name===name),next=mixer.clipAction(clip).reset().play();if(previous){next.fadeIn(.25);previous.fadeOut(.25);}previous=next;
  for(let i=0;i<=Math.ceil(clip.duration*60);i++,globalFrame++){mixer.update(globalFrame===0?0:1/60);avatar.updateMatrixWorld(true);if(i%4!==0)continue;
   const caps=profiles.body[bodyId].proxyBindings.map(c=>{const bone=avatar.getObjectByName(c.attachment.node),q=bone.getWorldQuaternion(new T.Quaternion()).normalize(),pos=new T.Vector3(...c.attachment.offsetM).applyQuaternion(q).add(bone.getWorldPosition(new T.Vector3())),axis=new T.Vector3(0,c.halfHeight,0).applyQuaternion(q);return {radius:c.radius,a:pos.clone().sub(axis).toArray(),b:pos.clone().add(axis).toArray()};});
   frames.push({name,seconds:i/60,frame:globalFrame,caps,sides:Object.fromEntries(['Left','Right'].map(side=>{const bone=avatar.getObjectByName(side+'UpperArm');return [side,{p:bone.getWorldPosition(new T.Vector3()),q:bone.getWorldQuaternion(new T.Quaternion()).normalize()}];}))});
  }
 }
 const body={bodyId,sides:{}};
 for(const side of ['Left','Right']){const candidates=[];
  for(const radius of [.112,.12,.13,.145])for(const y of [-.02,.02,.06,.10,.15])for(let angle=0;angle<360;angle+=5){const offset=new T.Vector3(radius*Math.cos(angle*Math.PI/180),y,radius*Math.sin(angle*Math.PI/180));let minimum=Infinity,at;
   for(const frame of frames){const bone=frame.sides[side],point=offset.clone().applyQuaternion(bone.q).add(bone.p).toArray(),d=signed(point,frame.caps);if(d<minimum){minimum=d;at={frame:frame.frame,clip:frame.name,seconds:frame.seconds};}if(minimum<-.03)break;}
   candidates.push({offsetM:offset.toArray(),radius,y,angle,minimumSignedDistanceM:minimum,at});
  }
  candidates.sort((a,b)=>b.minimumSignedDistanceM-a.minimumSignedDistanceM);body.sides[side]={best:candidates.slice(0,12),feasible:candidates.filter(c=>c.minimumSignedDistanceM>=-.005).sort((a,b)=>(Math.abs(a.y)+a.radius)-(Math.abs(b.y)+b.radius)).slice(0,20)};
 }
 report.push(body);console.log(JSON.stringify(body));
}
fs.writeFileSync(new URL('./evidence/anchor-search.json',import.meta.url),JSON.stringify(report,null,2));
