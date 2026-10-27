// M6 offline closed-data composition. No Blender, network, or custom solver.
import { readFileSync, writeFileSync, mkdirSync, existsSync, realpathSync, statSync, linkSync, renameSync, rmSync } from 'node:fs';
import { resolve, dirname, join, relative, isAbsolute } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { libraryPath } from './motion-library.mjs';
import { check, sha256, validateCatalog, measureMotion, measureSkin } from './lib/motion-catalog.mjs';
import { composeEngine } from './lib/motion-compose-engine.mjs';
import { canonical, validateRecipe } from './lib/motion-compose-recipe.mjs';
import { sampleRecipe } from './lib/motion-compose-runtime.mjs';
import { writeComposedGlb } from './lib/motion-compose-glb.mjs';
export { canonical, validateRecipe, sampleRecipe, composeEngine };
const log=(kind,message)=>console.error(`[motion-compose] ${kind}: ${message}`);
function physical(path){path=resolve(path);let existing=path;while(!existsSync(existing))existing=dirname(existing);return resolve(realpathSync(existing),relative(existing,path));}
function confined(lib,path){const result=physical(path),rel=relative(lib,result);check(!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('../'),'compose output/input escapes library');check(physical(lib)===lib,'compose library root changed');return result;}
function asset(lib,row){const path=confined(lib,join(lib,row.file));check(statSync(path).isFile(),'asset is not regular file');const bytes=readFileSync(path);check(sha256(bytes)===row.sha256,`asset SHA mismatch: ${row.id}`);return bytes;}
function exactArray(bytes){return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);}
/** Independent reload of exported data; every sampled joint is checked before any publication. */
export async function verifyBake(bytes, runtime, fps) {
  const api=runtime.api,{THREE}=api,loaded=await new api.GLTFLoader().parseAsync(api.snapshotSkeletalGlb(exactArray(bytes)),'');
  api.extractSkeletalClip(loaded.scene,loaded.animations,{skeleton:'apollo-humanoid-v1',fps,frames:runtime.frames,loop:false},loaded.parser);
  const mixer=new THREE.AnimationMixer(loaded.scene),action=mixer.clipAction(loaded.animations[0]);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();let maxPositionError=0,maxRotationError=0;
  try{for(let i=0;i<runtime.frames;i++){mixer.setTime(i/fps);loaded.scene.updateMatrixWorld(true,true);for(const [name,expected] of Object.entries(runtime.worldPoses[i])){const bone=loaded.scene.getObjectByName(name),p=bone.getWorldPosition(new THREE.Vector3()),q=bone.getWorldQuaternion(new THREE.Quaternion()),difference=new THREE.Quaternion(...expected.rotation).invert().multiply(q);maxPositionError=Math.max(maxPositionError,p.distanceTo(new THREE.Vector3(...expected.position)));maxRotationError=Math.max(maxRotationError,2*Math.atan2(Math.hypot(difference.x,difference.y,difference.z),Math.abs(difference.w)));}}check(maxPositionError<1e-5&&maxRotationError<1e-5,`baked/runtime mismatch: ${maxPositionError}m ${maxRotationError}rad`);return {maxPositionError,maxRotationError,frames:runtime.frames};}
  finally{mixer.stopAllAction();mixer.uncacheRoot(loaded.scene);loaded.scene.traverse(o=>{o.geometry?.dispose();o.skeleton?.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m?.dispose();});}
}
export async function composeMotion({recipe,lib=join(homedir(),'ApolloAssets/motion-lib'),reviewedPreviewSha}={}) {
  const api=await composeEngine();await validateRecipe(recipe,api);const recipeSha=sha256(canonical(recipe));
  if(reviewedPreviewSha!==undefined)check(reviewedPreviewSha===recipeSha,'reviewed preview SHA does not match recipe');
  lib=libraryPath(lib);check(existsSync(join(lib,'catalog.json')),'compose requires existing catalog');
  const lock=confined(lib,join(lib,'.ingest.lock'));writeFileSync(lock,JSON.stringify({pid:process.pid,operation:'compose'})+'\n',{flag:'wx'});
  try{
    const catalog=validateCatalog(JSON.parse(readFileSync(confined(lib,join(lib,'catalog.json')),'utf8'))),base=catalog.clips.find(row=>row.id===recipe.base),skin=catalog.skins.find(row=>row.id===recipe.skin);
    check(base&&skin,'base motion and target skin must be in catalog');check(!catalog.clips.some(row=>row.id===recipe.id),'derived clip id already exists');
    const destination=confined(lib,join(lib,'clips',recipe.id+'.glb'));check(!existsSync(destination),'derived output already exists');
    const baseBytes=asset(lib,base),skinBytes=asset(lib,skin);await measureMotion(baseBytes,base.id,base.fps);await measureSkin(skinBytes);
    log('decision',`native compose ${recipe.id} from ${base.id} on ${skin.id} recipe=${recipeSha}`);
    const runtime=await sampleRecipe(recipe,baseBytes,{fps:base.fps,frames:base.frames,loop:base.loop},skinBytes),bytes=writeComposedGlb(skinBytes,{id:recipe.id,fps:recipe.fps,frames:runtime.frames,samples:runtime.samples,THREE:api.THREE});
    const verification=await verifyBake(bytes,runtime,recipe.fps),measured=await measureMotion(bytes,recipe.id,recipe.fps);
    const work=confined(lib,join(lib,'.compose',recipe.id,recipeSha));mkdirSync(work,{recursive:true});
    const candidate=confined(lib,join(work,'candidate.glb')),evidence=confined(lib,join(work,'evidence.json'));
    const snapshot={version:1,recipeSha,recipe,baseSha256:base.sha256,skinSha256:skin.sha256,candidateSha256:sha256(bytes),verification,scope:'sampled frames only; human motion/contact plausibility requires preview'};
    if(existsSync(candidate))check(sha256(readFileSync(candidate))===sha256(bytes),'existing compose candidate differs');else writeFileSync(candidate,bytes,{flag:'wx'});
    if(existsSync(evidence))check(readFileSync(evidence,'utf8')===canonical(snapshot)+'\n','existing compose evidence differs');else writeFileSync(evidence,canonical(snapshot)+'\n',{flag:'wx'});
    if(!reviewedPreviewSha){log('reject','preview is unreviewed; candidate only, no catalog publication');return {ok:true,published:false,recipeSha,candidate,evidence,verification};}
    const entry={id:recipe.id,file:`clips/${recipe.id}.glb`,sha256:sha256(bytes),source:{...base.source,mixamoName:base.source.mixamoName+' [composed]'},...measured,...recipe.annotations,derivedFrom:base.id,status:'draft',provenance:{operation:'compose',recipeSha256:recipeSha,baseId:base.id,baseSha256:base.sha256,skinId:skin.id,skinSha256:skin.sha256,reviewedPreviewSha,validationCarrier:true,evidenceFile:relative(lib,evidence)}};
    const next={...catalog,clips:[...catalog.clips,entry].sort((a,b)=>a.id.localeCompare(b.id))};validateCatalog(next);
    mkdirSync(dirname(destination),{recursive:true});check(confined(lib,destination)===destination,'publication destination changed');check(sha256(readFileSync(confined(lib,candidate)))===entry.sha256,'candidate changed before publication');
    const temp=confined(lib,join(lib,`.compose-catalog-${recipe.id}.tmp`));writeFileSync(temp,JSON.stringify(next,null,2)+'\n',{flag:'wx'});
    let published=false;try{linkSync(candidate,destination);published=true;check(confined(lib,destination)===destination,'publication path changed');check(confined(lib,join(lib,'catalog.json'))===join(lib,'catalog.json'),'catalog alias is forbidden');renameSync(temp,join(lib,'catalog.json'));}catch(error){if(published&&confined(lib,destination)===destination)rmSync(destination);throw error;}finally{rmSync(temp,{force:true});}
    log('commit',`draft ${entry.id} derivedFrom=${entry.derivedFrom}`);return {ok:true,published:true,recipeSha,candidate,evidence,entry,verification};
  }catch(error){log('reject',error.message);throw error;}finally{if(physical(lib)===lib)rmSync(lock,{force:true});}
}
export async function main(argv=process.argv.slice(2)) {
  try{const opts={};for(let i=0;i<argv.length;i++){const key=argv[i];check(['--recipe','--lib','--reviewed-preview-sha'].includes(key)&&i+1<argv.length,`unknown/missing option ${key}`);check(!Object.hasOwn(opts,key),'duplicate option');opts[key]=argv[++i];}check(opts['--recipe'],'--recipe is required');const raw=readFileSync(opts['--recipe']);check(raw.length<=1024*1024,'recipe byte budget');const result=await composeMotion({recipe:JSON.parse(raw),lib:opts['--lib'],reviewedPreviewSha:opts['--reviewed-preview-sha']});console.log(JSON.stringify(result));return 0;}catch(error){log('reject',error.message);return 1;}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))process.exitCode=await main();
