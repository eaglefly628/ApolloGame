// Offline authored facial components, shared data recipes, no runtime UI/logic implementation.
import fs from'node:fs/promises';import path from'node:path';import{fileURLToPath}from'node:url';import crypto from'node:crypto';import * as T from'three';import{GLTFLoader}from'three/addons/loaders/GLTFLoader.js';import{mergeGeometries}from'three/addons/utils/BufferGeometryUtils.js';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'..'),out=path.join(root,'public/art/face-studio-20261120');await fs.mkdir(out,{recursive:true});const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function unpack(b){const l=b.readUInt32LE(12);return{j:JSON.parse(b.subarray(20,20+l)),bin:b.subarray(28+l)};}
const original=await fs.readFile(path.join(root,'public/art/reference-rebuild-20261120/character/shopkeeper-v2.glb')),fixed=await fs.readFile(path.join(root,'public/art/reference-rebuild-20261120/character/traveler-v4.glb'));const{j,bin}=unpack(original),v4=unpack(fixed),gltf=await new GLTFLoader().parseAsync(original.buffer.slice(original.byteOffset,original.byteOffset+original.length),'');gltf.scene.updateMatrixWorld(true);const Head=gltf.scene.getObjectByName('Head'),hc=gltf.scene.getObjectByName('head').getWorldPosition(new T.Vector3()),headInverse=Head.matrixWorld.clone().invert(),headId=j.nodes.findIndex(n=>n.name==='Head');const parts={eyes:[],brows:[],nose:[],mouth:[]};
const chunks=[bin];let len=bin.length;
function addData(data,componentType,count,type,target){while(len%4){chunks.push(Buffer.from([0]));len++;}const bv=j.bufferViews.length;j.bufferViews.push({buffer:0,byteOffset:len,byteLength:data.length,...(target?{target}:{})});chunks.push(data);len+=data.length;const i=j.accessors.length;const ac={bufferView:bv,componentType,count,type};if(componentType===5126){const k={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[type],a=new Float32Array(data.buffer,data.byteOffset,count*k);ac.min=Array(k).fill(Infinity);ac.max=Array(k).fill(-Infinity);for(let q=0;q<count;q++)for(let c=0;c<k;c++){ac.min[c]=Math.min(ac.min[c],a[q*k+c]);ac.max[c]=Math.max(ac.max[c],a[q*k+c]);}}j.accessors.push(ac);return i;}
function copyAccessor(other,a){const x=other.j.accessors[a],v=other.j.bufferViews[x.bufferView],bytes={5126:4,5125:4,5123:2,5121:1}[x.componentType],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[x.type],off=(v.byteOffset??0)+(x.byteOffset??0),b=other.bin.subarray(off,off+x.count*n*bytes);return addData(b,x.componentType,x.count,x.type,v.target);}
// Use the already-reviewed v4 sole curves and valid cap-visor in the new NPC generation pipeline.
for(const anim of j.animations){const a=v4.j.animations.find(v=>v.name===anim.name),ch=a.channels.find(v=>v.target.path==='translation'&&v4.j.nodes[v.target.node].name==='Hips'),src=a.samplers[ch.sampler],ownch=anim.channels.find(v=>v.target.path==='translation'&&j.nodes[v.target.node].name==='Hips');anim.samplers[ownch.sampler]={...src,input:copyAccessor(v4,src.input),output:copyAccessor(v4,src.output)};}
const vn=v4.j.nodes.find(n=>n.name==='cap-visor'),vp=v4.j.meshes[vn.mesh].primitives[0],on=j.nodes.find(n=>n.name==='cap-visor');for(const[k,a]of Object.entries(vp.attributes))j.meshes[on.mesh].primitives[0].attributes[k]=copyAccessor(v4,a);
const oldFaceNames=['eye--1','eye-1','brow--1','brow-1','nose','smile'];const removed=j.nodes.map((n,i)=>oldFaceNames.includes(n.name)?i:-1).filter(i=>i>=0);j.nodes[headId].children=j.nodes[headId].children.filter(i=>!removed.includes(i));
const matOf=name=>j.meshes[j.nodes.find(n=>n.name===name).mesh].primitives[0].material;const materials={eyes:matOf('eye--1'),brows:matOf('brow--1'),nose:matOf('nose'),mouth:matOf('smile')};
function ell(center,size,segments=12){const g=new T.SphereGeometry(1,segments,8);g.scale(...size);g.translate(...center);return g;}
function curve(points,r=.009){return new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),16,r,6,false);}
function rounded(w,h,d,r=.004){r=Math.min(r,w*.45,h*.45,d*.45);const s=new T.Shape(),x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);const g=new T.ExtrudeGeometry(s,{depth:d-2*r,bevelEnabled:true,bevelThickness:r,bevelSize:r,bevelSegments:1,steps:1,curveSegments:3});g.translate(0,0,-d/2+r);g.scale(w/(w+2*r),h/(h+2*r),1);return g;}
const [cx,cy,cz]=hc.toArray();
for(let choice=0;choice<3;choice++){
 let eye=[],brow=[];
 for(const side of[-1,1]){
  const x=cx+side*.105;
  if(choice===0)eye.push(ell([x,cy+.018,cz+.214],[.023,.036,.014]));
  if(choice===1)eye.push(curve([[x-.045,cy+.012,cz+.216],[x,cy+.035,cz+.218],[x+.045,cy+.012,cz+.216]],.009));
  if(choice===2)eye.push(ell([cx+side*.115,cy+.017,cz+.216],[.034,.023,.014]));
  if(choice===0){const g=rounded(.075,.016,.012);g.translate(x,cy+.092,cz+.213);brow.push(g);}
  if(choice===1)brow.push(curve([[x-.048,cy+.087,cz+.213],[x,cy+.116,cz+.214],[x+.048,cy+.087,cz+.213]],.008));
  if(choice===2){const g=rounded(.09,.025,.015,.005);g.rotateZ(side*.20);g.translate(x,cy+.095,cz+.214);brow.push(g);}
 }
 parts.eyes.push(eye);parts.brows.push(brow);
 if(choice===0)parts.nose.push([ell([cx,cy-.035,cz+.234],[.036,.037,.045],8)]);
 if(choice===1)parts.nose.push([ell([cx,cy-.019,cz+.235],[.026,.055,.038],10)]);
 if(choice===2){const g=new T.ConeGeometry(.035,.085,4,1);g.rotateX(Math.PI/2);g.translate(cx,cy-.03,cz+.237);parts.nose.push([g]);}
 if(choice===0)parts.mouth.push([curve([[cx-.07,cy-.095,cz+.211],[cx,cy-.12,cz+.218],[cx+.07,cy-.095,cz+.211]],.009)]);
 if(choice===1)parts.mouth.push([curve([[cx-.065,cy-.10,cz+.214],[cx,cy-.102,cz+.217],[cx+.065,cy-.10,cz+.214]],.010)]);
 if(choice===2)parts.mouth.push([ell([cx,cy-.109,cz+.216],[.040,.052,.012],12)]);
}
let componentNodes={};
for(const[family,choices]of Object.entries(parts)){
 componentNodes[family]=[];
 for(let choice=0;choice<choices.length;choice++){
  const geometries=choices[choice].map(g=>(g.index?g.toNonIndexed():g).applyMatrix4(headInverse)),geo=mergeGeometries(geometries,false),attrs={};
  for(const[key,att]of Object.entries(geo.attributes)){const name={position:'POSITION',normal:'NORMAL',uv:'TEXCOORD_0'}[key];if(name)attrs[name]=addData(Buffer.from(att.array.buffer,att.array.byteOffset,att.array.byteLength),5126,att.count,att.itemSize===2?'VEC2':'VEC3',34962);}
  const mi=j.meshes.length;j.meshes.push({name:'face-'+family+'-'+choice,primitives:[{mode:4,attributes:attrs,material:materials[family]}]});const ni=j.nodes.length;j.nodes.push({name:'face-'+family+'-'+choice,mesh:mi});componentNodes[family].push(ni);
 }
}
j.buffers[0].byteLength=len;const commonBin=Buffer.concat(chunks);await fs.writeFile(path.join(out,'shared-body.bin'),commonBin);
function glb(json,bin){const a=Buffer.from(JSON.stringify(json)),ap=Buffer.alloc((4-a.length%4)%4,0x20),bp=Buffer.alloc((4-bin.length%4)%4),h=Buffer.alloc(12),ah=Buffer.alloc(8),bh=Buffer.alloc(8);h.writeUInt32LE(0x46546c67);h.writeUInt32LE(2,4);h.writeUInt32LE(12+8+a.length+ap.length+8+bin.length+bp.length,8);ah.writeUInt32LE(a.length+ap.length);ah.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(bin.length+bp.length);bh.writeUInt32LE(0x004e4942,4);return Buffer.concat([h,ah,a,ap,bh,bin,bp]);}
const variants=[];
for(let e=0;e<3;e++)for(let b=0;b<3;b++)for(let n=0;n<3;n++)for(let m=0;m<3;m++){
 const dna={eyes:e,brows:b,nose:n,mouth:m},id=[e,b,n,m].join(''),json=structuredClone(j);json.nodes[headId].children.push(...Object.entries(dna).map(([k,v])=>componentNodes[k][v]));json.buffers[0].uri='/art/face-studio-20261120/shared-body.bin';await fs.writeFile(path.join(out,'face-'+id+'.gltf'),JSON.stringify(json));variants.push({id,dna,key:'npc-face-'+id,src:'/art/face-studio-20261120/face-'+id+'.gltf'});
}
const assignments=[['grocery','0010'],['bakery','1100'],['noodles','2221'],['catcafe','1012'],['bikeshop','2200']];const npcs=[];
for(const[shop,id]of assignments){const v=variants.find(v=>v.id===id),json=JSON.parse(await fs.readFile(path.join(out,'face-'+id+'.gltf'),'utf8'));delete json.buffers[0].uri;const bytes=glb(json,commonBin),name='npc-'+shop+'.glb';await fs.writeFile(path.join(out,name),bytes);npcs.push({shop,faceId:id,faceDNA:v.dna,modelKey:'npc-face-'+shop,src:'/art/face-studio-20261120/'+name,sha256:sha(bytes),AnimState3D:{clip:shop==='grocery'||shop==='catcafe'?'wave':'idle',loop:true,speed:1},scale:1});}
const contract={status:'finite-81-combination-local-prototype-not-infinite-avatar-system',families:{eyes:['椭圆眼','笑弯眼','横圆眼'],brows:['平眉','弧眉','斜粗眉'],nose:['圆鼻','长鼻','楔鼻'],mouth:['微笑','平嘴','圆嘴']},variants,npcs,partBinding:{parentNode:'Head',sameBodyMixer:true,independentSocketUsed:false},sources:{shopkeeperV2:sha(original),travelerV4:sha(fixed),sourceLibraryUnchanged:true},sharedBinary:{src:'/art/face-studio-20261120/shared-body.bin',bytes:commonBin.length,sha256:sha(commonBin)},seed:6282026,notes:['NPC body and library rotations retained; v4 valid visor and v3 exact sole vertical curves reused','No Mii meshes, faces, UI or code copied','Studio uses81 lightweight glTF recipes plus shared1MB bin; main street only five self-contained GLBs','No runtime helper, engine modification, DOM UI or per-frame random identity changes']};await fs.writeFile(path.join(here,'face-contract.json'),JSON.stringify(contract,null,2));console.log(JSON.stringify({variants:variants.length,npcs,sharedBinary:contract.sharedBinary},null,2));
