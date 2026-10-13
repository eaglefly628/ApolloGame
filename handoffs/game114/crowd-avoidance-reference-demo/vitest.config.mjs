import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import base from './vite.config.mjs';

export default defineConfig({
  ...base,
  root: fileURLToPath(new URL('.', import.meta.url)),
  test: { include: ['demo/**/*.test.ts', 'src/**/*.test.ts'] },
});
