import {describe,it,expect} from 'vitest';
import {makeMockCharacterGlb} from './fixtures/character-pipeline/mock-character.mjs';
import {motionEngine,engineClip} from './lib/motion-engine.mjs';
import {writeComposedGlb,unpackGlb} from './lib/motion-compose-glb.mjs';
import {separatePlanarRootMotion} from './lib/motion-planar-root.mjs';
import {sha256} from './lib/motion-catalog.mjs';

async function fixture(){
 const api=await motionEngine(),rest=makeMockCharacterGlb(),gltf=await new api.GLTFLoader().parseAsync(rest.buffer.slice(rest.byteOffset,rest.byteOffset+rest.byteLength),'');
 const samples=[];
 for(let f=0;f<=30;f++){const sample={};gltf.scene.traverse(n=>{if(n.isBone)sample[n.name]={translation:n.position.toArray(),rotation:n.quaternion.toArray(),scale:n.scale.toArray()};});
  sample.Hips.translation[0]+=f/30;sample.Hips.translation[2]+=2*f/30;sample.Hips.translation[1]+=.03*Math.sin(f*Math.PI/15);
  sample.LeftHand.rotation=new api.THREE.Quaternion().setFromAxisAngle(new api.THREE.Vector3(0,0,1),f/60).toArray();samples.push(sample);}
 return writeComposedGlb(rest,{id:'source',fps:30,frames:31,samples,THREE:api.THREE});
}
async function compare(source,output,trajectory){
 const a=await engineClip(source,{fps:30,frames:31,loop:false}),b=await engineClip(output,{fps:30,frames:31,loop:false}),{THREE}=a.api;
 const mixers=[a,b].map(x=>{const m=new THREE.AnimationMixer(x.scene);const action=m.clipAction(x.clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();return m;});let max=0;
 for(let frame=0;frame<=30;frame++){for(let i=0;i<2;i++){mixers[i].setTime(frame/30);[a,b][i].scene.updateMatrixWorld(true);}const delta=new THREE.Vector3(trajectory.samples[frame].x,0,trajectory.samples[frame].z);
  a.scene.traverse(n=>{if(!n.isBone)return;const other=b.scene.getObjectByName(n.name);const p=n.getWorldPosition(new THREE.Vector3()),q=other.getWorldPosition(new THREE.Vector3()).add(delta);max=Math.max(max,p.distanceTo(q));expect(n.getWorldQuaternion(new THREE.Quaternion()).angleTo(other.getWorldQuaternion(new THREE.Quaternion()))).toBeLessThan(1e-5);});}
 return max;
}
describe('derived linear XZ root separation',()=>{
 it('reconstructs every original joint each frame while retaining vertical bob and hand rotation',async()=>{
  const source=await fixture(),original=Buffer.from(source),r=await separatePlanarRootMotion(source,{id:'derived',fps:30,frames:31,sourceSha256:sha256(source),policy:'linear-xz-v1'});
  expect(source).toEqual(original);expect(r.trajectory.net.x).toBeCloseTo(1,5);expect(r.trajectory.net.z).toBeCloseTo(2,5);
  expect(r.trajectory).toMatchObject({status:'derived-unreviewed',contactCalibration:'not-performed',loopApproval:'not-performed',sourceSha256:sha256(source),derivedSha256:sha256(r.bytes)});
  expect(await compare(source,r.bytes,r.trajectory)).toBeLessThan(1e-5);
  const loaded=await engineClip(r.bytes,{fps:30,frames:31,loop:false}),m=new loaded.api.THREE.AnimationMixer(loaded.scene),action=m.clipAction(loaded.clip);action.setLoop(loaded.api.THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();const points=[];
  for(let f=0;f<=30;f++){m.setTime(f/30);loaded.scene.updateMatrixWorld(true);points.push(loaded.scene.getObjectByName('Hips').getWorldPosition(new loaded.api.THREE.Vector3()));}
  expect(points.at(-1).x-points[0].x).toBeCloseTo(0,6);expect(points.at(-1).z-points[0].z).toBeCloseTo(0,6);expect(Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y))).toBeGreaterThan(.05);
 });
 it('uses world-meter XZ through a translated, rotated and scaled parent',async()=>{
  const source=await fixture(),{doc,binary}=unpackGlb(source),api=await motionEngine(),{THREE}=api;
  const root=doc.nodes.length,rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2),matrix=new THREE.Matrix4().compose(new THREE.Vector3(2,3,4),rotation,new THREE.Vector3(.01,.01,.01));
  doc.nodes.push({name:'CentimeterZUpRoot',translation:[2,3,4],rotation:rotation.toArray(),scale:[.01,.01,.01],children:doc.scenes[0].nodes});doc.scenes[0].nodes=[root];
  const bin=Buffer.from(binary),a=doc.accessors[doc.skins[0].inverseBindMatrices],v=doc.bufferViews[a.bufferView];
  for(let j=0;j<a.count;j++){const offset=(v.byteOffset||0)+(a.byteOffset||0)+j*64,inv=new THREE.Matrix4().fromArray(Array.from({length:16},(_,i)=>bin.readFloatLE(offset+i*4))).multiply(matrix.clone().invert());inv.elements.forEach((n,i)=>bin.writeFloatLE(n,offset+i*4));}
  const raw=Buffer.from(JSON.stringify(doc)),json=Buffer.alloc(Math.ceil(raw.length/4)*4,32);raw.copy(json);const transformed=Buffer.alloc(28+json.length+bin.length);transformed.write('glTF');transformed.writeUInt32LE(2,4);transformed.writeUInt32LE(transformed.length,8);transformed.writeUInt32LE(json.length,12);transformed.writeUInt32LE(0x4e4f534a,16);json.copy(transformed,20);transformed.writeUInt32LE(bin.length,20+json.length);transformed.writeUInt32LE(0x004e4942,24+json.length);bin.copy(transformed,28+json.length);
  const r=await separatePlanarRootMotion(transformed,{id:'derived',fps:30,frames:31,sourceSha256:sha256(transformed),policy:'linear-xz-v1'});
  expect(r.trajectory.net.x).toBeCloseTo(.01,6);expect(r.trajectory.net.z).toBeCloseTo(0,6);expect(await compare(transformed,r.bytes,r.trajectory)).toBeLessThan(1e-5);
 });
 it('rejects wrong SHA, unsupported policy, wrong frame grid and unknown options',async()=>{
  const source=await fixture(),options={id:'derived',fps:30,frames:31,sourceSha256:sha256(source),policy:'linear-xz-v1'};
  for(const change of [{sourceSha256:'0'.repeat(64)},{policy:'generic-root-motion'},{frames:30},{fps:0},{code:'free'}])await expect(separatePlanarRootMotion(source,{...options,...change})).rejects.toThrow();
 });
});

function pack(doc,bin){doc.buffers[0].byteLength=bin.length;const raw=Buffer.from(JSON.stringify(doc)),json=Buffer.alloc(Math.ceil(raw.length/4)*4,32);raw.copy(json);const b=Buffer.alloc(28+json.length+bin.length);b.write('glTF');b.writeUInt32LE(2,4);b.writeUInt32LE(b.length,8);b.writeUInt32LE(json.length,12);b.writeUInt32LE(0x4e4f534a,16);json.copy(b,20);b.writeUInt32LE(bin.length,20+json.length);b.writeUInt32LE(0x004e4942,24+json.length);bin.copy(b,28+json.length);return b;}
it('rejects a valid extra root joint outside the Hips subtree instead of corrupting it',async()=>{const {doc,binary}=unpackGlb(makeMockCharacterGlb({clipName:'travel'}));const extra=doc.nodes.length;doc.nodes.push({name:'MotionRoot',children:[0]});doc.scenes[0].nodes=doc.scenes[0].nodes.map(i=>i===0?extra:i);doc.skins[0].skeleton=extra;doc.skins[0].joints.push(extra);const old=doc.accessors[doc.skins[0].inverseBindMatrices],view=doc.bufferViews[old.bufferView],data=Buffer.alloc((old.count+1)*64);binary.copy(data,0,view.byteOffset,view.byteOffset+old.count*64);for(const i of [0,5,10,15])data.writeFloatLE(1,old.count*64+i*4);doc.bufferViews.push({buffer:0,byteOffset:binary.length,byteLength:data.length});doc.accessors.push({bufferView:doc.bufferViews.length-1,componentType:5126,count:old.count+1,type:'MAT4'});doc.skins[0].inverseBindMatrices=doc.accessors.length-1;const source=pack(doc,Buffer.concat([binary,data]));await engineClip(source,{fps:30,frames:31,loop:false});await expect(separatePlanarRootMotion(source,{id:'derived',fps:30,frames:31,sourceSha256:sha256(source),policy:'linear-xz-v1'})).rejects.toThrow(/every skin joint must descend from Hips/);});
