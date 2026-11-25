import fs from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
globalThis.ProgressEvent??=class{};
export async function loadBody(bodyId){
 const base=new URL('../../game628-avatar-edit-20261120/public/',import.meta.url);
 const bytes=fs.readFileSync(new URL('art/face-studio-20261120/body-'+bodyId+'.gltf',base));
 const json=JSON.parse(bytes),bin=fs.readFileSync(new URL(json.buffers[0].uri.slice(1),base));
 const loader=new GLTFLoader(new T.LoadingManager().setURLModifier(u=>u===json.buffers[0].uri?'data:application/octet-stream;base64,'+bin.toString('base64'):u));
 const asset=await loader.parseAsync(bytes.toString(),'');asset.scene.updateMatrixWorld(true);return asset;
}
export function meshBonePoints(mesh,bone){
 const origin=bone.getWorldPosition(new T.Vector3()),q=bone.getWorldQuaternion(new T.Quaternion()).invert();
 return Array.from({length:mesh.geometry.attributes.position.count},(_,i)=>mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld).sub(origin).applyQuaternion(q));
}
if(process.argv[1]?.endsWith('inspect.mjs')){
 for(const bodyId of ['slim','full']){const a=await loadBody(bodyId);const out=[];a.scene.traverse(o=>{if(o.isMesh){const points=meshBonePoints(o,o.parent),box=new T.Box3().setFromPoints(points);out.push({name:o.name,parent:o.parent.name,min:box.min.toArray(),max:box.max.toArray(),vertices:points.length});}});console.log(JSON.stringify({bodyId,meshes:out}));}
}
