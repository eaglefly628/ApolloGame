#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, stat, realpath } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { verifyProduct } from './lib/ios-release.mjs';
import { detectBrowserRuntime } from './lib/render-harness.mjs';

/** A desktop browser startup/asset gate. Never substitutes for iOS device or TestFlight evidence. */
export async function smokeIOSWeb(outputDir, { exercise, executablePath } = {}) {
  const output = resolve(outputDir), { product } = await verifyProduct(output);
  const report = { schemaVersion: 1, buildId: product.buildId, platform: 'desktop-chromium', status: 'failed', errors: [], requests: [], checks: [] };
  const web = await realpath(join(output, 'www'));
  const native = await readFile(join(output, 'ApolloProduct/ApolloSchemeHandler.swift'), 'utf8');
  const policy = native.match(/"(default-src[^"\n]+)"/)?.[1];
  if (!policy) throw new Error('Native resource CSP policy unavailable');
  let browser;
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const file = resolve(web, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
      const real = await realpath(file);
      if (!real.startsWith(web + sep) || !(await stat(real)).isFile()) throw Error('Not a bundled file');
      const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.png': 'image/png', '.woff2': 'font/woff2' }[extname(file)] ?? 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime, 'Content-Security-Policy': policy }); res.end(await readFile(real));
    } catch { res.writeHead(404); res.end('Not in product bundle'); }
  });
  try {
    await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
    const origin = 'http://127.0.0.1:' + server.address().port;
    const runtime = executablePath ? { ok: true, execPath: executablePath } : detectBrowserRuntime();
    if (!runtime.ok) throw Error(runtime.reason ?? 'NO_BROWSER');
    browser = await chromium.launch({ executablePath: runtime.execPath, headless: true });
    const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true });
    page.on('pageerror', error => report.errors.push({ type: 'pageerror', message: String(error) }));
    page.on('response', response => { if (response.status() >= 400) report.errors.push({ type: 'http', status: response.status(), url: response.url() }); });
    page.on('requestfailed', request => report.errors.push({ type: 'request', url: request.url(), reason: request.failure()?.errorText }));
    await page.route('**/*', async route => {
      const url = route.request().url(); report.requests.push(url.replace(origin, ''));
      if (!url.startsWith(origin + '/') && !url.startsWith('data:') && !url.startsWith('blob:')) {
        report.errors.push({ type: 'remote-dependency', url }); await route.abort();
      } else await route.continue();
    });
    await page.goto(origin, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => ['ready', 'error'].includes(document.getElementById('product-root')?.dataset.productState), null, { timeout: 15000 });
    const state = await page.locator('#product-root').getAttribute('data-product-state');
    assert.equal(state, 'ready', 'Product bootstrap did not become ready');
    report.checks.push('product-ready');
    if (exercise) { await exercise(page, report); report.checks.push('caller-behavior-exercise'); }
    await page.waitForTimeout(600);
    assert.equal(await page.locator('#product-root').getAttribute('data-product-state'), 'ready', 'Product failed after its initial ready signal');
    await mkdir(join(output, 'release'), { recursive: true });
    await page.screenshot({ path: join(output, 'release/web-smoke.png') });
    assert.equal(report.errors.length, 0, 'Product has failed or remote resource requests');
    report.status = 'passed';
  } catch (error) { report.errors.push({ type: 'assertion', message: String(error) }); }
  finally {
    if (browser) await browser.close();
    await new Promise(done => server.close(done));
    await mkdir(join(output, 'release'), { recursive: true });
    await writeFile(join(output, 'release/web-smoke.json'), JSON.stringify(report, null, 2) + '\n');
  }
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [output, ...extra] = process.argv.slice(2);
  try {
    if (!output || extra.length) throw Error('Usage: node scripts/ios-web-smoke.mjs release/ios/<product>');
    const result = await smokeIOSWeb(output); console.log(JSON.stringify(result, null, 2)); process.exitCode = result.status === 'passed' ? 0 : 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
