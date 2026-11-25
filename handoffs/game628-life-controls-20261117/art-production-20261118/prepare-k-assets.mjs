import {readFile,writeFile,copyFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import * as T from 'three';
const root=fileURLToPath(new URL('../',import.meta.url)),out=root+'public/art/neighborhood-v1/k-library/';
const ledger='/Users/junbaili/Documents/Codex/2026-11-09/task/k-takeover/closure-review-20261117/ASSETS-614.json';
const rows=JSON.parse(await readFile(ledger,'utf8')).assets;
const wanted={'housing-a':'building_A_withoutBase','housing-d':'building_D_withoutBase','housing-e':'building_E_withoutBase','housing-h':'building_H_withoutBase','bench':'bench','chair':'chair.gltf','stool':'stool.gltf','shelf':'shelf_small.gltf','fruit-crate':'crate_open','market-crate':'crate_long_A','bread-tray':'bread_display','potted-bush':'bush','cooking-pot':'cooking_pot','pavement-base':'base'};
await mkdir(out,{recursive:true});const selected=[];
function info(buffer){
 const n=buffer.readUInt32LE(12),d=JSON.parse(buffer.subarray(20,20+n).toString('utf8')),box=new T.Box3(),windowPanels=[];let triangles=0;
 function visit(index,parent){const node=d.nodes[index],local=node.matrix?new T.Matrix4().fromArray(node.matrix):new T.Matrix4().compose(new T.Vector3().fromArray(node.translation??[0,0,0]),new T.Quaternion().fromArray(node.rotation??[0,0,0,1]),new T.Vector3().fromArray(node.scale??[1,1,1])),world=parent.clone().multiply(local);
  if(node.mesh!==undefined)for(const p of d.meshes[node.mesh].primitives){const a=d.accessors[p.attributes.POSITION],part=new T.Box3();if(a.min&&a.max)for(const x of [a.min[0],a.max[0]])for(const y of [a.min[1],a.max[1]])for(const z of [a.min[2],a.max[2]])part.expandByPoint(new T.Vector3(x,y,z).applyMatrix4(world));box.union(part);if(d.materials?.[p.material]?.name?.includes('glazing')){const size=part.getSize(new T.Vector3());if(size.z<.03&&size.x>.05&&size.y>.05)windowPanels.push({center:part.getCenter(new T.Vector3()).toArray(),size:size.toArray()});}triangles+=(p.indices!==undefined?d.accessors[p.indices].count:a.count)/3;}
  for(const child of node.children??[])visit(child,world);
 }
 for(const node of d.scenes[d.scene??0].nodes)visit(node,new T.Matrix4());
 return {bounds:{min:box.min.toArray(),max:box.max.toArray(),size:box.getSize(new T.Vector3()).toArray()},triangles,nodes:d.nodes.length,materials:d.materials?.length??0,windowPanels};
}
for(const [key,name] of Object.entries(wanted)){
 const source=rows.find(r=>r.name===name);if(!source?.candidate?.exists)throw Error('Missing K source: '+name);
 const bytes=await readFile(source.candidate.path),sha=createHash('sha256').update(bytes).digest('hex');if(sha!==source.candidate.sha256)throw Error('K source changed: '+name);
 await copyFile(source.candidate.path,out+key+'.glb');
 selected.push({key:'k-'+key,localFile:'k-library/'+key+'.glb',asset:{kind:'model',key:'k-'+key,src:'/art/neighborhood-v1/k-library/'+key+'.glb'},name,sourceId:source.id,sourcePath:source.candidate.path,sha256:sha,status:'copied-technical-draft-for-scene-review',sourceState:source.state,userReview:source.user_review,sourceReports:source.reports,sourceLimitations:source.limitations,...info(bytes)});
}
await writeFile(root+'art-production-20261118/k-sources.json',JSON.stringify({ledger,policy:'Read-only source copies; original K files, review state and ledgers unchanged.',assets:selected},null,2));
console.info('[K-copy:commit]',selected.map(a=>({key:a.key,size:a.bounds.size.map(x=>+x.toFixed(3)),triangles:a.triangles})));
