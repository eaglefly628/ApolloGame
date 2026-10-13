import * as T from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {writeFileSync,readFileSync} from 'node:fs';
globalThis.FileReader=class{readAsArrayBuffer(b){b.arrayBuffer().then(v=>{this.result=v;this.onloadend?.();})}readAsDataURL(b){b.arrayBuffer().then(v=>{this.result='data:application/octet-stream;base64,'+Buffer.from(v).toString('base64');this.onloadend?.();})}};
const C={wood:0xa46a32,gold:0xd4a64e,dark:0x593d2b,bronze:0xb99343,red:0xa44631,roof:0x345b5c,stone:0x8a9692,green:0x4a794c,wall:0xe7dec3};
let activeAsset='';
function mesh(g,geo,c,x=0,y=0,z=0){const m=new T.Mesh(geo,new T.MeshStandardMaterial({color:c,roughness:1,flatShading:true}));m.position.set(x,y,z);g.add(m);if(!['tree','rock'].includes(activeAsset)&&[C.wood,C.gold,C.dark].includes(c))m.material.userData.woodGrain=true;return m;}
const box=(g,c,x,y,z,w,h,d)=>mesh(g,new T.BoxGeometry(w,h,d),c,x,y,z);
function beam(g,c,a,b,w=.13){const av=new T.Vector3(...a),bv=new T.Vector3(...b);const m=mesh(g,new T.BoxGeometry(w,av.distanceTo(bv),w),c);m.position.copy(av.clone().add(bv).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),bv.sub(av).normalize());}
function roof(g,x,y,z,w,d){const vs=[[-w/2,0,-d/2],[w/2,0,-d/2],[0,.75,-d/2],[-w/2,0,d/2],[w/2,0,d/2],[0,.75,d/2]];const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vs.flat(),3));geo.setIndex([0,2,1,3,4,5,0,3,5,0,5,2,2,5,4,2,4,1,0,1,4,0,4,3]);const flat=geo.toNonIndexed();flat.computeVertexNormals();mesh(g,flat,C.roof,x,y,z);box(g,C.dark,x,y-.08,z,w+.15,.16,d+.15);}
function track(g,axis,angles,times){return new T.QuaternionKeyframeTrack(g.name+'.quaternion',times,angles.flatMap(a=>new T.Quaternion().setFromAxisAngle(new T.Vector3(...axis),a).toArray()));}
function turtle(){const g=new T.Group(),tracks=[];box(g,C.dark,0,.8,0,3.4,.55,4.4);const shell=mesh(g,new T.SphereGeometry(2.25,10,4,0,Math.PI*2,0,Math.PI/2),C.gold,0,1.02,0);shell.scale.set(1,.48,1.13);for(let i=-1;i<=1;i++)box(g,C.wood,i*1.05,1.64,0,.07,.06,3.2);
for(const x of [-1.83,1.83])for(const z of [-1.42,1.42]){const wheel=new T.Group();wheel.position.set(x,.72,z);wheel.name='wheel'+x+'z'+z;g.add(wheel);for(const [r,c,h]of [[.72,C.dark,.33],[.55,C.bronze,.36]]){const m=mesh(wheel,new T.CylinderGeometry(r,r,h,12),c);m.rotation.z=Math.PI/2;}for(const a of [0,Math.PI/2])box(wheel,C.wood,0,0,0,.4,.12,1.1).rotation.x=a;tracks.push(track(wheel,[1,0,0],[0,Math.PI/2,Math.PI,Math.PI*1.5,Math.PI*2],[0,2,4,6,8]));}
box(g,C.gold,0,1.08,2.7,1,.7,.95);for(const x of [-.52,.52])box(g,C.dark,x,1.24,2.9,.05,.14,.17);for(const x of [-.75,.75])for(const z of [-.8,.8])box(g,C.red,x,2.1,z,.16,1.3,.16);box(g,C.wall,0,1.9,-.5,1.4,.65,.12);roof(g,0,2.78,0,2,2.25);
for(const x of [-1.35,1.35]){box(g,C.wood,x,1.67,.35,1,.16,1.25);const p=new T.Group();p.name='bow'+x;p.position.set(x,1.9,.35);g.add(p);box(p,C.dark,0,-.12,0,.52,.3,.6);box(p,C.gold,0,.17,.15,.18,.17,1.55);beam(p,C.wood,[-.75,.18,.3],[.75,.18,.3],.18);for(const a of [-.75,.75])beam(p,C.bronze,[a,.18,.3],[0,.18,-.2],.05);tracks.push(track(p,[0,1,0],[-.2,.3,-.2],[0,4,8]));}
box(g,C.dark,0,2.13,-1.6,1.25,.2,.85);const a=new T.Group();a.name='catapult';a.position.set(0,2.43,-1.65);g.add(a);box(a,C.wood,0,.6,0,.15,1.6,.15);box(a,C.dark,0,1.4,.12,.5,.14,.45);tracks.push(track(a,[1,0,0],[-.45,-.45,.6,-.45,-.45],[0,2,2.3,3,8]));return {g,clips:[new T.AnimationClip('mechanical-loop',8,tracks)]};}
function house(){const g=new T.Group();box(g,C.wall,0,1,0,3,2,2.7);roof(g,0,2.05,0,3.5,3.25);box(g,C.dark,0,.65,1.36,.65,1.3,.04);for(const x of [-.9,.9])box(g,C.roof,x,1.25,1.37,.5,.55,.04);return {g};}
function tree(){const g=new T.Group();box(g,C.wood,0,.65,0,.25,1.3,.25);mesh(g,new T.IcosahedronGeometry(1.15,0),C.green,0,1.8,0).scale.set(.85,1.3,.85);return {g};}
function rock(){const g=new T.Group();mesh(g,new T.DodecahedronGeometry(1,0),C.stone,0,.5,0).scale.set(1.2,.7,.85);return {g};}
function ox(){
 const g=new T.Group(),body=new T.Group(),tracks=[];
 body.name='ox-body';g.add(body);
 box(body,C.wood,0,.7,0,.85,.7,1.4);box(body,C.red,0,1.09,0,.9,.12,.85);
 const head=new T.Group();head.name='ox-head';head.position.set(0,.8,.72);body.add(head);
 box(head,C.dark,0,0,.23,.6,.55,.55);
 for(const x of [-1,1])beam(head,C.bronze,[x*.22,.2,.38],[x*.5,.5,.48]);
 const times=[0,.3,.6,.9,1.2];
 for(const x of [-.45,.45])for(const z of [-.5,.5]){
  const leg=new T.Group();leg.name='ox-leg-'+(x<0?'left':'right')+'-'+(z<0?'rear':'front');leg.position.set(x,.5,z);body.add(leg);
  box(leg,C.dark,0,-.25,0,.2,.5,.2);
  const phase=x*z>0?1:-1;
  tracks.push(track(leg,[1,0,0],[0,.3*phase,0,-.3*phase,0],times));
 }
 tracks.push(new T.VectorKeyframeTrack('ox-body.position',times,[0,0,0,0,.02,0,0,0,0,0,.02,0,0,0,0]));
 tracks.push(track(head,[1,0,0],[0,-.025,0,-.025,0],times));
 return {g,clips:[new T.AnimationClip('walk',1.2,tracks)]};
}
function pickup(){const g=new T.Group();for(const x of [-.25,.25])mesh(g,new T.CylinderGeometry(.19,.19,.9,6),C.gold,x,.22,0).rotation.x=Math.PI/2;return {g};}
const report={};for(const [key,fn]of Object.entries({turtle,house,tree,rock,ox,pickup})){activeAsset=key;const {g,clips=[]}=fn();g.updateMatrixWorld(true);const exported=await new GLTFExporter().parseAsync(g,{binary:true,animations:clips});const bin=embedWood(Buffer.from(exported));writeFileSync('public/models/'+key+'.glb',bin);let tri=0;g.traverse(o=>{if(o.isMesh)tri+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});report[key]={bytes:bin.byteLength,triangles:tri,clips:clips.map(c=>c.name)};}writeFileSync('model-report.json',JSON.stringify(report,null,2));console.log(report);

function embedWood(b){
 const jlen=b.readUInt32LE(12),doc=JSON.parse(b.subarray(20,20+jlen).toString());
 const binStart=20+jlen,old=b.subarray(binStart+8,binStart+8+b.readUInt32LE(binStart));
 if(!doc.materials.some(m=>m.extras?.woodGrain))return b;
 const png=readFileSync('public/textures/wood-grain.png');const view=(doc.bufferViews??=[]).length;doc.bufferViews.push({buffer:0,byteOffset:old.length,byteLength:png.length});
 doc.images=[{bufferView:view,mimeType:'image/png'}];doc.samplers=[{magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497}];doc.textures=[{sampler:0,source:0}];
 for(const m of doc.materials)if(m.extras?.woodGrain)m.pbrMetallicRoughness.baseColorTexture={index:0};
 let binary=Buffer.concat([old,png]);binary=Buffer.concat([binary,Buffer.alloc((4-binary.length%4)%4)]);doc.buffers[0].byteLength=binary.length;
 let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
 const h=Buffer.alloc(20);h.writeUInt32LE(0x46546c67,0);h.writeUInt32LE(2,4);h.writeUInt32LE(28+json.length+binary.length,8);h.writeUInt32LE(json.length,12);h.writeUInt32LE(0x4e4f534a,16);
 const bh=Buffer.alloc(8);bh.writeUInt32LE(binary.length);bh.writeUInt32LE(0x004e4942,4);return Buffer.concat([h,json,bh,binary]);
}
