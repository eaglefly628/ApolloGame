import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, chmodSync, rmSync, existsSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { makeMockCharacterGlb } from './fixtures/character-pipeline/mock-character.mjs';
import { measureMotion, sha256 } from './lib/motion-catalog.mjs';
import { variantMotion, validateVariantJob, parseVariantArgs } from './motion-variant.mjs';
const roots=[];
const temp=()=>{const dir=mkdtempSync(join(tmpdir(),'motion-variant-'));roots.push(dir);return dir;};
afterEach(()=>roots.splice(0).forEach(dir=>rmSync(dir,{recursive:true,force:true})));
function unpack(bytes){const n=bytes.readUInt32LE(12);return {doc:JSON.parse(bytes.toString('utf8',20,20+n)),bin:Buffer.from(bytes.subarray(28+n))};}
function pack(doc,bin){const text=Buffer.from(JSON.stringify(doc)),j=Buffer.alloc(Math.ceil(text.length/4)*4,32);text.copy(j);const out=Buffer.alloc(28+j.length+bin.length);out.write('glTF');out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(j.length,12);out.writeUInt32LE(0x4e4f534a,16);j.copy(out,20);out.writeUInt32LE(bin.length,20+j.length);out.writeUInt32LE(0x004e4942,24+j.length);bin.copy(out,28+j.length);return out;}
function fixture(id='wave',frames=31,edit=()=>{}){const {doc,bin}=unpack(makeMockCharacterGlb({clipName:id,frames}));delete doc.extras.mock;doc.nodes.at(-1).name='MotionValidationCarrier';doc.nodes.at(-1).extras={motionValidationCarrier:true};edit(doc,bin);return pack(doc,bin);}
function derivedFixture(source,id,kind,edit) {
 const {doc,bin}=unpack(source);const parts=[bin];let length=bin.length;
 function array(values,width){const start=length,bytes=Buffer.alloc(values.length*4);values.forEach((x,i)=>bytes.writeFloatLE(x,i*4));parts.push(bytes);length+=bytes.length;const view=doc.bufferViews.length;doc.bufferViews.push({buffer:0,byteOffset:start,byteLength:bytes.length});const a=doc.accessors.length;doc.accessors.push({bufferView:view,componentType:5126,count:values.length/width,type:width===1?'SCALAR':'VEC3',...(width===1?{min:[values[0]],max:[values.at(-1)]}:{})});return a;}
 const frames=kind==='trim'?16:31,times=Array.from({length:frames},(_,i)=>i/30),values=times.flatMap((_,i)=>[kind==='loop-fix'?0:kind==='mirror'?-.05*i/30:.05*i/30,.95,0]);
 const input=array(times,1),output=array(values,3);doc.animations=[{name:id,samplers:[{input,output,interpolation:'LINEAR'}],channels:[{sampler:0,target:{node:0,path:'translation'}}]}];doc.buffers[0].byteLength=length;const data=Buffer.concat(parts);edit(doc,data);return pack(doc,data);
}
async function setup({kind='trim',edit=()=>{}}={}) {
 const dir=temp(),lib=join(dir,'library');mkdirSync(join(lib,'clips'),{recursive:true});const bytes=fixture();writeFileSync(join(lib,'clips/wave.glb'),bytes);
 const row={id:'wave',file:'clips/wave.glb',sha256:sha256(bytes),source:{kind:'mixamo',fbxSha256:'b'.repeat(64),searchTerm:'Synthetic',mixamoName:'Synthetic'},...await measureMotion(bytes,'wave',30),category:'gesture',emotion:['neutral'],intensity:1,contacts:['right-hand'],descZh:'合成测试',descEn:'Synthetic test',tags:['synthetic'],derivedFrom:null,status:'confirmed'};
 writeFileSync(join(lib,'catalog.json'),JSON.stringify({version:1,clips:[row],skins:[]}));
 const newId=`wave-${kind}`,out=join(dir,'output.glb');writeFileSync(out,derivedFixture(bytes,newId,kind,edit));
 const blender=join(dir,'fake-dcc');writeFileSync(blender,`#!/usr/bin/env node\nconst fs=require('node:fs');const payload=JSON.parse(fs.readFileSync(process.argv.at(-1)));if(payload.op!=='motion-variant')process.exit(3);fs.copyFileSync(${JSON.stringify(out)},payload.outputs[0]);\n`);chmodSync(blender,0o755);
 return {lib,id:'wave',kind,newId,blender,...(kind==='trim'?{trim:[0,0.5]}:{})};
}
describe('M5 typed variant recipe and strict CLI',()=>{
 const job={op:'motion-variant',inputs:['source.glb'],outputs:['variant.glb'],params:{profile:'apollo-humanoid-v1',clipId:'wave-trim',fps:30,kind:'trim',trim:[0,.5]}};
 it('accepts closed variants and aligned trim seconds',()=>{expect(validateVariantJob(job)).toBe(job);expect(parseVariantArgs(['wave','--trim','0,0.5','--id','wave-short'])).toEqual({id:'wave',kind:'trim',trim:[0,.5],newId:'wave-short'});});
 it.each([{kind:'unknown'},{trim:[.5,.1]},{trim:[0,Infinity]},{trim:[0,.51]},{fps:0},{python:'exec'}, {kind:'mirror',trim:[0,1]}])('rejects invalid recipe %j',change=>expect(()=>validateVariantJob({...job,params:{...job.params,...change}})).toThrow());
 it.each([['wave'],['wave','--mirror','--loop-fix'],['wave','--trim','0,NaN'],['wave','--exec','x'],['wave','--mirror','--mirror']])('refuses malformed invocation %j',(...args)=>expect(()=>parseVariantArgs(args)).toThrow());
});
describe('M5 publication through fake Blender and real engine gates',()=>{
 it.each(['trim','mirror','loop-fix'])('publishes %s with derived provenance and draft status; refuses repeat overwrite',async kind=>{
  const opts=await setup({kind});const before=readFileSync(join(opts.lib,'clips/wave.glb'));
  const result=await variantMotion(opts);expect(result).toMatchObject({ok:true,id:opts.newId,derivedFrom:'wave',entry:{status:'draft',derivedFrom:'wave',provenance:{annotationReviewRequired:true}}});
  expect(result.entry.frames).toBe(kind==='trim'?16:31);expect(result.entry.contacts).toEqual(kind==='mirror'?['left-hand']:['right-hand']);
  expect(readFileSync(join(opts.lib,'clips/wave.glb'))).toEqual(before);
  await expect(variantMotion(opts)).rejects.toThrow(/already exists/);
  expect(existsSync(join(opts.lib,'.ingest.lock'))).toBe(false);
 });
 it('rejects tampered source, out-of-range trim, and conflicting writers',async()=>{
  const a=await setup();writeFileSync(join(a.lib,'clips/wave.glb'),'tamper');await expect(variantMotion(a)).rejects.toThrow(/SHA/);
  const b=await setup();await expect(variantMotion({...b,trim:[0,2]})).rejects.toThrow(/exceeds/);
  const c=await setup();writeFileSync(join(c.lib,'.ingest.lock'),'held');await expect(variantMotion(c)).rejects.toThrow();expect(readFileSync(join(c.lib,'.ingest.lock'),'utf8')).toBe('held');
 });
 it('rejects changed rest, inverse bind or carrier instead of accepting a usable-looking output',async()=>{
  const opts=await setup({edit:doc=>{doc.nodes[1].translation[1]+=.01;}});const before=readFileSync(join(opts.lib,'catalog.json'));
  await expect(variantMotion(opts)).rejects.toThrow(/rest|hierarchy|bind/);expect(readFileSync(join(opts.lib,'catalog.json'))).toEqual(before);expect(existsSync(join(opts.lib,`clips/${opts.newId}.glb`))).toBe(false);
 });
 it('retries a failed DCC without overwriting prior attempt evidence',async()=>{
  const opts=await setup(),valid=readFileSync(opts.blender);writeFileSync(opts.blender,'#!/usr/bin/env node\nprocess.exit(2);\n');
  await expect(variantMotion(opts)).rejects.toThrow(/退出码/);expect(existsSync(join(opts.lib,'.ingest.lock'))).toBe(false);
  writeFileSync(opts.blender,valid);expect(await variantMotion(opts)).toMatchObject({ok:true,id:opts.newId});
 });
 it('refuses an existing unindexed output instead of overwriting it',async()=>{
  const opts=await setup(),target=join(opts.lib,'clips',opts.newId+'.glb');writeFileSync(target,'original orphan');
  await expect(variantMotion(opts)).rejects.toThrow(/output already exists/);expect(readFileSync(target,'utf8')).toBe('original orphan');
 });
 it('refuses repository libraries and source/output symlink escapes',async()=>{
  await expect(variantMotion({id:'wave',kind:'mirror',lib:resolve('.')})).rejects.toThrow(/repository/);
  const opts=await setup();const outside=join(temp(),'outside.glb');writeFileSync(outside,readFileSync(join(opts.lib,'clips/wave.glb')));rmSync(join(opts.lib,'clips/wave.glb'));symlinkSync(outside,join(opts.lib,'clips/wave.glb'));await expect(variantMotion(opts)).rejects.toThrow(/escapes/);
 });
});
const blender=process.env.MOTION_VARIANT_BLENDER;
it.runIf(!!blender)('actual Blender mathutils preserves asymmetric lengths/roll and loop seam bounds',()=>{
 const dir=temp(),script=join(dir,'verify.py');
 writeFileSync(script,`import sys, math, copy\nsys.dont_write_bytecode=True\nsys.path.insert(0,${JSON.stringify(resolve('scripts/blender'))})\nfrom mathutils import Quaternion, Vector\nfrom motion_variant import mirror_samples, loop_fix_samples, _world, _quat, _xyzw\nq=lambda axis,a:_xyzw(Quaternion(Vector(axis),a))\nnodes=[{'name':'Hips','children':[1,2]},{'name':'LeftUpperArm','children':[3]},{'name':'RightUpperArm','children':[4]},{'name':'LeftHand'},{'name':'RightHand'}]\nrest=[{'translation':[0,1,0],'rotation':q((0,0,1),.13),'scale':[1,1,1]},{'translation':[-.2,.4,0],'rotation':q((1,0,0),.63),'scale':[1,1,1]},{'translation':[.3,.4,0],'rotation':q((0,1,0),-.39),'scale':[1,1,1]},{'translation':[-.51,0,0],'rotation':[0,0,0,1],'scale':[1,1,1]},{'translation':[.78,0,0],'rotation':[0,0,0,1],'scale':[1,1,1]}]\npose=copy.deepcopy(rest);pose[0]['translation']=[.2,1.1,.3];pose[1]['rotation']=_xyzw(_quat(q((0,0,1),.48))@_quat(rest[1]['rotation']))\nout=mirror_samples([pose],rest,nodes,list(range(5)))[0]\nrw=_world(rest,nodes);pw=_world(pose,nodes);ow=_world(out,nodes)\nassert abs(ow[0].translation.x+pw[0].translation.x)<1e-5\nfor i in range(1,5):assert (Vector(out[i]['translation'])-Vector(rest[i]['translation'])).length<1e-7\nfrom mathutils import Matrix\nf=Matrix.Diagonal(Vector((-1,1,1)));expected=(f@(pw[1].to_quaternion().to_matrix()@rw[1].to_quaternion().to_matrix().inverted())@f)@rw[2].to_quaternion().to_matrix()\nassert ow[2].to_quaternion().rotation_difference(expected.to_quaternion()).angle<1e-4\ntwice=mirror_samples([out],rest,nodes,list(range(5)))[0];tw=_world(twice,nodes)\nfor i in range(5):assert tw[i].to_quaternion().rotation_difference(pw[i].to_quaternion()).angle<1e-4\nsamples=[]\nfor i in range(9):\n p=copy.deepcopy(rest);p[0]['translation'][0]=i*.1;p[1]['rotation']=q((0,0,1),i*.1);p[2]['scale']=[1+i*.01]*3;samples.append(p)\nfixed=loop_fix_samples(samples,list(range(5)))\nassert fixed[:7]==samples[:7] and fixed[-1]==samples[0]\nassert 0<=fixed[7][0]['translation'][0]<=samples[7][0]['translation'][0]\ntry:\n bad=copy.deepcopy(pose);bad[1]['translation'][0]+=.1;mirror_samples([bad],rest,nodes,list(range(5)));raise AssertionError('accepted limb length change')\nexcept ValueError:pass\nprint('M5_MATH_PASS')\n`);
 const result=spawnSync(blender,['--background','--factory-startup','--disable-autoexec','--python-exit-code','1','--python',script],{encoding:'utf8',timeout:60000});
 expect(result.status,result.stdout+'\n'+result.stderr).toBe(0);expect(result.stdout).toContain('M5_MATH_PASS');
},65000);
it.runIf(!!blender)('actual Blender worker writes trim/mirror/loop GLBs accepted by engine, retaining rest and original bytes',async()=>{
 const dir=temp(),source=join(dir,'source.glb'),script=join(dir,'derive.py');const bytes=fixture();writeFileSync(source,bytes);
 const jobs=['trim','mirror','loop-fix'].map(kind=>({op:'motion-variant',inputs:[source],outputs:[join(dir,kind+'.glb')],params:{profile:'apollo-humanoid-v1',clipId:'actual-'+kind,fps:30,kind,...(kind==='trim'?{trim:[0,.5]}:{})}}));
 writeFileSync(script,`import sys,json\nsys.dont_write_bytecode=True\nsys.path.insert(0,${JSON.stringify(resolve('scripts/blender'))})\nfrom motion_variant import motion_variant\nfor job in json.loads(${JSON.stringify(JSON.stringify(jobs))}):motion_variant(job)\nprint('M5_GLB_PASS')\n`);
 const result=spawnSync(blender,['--background','--factory-startup','--disable-autoexec','--python-exit-code','1','--python',script],{encoding:'utf8',timeout:60000});expect(result.status,result.stdout+'\n'+result.stderr).toBe(0);
 for(const kind of ['trim','mirror','loop-fix']){const output=readFileSync(join(dir,kind+'.glb')),measured=await measureMotion(output,'actual-'+kind,30);expect(measured.frames).toBe(kind==='trim'?16:31);if(kind==='loop-fix')expect(measured.loop).toBe(true);expect(unpack(output).doc.nodes).toEqual(unpack(bytes).doc.nodes);expect(unpack(output).doc.skins).toEqual(unpack(bytes).doc.skins);}
 const {doc:mirrored,bin}=unpack(readFileSync(join(dir,'mirror.glb')));const channel=mirrored.animations[0].channels.find(c=>c.target.node===0&&c.target.path==='translation'),accessor=mirrored.accessors[mirrored.animations[0].samplers[channel.sampler].output],view=mirrored.bufferViews[accessor.bufferView];expect(bin.readFloatLE(view.byteOffset+(accessor.count-1)*12)).toBeCloseTo(-.05);
 expect(readFileSync(source)).toEqual(bytes);
},65000);
