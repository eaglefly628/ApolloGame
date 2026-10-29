// Local preview preparation: one model parse owns both geometry and its motion.
import {composeEngine} from '../../scripts/lib/motion-compose-engine.mjs';
import {writeComposedGlb,unpackGlb} from '../../scripts/lib/motion-compose-glb.mjs';
const check=(ok,message)=>{if(!ok)throw new Error('embedded preview: '+message);};
function pack(doc,binary){
 const text=Buffer.from(JSON.stringify(doc)),json=Buffer.alloc(Math.ceil(text.length/4)*4,32);text.copy(json);
 const bin=Buffer.alloc(Math.ceil(binary.length/4)*4);binary.copy(bin);const out=Buffer.alloc(28+json.length+bin.length);
 out.write('glTF');out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(json.length,12);out.writeUInt32LE(0x4e4f534a,16);json.copy(out,20);out.writeUInt32LE(bin.length,20+json.length);out.writeUInt32LE(0x004e4942,24+json.length);bin.copy(out,28+json.length);return out;
}
export function mergeEmbeddedMotion(skinBytes,motionBytes){
 const original=unpackGlb(skinBytes),motion=unpackGlb(motionBytes),doc=structuredClone(original.doc);
 for(const source of [doc,motion.doc])check(source.buffers?.length===1&&!source.buffers[0].uri,'single embedded buffer required');
 check(motion.doc.animations?.length===1,'one generated animation required');
 const prefix=original.binary.length,views=doc.bufferViews.length,accessors=doc.accessors.length,names=new Map();
 doc.nodes.forEach((node,i)=>{if(node.name){check(!names.has(node.name),'ambiguous target node name');names.set(node.name,i);}});
 for(const view of motion.doc.bufferViews)doc.bufferViews.push({...view,buffer:0,byteOffset:prefix+(view.byteOffset??0)});
 for(const accessor of motion.doc.accessors){check(!accessor.sparse,'sparse generated accessor unsupported');doc.accessors.push({...accessor,bufferView:views+accessor.bufferView});}
 const animation=structuredClone(motion.doc.animations[0]);
 for(const sampler of animation.samplers){sampler.input+=accessors;sampler.output+=accessors;}
 for(const channel of animation.channels){const source=motion.doc.nodes[channel.target.node],target=names.get(source.name);check(target!==undefined,'animation bone missing on target');channel.target.node=target;
  if(doc.nodes[target].matrix){delete doc.nodes[target].matrix;for(const key of ['translation','rotation','scale'])if(source[key])doc.nodes[target][key]=structuredClone(source[key]);}
 }
 doc.animations=[...(doc.animations??[]).filter(a=>a.name!==animation.name),animation];
 const binary=Buffer.concat([original.binary,motion.binary]);doc.buffers[0]={byteLength:binary.length};return pack(doc,binary);
}
/** Native M1 retarget is sampled into an internal clip, preserving the Skin mesh,
 * textures and original binary prefix. This is display preparation, not new IK,
 * contact certification, or approval of a derived animation.
 */
export async function buildEmbeddedPreview(skinBytes,motionBytes,descriptor){
 const api=await composeEngine(),T=api.THREE,exact=b=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
 const carrier=writeComposedGlb(skinBytes),target=await new api.GLTFLoader().parseAsync(exact(carrier),'');let source,mixer;
 try{
  source=await new api.GLTFLoader().parseAsync(api.snapshotSkeletalGlb(exact(motionBytes)),'');
  const rest=api.captureSkeletonRest(target.scene,target.parser);check(!rest.error,rest.error||'target rest failure');
  const clip=api.extractSkeletalClip(source.scene,source.animations,{skeleton:'apollo-humanoid-v1',fps:descriptor.fps,frames:descriptor.frames,loop:false},source.parser),bound=api.bindSkeletalClip(clip,descriptor.id,target.scene,rest,'humanoid');
  const bones=[];target.scene.traverse(o=>{if(o.isBone)bones.push(o);});check(descriptor.frames*bones.length*10<=14000000,'sample budget');
  mixer=new T.AnimationMixer(target.scene);const action=mixer.clipAction(bound);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
  const samples=[];for(let i=0;i<descriptor.frames;i++){mixer.setTime(i/descriptor.fps);target.scene.updateMatrixWorld(true,true);samples.push(Object.fromEntries(bones.map(b=>[b.name,{translation:b.position.toArray(),rotation:b.quaternion.toArray(),scale:b.scale.toArray()}])));}
  const generated=writeComposedGlb(skinBytes,{id:descriptor.id,fps:descriptor.fps,frames:descriptor.frames,samples,THREE:T});return mergeEmbeddedMotion(skinBytes,generated);
 }finally{mixer?.stopAllAction();mixer?.uncacheRoot(target.scene);for(const loaded of [source,target])loaded?.scene.traverse(o=>{o.geometry?.dispose();o.skeleton?.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m?.dispose();});}
}
