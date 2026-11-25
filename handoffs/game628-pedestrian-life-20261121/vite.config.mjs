import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { engineAliases } from '../../scripts/engine-aliases.mjs';

const root = fileURLToPath(new URL('./', import.meta.url));
const repo = fileURLToPath(new URL('../../', import.meta.url));
export default defineConfig({
  root, publicDir: false, resolve: { alias: engineAliases(repo) },
  build: { outDir: 'web', emptyOutDir: true },
  test: { include: ['*.test.ts'] },
});
