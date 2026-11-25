import {defineConfig} from 'vitest/config';
import {fileURLToPath} from 'node:url';
import {engineAliases} from '../../scripts/engine-aliases.mjs';

export default defineConfig({
 root: fileURLToPath(new URL('.', import.meta.url)),
 resolve: {alias: engineAliases(fileURLToPath(new URL('../..', import.meta.url)))},
 test: {include: ['integration.test.ts'], environment: 'node'},
});
