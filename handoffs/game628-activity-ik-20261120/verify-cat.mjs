import {readFile, writeFile} from 'node:fs/promises';
import {AnimationMixer, LoopOnce, Quaternion, Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const dir = new URL('./', import.meta.url);
const source = await readFile(new URL('site/art/reference-rebuild-20261120/scene/cat-floor-ik-study.glb',dir));
const results = {};
for (const name of ['cat_paws_fk','cat_paws_ik']) {
  const gltf = await new GLTFLoader().parseAsync(source.buffer.slice(source.byteOffset,source.byteOffset+source.byteLength),'');
  const clip = gltf.animations.find(item=>item.name===name);
  const mixer = new AnimationMixer(gltf.scene);
  const action = mixer.clipAction(clip).setLoop(LoopOnce,1);
  action.clampWhenFinished = true;
  action.play();
  const paws = [];
  gltf.scene.traverse(object=>{if(object.isMesh && object.name.endsWith('pad-mesh')) paws.push(object);});
  if (paws.length !== 4) throw new Error('Four paws must be visible');
  const extremes = {minRootX:Infinity,maxRootX:-Infinity, maxTurnRad:0, worstPadPenetrationM:0, maxClipSeamM:0};
  const measure = new Vector3();
  const initial = [];
  for(let frame=0;frame<=864;frame++){
    mixer.setTime(frame/120);
    gltf.scene.updateMatrixWorld(true);
    const root = gltf.scene.children[0];
    extremes.minRootX = Math.min(extremes.minRootX,root.position.x);
    extremes.maxRootX = Math.max(extremes.maxRootX,root.position.x);
    extremes.maxTurnRad = Math.max(extremes.maxTurnRad,root.quaternion.angleTo(new Quaternion()));
    for (const [index,paw] of paws.entries()) {
      if (frame===0) initial[index]=paw.getWorldPosition(new Vector3());
      if (frame===864) extremes.maxClipSeamM=Math.max(extremes.maxClipSeamM,initial[index].distanceTo(paw.getWorldPosition(new Vector3())));
      const positions = paw.geometry.attributes.position;
      for(let i=0;i<positions.count;i++){
        measure.fromBufferAttribute(positions,i).applyMatrix4(paw.matrixWorld);
        const surface = measure.x>=0 ? .065 : 0;
        extremes.worstPadPenetrationM = Math.max(extremes.worstPadPenetrationM, surface-measure.y);
      }
    }
  }
  results[name]=extremes;
}
if(results.cat_paws_ik.worstPadPenetrationM>.004 || results.cat_paws_ik.maxClipSeamM>.004 || results.cat_paws_ik.maxTurnRad<.25) {
  throw new Error(JSON.stringify(results,null,2));
}
await writeFile(new URL('evidence/cat-native-replay.json',dir),JSON.stringify({sampleHz:120, results},null,2)+'\n');
console.log(results);
