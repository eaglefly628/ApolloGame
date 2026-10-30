import {readLocalPreviewFont} from './lib/local-preview-fonts.mjs';
import {allowLocalPreviewHost} from './lib/local-preview-host.mjs';
import { createServer } from 'node:http';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { resolve, dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { build } from 'esbuild';
import { libraryPath } from './motion-library.mjs';
import { validateCatalog, sha256 } from './lib/motion-catalog.mjs';
import { inspectCharacterGlb } from './lib/character-glb.mjs';
import { engineAliases } from './engine-aliases.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export async function createPreviewServer(lib) {
  lib=libraryPath(lib);
  const catalogPath=realpathSync(join(lib,'catalog.json'));
  if(!catalogPath.startsWith(lib+sep)||!statSync(catalogPath).isFile())throw new Error('catalog escapes library or is not a file');
  const catalog=validateCatalog(JSON.parse(readFileSync(catalogPath,'utf8')));
  const files=new Map([...catalog.skins,...catalog.clips].map(row=>['/assets/'+row.file,row]));
  const skinBounds=new Map(catalog.skins.map(row=>['/skin-bounds/'+row.id,row]));
  const boundsCache=new Map();
  function checkedBytes(row) {
    const path=realpathSync(resolve(lib,row.file));
    if(!path.startsWith(lib+sep)||!statSync(path).isFile())throw new Error('asset escapes library or is not a file');
    const bytes=readFileSync(path);if(sha256(bytes)!==row.sha256)throw new Error('asset SHA mismatch');return bytes;
  }
  const bundle=await build({entryPoints:[join(ROOT,'tools/motion-preview/client.ts')],bundle:true,write:false,format:'esm',platform:'browser',alias:engineAliases(ROOT)});
  const server=createServer((req,res)=>{
    try {
      if(!allowLocalPreviewHost(req.headers.host,server.address()?.port)){res.writeHead(403).end('local preview host required');return;}
      if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
      const url=req.url.split('?')[0];let bytes,type;const font=readLocalPreviewFont(ROOT,url);
      if(url==='/') {bytes=Buffer.from('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>动作预览台</title><div id="root"></div><script type="module" src="/app.js"></script>');type='text/html; charset=utf-8';}
      else if(url==='/app.js'){bytes=bundle.outputFiles[0].contents;type='text/javascript';}
      else if(font){bytes=font;type='font/woff2';}
      else if(url==='/catalog.json'){bytes=Buffer.from(JSON.stringify(catalog));type='application/json';}
      else if(skinBounds.has(url)) {
        const row=skinBounds.get(url),asset=checkedBytes(row),key=row.id+':'+row.sha256;
        if(!boundsCache.has(key))boundsCache.set(key,inspectCharacterGlb(asset,{allowSkinMaterialExtensions:true}).bounds);
        bytes=Buffer.from(JSON.stringify({id:row.id,sha256:row.sha256,bounds:boundsCache.get(key)}));type='application/json';
      }
      else {
        const row=files.get(url);if(!row){res.writeHead(404).end();return;}
        bytes=checkedBytes(row);type='model/gltf-binary';
      }
      res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:bytes);
    }catch(error){console.error('[motion-preview] reject:',error.message);res.writeHead(409).end('asset rejected');}
  });
  return server;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2),options={};
  for(let i=0;i<args.length;i++){const key=args[i];if(!['--lib','--compose-candidate'].includes(key)||i+1>=args.length||Object.hasOwn(options,key))throw new Error('usage: motion-preview.mjs [--lib external-library] [--compose-candidate evidence.json]');options[key]=args[++i];}
  let lib=options['--lib']||join(homedir(),'ApolloAssets/motion-lib');
  if(options['--compose-candidate'])lib=(await (await import('./lib/motion-compose-preview.mjs')).prepareComposePreview({lib,evidenceFile:options['--compose-candidate']})).previewLib;
  const server=await createPreviewServer(lib);
  server.listen(0,'127.0.0.1',()=>console.log(`[motion-preview] http://127.0.0.1:${server.address().port}`));
}
