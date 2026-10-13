import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
const dirs = {
  engine: 'src/engine', skills: 'src/skills', 'atom-skills': 'src/skills/atoms',
  ui: 'src/ui', renderer: 'src/renderer', assets: 'src/assets', runtime: 'src/runtime',
  assembly: 'src/assembly', services: 'src/services', net: 'src/net',
};
const alias = {};
for (const [name, dir] of Object.entries(dirs)) {
  alias[`@zerocraft/engine/${name}`] = resolve(root, dir);
  alias[`@${name}`] = resolve(root, dir);
}

export default defineConfig({
  root: resolve(root, 'demo'),
  cacheDir: resolve(root, '.vite-cache'),
  resolve: { alias },
  server: { host: '127.0.0.1', port: 5187 },
  build: { target: 'es2022', outDir: resolve(root, 'dist'), emptyOutDir: true },
});
