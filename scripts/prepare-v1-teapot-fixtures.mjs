#!/usr/bin/env node
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareV1TeapotFixtures } from './lib/v1-teapot-fixtures.mjs';
export { prepareV1TeapotFixtures, createV1KettleFixture } from './lib/v1-teapot-fixtures.mjs';

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), options = {}, fields = { '--out': 'outDir', '--character-dir': 'characterDir', '--scene-glb': 'sceneGlb', '--scene-data': 'sceneData', '--kettle-glb': 'kettleGlb' };
    for (let i = 0; i < args.length; i += 2) {
      const field = fields[args[i]];
      if (!field || !args[i + 1] || args[i + 1].startsWith('--') || options[field]) throw new Error('Usage: --out DIR --character-dir DIR --scene-glb FILE --scene-data FILE [--kettle-glb FILE]');
      options[field] = args[i + 1];
    }
    const result = await prepareV1TeapotFixtures(options); console.log(JSON.stringify({ outDir: result.outDir, handleLocal: result.metadata.kettle.handleLocal, productionApproved: false }));
  } catch (error) { console.error(`[v1-fixtures] reject ${error.message}`); process.exitCode = 1; }
}
