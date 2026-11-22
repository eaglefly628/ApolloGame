import fs from 'node:fs';
import * as T from 'three';
import {loadBody,meshBonePoints} from './inspect.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url)));
const base=read('./original/profiles.json'),contract=read('./original/engine-contract.json');
const round=n=>Number(n.toFixed(7));
const revision=process.env.FIT_REVISION??'r7';
const out={revision:'fit-20261121-'+revision,canonicalContract:base.canonicalContract,units:'meters',axes:'Y-up,+Z-forward',
 material:base.material,cloth:{style:'plain',wind:{z:1.1}},body:{}};
for(const bodyId of ['slim','full']){
 const asset=await loadBody(bodyId),a=asset.scene,bindings=[];
 for(const name of ['shirt-body','trouser-seat','head','back-hair']){
  const mesh=a.getObjectByName(name),bone=mesh.parent,box=new T.Box3().setFromPoints(meshBonePoints(mesh,bone)),s=box.getSize(new T.Vector3());
  const spacing=name==='head'?.11:.14;
  const nx=Math.ceil(s.x/spacing),nz=Math.ceil(s.z/spacing),dx=s.x/nx,dz=s.z/nz;
  const radius=Math.hypot(dx/2,dz/2)/Math.sqrt(1-.4*.4)+.004;
  const hh=Math.max(.01,s.y/2-radius*.4);
  for(let x=0;x<nx;x++)for(let z=0;z<nz;z++)bindings.push({id:`${name}-${x}-${z}`,shape:'capsule',radius:round(radius),halfHeight:round(hh),covers:[name],
   attachment:{node:bone.name,offsetM:[box.min.x+dx*(x+.5),(box.min.y+box.max.y)/2,box.min.z+dz*(z+.5)].map(round)}});
 }
 for(const side of ['Left','Right'])for(const part of ['arm','forearm','thigh']){
  const names=part==='arm'?[`${side}-sleeve`,`${side}-arm-upper`]:[`${side}-${part}`];
  const mesh=a.getObjectByName(names[0]),bone=mesh.parent,points=names.flatMap(n=>meshBonePoints(a.getObjectByName(n),bone));
  const box=new T.Box3().setFromPoints(points),center=box.getCenter(new T.Vector3());
  const radial=Math.max(...points.map(p=>Math.hypot(p.x-center.x,p.z-center.z)));
  const radius=radial+.007,hh=Math.max(.01,(box.max.y-box.min.y)/2-radial*.25);
  bindings.push({id:`${side.toLowerCase()}-${part}`,shape:'capsule',radius:round(radius),halfHeight:round(hh),covers:names,
    attachment:{node:bone.name,offsetM:center.toArray().map(round)}});
 }
 const mixer=new T.AnimationMixer(a);mixer.clipAction(asset.animations.find(c=>c.name==='idle')).play();mixer.setTime(0);a.updateMatrixWorld(true);
 const shirt=a.getObjectByName('shirt-body'),shirtBox=new T.Box3().setFromObject(shirt);
 const hairBox=new T.Box3().setFromObject(a.getObjectByName('back-hair'));
 const attachment={...contract.attachment,avatarId:'avatar',left:{...contract.attachment.left},right:{...contract.attachment.right}};
 for(const side of ['left','right']){
  const original=a.getObjectByName(attachment[side].node),origin=original.getWorldPosition(new T.Vector3());
  attachment[side].node=side==='left'?'LeftShoulder':'RightShoulder';
  const bone=a.getObjectByName(attachment[side].node);
  const desired=new T.Vector3(origin.x,origin.y+.04,Math.min(shirtBox.min.z,hairBox.min.z)-(bodyId==='slim'?.045:.065));
  origin.copy(bone.getWorldPosition(new T.Vector3()));
  attachment[side].offsetM=desired.sub(origin).applyQuaternion(bone.getWorldQuaternion(new T.Quaternion()).invert()).toArray().map(round);
 }
 const gap=a.getObjectByName('LeftUpperArm').getWorldPosition(new T.Vector3()).distanceTo(a.getObjectByName('RightUpperArm').getWorldPosition(new T.Vector3()));
 out.body[bodyId]={...base.body[bodyId],widthM:gap,heightM:.55,attachment,proxyBindings:bindings,fitStatus:'under-test'};
 console.log(bodyId,bindings.length,attachment);
}
fs.writeFileSync(new URL('./profiles-'+revision+'.json',import.meta.url),JSON.stringify(out,null,2));
