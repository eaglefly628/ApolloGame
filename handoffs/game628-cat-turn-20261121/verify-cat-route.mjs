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
const offsets={ 'far-hind':0, 'far-front':.25, 'near-hind':.375, 'near-front':.125 };
const previous=new Map();
const initial=new Map();
const impact={maxPenetrationM:0,maxSupportHeightErrorM:0,maxSupportedFrameSlipM:0,maxSeamM:0,maxTurnRad:0,supportGround:0,supportTop:0};
const frameCount=Math.round(clip.duration*120);
const p=new Vector3(), landmark=new Vector3();
const padRotation=new Quaternion();
const up=new Vector3(0,1,0);
const lifted={platform:new Set(),ground:new Set()};
let lowestPadAlignment=1;
const turnA=new Quaternion(),turnB=new Quaternion();
const facing={forwardMovingFrames:0,returnMovingFrames:0,worstAgreement:1,turnPlatformDriftM:0,turnGroundDriftM:0};
let previousX;
const root=gltf.scene.children[0];
for(let frame=0;frame<=frameCount;frame++){
 const t=frame/120;
 mix.setTime(t);
 gltf.scene.updateMatrixWorld(true);
 if(frame===0) turnA.copy(root.quaternion);
 if(frame===Math.round(5.40*120)) turnB.copy(root.quaternion);
 const dx=previousX===undefined?0:root.position.x-previousX;
 if(Math.abs(dx)>.0001) {
  const forward=new Vector3(1,0,0).applyQuaternion(root.quaternion);
  facing.worstAgreement=Math.min(facing.worstAgreement,forward.x*Math.sign(dx));
  if(dx>0)facing.forwardMovingFrames++;else facing.returnMovingFrames++;
 }
 if(t>=3.28&&t<=5.28) facing.turnPlatformDriftM=Math.max(facing.turnPlatformDriftM,Math.abs(.435-root.position.x));
 if(t>=8.38&&t<=10.38) facing.turnGroundDriftM=Math.max(facing.turnGroundDriftM,Math.abs(-.5-root.position.x));
 previousX=root.position.x;
 impact.maxTurnRad=Math.max(impact.maxTurnRad,gltf.scene.children[0].quaternion.angleTo(new Quaternion()));
 for(const paw of paws){
  const phase=offsets[paw.name.replace(/-pad-mesh$/,'')];
  if (phase===undefined) throw Error(paw.name);
  const elapsed=(t-.05-phase)-Math.floor((t-.05-phase)/.50)*.50;
  const planted=t<=.2 || t>=10.70 || elapsed>=.225;
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
  paw.parent.getWorldQuaternion(padRotation);
  lowestPadAlignment=Math.min(lowestPadAlignment,new Vector3(0,1,0).applyQuaternion(padRotation).dot(up));
  if(t>=3.28&&t<=5.28&&landmark.y>top+.039+.008) lifted.platform.add(paw.name);
  if(t>=8.38&&t<=10.38&&landmark.y>.039+.008) lifted.ground.add(paw.name);
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
facing.afterPlatformTurnRadians=turnA.angleTo(turnB);
facing.loopFacingErrorRadians=turnA.angleTo(root.quaternion);
facing.turnPlatformPawsLifted=lifted.platform.size;
facing.turnGroundPawsLifted=lifted.ground.size;
facing.lowestPadAlignment=lowestPadAlignment;
if(facing.worstAgreement<.99 || facing.turnPlatformDriftM>.002 || facing.turnGroundDriftM>.002 ||
   facing.afterPlatformTurnRadians<3.1 || facing.loopFacingErrorRadians>.002 || !facing.returnMovingFrames ||
   !facing.forwardMovingFrames || lifted.platform.size!==4 || lifted.ground.size!==4 || lowestPadAlignment<.999) throw Error(JSON.stringify(facing));
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
const report={sampleRate:120,stepWorld:{minX,maxX:step.x+size.width/2,top,zMin:step.z-size.depth/2,zMax:step.z+size.depth/2},basis,impact,facing,animation};
await writeFile(new URL('evidence/cafe-route-replay.json',dir),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
