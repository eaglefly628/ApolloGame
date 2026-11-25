import {defineConfig} from 'vitest/config';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {engineAliases} from '../../../scripts/engine-aliases.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
export default defineConfig({root,resolve:{alias:engineAliases(resolve(root,'../..'))},test:{include:['review-crowd.test.ts','prototype.test.ts','reference-review.test.ts','face-studio-20261120/face.test.ts','crowd-prototype-20261120/crowd.test.ts'],environment:'node',testTimeout:180000}});
