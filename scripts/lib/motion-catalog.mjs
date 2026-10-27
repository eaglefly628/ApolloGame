import { createHash } from 'node:crypto';
import { inspectCharacterGlb } from './character-glb.mjs';
import { engineClip, motionEngine } from './motion-engine.mjs';
export const CATEGORIES = Object.freeze(['idle','locomotion','gesture','emotion','interaction','combat','reaction','pose']);
export const EMOTIONS = Object.freeze(['neutral','happy','sad','tender','afraid','angry','surprised','tired','cold']);
export const CONTACTS = Object.freeze(['left-hand','right-hand','both-hands','feet','seat','ground','partner']);
export const ROOT_MOTIONS = Object.freeze(['none','forward','turn','vertical']);
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export function check(condition, message) { if (!condition) throw new Error(message); }
export function motionId(id) { check(typeof id==='string' && /^[a-z0-9][a-z0-9-]{0,119}$/.test(id), 'invalid stable id'); return id; }
export function standardBoneName(name) {
  const bare = name.split(':').at(-1).replace(/^mixamorig\d*_?/, '');
  const table = { Spine2:'Chest' };
  for (const side of ['Left','Right']) for (const [a,b] of [['Arm','UpperArm'],['ForeArm','LowerArm'],['UpLeg','UpperLeg'],['Leg','LowerLeg']]) table[side+a]=side+b;
  return table[bare] || bare;
}
export function validateAnnotations(row) {
  check(row && typeof row==='object' && !Array.isArray(row), 'annotations required');
  check(CATEGORIES.includes(row.category), 'unknown category');
  for (const [field, vocab] of [['emotion',EMOTIONS],['contacts',CONTACTS]]) check(Array.isArray(row[field]) && row[field].every(x=>vocab.includes(x)) && new Set(row[field]).size===row[field].length && (field!=='emotion'||row[field].length>0), `invalid ${field}`);
  check([1,2,3].includes(row.intensity), 'intensity must be 1..3');
  for (const field of ['descZh','descEn']) check(typeof row[field]==='string' && row[field].trim().length>0 && row[field].length<=2000, `missing ${field}`);
  check(Array.isArray(row.tags)&&row.tags.length<=64&&row.tags.every(x=>typeof x==='string'&&x.trim()&&x.length<=80)&&new Set(row.tags).size===row.tags.length,'invalid tags');
  return Object.fromEntries(['category','emotion','intensity','contacts','descZh','descEn','tags'].map(k=>[k,row[k]]));
}
export function validateCatalog(catalog) {
  check(catalog?.version===1 && Array.isArray(catalog.clips) && Array.isArray(catalog.skins), 'catalog requires version=1, clips and skins arrays');
  for (const [kind, rows] of [['clips',catalog.clips],['skins',catalog.skins]]) {
    const ids = new Set();
    for (const row of rows) {
      motionId(row.id); check(!ids.has(row.id), `duplicate ${kind} id ${row.id}`); ids.add(row.id);
      check(row.file===`${kind}/${row.id}.glb`,'noncanonical file path');
      check(/^[a-f0-9]{64}$/.test(row.sha256),'invalid SHA');
      check(['draft','confirmed'].includes(row.status),'invalid status');
      check(row.source && typeof row.source.kind==='string' && /^[a-f0-9]{64}$/.test(row.source.fbxSha256), 'missing source provenance');
      for(const field of ['searchTerm','mixamoName'])check(typeof row.source[field]==='string'&&row.source[field].trim().length>0&&row.source[field].length<=2000,`missing source.${field}`);
      check(row.source.kind==='mixamo'||typeof row.source.license==='string'&&row.source.license.trim(),'source license missing');
      if(kind==='clips') {
        validateAnnotations(row); check(ROOT_MOTIONS.includes(row.rootMotion),'invalid rootMotion');
        check(Number.isInteger(row.fps)&&row.fps>=1&&row.fps<=120&&Number.isInteger(row.frames)&&row.frames>=2&&row.frames<=36001,'invalid fps/frames');
        check(Number.isFinite(row.durationS)&&Math.abs(row.durationS-(row.frames-1)/row.fps)<2e-5,'invalid durationS');
        check(typeof row.loop==='boolean'&&typeof row.inPlace==='boolean','missing loop/inPlace');
        check(row.derivedFrom===null||typeof row.derivedFrom==='string','missing derivedFrom');
      } else check(Number.isFinite(row.hipHeight)&&row.hipHeight>0&&row.pose==='T-pose','invalid skin rest pose');
    }
  }
  return catalog;
}
export async function measureMotion(bytes, id, fps) {
  const summary=inspectCharacterGlb(bytes); check(!summary.mock,'mock is not an ingested real asset');
  const document=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
  check(summary.vertices===3&&summary.triangles===1&&document.nodes.filter(n=>n.mesh!==undefined).length===1&&document.nodes.some(n=>n.mesh!==undefined&&n.name==='MotionValidationCarrier'&&n.extras?.motionValidationCarrier===true),'motion must contain only the marked synthetic validation carrier');
  check(summary.animations.length===1&&summary.animations[0].name===id,'single named clip required');
  const frames=Math.round(summary.animations[0].duration*fps)+1;
  inspectCharacterGlb(bytes,{clipName:id,fps,frames});
  const loaded=await engineClip(bytes,{fps,frames,loop:false});
  const { THREE }=loaded.api;
  const root=loaded.rest.bones.get('Hips'); const hip=new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().fromArray(root.world));
  check(hip.y>0,'hip height must be positive');
  const mixer=new THREE.AnimationMixer(loaded.scene); const action=mixer.clipAction(loaded.clip); action.setLoop(THREE.LoopOnce,1); action.clampWhenFinished=true; action.play();
  const points=[]; let firstPose,lastPose; const quats=[];
  for(let frame=0;frame<frames;frame++) {
    mixer.setTime(frame/fps); loaded.scene.updateMatrixWorld(true);
    const pose=[]; loaded.scene.traverse(n=>{if(n.isBone)pose.push([n.name,n.position.toArray(),n.quaternion.toArray(),n.scale.toArray()]);});
    if(frame===0)firstPose=pose; if(frame===frames-1)lastPose=pose;
    const bone=loaded.scene.getObjectByName('Hips'); points.push(bone.getWorldPosition(new THREE.Vector3())); quats.push(bone.getWorldQuaternion(new THREE.Quaternion()));
  }
  const origin=points[0]; const horizontal=Math.max(...points.map(p=>Math.hypot(p.x-origin.x,p.z-origin.z)));
  const vertical=Math.max(...points.map(p=>Math.abs(p.y-origin.y)));
  const yaw=quats.map(q=>{const forward=new THREE.Vector3(0,0,1).applyQuaternion(q);return Math.atan2(forward.x,forward.z);});
  const rotation=Math.max(...yaw.map(angle=>Math.abs(Math.atan2(Math.sin(angle-yaw[0]),Math.cos(angle-yaw[0])))));
  const threshold=Math.max(0.01,hip.y*0.02);
  // A breathing/stepping sway can travel far and return to its origin. Root
  // translation uses endpoints; jumping has a separate excursion budget.
  // Turning uses heading excursion so a complete spin remains a turn.
  const netHorizontal=Math.hypot(points.at(-1).x-origin.x,points.at(-1).z-origin.z);
  const netTurn=Math.abs(Math.atan2(Math.sin(yaw.at(-1)-yaw[0]),Math.cos(yaw.at(-1)-yaw[0])));
  const verticalThreshold=Math.max(0.05,hip.y*0.1);
  const rootMotion=netHorizontal>threshold?'forward':vertical>verticalThreshold?'vertical':rotation>Math.PI/12?'turn':'none';
  const endByName=new Map(lastPose.map(p=>[p[0],p]));
  const loop=firstPose.every(([name,p,q,s])=>{const end=endByName.get(name);return new THREE.Vector3(...p).distanceTo(new THREE.Vector3(...end[1]))<=threshold&&new THREE.Quaternion(...q).angleTo(new THREE.Quaternion(...end[2]))<=0.08&&s.every((value,i)=>Math.abs(value-end[3][i])<=0.02*Math.max(1,Math.abs(value),Math.abs(end[3][i])));});
  mixer.stopAllAction(); mixer.uncacheRoot(loaded.scene);
  loaded.scene.traverse(n=>{n.geometry?.dispose();for(const m of Array.isArray(n.material)?n.material:[n.material])m?.dispose();});
  return {fps,frames,durationS:(frames-1)/fps,loop,inPlace:netHorizontal<=threshold,rootMotion,measurements:{version:2,hipHeight:hip.y,netHorizontalM:netHorizontal,netTurnRadians:netTurn,verticalThresholdM:verticalThreshold,maxHorizontalM:horizontal,maxVerticalM:vertical,maxTurnRadians:rotation,positionThresholdM:threshold,loopAngleThresholdRadians:0.08,loopScaleRelativeThreshold:0.02}};
}
export async function measureSkin(bytes) {
  const summary=inspectCharacterGlb(bytes,{allowSkinMaterialExtensions:true});check(!summary.mock,'mock is not an ingested real skin');check(!summary.animations.length,'skin must contain no animation');
  const {THREE}=await motionEngine();
  // Only rest matrices are needed here. Embedded character textures are left
  // untouched and never fetched by a headless texture decoder.
  const length=bytes.readUInt32LE(12),doc=JSON.parse(bytes.toString('utf8',20,20+length));
  const scene=new THREE.Group(),nodes=doc.nodes.map(n=>{const o=doc.skins[0].joints.includes(doc.nodes.indexOf(n))?new THREE.Bone():new THREE.Object3D();o.name=n.name||'';if(n.matrix){o.matrix.fromArray(n.matrix);o.matrix.decompose(o.position,o.quaternion,o.scale);}else{o.position.fromArray(n.translation||[0,0,0]);o.quaternion.fromArray(n.rotation||[0,0,0,1]);o.scale.fromArray(n.scale||[1,1,1]);}return o;});
  doc.nodes.forEach((n,i)=>(n.children||[]).forEach(c=>nodes[i].add(nodes[c]))); for(const i of doc.scenes[doc.scene||0].nodes)scene.add(nodes[i]);scene.updateMatrixWorld(true);
  // A skin's declared rest must agree with its inverse binds. The full
  // character inspector above already checks references, types and byte ranges;
  // here we check bind identity in the same Three matrix convention. glTF
  // ignores the skinned mesh node transform (Specification §Skinned Mesh Primitives).
  const bindAccessor=doc.accessors[doc.skins[0].inverseBindMatrices],bindView=doc.bufferViews[bindAccessor.bufferView];
  const binaryOffset=28+length,bindStride=bindView.byteStride||64;
  for(const meshNode of doc.nodes.map((n,i)=>({...n,index:i})).filter(n=>n.skin===0)) {
    const expected=new THREE.Matrix4().elements;
    for(let jointIndex=0;jointIndex<doc.skins[0].joints.length;jointIndex++) {
      const offset=binaryOffset+(bindView.byteOffset||0)+(bindAccessor.byteOffset||0)+jointIndex*bindStride;
      const inverse=new THREE.Matrix4().fromArray(Array.from({length:16},(_,i)=>bytes.readFloatLE(offset+i*4)));
      const joint=nodes[doc.skins[0].joints[jointIndex]];
      const product=joint.matrixWorld.clone().multiply(inverse).elements;
      check(product.every((value,i)=>Math.abs(value-expected[i])<=1e-4*Math.max(1,Math.abs(value),Math.abs(expected[i]))),`skin inverse-bind differs from declared rest: ${joint.name}`);
    }
  }
  const positions=new Map(doc.skins[0].joints.map(i=>[doc.nodes[i].name,nodes[i].getWorldPosition(new THREE.Vector3())]));
  const hip=positions.get('Hips');check(hip.y>0,'hip height must be positive');
  for(const side of ['Left','Right']) {const arm=positions.get(side+'UpperArm'),hand=positions.get(side+'Hand'),elbow=positions.get(side+'LowerArm');check(Math.abs(hand.x-arm.x)>hip.y*0.25&&Math.abs(hand.y-arm.y)<hip.y*0.12&&Math.abs(hand.z-arm.z)<hip.y*0.12&&Math.abs(elbow.y-arm.y)<hip.y*0.12,`skin is not T-pose: ${side}`);}
  check(positions.get('Head').y>hip.y&&['Left','Right'].every(side=>positions.get(side+'Foot').y<hip.y),'skin must be Y-up');
  return {hipHeight:hip.y,pose:'T-pose',skeleton:'apollo-humanoid-v1'};
}
