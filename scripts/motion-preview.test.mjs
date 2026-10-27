import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { request as rawRequest } from 'node:http';
import { createHash } from 'node:crypto';
import { makeMockCharacterGlb } from './fixtures/character-pipeline/mock-character.mjs';
import { inspectCharacterGlb } from './lib/character-glb.mjs';
import { createPreviewServer } from './motion-preview.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const root=mkdtempSync(join(tmpdir(),'motion-preview-server-')),lib=join(root,'lib'),outside=join(root,'outside');let server,base,catalog,before;
const request=(path,options)=>fetch(base+path,options);
const rawStatus=path=>new Promise((resolve,reject)=>{const request=rawRequest(base,{path},response=>{response.resume();resolve(response.statusCode);});request.on('error',reject);request.end();});
beforeAll(async()=>{
 mkdirSync(join(lib,'clips'),{recursive:true});mkdirSync(join(lib,'skins'));mkdirSync(outside);
 const bytes=Buffer.from('Synthetic offline byte fixture; not a GLB playback claim');writeFileSync(join(lib,'clips/wave.glb'),bytes);
 catalog={version:1,skins:[],clips:[{id:'wave',file:'clips/wave.glb',sha256:hash(bytes),source:{kind:'mixamo',fbxSha256:'a'.repeat(64),mixamoName:'Synthetic',searchTerm:'Synthetic'},fps:30,frames:31,durationS:1,loop:false,inPlace:true,rootMotion:'none',category:'gesture',emotion:['neutral'],intensity:1,contacts:[],descZh:'合成测试',descEn:'Synthetic fixture',tags:[],derivedFrom:null,status:'draft'}]};
 const skin=makeMockCharacterGlb();writeFileSync(join(lib,'skins/skin.glb'),skin);catalog.skins=[{id:'skin',file:'skins/skin.glb',sha256:hash(skin),source:{kind:'mixamo',fbxSha256:'b'.repeat(64),mixamoName:'Synthetic',searchTerm:'Synthetic'},status:'draft',hipHeight:1,pose:'T-pose'}];
 writeFileSync(join(lib,'catalog.json'),JSON.stringify(catalog));before=[hash(readFileSync(join(lib,'catalog.json'))),hash(bytes)];server=await createPreviewServer(lib);server.listen(0,'127.0.0.1');await once(server,'listening');base='http://127.0.0.1:'+server.address().port;
},15000);
afterAll(async()=>{if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}rmSync(root,{recursive:true,force:true});});
describe('local read-only motion preview server',()=>{
 it('serves bounds only for indexed Skin ids and rechecks cached assets',async()=>{
  const file=join(lib,'skins/skin.glb'),original=readFileSync(file),warn=vi.spyOn(console,'error').mockImplementation(()=>{});
  try {
   const r=await request('/skin-bounds/skin');expect(r.status).toBe(200);expect(await r.json()).toEqual({id:'skin',sha256:hash(original),bounds:inspectCharacterGlb(original,{allowSkinMaterialExtensions:true}).bounds});
   expect((await request('/skin-bounds/skin',{method:'HEAD'})).status).toBe(200);
   for(const path of ['/skin-bounds/wave','/skin-bounds/unknown','/skin-bounds/%2e%2e','/skin-bounds/skin/extra'])expect(await rawStatus(path)).toBe(404);
   expect((await request('/skin-bounds/skin',{method:'POST'})).status).toBe(405);
   writeFileSync(file,'tamper');expect((await request('/skin-bounds/skin')).status).toBe(409);
   rmSync(file);writeFileSync(join(outside,'skin.glb'),original);symlinkSync(join(outside,'skin.glb'),file);expect((await request('/skin-bounds/skin')).status).toBe(409);
  }finally{rmSync(file,{force:true});writeFileSync(file,original);warn.mockRestore();}
 });
 it('serves the whitelist and HEAD without body, with no-store headers',async()=>{
  const r=await request('/catalog.json');expect(r.status).toBe(200);expect(await r.json()).toEqual(catalog);expect(r.headers.get('cache-control')).toBe('no-store');
  const a=await request('/assets/clips/wave.glb');expect(a.status).toBe(200);expect(hash(Buffer.from(await a.arrayBuffer()))).toBe(catalog.clips[0].sha256);
  const h=await request('/assets/clips/wave.glb',{method:'HEAD'});expect(h.status).toBe(200);expect(await h.text()).toBe('');expect((await request('/app.js')).headers.get('content-type')).toContain('javascript');
 });
 it('rejects writes, unknown paths and encoded traversal without changing original files',async()=>{
  for(const method of ['POST','PUT','DELETE','PATCH'])expect((await request('/catalog.json',{method})).status).toBe(405);
  for(const path of ['/assets/clips/unknown.glb','/assets/%2e%2e/catalog.json','/assets/clips/%2e%2e/%2e%2e/catalog.json','/../outside','/assets/clips/wave.glb/extra'])expect(await rawStatus(path)).toBe(404);
  expect([hash(readFileSync(join(lib,'catalog.json'))),hash(readFileSync(join(lib,'clips/wave.glb')))]).toEqual(before);
 });
 it('rechecks bytes SHA on every request and rejects asset symlink escapes',async()=>{
  const warn=vi.spyOn(console,'error').mockImplementation(()=>{}),file=join(lib,'clips/wave.glb'),bytes=readFileSync(file);
  try{writeFileSync(file,'tamper');expect((await request('/assets/clips/wave.glb')).status).toBe(409);rmSync(file);writeFileSync(join(outside,'wave.glb'),bytes);symlinkSync(join(outside,'wave.glb'),file);expect((await request('/assets/clips/wave.glb')).status).toBe(409);}finally{rmSync(file,{force:true});writeFileSync(file,bytes);warn.mockRestore();}
 });
 it('rejects catalog symlink escapes before building or serving',async()=>{
  const alias=join(root,'alias-lib');mkdirSync(alias);writeFileSync(join(outside,'catalog.json'),JSON.stringify(catalog));symlinkSync(join(outside,'catalog.json'),join(alias,'catalog.json'));await expect(createPreviewServer(alias)).rejects.toThrow(/catalog escapes/);
 });
});
