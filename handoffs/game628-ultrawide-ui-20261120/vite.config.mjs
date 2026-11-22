import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {dirname, extname, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';

const root = dirname(fileURLToPath(import.meta.url));
const prototype = process.env.GAME628_PROTOTYPE_DIST
  ? resolve(process.env.GAME628_PROTOTYPE_DIST)
  : resolve(root, '../game628-life-controls-20261117/dist');
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.gltf':'model/gltf+json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.webp':'image/webp','.wasm':'application/wasm'};
function mountPrototype(server) {
  server.middlewares.use(async (req,res,next) => {
    const path = (req.url ?? '').split('?')[0];
    const artifact = path === '/prototype' ? '/index.html' : path;
    if (!/^\/(art|assets|scenes)\//.test(artifact) && path !== '/prototype') return next();
    const file = resolve(prototype, '.' + artifact);
    if (!file.startsWith(prototype + sep) || !await stat(file).then(x=>x.isFile(),()=>false)) {
      if (path !== '/prototype') return next();
      res.statusCode = 503;
      return res.end('Game 628 local preview build is unavailable.');
    }
    res.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream');
    res.setHeader('Cache-Control','no-store');
    if (req.method === 'HEAD') return res.end();
    createReadStream(file).on('error',()=>res.destroy()).pipe(res);
  });
}
const local = {host:'127.0.0.1',port:18844,strictPort:true};
export default defineConfig({root,server:{...local,fs:{allow:[resolve(root,'../..')]}},preview:local,plugins:[{name:'local-game628-preview',configureServer:mountPrototype,configurePreviewServer:mountPrototype}],build:{assetsDir:'entry-assets'}});
