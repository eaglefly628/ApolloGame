// Reconcile the external solver's metre-space poses with the actual native skeleton.
import {homedir} from 'node:os';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {composeEngine} from '../../scripts/lib/motion-compose-engine.mjs';
import {writeComposedGlb} from '../../scripts/lib/motion-compose-glb.mjs';
import {copyReviewAsset} from './review-assets.mjs';
import {verifyBake} from '../../scripts/motion-compose.mjs';
import {measureMotion,sha256,validateCatalog,check} from '../../scripts/lib/motion-catalog.mjs';
const dir=resolve(process.argv[2]),lib=resolve(process.env.APOLLO_MOTION_LIB||join(homedir(),'ApolloAssets/motion-lib-full-frames'));
const input=JSON.parse(readFileSync(join(dir,'input.json'))),solution=JSON.parse(readFileSync(join(dir,'solution.json'))),catalogBytes=readFileSync(join(lib,'catalog.json')),catalog=validateCatalog(JSON.parse(catalogBytes));check(sha256(catalogBytes)===input.catalogSha256,'catalog changed');
const skin=catalog.skins.find(r=>r.id===input.skin.id),base=catalog.clips.find(r=>r.id===input.base.id),skinBytes=readFileSync(join(lib,skin.file));check(sha256(skinBytes)===input.skin.sha256,'skin changed');
const api=await composeEngine(),T=api.THREE,exact=b=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),carrier=writeComposedGlb(skinBytes),loaded=await new api.GLTFLoader().parseAsync(exact(carrier),'');
const bones=[];loaded.scene.traverse(o=>{if(o.isBone)bones.push(o);});const by=new Map(bones.map(b=>[b.name,b]));
for(const b of input.initialPose){const o=by.get(b.name);o.position.fromArray(b.local.translation);o.quaternion.fromArray(b.local.rotation);o.scale.fromArray(b.local.scale);}loaded.scene.updateMatrixWorld(true,true);
const samples=[],expected=[];let maxBridgePositionErrorM=0,maxBridgeRotationErrorRad=0;
for(const frame of solution.frames){
 for(const b of bones){const p=frame.world[b.name],parentQ=b.parent.getWorldQuaternion(new T.Quaternion()).normalize();b.quaternion.copy(parentQ.invert().multiply(new T.Quaternion(...p.rotation))).normalize();b.updateWorldMatrix(false,true);}
 loaded.scene.updateMatrixWorld(true,true);
 for(const b of bones){const p=frame.world[b.name];maxBridgePositionErrorM=Math.max(maxBridgePositionErrorM,b.getWorldPosition(new T.Vector3()).distanceTo(new T.Vector3(...p.position)));maxBridgeRotationErrorRad=Math.max(maxBridgeRotationErrorRad,b.getWorldQuaternion(new T.Quaternion()).normalize().angleTo(new T.Quaternion(...p.rotation).normalize()));}
 const atSample=Math.abs(frame.at*solution.fps-Math.round(frame.at*solution.fps))<1e-6;
 if(atSample){samples.push(Object.fromEntries(bones.map(b=>[b.name,{translation:b.position.toArray(),rotation:b.quaternion.toArray(),scale:b.scale.toArray()}])));expected.push(frame.world);}
}
console.log('bridge',maxBridgePositionErrorM,maxBridgeRotationErrorRad);
check(maxBridgePositionErrorM<1e-5&&maxBridgeRotationErrorRad<1e-5,'Mink/native bridge mismatch');
const id=process.argv[3]||'mink-strike-match-ybot-v001';check(/^[a-z0-9][a-z0-9-]{0,119}$/.test(id),'invalid candidate ID');const fps=solution.fps,frames=samples.length,bytes=writeComposedGlb(skinBytes,{id,fps,frames,samples,THREE:T}),verification=await verifyBake(bytes,{api,frames,worldPoses:expected},fps),measured=await measureMotion(bytes,id,fps);
function exclusive(file,text){if(existsSync(file)){check(readFileSync(file).equals(Buffer.from(text)),'refusing changed output: '+file);}else writeFileSync(file,text,{flag:'wx'});}
exclusive(join(dir,'candidate.glb'),bytes);
// Validate the actual humanoid-retargeted playback, including inter-frame samples.
const baked=await new api.GLTFLoader().parseAsync(api.snapshotSkeletalGlb(exact(bytes)),''),extracted=api.extractSkeletalClip(baked.scene,baked.animations,{skeleton:'apollo-humanoid-v1',fps,frames,loop:false},baked.parser);
const target=await new api.GLTFLoader().parseAsync(exact(carrier),''),rest=api.captureSkeletonRest(target.scene,target.parser),bound=api.bindSkeletalClip(extracted,id,target.scene,rest,'humanoid'),mixer=new T.AnimationMixer(target.scene),action=mixer.clipAction(bound);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
const playback=[];for(let i=0;i<=Math.round(solution.durationS/solution.dt);i++){mixer.setTime(i*solution.dt);target.scene.updateMatrixWorld(true,true);const world={};target.scene.traverse(o=>{if(o.isBone)world[o.name]={position:o.getWorldPosition(new T.Vector3()).toArray(),rotation:o.getWorldQuaternion(new T.Quaternion()).toArray(),worldScale:o.getWorldScale(new T.Vector3()).toArray()};});playback.push({at:i*solution.dt,world});}
exclusive(join(dir,'playback.json'),JSON.stringify({version:1,dt:solution.dt,frames:playback})+'\n');
const review=join(dir,'review');mkdirSync(join(review,'skins'),{recursive:true});mkdirSync(join(review,'clips'),{recursive:true});
copyReviewAsset(join(lib,skin.file),join(review,skin.file),skin.sha256);copyReviewAsset(join(dir,'candidate.glb'),join(review,'clips',id+'.glb'),sha256(bytes));
const entry={...base,...measured,id,file:'clips/'+id+'.glb',sha256:sha256(bytes),derivedFrom:base.id,status:'draft',descZh:input.recipe?'衍生候选（生成意图：'+input.recipe.label+'），尚未视觉核对。':'Mink验证候选：身前双手配合短划，意图模拟擦火柴；身体代理与原皮肤检查独立记录，动作语义未批准。',descEn:input.recipe?'Derived upper-limb intent candidate; unreviewed.':'Unreviewed Mink hand-stroke candidate; not a certified match-striking motion.',tags:['mink-validation','upper-limb-intent','unreviewed'],provenance:{operation:'mink-validation',skinSha256:skin.sha256,baseSha256:base.sha256,solver:solution.backend,...(input.recipeSha256?{recipeSha256:input.recipeSha256}:{} )}};
exclusive(join(review,'catalog.json'),JSON.stringify(validateCatalog({version:1,skins:[skin],clips:[entry]}),null,2)+'\n');
const report={version:1,sourceSkinName:skin.source.mixamoName,status:'candidate-not-approved',summary:{backend:solution.backend,calibration:solution.calibration,bridge:{maxPositionErrorM:maxBridgePositionErrorM,maxRotationErrorRad:maxBridgeRotationErrorRad},bake:verification,proxyMinDistanceM:Math.min(...solution.checks.map(c=>c.minDistanceM)),maxTargetErrorM:Math.max(...solution.checks.flatMap(c=>Object.values(c.targetErrorsM))),frames,playbackChecks:playback.length},reviewLib:review,meshCheck:'pending',props:solution.props,sourceCatalogUnchanged:readFileSync(join(lib,'catalog.json')).equals(catalogBytes)};
exclusive(join(dir,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
