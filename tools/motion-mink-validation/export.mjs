// Experimental calibration bridge; actual source assets and exports stay outside Git.
import {homedir} from 'node:os';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {composeEngine} from '../../scripts/lib/motion-compose-engine.mjs';
import {writeComposedGlb,unpackGlb} from '../../scripts/lib/motion-compose-glb.mjs';
import {loadMotionRecipe,motionRecipeSha} from './recipe.mjs';
import {sha256,check,validateCatalog} from '../../scripts/lib/motion-catalog.mjs';
const lib=resolve(process.env.APOLLO_MOTION_LIB||join(homedir(),'ApolloAssets/motion-lib-full-frames'));
const recipe=process.argv[3]?loadMotionRecipe(process.argv[3]):null;
check(process.argv[2],'output directory required');const out=resolve(process.argv[2]);
check(!out.includes('/ApolloGame/'),'experiment data cannot be written to repository');
const catalogBytes=readFileSync(join(lib,'catalog.json')),c=validateCatalog(JSON.parse(catalogBytes)),skin=c.skins.find(r=>recipe?r.id===recipe.source.skinId:r.source.mixamoName==='Y Bot'),base=c.clips.find(r=>r.id===(recipe?.source.baseClipId||'texting-119350901'));
check(skin&&base,'recipe source IDs not found');const sourceTime=recipe?.source.atS??5;check(sourceTime<=base.durationS,'source time outside base clip');
const skinBytes=readFileSync(join(lib,skin.file)),baseBytes=readFileSync(join(lib,base.file));check(sha256(skinBytes)===skin.sha256&&sha256(baseBytes)===base.sha256,'source hash mismatch');
const api=await composeEngine(),T=api.THREE;
const exact=b=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
const carrier=writeComposedGlb(skinBytes),target=await new api.GLTFLoader().parseAsync(exact(carrier),'');
const source=await new api.GLTFLoader().parseAsync(api.snapshotSkeletalGlb(exact(baseBytes)),'');
const rest=api.captureSkeletonRest(target.scene,target.parser),clip=api.extractSkeletalClip(source.scene,source.animations,{skeleton:'apollo-humanoid-v1',fps:base.fps,frames:base.frames,loop:false},source.parser);
const bound=api.bindSkeletalClip(clip,clip.clip.name,target.scene,rest,'humanoid'),mixer=new T.AnimationMixer(target.scene),action=mixer.clipAction(bound);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
const bones=[];target.scene.traverse(o=>{if(o.isBone)bones.push(o);});
function pose(){target.scene.updateMatrixWorld(true,true);return bones.map(b=>{const w=b.getWorldScale(new T.Vector3());check(w.x>0&&Math.abs(w.x-w.y)<1e-6&&Math.abs(w.x-w.z)<1e-6,'positive uniform scale required');let p=b.parent;while(p&&!p.isBone)p=p.parent;return {name:b.name,parent:p?.name||null,position:b.getWorldPosition(new T.Vector3()).toArray(),rotation:b.getWorldQuaternion(new T.Quaternion()).toArray(),worldScale:w.toArray(),local:{translation:b.position.toArray(),rotation:b.quaternion.toArray(),scale:b.scale.toArray()}};});}
const restPose=pose();mixer.setTime(sourceTime);const sourcePose=pose();
// Start the numerical warm-up from separated arms; the warm-up is not exported as animation.
for(const b of bones)if(/^(Left|Right)(UpperArm|LowerArm|Hand)$/.test(b.name)||/^LeftHand(?:Thumb|Index|Middle|Ring|Pinky)[1-3]$/.test(b.name))b.quaternion.fromArray(restPose.find(r=>r.name===b.name).local.rotation);
const initialPose=pose();
// Original rest mesh positions + weights: used for independent skinned-surface checks.
const {doc,binary}=unpackGlb(skinBytes),jointNames=doc.skins[0].joints.map(i=>doc.nodes[i].name);
const size={5121:1,5123:2,5126:4},read={5121:'readUInt8',5123:'readUInt16LE',5126:'readFloatLE'};
function accessor(i,width){const a=doc.accessors[i],v=doc.bufferViews[a.bufferView];check(!a.sparse&&!a.normalized&&read[a.componentType],'unsupported accessor');return Array.from({length:a.count},(_,r)=>Array.from({length:width},(_,k)=>binary[read[a.componentType]]((v.byteOffset||0)+(a.byteOffset||0)+r*(v.byteStride||width*size[a.componentType])+k*size[a.componentType])));}
const vertices=[];for(const mesh of doc.meshes)for(const primitive of mesh.primitives){const p=accessor(primitive.attributes.POSITION,3),j=accessor(primitive.attributes.JOINTS_0,4),w=accessor(primitive.attributes.WEIGHTS_0,4);for(let i=0;i<p.length;i++)vertices.push({p:p[i],j:j[i].map(k=>jointNames[k]),w:w[i]});}
const ibm=accessor(doc.skins[0].inverseBindMatrices,16);
const input={version:1,units:'metres',axes:'right-handed model +Y up, +Z front; confirmed from rest geometry',catalogSha256:sha256(catalogBytes),skin:{id:skin.id,file:skin.file,sha256:skin.sha256,hipHeight:skin.hipHeight},base:{id:base.id,sha256:base.sha256,atS:sourceTime},...(recipe?{recipe,recipeSha256:motionRecipeSha(recipe)}:{}),restPose,sourcePose,initialPose,jointNames,inverseBindMatrices:ibm,vertices};
mkdirSync(out,{recursive:true});const file=join(out,'input.json'),text=JSON.stringify(input)+'\n';if(existsSync(file))check(readFileSync(file,'utf8')===text,'existing calibration differs');else writeFileSync(file,text,{flag:'wx'});
console.log(JSON.stringify({out,bones:bones.length,vertices:vertices.length,hipHeight:skin.hipHeight,hipsScale:restPose.find(b=>b.name==='Hips').worldScale,hands:initialPose.filter(b=>['LeftHand','RightHand','LeftHandMiddle1','RightHandMiddle1','Head','Hips','LeftUpperArm','RightUpperArm'].includes(b.name)).map(({name,position,rotation})=>({name,position,rotation}))}));
mixer.stopAllAction();
