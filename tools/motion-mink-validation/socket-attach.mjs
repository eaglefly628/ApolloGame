// Offline production-layer candidate: native M6 Attach3D + IK, no custom solver.
import {composeEngine} from '../../scripts/lib/motion-compose-engine.mjs';
import {sampleRecipe} from '../../scripts/lib/motion-compose-runtime.mjs';
import {unpackGlb,writeComposedGlb} from '../../scripts/lib/motion-compose-glb.mjs';
import {inspectCharacterGlb} from '../../scripts/lib/character-glb.mjs';
import {check} from '../../scripts/lib/motion-catalog.mjs';
export const MATCH_HEAD_SOCKET='RightHandMatchHeadSocket';
const exact=bytes=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
const tuple=value=>Array.isArray(value)&&value.length===3&&value.every(Number.isFinite);
function pack(doc,binary){const text=Buffer.from(JSON.stringify(doc)),json=Buffer.alloc(Math.ceil(text.length/4)*4,32);text.copy(json);const bin=Buffer.alloc(Math.ceil(binary.length/4)*4);binary.copy(bin);const bytes=Buffer.alloc(28+json.length+bin.length);bytes.write('glTF');bytes.writeUInt32LE(2,4);bytes.writeUInt32LE(bytes.length,8);bytes.writeUInt32LE(json.length,12);bytes.writeUInt32LE(0x4e4f534a,16);json.copy(bytes,20);bytes.writeUInt32LE(bin.length,20+json.length);bytes.writeUInt32LE(0x004e4942,24+json.length);bin.copy(bytes,28+json.length);return bytes;}
function dispose(scene){scene.traverse(node=>{node.geometry?.dispose();node.skeleton?.dispose();for(const material of Array.isArray(node.material)?node.material:[node.material])material?.dispose();});}
export async function readRestRig(bytes){
 const api=await composeEngine(),carrier=writeComposedGlb(bytes),loaded=await new api.GLTFLoader().parseAsync(exact(carrier),'');
 try{const rest=api.captureSkeletonRest(loaded.scene,loaded.parser);check(!rest.error,rest.error||'invalid rest');return {api,rest};}finally{dispose(loaded.scene);}
}
/** Append one unweighted Bone, its real inverse rest matrix, and a new IBM accessor.
 * Original mesh/material/image buffer views and original binary prefix remain byte-identical. */
export async function addSocketBone(bytes,{bone='RightHand',name=MATCH_HEAD_SOCKET,offset,rot=[0,0,0]}){
 check(tuple(rot),'socket rotation requires 3 finite values');check(tuple(offset),'socket offset requires 3 finite bone-local values');check(typeof name==='string'&&/^[A-Za-z][A-Za-z0-9_]{0,119}$/.test(name),'invalid socket name');
 inspectCharacterGlb(bytes,{allowSkinMaterialExtensions:true});const {doc,binary}=unpackGlb(bytes);check(doc.buffers.length===1&&!doc.buffers[0].uri,'only embedded single-buffer skins supported');check(!doc.nodes.some(node=>node.name===name),'socket name already exists');
 const skin=doc.skins[0],parent=skin.joints.filter(index=>doc.nodes[index].name===bone);check(parent.length===1,'socket parent must be one skin Bone');check(skin.joints.length<512,'socket exceeds native joint budget');
 const {api,rest}=await readRestRig(bytes),T=api.THREE,parentWorld=new T.Matrix4().fromArray(rest.bones.get(bone).world),socketRotation=new T.Quaternion().setFromEuler(new T.Euler(...rot)),socketWorld=parentWorld.clone().multiply(new T.Matrix4().compose(new T.Vector3(...offset),socketRotation,new T.Vector3(1,1,1)));check(Math.abs(socketWorld.determinant())>1e-12,'socket rest matrix singular');const inverse=socketWorld.clone().invert().elements;
 const original=doc.accessors[skin.inverseBindMatrices],view=doc.bufferViews[original.bufferView];check(original.componentType===5126&&original.type==='MAT4'&&original.count===skin.joints.length&&!original.sparse,'unsupported inverse binds');
 const matrices=Buffer.alloc((original.count+1)*64);for(let i=0;i<original.count;i++)for(let k=0;k<16;k++)matrices.writeFloatLE(binary.readFloatLE((view.byteOffset||0)+(original.byteOffset||0)+i*(view.byteStride||64)+k*4),i*64+k*4);inverse.forEach((value,k)=>matrices.writeFloatLE(value,original.count*64+k*4));
 const baseLength=doc.buffers[0].byteLength,appendOffset=Math.ceil(baseLength/4)*4,outputBinary=Buffer.alloc(appendOffset+matrices.length);binary.copy(outputBinary,0,0,baseLength);matrices.copy(outputBinary,appendOffset);
 const next=doc.nodes.length;doc.nodes.push({name,translation:[...offset],rotation:socketRotation.toArray(),scale:[1,1,1]});doc.nodes[parent[0]].children=[...(doc.nodes[parent[0]].children||[]),next];skin.joints.push(next);skin.inverseBindMatrices=doc.accessors.length;doc.accessors.push({bufferView:doc.bufferViews.length,componentType:5126,count:skin.joints.length,type:'MAT4'});doc.bufferViews.push({buffer:0,byteOffset:appendOffset,byteLength:matrices.length});doc.buffers[0].byteLength=outputBinary.length;
 const output=pack(doc,outputBinary);inspectCharacterGlb(output,{allowSkinMaterialExtensions:true});const verify=await readRestRig(output);check(verify.rest.bones.has(name),'socket was not loaded as native Bone');return output;
}
export function palmFrame(THREE,rest,side){
 check(['Left','Right'].includes(side),'unknown hand side');const get=name=>{const value=rest.bones.get(name);check(value,'missing palm calibration Bone '+name);return new THREE.Matrix4().fromArray(value.world);};
 const hand=get(side+'Hand'),inverse=hand.clone().invert(),point=name=>new THREE.Vector3().setFromMatrixPosition(get(name)).applyMatrix4(inverse);
 const middle=point(side+'HandMiddle1'),index=point(side+'HandIndex1'),pinky=point(side+'HandPinky1'),forward=middle.clone().normalize(),across=index.clone().sub(pinky);across.addScaledVector(forward,-across.dot(forward));check(middle.length()>1e-6&&across.length()>1e-6,'degenerate palm basis');across.normalize();const normal=new THREE.Vector3().crossVectors(across,forward).normalize(),basis=new THREE.Matrix4().makeBasis(across,forward,normal),position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();hand.decompose(position,rotation,scale);check(scale.x>0&&Math.abs(scale.x-scale.y)<1e-6&&Math.abs(scale.x-scale.z)<1e-6,'hand requires positive uniform world scale');
 const tip=rest.bones.has(side+'HandMiddle4')?point(side+'HandMiddle4'):middle;return {basis:basis.elements,scale:scale.x,lengthM:tip.length()*scale.x,widthM:index.distanceTo(pinky)*scale.x,tipBasis:rest.bones.has(side+'HandMiddle4')?'Middle4':'Middle1-fallback',status:'automatic-grip-candidate-not-anatomy-certified'};
}
/** Scale the assembly grip origin by hand proportions; preserve each rigid prop's metre geometry. */
export function mapGripAssembly(THREE,props,sourceFrame,targetFrame,masterId){
 check(props.length>0&&props.length<=4,'prop assembly budget');const master=props.find(prop=>prop.id===masterId);check(master,'missing assembly master');
 const sourceBasis=new THREE.Matrix4().fromArray(sourceFrame.basis),targetBasis=new THREE.Matrix4().fromArray(targetFrame.basis),sourceRotation=new THREE.Quaternion().setFromRotationMatrix(sourceBasis),targetRotation=new THREE.Quaternion().setFromRotationMatrix(targetBasis),delta=targetRotation.clone().multiply(sourceRotation.clone().invert());
 const origin=new THREE.Vector3(...master.offset).multiplyScalar(sourceFrame.scale).applyQuaternion(sourceRotation.clone().invert());origin.x*=targetFrame.widthM/sourceFrame.widthM;origin.y*=targetFrame.lengthM/sourceFrame.lengthM;origin.z*=targetFrame.widthM/sourceFrame.widthM;origin.applyQuaternion(targetRotation);
 return props.map(prop=>{check(tuple(prop.offset)&&tuple(prop.rot)&&tuple(prop.size)&&prop.size.every(v=>v>0),'invalid prop data');const p=new THREE.Vector3(...prop.offset).sub(new THREE.Vector3(...master.offset)).multiplyScalar(sourceFrame.scale).applyQuaternion(delta).add(origin).multiplyScalar(1/targetFrame.scale);const q=delta.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...prop.rot))),euler=new THREE.Euler().setFromQuaternion(q);return {...prop,offset:p.toArray(),rot:[euler.x,euler.y,euler.z],size:prop.size.map(v=>v*sourceFrame.scale/targetFrame.scale)};});
}
export async function calibrateGrip(sourceSkin,targetSkin,sourceProps){
 const [source,target]=await Promise.all([readRestRig(sourceSkin),readRestRig(targetSkin)]),T=target.api.THREE,frames={},props=[];
 for(const side of ['Left','Right']){const s=palmFrame(T,source.rest,side),t=palmFrame(T,target.rest,side);frames[side]={source:s,target:t};props.push(...mapGripAssembly(T,sourceProps.filter(prop=>prop.bone===side+'Hand'),s,t,side==='Left'?'matchbox':'matchstick'));}
 const names=new Set(props.map(prop=>prop.id));check(['matchbox','striker-strip','matchstick','match-head'].every(name=>names.has(name)),'four source prop parts required');return {props,frames};
}
export function makeSocketRecipe(THREE,{id,baseId,skinId,fps,durationS,props,frames,annotations}){
 const head=props.find(p=>p.id==='match-head'),strip=props.find(p=>p.id==='striker-strip');check(head&&strip,'missing contact props');
 // Socket is the physical +X leading tip of the match head, not a fixed wrist/world point.
 const socketOffset=new THREE.Vector3(head.size[0]/2,0,0).applyEuler(new THREE.Euler(...head.rot)).add(new THREE.Vector3(...head.offset)).toArray();
 const scale=frames.Left.target.scale,sizeM=strip.size.map(v=>v*scale),stripQ=new THREE.Quaternion().setFromEuler(new THREE.Euler(...strip.rot));
 const offset=(clearance,slide)=>new THREE.Vector3(-sizeM[0]/2-clearance,0,slide).multiplyScalar(1/scale).applyQuaternion(stripQ).add(new THREE.Vector3(...strip.offset)).toArray();
 const slide=Math.min(sizeM[2]*.32,.012),approach=.015;
 const trajectory=[[0,approach,-slide],[durationS*.2,0,-slide],[durationS*.7,0,slide],[durationS,approach,slide]].map(([at,c,s])=>({at,position:offset(c,s)}));
 const recipe={version:1,id,base:baseId,skin:skinId,fps,durationS,anchors:[{id:'BoxSideContactSocket',kind:'point',attach:{parentId:'actor',bone:'LeftHand',offset:trajectory[0].position,rot:[0,0,0]},trajectory}],ik:{chains:[{kind:'two-bone',root:'RightUpperArm',mid:'RightLowerArm',end:MATCH_HEAD_SOCKET,target:{entity:'BoxSideContactSocket',offset:[0,0,0]},weight:1}]},params:{},flags:{},cues:[],annotations};
 return {recipe,socketOffset,contact:{frame:'striker-strip-local-metres',face:'-X',approachM:approach,slideHalfLengthM:slide},limitations:['Automatic grip uses rest palm proportions, not certified finger grasp.','Position-only native IK does not enforce match-head orientation or anatomical limits.','No collision, skin penetration, finger anatomy or prop-contact surface certification.']};
}
export async function solveSocketCandidate({skinBytes,sourceSkinBytes,sourceProps,baseBytes,baseDescriptor,baseId,skinId,id,annotations}){
 const grip=await calibrateGrip(sourceSkinBytes,skinBytes,sourceProps),api=await composeEngine(),plan=makeSocketRecipe(api.THREE,{id,baseId,skinId,fps:baseDescriptor.fps,durationS:(baseDescriptor.frames-1)/baseDescriptor.fps,props:grip.props,frames:grip.frames,annotations}),derivedSkin=await addSocketBone(skinBytes,{offset:plan.socketOffset}),runtime=await sampleRecipe(plan.recipe,baseBytes,baseDescriptor,derivedSkin),bytes=writeComposedGlb(derivedSkin,{id,fps:plan.recipe.fps,frames:runtime.frames,samples:runtime.samples,THREE:api.THREE});
 const rows=runtime.worldPoses.map((pose,i)=>{const vector=name=>new api.THREE.Vector3(...pose[name].position),root=vector('RightUpperArm'),mid=vector('RightLowerArm'),end=vector(MATCH_HEAD_SOCKET),goal=new api.THREE.Vector3(...runtime.targets[i][0]),l1=root.distanceTo(mid),l2=mid.distanceTo(end),distance=root.distanceTo(goal);return {frame:i,at:i/plan.recipe.fps,endpointErrorM:end.distanceTo(goal),reachable:distance>=Math.abs(l1-l2)-1e-6&&distance<=l1+l2+1e-6,status:runtime.signatures[i].find(([key])=>key==='chain:0')?.[1]};});
 const maxEndpointErrorM=Math.max(...rows.map(row=>row.endpointErrorM)),report={version:1,status:maxEndpointErrorM<1e-5&&rows.every(row=>row.reachable&&row.status==='active')?'endpoint-aligned-draft':'endpoint-failed-draft',maxEndpointErrorM,unreachableFrames:rows.filter(row=>!row.reachable).length,inactiveFrames:rows.filter(row=>row.status!=='active').length,frames:rows.length,rows,contact:plan.contact,grip:grip.frames,limitations:plan.limitations};
 return {skinBytes:derivedSkin,clipBytes:bytes,props:grip.props,recipe:plan.recipe,report,runtime};
}
/** Independently replay the baked clip through the same humanoid bind used by the player.
 * This never runs IK again: residuals include native inter-frame interpolation. */
export async function checkSocketPlayback({skinBytes,clipBytes,recipe}){
 const api=await composeEngine(),T=api.THREE,source=await new api.GLTFLoader().parseAsync(api.snapshotSkeletalGlb(exact(clipBytes)),''),target=await new api.GLTFLoader().parseAsync(exact(writeComposedGlb(skinBytes)),'');
 const rest=api.captureSkeletonRest(target.scene,target.parser),clip=api.extractSkeletalClip(source.scene,source.animations,{skeleton:'apollo-humanoid-v1',fps:recipe.fps,frames:Math.round(recipe.durationS*recipe.fps)+1,loop:false},source.parser),bound=api.bindSkeletalClip(clip,recipe.id,target.scene,rest,'humanoid'),mixer=new T.AnimationMixer(target.scene),action=mixer.clipAction(bound),attachments=new api.SkeletalAttachments(),anchor=recipe.anchors[0],object=new T.Group(),bindings=[{id:anchor.id,config:structuredClone(anchor.attach),object}],models=new Map([['actor',target.scene]]),endpoint=target.scene.getObjectByName(MATCH_HEAD_SOCKET),rows=[];
 check(endpoint?.isBone,'playback socket is not a Bone');action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
 try{for(let sample=0;sample<=Math.round(recipe.durationS*recipe.fps*2);sample++){
  const time=sample/(recipe.fps*2),keys=anchor.trajectory;let index=0;while(index<keys.length-2&&keys[index+1].at<=time)index++;const a=keys[index],b=keys[index+1],u=Math.max(0,Math.min(1,(time-a.at)/(b.at-a.at)));bindings[0].config={...anchor.attach,offset:a.position.map((v,k)=>v+(b.position[k]-v)*u)};
  attachments.beginFrame();mixer.setTime(time);target.scene.updateWorldMatrix(true,true);const attached=attachments.sync(bindings,models);check(!attached.hidden.has(anchor.id),'native playback contact anchor hidden');const error=endpoint.getWorldPosition(new T.Vector3()).distanceTo(object.getWorldPosition(new T.Vector3()));rows.push({at:time,authorFrame:sample%2===0,errorM:error});
 }
 const maxAuthorFrameErrorM=Math.max(...rows.filter(row=>row.authorFrame).map(row=>row.errorM)),maxInterFrameErrorM=Math.max(...rows.filter(row=>!row.authorFrame).map(row=>row.errorM));return {method:'native-humanoid-bind-plus-Attach3D-no-IK-reapplication',samples:rows.length,sampleRateHz:recipe.fps*2,maxAuthorFrameErrorM,maxInterFrameErrorM,maxEndpointErrorM:Math.max(maxAuthorFrameErrorM,maxInterFrameErrorM),rows};
 }finally{attachments.clear();mixer.stopAllAction();mixer.uncacheRoot(target.scene);dispose(source.scene);dispose(target.scene);}
}
