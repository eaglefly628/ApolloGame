// Read-only loopback D6 scene service. Every exposed byte is selected and SHA-pinned
// at startup; no URL-to-filesystem conversion, uploads or repository asset inputs.
import {createServer} from 'node:http';
import {openSync,closeSync,fstatSync,readFileSync,lstatSync,realpathSync,constants} from 'node:fs';
import {resolve,dirname,join,relative,isAbsolute,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {engineAliases} from '../../scripts/engine-aliases.mjs';
import {libraryPath} from '../../scripts/motion-library.mjs';
import {motionEngine} from '../../scripts/lib/motion-engine.mjs';
import {readLocalPreviewFont} from '../../scripts/lib/local-preview-fonts.mjs';
import {allowLocalPreviewHost} from '../../scripts/lib/local-preview-host.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const hash=b=>createHash('sha256').update(b).digest('hex');
const fail=s=>{throw Error('driver scene: '+s);};
const fields=(o,required,optional=[])=>{if(!o||typeof o!=='object'||Array.isArray(o)||required.some(k=>!Object.hasOwn(o,k))||Object.keys(o).some(k=>!required.includes(k)&&!optional.includes(k)))fail('closed fields');};
const stable=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(v);
const key=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_./:-]{0,127}$/.test(v);
function bounded(file,max){const info=lstatSync(file,{bigint:true});if(!info.isFile()||info.isSymbolicLink()||info.nlink!==1n||info.size<1n||info.size>BigInt(max))fail('file type/link/byte budget');const fd=openSync(file,constants.O_RDONLY|constants.O_NOFOLLOW);try{const a=fstatSync(fd,{bigint:true});if(a.dev!==info.dev||a.ino!==info.ino)fail('file changed before read');const bytes=readFileSync(fd),b=fstatSync(fd,{bigint:true});if(a.size!==b.size||a.mtimeNs!==b.mtimeNs||a.ctimeNs!==b.ctimeNs||BigInt(bytes.length)!==a.size||bytes.length>max)fail('file changed during read');return bytes;}finally{closeSync(fd);}}
function privatePaths(v){if(typeof v==='string'&&(/^(?:https?:|file:|blob:|data:|\/|[A-Za-z]:[\\/])/i.test(v)))fail('manifest/program uses external or absolute source');if(v&&typeof v==='object')for(const[k,x]of Object.entries(v)){if(['src','file','path','url'].includes(k))fail('manifest/program contains direct file route');privatePaths(x);}}
let runtime;
async function validationRuntime(){return runtime??= (async()=>{const bundled=await build({stdin:{contents:"export {Engine} from './src/runtime/engine.ts';export {parseManifest} from './src/assembly/manifest.ts';export {collectAssetRefs} from './src/assembly/derive-asset-index.ts';export {CinematicPreviewSession} from './src/runtime/cinematic-preview.ts';export {validateDriverTree} from './src/engine/protocol/components/animation-driver.ts';export {parseSkeletalAnimationSpec} from './src/assets/skeletal-animation-data.ts';export {snapshotTargetGlb} from './src/engine/host/locomotion-character.ts';",resolveDir:ROOT},bundle:true,absWorkingDir:ROOT,platform:'node',format:'esm',write:false,alias:engineAliases(ROOT),logLevel:'silent'});return import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].contents).toString('base64'));})();}
export async function loadDriverScene(sceneFile){
 const input=resolve(sceneFile),root=libraryPath(realpathSync(dirname(input)));if(lstatSync(input).isSymbolicLink()||realpathSync(input)!==join(root,input.slice(dirname(input).length+1)))fail('scene path alias');
 const source=bounded(input,4*1024*1024),raw=JSON.parse(source),api=await validationRuntime(),native=await motionEngine();api.validateDriverTree(raw);fields(raw,['version','profiles']);if(raw.version!==1||!Array.isArray(raw.profiles)||raw.profiles.length<1||raw.profiles.length>16)fail('profile budget/version');
 const ids=new Set(),files=new Map(),profiles=[];let total=0;
 for(const profile of raw.profiles){fields(profile,['id','label','description','status','manifest','program','assets']);if(!stable(profile.id)||ids.has(profile.id))fail('profile id');ids.add(profile.id);if(profile.status!=='numeric-candidate'||typeof profile.label!=='string'||profile.label.length<1||profile.label.length>128||typeof profile.description!=='string'||profile.description.length>2048)fail('profile label/status');
  privatePaths(profile.manifest);privatePaths(profile.program);if(!Array.isArray(profile.assets)||profile.assets.length<1||profile.assets.length>64)fail('asset budget');const keys=new Set(),assets=[];
  for(const asset of profile.assets){fields(asset,['key','kind','file','sha256'],['fps','frames','loop']);if(!key(asset.key)||keys.has(asset.key)||!['model','skeletal-animation'].includes(asset.kind)||!/^[a-f0-9]{64}$/.test(asset.sha256))fail('asset identity');keys.add(asset.key);if(typeof asset.file!=='string'||asset.file.length>512||isAbsolute(asset.file)||asset.file.includes('\\')||asset.file.split('/').some(p=>!p||p==='.'||p==='..')||!asset.file.endsWith('.glb'))fail('relative GLB file');
   const lexical=join(root,asset.file),canonical=realpathSync(lexical),rel=relative(root,canonical);if(!rel||rel==='..'||rel.startsWith('..'+sep)||isAbsolute(rel))fail('asset escapes scene root');libraryPath(canonical);const bytes=bounded(lexical,64*1024*1024);total+=bytes.length;if(total>256*1024*1024)fail('total asset byte budget');if(hash(bytes)!==asset.sha256)fail('asset SHA mismatch');const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
   let descriptor={key:asset.key,kind:asset.kind,src:'/driver/assets/'+profile.id+'/'+encodeURIComponent(asset.key)+'.glb'};
   if(asset.kind==='skeletal-animation'){const spec=api.parseSkeletalAnimationSpec({skeleton:'apollo-humanoid-v1',fps:asset.fps,frames:asset.frames,loop:asset.loop});native.snapshotSkeletalGlb(buffer);descriptor={...descriptor,...spec};}
   else{if(['fps','frames','loop'].some(k=>Object.hasOwn(asset,k)))fail('model has animation spec');await api.snapshotTargetGlb(buffer);}
   files.set(descriptor.src,{bytes,sha256:asset.sha256});assets.push(descriptor);
  }
  // Reject render-only animation clocks. The preview session owns all actor time.
  for(const row of Object.values(profile.manifest.entities??{}))if(['AnimGraph3D','AnimState3D'].some(k=>Object.hasOwn(row,k)))fail('legacy animation clock in common-clock scene');
  const blueprint=api.parseManifest(profile.manifest),byKey=new Map(profile.assets.map(a=>[a.key,a]));for(const ref of api.collectAssetRefs(blueprint.capabilities,blueprint.entities)){const asset=byKey.get(ref.key);if(!asset||(ref.assetType==='model'?asset.kind!=='model':ref.assetType==='animation'?asset.kind!=='skeletal-animation':true))fail('missing/incompatible scene asset');}for(const row of Object.values(profile.manifest.entities??{})){if(row.Model3D&&byKey.get(row.Model3D.modelKey)?.kind!=='model')fail('model asset kind mismatch');if(row.AnimationDriver3D?.graph?.clips)for(const clip of Object.values(row.AnimationDriver3D.graph.clips))if(clip.asset&&byKey.get(clip.asset)?.kind!=='skeletal-animation')fail('base animation asset kind mismatch');for(const clips of [row.AnimationPerformance3D?.clips,row.LocomotionDriver3D?.clips])if(clips)for(const clip of Object.values(clips))if(byKey.get(clip.asset)?.kind!=='skeletal-animation'||byKey.get(clip.asset)?.sha256!==clip.sourceSha256)fail('motion declaration SHA/kind mismatch');const rootMotion=row.RootMotion3D,source=row.RootMotionSource3D;if(rootMotion&&source){const clip=source.driver.kind==='animation-driver'?row.AnimationDriver3D?.graph?.clips?.[source.driver.clip]:row.AnimationPerformance3D?.clips?.[source.driver.clip];if(!clip||byKey.get(clip.asset)?.sha256!==rootMotion.inPlaceClipSha256)fail('root removed-pair SHA mismatch');}}const engine=new api.Engine({tickRate:profile.program.tickRate});engine.load(blueprint);const session=new api.CinematicPreviewSession(engine,profile.program);session.seek(0);engine.stop();
  profiles.push({id:profile.id,label:profile.label,description:profile.description,status:profile.status,manifest:profile.manifest,program:profile.program,assets});
 }
 if(hash(bounded(input,4*1024*1024))!==hash(source))fail('scene changed during initialization');return{publicScene:{version:1,profiles},files};
}
export async function createDriverHandler({driverScene}){
 const scene=await loadDriverScene(driverScene);const bundle=await build({entryPoints:[join(ROOT,'tools/motion-workbench/driver-client.ts')],bundle:true,absWorkingDir:ROOT,platform:'browser',format:'esm',write:false,alias:engineAliases(ROOT),define:{'import.meta.env':'{"BASE_URL":"/","DEV":false}'},logLevel:'silent'});
 const html=Buffer.from('<!doctype html><html lang="zh-CN" data-motion-driver="true"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Apollo · 影视动画导演台</title><div id="root"></div><script type="module" src="/driver/app.js"></script></html>');
 return function driverHandler(req,res,port){try{
  if((req.socket?.remoteAddress&&!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress))||!allowLocalPreviewHost(req.headers.host,port)){res.writeHead(403).end('local preview host required');return;}
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}const url=new URL(req.url,'http://127.0.0.1');if(url.search||url.hash||!req.url.startsWith('/')||req.url.startsWith('//')){res.writeHead(404).end();return;}
  if(url.pathname==='/favicon.ico'){res.writeHead(204,{'Cache-Control':'no-store'}).end();return;}
  let bytes,type='application/json; charset=utf-8';
  if(url.pathname==='/'||url.pathname==='/driver/'||url.pathname==='/driver'){bytes=html;type='text/html; charset=utf-8';}
  else if(url.pathname==='/driver/app.js'){bytes=bundle.outputFiles[0].contents;type='text/javascript; charset=utf-8';}
  else if(url.pathname==='/driver/profiles.json')bytes=Buffer.from(JSON.stringify(scene.publicScene));
  else if(scene.files.has(url.pathname)){bytes=scene.files.get(url.pathname).bytes;type='model/gltf-binary';}
  else{bytes=readLocalPreviewFont(ROOT,url.pathname);if(bytes)type='font/woff2';else{res.writeHead(404).end();return;}}
  res.writeHead(200,{'Content-Type':type,'Content-Length':String(bytes.length),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self' data: blob:; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self' data: blob:; worker-src 'self' blob:"});res.end(req.method==='HEAD'?undefined:bytes);
 }catch{if(!res.headersSent)res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'driver request rejected'}));}};
}
export async function createDriverServer(options){const handler=await createDriverHandler(options);const server=createServer((req,res)=>handler(req,res,server.address()?.port));return server;}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){if(process.argv.length!==4||process.argv[2]!=='--driver-scene')throw Error('usage: driver-server.mjs --driver-scene external-scene.json');const server=await createDriverServer({driverScene:process.argv[3]});server.listen(0,'127.0.0.1',()=>console.log('http://127.0.0.1:'+server.address().port+'/driver/'));}
