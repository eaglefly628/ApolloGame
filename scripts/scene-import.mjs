#!/usr/bin/env node
// Writes only a reviewable spec.scene candidate. Never updates indexes or approval.
import { readFileSync, writeFileSync, mkdirSync, realpathSync, existsSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Console } from 'node:console';
import { fileURLToPath } from 'node:url';
import { bakeSceneImport } from './lib/scene-geometry.mjs';
export { bakeSceneImport } from './lib/scene-geometry.mjs';
// Keep machine stdout to one JSON value while preserving console log levels.
const log = new Console({ stdout: process.stderr, stderr: process.stderr });

export async function importScene(file, { out } = {}) {
  if (typeof file !== 'string' || !file) throw new Error('Scene import reject: input GLB path required');
  if (out !== undefined && (typeof out !== 'string' || !out)) throw new Error('Scene import reject: output JSON path required');
  if (out !== undefined && (resolve(file) === resolve(out) || (existsSync(out) && realpathSync(file) === realpathSync(out)))) throw new Error('Scene import reject: output must not overwrite source GLB');
  if (out !== undefined && existsSync(out)) { const input = statSync(file), output = statSync(out); if (input.dev === output.dev && input.ino === output.ino) throw new Error('Scene import reject: output must not overwrite source GLB hardlink'); }
  const candidate = await bakeSceneImport(readFileSync(file));
  if (out !== undefined) { mkdirSync(dirname(resolve(out)), { recursive: true }); writeFileSync(out, `${JSON.stringify(candidate, null, 2)}\n`); log.info(`[scene-import] commit candidate ${resolve(out)} sha256=${candidate.sourceSha256} nodes=${candidate.nodes.length}`); }
  return candidate;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 3 || args[1] !== '--out' || args[0].startsWith('--') || args[2].startsWith('--')) throw new Error('Usage: node scripts/scene-import.mjs <final.glb> --out <scene.json>');
    const candidate = await importScene(args[0], { out: args[2] });
    console.log(JSON.stringify({ out: resolve(args[2]), sourceSha256: candidate.sourceSha256, nodes: candidate.nodes.length }));
  } catch (error) { log.error(`[scene-import] reject ${error.message}`); process.exitCode = 1; }
}
