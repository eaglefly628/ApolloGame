// Offline original character geometry with local-library rotations; no runtime or library source writes.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import * as T from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..'),out=path.join(root,'public/art/reference-rebuild-20261120/character'),lib='/Users/junbaili/ApolloAssets/motion-lib-full-frames';
await fs.mkdir(out,{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const ids={idle:'idle-breathing',walk:'walking-100460901',wave:'waving-106100901'};
const catalog=JSON.parse(await fs.readFile(lib+'/catalog.json','utf8'));
const sources={};
for(const [name,id]of Object.entries(ids)){
 const b=await fs.readFile(lib+'/clips/'+id+'.glb'),L=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+L)),bin=b.subarray(28+L),meta=catalog.clips.find(v=>v.id===id);if(sha(b)!==meta.sha256)throw Error('source SHA differs '+id);
 sources[name]={id,b,j,bin,meta};
}
const acc=(s,i)=>{const a=s.j.accessors[i],bv=s.j.bufferViews[a.bufferView],k={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],byte=s.bin.byteOffset+(bv.byteOffset??0)+(a.byteOffset??0);if(a.componentType!==5126)throw Error('float channel expected');return Array.from(new Float32Array(s.bin.buffer,byte,a.count*k));};
globalThis.FileReader=class{readAsArrayBuffer(b){b.arrayBuffer().then(v=>{this.result=v;this.onloadend?.();});}readAsDataURL(b){b.arrayBuffer().then(v=>{this.result=`data:${b.type};base64,${Buffer.from(v).toString('base64')}`;this.onloadend?.();});}};
const BASE_SCALE=.86;
const source=sources.idle;
function make(role){
 const scene=new T.Group();scene.name='Original_'+role;const rig=new T.Group();rig.name='LibraryRig';scene.add(rig);
 const names=new Map(),nodes=source.j.nodes.map(n=>{let o=new T.Object3D();o.name=n.name;o.position.fromArray(n.translation??[0,0,0]);o.quaternion.fromArray(n.rotation??[0,0,0,1]);o.scale.fromArray(n.scale??[1,1,1]);names.set(o.name,o);return o;});
 source.j.nodes.forEach((n,i)=>{for(const c of n.children??[])if(source.j.nodes[c].name!=='MotionValidationCarrier')nodes[i].add(nodes[c]);});
 const arm=nodes.find(n=>n.name==='Armature');rig.add(arm);arm.scale.multiplyScalar(BASE_SCALE);scene.updateMatrixWorld(true);
 const wp=n=>names.get(n).getWorldPosition(new T.Vector3());
 const mats={skin:new T.MeshStandardMaterial({color:'#eeb58a',roughness:.85,flatShading:true}),inner:new T.MeshStandardMaterial({color:'#cc815f',roughness:.9}),hair:new T.MeshStandardMaterial({color:'#533a29',roughness:.95,flatShading:true}),ink:new T.MeshStandardMaterial({color:'#302f29',roughness:1}),coat:new T.MeshStandardMaterial({color:role==='traveler'?'#8b9870':'#eddfc4',roughness:.9,flatShading:true}),pants:new T.MeshStandardMaterial({color:role==='traveler'?'#546572':'#394d59',roughness:.9,flatShading:true}),shoe:new T.MeshStandardMaterial({color:'#d6c8a5',roughness:.9,flatShading:true}),sole:new T.MeshStandardMaterial({color:'#eee5cf',roughness:.95}),apron:new T.MeshStandardMaterial({color:'#667c73',roughness:.85,flatShading:true}),bag:new T.MeshStandardMaterial({color:'#a2946a',roughness:.9,flatShading:true}),hat:new T.MeshStandardMaterial({color:role==='traveler'?'#8b9870':'#e7d9ba',roughness:.9,flatShading:true})};
 const meshparts=[];
 function attach(bone,name,geo,mat,position,quat=new T.Quaternion(),scale=[1,1,1]){
  const o=new T.Mesh(geo,mat);o.name=name;o.castShadow=true;o.receiveShadow=true;
  const W=new T.Matrix4().compose(new T.Vector3(...position),quat,new T.Vector3(...scale));const local=new T.Matrix4().copy(names.get(bone).matrixWorld).invert().multiply(W);local.decompose(o.position,o.quaternion,o.scale);names.get(bone).add(o);meshparts.push(o);return o;
 }
 function ell(bone,name,p,size,mat,segments=12){return attach(bone,name,new T.SphereGeometry(1,segments,8),mat,p,new T.Quaternion(),size);}
 function rounded(w,h,d,r=.04){const s=new T.Shape(),x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);const g=new T.ExtrudeGeometry(s,{depth:d-2*r,bevelEnabled:true,bevelThickness:r,bevelSize:r,bevelSegments:1,steps:1,curveSegments:2});g.translate(0,0,-d/2+r);g.scale(w/(w+2*r),h/(h+2*r),1);return g;}
 const hip=wp('Hips'),chest=wp('Chest'),head=wp('Head');
 attach('Spine','shirt-body',rounded(.43,.45,.27),mats.coat,[0,hip.y+.20,hip.z]);
 attach('Hips','trouser-seat',rounded(.37,.18,.25),mats.pants,[0,hip.y-.025,hip.z]);
 for(const side of ['Left','Right']){
  const knee=wp(side+'LowerLeg'),ankle=wp(side+'Foot'),upper=wp(side+'UpperLeg'),elbow=wp(side+'LowerArm'),wrist=wp(side+'Hand'),shoulder=wp(side+'UpperArm');
  function segment(bone,name,a,b,r0,r1,mat){const delta=b.clone().sub(a),center=a.clone().add(b).multiplyScalar(.5),q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.clone().normalize());return attach(bone,name,new T.CylinderGeometry(r1,r0,delta.length()+.015,8,1),mat,center.toArray(),q);}
  segment(side+'UpperLeg',side+'-thigh',upper,knee,.10,.09,mats.pants);segment(side+'LowerLeg',side+'-calf',knee,ankle,.09,.075,mats.pants);
  ell(side+'LowerLeg',side+'-knee',knee.toArray(),[.093,.095,.093],mats.pants);
  const sleeveEnd=shoulder.clone().lerp(elbow,.66);segment(side+'UpperArm',side+'-sleeve',shoulder,sleeveEnd,.105,.095,mats.coat);segment(side+'UpperArm',side+'-arm-upper',sleeveEnd,elbow,.072,.065,mats.skin);segment(side+'LowerArm',side+'-forearm',elbow,wrist,.065,.052,mats.skin);ell(side+'Hand',side+'-hand',wrist.toArray(),[.066,.085,.045],mats.skin);
  const fx=ankle.x,fz=ankle.z+.065;
  attach(side+'Foot',side+'-shoe',rounded(.19,.135,.31,.035),mats.shoe,[fx,.095,fz]);
  attach(side+'Foot',side+'-sole',rounded(.195,.035,.315,.015),mats.sole,[fx,.020,fz]);
  for(let i=0;i<2;i++)attach(side+'Foot',side+'-lace-'+i,rounded(.13,.012,.02,.004),mats.sole,[fx,.165,fz+.025+i*.04]);
 }
 // Head is original rounded low-poly form, with ears, hair, nose, brows and smile.
 const hc=[head.x,head.y+.07,head.z+.005];
 attach('Head','head',rounded(.47,.47,.405,.075),mats.skin,hc);
 for(const sign of [-1,1]){
  ell('Head','ear-'+sign,[hc[0]+sign*.25,hc[1]-.035,hc[2]],[.075,.10,.045],mats.skin);
  ell('Head','ear-inner-'+sign,[hc[0]+sign*.267,hc[1]-.035,hc[2]+.032],[.035,.060,.018],mats.inner);
  ell('Head','eye-'+sign,[hc[0]+sign*.105,hc[1]+.018,hc[2]+.214],[.023,.036,.014],mats.ink);
  attach('Head','brow-'+sign,rounded(.075,.016,.012,.004),mats.hair,[hc[0]+sign*.105,hc[1]+.092,hc[2]+.213]);
 }
 ell('Head','nose',[hc[0],hc[1]-.035,hc[2]+.234],[.036,.037,.045],mats.skin,8);
 const smile=new T.CatmullRomCurve3([new T.Vector3(hc[0]-.07,hc[1]-.095,hc[2]+.211),new T.Vector3(hc[0],hc[1]-.12,hc[2]+.218),new T.Vector3(hc[0]+.07,hc[1]-.095,hc[2]+.211)]);attach('Head','smile',new T.TubeGeometry(smile,12,.009,5,false),mats.ink,[0,0,0]);
 const cap=new T.SphereGeometry(1,12,6,0,Math.PI*2,0,Math.PI*.55);attach('Head','hair-crown',cap,mats.hair,[hc[0],hc[1]+.11,hc[2]-.01],new T.Quaternion(),[.248,.20,.215]);
 for(let i=0;i<4;i++)ell('Head','fringe-'+i,[hc[0]-.17+i*.10,hc[1]+.19+(i%2)*.015,hc[2]+.175],[.07,.065,.05],mats.hair,8);
 attach('Head','cap-crown',new T.SphereGeometry(1,10,5,0,Math.PI*2,0,Math.PI*.52),mats.hat,[hc[0],hc[1]+.205,hc[2]-.01],new T.Quaternion(),[.268,.14,.235]);
 attach('Head','cap-visor',rounded(.42,.035,.22,.025),mats.hat,[hc[0],hc[1]+.207,hc[2]+.21]);
 if(role==='traveler'){
  attach('Chest','backpack',rounded(.32,.37,.16,.045),mats.bag,[0,chest.y-.08,chest.z-.23]);
  attach('Chest','backpack-pocket',rounded(.24,.17,.05,.02),mats.coat,[0,chest.y-.14,chest.z-.33]);
  for(const sign of[-1,1])attach('Chest','strap-'+sign,rounded(.042,.37,.045,.012),mats.bag,[sign*.15,chest.y-.075,chest.z+.14]);
 }else{
  attach('Spine','apron-front',rounded(.37,.46,.035,.018),mats.apron,[0,hip.y+.10,hip.z+.16]);
  attach('Spine','apron-pocket',rounded(.22,.115,.018,.008),mats.coat,[0,hip.y+.01,hip.z+.185]);
 }
 scene.updateMatrixWorld(true);
 return {scene,names,meshparts,arm};
}
function clipsFor(rig){
 const clips=[];
 for(const [name,s]of Object.entries(sources)){
  const tracks=[];
  for(const c of s.j.animations[0].channels){const bone=s.j.nodes[c.target.node].name,sm=s.j.animations[0].samplers[c.sampler],times=acc(s,sm.input),vals=acc(s,sm.output);if(!rig.names.has(bone))continue;
   if(c.target.path==='rotation')tracks.push(new T.QuaternionKeyframeTrack(bone+'.quaternion',times,vals));
   else if(bone==='Hips'&&c.target.path==='translation'){
    // Source's Armature +90X converts localXY to planar worldXZ and local-Z to height.
    const base=rig.names.get('Hips').position;
    const x0=vals[0],y0=vals[1],dx=vals[vals.length-3]-x0,dy=vals[vals.length-2]-y0;for(let k=0;k<vals.length;k+=3){const alpha=times[k/3]/s.meta.durationS;vals[k]=base.x+vals[k]-x0-dx*alpha;vals[k+1]=base.y+vals[k+1]-y0-dy*alpha;}
    tracks.push(new T.VectorKeyframeTrack('Hips.position',times,vals));
   }
  }
  clips.push(new T.AnimationClip(name,s.meta.durationS,tracks));
 }
 return clips;
}
function measure(rig,clip){
 const mixer=new T.AnimationMixer(rig.scene),act=mixer.clipAction(clip);act.setLoop(T.LoopOnce,0);act.clampWhenFinished=true;act.play();const frames=[],nominalSpeed=sources.walk.meta.measurements.netHorizontalM/sources.walk.meta.durationS*BASE_SCALE;
 for(let i=0;i<=Math.round(clip.duration*30);i++){
  const t=Math.min(clip.duration,i/30);mixer.setTime(t);rig.scene.updateMatrixWorld(true);
  const feet=['Left','Right'].map(side=>{let shoe=rig.scene.getObjectByName(side+'-sole'),bb=new T.Box3().setFromObject(shoe),toe=rig.names.get(side+'ToeBase').getWorldPosition(new T.Vector3()),ankle=rig.names.get(side+'Foot').getWorldPosition(new T.Vector3());return {side,minY:bb.min.y,toe:toe.toArray(),ankle:ankle.toArray()};});frames.push({t,feet});
 }
 mixer.stopAllAction();rig.scene.updateMatrixWorld(true);
 return {clip:clip.name,duration:clip.duration,nominalSpeed,frames};
}
const reports=[];
for(const role of ['traveler','shopkeeper']){
 const rig=make(role),clips=clipsFor(rig),measurements=clips.map(c=>measure(rig,c));
 // Correct sole penetration per-frame at asset preparation time, retaining planar in-place authority.
 for(const clip of clips){const data=measurements.find(m=>m.clip===clip.name),hipTrack=clip.tracks.find(t=>t.name==='Hips.position');
  for(let i=0;i<hipTrack.times.length;i++){
   const f=data.frames[Math.min(data.frames.length-1,i)];const min=Math.min(...f.feet.map(v=>v.minY));
   hipTrack.values[i*3+2]-=(-min/(BASE_SCALE*.01));
  }
 }
 const corrected=clips.map(c=>measure(rig,c));await fs.writeFile(path.join(here,role+'-foot-samples.json'),JSON.stringify(corrected,null,2));
 const previewMixer=new T.AnimationMixer(rig.scene);previewMixer.clipAction(clips[0]).play();previewMixer.setTime(0);rig.scene.updateMatrixWorld(true);const pose=await new GLTFExporter().parseAsync(rig.scene,{binary:true,onlyVisible:true});await fs.writeFile(path.join(here,role+'-pose.glb'),Buffer.from(pose));previewMixer.stopAllAction();
 const blob=await new GLTFExporter().parseAsync(rig.scene,{binary:true,animations:clips,onlyVisible:true});const b=Buffer.from(blob);await fs.writeFile(path.join(out,role+'.glb'),b);
 const bounds=new T.Box3().setFromObject(rig.scene);reports.push({role,file:role+'.glb',sha256:sha(b),bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},clips:clips.map(c=>({name:c.name,duration:c.duration,tracks:c.tracks.length})),nominalWalkSpeed:corrected.find(v=>v.clip==='walk').nominalSpeed,soleMinY:Object.fromEntries(corrected.map(d=>[d.clip,Math.min(...d.frames.flatMap(v=>v.feet.map(f=>f.minY)))]))});
}
const provenance={status:'local-only-original-geometry-library-derived-motion-not-publish-approved',sources:Object.fromEntries(Object.entries(sources).map(([k,s])=>[k,{id:s.id,sha256:s.meta.sha256,source:s.meta.source,license:'Local user Mixamo library; original FBX and source Skin not copied; no source library edits',frames:s.meta.frames,durationS:s.meta.durationS}])),method:'Original rigid-segment cartoon character; source rig rest axes retained; source local quaternion tracks reused, Hips planar translations removed; per-frame vertical sole correction, no new rootXZ motion',variants:reports};
await fs.writeFile(path.join(here,'character-contract.json'),JSON.stringify(provenance,null,2));console.log(JSON.stringify(reports,null,2));
