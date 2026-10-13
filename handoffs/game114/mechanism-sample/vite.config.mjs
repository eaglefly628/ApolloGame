import {defineConfig} from 'vite';
import {engineAliases} from '../../../scripts/engine-aliases.mjs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url));
export default defineConfig({cacheDir:'.vite-cache',resolve:{alias:engineAliases(root)},server:{fs:{allow:[root]}},build:{target:'es2022',outDir:'dist'}});
