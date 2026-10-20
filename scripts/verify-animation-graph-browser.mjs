#!/usr/bin/env node
// E2 browser evidence; reuses existing offline Blender bytes, never launches Blender.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, symlinkSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { engineAliases } from './engine-aliases.mjs';
import { inspectCharacterGlb } from './lib/character-glb.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const input = resolve(process.argv[2] ?? '/private/tmp/apollo-character-root-real-20261020/run-1');
const chrome = process.env.RENDER_PROBE_CHROMIUM ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const dir = realpathSync(mkdtempSync(join(tmpdir(), 'apollo-e2-browser-'))), publicDir = join(dir, 'public');
mkdirSync(join(publicDir, 'fixtures'), { recursive: true });
symlinkSync(join(root, 'node_modules'), join(dir, 'node_modules'), 'dir');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const source = JSON.parse(readFileSync(join(input, 'fixture-source.json')));
assert.equal(source.source, 'generic-blender-fixture');
assert.equal(source.realArpValidated, false); assert.equal(source.realMixamoValidated, false);
function model(bytes, variant) {
  const jsonLength = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + jsonLength));
  const bin = Buffer.from(bytes.subarray(28 + jsonLength));
  delete json.animations;
  if (variant) {
    const accessor = json.accessors[json.meshes[0].primitives[0].attributes.POSITION], view = json.bufferViews[accessor.bufferView];
    const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0), stride = view.byteStride ?? 12;
    for (let i = 0; i < accessor.count; i++) bin.writeFloatLE(bin.readFloatLE(start + i * stride) * 1.3, start + i * stride);
    accessor.min[0] *= 1.3; accessor.max[0] *= 1.3;
    json.meshes[0].name = 'DerivedWiderPrismsSameBindSkeleton';
    json.materials[0].pbrMetallicRoughness.baseColorFactor = [0.15, 0.55, 0.95, 1];
  }
  let text = Buffer.from(JSON.stringify(json)); text = Buffer.concat([text, Buffer.alloc((4 - text.length % 4) % 4, 32)]);
  const output = Buffer.alloc(28 + text.length + bin.length);
  output.writeUInt32LE(0x46546c67, 0); output.writeUInt32LE(2, 4); output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(text.length, 12); output.writeUInt32LE(0x4e4f534a, 16); text.copy(output, 20);
  output.writeUInt32LE(bin.length, 20 + text.length); output.writeUInt32LE(0x004e4942, 24 + text.length); bin.copy(output, 28 + text.length);
  return output;
}
const assets = [], inputs = {};
for (const clip of ['idle', 'walk', 'reach']) {
  const bytes = readFileSync(join(input, clip + '.glb'));
  const inspection = inspectCharacterGlb(bytes, { clipName: clip, fps: 30, frames: 31 });
  writeFileSync(join(publicDir, 'fixtures', clip + '.glb'), bytes);
  inputs[clip] = { sha256: sha(bytes), skeletonHash: inspection.skeletonHash, channels: inspection.animations[0].channels };
  assets.push({ id: 'motion/' + clip, type: 'animation', description: 'Existing generic Blender fixture ' + clip, status: 'filled', path: 'fixtures/' + clip + '.glb', spec: { skeleton: 'apollo-humanoid-v1', fps: 30, frames: 31, loop: clip !== 'reach' } });
}
for (const [name, variant] of [['a', false], ['b', true]]) {
  const bytes = model(readFileSync(join(input, 'idle.glb')), variant), inspection = inspectCharacterGlb(bytes);
  assert.equal(inspection.skeletonHash, inputs.idle.skeletonHash, 'Derived mesh must preserve the exact bind/rest skeleton');
  writeFileSync(join(publicDir, 'fixtures', 'model-' + name + '.glb'), bytes);
  inputs['model-' + name] = { sha256: sha(bytes), skeletonHash: inspection.skeletonHash, derivation: variant ? 'POSITION.x multiplied by 1.3; blue material; animations removed' : 'Only animations removed' };
  assets.push({ id: 'model/' + name, type: 'mesh', description: 'Generic Blender model ' + name, status: 'filled', path: 'fixtures/model-' + name + '.glb' });
}
assert.notEqual(inputs['model-a'].sha256, inputs['model-b'].sha256);
writeFileSync(join(publicDir, 'fixtures/index.json'), JSON.stringify({ version: 1, assets, groups: { cast: assets.map(a => a.id) }, initialGroup: 'cast' }));
writeFileSync(join(dir, 'index.html'), '<!doctype html><html><head><link rel="icon" href="data:,"></head><body style="margin:0;background:#101725"><div id="stage" style="width:720px;height:480px;position:relative"></div><script type="module" src="/probe.js"></script></body></html>');
writeFileSync(join(dir, 'probe.js'), `import ${JSON.stringify(join(root, 'scripts/fixtures/animation-graph/browser-probe.mjs'))};`);
const report = { source: 'generic-blender-fixture', realArpValidated: false, realMixamoValidated: false, realTripoValidated: false, blenderStarted: false, runProvenance: { asset: 'motion/walk', clip: 'walk', speed: 2, separateRunningCapture: false }, inputs, evidence: dir, clock: 'Controlled monotonically increasing performance.now for renderer deltas; real Chromium WebGL/shadow draws', diagnostics: [], screenshots: [] };
let server, browser;
try {
  server = await createServer({ configFile: false, root: dir, publicDir, resolve: { alias: engineAliases(root) }, server: { host: '127.0.0.1', port: 0, fs: { allow: [dir, root] } }, logLevel: 'error' });
  await server.listen();
  browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 720, height: 480 } });
  page.on('pageerror', error => report.diagnostics.push('pageerror: ' + error.message));
  page.on('console', message => { if (['warning', 'error'].includes(message.type())) report.diagnostics.push(message.type() + ': ' + message.text()); });
  await page.goto('http://127.0.0.1:' + server.httpServer.address().port);
  await page.waitForFunction(() => !!window.e2Probe);
  for (const stage of ['load', 'blend', 'once', 'removal', 'soak', 'lifecycle', 'destroy']) {
    report[stage] = await page.evaluate(name => window.e2Probe[name](), stage);
    if (['load', 'blend', 'once', 'removal'].includes(stage)) {
      const path = join(dir, stage + '.png'); await page.screenshot({ path }); report.screenshots.push(path);
    }
  }
  assert.deepEqual(report.diagnostics, [], 'Browser emitted warning/error diagnostics');
  report.ok = true;
} catch (error) {
  report.ok = false; report.error = String(error.stack ?? error);
  if (browser) for (const context of browser.contexts()) for (const page of context.pages()) {
    report.partial = await page.evaluate(() => window.e2Report).catch(() => undefined);
    await page.screenshot({ path: join(dir, 'failure.png') }).catch(() => {});
  }
} finally {
  writeFileSync(join(dir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await browser?.close(); await server?.close();
}
console.log(JSON.stringify({ ok: report.ok, report: join(dir, 'report.json'), error: report.error, stages: Object.keys(report).filter(key => ['load', 'blend', 'once', 'removal', 'soak', 'lifecycle', 'destroy'].includes(key)) }, null, 2));
if (!report.ok) process.exitCode = 1;
