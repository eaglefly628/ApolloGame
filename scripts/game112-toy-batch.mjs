// Game112 cat-toy art authoring helper. Generates prompts and stages existing
// imagegen PNGs for human review; never calls a model or approves assets.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const catalogFile = join(root, 'assets/curated/game112-cat-toys.v1.json');
const pendingFile = join(root, 'assets/ai/pending.json');
const imageDir = join(root, 'assets/ai/pending');
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
  if (!['plan', 'stage'].includes(mode) || !Number.isInteger(start) || !Number.isInteger(end) || start < 11 || end > 100 || start > end) {
    throw new Error('usage: node scripts/game112-toy-batch.mjs <plan|stage> <11..100> <11..100>');
  }
  return { mode, start, end };
}

function pngInfo(file) {
  const b = readFileSync(file);
  if (b.length < 26 || b.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error(`not PNG: ${file}`);
  const width = b.readUInt32BE(16), height = b.readUInt32BE(20), colorType = b[25];
  if (width < 64 || height < 64 || colorType !== 6) throw new Error(`not an RGBA cutout: ${file}`);
  return { width, height };
}

function entryFor(it) {
  const n = it.id.slice(1);
  const stem = `openai-built-in-game112-cat-toy-${n}`;
  const pendingName = `${stem}.png`;
  const { width, height } = pngInfo(join(imageDir, pendingName));
  return {
    id: `ai/openai-built-in/game112-cat-toy-${n}`,
    type: 'texture', status: 'filled',
    description: `${it.name} · 星尾馆猫用物件 · AI 生成，待审`,
    path: `ai/openai-built-in/game112-cat-toy-${n}.png`, category: 'ai-gen',
    tags: ['ai-gen', 'cat-toy', 'game112-storybook', it.family, it.id],
    license: 'OpenAI Terms of Use (output ownership as between user and OpenAI); release review required',
    source: 'ai:openai-built-in',
    spec: { format: 'png', width, height, usage: 'sprite', colorSpace: 'srgb' },
    provenance: {
      generator: 'openai-built-in', prompt: promptFor(it),
      model: 'OpenAI built-in image_gen (model ID not exposed)', mock: false,
      generatedAt: new Date().toISOString().slice(0, 10),
    },
    previewPath: `/assets/ai/pending/${pendingName}`, pendingFile: pendingName,
    finalRel: `ai/openai-built-in/game112-cat-toy-${n}.png`, scope: 'shelf',
  };
}

const { mode, start, end } = range();
const selected = Array.from({ length: end - start + 1 }, (_, i) => byNumber.get(start + i));
if (selected.some((it) => !it)) throw new Error('catalog has a missing T-number');
if (mode === 'plan') {
  process.stdout.write(`${JSON.stringify(selected.map((it) => ({ id: it.id, prompt: promptFor(it) })))}\n`);
} else {
  if (!existsSync(pendingFile)) throw new Error('shared pending manifest is missing');
  const manifest = JSON.parse(readFileSync(pendingFile, 'utf8'));
  const byId = new Map(manifest.pending.map((e) => [e.id, e]));
  for (const it of selected) {
    const entry = entryFor(it);
    if (byId.has(entry.id)) throw new Error(`already staged: ${entry.id}`);
    byId.set(entry.id, entry);
  }
  manifest.pending = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
  writeFileSync(pendingFile, `${JSON.stringify(manifest, null, 2)}\n`);
  const pendingNumbers = new Set(manifest.pending.flatMap((e) => e.tags.filter((tag) => /^T\d{3}$/.test(tag))));
  catalog.artStatus.pendingReview = all.map((it) => it.id).filter((id) => pendingNumbers.has(id));
  catalog.artStatus.conceptOnly = all.map((it) => it.id).filter((id) => !pendingNumbers.has(id));
  writeFileSync(catalogFile, `${JSON.stringify(catalog, null, 2)}\n`);
  process.stdout.write(`staged ${selected[0].id}–${selected.at(-1).id}; pending total ${manifest.pending.length}\n`);
}
