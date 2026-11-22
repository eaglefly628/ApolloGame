import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
import {engineAliases} from '../../scripts/engine-aliases.mjs';
const here = path => fileURLToPath(new URL(path,import.meta.url));
export default defineConfig({
 root: here('./'), publicDir: false, resolve:{alias:engineAliases(here('../../'))},
 build:{outDir:'web',assetsDir:'fade-assets',rollupOptions:{input:[here('./index.html'),here('./prototype/index.html')]}},
});
