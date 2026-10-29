import {libraryPath} from '../../scripts/motion-library.mjs';
import {sha256,validateCatalog} from '../../scripts/lib/motion-catalog.mjs';
import {buildEmbeddedPreview} from './embedded-motion.mjs';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { resolve, dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { createPreviewServer } from '../../scripts/motion-preview.mjs';
import { engineAliases } from '../../scripts/engine-aliases.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
/** Uses the existing read-only, SHA-checked asset handler; report path is fixed at startup. */
export async function createMinkPreviewServer({lib,report}) {
  if(typeof lib!=='string'||!lib||typeof report!=='string'||!report)throw new Error('Mink preview requires --lib and --report');
  lib=libraryPath(lib);
  const catalog=validateCatalog(JSON.parse(readFileSync(join(lib,'catalog.json'),'utf8'))),prepared=new Map(),pending=new Map();let preparation=Promise.resolve();
  const checkedBytes=row=>{const file=realpathSync(resolve(lib,row.file));if(!file.startsWith(lib+sep)||!statSync(file).isFile())throw new Error('asset escapes preview library');const bytes=readFileSync(file);if(sha256(bytes)!==row.sha256)throw new Error('asset SHA mismatch');return bytes;};
  const reportPath=realpathSync(resolve(report)),info=statSync(reportPath);
  if(!info.isFile()||info.size>1024*1024)throw new Error('validation report must be a regular JSON file <= 1 MiB');
  const data=JSON.parse(readFileSync(reportPath,'utf8'));
  if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('validation report requires an object');
  const reportBytes=Buffer.from(JSON.stringify(data));
  async function embeddedSkin(skin){if(data.runtimeSockets?.bySkin?.[skin.id]||data.runtimeSockets?.unsupportedBySkin?.[skin.id]?.hasEmbeddedBaseMotion)return checkedBytes(skin);if(prepared.has(skin.id)){const bytes=prepared.get(skin.id);prepared.delete(skin.id);prepared.set(skin.id,bytes);return bytes;}if(pending.has(skin.id))return pending.get(skin.id);if(pending.size>=4)throw new Error('preview preparation queue full');const clipId=data.runtimeSockets?.bySkin?.[skin.id]?.clipId,clip=clipId?catalog.clips.find(c=>c.id===clipId):(catalog.clips.length===1?catalog.clips[0]:undefined);if(!clip)throw new Error('selected Skin has no preview clip');const request=preparation.then(()=>buildEmbeddedPreview(checkedBytes(skin),checkedBytes(clip),clip)).then(bytes=>{prepared.set(skin.id,bytes);while(prepared.size>2)prepared.delete(prepared.keys().next().value);return bytes;}).finally(()=>pending.delete(skin.id));pending.set(skin.id,request);preparation=request.catch(()=>undefined);return request;}
  const bundle=await build({entryPoints:[join(ROOT,'tools/motion-mink-validation/preview.ts')],bundle:true,write:false,format:'esm',platform:'browser',alias:engineAliases(ROOT)});
  const server=await createPreviewServer(lib),handlers=server.listeners('request');
  if(handlers.length!==1)throw new Error('unexpected preview request handler count');
  server.removeAllListeners('request');
  server.on('request',async(req,res)=>{
    const path=(req.url||'').split('?')[0];
    if(path.startsWith('/embedded-skin/')){if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}const skin=catalog.skins.find(row=>path==='/embedded-skin/'+row.id);if(!skin){res.writeHead(404).end();return;}try{const bytes=await embeddedSkin(skin);if(res.destroyed)return;res.writeHead(200,{'Content-Type':'model/gltf-binary','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:bytes);}catch(error){console.error('[motion-mink-preview] reject:',error.message);if(!res.destroyed)res.writeHead(409).end('preview preparation failed');}return;}
    if(path!=='/app.js'&&path!=='/validation.json'){handlers[0].call(server,req,res);return;}
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
    const bytes=path==='/app.js'?bundle.outputFiles[0].contents:reportBytes;
    res.writeHead(200,{'Content-Type':path==='/app.js'?'text/javascript; charset=utf-8':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    res.end(req.method==='HEAD'?undefined:bytes);
  });
  return server;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2),options={};
  for(let i=0;i<args.length;i++){const key=args[i];if(!['--lib','--report'].includes(key)||i+1>=args.length||Object.hasOwn(options,key))throw new Error('usage: preview.mjs --lib review-library --report validation.json');options[key]=args[++i];}
  const server=await createMinkPreviewServer({lib:options['--lib'],report:options['--report']});
  server.listen(0,'127.0.0.1',()=>console.log(`[motion-mink-validation] http://127.0.0.1:${server.address().port}`));
}
