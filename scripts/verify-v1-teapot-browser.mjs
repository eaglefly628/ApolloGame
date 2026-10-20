#!/usr/bin/env node
// Isolated V1 offline construction evidence. No Blender, paid inputs or production claim.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, cpSync, symlinkSync, realpathSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { engineAliases } from './engine-aliases.mjs';
const root = dirname(dirname(fileURLToPath(import.meta.url))), args = process.argv.slice(2);
assert(args[0], 'Usage: node scripts/verify-v1-teapot-browser.mjs <bundleDir> [--calibrate] [--manifest path]');
const bundle = resolve(args[0]), manifestArg = args.indexOf('--manifest'), calibrate = args.includes('--calibrate');
const manifestPath = manifestArg >= 0 ? resolve(args[manifestArg + 1]) : join(root, 'scripts/fixtures/v1-teapot/manifest.json');
const dir = realpathSync(mkdtempSync(join(tmpdir(), 'apollo-v1-browser-'))), publicDir = join(dir, 'public');
cpSync(join(bundle, 'public'), publicDir, { recursive: true }); mkdirSync(join(publicDir, 'fixtures'), { recursive: true });
const inputPath = [join(bundle, 'fixture-inputs.json'), join(bundle, 'public/fixtures/fixture-inputs.json')].find(existsSync); assert(inputPath, 'Missing honest fixture-inputs.json');
const metadata = JSON.parse(readFileSync(inputPath));
writeFileSync(join(publicDir, 'fixtures/fixture-inputs.json'), JSON.stringify(metadata));
cpSync(manifestPath, join(publicDir, 'fixtures/v1-manifest.json'));
symlinkSync(join(root, 'node_modules'), join(dir, 'node_modules'), 'dir');
writeFileSync(join(dir, 'index.html'), '<!doctype html><html><head><link rel="icon" href="data:,"></head><body style="margin:0;background:#101725"><div id="stage" style="width:960px;height:640px;position:relative"></div><script type="module" src="/probe.js"></script></body></html>');
writeFileSync(join(dir, 'probe.js'), `import ${JSON.stringify(join(root, 'scripts/fixtures/v1-teapot/browser-probe.mjs'))};`);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const report = { source: 'generic-offline-fixtures', formalV1Validated: false, realArpValidated: false, realMixamoValidated: false, realTripoValidated: false, productionApproved: false, humanR1Validated: false, blenderStarted: false, metadata, manifestSHA: sha(readFileSync(manifestPath)), probeHashes: { entry: sha(readFileSync(fileURLToPath(import.meta.url))), browser: sha(readFileSync(join(root, 'scripts/fixtures/v1-teapot/browser-probe.mjs'))) }, evidence: dir, mode: calibrate ? 'authoring-only-calibration' : 'frozen-manifest-replay', diagnostics: [], runs: [], screenshots: [] };
let server, browser;
const bounded = async (promise, label, ms = 30000) => { let timer; try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Host timeout: ' + label)), ms); })]); } finally { clearTimeout(timer); } }; 
try {
  server = await createServer({ configFile: false, root: dir, publicDir, resolve: { alias: engineAliases(root) }, server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [dir, root] } }, logLevel: 'error' }); await server.listen();
  browser = await chromium.launch({ executablePath: process.env.RENDER_PROBE_CHROMIUM ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] });
  const progress = value => writeFileSync(join(dir, 'progress.json'), JSON.stringify({ ...value, at: new Date().toISOString() }, null, 2));
  const configs = calibrate ? [{ hz: 60, calibrate: true }] : [{ hz: 60, boundary: true }, { hz: 30 }, { hz: 120 }, { hz: 60, catchup: 2 }, { hz: 60, catchup: 5 }];
  for (const config of configs) {
    progress({ config, stage: 'load' });
    const context = await browser.newContext({ viewport: { width: 960, height: 640 } }), page = await context.newPage(), row = { config, checkpoints: [] };
    page.on('pageerror', error => report.diagnostics.push('pageerror: ' + error.message)); page.on('console', message => { if (['warning', 'error'].includes(message.type())) report.diagnostics.push(message.type() + ': ' + message.text()); });
    try {
      await page.goto('http://127.0.0.1:' + server.httpServer.address().port); await bounded(page.waitForFunction(() => !!window.v1Probe), 'probe module'); row.load = await bounded(page.evaluate(value => window.v1Probe.load(value), config), 'asset/strict Engine warmup');
      if (calibrate) { row.calibration = await bounded(page.evaluate(() => window.v1Probe.calibrate()), 'authoring calibration'); writeFileSync(join(dir, 'calibration.json'), JSON.stringify(row.calibration, null, 2) + '\n'); const path = join(dir, 'authoring-precontact.png'); await page.screenshot({ path }); report.screenshots.push(path); }
      else for (const [name, target] of [['idle', 0], ['walk', 70], ['reach', 160], ['precontact', 194], ['contact', 195], ['carry', 240], ['held', 360]]) {
        progress({ config, stage: name, target }); row.checkpoints.push(await page.evaluate(({ target, name }) => window.v1Probe.runUntil(target, name), { target, name }));
        if (config.boundary) { const path = join(dir, name + '.png'); await page.screenshot({ path }); report.screenshots.push(path); }
      }
      if (!calibrate) { progress({ config, stage: 'soak' }); row.soak = await page.evaluate(() => window.v1Probe.soak()); if (config.boundary) row.lifecycle = await page.evaluate(() => window.v1Probe.lifecycle()); }
      progress({ config, stage: 'destroy' }); row.destroy = await page.evaluate(() => window.v1Probe.destroy()); report.runs.push(row);
    } catch (error) { row.partial = await bounded(page.evaluate(() => window.v1Report), 'failure report', 3000).catch(() => undefined); report.runs.push(row); await bounded(page.screenshot({ path: join(dir, 'failure.png') }), 'failure screenshot', 3000).catch(() => {}); throw error; }
    finally { await context.close(); }
  }
  // Only exact, named initial hidden-child diagnostics are permitted; no wildcard WARN suppression.
  const allowed = new Set(['warning: [renderer] Attach3D heldKettle: no current drawable; skip attachment', 'warning: [InverseKinematics] hero: model is not ready; skipped']);
  assert(report.diagnostics.every(value => allowed.has(value)), 'Unexpected runtime warning/error: ' + report.diagnostics.join('\n'));
  writeFileSync(join(dir, 'frames.html'), '<!doctype html><meta charset="utf-8"><title>V1 offline generic fixture — actual browser frame sequence</title><p>Generic offline fixtures. Formal V1, paid provenance and human approval are false. Actual sampled frames; timing is a presentation sequence.</p>' + report.screenshots.map(path => '<figure><img width="720" src="' + path.split('/').at(-1) + '"><figcaption>' + path.split('/').at(-1) + '</figcaption></figure>').join('')); report.frameSequence = join(dir, 'frames.html'); report.ok = true;
} catch (error) { report.ok = false; report.error = String(error.stack ?? error); }
finally { writeFileSync(join(dir, 'report.json'), JSON.stringify(report, null, 2) + '\n'); await browser?.close(); await server?.close(); }
console.log(JSON.stringify({ ok: report.ok, mode: report.mode, report: join(dir, 'report.json'), error: report.error, runs: report.runs.length }, null, 2));
if (!report.ok) process.exitCode = 1;
