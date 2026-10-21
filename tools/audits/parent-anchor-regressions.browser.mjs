#!/usr/bin/env node
// Independent native-browser regressions for the six 2026-10-21 review findings.
// Usage: RENDER_PROBE_CHROMIUM=/path/to/chrome node tools/audits/parent-anchor-regressions.browser.mjs --root <checkout> --out <evidence-dir>
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
function option(name, fallback) { const i = args.indexOf(name); if (i < 0) return fallback; assert(args[i + 1] && !args[i + 1].startsWith('--'), `${name} requires a value`); return resolve(args[i + 1]); }
for (const arg of args.filter(a => a.startsWith('--'))) assert(['--root', '--out'].includes(arg), `Unknown option: ${arg}`);
const root = option('--root', resolve(scriptDir, '../..'));
const out = option('--out', resolve(root, '.artifacts/parent-anchor-regressions'));
const report = { root, browser: null, cases: [], diagnostics: [], sources: {}, harness: {}, ok: false };
for (const file of ['parent-anchor-regressions.browser.mjs', 'parent-anchor-regressions.fixture.mjs']) report.harness[file] = createHash('sha256').update(await readFile(join(scriptDir, file))).digest('hex');
let server, browser;
const tolerance = .08;
function closeEnough(actual, expected, label) { assert(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, actual ${actual}`); }
function equalRect(actual, expected, label) { for (const axis of ['x', 'y', 'w', 'h']) closeEnough(actual[axis], expected[axis], `${label}.${axis}`); }
async function settle(page) { await page.evaluate(async () => { await document.fonts.ready; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); }); await page.waitForTimeout(80); }
await mkdir(out, { recursive: true });
try {
  const [{ engineAliases }, { detectBrowserRuntime }] = await Promise.all([
    import(pathToFileURL(join(root, 'scripts/engine-aliases.mjs')).href),
    import(pathToFileURL(join(root, 'scripts/lib/render-harness.mjs')).href),
  ]);
  const runtime = detectBrowserRuntime();
  assert(runtime.ok, runtime.reason ?? 'NO_BROWSER');
  report.browser = runtime;
  for (const file of ['src/ui/components/anchor-debug.ts', 'src/ui/components/parent-anchor-dom.ts', 'src/ui/components/layout-solver.ts', 'src/net/host/local-input.ts']) {
    report.sources[file] = createHash('sha256').update(await readFile(join(root, file))).digest('hex');
  }
  const fixture = (await readFile(join(scriptDir, 'parent-anchor-regressions.fixture.mjs'), 'utf8')).replaceAll('__ROOT__', '/@fs/' + root);
  await writeFile(join(out, 'fixture.mjs'), fixture);
  server = await createServer({
    configFile: false, root, cacheDir: join(out, 'vite-cache'),
    resolve: { alias: engineAliases(root) }, optimizeDeps: { entries: [], noDiscovery: true },
    server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [root, out] } }, logLevel: 'error',
    plugins: [{ name: 'parent-anchor-regression-fixture', configureServer(s) {
      s.middlewares.use((req, res, next) => {
        if (req.url === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#16202e;color:white}#host{box-sizing:content-box}</style></head><body><div id="host"></div><script type="module" src="/probe.mjs"></script></body></html>'); }
        else if (req.url === '/probe.mjs') { res.setHeader('Content-Type', 'application/javascript'); res.end(fixture); }
        else next();
      });
    } }],
  });
  await server.listen();
  const url = 'http://127.0.0.1:' + server.httpServer.address().port;
  browser = await chromium.launch({ executablePath: runtime.execPath, headless: true, args: ['--no-sandbox'] });
  for (const dpr of [1, 2]) {
    const context = await browser.newContext({ viewport: { width: 1100, height: 800 }, deviceScaleFactor: dpr });
    const page = await context.newPage();
    page.on('pageerror', e => report.diagnostics.push({ dpr, type: 'pageerror', text: String(e) }));
    page.on('console', m => { if (['warning', 'error'].includes(m.type())) report.diagnostics.push({ dpr, type: m.type(), text: m.text() }); });
    try {
      await page.goto(url); await page.waitForFunction(() => window.probe);
      const run = async (name, fn) => {
        const row = { name, dpr, ok: false };
        try { await fn(row); row.ok = true; } catch (error) { row.error = String(error.stack ?? error); }
        try { await page.screenshot({ path: join(out, `${name}-dpr${dpr}.png`) }); } catch (error) { row.screenshotError = String(error); }
        report.cases.push(row);
        console.log(`${row.ok ? 'PASS' : 'FAIL'} ${name} DPR=${dpr}${row.error ? ': ' + row.error.split('\n')[0] : ''}`);
      };
      await run('F1-window-keyboard-inspector', async row => {
        await page.evaluate(() => probe.debugMount()); await settle(page);
        const toggle = page.locator('[data-anchor-debug-toggle]'), fold = page.locator('[data-anchor-debug-fold]');
        await toggle.click();
        row.open = await page.evaluate(() => probe.debug()); assert(row.open.open, 'Debug did not open');
        await page.keyboard.press('f');
        row.focusedToggleCommands = await page.evaluate(() => probe.commands()); assert.deepEqual(row.focusedToggleCommands, [], 'KeyF leaked while Debug button focused');
        await fold.focus(); const initialFold = await fold.getAttribute('aria-expanded');
        await page.keyboard.press('Enter');
        assert.notEqual(await fold.getAttribute('aria-expanded'), initialFold, 'Enter did not activate inspector button');
        row.enterCommands = await page.evaluate(() => probe.commands()); assert.deepEqual(row.enterCommands, [], 'Enter leaked');
        await page.keyboard.press('Space');
        assert.equal(await fold.getAttribute('aria-expanded'), initialFold, 'Space did not activate inspector button');
        row.spaceCommands = await page.evaluate(() => probe.commands()); assert.deepEqual(row.spaceCommands, [], 'Space leaked');
        const previousFocus = await page.evaluate(() => document.activeElement?.outerHTML);
        await page.keyboard.press('Tab');
        row.tabFocus = await page.evaluate(() => document.activeElement?.outerHTML);
        assert.notEqual(row.tabFocus, previousFocus, 'Tab did not move focus');
        row.tabCommands = await page.evaluate(() => probe.commands()); assert.deepEqual(row.tabCommands, [], 'Tab leaked');
        await page.keyboard.press('Escape');
        assert.equal(await toggle.getAttribute('aria-pressed'), 'false', 'Esc did not close inspector');
        row.escapeCommands = await page.evaluate(() => probe.commands()); assert.deepEqual(row.escapeCommands, [], 'Escape leaked');
        await page.locator('#pin').click(); await page.keyboard.press('f');
        row.closedCommands = await page.evaluate(() => probe.commands());
        assert(row.closedCommands.some(c => c.actions?.some(a => a.key === 'review.fire')), 'KeyF not restored after Esc');
        assert.equal(await page.evaluate(() => probe.actions.length), 1, 'Business click not restored');
        // Native Enter closes the focused toggle, Space opens it again.
        await toggle.click(); await toggle.focus(); await page.keyboard.press('Enter');
        assert.equal(await toggle.getAttribute('aria-pressed'), 'false', 'Enter failed to close Debug');
        await page.evaluate(() => probe.commands());
        await page.keyboard.press('Space'); assert.equal(await toggle.getAttribute('aria-pressed'), 'true', 'Space failed to open Debug');
        await page.evaluate(() => probe.commands());
        await page.keyboard.press('f'); assert.deepEqual(await page.evaluate(() => probe.commands()), [], 'KeyF leaked after keyboard reopen');
        await page.keyboard.press('Escape');
      });
      for (const scale of [1, .65, 1.75]) await run(`F2-scroll-scale-${scale}`, async row => {
        await page.evaluate(s => probe.scrollMount(s), scale); await settle(page);
        await page.locator('[data-anchor-debug-toggle]').click();
        // Use real pointer initially; later scroll the selected node outside view without auto-scroll from locator.click().
        await page.locator('#pin').click();
        row.states = [];
        for (const [left, top] of [[0, 0], [60, 120], [120, 60], [0, 0]]) {
          await page.evaluate(([x, y]) => probe.scroll(x, y), [left, top]); await settle(page);
          const state = await page.evaluate(() => probe.scrollRead()); row.states.push(state);
          closeEnough(state.scrollLeft, left, 'scrollLeft'); closeEnough(state.scrollTop, top, 'scrollTop');
          const range = state.debug.shapes.find(s => s.attrs['data-debug-anchor'] === 'range'); assert(range, 'Selected node has no anchor range');
          closeEnough(Number(range.attrs.x), state.expectedRange.x, 'range.x'); closeEnough(Number(range.attrs.y), state.expectedRange.y, 'range.y');
          const link = state.debug.shapes.find(s => s.attrs['data-debug-anchor'] === 'link'); assert(link, 'Selected node has no anchor link');
          closeEnough(Number(link.attrs.x1), state.expectedRange.x, 'link.x1'); closeEnough(Number(link.attrs.y1), state.expectedRange.y, 'link.y1');
        }
      });
      for (const position of [null, 'absolute', 'fixed']) await run(`F3-legacy-host-${position ?? 'static'}`, async row => {
        row.actual = await page.evaluate(p => probe.lifecycle(p ?? undefined), position);
        assert.equal(row.actual.afterPosition, row.actual.expectedPosition, 'Adapter retained or overwrote host position');
        equalRect(position === null ? row.actual.updated : row.actual.updatedLocal, position === null ? row.actual.fresh : row.actual.freshLocal, 'update vs fresh legacy');
      });
      await run('F4-natural-rejection-recovery', async row => {
        await page.evaluate(() => probe.naturalMount()); await settle(page);
        row.initial = await page.evaluate(() => probe.naturalRead()); assert.equal(row.initial.error, null);
        await page.evaluate(() => probe.resize(50)); await settle(page);
        row.rejected = await page.evaluate(() => probe.naturalRead()); assert(row.rejected.error, '50px canvas did not reject minWidth=100');
        await page.evaluate(() => probe.resize(150)); await settle(page);
        row.recovered = await page.evaluate(() => probe.naturalRead()); assert.equal(row.recovered.error, null, 'Error remained after recovery');
        await page.evaluate(() => probe.naturalMount(150)); await settle(page);
        row.fresh = await page.evaluate(() => probe.naturalRead()); equalRect(row.recovered.child, row.fresh.child, 'recovered vs fresh natural Label');
        assert(row.fresh.child.h > row.initial.child.h, 'Fixture did not exercise wrapping-height change');
      });
      for (const mode of ['explicit', 'hidden', 'detached']) await run(`F5-zero-${mode}`, async row => {
        await page.evaluate(m => probe.zeroMount(m), mode); await settle(page);
        row.initial = await page.evaluate(() => probe.zeroRead());
        if (mode === 'explicit') { assert(row.initial.connected, 'Explicit zero must be connected'); assert(row.initial.error, 'Explicit 0x0 canvas silently skipped rejection'); assert.equal(row.initial.visibility, 'hidden', 'Initial rejected node remains visible'); }
        else assert.equal(row.initial.error, null, `${mode} geometry should defer, not reject`);
        await page.evaluate(m => probe.zeroRecover(m), mode); await settle(page);
        row.recovered = await page.evaluate(() => probe.zeroRead()); assert.equal(row.recovered.error, null, 'Canvas did not recover');
        assert.equal(row.recovered.visibility, 'visible', 'Recovered node remains hidden'); assert(row.recovered.child.w >= 100 && row.recovered.child.h === 20, 'Recovered geometry is invalid');
      });
      for (const path of ['root', 'intrinsic', 'arrange']) for (const constraint of ['minWidth', 'minHeight', 'maxHeight']) await run(`F6-${path}-${constraint}`, async row => {
        row.fixture = await page.evaluate(([p, c]) => probe.constraintsMount(p, c), [path, constraint]); await settle(page);
        row.actual = await page.evaluate(() => probe.constraintsRead());
        for (const id of ['subject', 'constraint-pin', ...(path === 'intrinsic' ? ['wrapper'] : [])]) equalRect(row.actual.dom[id], row.actual.solver[id], `${path} ${constraint} ${id} DOM/solver`);
        const subject = row.actual.dom.subject;
        if (constraint === 'minWidth') closeEnough(subject.w, 220, 'minWidth must be exercised');
        else if (constraint === 'minHeight') closeEnough(subject.h, 220, 'minHeight must be exercised');
        else closeEnough(subject.h, 60, 'maxHeight must be exercised');
      });
      for (const direction of ['column', 'row']) await run(`F6-center-overflow-${direction}`, async row => {
        await page.evaluate(d => probe.centerOverflowMount(d), direction); await settle(page);
        row.actual = await page.evaluate(() => probe.constraintsRead());
        equalRect(row.actual.dom.subject, row.actual.solver.subject, `${direction} centered overflow DOM/solver`);
        closeEnough(row.actual.dom.subject[direction === 'column' ? 'x' : 'y'], -60, 'Centered overflow negative offset must be exercised');
      });
      const cleanup = await page.evaluate(() => probe.destroy()); assert.equal(cleanup.remainingDebug, 0, 'Debug chrome survived dispose');
    } finally { await context.close(); }
  }
  assert.equal(report.diagnostics.filter(d => d.type === 'pageerror').length, 0, 'Unexpected page runtime errors');
  report.ok = report.cases.length > 0 && report.cases.every(c => c.ok);
} catch (error) { report.error = String(error.stack ?? error); }
finally {
  const cleanup = await Promise.allSettled([browser?.close(), server?.close()]);
  report.cleanup = cleanup.map(r => r.status === 'fulfilled' ? { ok: true } : { ok: false, error: String(r.reason) });
  if (report.cleanup.some(r => !r.ok)) report.ok = false;
  await writeFile(join(out, 'report.json'), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ ok: report.ok, passed: report.cases.filter(c => c.ok).length, failed: report.cases.filter(c => !c.ok).map(c => `${c.name} DPR=${c.dpr}`), report: join(out, 'report.json'), error: report.error }));
if (!report.ok) process.exitCode = 1;
