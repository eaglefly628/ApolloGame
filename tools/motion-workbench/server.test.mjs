import {request as httpRequest} from 'node:http';
import {beforeAll,afterAll,it,expect,vi} from 'vitest';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import {makeMockCharacterGlb} from '../../scripts/fixtures/character-pipeline/mock-character.mjs';
import {createWorkbenchServer} from './server.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex'),root=mkdtempSync(join(tmpdir(),'motion-workbench-'));let server,base,catalog,original;
beforeAll(async()=>{
 mkdirSync(join(root,'clips'));mkdirSync(join(root,'skins'));
 const skin=makeMockCharacterGlb(),clip=Buffer.from('Synthetic asset fixture, not a playback claim');writeFileSync(join(root,'skins/skin.glb'),skin);writeFileSync(join(root,'clips/wave.glb'),clip);
 catalog={version:1,skins:[{id:'skin',file:'skins/skin.glb',sha256:hash(skin),source:{kind:'mixamo',fbxSha256:'b'.repeat(64),mixamoName:'Fixture',searchTerm:'Fixture'},status:'draft',hipHeight:1,pose:'T-pose'}],clips:[{id:'wave',file:'clips/wave.glb',sha256:hash(clip),source:{kind:'mixamo',fbxSha256:'a'.repeat(64),mixamoName:'Fixture',description:'A person waves a hand.',searchTerm:'Fixture'},fps:30,frames:31,durationS:1,loop:false,inPlace:true,rootMotion:'none',category:'gesture',emotion:['neutral'],intensity:1,contacts:[],descZh:'合成测试',descEn:'Synthetic fixture',tags:[],derivedFrom:null,status:'draft'}]};
 original=JSON.stringify(catalog);writeFileSync(join(root,'catalog.json'),original);writeFileSync(join(root,'report.json'),'{}');server=await createWorkbenchServer({lib:root,runtimeLib:root,runtimeReport:join(root,'report.json')});server.listen(0,'127.0.0.1');await once(server,'listening');base='http://127.0.0.1:'+server.address().port;
},20000);
afterAll(async()=>{if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}rmSync(root,{recursive:true,force:true});});
it('unifies both native preview routes and a provenance-bearing AI index',async()=>{
 const summary=await fetch(base+'/summary.json').then(r=>r.json());expect(summary.counts.libraryMotions).toBe(1);expect(summary.snapshot.libraryCatalogSha256).toBe(hash(Buffer.from(original)));
 const index=await fetch(base+'/ai-catalog.json').then(r=>r.json());expect(index.entries.some(row=>row.id==='wave'&&row.sha256===catalog.clips[0].sha256)).toBe(true);expect(index.story.status).toBe('draft');
 for(const prefix of ['/library','/interaction']){expect(await fetch(base+prefix+'/').then(r=>r.text())).toContain(prefix+'/app.js');expect(await fetch(base+prefix+'/catalog.json').then(r=>r.json())).toEqual(catalog);expect((await fetch(base+prefix+'/app.js')).status).toBe(200);}
 expect((await fetch(base+'/entries?text=waves&limit=1')).status).toBe(200);
});
it('keeps indexed assets SHA checked and refuses mutations or unindexed paths',async()=>{
 const warn=vi.spyOn(console,'error').mockImplementation(()=>{});
 try{for(const method of ['POST','PUT','DELETE'])expect((await fetch(base+'/ai-catalog.json',{method})).status).toBe(405);
 expect((await fetch(base+'/library/assets/not-indexed.glb')).status).toBe(404);
 const file=join(root,'clips/wave.glb'),bytes=readFileSync(file);writeFileSync(file,'tamper');expect((await fetch(base+'/library/assets/clips/wave.glb')).status).toBe(409);writeFileSync(file,bytes);
 expect(readFileSync(join(root,'catalog.json'),'utf8')).toBe(original);
 }finally{warn.mockRestore();}
});
it('refuses startup when a catalog or either evidence snapshot changes during native preview initialization',async()=>{
 for(const changedFile of ['catalog.json','report.json','preview-report.json']){
  const isolated=mkdtempSync(join(tmpdir(),'motion-workbench-startup-'));
  try{
   mkdirSync(join(isolated,'clips'));mkdirSync(join(isolated,'skins'));
   writeFileSync(join(isolated,'catalog.json'),original);
   writeFileSync(join(isolated,'report.json'),'{}');writeFileSync(join(isolated,'preview-report.json'),'{}');
   writeFileSync(join(isolated,'skins/skin.glb'),readFileSync(join(root,'skins/skin.glb')));
   writeFileSync(join(isolated,'clips/wave.glb'),readFileSync(join(root,'clips/wave.glb')));
   const starting=createWorkbenchServer({lib:isolated,runtimeLib:isolated,runtimeReport:join(isolated,'report.json'),previewReport:join(isolated,'preview-report.json')});
   // createWorkbenchServer has captured its initial bytes and reached its first awaited bundle.
   const replacement=changedFile==='catalog.json'?JSON.stringify({...catalog,clips:catalog.clips.map(row=>({...row,source:{...row.source,description:'Changed during initialization'}}))}):'{"note":"changed during initialization"}';
   writeFileSync(join(isolated,changedFile),replacement);
   await expect(starting).rejects.toThrow('workbench source changed during initialization');
   expect(readFileSync(join(isolated,changedFile),'utf8')).toBe(replacement);
  }finally{rmSync(isolated,{recursive:true,force:true});}
 }
},20000);

it('rejects foreign Host names before serving workbench or nested assets',async()=>{
 const request=(path,host)=>new Promise((resolve,reject)=>{const req=httpRequest(base+path,{headers:{Host:host}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end();});
 for(const path of ['/ai-catalog.json','/library/catalog.json','/interaction/validation.json','/interaction/embedded-skin/skin'])expect(await request(path,'foreign.example:'+server.address().port)).toBe(403);
 expect(await request('/summary.json','localhost:'+server.address().port)).toBe(200);expect(await request('/summary.json','127.0.0.1:1')).toBe(403);
});
