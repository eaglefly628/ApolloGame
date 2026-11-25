import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {engineAliases} from '../../scripts/engine-aliases.mjs';
const root=fileURLToPath(new URL('.',import.meta.url));
const repo=resolve(root,'../..');
export default defineConfig({root,publicDir:'public',resolve:{alias:engineAliases(repo)},server:{host:'127.0.0.1',port:18830,strictPort:true,fs:{allow:[repo]}},build:{outDir:'dist',emptyOutDir:true}});
