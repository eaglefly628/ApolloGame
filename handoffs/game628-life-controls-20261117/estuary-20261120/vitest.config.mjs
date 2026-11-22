import {defineConfig} from 'vitest/config';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {engineAliases} from '../../../scripts/engine-aliases.mjs';
const root=fileURLToPath(new URL('.',import.meta.url));
export default defineConfig({root,resolve:{alias:engineAliases(resolve(root,'../../..'))},test:{include:['estuary.test.ts'],environment:'node'}});
