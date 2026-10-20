// Real offline browser test: node scripts/compressed-models.integration.mjs
// RENDER_PROBE_CHROMIUM=/path/to/chromium; E1_KEEP_EVIDENCE=1 preserves outputs.
// No API, CDN, encoder download, Blender, or mocked loader participates in this run.
import assert from 'node:assert/strict';
import { realpathSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createServer, build, preview } from 'vite';
import { chromium } from 'playwright';
import { engineAliases } from './engine-aliases.mjs';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const fixtures=join(root,'scripts/fixtures/compressed-models');
const provenance=JSON.parse(readFileSync(join(fixtures,'provenance.json')));
for(const [name,meta] of Object.entries(provenance.files)) {
  const bytes=readFileSync(join(fixtures,name));assert.equal(bytes.length,meta.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),meta.sha256,`${name} provenance hash`);
  const n=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+n));
  const extension={draco:'KHR_draco_mesh_compression',meshopt:'EXT_meshopt_compression',ktx2:'KHR_texture_basisu'}[name.match(/cube-(.*)\.glb/)[1].replace('-shared','')];
  if(extension)assert(doc.extensionsRequired.includes(extension),`${name} must require real decoder; no fallback`);
}
const dir=realpathSync(mkdtempSync(join(tmpdir(),'apollo-e1-real-')));
const publicDir=join(dir,'public');mkdirSync(join(publicDir,'fixtures'),{recursive:true});
for(const name of Object.keys(provenance.files))cpSync(join(fixtures,name),join(publicDir,'fixtures',name));
cpSync(join(root,'public/__vendor'),join(publicDir,'__vendor'),{recursive:true});
symlinkSync(join(root,'node_modules'),join(dir,'node_modules'),'dir');
writeFileSync(join(dir,'index.html'),'<!doctype html><html><head><link rel="icon" href="data:,"></head><body><script type="module" src="./probe.js"></script></body></html>');
const entry=`
import * as THREE from 'three';
import { ModelPool } from ${JSON.stringify(join(root,'src/renderer/three/models.ts'))};
import { AssetManager } from ${JSON.stringify(join(root,'src/assets/asset-manager.ts'))};
import { ModelAssetLoader } from ${JSON.stringify(join(root,'src/assets/model-loader.ts'))};
const renderer=new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});
renderer.setSize(192,192);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;
document.body.append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x18212c);
const camera=new THREE.PerspectiveCamera(40,1,0.1,20);camera.position.set(4,3,5);camera.lookAt(0,0,0);
const assets=new AssetManager(new ModelAssetLoader(import.meta.env.BASE_URL));
for(const kind of ['raw','draco','meshopt','ktx2','ktx2-shared'])assets.register({kind:'model',key:kind,src:'fixtures/cube-'+kind+'.glb'});
const pool=new ModelPool(assets,renderer);const diagnostics=[];
const old=console.error;console.error=(...args)=>{diagnostics.push(args.map(String).join(' '));old(...args);};
function geometry(obj){
 const triangles=[],textures=[];let meshes=0,texture=null;
 obj.updateMatrixWorld(true);obj.traverse(mesh=>{if(!mesh.isMesh)return;meshes++;
 const g=mesh.geometry,p=g.attributes.position,idx=g.index;
 for(let i=0;i<(idx?idx.count:p.count);i+=3){const tri=[];for(let j=0;j<3;j++){const v=new THREE.Vector3().fromBufferAttribute(p,idx?idx.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld);tri.push(v.toArray());}triangles.push(tri);}
 const map=mesh.material.map; if(map)texture={compressed:map.isCompressedTexture===true,width:map.image.width,height:map.image.height,mipmaps:map.mipmaps.length,magFilter:map.magFilter};if(texture)textures.push(texture);
 });return {meshes,triangles,texture,textures};
}
window.e1={diagnostics,async load(kind){await assets.load(kind);const start=performance.now();let obj;
 while(!(obj=pool.ensure(scene,kind,{type:'Model3D',modelKey:kind}))){if(diagnostics.length)throw new Error(diagnostics.join('\\n'));if(performance.now()-start>15000)throw new Error('model timeout '+kind);await new Promise(r=>setTimeout(r,10));}
 for(const other of scene.children)other.visible=other===obj;
 renderer.render(scene,camera);const gl=renderer.getContext(),pixels=new Uint8Array(192*192*4);gl.readPixels(0,0,192,192,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
 return {...geometry(obj),pixels:Array.from(pixels)};},async failedKtx(){
 await assets.load('ktx2');let instantiated=false;for(let i=0;i<200;i++){instantiated ||= !!pool.ensure(scene,'broken',{type:'Model3D',modelKey:'ktx2'});await new Promise(r=>setTimeout(r,10));}return {instantiated,diagnostics};
},async start(kind){await assets.load(kind);pool.ensure(scene,kind,{type:'Model3D',modelKey:kind});},clear(){pool.dispose(scene);},count(){return pool.count;},dispose(){pool.dispose(scene);renderer.dispose();}};
`;
writeFileSync(join(dir,'probe.js'),entry);
const browser=await chromium.launch({headless:true,executablePath:process.env.RENDER_PROBE_CHROMIUM||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
const report={fixtureProvenance:provenance.files,browser:browser.version(),runs:[]};
function canonical(triangles){return triangles.map(t=>t.map(p=>p.map(v=>Math.round(v*1000)/1000).join(',')).sort().join('|')).sort();}
function comparePixels(a,b){let changed=0,max=0,sum=0;for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);if(d)changed++;max=Math.max(max,d);sum+=d;}return{changed,max,mean:sum/a.length};}
function resourceMonitor(){
 const NativeWorker=window.Worker;let workers=0,workersCreated=0,workerBlobsCreated=0;const decodePosts=[];
 window.Worker=class extends NativeWorker {closed=false;constructor(...args){super(...args);workers++;workersCreated++;}postMessage(...args){super.postMessage(...args);const type=args[0]?.type;if(window.e1CancelOnDecode&&['decode','transcode'].includes(type)){window.e1CancelOnDecode=false;decodePosts.push(type);queueMicrotask(()=>{window.e1.clear();window.e1Cancelled=true;});}}terminate(){if(!this.closed){this.closed=true;workers--;}super.terminate();}};
 const blobs=new Map(),create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);
 URL.createObjectURL=(value)=>{const url=create(value);blobs.set(url,{url,type:value.type,size:value.size});if(value.type==='')workerBlobsCreated++;return url;};
 URL.revokeObjectURL=(url)=>{blobs.delete(url);revoke(url);};
 window.e1Resources=()=>({workers,workersCreated,decodePosts,blobs:blobs.size,workerBlobsCreated,activeBlobs:[...blobs.values()]});
}
async function run(server,base,label){
 console.error('E1 stage',label,'begin');
 const port=server.httpServer.address().port,origin='http://127.0.0.1:'+port;
 const requests=[],errors=[];
 const localOnly=async context=>context.route('**/*',route=>{const url=route.request().url();if(/^https?:/.test(url)&&new URL(url).origin!==origin){errors.push('external request '+url);return route.abort();}return route.continue();});
 const context=await browser.newContext();await localOnly(context);await context.addInitScript(resourceMonitor);const page=await context.newPage();
 page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(origin+base);await page.waitForFunction(()=>!!window.e1);
 const loaded={};for(const kind of ['raw','draco','meshopt','ktx2']){loaded[kind]=await page.evaluate(kind=>window.e1.load(kind),kind);await page.screenshot({path:join(dir,label+'-'+kind+'.png')});}
 const raw=loaded.raw;assert.equal(raw.meshes,1);assert.equal(raw.triangles.length,12);
 const uniquePixels=new Set(raw.pixels.join(',').match(/(?:\d+,){3}\d+/g));assert(uniquePixels.size>4,'reference render must show colored nonblank cube');
 const comparisons={};for(const kind of ['draco','meshopt','ktx2']){
   assert.deepEqual(canonical(loaded[kind].triangles),canonical(raw.triangles),kind+' actual decoded triangle geometry');
   const comparison=comparePixels(raw.pixels,loaded[kind].pixels);comparisons[kind]=comparison;
   // Same fixed Chrome/GPU, nearest texture sampling, exact cube endpoints and
   // 0/255 UASTC texels. No subjective or broad similarity threshold is used.
   assert.equal(comparison.max,0,kind+' pixels must match the authored uncompressed reference exactly');
 }
 const shared=await page.evaluate(()=>window.e1.load('ktx2-shared'));assert.equal(shared.meshes,2,'shared-image fixture has two real primitives/materials');assert(shared.textures.every(texture=>texture.compressed),'both shared-source textures must transcode');assert.deepEqual(shared.textures.map(texture=>texture.magFilter).sort(),[1003,1006],'same image with distinct samplers preserves both textures');
 assert(loaded.ktx2.texture.compressed,'KTX2 must produce an actual GPU compressed texture');assert.equal(loaded.ktx2.texture.width,16);assert.equal(loaded.ktx2.texture.height,16);
 for(const file of ['draco_wasm_wrapper.js','draco_decoder.wasm','basis_transcoder.js','basis_transcoder.wasm'])assert(requests.some(url=>url===origin+base+'__vendor/three-r184/'+(file.startsWith('draco')?'draco/':'basis/')+file),file+' must be requested from BASE_URL local vendor path');
 assert(requests.every(url=>new URL(url).pathname.startsWith(base)),'all network requests respect BASE_URL');assert.deepEqual(errors,[]);
 await page.evaluate(()=>window.e1.dispose());const released=await page.evaluate(()=>window.e1Resources());assert.equal(released.workers,0,'dispose terminates initialized workers');assert.equal(released.blobs,0,'dispose revokes initialized decoder URLs');await context.close();
 // A real transcoder fetch failure must never become a successful untextured
 // model, even though GLTFLoader normally swallows image errors.
 const broken=await browser.newContext();await localOnly(broken);await broken.addInitScript(resourceMonitor);const brokenPage=await broken.newPage();
 await broken.route('**/basis_transcoder.wasm',r=>r.fulfill({status:404,body:'intentional E1 missing transcoder'}));
 await brokenPage.goto(origin+base);await brokenPage.waitForFunction(()=>!!window.e1);
 const failure=await brokenPage.evaluate(()=>window.e1.failedKtx());assert.equal(failure.instantiated,false,'failed real KTX2 must not cache an untextured model');const named=failure.diagnostics.filter(message=>message.startsWith('[ModelPool]'));assert.equal(named.length,1,'KTX2 failure must diagnose once per model key');assert.match(named[0],/ktx2|texture|transcod/i);
 await brokenPage.evaluate(()=>window.e1.dispose());const failedResources=await brokenPage.evaluate(()=>window.e1Resources());assert.equal(failedResources.workers,0,'failed KTX2 leaves no live worker');assert.equal(failedResources.blobs,0,'failed KTX2 revokes embedded image and decoder Blob URLs');await broken.close();

 console.error('E1 stage',label,'render/fault done');
 const cancellations=[];
 for(const kind of ['draco','ktx2']) {
   console.error('E1 stage',label,kind,'cancel begin');
   const cancelled=await browser.newContext();await localOnly(cancelled);
   await cancelled.addInitScript(resourceMonitor);
   let release,arrived;const gate=new Promise(resolve=>{release=resolve;}),seen=new Promise(resolve=>{arrived=resolve;});
   const wasm=kind==='draco'?'draco_decoder.wasm':'basis_transcoder.wasm';
   await cancelled.route('**/'+wasm,async route=>{arrived();await gate;await route.continue();});
   const cp=await cancelled.newPage();const pageErrors=[];cp.on('pageerror',e=>pageErrors.push(e.message));
   await cp.goto(origin+base);await cp.waitForFunction(()=>!!window.e1);await cp.evaluate(kind=>window.e1.start(kind),kind);
   let timer;try{await Promise.race([seen,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('decoder request not reached '+kind)),10000);})]);}finally{clearTimeout(timer);}
   console.error('E1 stage',label,kind,'request delayed');
   await cp.evaluate(()=>window.e1.clear());release();
   console.error('E1 stage',label,kind,'disposed/released');
   await cp.waitForFunction(()=>{const state=window.e1Resources();return state.workerBlobsCreated===1&&state.blobs===0;},null,{timeout:5000});
   const state=await cp.evaluate(()=>({count:window.e1.count(),...window.e1Resources(),diagnostics:window.e1.diagnostics}));
   assert.equal(state.count,0,kind+' late parse must not revive disposed pool');assert.equal(state.workers,0,kind+' late init must not create a live worker');assert.equal(state.blobs,0,kind+' late Blob must be revoked');
   assert.deepEqual(state.diagnostics.filter(message=>message.startsWith('[ModelPool]')),[],'old generation must not diagnose in the new generation');assert.deepEqual(pageErrors,[]);
   await cp.evaluate(()=>window.e1.dispose());await cancelled.close();cancellations.push({kind,...state});
 }
 for(const kind of ['draco','ktx2']) {
   const context=await browser.newContext();await localOnly(context);await context.addInitScript(resourceMonitor);const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.goto(origin+base);await page.waitForFunction(()=>!!window.e1);
   await page.evaluate(async kind=>{window.e1CancelOnDecode=true;await window.e1.start(kind);},kind);
   await page.waitForFunction(()=>window.e1Cancelled&&window.e1Resources().blobs===0,null,{timeout:5000});
   const state=await page.evaluate(()=>({count:window.e1.count(),...window.e1Resources(),diagnostics:window.e1.diagnostics}));
   assert.equal(state.count,0,kind+' decode completion cannot resurrect a disposed model');assert.equal(state.workers,0,kind+' decode worker terminated');assert.equal(state.workersCreated,1,kind+' test must reach a real worker');assert.deepEqual(state.decodePosts,[kind==='draco'?'decode':'transcode'],'test must post a real decoder task before disposal');assert.equal(state.blobs,0,kind+' decode cancellation revokes all embedded/worker URLs');assert.deepEqual(errors,[]);
   await page.evaluate(()=>window.e1.dispose());await context.close();cancellations.push({kind,phase:'decode-posted',...state});
 }
 assert.deepEqual(errors,[],'all scenarios must remain local');
 report.runs.push({label,base,comparisons,requests:requests.map(url=>new URL(url).pathname),ktx2Texture:loaded.ktx2.texture,failedKtx:failure,failedResources,released,cancellations,sharedTextures:shared.textures});
}
try {
 const config={configFile:false,root:dir,base:'/',publicDir,resolve:{alias:engineAliases(root)},server:{host:'127.0.0.1',port:0,fs:{allow:[root,dir]}},logLevel:'error'};
 const dev=await createServer(config);await dev.listen();try{await run(dev,'/','dev');}finally{await dev.close();}
 const base='/e1-subpath/';await build({...config,base,build:{outDir:join(dir,'dist'),emptyOutDir:true}});
 const manifest=JSON.parse(readFileSync(join(root,'public/__vendor/three-r184/manifest.json')));
 const vendored=['draco/draco_decoder.js','draco/draco_wasm_wrapper.js','draco/draco_decoder.wasm','basis/basis_transcoder.js','basis/basis_transcoder.wasm'];
 for(const file of vendored)assert.deepEqual(readFileSync(join(dir,'dist/__vendor/three-r184',file)),readFileSync(join(root,'public/__vendor/three-r184',file)),file+' distributed unchanged');
 report.vendorManifest=manifest;
 const built=await preview({...config,base,build:{outDir:join(dir,'dist')},preview:{host:'127.0.0.1',port:0}});try{await run(built,base,'build-subpath');}finally{await new Promise(resolve=>built.httpServer.close(resolve));}
 writeFileSync(join(dir,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({evidence:dir,...report},null,2));
} catch(error){writeFileSync(join(dir,'report.json'),JSON.stringify({...report,error:String(error.stack||error)},null,2)+'\n');console.error('E1 evidence retained at '+dir);throw error;}
finally {await browser.close();if(report.runs.length===2&&process.env.E1_KEEP_EVIDENCE!=='1')rmSync(dir,{recursive:true,force:true});}
