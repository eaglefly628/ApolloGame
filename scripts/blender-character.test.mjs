import { afterEach, describe, expect, it } from 'vitest';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { runBlenderJob, validateJob } from './blender-job.mjs';
import { makeMockCharacterGlb } from './fixtures/character-pipeline/mock-character.mjs';
import { inspectCharacterGlb } from './lib/character-glb.mjs';
import { encodePng } from './ai-gen.mjs';
import { makeMockMotionFbx } from './fixtures/character-pipeline/mock-fbx.mjs';

const roots=[];
const HERE=dirname(fileURLToPath(import.meta.url));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const rig=()=>({op:'rig-arp',inputs:['model.glb','markers.json','front.png','back.png','left.png','right.png'],params:{profile:'apollo-humanoid-v1',markersInput:1},outputs:['out/rig.glb']});
const retarget=()=>({op:'retarget-arp',inputs:['rig.glb','motion.fbx','provenance.json'],params:{profile:'apollo-humanoid-v1',clipId:'walk-forward',fps:30,frames:31,loop:true,inPlace:true,provenanceInput:2},outputs:['out/walk.glb']});
const save=(file,bytes)=>{mkdirSync(dirname(file),{recursive:true});writeFileSync(file,bytes);return file;};
const root=()=>{const dir=mkdtempSync(join(tmpdir(),'apollo-character-bridge-'));roots.push(dir);return dir;};
function minimalGlb() {
 const json=Buffer.from(JSON.stringify({asset:{version:'2.0'},scenes:[{nodes:[0]}],nodes:[{name:'input'}]}));
 const padded=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]),bytes=Buffer.alloc(20+padded.length);
 bytes.write('glTF');bytes.writeUInt32LE(2,4);bytes.writeUInt32LE(bytes.length,8);bytes.writeUInt32LE(padded.length,12);bytes.writeUInt32LE(0x4e4f534a,16);padded.copy(bytes,20);return bytes;
}
function failed(fn,pattern) {let error;try{fn();}catch(e){error=e;}expect(error).toBeInstanceOf(Error);if(pattern)expect(error.message).toMatch(pattern);return error;}
afterEach(()=>{for(const dir of roots.splice(0))rmSync(dir,{recursive:true,force:true});});

describe('T5 typed character bridge schema',()=>{
 it.each([rig,retarget])('accepts the typed contract without mutating data',make=>{const job=make(),before=structuredClone(job);expect(validateJob(job)).toBe(job);expect(job).toEqual(before);});
 it.each([
  ['unknown profile',j=>{j.params.profile='rigify';}],
  ['free Python',j=>{j.params.python='bpy.ops.object.delete()';}],
  ['extra path',j=>{j.inputs.push('extra.png');}],
  ['wrong model extension',j=>{j.inputs[0]='model.fbx';}],
  ['wrong output extension',j=>{j.outputs[0]='out.blend';}],
  ['missing profile',j=>{delete j.params.profile;}],
 ])('rejects %s for both typed operations',(_label,mutate)=>{for(const make of [rig,retarget]){const job=make();mutate(job);expect(()=>validateJob(job)).toThrow();}});
 it.each([
  ['wrong marker reference',j=>{j.params.markersInput=0;}],
  ['missing marker reference',j=>{delete j.params.markersInput;}],
  ['marker extension',j=>{j.inputs[1]='markers.txt';}],
  ['view extension',j=>{j.inputs[5]='right.jpg';}],
  ['missing view',j=>{j.inputs.pop();}],
 ])('rejects rig %s',(_label,mutate)=>{const job=rig();mutate(job);expect(()=>validateJob(job)).toThrow();});
 it.each([
  ['missing source',j=>{j.inputs.splice(1,1);}],
  ['wrong source extension',j=>{j.inputs[1]='motion.glb';}],
  ['wrong provenance extension',j=>{j.inputs[2]='provenance.txt';}],
  ['wrong provenance reference',j=>{j.params.provenanceInput=1;}],
  ['missing fps',j=>{delete j.params.fps;}],
  ['fractional fps',j=>{j.params.fps=29.97;}],
  ['zero fps',j=>{j.params.fps=0;}],
  ['fps above maximum',j=>{j.params.fps=121;}],
  ['one frame',j=>{j.params.frames=1;}],
  ['fractional frames',j=>{j.params.frames=2.5;}],
  ['too many frames',j=>{j.params.frames=36002;}],
  ['string loop',j=>{j.params.loop='true';}],
  ['missing inPlace',j=>{delete j.params.inPlace;}],
  ['unstable clip name',j=>{j.params.clipId='Walk Forward';}],
  ['code clip name',j=>{j.params.clipId='walk;python';}],
 ])('rejects retarget %s',(_label,mutate)=>{const job=retarget();mutate(job);expect(()=>validateJob(job)).toThrow();});
 it('keeps T7 legacy recognition data separate from typed contracts',()=>{for(const op of ['rig-arp','retarget-arp'])expect(validateJob({op,inputs:op==='rig-arp'?['model.glb']:['rig.glb','motion.glb'],params:{},outputs:['out.glb']})).toBeTruthy();});
});

// Execute the actual checked-in Python ARP rejection branch with only host bpy/
// mathutils imports stubbed. No Smart/Remap operators or license APIs are invented.
function unavailableBlender(dir,{installed=false}={}) {
 const executable=join(dir,'host-without-licensed-arp.cjs');
 const harness=`import importlib.util, runpy, sys, types
class Matrix:
 def __init__(self, value): pass
sys.modules['bpy']=types.ModuleType('bpy')
mathutils=types.ModuleType('mathutils');mathutils.Matrix=Matrix;mathutils.Vector=object;sys.modules['mathutils']=mathutils
addons=types.ModuleType('addon_utils');addons.modules=lambda: [];sys.modules['addon_utils']=addons
original=importlib.util.find_spec
importlib.util.find_spec=lambda name: (object() if ${installed?'True':'False'} else None) if name in ('auto_rig_pro','auto_rig_pro_master') else original(name)
sys.argv=[sys.argv[1], '--', sys.argv[2]]
runpy.run_path(sys.argv[0],run_name='__main__')`;
 save(executable,`#!${process.execPath}\nconst {spawnSync}=require('node:child_process');const args=process.argv.slice(2);const r=spawnSync('python3',['-c',${JSON.stringify(harness)},args[args.indexOf('--python')+1],args[args.indexOf('--')+1]],{encoding:'utf8'});process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');process.exit(r.status??1);\n`);chmodSync(executable,0o755);return executable;
}
describe('T5 honest real execution rejection',()=>{
 it.each([false,true])('rejects installed=%s without result or publishing a stale target',installed=>{
  const dir=root(),job={op:'rig-arp',inputs:['model.glb'],params:{},outputs:['out.glb']};
  save(join(dir,'model.glb'),minimalGlb());const file=save(join(dir,'job.json'),JSON.stringify(job));const target=save(join(dir,'out.glb'),'owner-existing');
  const error=failed(()=>runBlenderJob(file,{blender:unavailableBlender(dir,{installed})}),/退出码 1/);
  const log=readFileSync(error.logPath,'utf8');expect(log).toContain(installed?'tested Smart/Remap adapter not ready':'Auto-Rig Pro plugin missing');expect(log).toContain('real execution pending');expect(log).toContain('Blender stderr:\n[blender-worker] reject:');
  expect(readFileSync(target,'utf8')).toBe('owner-existing');expect(existsSync(join(dirname(error.logPath),'result.json'))).toBe(false);expect(existsSync(join(dirname(error.logPath),'stage'))).toBe(false);
 });
});

function characterFixture(make=rig) {
 const dir=root(),job=make(),model=makeMockCharacterGlb();
 const views=['front','back','left','right'].map((role,i)=>{
  const bytes=encodePng(16,16,Buffer.alloc(16*16*3,20+i));save(join(dir,`${role}.png`),bytes);
  return {role,path:`${role}.png`,sha256:hash(bytes),width:16,height:16,camera:{position:[[0,1,3],[0,1,-3],[-3,1,0],[3,1,0]][i],target:[0,0.9,0],fov:45}};
 });
 const bounds=[[-0.31,0,-0.1],[0.31,1.81,0.1]],ids=['chin','neck','hips','left-shoulder','right-shoulder','left-elbow','right-elbow','left-wrist','right-wrist','left-knee','right-knee','left-ankle','right-ankle'];
 const markers={version:1,characterId:'test-hero',profile:'apollo-humanoid-v1',modelSha256:hash(model),bounds,state:'proposed',views,markers:ids.map(id=>({id,position:[0,0.9,0]})),method:'bbox-proposal'};
 const motion=makeMockMotionFbx();
 const provenance={version:1,source:'mixamo-manual',clipId:job.params.clipId??'walk-forward',sourceSha256:hash(motion),targetSha256:hash(model),skeleton:'apollo-humanoid-v1',fps:job.params.fps??30,frames:job.params.frames??31,loop:job.params.loop??true,inPlace:job.params.inPlace??true,searchTerm:'Walking',download:{format:'FBX',skin:false},licenseUrl:'https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html'};
 save(join(dir,'model.glb'),model);save(join(dir,'rig.glb'),model);save(join(dir,'motion.fbx'),motion);save(join(dir,'markers.json'),JSON.stringify(markers));save(join(dir,'provenance.json'),JSON.stringify(provenance));
 return {dir,job,markers,provenance,file:save(join(dir,'job.json'),JSON.stringify(job))};
}
describe('T5 typed mock character evidence',()=>{
 it.each([rig,retarget])('writes real skin/animation structure into isolated deterministic mock outputs',make=>{
  const f=characterFixture(make);const target=save(join(f.dir,f.job.outputs[0]),'owner target');
  const first=runBlenderJob(f.file,{mock:true}),second=runBlenderJob(f.file,{mock:true});
  expect(first.mock).toBe(true);expect(second.jobHash).toBe(first.jobHash);expect(second.outputs[0].sha256).toBe(first.outputs[0].sha256);expect(second.evidenceDir).not.toBe(first.evidenceDir);
  expect(readFileSync(target,'utf8')).toBe('owner target');expect(first.outputs[0].path).toContain(join(first.evidenceDir,'out'));
  const info=inspectCharacterGlb(readFileSync(first.outputs[0].path),f.job.op==='retarget-arp'?{clipName:'walk-forward',fps:30,frames:31}:{});
  expect(info.skinnedPrimitives).toBeGreaterThan(0);expect(info.bones).toContain('Hips');expect(info.mock).toBe(true);
  expect(info.animations).toHaveLength(f.job.op==='retarget-arp'?1:0);
  if(f.job.op==='retarget-arp'){expect(info.animations[0]).toMatchObject({name:'walk-forward',duration:1,frames:31});expect(info.skeletonHash).toBe(inspectCharacterGlb(readFileSync(join(f.dir,'rig.glb'))).skeletonHash);}
  expect(JSON.parse(readFileSync(join(f.dir,'markers.json'),'utf8')).state).toBe('proposed');expect(readFileSync(first.logPath,'utf8')).toContain('no Blender execution');
  const payload=JSON.parse(readFileSync(join(first.evidenceDir,'payload.json'),'utf8'));expect(payload.inputs).toHaveLength(f.job.inputs.length);expect(payload.inputs.map(p=>hash(readFileSync(p)))).toEqual(first.inputs.map(x=>x.sha256));
 });
 it.each([
  ['marker model hash',f=>{f.markers.modelSha256='0'.repeat(64);}],
  ['view hash',f=>{f.markers.views[0].sha256='0'.repeat(64);}],
  ['view bytes',f=>{save(join(f.dir,'front.png'),encodePng(16,16,Buffer.alloc(16*16*3,220)));}],
 ])('rejects %s rather than trusting matching filenames',(_label,mutate)=>{const f=characterFixture();mutate(f);save(join(f.dir,'markers.json'),JSON.stringify(f.markers));failed(()=>runBlenderJob(f.file,{mock:true}),/SHA|hash|哈希/i);expect(existsSync(join(f.dir,f.job.outputs[0]))).toBe(false);});
 it('retarget requires actual source bytes and matching provenance hashes',()=>{
  const f=characterFixture(retarget);save(join(f.dir,'motion.fbx'),'changed source');failed(()=>runBlenderJob(f.file,{mock:true}),/SHA|hash|哈希/i);
  rmSync(join(f.dir,'motion.fbx'));failed(()=>runBlenderJob(f.file,{mock:true}),/ENOENT/);expect(existsSync(join(f.dir,f.job.outputs[0]))).toBe(false);
 });
});
function outputBlender(dir,bytes) {
 const file=join(dir,'output-only-host.cjs');save(file,`#!${process.execPath}\nconst fs=require('node:fs');const args=process.argv.slice(2),job=JSON.parse(fs.readFileSync(args[args.indexOf('--')+1]));fs.writeFileSync(job.outputs[0],Buffer.from(${JSON.stringify(bytes.toString('base64'))},'base64'));\n`);chmodSync(file,0o755);return file;
}
function changeDocument(bytes,mutate) {
 const jsonLength=bytes.readUInt32LE(12),document=JSON.parse(bytes.toString('utf8',20,20+jsonLength));mutate(document);
 const json=Buffer.from(JSON.stringify(document)),padded=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]),bin=bytes.subarray(20+jsonLength),out=Buffer.alloc(20+padded.length+bin.length);
 out.write('glTF');out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(padded.length,12);out.writeUInt32LE(0x4e4f534a,16);padded.copy(out,20);bin.copy(out,20+padded.length);return out;
}
function changeRootRest(bytes) {return changeDocument(bytes,document=>{document.nodes[0].translation[1]+=0.01;});}
describe('T5 output character validation before publishing',()=>{
 it.each([
  ['missing actual skin',()=>minimalGlb(),/Character GLB/],
  ['wrong frame count',()=>makeMockCharacterGlb({clipName:'walk-forward',fps:30,frames:32}),/frames|times|duration/],
  ['different target rest pose',()=>changeRootRest(makeMockCharacterGlb({clipName:'walk-forward',fps:30,frames:31})),/rest\/bind/],
  ['mock presented as real',()=>makeMockCharacterGlb({clipName:'walk-forward',fps:30,frames:31}),/mock/],
  ['multiple clips',()=>changeDocument(makeMockCharacterGlb({clipName:'walk-forward',fps:30,frames:31}),d=>{d.animations.push({...d.animations[0],name:'other-clip'});}),/恰好一个动作/],
 ])('refuses %s from a zero-exit child',(_label,makeBytes,pattern)=>{
  const f=characterFixture(retarget);const target=save(join(f.dir,f.job.outputs[0]),'owner-target');
  const bytes=makeBytes(),hostBytes=_label==='mock presented as real'?bytes:changeDocument(bytes,document=>{if(document.extras)document.extras.mock=false;});
  const error=failed(()=>runBlenderJob(f.file,{blender:outputBlender(f.dir,hostBytes)}),pattern);
  expect(readFileSync(target,'utf8')).toBe('owner-target');expect(existsSync(join(dirname(error.logPath),'result.json'))).toBe(false);expect(existsSync(join(dirname(error.logPath),'stage'))).toBe(false);
 });
 it.each([false,true])('typed retarget keeps real pending for installed=%s',installed=>{
  const f=characterFixture(retarget);const error=failed(()=>runBlenderJob(f.file,{blender:unavailableBlender(f.dir,{installed})}),/退出码 1/);
  const log=readFileSync(error.logPath,'utf8');expect(log).toContain('typed apollo-humanoid-v1');expect(log).toContain('real execution pending');expect(existsSync(join(dirname(error.logPath),'result.json'))).toBe(false);expect(existsSync(join(f.dir,f.job.outputs[0]))).toBe(false);
 });
});

describe('T5 typed CLI report',()=>{
 it.each([rig,retarget])('prints only one report JSON and keeps downgrade diagnostics on stderr',make=>{
  const f=characterFixture(make),r=spawnSync(process.execPath,[join(HERE,'blender-job.mjs'),f.file,'--mock'],{encoding:'utf8'});
  expect(r.status).toBe(0);expect(r.stdout.trim().split('\n')).toHaveLength(1);expect(JSON.parse(r.stdout)).toMatchObject({mock:true,op:f.job.op});expect(r.stderr).toContain('downgrade');
 });
});
