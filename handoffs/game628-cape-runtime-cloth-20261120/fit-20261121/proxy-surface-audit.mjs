import fs from 'node:fs';
import * as T from 'three';
import {loadBody} from './inspect.mjs';
const filename=process.argv[2]??'profiles-r7.json',profiles=JSON.parse(fs.readFileSync(new URL(filename,import.meta.url)));
const report={filename,scope:'rest-pose sampled union capsule surface vs actual named rigid body triangles; outside classification uses deduplicated ray intersections; sampled lower bounds, not continuous maxima',bodies:[]};
function signed(point,c){const axis=c.b.clone().sub(c.a),t=T.MathUtils.clamp(point.clone().sub(c.a).dot(axis)/(axis.lengthSq()||1),0,1);return point.distanceTo(c.a.clone().addScaledVector(axis,t))-c.radius;}
for(const bodyId of ['slim','full']){
 const asset=await loadBody(bodyId),avatar=asset.scene;
 const mixer=new T.AnimationMixer(avatar);mixer.clipAction(asset.animations.find(c=>c.name==='idle')).play();mixer.setTime(0);avatar.updateMatrixWorld(true);
 const profile=profiles.body[bodyId],meshNames=[...new Set(profile.proxyBindings.flatMap(c=>c.covers))];
 const meshes=meshNames.map(name=>{const mesh=avatar.getObjectByName(name),geometry=mesh.geometry,index=geometry.index;
  const points=Array.from({length:geometry.attributes.position.count},(_,i)=>mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld));
  const triangles=[];for(let i=0;i<(index?.count??points.length);i+=3)triangles.push(new T.Triangle(points[index?index.getX(i):i],points[index?index.getX(i+1):i+1],points[index?index.getX(i+2):i+2]));
  return {name,triangles};});
 const capsules=profile.proxyBindings.map(c=>{const bone=avatar.getObjectByName(c.attachment.node),q=bone.getWorldQuaternion(new T.Quaternion()).normalize();
  const center=new T.Vector3(...c.attachment.offsetM).applyQuaternion(q).add(bone.getWorldPosition(new T.Vector3())),axis=new T.Vector3(0,c.halfHeight??0,0).applyQuaternion(q);
  return {...c,q,center,a:center.clone().sub(axis),b:center.clone().add(axis)};});
 const rows=[];
 for(const c of capsules){let exposed=0,outside=0,maxOutsideGapM=0,atPoint;const gaps=[];
  const samples=[];
  for(const sign of [-1,1])for(let latitude=0;latitude<=4;latitude++)for(let longitude=0;longitude<12;longitude++){
   const theta=latitude*Math.PI/8,phi=longitude*Math.PI/6;
   samples.push(new T.Vector3(c.radius*Math.sin(theta)*Math.cos(phi),sign*((c.halfHeight??0)+c.radius*Math.cos(theta)),c.radius*Math.sin(theta)*Math.sin(phi)).applyQuaternion(c.q).add(c.center));}
  for(let y=0;y<=4;y++)for(let longitude=0;longitude<12;longitude++){const phi=longitude*Math.PI/6;samples.push(new T.Vector3(c.radius*Math.cos(phi),(y/2-1)*(c.halfHeight??0),c.radius*Math.sin(phi)).applyQuaternion(c.q).add(c.center));}
  for(const point of samples){if(capsules.some(other=>other!==c&&signed(point,other)<-1e-6))continue;exposed++;
   let nearest=Infinity,inside=false;const hit=new T.Vector3(),closest=new T.Vector3(),ray=new T.Ray(point,new T.Vector3(.837,.371,.401).normalize());
   for(const mesh of meshes){const hits=[];for(const triangle of mesh.triangles){triangle.closestPointToPoint(point,closest);nearest=Math.min(nearest,point.distanceTo(closest));
      if(ray.intersectTriangle(triangle.a,triangle.b,triangle.c,false,hit))hits.push(point.distanceTo(hit));}
    hits.sort((a,b)=>a-b);const unique=hits.filter((d,i)=>i===0||d-hits[i-1]>1e-6);if(unique.length%2===1)inside=true;}
   if(!inside&&nearest>1e-6){outside++;gaps.push(nearest);if(nearest>maxOutsideGapM){maxOutsideGapM=nearest;atPoint=point.toArray();}}
  }
  gaps.sort((a,b)=>a-b);rows.push({id:c.id,covers:c.covers,exposedSamples:exposed,outsideSamples:outside,maxOutsideGapM,p95OutsideGapM:gaps[Math.floor(gaps.length*.95)]??0,atPoint});
 }
 report.bodies.push({bodyId,proxyCount:capsules.length,meshes:meshNames,proxySurfaceOutsideGapMaxM:Math.max(...rows.map(r=>r.maxOutsideGapM)),rows});
}
fs.writeFileSync(new URL('./evidence/'+filename.replace('.json','')+'-proxy-surface.json',import.meta.url),JSON.stringify(report,null,2));
console.log(report.bodies.map(b=>({bodyId:b.bodyId,proxyCount:b.proxyCount,sampledSurfaceOverhangM:b.proxySurfaceOutsideGapMaxM})));
