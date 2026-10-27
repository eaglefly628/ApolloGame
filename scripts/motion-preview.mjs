import { createServer } from 'node:http';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { resolve, dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { build } from 'esbuild';
import { libraryPath } from './motion-library.mjs';
import { validateCatalog, sha256 } from './lib/motion-catalog.mjs';
import { engineAliases } from './engine-aliases.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export async function createPreviewServer(lib) {
  lib=libraryPath(lib);
  const catalogPath=realpathSync(join(lib,'catalog.json'));
  if(!catalogPath.startsWith(lib+sep)||!statSync(catalogPath).isFile())throw new Error('catalog escapes library or is not a file');
  const catalog=validateCatalog(JSON.parse(readFileSync(catalogPath,'utf8')));
  const files=new Map([...catalog.skins,...catalog.clips].map(row=>['/assets/'+row.file,row]));
  const bundle=await build({entryPoints:[join(ROOT,'tools/motion-preview/client.ts')],bundle:true,write:false,format:'esm',platform:'browser',alias:engineAliases(ROOT)});
  const server=createServer((req,res)=>{
    try {
      if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
      const url=req.url.split('?')[0];let bytes,type;
      if(url==='/') {bytes=Buffer.from('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>动作预览台</title><div id="root"></div><script type="module" src="/app.js"></script>');type='text/html; charset=utf-8';}
      else if(url==='/app.js'){bytes=bundle.outputFiles[0].contents;type='text/javascript';}
      else if(url==='/catalog.json'){bytes=Buffer.from(JSON.stringify(catalog));type='application/json';}
      else {
        const row=files.get(url);if(!row){res.writeHead(404).end();return;}
        const path=realpathSync(resolve(lib,row.file));if(!path.startsWith(lib+sep)||!statSync(path).isFile())throw new Error('asset escapes library or is not a file');
        bytes=readFileSync(path);if(sha256(bytes)!==row.sha256)throw new Error('asset SHA mismatch');type='model/gltf-binary';
      }
      res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:bytes);
    }catch(error){console.error('[motion-preview] reject:',error.message);res.writeHead(409).end('asset rejected');}
  });
  return server;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2);if(args.length&&!(args.length===2&&args[0]==='--lib'))throw new Error('usage: motion-preview.mjs [--lib external-library]');
  const server=await createPreviewServer(args[1]||join(homedir(),'ApolloAssets/motion-lib'));
  server.listen(0,'127.0.0.1',()=>console.log(`[motion-preview] http://127.0.0.1:${server.address().port}`));
}
