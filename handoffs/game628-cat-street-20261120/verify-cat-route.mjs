import {readFile,writeFile} from 'node:fs/promises';
import {AnimationMixer, Box3, LoopOnce, Quaternion, Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const dir=new URL('./',import.meta.url);
const read=path=>readFile(new URL(path,dir));
const street=JSON.parse(await read('site/scenes/crowd-street.json'));
const entities=street.manifest.entities;
const trackEntity=entities['cat-floor-idle'];
const basis=trackEntity.Transform3D;
const platform=entities['cat-cafe-low-platform'];
const step=platform.Transform3D;
const size=platform.Mesh3D;
const minX=step.x-size.width/2;
const top=step.y+size.height/2;
const load=async path=>{
 const bytes=await read(path);
 return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
};
const art='site/art/reference-rebuild-20261120/scene/';
const gltf=await load(art+'cat-floor-cafe-visible.glb');
const clip=gltf.animations.find(c=>c.name===trackEntity.AnimState3D.clip);
const mix=new AnimationMixer(gltf.scene);
const action=mix.clipAction(clip).setLoop(LoopOnce,1);
action.clampWhenFinished=true;
action.play();
const paws=[];
gltf.scene.traverse(o=>{if(o.isMesh&&o.name.endsWith('pad-mesh'))paws.push(o);});
if(paws.length!==4) throw Error('Missing four paws');
const offsets={ 'far-hind':0, 'far-front':.30, 'near-hind':.46, 'near-front':.15 };
const previous=new Map();
const initial=new Map();
const impact={maxPenetrationM:0,maxSupportHeightErrorM:0,maxSupportedFrameSlipM:0,maxSeamM:0,maxTurnRad:0,supportGround:0,supportTop:0};
const frameCount=Math.round(clip.duration*120);
const p=new Vector3(), landmark=new Vector3();
for(let frame=0;frame<=frameCount;frame++){
 const t=frame/120;
 mix.setTime(t);
 gltf.scene.updateMatrixWorld(true);
 impact.maxTurnRad=Math.max(impact.maxTurnRad,gltf.scene.children[0].quaternion.angleTo(new Quaternion()));
 for(const paw of paws){
  const phase=offsets[paw.name.replace(/-pad-mesh$/,'')];
  if (phase===undefined) throw Error(paw.name);
  const elapsed=(t-.06-phase)-Math.floor((t-.06-phase)/.60)*.60;
  const planted=t<=.2 || t>=7 || elapsed>=.25;
  paw.parent.getWorldPosition(landmark);
  if(frame===0) initial.set(paw,landmark.clone());
  if(frame===frameCount) impact.maxSeamM=Math.max(impact.maxSeamM,landmark.distanceTo(initial.get(paw)));
  const contact=landmark.x+basis.x>=minX?top:0;
  if(planted){
   const old=previous.get(paw);
   if(old?.planted) impact.maxSupportedFrameSlipM=Math.max(impact.maxSupportedFrameSlipM,landmark.distanceTo(old.landmark));
   if(contact>0) impact.supportTop++; else impact.supportGround++;
  }
  previous.set(paw,{planted,landmark:landmark.clone()});
  let lowest=Infinity;
  const points=paw.geometry.attributes.position;
  for(let i=0;i<points.count;i++){
   p.fromBufferAttribute(points,i).applyMatrix4(paw.matrixWorld);
   const x=p.x+basis.x, z=p.z+basis.z;
   const supported=x>=minX && x<=step.x+size.width/2 && Math.abs(z-step.z)<=size.depth/2;
   const surface=supported?top:0;
   const altitude=p.y+basis.y;
   lowest=Math.min(lowest,altitude);
   impact.maxPenetrationM=Math.max(impact.maxPenetrationM,surface-altitude);
  }
  if(planted) impact.maxSupportHeightErrorM=Math.max(impact.maxSupportHeightErrorM,Math.abs(lowest+basis.y-contact));
 }
}
if(impact.maxPenetrationM>.002 || impact.maxSupportHeightErrorM>.002 || impact.maxSupportedFrameSlipM>.002 || impact.maxSeamM>.002 ||
   !impact.supportTop || !impact.supportGround || impact.maxTurnRad<.25) throw Error(JSON.stringify(impact));
const animation={};
for(const cat of ['sleep','ginger','floor']){
 const file=await load(art+'cat-'+cat+'-cafe-visible.glb');
 const tracks=file.animations[0].tracks;
 const track=(node,prop)=>tracks.find(item=>item.name.includes(node)&&item.name.endsWith('.'+prop));
 for(const [node,prop] of [['HeadLook','quaternion'],['TailSway','quaternion'],['BodyBreath','scale'],['Blink_0','scale'],['Blink_1','scale']]){
  const keys=track(node,prop);
  if(!keys) throw Error(cat+': '+node);
  const stride=keys.getValueSize();
  const first=Array.from(keys.values.slice(0,stride));
  const last=Array.from(keys.values.slice(-stride));
  if(Math.max(...first.map((v,i)=>Math.abs(v-last[i])))>1e-5) throw Error('Expression seam');
 }
 const bounds=new Box3().setFromObject(file.scene);
 animation[cat]={duration:file.animations[0].duration,trackCount:tracks.length,restSize:bounds.getSize(new Vector3()).toArray()};
}
const report={sampleRate:120,stepWorld:{minX,maxX:step.x+size.width/2,top,zMin:step.z-size.depth/2,zMax:step.z+size.depth/2},basis,impact,animation};
await writeFile(new URL('evidence/cafe-route-replay.json',dir),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
