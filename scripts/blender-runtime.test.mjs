import { afterEach, describe, expect, it, vi } from 'vitest';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, dirname, delimiter } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { blenderLaunchBlockReason, assertBlenderLaunchAllowed } from './lib/blender-runtime.mjs';
import { runBlenderJob } from './blender-job.mjs';
const dirs=[];
afterEach(()=>{vi.unstubAllEnvs();for(const d of dirs.splice(0))rmSync(d,{recursive:true,force:true});});
describe('Blender native startup crash prevention',()=>{
  it.each(['blender','/tmp/Blender.app/Contents/MacOS/Blender','/Applications/Blender.app/Contents/MacOS/Blender'])('blocks known native Blender before a macOS seatbelt launch: %s',executable=>{
    expect(blenderLaunchBlockReason(executable,{platform:'darwin',sandbox:'seatbelt'})).toContain('启动前拦截');
    expect(()=>assertBlenderLaunchAllowed(executable,{platform:'darwin',sandbox:'seatbelt'})).toThrow(/Metal/);
  });
  it('does not mistake unrelated fake-process unit fixtures or other platforms for this observed failure',()=>{
    expect(blenderLaunchBlockReason('/tmp/fake Blender ; literal.cjs',{platform:'darwin',sandbox:'seatbelt'})).toBeNull();
    expect(blenderLaunchBlockReason('blender',{platform:'linux',sandbox:'seatbelt'})).toBeNull();
    expect(blenderLaunchBlockReason('blender',{platform:'darwin',sandbox:null})).toBeNull();
  });
  it('blocks a renamed symlink that resolves to the Blender executable',()=>{
    const d=mkdtempSync(join(tmpdir(),'apollo-blender-launch-'));dirs.push(d);const binary=join(d,'Blender'),alias=join(d,'other-name');writeFileSync(binary,'not executed');symlinkSync(binary,alias);
    expect(blenderLaunchBlockReason(alias,{platform:'darwin',sandbox:'seatbelt'})).toContain('Metal');
  });
  it('resolves a bare PATH alias to the same physical Blender without launching a probe',()=>{
    const d=mkdtempSync(join(tmpdir(),'apollo-blender-path-'));dirs.push(d);const binary=join(d,'Blender');writeFileSync(binary,'not executed');chmodSync(binary,0o755);symlinkSync(binary,join(d,'dcc-alias'));
    expect(blenderLaunchBlockReason('dcc-alias',{platform:'darwin',sandbox:'seatbelt',path:d})).toContain('Metal');
  });
  it.each(['absolute','path-alias'])('job bridge refuses before child creation, publishes no result and still permits explicit Mock (%s)',mode=>{
    const d=mkdtempSync(join(tmpdir(),'apollo-blender-no-spawn-'));dirs.push(d);const binary=join(d,'Blender'),started=join(d,'child-started');
    writeFileSync(binary,`#!${process.execPath}\nrequire('node:fs').writeFileSync(${JSON.stringify(started)},'ran');\n`);chmodSync(binary,0o755);
    const raw=Buffer.from(JSON.stringify({asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{name:'fixture'}]})),j=Buffer.concat([raw,Buffer.alloc((4-raw.length%4)%4,32)]),glb=Buffer.alloc(20+j.length);glb.write('glTF');glb.writeUInt32LE(2,4);glb.writeUInt32LE(glb.length,8);glb.writeUInt32LE(j.length,12);glb.writeUInt32LE(0x4e4f534a,16);j.copy(glb,20);writeFileSync(join(d,'source.glb'),glb);
    const job={op:'render-views',inputs:['source.glb'],params:{views:[{id:'front',position:[0,1,4],target:[0,1,0],fov:45,width:16,height:16}]},outputs:['out/front.png']};writeFileSync(join(d,'job.json'),JSON.stringify(job));
    const descriptor=Object.getOwnPropertyDescriptor(process,'platform');Object.defineProperty(process,'platform',{value:'darwin',configurable:true});vi.stubEnv('CODEX_SANDBOX','seatbelt');
    let executable=binary;
    if(mode==='path-alias'){symlinkSync(binary,join(d,'dcc-alias'));vi.stubEnv('PATH',d+delimiter+(process.env.PATH??''));executable='dcc-alias';}
    try {
      let error;try{runBlenderJob(join(d,'job.json'),{blender:executable});}catch(e){error=e;}
      expect(existsSync(started)).toBe(false);expect(error?.message).toContain('启动前拦截');expect(existsSync(join(d,'out/front.png'))).toBe(false);expect(existsSync(join(dirname(error.logPath),'result.json'))).toBe(false);expect(readFileSync(error.logPath,'utf8')).toContain('Metal');
      const mock=runBlenderJob(join(d,'job.json'),{blender:executable,mock:true});expect(mock.mock).toBe(true);expect(existsSync(started)).toBe(false);expect(existsSync(mock.outputs[0].path)).toBe(true);
    } finally {Object.defineProperty(process,'platform',descriptor);}
  });
  it('direct character runner refuses before starting even a harmless executable stand-in',()=>{
    const d=mkdtempSync(join(tmpdir(),'apollo-blender-direct-no-spawn-'));dirs.push(d);const binary=join(d,'Blender'),started=join(d,'child-started'),preload=join(d,'platform.mjs');
    writeFileSync(binary,`#!${process.execPath}\nrequire('node:fs').writeFileSync(${JSON.stringify(started)},'ran');\n`);chmodSync(binary,0o755);
    writeFileSync(preload,"Object.defineProperty(process,'platform',{value:'darwin',configurable:true});\n");
    const runner=fileURLToPath(new URL('./character-pipeline.integration.mjs',import.meta.url));
    const result=spawnSync(process.execPath,['--import',pathToFileURL(preload).href,runner,'--out-dir',join(d,'output')],{env:{...process.env,BLENDER_BIN:binary,CODEX_SANDBOX:'seatbelt'},encoding:'utf8'});
    expect(existsSync(started)).toBe(false);expect(result.status).toBe(1);expect(result.stderr).toContain('启动前拦截');expect(existsSync(join(d,'output/run-1/idle.glb'))).toBe(false);
  });
});
