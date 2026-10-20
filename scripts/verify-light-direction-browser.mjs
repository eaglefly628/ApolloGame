#!/usr/bin/env node
// Real native light/shadow evidence; observations do not substitute renderer output.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, symlinkSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { engineAliases } from './engine-aliases.mjs';
const root = dirname(dirname(fileURLToPath(import.meta.url))), args = process.argv.slice(2), option = key => args.includes(key) ? args[args.indexOf(key) + 1] : undefined;
const selection = option('--case') ?? 'all'; assert(['all', 'main', 'extra', 'spot', 'legacy'].includes(selection), 'Unknown --case');
const dir = realpathSync(mkdtempSync(join(tmpdir(), 'apollo-light-direction-browser-'))), sha = value => createHash('sha256').update(value).digest('hex');
symlinkSync(join(root, 'node_modules'), join(dir, 'node_modules'), 'dir');
writeFileSync(join(dir, 'index.html'), '<!doctype html><html><head><link rel="icon" href="data:,"></head><body style="margin:0;background:#101725"><div id="stage" style="width:800px;height:600px;position:relative"></div><script type="module" src="/probe.js"></script></body></html>');
writeFileSync(join(dir, 'probe.js'), `import ${JSON.stringify(join(root, 'scripts/fixtures/light-direction/browser-probe.mjs'))};`);
const report = { source: 'native-three-mesh-lighting-fixture', productionApproved: false, realTripoValidated: false, realMixamoValidated: false, realArpValidated: false, blenderStarted: false, evidence: dir, lightsSHA: sha(readFileSync(join(root, 'src/renderer/three/lights.ts'))), rendererSHA: sha(readFileSync(join(root, 'src/renderer/three-renderer.ts'))), probeHashes: { entry: sha(readFileSync(fileURLToPath(import.meta.url))), browser: sha(readFileSync(join(root, 'scripts/fixtures/light-direction/browser-probe.mjs'))) }, cases: [], comparisons: [], diagnostics: [] };
const near = (a, b, tolerance = 2e-6) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => Number.isFinite(v) && Number.isFinite(b[i]) && Math.abs(v - b[i]) <= tolerance);
let server, browser;
try {
  server = await createServer({ configFile: false, root: dir, resolve: { alias: engineAliases(root) }, server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [dir, root] } }, logLevel: 'error' }); await server.listen();
  browser = await chromium.launch({ executablePath: process.env.RENDER_PROBE_CHROMIUM ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] });
  for (const route of selection === 'all' ? ['legacy', 'main', 'extra', 'spot'] : [selection]) for (const scale of route === 'legacy' ? [1] : [1, 8, 1e-300, 1e300]) {
    const context = await browser.newContext({ viewport: { width: 800, height: 600 } }), page = await context.newPage(), row = { route, scale, diagnostics: [] };
    page.on('console', message => { if (['warning', 'error'].includes(message.type())) row.diagnostics.push(message.type() + ': ' + message.text()); }); page.on('pageerror', error => row.diagnostics.push('pageerror: ' + error.message));
    try { await page.goto('http://127.0.0.1:' + server.httpServer.address().port); await page.waitForFunction(() => !!window.lightProbe, { timeout: 30000 }); row.result = await page.evaluate(value => window.lightProbe.run(value), { route, scale }); await page.screenshot({ path: join(dir, route + '-' + scale + '.png') }); row.destroy = await page.evaluate(() => window.lightProbe.destroy()); assert.equal(row.diagnostics.length, 0, 'Unexpected browser diagnostic ' + row.diagnostics.join('\n')); row.ok = true; }
    catch (error) { row.ok = false; row.error = String(error.stack ?? error); row.partial = await page.evaluate(() => window.lightReport).catch(() => undefined); }
    finally { report.cases.push(row); await context.close(); }
  }
  for (const route of ['main', 'extra', 'spot']) {
    const rows = report.cases.filter(row => row.route === route), unit = rows.find(row => row.scale === 1)?.result; if (!unit) continue;
    for (const row of rows) {
      if (!row.result) continue; const value = row.result;
      const comparison = { route, scale: row.scale, nativeShadowUpload: value.shadowUploads.count > 0 && value.shadowUploads.valid, nativeDirection: near(value.uniform, unit.uniform), expectedUnitDirection: near(value.uniform, value.expectedUniform), nativeRay: near(value.nativeRay, unit.nativeRay), cameraView: near(value.shadow.view, unit.shadow.view), cameraProjection: near(value.shadow.projection, unit.shadow.projection), frustum: value.shadow.centerInFrustum === unit.shadow.centerInFrustum, depth: value.shadow.depth?.hash === unit.shadow.depth?.hash, pixels: value.pixels.hash === unit.pixels.hash, shadowPixels: value.shadowPixels.hash === unit.shadowPixels.hash, actualShadow: route === 'extra' || (value.shadowPixels.changed > 50 && value.shadow.depth?.occupied > 20) }; comparison.ok = Object.entries(comparison).every(([key, v]) => ['route', 'scale'].includes(key) || v === true); report.comparisons.push(comparison);
    }
  }
  const legacy = report.cases.find(row => row.route === 'legacy')?.result;
  if (option('--legacy-reference')) { const original = JSON.parse(readFileSync(option('--legacy-reference'), 'utf8')).cases.find(row => row.route === 'legacy')?.result; assert(original && legacy, 'Missing no-Light reference'); const fields = ['uniform', 'nativeRay', 'shadow', 'pixels', 'shadowPixels', 'camera']; report.legacyReference = { path: option('--legacy-reference'), exact: fields.every(key => JSON.stringify(original[key]) === JSON.stringify(legacy[key])), fields }; }
  report.ok = report.cases.every(row => row.ok) && report.comparisons.every(row => row.ok) && report.legacyReference?.exact !== false;
  if (!report.ok) report.error = 'Native positive-scale light direction/shadow contract mismatch: ' + JSON.stringify(report.comparisons.filter(row => !row.ok)) + report.cases.filter(row => !row.ok).map(row => row.error).join('\n');
} catch (error) { report.ok = false; report.error = String(error.stack ?? error); }
finally { writeFileSync(join(dir, 'report.json'), JSON.stringify(report, null, 2) + '\n'); await browser?.close(); await server?.close(); }
console.log(JSON.stringify({ ok: report.ok, report: join(dir, 'report.json'), failed: report.comparisons.filter(row => !row.ok), errors: report.cases.filter(row => !row.ok).map(row => ({ route: row.route, scale: row.scale, error: row.error?.split('\n')[0] })) }, null, 2)); if (!report.ok) process.exitCode = 1;
