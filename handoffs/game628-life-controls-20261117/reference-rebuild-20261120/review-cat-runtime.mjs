import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
const root=new URL('../public/',import.meta.url),d=JSON.parse(readFileSync(new URL('scenes/reference-street.json',root))),report=[];
for(const [id,e]of Object.entries(d.manifest.entities).filter(([id])=>id.startsWith('cat-'))){
 const a=d.assets.find(a=>a.key===e.Model3D.modelKey),b=readFileSync(new URL(a.src.slice(1),root)),g=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
 const mixer=new THREE.AnimationMixer(g.scene),clip=g.animations.find(a=>a.name===e.AnimState3D.clip);mixer.clipAction(clip).play();g.scene.position.set(e.Transform3D.x,e.Transform3D.y,e.Transform3D.z);
 const paws=[],moving=[];g.scene.traverse(o=>{if(o.isMesh)(o.name.includes('mesh_paw')?paws:moving).push(o)});if(paws.length!==2)throw Error(id+' paw anchor not hit');
 const v=new THREE.Vector3();let low=Infinity,high=-Infinity;const reference=[];let maxDisplacement=0;
 for(let frame=0;frame<=Math.ceil(clip.duration*240);frame++){mixer.setTime(Math.min(frame/240,clip.duration-1e-8));g.scene.updateMatrixWorld(true);let min=Infinity,i=0;
  for(const p of paws){const attr=p.geometry.attributes.position;for(let j=0;j<attr.count;j++,i++){v.fromBufferAttribute(attr,j).applyMatrix4(p.matrixWorld);min=Math.min(min,v.y);if(frame===0)reference.push(v.clone());else maxDisplacement=Math.max(maxDisplacement,v.distanceTo(reference[i]));}}
  low=Math.min(low,min);high=Math.max(high,min);
 }
 if(maxDisplacement>1e-6)throw Error(id+' paws drift '+maxDisplacement);report.push({id,clip:clip.name,sampleHz:240,pawMinY:[low,high],maxPawDisplacement:maxDisplacement,pawBottomPoints:reference.filter(v=>v.y<low+1e-6).map(v=>v.toArray())});
}
console.log(JSON.stringify({status:'pass',cats:report},null,2));
