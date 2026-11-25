import {readFileSync,writeFileSync,mkdirSync,copyFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const root=new URL('./',import.meta.url);
const source=new URL('../game628-life-controls-20261117/public/',import.meta.url);
const baseline=JSON.parse(readFileSync(new URL('baseline.json',root),'utf8'));
const scene=structuredClone(baseline);
const provenance=[];
mkdirSync(new URL('public/art/',root),{recursive:true});
for(const asset of scene.assets){
 const target=new URL('public/art/'+asset.key+'.glb',root);
 if(!existsSync(target))copyFileSync(new URL(asset.src.slice(1),source),target);
 const bytes=readFileSync(target);
 provenance.push({key:asset.key,source:asset.src,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length});
 asset.src='/art/'+asset.key+'.glb';
}
const bytes=readFileSync(new URL('public/art/reference-street.glb',root));
const jsonLength=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.subarray(20,20+jsonLength));
for(const mesh of gltf.meshes??[])for(const primitive of mesh.primitives)delete primitive.material;
delete gltf.materials;delete gltf.images;delete gltf.textures;
const data=Buffer.from(JSON.stringify(gltf)),padded=Buffer.concat([data,Buffer.alloc((4-data.length%4)%4,32)]);
const tail=bytes.subarray(20+jsonLength),header=Buffer.alloc(20);
header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(20+padded.length+tail.length,8);
header.writeUInt32LE(padded.length,12);header.writeUInt32LE(0x4e4f534a,16);
const collisionBytes=Buffer.concat([header,padded,tail]);
const model=await new GLTFLoader().parseAsync(collisionBytes.buffer.slice(collisionBytes.byteOffset,collisionBytes.byteOffset+collisionBytes.byteLength),'');
const ground=scene.manifest.entities['ground-continuation'];
if(ground){
 const m=ground.Mesh3D,t=ground.Transform3D;
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(m.width,m.height,m.depth),new THREE.MeshBasicMaterial());
 mesh.position.set(t.x,t.y,t.z);model.scene.add(mesh);
}
model.scene.updateMatrixWorld(true);
const meshes=[];model.scene.traverse(o=>{if(o.isMesh)meshes.push(o);});
for(const id of Object.keys(scene.manifest.entities))if(id.startsWith('weather-'))delete scene.manifest.entities[id];
const entities=scene.manifest.entities;
let seed=628041;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const ray=new THREE.Raycaster(),evidence=[];
const groups={snow:[],blizzard:[]};
for(const [mode,count] of [['snow',84],['blizzard',420]]){
 for(let i=0;i<count;i++){
  const slope=mode==='snow'?0.04+random()*0.035:0.63+random()*0.22;
  const velocity=mode==='snow'?0.65+random()*0.4:1.6+random()*0.9;
  const origin=new THREE.Vector3(-18+random()*30,11,0.1+random()*5.4);
  ray.set(origin,new THREE.Vector3(slope,-1,0).normalize());
  const hit=ray.intersectObjects(meshes,false)[0];
  if(!hit||hit.point.x < -12.0||hit.point.x>12.0)continue;
  const p=hit.point,half=(origin.y-p.y)/2;
  if(half<=0.05)continue;
  const width=(mode==='snow'?0.018:0.016)+random()*0.014;
  const length=mode==='snow'?width*1.3:width*(2.1+random()*1.8);
  const angle=Math.atan(slope),phase=random()*Math.PI*2;
  const id='weather-'+mode+'-'+i;
  entities[id]={
   Transform3D:{
    x:p.x-slope*half-Math.sin(angle)*length/2,
    y:p.y+half+Math.cos(angle)*length/2+0.008,z:p.z,
    rotZ:angle,rotY:0.1,scaleX:width,scaleY:length,scaleZ:width*0.5,
   },
   Mesh3D:{shape:'box',width:1,height:1,depth:1,frontTint:0xe6edf0},
   Material3D:{preset:'matte',shading:'flat',color:mode==='snow'?0xe6edf0:0xcddde5},
   Anim3D:{channels:[
    {kind:'osc',field:'y',wave:'saw',amp:-half,freq:velocity*Math.PI/half,phase},
    {kind:'osc',field:'x',wave:'saw',amp:slope*half,freq:velocity*Math.PI/half,phase},
   ]},
   Visibility:{visible:false},
  };
  groups[mode].push(id);
  evidence.push({id,origin:origin.toArray(),end:p.toArray(),slope,velocity,normal:hit.face.normal.clone().transformDirection(hit.object.matrixWorld).toArray()});
 }
}
entities['weather-fog']={Fog3D:{color:0xc5d5db,near:70,far:260}};
scene.environment={
 initial:'weather.clear',durationMs:1400,presets:{},
};
const baseDay=baseline.environment.presets['env.day'].patches
 .filter(p=>!p.entity.startsWith('weather-'));
for(const mode of ['clear','snow','blizzard']){
 const patches=structuredClone(baseDay);
 if(mode!=='clear'){
  for(const p of patches){
   if(p.entity==='sun')Object.assign(p.values,{color:0xe4ebed,intensity:mode==='snow'?1.75:1.35});
   if(p.entity==='ambient')Object.assign(p.values,{color:0xc9d9e5,intensity:mode==='snow'?0.9:1.0});
   if(p.entity==='sky')Object.assign(p.values,{top:mode==='snow'?0x8daab9:0x7f9aa9,bottom:0xc5d5db,cloudTint:0xd1dde2,env:0.12});
   if(p.entity==='distant-skyline')p.values.tint=mode==='snow'?0xd0e0e7:0xb4c8d4;
  }
 }
 patches.push({entity:'weather-fog',component:'Fog3D',values:
  mode==='clear'?{color:0xc5d5db,near:70,far:260}
  :mode==='snow'?{color:0xc5d5db,near:20,far:95}
  :{color:0xc5d5db,near:12.5,far:33}});
 for(const group of ['snow','blizzard'])for(const entity of groups[group]){
  patches.push({entity,component:'Visibility',values:{visible:mode===group}});
 }
 scene.environment.presets['weather.'+mode]={label:{clear:'常态',snow:'普通下雪',blizzard:'暴风雪'}[mode],patches};
}
scene.layout.props={...scene.layout.props,fill:true};
scene.links={};
scene.keys={ArrowLeft:{dx:-1},KeyA:{dx:-1},ArrowRight:{dx:1},KeyD:{dx:1},ArrowUp:{dy:-1},KeyW:{dy:-1},ArrowDown:{dy:1},KeyS:{dy:1},Space:{action:'pose.wave'}};
scene.layout.children=scene.layout.children.filter(n=>n.id!=='weather-controls');
const headerNode=scene.layout.children.find(n=>n.id==='header');
headerNode.children=[{id:'title',type:'Label',props:{text:'梧桐街 · 暴风雪独立预览',size:18,color:'text'}}];
const footer=scene.layout.children.find(n=>n.id==='footer');
footer.children=[
 {id:'instructions',type:'Label',layout:{flex:1},props:{text:'← → / A D 行走 · 三态可反复切换',size:12,color:'text'}},
 ...['clear','snow','blizzard'].map(mode=>({id:'select-'+mode,type:'Button',props:{label:{clear:'常态',snow:'普通下雪',blizzard:'暴风雪'}[mode],action:'weather.'+mode,kind:'quiet'}})),
 {id:'lab-sample',type:'Button',props:{label:'采样当前档',action:'lab.sample',kind:'quiet'}},
];
scene.quality='reference';
writeFileSync(new URL('public/scenes/blizzard.json',root),JSON.stringify(scene,null,2)+'\n');
writeFileSync(new URL('provenance.json',root),JSON.stringify(provenance,null,2)+'\n');
writeFileSync(new URL('collision.json',root),JSON.stringify({counts:Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,v.length])),samples:evidence},null,2)+'\n');
console.log('Baked snow',Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,v.length])));
