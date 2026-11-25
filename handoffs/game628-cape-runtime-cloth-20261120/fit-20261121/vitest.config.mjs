import {defineConfig} from 'vitest/config';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {engineAliases} from '../../../scripts/engine-aliases.mjs';
const root=fileURLToPath(new URL('.',import.meta.url));
export default defineConfig({root,resolve:{alias:engineAliases(resolve(root,'../../game628-cape-runtime-engine-20261120/runtime'))},
test:{include:['*.test.ts'],environment:'node',testTimeout:120000}});
