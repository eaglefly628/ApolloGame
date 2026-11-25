import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {engineAliases} from '../../scripts/engine-aliases.mjs';
const root = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({root, resolve: {alias: engineAliases(resolve(root, 'runtime'))},
  server: {host: '127.0.0.1', port: 18847, strictPort: true, fs: {allow: [root]}},
  build: {outDir: 'dist', emptyOutDir: true},
  test: {include: ['interaction.test.ts', 'independent-review.test.ts'], environment: 'node'},
});
