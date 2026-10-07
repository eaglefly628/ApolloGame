// Offline Spritegen → existing Apollo AssetIndex / Image.sprite contracts.
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, realpathSync, existsSync } from 'node:fs';
import { resolve, relative, isAbsolute, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const fail = (message) => { throw new Error(message); };
const json = (path) => JSON.parse(readFileSync(path, 'utf8'));
function inside(root, file) {
  if (typeof file !== 'string' || isAbsolute(file)) fail('Package files must be relative paths');
  const path = realpathSync(resolve(root, file));
  const rel = relative(root, path);
  if (rel === '..' || rel.startsWith('../') || isAbsolute(rel)) fail('Package path escapes its directory');
  return path;
}
function dimensions(path) {
  const b = readFileSync(path);
  if (b.length < 33 || b.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || b.toString('ascii', 12, 16) !== 'IHDR') fail('Expected PNG image');
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}
const pair = (v) => Array.isArray(v) && v.length === 2 && v.every((n) => Number.isSafeInteger(n) && n > 0);

export function exportSpritegen(options) {
  const { id, url, license } = options;
  const fps = Number(options.fps ?? 8);
  if (!options['visual-approved']) fail('Inspect contact sheet and animation before --visual-approved');
  if (!/^[a-z0-9][a-z0-9/_-]*$/.test(id ?? '') || id.includes('..')) fail('Invalid asset id');
  if (!/^\/games\/[a-z0-9-]+\/art\/[a-zA-Z0-9/_-]+\.png$/.test(url ?? '')) fail('Expected local /games/<game>/art/<asset>.png URL');
  if (!license?.trim()) fail('Supply verified generated-asset license/provenance terms');
  if (!Number.isFinite(fps) || fps < 1 || fps > 60) fail('fps must be between 1 and 60');
  const root = realpathSync(resolve(options.package));
  const m = json(join(root, 'manifest.json'));
  if (!pair(m.grid) || !pair(m.cellSize)) fail('Invalid grid/cellSize');
  const [columns, rows] = m.grid;
  const [frameWidth, frameHeight] = m.cellSize;
  const count = columns * rows;
  if (count > 4096 || frameWidth * columns > 32768 || frameHeight * rows > 32768) fail('Sheet exceeds export limits');
  const sheet = inside(root, m.files?.sheet);
  const request = m.files?.request ? inside(root, m.files.request) : null;
  const prompt = m.files?.prompt ? inside(root, m.files.prompt) : null;
  const report = json(inside(root, m.files?.review));
  if (!Array.isArray(report.errors) || !Array.isArray(report.warnings) || report.errors.length || report.warnings.length) fail('Spritegen QA must have zero errors and warnings');
  if (!Array.isArray(m.slices) || m.slices.length !== count || !Array.isArray(report.cells) || report.cells.length !== count) fail('Missing frame or QA records');
  const dims = dimensions(sheet);
  if (dims[0] !== columns * frameWidth || dims[1] !== rows * frameHeight) fail('PNG dimensions disagree with grid');
  for (let i = 0; i < count; i++) {
    const cell = m.slices[i];
    if (cell.row !== Math.floor(i / columns) || cell.column !== i % columns || cell.empty !== false) fail('Empty, missing or unordered frames');
    if (!(report.cells[i].opaquePixels > 0) || report.cells[i].edgeOpaquePixels !== 0) fail('Frame alpha QA is not clean');
    const size = dimensions(inside(root, cell.file));
    if (size[0] !== frameWidth || size[1] !== frameHeight) fail('Frame dimensions disagree');
  }
  const entry = { id, type: 'texture', status: 'filled', path: url,
    description: m.displayName ?? m.id, source: 'tool:Spritegen', license,
    spec: { format: 'png', width: dims[0], height: dims[1], transparent: true, usage: 'sprite', colorSpace: 'srgb', wrap: 'clamp', sheet: { frameWidth, frameHeight, columns, count } },
    provenance: { tool: 'usexless/Spritegen', revision: '510d2552add33ab056f16c69b1c70f748fea699d', sourceId: m.id, concept: m.concept ?? '', visualReviewed: true, fps } };
  const imageNode = rows === 1 ? { type: 'Image', id: id.replaceAll('/', '-'), props: { src: url, fit: 'contain', sprite: { frames: count, fps, frameAspect: frameWidth / frameHeight } }, layout: { width: frameWidth, height: frameHeight } } : null;
  const out = resolve(options.out);
  if (existsSync(out)) fail('Output already exists; choose a new staging directory');
  mkdirSync(out, { recursive: true });
  copyFileSync(sheet, join(out, 'sheet.png'));
  if (request) copyFileSync(request, join(out, 'sprite_request.json'));
  if (prompt) copyFileSync(prompt, join(out, 'generation-prompt.txt'));
  writeFileSync(join(out, 'asset-index.json'), JSON.stringify({ version: 1, assets: [entry] }, null, 2) + '\n');
  writeFileSync(join(out, 'source-manifest.json'), JSON.stringify(m, null, 2) + '\n');
  if (imageNode) writeFileSync(join(out, 'image-node.json'), JSON.stringify(imageNode, null, 2) + '\n');
  return { out, entry, imageNode };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const { values } = parseArgs({ options: {
      package: { type: 'string' }, out: { type: 'string' }, id: { type: 'string' }, url: { type: 'string' },
      fps: { type: 'string' }, license: { type: 'string' }, 'visual-approved': { type: 'boolean' }, help: { type: 'boolean' },
    } });
    if (values.help) console.info('Spritegen offline export: --package DIR --out NEW_DIR --id game112/cat/idle --url /games/game112/art/cat/idle.png --fps 6 --license TERMS --visual-approved');
    else {
      if (!values.package || !values.out) fail('--package and --out are required');
      const result = exportSpritegen(values);
      console.info(`[commit] Staged Apollo assets: ${result.out}`);
      if (!result.imageNode) console.warn('[reject] Multi-row sheet has no Image.sprite node; use AssetIndex or generate horizontal strips.');
    }
  } catch (error) { console.error(`[reject] ${error.message}`); process.exitCode = 1; }
}
