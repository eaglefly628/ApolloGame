import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const root=new URL('../',import.meta.url),publicRoot=new URL('public/',root),contract=JSON.parse(await fs.readFile(new URL('face-studio-20261120/face-contract.json',root))),report=[];
const sha=b=>createHash('sha256').update(b).digest('hex'),read=src=>fs.readFile(new URL(src.replace(/^\//,''),publicRoot));
const binary=await read(contract.sharedBinary.src);if(sha(binary)!==contract.sharedBinary.sha256)throw Error('shared bin hash');
globalThis.ProgressEvent=class{constructor(type,params){this.type=type;Object.assign(this,params)}};
const manager=new T.LoadingManager(),url='data:application/octet-stream;base64,'+binary.toString('base64');manager.setURLModifier(src=>src===contract.sharedBinary.src?url:src);const loader=new GLTFLoader(manager);
function check(g,id){const head=g.scene.getObjectByName('Head'),features=[];g.scene.traverse(o=>{if(o.isMesh&&o.name.startsWith('face-'))features.push(o)});if(!head||features.length!==4||features.some(o=>o.parent!==head))throw Error(id+' incorrect four-feature Head binding');if(g.animations.map(c=>c.name).sort().join()!=='idle,walk,wave')throw Error(id+' missing clips');
 let vertices=0;g.scene.traverse(o=>{if(o.isMesh){for(const [name,a]of Object.entries(o.geometry.attributes)){if(!Array.from(a.array).every(Number.isFinite))throw Error(id+' nonfinite '+name)}const a=o.geometry.attributes.position;vertices+=a.count;if(o.geometry.index&&Math.max(...o.geometry.index.array)>=a.count)throw Error(id+' invalid index')}});return{head,features,vertices};}
for(const v of contract.variants){const b=await read(v.src),g=await loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),''),c=check(g,v.id);report.push({id:v.id,vertices:c.vertices});}
if(report.length!==81)throw Error('not 81 variants');
const main=JSON.parse(await fs.readFile(new URL('scenes/reference-street.json',publicRoot))),gallery=JSON.parse(await fs.readFile(new URL('scenes/face-gallery.json',publicRoot))),npcs=[];
for(const [i,n]of contract.npcs.entries()){
 const b=await read(n.src);if(sha(b)!==n.sha256)throw Error(n.shop+' hash');
 for(const d of [main,gallery]){const a=d.assets.find(a=>a.key===n.modelKey);if(a?.src!==n.src)throw Error(n.shop+' scene asset mismatch')}
 if(main.manifest.entities['shopkeeper-'+i].Model3D.modelKey!==n.modelKey)throw Error('main NPC mapping');
 const g=await loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),''),c=check(g,n.shop),mixer=new T.AnimationMixer(g.scene);let error=0;
 for(const clip of g.animations){mixer.stopAllAction();mixer.clipAction(clip).play();const initial=new Map();for(let frame=0;frame<=Math.ceil(clip.duration*120);frame++){mixer.setTime(Math.min(frame/120,clip.duration-1e-8));g.scene.updateMatrixWorld(true);for(const f of c.features){const relative=new T.Matrix4().copy(c.head.matrixWorld).invert().multiply(f.matrixWorld);if(!initial.has(f.name))initial.set(f.name,relative.clone());error=Math.max(error,...relative.elements.map((x,i)=>Math.abs(x-initial.get(f.name).elements[i])))}}}
 if(error>1e-8)throw Error(n.shop+' face detached');npcs.push({shop:n.shop,faceId:n.faceId,sha256:n.sha256,maxRelativeHeadMatrixError:error,clips:g.animations.map(c=>c.name)});
}
if(new Set(npcs.map(n=>n.faceId)).size!==5)throw Error('NPC identities repeated');
const charRoot='/art/reference-rebuild-20261120/character/';if(sha(await read(charRoot+'traveler-v4.glb'))!==contract.sources.travelerV4||sha(await read(charRoot+'shopkeeper-v2.glb'))!==contract.sources.shopkeeperV2)throw Error('source changed');
console.log(JSON.stringify({status:'pass',variants:report.length,sharedBinarySha256:sha(binary),npcChecks:npcs,sourceAssetsUnchanged:true},null,2));
