// Game112 cat-toy prompt planner. Generated candidate images are local-only in
// art-local/game112/cat-toys/masters; this script never stages them into Git.
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const catalogFile = join(root, 'assets/curated/game112-cat-toys.v1.json');
const catalog = JSON.parse(readFileSync(catalogFile, 'utf8'));
const all = catalog.families.flatMap((family) => family.items.map(([id, name, look]) => ({ id, name, look, family: family.name })));
const byNumber = new Map(all.map((it) => [Number(it.id.slice(1)), it]));

export function promptFor(it) {
  return [
    'Use case: product-mockup. Asset type: one reusable Apollo Game112 cat-toy inventory cutout.',
    `Subject: ${it.name} (${it.family}); ${it.look}.`,
    'One complete cat-scale handmade object only. If it has connected parts, show the complete assembled item; no separate duplicate parts.',
    'Match the approved T001–T010 collection: tactile painterly storybook game prop, natural wood, cork, rattan, felt, linen or cardboard as described; subtle wear, imperfect hand stitching and brushwork, warm gentle light, muted amber, cream, teal, coral, sage and night blue only where appropriate.',
    'Center the whole object with a readable silhouette and safe margin. Choose a three-quarter product view appropriate to its shape, not a flat symbol.',
    'Genuinely transparent PNG alpha cutout. No floor, backdrop, vignette, glow halo, cast scene, cat, person, text, logo, watermark, packaging, extra toy or unrelated decoration.',
  ].join(' ');
}

function range() {
  const [, , mode, startRaw, endRaw] = process.argv;
  const start = Number(startRaw), end = Number(endRaw);
  if (mode !== 'plan' || !Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end > 100 || start > end) {
    throw new Error('usage: node scripts/game112-toy-batch.mjs plan <1..100> <1..100>');
  }
  return { start, end };
}

const { start, end } = range();
const selected = Array.from({ length: end - start + 1 }, (_, i) => byNumber.get(start + i));
if (selected.some((it) => !it)) throw new Error('catalog has a missing T-number');
process.stdout.write(`${JSON.stringify(selected.map((it) => ({ id: it.id, prompt: promptFor(it) })))}\n`);
