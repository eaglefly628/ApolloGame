// Authoring queue only. No gameplay, DOM, image generation calls, or sim writes.
import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { decodePng } from './asset-matte.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const argv = process.argv.slice(2);
let specPath = 'games/game112/native-cat-production.v1.json';
if (argv[0] === '--spec') {
  argv.shift(); specPath = argv.shift();
  if (typeof specPath !== 'string' || !/^games\/game112\/native-cat-production\.v[1-9][0-9]*\.json$/.test(specPath)) throw new Error('Expected a Game112 versioned production spec');
}
const spec = JSON.parse(await readFile(path.join(root, specPath), 'utf8'));
const catalog = JSON.parse(await readFile(path.join(root, spec.catalog), 'utf8'));
const output = path.join(root, spec.output);
const jobId = (cat, part) => `${cat}/${part}`;
const safeId = value => typeof value === 'string' && /^[a-z0-9-]+$/.test(value);
const valid = value => { if (!safeId(value)) throw new Error(`Invalid identifier: ${value}`); return value; };
if (path.resolve(output) !== path.join(root, 'art-local/game112/native-character')) throw new Error('Production output must remain in the ignored local cat art directory');
const namespace = spec.version === 2 ? valid(spec.revision) : null;
const queueFile = path.join(output, namespace ? `queue.${namespace}.json` : 'queue.json');
const catOutput = cat => path.join(output, valid(cat), ...(namespace ? [namespace] : []));
const readQueue = async () => JSON.parse(await readFile(queueFile, 'utf8'));
const save = async q => writeFile(queueFile, JSON.stringify(q, null, 2) + '\n');

const masterPrompt = breed => `Use case: stylized-concept. Identity master for ${breed.zh} (${breed.en}), a recognisable representative of this exact cat breed/variety. ${spec.style} ${spec.pose} Preserve this breed's characteristic head profile, ear form, body proportions, coat texture/length, markings, eye colour and tail type; do not merely recolour the Ragdoll reference. A healthy ordinary adult cat, no clothing or props. ${namespace ? 'This neutral master anchors source-aligned layers and hidden-region completion.' : 'This image will anchor separately generated anatomical layers.'} Style reference controls rendering only, not breed anatomy.`;
const partPrompt = (breed, part) => namespace
  ? `Use case: identity-preserve. Source-anchored layer candidate for ${breed.zh} (${breed.en}). ${spec.style} ${spec.method} Target region: ${part.request}. Use this cat's neutral master; keep its exact rest pose, orientation, proportions, markings and lighting. Keep original canvas coordinates and transparent margins, do not centre or enlarge the part. Complete hidden connections in matching fur/skin only where needed. Transparent RGBA, no text, guides, extra anatomy or baked checkerboard. Reference-edit fidelity remains pending until compared with the master; do not claim original pixel preservation.`
  : `Use case: identity-preserve. An independently generated anatomical layer for ${breed.zh} (${breed.en}). The supplied cat identity master fixes this individual cat's exact anatomy, pose, coat pattern, colours and lighting. ${spec.style} ${spec.method} Generate ONLY this component: ${part.request} Detached component centred with generous margins on genuine transparent background. Do not output a whole cat, extra anatomy, labels, ground shadow or a baked checkerboard.`;
const jobsFor = breed => [
  { id: jobId(breed.id, 'master'), catId: breed.id, part: 'master', breed, prompt: masterPrompt(breed), state: 'pending' },
  ...spec.parts.map(part => ({ id: jobId(breed.id, part.id), catId: breed.id, part: part.id, breed, prompt: partPrompt(breed, part), state: 'pending' })),
];
const candidates = q => q.jobs.filter(j => j.state === 'generated');
const summary = q => ({ breeds: q.breeds.length, jobs: q.jobs.length, generated: candidates(q).length, pending: q.jobs.filter(j => j.state === 'pending').length, masters: candidates(q).filter(j => j.part === 'master').length, fullyGeneratedCats: q.breeds.filter(b => q.jobs.filter(j => j.catId === b.id).every(j => j.state === 'generated')).map(b => b.id), modelReady: q.breeds.filter(b => b.modelStatus === 'validated-candidate').map(b => b.id) });

const [command = 'summary', arg, source, requestFlag, requestPath, ...extra] = argv;
if (extra.length || (requestFlag && (requestFlag !== '--request' || !requestPath || !['record', 'revise'].includes(command)))) throw new Error('Optional --request <generation-request.json> is only for record/revise');
if (command === 'init') {
  let q;
  try { q = await readQueue(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!q) {
    q = { version: 1, ...(namespace ? { productionVersion: spec.version, revision: namespace } : {}), createdAt: new Date().toISOString(), scope: spec.scope, output, breeds: catalog.breeds, jobs: catalog.breeds.flatMap(jobsFor) };
    await mkdir(output, { recursive: true });
    await save(q);
  }
  console.log(JSON.stringify(summary(q), null, 2));
} else if (command === 'next') {
  const q = await readQueue();
  const count = Math.min(12, Math.max(1, Number(arg ?? 4)));
  if (!Number.isInteger(count)) throw new Error('Count must be an integer');
  // Complete the prototype first; then cover all breed masters before layers.
  const masterSet = new Set(candidates(q).filter(j => j.part === 'master').map(j => j.catId));
  const ready = q.jobs.filter(j => j.state === 'pending' && (j.part === 'master' || masterSet.has(j.catId)));
  ready.sort((a, b) => {
    const rank = j => j.catId === 'ragdoll' ? 0 : j.part === 'master' ? 1 : 2;
    return rank(a) - rank(b) || q.jobs.indexOf(a) - q.jobs.indexOf(b);
  });
  const baselineReady = q.breeds.find(b => b.id === 'ragdoll')?.modelStatus === 'validated-candidate';
  const gated = namespace && !baselineReady ? ready.filter(j => j.catId === 'ragdoll') : ready;
  console.log(JSON.stringify(gated.slice(0, count).map(j => ({ ...j, destination: path.join(catOutput(j.catId), `${j.part}.png`), reference: j.part === 'master' ? path.join(output, 'xuetuan-v1/master.png') : path.join(catOutput(j.catId), 'master.png') })), null, 2));
} else if (command === 'record' || command === 'revise') {
  const q = await readQueue();
  const job = q.jobs.find(j => j.id === arg);
  if (!job || !source) throw new Error('record needs an existing job ID and generated PNG path');
  if (job.state === 'generated' && command !== 'revise') throw new Error('Already generated; preserve existing output and use a separately versioned revision');
  if (command === 'revise' && job.state !== 'generated') throw new Error('Generate the original before revising it');
  valid(job.catId); valid(job.part);
  let request;
  if (requestFlag) {
    request = JSON.parse(await readFile(path.resolve(requestPath), 'utf8'));
    if (request.catId !== job.catId || typeof request.prompt !== 'string' || !request.prompt.trim()) throw new Error('Generation request must name the same cat and contain the actual prompt');
    if (request.part && request.part !== job.part) throw new Error('Generation request names a different part');
  }
  const bytes = await readFile(path.resolve(source));
  const png = decodePng(bytes);
  let opaque = 0, transparent = 0, x0 = png.w, y0 = png.h, x1 = -1, y1 = -1;
  for (let y = 0; y < png.h; y++) for (let x = 0; x < png.w; x++) {
    const alpha = png.rgba[(y * png.w + x) * 4 + 3];
    if (alpha === 0) transparent++;
    if (alpha > 8) { opaque++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  }
  if (!opaque || !transparent) throw new Error('Expected a non-empty genuinely transparent image');
  const revision = command === 'revise' ? (job.revisions?.length ?? 0) + 2 : 1;
  const destination = path.join(catOutput(job.catId), `${job.part}${revision > 1 ? `-v${revision}` : ''}.png`);
  await mkdir(path.dirname(destination), { recursive: true });
  if (path.resolve(source) !== destination) await copyFile(path.resolve(source), destination);
  if (revision > 1) job.revisions = [...(job.revisions ?? []), { path: job.path, sha256: job.sha256, sourceFile: job.sourceFile, reviewStatus: 'superseded-candidate' }];
  Object.assign(job, { state: 'generated', path: destination, revision, recordedAt: new Date().toISOString(), sourceFile: path.resolve(source), sha256: createHash('sha256').update(bytes).digest('hex'), width: png.w, height: png.h, alphaBounds: [x0, y0, x1 + 1, y1 + 1], transparentPixels: transparent, reviewStatus: 'pending', generationTool: 'built-in image_gen', license: 'OpenAI image-generation output, subject to applicable terms' });
  if (request) Object.assign(job, { prompt: request.prompt, actualGenerationRequest: path.resolve(requestPath), reference: request.reference, referenceRole: request.referenceRole });
  if (namespace) Object.assign(job, { productionRevision: namespace, provenanceMethod: job.part === 'master' ? 'imagegen-neutral-master-candidate' : 'imagegen-source-reference-edit-candidate', originalVisiblePixelsVerified: false, staticReassemblyVerified: false });
  await writeFile(destination.replace(/\.png$/, '.json'), JSON.stringify(job, null, 2) + '\n');
  await save(q);
  console.log(JSON.stringify({ recorded: job.id, ...summary(q) }, null, 2));
} else if (command === 'summary') {
  console.log(JSON.stringify(summary(await readQueue()), null, 2));
} else throw new Error('Use [--spec games/game112/native-cat-production.vN.json] init, next [count], record/revise <breed/part> <generated.png> [--request request.json], or summary');
