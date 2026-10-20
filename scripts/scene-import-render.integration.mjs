// Real local Chrome, dev root and production subpath; no remote service or mocked
// model loader. E5_KEEP_EVIDENCE=1 retains screenshots, authored GLB and report.
// Optional complete Blender chain: E5_SCENE_FIXTURE=<scene.glb> E5_SCENE_DATA=<baked scene.json>.
import assert from 'node:assert/strict';
import { realpathSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createServer, build, preview } from 'vite';
import { chromium } from 'playwright';
import { engineAliases } from './engine-aliases.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
assert(process.env.RENDER_PROBE_CHROMIUM, 'Set RENDER_PROBE_CHROMIUM to the fixed local Chrome executable');
const executablePath = realpathSync(process.env.RENDER_PROBE_CHROMIUM);
const dir = realpathSync(mkdtempSync(join(tmpdir(), 'apollo-e5-render-'))), publicDir = join(dir, 'public');
mkdirSync(join(publicDir, 'fixtures'), { recursive: true });
cpSync(join(root, 'public/__vendor'), join(publicDir, '__vendor'), { recursive: true });
symlinkSync(join(root, 'node_modules'), join(dir, 'node_modules'), 'dir');

// Retain the original E1 authored cube's real embedded PNG and mesh. Add a scene
// hierarchy with duplicate names, parent rotations, nonuniform scales and shear.
const raw = readFileSync(join(root, 'scripts/fixtures/compressed-models/cube-raw.glb'));
const oldLength = raw.readUInt32LE(12), doc = JSON.parse(raw.subarray(20, 20 + oldLength));
doc.nodes = [
  { name: 'parent', translation: [3,2,-1], rotation: [0,0,Math.sin(.4),Math.cos(.4)], scale: [2,1,.5], children: [1,4,5,6] },
  { name: 'nested', rotation: [0,Math.sin(.3),0,Math.cos(.3)], scale: [1,1.3,1], children: [2,3] },
  { name: 'pick_duplicate', mesh: 0, translation: [1,0,1] },
  { name: 'pick_duplicate', mesh: 0, translation: [-4,0,0] },
  { name: 'display_background', mesh: 0, translation: [0,-4,0], scale: [4,.1,4] },
  { name: 'nav_helper', mesh: 0, translation: [0,-5,0] },
  { name: 'spawn_anchor', translation: [0,0,0] },
];
doc.asset.generator = 'Apollo E5 authored renderer scene using original CC0 E1 geometry and texture';
function pack(document, binary) {
  const rawJSON = Buffer.from(JSON.stringify(document)), json = Buffer.concat([rawJSON, Buffer.alloc((4-rawJSON.length%4)%4,32)]);
  const output = Buffer.alloc(28+json.length+binary.length); output.write('glTF'); output.writeUInt32LE(2,4); output.writeUInt32LE(output.length,8);
  output.writeUInt32LE(json.length,12); output.writeUInt32LE(0x4e4f534a,16); json.copy(output,20);
  output.writeUInt32LE(binary.length,20+json.length); output.writeUInt32LE(0x004e4942,24+json.length); binary.copy(output,28+json.length); return output;
}
const bytes = pack(doc, raw.subarray(28+oldLength));
writeFileSync(join(publicDir, 'fixtures/scene.glb'), bytes);
let importedScene = null, importedProvenance = null;
if (process.env.E5_SCENE_FIXTURE || process.env.E5_SCENE_DATA) {
  assert(process.env.E5_SCENE_FIXTURE && process.env.E5_SCENE_DATA, 'Supply both E5_SCENE_FIXTURE and E5_SCENE_DATA');
  const importedBytes = readFileSync(process.env.E5_SCENE_FIXTURE);
  importedScene = JSON.parse(readFileSync(process.env.E5_SCENE_DATA));
  const hash = createHash('sha256').update(importedBytes).digest('hex');
  assert.equal(importedScene.sourceSha256,hash,'rendered final GLB must match the CPU-baked scene SHA');
  const sourceDoc = JSON.parse(importedBytes.subarray(20,20+importedBytes.readUInt32LE(12)));
  importedProvenance = {source:realpathSync(process.env.E5_SCENE_FIXTURE),generator:sourceDoc.asset.generator,sha256:hash,bytes:importedBytes.length,requiredExtensions:sourceDoc.extensionsRequired ?? []};
  cpSync(process.env.E5_SCENE_FIXTURE,join(publicDir,'fixtures/imported-scene.glb'));
}
writeFileSync(join(dir, 'index.html'), '<!doctype html><html><head><link rel="icon" href="data:,"></head><body style="margin:0"><div id="stage" style="width:480px;height:360px;position:relative"></div><script type="module" src="./probe.js"></script></body></html>');
writeFileSync(join(dir, 'probe.js'), `
import * as THREE from 'three';
import { ThreeRenderer } from ${JSON.stringify(join(root,'src/renderer/three-renderer.ts'))};
import { World } from ${JSON.stringify(join(root,'src/engine/core/world.ts'))};
import { QueuedInputSource } from ${JSON.stringify(join(root,'src/net/host/queued-input.ts'))};
import { AssetManager } from ${JSON.stringify(join(root,'src/assets/asset-manager.ts'))};
import { ModelAssetLoader } from ${JSON.stringify(join(root,'src/assets/model-loader.ts'))};
import { expandSceneImports } from ${JSON.stringify(join(root,'src/assembly/scene-import.ts'))};
const assets = new AssetManager(new ModelAssetLoader(import.meta.env.BASE_URL));
assets.register({kind:'model',key:'scene',src:'fixtures/scene.glb'}); assets.registerGroups({scene:['scene']});
const backend = new ThreeRenderer({assets,width:480,height:360,dprCap:1,antialias:false,shadowMapSize:256}); backend.init(document.getElementById('stage'));
const world = new World(), sink = new QueuedInputSource('local');
const importedScene = ${JSON.stringify(importedScene)};
const importedPickId = importedScene ? 'imported-background/node-'+importedScene.nodes.find(node=>node.kind==='pick').path.join('-') : null;
function entity(id, components) { world.createEntity(id); for (const component of components) world.addComponent(id,component); }
entity('camera',[{type:'Camera3D',yaw:0,pitch:0,distance:18,pivotX:0,pivotY:1,pivotZ:0,near:.1,far:100}]);
const sourceMatrix = new THREE.Matrix4().compose(new THREE.Vector3(3,2,-1),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),.8),new THREE.Vector3(2,1,.5))
 .multiply(new THREE.Matrix4().compose(new THREE.Vector3(),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),.6),new THREE.Vector3(1,1.3,1)))
 .multiply(new THREE.Matrix4().makeTranslation(1,0,1));
const origin = new THREE.Vector3().setFromMatrixPosition(sourceMatrix).toArray();
const base = {type:'Model3D',modelKey:'scene'};
entity('background',[{type:'Transform3D',x:0,y:0,z:0},{...base,excludeNodes:[2,3,5,6]}]);
entity('far',[{type:'Transform3D',x:0,y:1,z:-4},{...base,nodeIndex:2,origin},{type:'Pickable3D',signal:'far.pick'}]);
entity('near',[{type:'Transform3D',x:0,y:1,z:4},{...base,nodeIndex:2,origin},{type:'Pickable3D',signal:'scene.pick'}]);
const nativeClone = THREE.Material.prototype.clone, sourceMaterial = new WeakMap(), disposals = new WeakMap();
THREE.Material.prototype.clone = function() { const clone = nativeClone.call(this); sourceMaterial.set(clone,this); return clone; };
function track(resource) { if (!resource || disposals.has(resource)) return; disposals.set(resource,0); resource.addEventListener('dispose',()=>disposals.set(resource,disposals.get(resource)+1)); }
function meshes(object) { const result=[]; object.traverse(node=>{if(node.isMesh)result.push(node);});return result; }
function object(id) { return backend.models.instances.get(id); }
function pixelState() { const gl=backend.gl.getContext(), p=new Uint8Array(480*360*4);gl.readPixels(0,0,480,360,gl.RGBA,gl.UNSIGNED_BYTE,p);let colored=0,hash=2166136261;for(let i=0;i<p.length;i+=4){if(p[i]>40||p[i+1]>40||p[i+2]>40)colored++;for(let j=0;j<3;j++)hash=Math.imul(hash^p[i+j],16777619);}return {colored,hash:hash>>>0}; }
function project(point) { const p=point.clone().project(backend.cameras.current),r=backend.gl.domElement.getBoundingClientRect();return {x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2}; }
let keptResources=[], nearObject, cloneMaterial, oldObject;
window.e5 = {
 async load() {
   backend.sync(world); backend.sync(world); const waiting=backend.readStats();
   await assets.preloadGroup('scene'); let refreshed=false;
   for(let i=0;i<1000;i++){ backend.sync(world); if(backend.readStats().models===3){refreshed=backend.readStats().rendered;break;} await new Promise(resolve=>setTimeout(resolve,5)); }
   if(backend.readStats().models!==3) throw new Error('actual scene parse timeout');
   nearObject=object('near');const nearMesh=meshes(nearObject)[0],background=object('background');
   cloneMaterial=nearMesh.material;keptResources=[nearMesh.geometry,nearMesh.material.map,sourceMaterial.get(nearMesh.material)]; for(const r of [...keptResources,cloneMaterial])track(r);
   const expected=nearObject.matrix.clone().multiply(new THREE.Matrix4().makeTranslation(-origin[0],-origin[1],-origin[2])).multiply(sourceMatrix);
   const matrixError=Math.max(...nearMesh.matrixWorld.elements.map((value,i)=>Math.abs(value-expected.elements[i])));
   const bounds=new THREE.Box3().setFromObject(nearObject,true), b=backend.pickables.get('near');
   const boxError=Math.max(Math.abs(b.cx-(bounds.min.x+bounds.max.x)/2),Math.abs(b.hx-(bounds.max.x-bounds.min.x)/2),Math.abs(b.cy-(bounds.min.y+bounds.max.y)/2),Math.abs(b.hy-(bounds.max.y-bounds.min.y)/2),Math.abs(b.cz-(bounds.min.z+bounds.max.z)/2),Math.abs(b.hz-(bounds.max.z-bounds.min.z)/2));
   const screen=project(new THREE.Vector3(0,1,4)),hit=backend.pick(screen.x,screen.y);if(hit)sink.enqueueAction(hit.signal,{arg:hit.arg});
   const state={waiting,refreshed,matrixError,boxError,hit,commands:sink.commandsForTick(7),backgroundMeshes:meshes(background).length,nearMeshes:meshes(nearObject).length,shared:meshes(background)[0].geometry===nearMesh.geometry,stats:backend.readStats(),pixels:pixelState()};
   backend.sync(world);state.staticSkipped=!backend.readStats().rendered;return state;
 },
 selector() {
   oldObject=object('near');world.addComponent('near',{...base,nodeIndex:3,origin});backend.sync(world);
   const changed=object('near'),state={rebuilt:changed!==oldObject,oldDetached:!oldObject.parent,rendered:backend.readStats().rendered,oldMaterialDisposed:disposals.get(cloneMaterial),sharedDisposals:keptResources.map(r=>disposals.get(r)),pixels:pixelState()};
   return state;
 },
 restoreSelector() {world.addComponent('near',{...base,nodeIndex:2,origin});backend.sync(world);nearObject=object('near');},
 destroy() {
   world.destroyEntity('near'); backend.sync(world);const screen=project(new THREE.Vector3(0,1,4)),hit=backend.pick(screen.x,screen.y);
   const result={detached:!nearObject.parent,models:backend.readStats().models,sceneMeshes:meshes(backend.scene).length,hit,sharedDisposals:keptResources.map(r=>disposals.get(r)),pixels:pixelState()};
   world.destroyEntity('far'); backend.sync(world);result.noPick=backend.pick(screen.x,screen.y);result.backgroundMeshes=meshes(backend.scene).length;result.remainingPixels=pixelState();return result;
 },
 evict() {assets.releaseGroup('scene');backend.sync(world);return {models:backend.readStats().models,sceneMeshes:meshes(backend.scene).length,sharedDisposals:keptResources.map(r=>disposals.get(r)),memory:{...backend.gl.info.memory},pixels:pixelState()};},
 async imported() {
   if(!importedScene) throw new Error('No CPU-baked final GLB was supplied');
   world.destroyEntity('background');
   const pick=importedScene.nodes.find(node=>node.kind==='pick');if(!pick)throw new Error('supplied scene has no pick node');
   const center=pick.bounds.min.map((value,i)=>(value+pick.bounds.max[i])/2);
   const a=new THREE.Vector3(...pick.positions.slice(0,3)),b=new THREE.Vector3(...pick.positions.slice(3,6)),c=new THREE.Vector3(...pick.positions.slice(6,9));
   const normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize();
   world.addComponent('camera',{type:'Camera3D',yaw:Math.atan2(normal.x,normal.z),pitch:Math.asin(normal.y),distance:12,pivotX:center[0],pivotY:center[1],pivotZ:center[2],near:.1,far:100});
   assets.register({kind:'model',key:'imported',src:'fixtures/imported-scene.glb',scene:importedScene});assets.registerGroups({imported:['imported']});
   await assets.preloadGroup('imported');
   const expanded=expandSceneImports({'imported-background':{SceneImport3D:{modelKey:'imported',rules:'default'}}},assets.sceneImportCatalog(['imported']));
   for(const [id,components] of Object.entries(expanded))entity(id,Object.entries(components).map(([type,data])=>({...data,type})));
   for(let i=0;i<1000;i++){backend.sync(world);if(backend.readStats().models===2)break;await new Promise(resolve=>setTimeout(resolve,5));}
   if(backend.readStats().models!==2)throw new Error('supplied real scene decode timeout');
   const selected=object(importedPickId),bounds=new THREE.Box3().setFromObject(selected,true),actual=[...bounds.min.toArray(),...bounds.max.toArray()],expected=[...pick.bounds.min,...pick.bounds.max];
   const boundsError=Math.max(...actual.map((value,i)=>Math.abs(value-expected[i])));
   const positions=[];for(const mesh of meshes(selected)){const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++)positions.push(new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld));}
   let vertexError=0;for(let i=0;i<pick.positions.length;i+=3){const point=new THREE.Vector3(...pick.positions.slice(i,i+3));vertexError=Math.max(vertexError,Math.min(...positions.map(actual=>actual.distanceTo(point))));}
   const point=project(new THREE.Vector3(...center)),hit=backend.pick(point.x,point.y);if(hit)sink.enqueueAction(hit.signal,{arg:hit.arg});
   const result={nodeIndex:pick.index,boundsError,vertexError,actualBounds:actual,expectedBounds:expected,hit,commands:sink.commandsForTick(8),models:backend.readStats().models,selectedMeshes:meshes(selected).length,backgroundMeshes:meshes(object('imported-background')).length,pixels:pixelState()};
   return result;
 },
 importedDestroy() {
   const selected=object(importedPickId);world.destroyEntity(importedPickId);backend.sync(world);
   const result={detached:!selected.parent,pickables:backend.pickables.size,models:backend.readStats().models,backgroundMeshes:meshes(backend.scene).length,pixels:pixelState()};
   return result;
 },
 importedEvict() {assets.releaseGroup('imported');backend.sync(world);return {models:backend.readStats().models,meshes:meshes(backend.scene).length,pixels:pixelState()};},
 dispose() {backend.destroy();}
};
`);
const browser = await chromium.launch({headless:true,executablePath,args:['--no-sandbox']});
const report = {browser:browser.version(),executablePath,fixture:{source:'Apollo authored E5 hierarchy / original CC0 E1 textured cube',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')},importedProvenance,runs:[]};
async function run(server,base,label) {
  const origin='http://127.0.0.1:'+server.httpServer.address().port,context=await browser.newContext(),errors=[],requests=[];
  await context.route('**/*',route=>{const url=route.request().url();if(/^https?:/.test(url)&&new URL(url).origin!==origin){errors.push('external request '+url);return route.abort();}return route.continue();});
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(['error','warning'].includes(message.type()))errors.push(message.type()+': '+message.text());});page.on('request',request=>{if(/^https?:/.test(request.url()))requests.push(new URL(request.url()).pathname);});
  try {
    await page.goto(origin+base);await page.waitForFunction(()=>!!window.e5);
    const loaded=await page.evaluate(()=>window.e5.load());
    assert.equal(loaded.waiting.models,0);assert.equal(loaded.waiting.rendered,false,'pending static frame may skip');assert(loaded.refreshed,'late ready model must force static redraw');assert(loaded.staticSkipped);
    assert(loaded.matrixError<1e-10,'complete ancestor matrix including shear and origin survives selection');assert(loaded.boxError<1e-10,'pick AABB is the actual posed selected model');assert.equal(loaded.backgroundMeshes,1);assert.equal(loaded.nearMeshes,1);assert(loaded.shared);
    assert.deepEqual(loaded.hit,{entityId:'near',signal:'scene.pick',arg:'near'},'nearest Model3D hit preserves signal and entity arg');
    assert.equal(loaded.commands[0].actions[0].key,'scene.pick');assert.equal(loaded.commands[0].actions[0].arg,'near');assert(loaded.pixels.colored>1000,'real textured scene must render nonblank pixels');
    await page.screenshot({path:join(dir,label+'-loaded.png')});
    const selector=await page.evaluate(()=>window.e5.selector());assert(selector.rebuilt&&selector.oldDetached&&selector.rendered,'selector change rebuilds and redraws at identical pose');assert.equal(selector.oldMaterialDisposed,1);assert.deepEqual(selector.sharedDisposals,[0,0,0]);
    await page.screenshot({path:join(dir,label+'-selector.png')});
    await page.evaluate(()=>window.e5.restoreSelector());
    const destroyed=await page.evaluate(()=>window.e5.destroy());assert(destroyed.detached);assert.equal(destroyed.models,2);assert.equal(destroyed.sceneMeshes,2);assert.deepEqual(destroyed.hit,{entityId:'far',signal:'far.pick',arg:'far'});assert.equal(destroyed.noPick,null);assert.equal(destroyed.backgroundMeshes,1);assert.deepEqual(destroyed.sharedDisposals,[0,0,0]);
    await page.screenshot({path:join(dir,label+'-destroyed.png')});
    const evicted=await page.evaluate(()=>window.e5.evict());assert.equal(evicted.models,0);assert.equal(evicted.sceneMeshes,0);assert.deepEqual(evicted.sharedDisposals,[1,1,1]);assert.equal(evicted.memory.geometries,0);assert.equal(evicted.memory.textures,loaded.waiting.textures,'only the preexisting light shadow targets remain');assert.equal(evicted.pixels.colored,0,'no model survives per-key template eviction');
    await page.screenshot({path:join(dir,label+'-evicted.png')});
    let imported=null,importedDestroyed=null,importedEvicted=null;
    if(importedScene){
      imported=await page.evaluate(()=>window.e5.imported());assert(imported.boundsError<.00011,'renderer bounds match CPU-baked final GLB');assert(imported.vertexError<.00015,'renderer and CPU baker agree on the actual world vertices');assert.equal(imported.models,2);assert.equal(imported.selectedMeshes,1);assert(imported.backgroundMeshes>=1);
      const pickId='imported-background/node-'+importedScene.nodes.find(node=>node.kind==='pick').path.join('-');assert.deepEqual(imported.hit,{entityId:pickId,signal:'scene.pick',arg:pickId});assert.equal(imported.commands[0].actions[0].arg,pickId);assert(imported.pixels.colored>100,'real Blender scene must be visible');await page.screenshot({path:join(dir,label+'-imported.png')});
      importedDestroyed=await page.evaluate(()=>window.e5.importedDestroy());assert(importedDestroyed.detached);assert.equal(importedDestroyed.pickables,0);assert.equal(importedDestroyed.models,1);assert.equal(importedDestroyed.backgroundMeshes,imported.backgroundMeshes);assert.notEqual(importedDestroyed.pixels.hash,imported.pixels.hash,'destroying the independent pick subtree must change actual rendered pixels');await page.screenshot({path:join(dir,label+'-imported-destroyed.png')});
      importedEvicted=await page.evaluate(()=>window.e5.importedEvict());assert.equal(importedEvicted.models,0);assert.equal(importedEvicted.meshes,0);assert.equal(importedEvicted.pixels.colored,0);
    }
    await page.evaluate(()=>window.e5.dispose());
    assert(requests.every(path=>path.startsWith(base)),'all requests respect deployment BASE_URL');assert.deepEqual(errors,[]);
    report.runs.push({label,base,loaded,selector,destroyed,evicted,imported,importedDestroyed,importedEvicted,requests,errors});
  } finally {await context.close();}
}
try {
  const config={configFile:false,root:dir,base:'/',publicDir,resolve:{alias:engineAliases(root)},server:{host:'127.0.0.1',port:0,fs:{allow:[root,dir]}},logLevel:'error'};
  const dev=await createServer(config);await dev.listen();try{await run(dev,'/','dev');}finally{await dev.close();}
  const base='/e5-subpath/';await build({...config,base,build:{outDir:join(dir,'dist'),emptyOutDir:true}});
  const built=await preview({...config,base,build:{outDir:join(dir,'dist')},preview:{host:'127.0.0.1',port:0}});try{await run(built,base,'build-subpath');}finally{await new Promise(resolve=>built.httpServer.close(resolve));}
  writeFileSync(join(dir,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({evidence:dir,...report},null,2));
} catch(error) {writeFileSync(join(dir,'report.json'),JSON.stringify({...report,error:String(error.stack||error)},null,2)+'\n');console.error('E5 renderer evidence retained at '+dir);throw error;}
finally {await browser.close();if(report.runs.length===2&&process.env.E5_KEEP_EVIDENCE!=='1')rmSync(dir,{recursive:true,force:true});}
