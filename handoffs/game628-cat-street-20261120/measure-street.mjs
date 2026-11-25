import {readFileSync} from 'node:fs';
import {Box3, Raycaster, Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const src = readFileSync(new URL('site/art/reference-rebuild-20261120/scene/street-reference-v4.glb',import.meta.url));
const jsonSize = src.readUInt32LE(12);
const gltf = JSON.parse(src.subarray(20,20+jsonSize));
for (const mesh of gltf.meshes) for (const prim of mesh.primitives) delete prim.material;
const bin = src.subarray(28+jsonSize);
gltf.buffers[0].uri = 'data:application/octet-stream;base64,' + bin.toString('base64');
globalThis.ProgressEvent ??= class ProgressEvent {};
const {scene} = await new GLTFLoader().parseAsync(JSON.stringify(gltf),'');
scene.updateMatrixWorld(true);
const asNumbers = v => v.toArray().map(x=>Number(x.toFixed(4)));
if(process.argv.includes('--boxes')) scene.traverse(o=>{
  if(o.isMesh && o.name.includes('catcafe') && /(wood|interior|blackboard|cream)/.test(o.name)){
    const b=new Box3().setFromObject(o);
    console.log(o.name,asNumbers(b.min),asNumbers(b.max));
  }
});
for(const z of [.28,.35,.43,.52,.60,.68,.75,.84]) {
  const row=[z];
  for(const x of [3.72,3.90,4.05,4.20,4.35,4.50,4.65,4.80,4.95,5.10,5.25,5.40]){
    const ray=new Raycaster(new Vector3(x,3,z),new Vector3(0,-1,0));
    const hits = ray.intersectObject(scene).filter(h=>h.point.y<2.0);
    row.push(hits.slice(0,3).map(hit=>[+hit.point.y.toFixed(3),hit.object.name.replace('catcafe__','').replace('pavement__','')]));
  }
  console.log(JSON.stringify(row));
}
if (process.argv.includes('--visibility')) {
 const eye=new Vector3(0,3.2+23*Math.sin(.135),1.6+23*Math.cos(.135));
 for(const site of [[4.86,.615,-.10],[4.98,1.785,-.4],[5.07,1.785,-.25],[4.84,.065,.52],
 [5.25,1.195,-.12],[5.43,1.195,-.12],[5.56,1.195,-.12],
 [5.25,1.195,.00],[5.43,1.195,.00],[5.56,1.195,.00],
 [4.93,1.785,.02],[5.07,1.785,.02]]){
  const p=new Vector3(site[0]+.20,site[1]+.25,site[2]+.14);
  const ground=new Raycaster(new Vector3(site[0],site[1]+.03,site[2]),new Vector3(0,-1,0)).intersectObject(scene)[0];
  const delta=p.clone().sub(eye);
  const ray=new Raycaster(eye,delta.clone().normalize(),0,delta.length()-0.01);
  console.log('site',site,'ground',ground?.point.y,ground?.object.name,'block',ray.intersectObject(scene).slice(0,3).map(h=>[h.object.name,asNumbers(h.point)]));
 }
}
