import { check } from './motion-catalog.mjs';
import { composeEngine } from './motion-compose-engine.mjs';
import { validateRecipe } from './motion-compose-recipe.mjs';
import { writeComposedGlb,unpackGlb } from './motion-compose-glb.mjs';
/** CPU playback adapter: native mixer -> native E3 refresh -> native E4 -> E3 refresh.
 * Weight envelopes belong exclusively to InverseKinematics; this module never solves IK. */
export async function sampleRecipe(recipe,baseBytes,baseDescriptor,skinBytes) {
  const api=await composeEngine(),{THREE}=api;await validateRecipe(recipe,api);
  const source=await new api.GLTFLoader().parseAsync(api.snapshotSkeletalGlb(baseBytes.buffer.slice(baseBytes.byteOffset,baseBytes.byteOffset+baseBytes.byteLength)),'');
  const clip=api.extractSkeletalClip(source.scene,source.animations,{skeleton:'apollo-humanoid-v1',...baseDescriptor},source.parser);
  check(recipe.durationS<=clip.clip.duration+1e-6,'recipe duration exceeds base motion (no implicit looping)');
  const carrierBytes=writeComposedGlb(skinBytes);
  const target=await new api.GLTFLoader().parseAsync(carrierBytes.buffer.slice(carrierBytes.byteOffset,carrierBytes.byteOffset+carrierBytes.byteLength),'');
  // Buffer slices can have a pooled backing store; use an exact snapshot.
  const rest=api.captureSkeletonRest(target.scene,target.parser);check(!rest.error,rest.error||'invalid target rest');
  const bones=new Map();target.scene.traverse(o=>{if(o.isBone){check(!bones.has(o.name),'ambiguous bone');bones.set(o.name,o);}});
  const requireBone=name=>check(bones.has(name),`unknown target bone ${name}`);
  for(const anchor of recipe.anchors)if(anchor.attach)requireBone(anchor.attach.bone);
  const constraints=[...recipe.ik.chains,...(recipe.ik.lookAt?[recipe.ik.lookAt]:[])];
  for(const c of constraints){for(const field of ['root','mid','end','bone'])if(c[field])requireBone(c[field]);if(c.target.bone){check(c.target.entity==='actor','bone target must name actor');requireBone(c.target.bone);}}
  const bound=api.bindSkeletalClip(clip,clip.clip.name,target.scene,rest,'humanoid'),mixer=new THREE.AnimationMixer(target.scene),action=mixer.clipAction(bound);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
  const ik=new api.InverseKinematics(),attachments=new api.SkeletalAttachments(),world=new api.World(),models=new Map([['actor',target.scene]]),drawables=new Map(),params=structuredClone(recipe.params),flags=structuredClone(recipe.flags),bindings=[];
  world.createEntity('actor');const graph={params:{}};
  for(const [name,v] of Object.entries(params))if(v&&typeof v==='object')graph.params[name]=`flag:${v.flag}`;
  for(const [name,active] of Object.entries(flags)){world.createEntity(`__composeFlag:${name}`);world.addComponent(`__composeFlag:${name}`,{type:'Flag',id:name,active});}
  for(const anchor of recipe.anchors){world.createEntity(anchor.id);const object=new THREE.Group();drawables.set(anchor.id,object);if(anchor.attach){bindings.push({id:anchor.id,config:structuredClone(anchor.attach),object});world.addComponent(anchor.id,{type:'Attach3D',...anchor.attach});}else{object.position.fromArray(anchor.position);object.rotation.set(...anchor.rot);}}
  let attachmentState={hidden:new Set(),poses:new Map()};const refresh=()=>{attachmentState=attachments.sync(bindings,models);};
  const resolve=api.createIKTargetResolver(world,models,drawables,new Map(),()=>attachmentState.hidden);
  const frames=Math.round(recipe.durationS*recipe.fps)+1,skin=unpackGlb(skinBytes).doc.skins[0];check(frames*skin.joints.length*10<=14000000,'bake exceeds decoded sample budget');
  const samples=[],worldPoses=[],signatures=[],anchors=[],targets=[],envelopes=[];let cueIndex=0,changed=false;const activeKeys=new Set();
  function trajectory(anchor,time){if(!anchor.trajectory)return;const keys=anchor.trajectory;let j=0;while(j<keys.length-2&&keys[j+1].at<=time)j++;const a=keys[j],b=keys[j+1],u=Math.max(0,Math.min(1,(time-a.at)/(b.at-a.at))),position=a.position.map((v,k)=>v+(b.position[k]-v)*u),initial=anchor.attach?.rot||anchor.rot,ra=a.rot||initial,rb=b.rot||initial,qa=new THREE.Quaternion().setFromEuler(new THREE.Euler(...ra)),qb=new THREE.Quaternion().setFromEuler(new THREE.Euler(...rb)),rot=new THREE.Euler().setFromQuaternion(qa.slerp(qb,u));if(anchor.attach){const binding=bindings.find(v=>v.id===anchor.id);binding.config={...binding.config,offset:position,rot:[rot.x,rot.y,rot.z]};world.addComponent(anchor.id,{type:'Attach3D',...binding.config});}else{const object=drawables.get(anchor.id);object.position.fromArray(position);object.rotation.copy(rot);}}
  try{
    for(let frame=0;frame<frames;frame++){
      const time=frame/recipe.fps;attachments.beginFrame();ik.beginFrame();mixer.setTime(time);target.scene.updateMatrixWorld(true,true);
      while(cueIndex<recipe.cues.length&&recipe.cues[cueIndex].at<=time+1e-9){const cue=recipe.cues[cueIndex++];if(cue.kind==='parameter')params[cue.name]=cue.value;else{flags[cue.name]=cue.value;world.addComponent(`__composeFlag:${cue.name}`,{type:'Flag',id:cue.name,active:cue.value});}}
      for(const anchor of recipe.anchors)trajectory(anchor,time);refresh();
      const projected=api.readAnimGraphParams(world,'actor',graph),resolved=Object.fromEntries(Object.entries(params).map(([name,v])=>[name,v&&typeof v==='object'?projected[name]:v]));
      const before=new Map([...bones].map(([name,bone])=>[name,bone.quaternion.clone()]));
      const result=ik.sync([{id:'actor',config:recipe.ik,model:target.scene,params:resolved}],{resolveTarget:resolve,refreshAttachments:refresh},frame===0?0:1/recipe.fps);
      const statuses=JSON.parse(result.signature)[0][2];for(const [key,status] of statuses){check(status==='zero'||status==='active',`native IK rejected ${key}: ${status}`);if(status==='active')activeKeys.add(key);}
      for(const [name,bone] of bones)if(Math.abs(before.get(name).dot(bone.quaternion))<1-1e-10)changed=true;
      refresh();target.scene.updateMatrixWorld(true,true);const sample={},pose={};for(const [name,bone] of bones){sample[name]={translation:bone.position.toArray(),rotation:bone.quaternion.toArray(),scale:bone.scale.toArray()};pose[name]={position:bone.getWorldPosition(new THREE.Vector3()).toArray(),rotation:bone.getWorldQuaternion(new THREE.Quaternion()).toArray()};}
      targets.push(constraints.map(c=>resolve(c.target)?.position.toArray()));samples.push(sample);worldPoses.push(pose);signatures.push(statuses);envelopes.push({...resolved});anchors.push(Object.fromEntries([...drawables].map(([id,object])=>[id,object.getWorldPosition(new THREE.Vector3()).toArray()])));
    }
    check(changed,'IK produced no pose change; refusing no-op composition');for(let i=0;i<constraints.length;i++)check(activeKeys.has(i<recipe.ik.chains.length?`chain:${i}`:'lookAt'),'constraint never became active');
    return {samples,worldPoses,signatures,anchors,targets,params:envelopes,frames,api};
  }finally{attachments.clear();ik.clear();mixer.stopAllAction();mixer.uncacheRoot(target.scene);for(const loaded of [source,target])loaded.scene.traverse(o=>{o.geometry?.dispose();o.skeleton?.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m?.dispose();});}
}
