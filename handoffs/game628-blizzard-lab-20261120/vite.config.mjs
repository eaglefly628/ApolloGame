import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {engineAliases} from '../../scripts/engine-aliases.mjs';
const root=fileURLToPath(new URL('.',import.meta.url));
export default defineConfig({
 root,publicDir:'public',resolve:{alias:engineAliases(resolve(root,'../..'))},
 server:{host:'127.0.0.1',port:18852,strictPort:true,fs:{allow:[resolve(root,'../..')]}},
 build:{outDir:'dist',emptyOutDir:true},
});
