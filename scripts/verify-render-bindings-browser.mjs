#!/usr/bin/env node
// Real Chrome/WebGL evidence. Fixture geometry is a test asset, never game content.
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, symlinkSync, realpathSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { engineAliases } from './engine-aliases.mjs';
const root = dirname(dirname(fileURLToPath(import.meta.url))), dir = realpathSync(mkdtempSync(join(tmpdir(), 'apollo-render-bindings-browser-')));
symlinkSync(join(root, 'node_modules'), join(dir, 'node_modules'), 'dir');
writeFileSync(join(dir, 'index.html'), '<!doctype html><html><head><link rel="icon" href="data:,"></head><body style="margin:0;background:#101725"><div id="stage" style="width:800px;height:600px;position:relative"></div><script type="module" src="/probe.js"></script></body></html>');
writeFileSync(join(dir, 'probe.js'), `import ${JSON.stringify(join(root, 'scripts/fixtures/render-bindings/browser-probe.mjs'))};`);
const files = ['src/renderer/three-renderer.ts', 'src/renderer/three/render-bindings.ts', 'src/renderer/three/model-dissolve.ts', 'src/renderer/three/material.ts', 'scripts/fixtures/render-bindings/browser-probe.mjs'];
const report = { ok: false, evidence: dir, source: 'generated-native-GLB-renderer-fixture', sourceHashes: Object.fromEntries(files.map(path => [path, createHash('sha256').update(readFileSync(join(root, path))).digest('hex')])), diagnostics: [] };
let server, browser;
try {
  server = await createServer({ configFile: false, root: dir, resolve: { alias: engineAliases(root) }, server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [dir, root] } }, logLevel: 'error' }); await server.listen();
  browser = await chromium.launch({ executablePath: process.env.RENDER_PROBE_CHROMIUM ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  page.on('console', message => { if (['warning', 'error'].includes(message.type())) report.diagnostics.push(`${message.type()}: ${message.text()}`); });
  page.on('pageerror', error => report.diagnostics.push(`pageerror: ${error.message}`));
  await page.goto('http://127.0.0.1:' + server.httpServer.address().port); await page.waitForFunction(() => !!window.renderBindingProbe, { timeout: 30000 });
  report.result = await page.evaluate(() => window.renderBindingProbe.run());
  const stages = await page.evaluate(() => window.renderBindingImages);
  for (const [name, data] of Object.entries(stages)) writeFileSync(join(dir, name + '.png'), Buffer.from(data.split(',')[1], 'base64'));
  await page.screenshot({ path: join(dir, 'bindings.png') });
  report.cleanup = await page.evaluate(() => window.renderBindingProbe.destroy());
  assert.deepEqual(report.diagnostics, []); report.ok = true;
} catch (error) { report.error = String(error.stack ?? error); }
finally { writeFileSync(join(dir, 'report.json'), JSON.stringify(report, null, 2) + '\n'); await browser?.close(); await server?.close(); }
console.log(JSON.stringify({ ok: report.ok, report: join(dir, 'report.json'), error: report.error, diagnostics: report.diagnostics }, null, 2)); if (!report.ok) process.exitCode = 1;
