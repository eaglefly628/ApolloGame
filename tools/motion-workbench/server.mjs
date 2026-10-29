import {allowLocalPreviewHost} from '../../scripts/lib/local-preview-host.mjs';
// Read-only local workbench. Assets remain behind existing SHA-checked preview handlers.
import {createServer} from 'node:http';
import {readFileSync,realpathSync,statSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {engineAliases} from '../../scripts/engine-aliases.mjs';
import {libraryPath} from '../../scripts/motion-library.mjs';
import {validateCatalog,sha256} from '../../scripts/lib/motion-catalog.mjs';
import {createPreviewServer} from '../../scripts/motion-preview.mjs';
import {createMinkPreviewServer} from '../motion-mink-validation/preview.mjs';
import {buildWorkbenchCatalog,queryWorkbenchCatalog} from './catalog.mjs';
import {buildMatchGirlPlan} from './story-plan.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
function readJson(file){file=realpathSync(file);const info=statSync(file);if(!info.isFile()||info.size>64*1024*1024)throw new Error('workbench JSON exceeds local read budget');const bytes=readFileSync(file);return {value:JSON.parse(bytes),sha256:sha256(bytes)};}
const html=(script,title)=>`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><div id="root"></div><script type="module" src="${script}"></script>`;
export async function createWorkbenchServer({lib,runtimeLib,runtimeReport,previewReport=runtimeReport}){
 lib=libraryPath(lib);runtimeLib=libraryPath(runtimeLib);
 const original=readJson(join(lib,'catalog.json')),runtime=readJson(join(runtimeLib,'catalog.json')),evidence=readJson(runtimeReport),previewEvidence=readJson(previewReport);
 const fullSockets=evidence.value.runtimeSockets,previewSockets=previewEvidence.value.runtimeSockets;
 for(const group of ['bySkin','unsupportedBySkin']){const full=fullSockets?.[group]||{},preview=previewSockets?.[group]||{};if(JSON.stringify(Object.keys(full).sort())!==JSON.stringify(Object.keys(preview).sort()))throw new Error('preview Socket coverage differs from runtime evidence');for(const id of Object.keys(full))for(const field of ['embeddedSkinSha256','clipId','rightChain','leftMoverChain','initialLeftHandWorldM','props','skinBounds','validationStatus','hasEmbeddedBaseMotion'])if(JSON.stringify(full[id][field])!==JSON.stringify(preview[id][field]))throw new Error('preview Socket binding differs from runtime evidence');}
 for(const field of ['status','meshCheck'])if(JSON.stringify(evidence.value[field])!==JSON.stringify(previewEvidence.value[field]))throw new Error('preview technical status differs from runtime evidence');
 const libraryCatalog=validateCatalog(original.value),runtimeCatalog=validateCatalog(runtime.value);
 const catalog=buildWorkbenchCatalog({libraryCatalog,runtimeCatalog,runtimeReport:evidence.value}),story=buildMatchGirlPlan(libraryCatalog);
 const snapshot={libraryCatalogSha256:original.sha256,runtimeCatalogSha256:runtime.sha256,runtimeReportSha256:evidence.sha256,previewReportSha256:previewEvidence.sha256};
 const library=await createPreviewServer(lib),interaction=await createMinkPreviewServer({lib:runtimeLib,report:previewReport});
 const bundle=await build({entryPoints:[join(ROOT,'tools/motion-workbench/client.ts')],bundle:true,write:false,format:'esm',platform:'browser',alias:engineAliases(ROOT)});
 for(const [file,expected] of [[join(lib,'catalog.json'),original.sha256],[join(runtimeLib,'catalog.json'),runtime.sha256],[runtimeReport,evidence.sha256],[previewReport,previewEvidence.sha256]])if(readJson(file).sha256!==expected)throw new Error('workbench source changed during initialization');
 const server=createServer((req,res)=>{
  try{
   if(!allowLocalPreviewHost(req.headers.host,server.address()?.port)){res.writeHead(403).end('local preview host required');return;}
   if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
   const url=new URL(req.url,'http://127.0.0.1');let bytes,type='application/json; charset=utf-8';
   const prefix=url.pathname.startsWith('/library/')?'/library':url.pathname.startsWith('/interaction/')?'/interaction':undefined;
   if(prefix){const path=url.pathname.slice(prefix.length);if(path==='/'){bytes=Buffer.from(html(prefix+'/app.js',prefix==='/library'?'动作库预览':'手部 Socket 交互'));type='text/html; charset=utf-8';}else{const forwarded=Object.create(req);forwarded.url=path+url.search;(prefix==='/library'?library:interaction).emit('request',forwarded,res);return;}}
   else if(url.pathname==='/'){bytes=Buffer.from(html('/app.js','Apollo 动画工作台'));type='text/html; charset=utf-8';}
   else if(url.pathname==='/app.js'){bytes=bundle.outputFiles[0].contents;type='text/javascript';}
   else if(url.pathname==='/summary.json')bytes=Buffer.from(JSON.stringify({schemaVersion:1,counts:catalog.counts,warnings:catalog.warnings,snapshot,storyCounts:story.counts}));
   else if(url.pathname==='/ai-catalog.json')bytes=Buffer.from(JSON.stringify({...catalog,snapshot,story}));
   else if(url.pathname==='/story.json')bytes=Buffer.from(JSON.stringify(story));
   else if(url.pathname==='/entries')bytes=Buffer.from(JSON.stringify(queryWorkbenchCatalog(catalog,{text:url.searchParams.get('text')||'',...(url.searchParams.get('type')?{type:url.searchParams.get('type')}:{}),...(url.searchParams.get('status')?{status:url.searchParams.get('status')}:{}),offset:Number(url.searchParams.get('offset')||0),limit:Number(url.searchParams.get('limit')||50)})));
   else {res.writeHead(404).end();return;}
   res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:bytes);
  }catch(error){console.error('[motion-workbench] reject:',error.message);if(!res.headersSent)res.writeHead(400,{'Content-Type':'application/json'}).end(JSON.stringify({error:'request rejected'}));else res.end();}
 });
 return server;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args={};for(let i=2;i<process.argv.length;i++){const key=process.argv[i];if(!['--lib','--runtime-lib','--runtime-report','--preview-report'].includes(key)||!process.argv[i+1]||Object.hasOwn(args,key))throw new Error('usage: server.mjs --lib path --runtime-lib path --runtime-report path [--preview-report path]');args[key]=process.argv[++i];}
 if(!['--lib','--runtime-lib','--runtime-report'].every(key=>args[key]))throw new Error('workbench requires explicit local libraries and report');
 const server=await createWorkbenchServer({lib:args['--lib'],runtimeLib:args['--runtime-lib'],runtimeReport:args['--runtime-report'],previewReport:args['--preview-report']});server.listen(0,'127.0.0.1',()=>console.log('http://127.0.0.1:'+server.address().port));
}
