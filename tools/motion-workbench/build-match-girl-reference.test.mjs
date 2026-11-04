import {describe,it,expect,vi,afterEach} from 'vitest';
import {mkdtemp,mkdir,readFile,writeFile,rm,symlink,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
// This suite checks story data and filesystem boundaries, not native M1 quality.
vi.mock('../../scripts/lib/motion-engine.mjs',()=>({
 motionEngine:async()=>({THREE,GLTFLoader:class{async parseAsync(){const scene=new THREE.Group();const b=new THREE.Bone();b.name='Hips';scene.add(b);return{scene,parser:{}};}},captureSkeletonRest:()=>({}),bindSkeletalClip:()=>new THREE.AnimationClip('bound',1,[])}),
 engineClip:async()=>({clip:{name:'fixture-exact'}}),
}));
vi.mock('../../scripts/lib/motion-compose-glb.mjs',()=>({writeComposedGlb:(_b,opts)=>Buffer.from(JSON.stringify({fixture:opts?.id??'carrier'})),unpackGlb:()=>({doc:{skins:[{joints:[0]}],nodes:[{name:'Hips'}]}})}));
import {buildMatchGirlReference,MATCH_GIRL_SHOTS} from './build-match-girl-reference.mjs';
const roots=[];const hash=b=>createHash('sha256').update(b).digest('hex');
async function temp(){const r=await mkdtemp(join(tmpdir(),'match-girl-reference-test-'));roots.push(r);return r;}
afterEach(async()=>{for(const r of roots.splice(0))await rm(r,{recursive:true,force:true});});
async function exists(p){try{await access(p);return true;}catch{return false;}}
async function fixture(){
 const r=await temp(),lib=join(r,'library'),review=join(r,'calibrated'),strike=join(r,'strike');
 for(const p of [lib,review,strike,join(strike,'review')])await mkdir(p);
 const saved=new Map();async function put(root,file,contents){const b=Buffer.from(contents);await writeFile(join(root,file),b);saved.set(join(root,file),b);return{file,sha256:hash(b)};}
 const model=await put(review,'claire.glb','claire-model'),idle=await put(review,'idle.glb','claire-idle'),walk=await put(review,'walk.glb','claire-walk');
 const gm=await put(review,'granny.glb','granny-model'),gi=await put(review,'granny-idle.glb','granny-idle');
 const row=(a,key,frames)=>({...a,key,kind:frames?'skeletal-animation':'model',...(frames?{frames,fps:30,loop:true}:{})});
 const motor={initial:{positionQ:{x:0,y:0,z:0}}};
 const profiles=[{id:'claire',assets:[row(model,'claire/model'),row(idle,'claire/idle',3),row(walk,'claire/walk',3)],manifest:{entities:{actor:{CharacterMotor3D:motor,RootMotion3D:{fixture:true}},camera:{Camera3D:{distance:4}}}}},{id:'sporty-granny',assets:[row(gm,'granny/model'),row(gi,'granny/idle',3)]}];
 const calibratedReview=join(review,'review.json');await writeFile(calibratedReview,JSON.stringify({profiles}));
 const clips=[];for(const id of ['sitting-idle-124240901','kneel-107830901'])clips.push({...await put(lib,id+'.glb',id),id,frames:3,fps:30,loop:true,descEn:'Source description fixture'});
 await writeFile(join(lib,'catalog.json'),JSON.stringify({clips}));
 const sc=await put(join(strike,'review'),'candidate.glb','rejected-strike');await writeFile(join(strike,'review/catalog.json'),JSON.stringify({clips:[row(sc,'strike',3)]}));
 await writeFile(join(strike,'validation.json'),JSON.stringify({status:'candidate-rejected-technical',props:[]}));
 for(const p of [calibratedReview,join(lib,'catalog.json'),join(strike,'review/catalog.json'),join(strike,'validation.json')])saved.set(p,await readFile(p));
 return{r,lib,calibratedReview,strike,out:join(r,'output'),saved};
}
describe('external match-girl blocking reference',()=>{
 it('keeps the ten ordered Andersen beats, 75 seconds and original tragic ending',()=>{
  expect(MATCH_GIRL_SHOTS.map(s=>s.id)).toEqual(['snow','corner','strike','stove','feast','tree','star','grandmother','ascent','dawn']);
  expect(MATCH_GIRL_SHOTS.reduce((n,s)=>n+s.seconds,0)).toBe(75);
  expect(MATCH_GIRL_SHOTS.find(s=>s.id==='feast').prompt).toContain('Goose, never duck');
  expect(MATCH_GIRL_SHOTS.at(-1).narration).toContain('已经离世');
  expect(MATCH_GIRL_SHOTS.at(-1).prompt).toContain('No rescue ending');
 });
 it('writes draft data only, checks asset hashes and preserves every synthetic input byte',async()=>{
  const f=await fixture(),result=await buildMatchGirlReference(f);expect(result).toMatchObject({chapters:10,totalSeconds:75,status:'story-blocking-draft'});
  const review=JSON.parse(await readFile(join(f.out,'review.json'))),p=JSON.parse(await readFile(join(f.out,'provenance.json'))),jobs=JSON.parse(await readFile(join(f.out,'seedance-jobs.json')));
  expect(review.profiles).toHaveLength(10);expect(p.strikeTechnicalStatus).toBe('candidate-rejected-technical');
  expect(review.profiles.find(x=>x.id==='strike').description).toContain('碰撞硬门失败');
  expect(p.limitations).toContain('Cold shivering and transitions are not solved');expect(jobs.submissionStatus).toBe('not-submitted');expect(jobs.jobs).toHaveLength(8);
  expect(jobs.jobs.every(j=>j.output===null&&j.status==='awaiting-generation')).toBe(true);
  for(const a of p.assets)expect(hash(await readFile(join(f.out,a.file)))).toBe(a.sha256);
  for(const [path,b] of f.saved)expect(await readFile(path)).toEqual(b);
 });
 it('refuses rerun and preserves an existing user directory',async()=>{
  const f=await fixture();await buildMatchGirlReference(f);const before=await readFile(join(f.out,'review.json'));
  await expect(buildMatchGirlReference(f)).rejects.toThrow();expect(await readFile(join(f.out,'review.json'))).toEqual(before);
  const other=join(f.r,'user');await mkdir(other);await writeFile(join(other,'user.txt'),'untouched');await expect(buildMatchGirlReference({...f,out:other})).rejects.toThrow();expect(await readFile(join(other,'user.txt'),'utf8')).toBe('untouched');
 });
 for(const marker of ['directory','file'])it('refuses output below a Git '+marker+' marker before writing',async()=>{
  const f=await fixture(),repo=join(f.r,'repo');await mkdir(repo);if(marker==='directory')await mkdir(join(repo,'.git'));else await writeFile(join(repo,'.git'),'gitdir: elsewhere');
  const out=join(repo,'new');await expect(buildMatchGirlReference({...f,out})).rejects.toThrow(/outside every repository/);expect(await exists(out)).toBe(false);
 });
 it('does not evade repository restriction via a symlink parent',async()=>{
  const f=await fixture(),repo=join(f.r,'repo'),alias=join(f.r,'alias');await mkdir(repo);await mkdir(join(repo,'.git'));await symlink(repo,alias);
  await expect(buildMatchGirlReference({...f,out:join(alias,'new')})).rejects.toThrow(/outside every repository/);expect(await exists(join(repo,'new'))).toBe(false);
 });
 for(const which of ['lib','strike','calibrated'])it('refuses creating output inside read-only '+which+' inputs',async()=>{
  const f=await fixture(),parent=which==='calibrated'?join(f.r,'calibrated'):f[which],out=join(parent,'new-output');
  await expect(buildMatchGirlReference({...f,out})).rejects.toThrow();expect(await exists(out)).toBe(false);
 });
 it('checks canonical source aliases and dot-prefixed children without confusing siblings',async()=>{
  const f=await fixture(),alias=join(f.r,'library-alias');await symlink(f.lib,alias);
  for(const out of [join(alias,'new-output'),join(f.lib,'..result')]){
   await expect(buildMatchGirlReference({...f,out})).rejects.toThrow();expect(await exists(out)).toBe(false);
  }
  const out=join(f.r,'library-sibling');await expect(buildMatchGirlReference({...f,out})).resolves.toMatchObject({chapters:10});
 });
 it('refuses source SHA corruption without publishing a review or provenance',async()=>{
  const f=await fixture();await writeFile(join(f.r,'calibrated/claire.glb'),'corrupted');
  await expect(buildMatchGirlReference(f)).rejects.toThrow(/source SHA mismatch/);expect(await exists(join(f.out,'review.json'))).toBe(false);expect(await exists(join(f.out,'provenance.json'))).toBe(false);
 });
});
