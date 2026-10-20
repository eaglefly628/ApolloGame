#!/usr/bin/env node
// Environment ownership evidence: real Chrome, native RoomEnvironment and generated Radiance bytes.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, symlinkSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { engineAliases } from './engine-aliases.mjs';
const root = dirname(dirname(fileURLToPath(import.meta.url))), args = process.argv.slice(2), selection = args.includes('--case') ? args[args.indexOf('--case') + 1] : 'all';
assert(['all', 'sky', 'room', 'hdr'].includes(selection), 'Unknown --case');
const dir = realpathSync(mkdtempSync(join(tmpdir(), 'apollo-environment-browser-'))), publicDir = join(dir, 'public'); mkdirSync(join(publicDir, 'fixtures'), { recursive: true }); symlinkSync(join(root, 'node_modules'), join(dir, 'node_modules'), 'dir');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function radiance(variant) {
  const width = 64, height = 32, header = Buffer.from(`#?RADIANCE\n# Programmatic offline test input, no photograph or paid source\nFORMAT=32-bit_rle_rgbe\n\n-Y ${height} +X ${width}\n`), pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const i = (y * width + x) * 4, stripe = (x >> 3) % 2; pixels[i] = variant === 'a' ? 175 + stripe * 45 : 15 + stripe * 15; pixels[i + 1] = 30 + y * 3; pixels[i + 2] = variant === 'a' ? 18 + stripe * 12 : 180 + stripe * 40; pixels[i + 3] = 130; }
  return Buffer.concat([header, pixels]);
}
const inputs = {};
for (const name of ['a', 'b', 'bad']) { const bytes = name === 'bad' ? Buffer.from('not Radiance\n') : radiance(name); writeFileSync(join(publicDir, 'fixtures', name + '.hdr'), bytes); inputs[name] = { sha256: sha(bytes), bytes: bytes.length, source: name === 'bad' ? 'Intentionally invalid header' : 'Generated 64x32 RGBE Radiance flat pixels' }; }
writeFileSync(join(dir, 'index.html'), '<!doctype html><html><head><link rel="icon" href="data:,"></head><body style="margin:0;background:#101725"><div id="stage" style="width:800px;height:600px;position:relative"></div><script type="module" src="/probe.js"></script></body></html>');
writeFileSync(join(dir, 'probe.js'), `import ${JSON.stringify(join(root, 'scripts/fixtures/environment-lifecycle/browser-probe.mjs'))};`);
const report = { source: 'programmatic-radiance-and-native-three-room-fixtures', productionApproved: false, realTripoValidated: false, realMixamoValidated: false, realArpValidated: false, blenderStarted: false, inputs, probeHashes: { entry: sha(readFileSync(fileURLToPath(import.meta.url))), browser: sha(readFileSync(join(root, 'scripts/fixtures/environment-lifecycle/browser-probe.mjs'))) }, rendererSHA: sha(readFileSync(join(root, 'src/renderer/three-renderer.ts'))), evidence: dir, nativeObservation: 'Real post-init create/delete buffer, texture, framebuffer and renderbuffer handles; native owner events; assert before original forceContextLoss', cases: [], diagnostics: [], screenshots: [] };
let server, browser;
const bounded = async (promise, label, ms = 45000) => { let timer; try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Host timeout: ' + label)), ms); })]); } finally { clearTimeout(timer); } };
try {
  server = await createServer({ configFile: false, root: dir, publicDir, resolve: { alias: engineAliases(root) }, server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [dir, root] } }, logLevel: 'error' }); await server.listen();
  browser = await chromium.launch({ executablePath: process.env.RENDER_PROBE_CHROMIUM ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] });
  for (const name of selection === 'all' ? ['sky', 'room', 'hdr'] : [selection]) {
    const context = await browser.newContext({ viewport: { width: 800, height: 600 } }), page = await context.newPage(), row = { name, diagnostics: [] };
    page.on('console', message => { if (['warning', 'error'].includes(message.type())) row.diagnostics.push(message.type() + ': ' + message.text()); }); page.on('pageerror', error => row.diagnostics.push('pageerror: ' + error.message));
    try { await page.goto('http://127.0.0.1:' + server.httpServer.address().port); await bounded(page.waitForFunction(() => !!window.envProbe), 'module'); row.load = await bounded(page.evaluate(() => window.envProbe.load()), 'load'); row.result = await bounded(page.evaluate(value => window.envProbe[value](), name), name); const path = join(dir, name + '.png'); await page.screenshot({ path }); report.screenshots.push(path); row.destroy = await bounded(page.evaluate(() => window.envProbe.destroy()), 'destroy'); const expected = 'warning: [renderer] HDRI 环境贴图解析失败 → 回退程序化影室（纯表现·不影响玩法） hdr/bad Error: THREE.HDRLoader: Bad File Format: bad initial token'; assert(row.diagnostics.length === (name === 'hdr' ? 1 : 0) && row.diagnostics.every(value => value.split('\n')[0] === expected), 'Unexpected native browser warning/error: ' + row.diagnostics.join('\n')); row.ok = true; }
    catch (error) { row.ok = false; row.error = String(error.stack ?? error); row.partial = await bounded(page.evaluate(() => window.envReport), 'partial', 3000).catch(() => undefined); await bounded(page.screenshot({ path: join(dir, name + '-failure.png') }), 'failure image', 3000).catch(() => {}); }
    finally { report.cases.push(row); await context.close(); }
  }
  report.ok = report.cases.every(row => row.ok); if (!report.ok) report.error = report.cases.filter(row => !row.ok).map(row => row.name + ': ' + row.error).join('\n');
} catch (error) { report.ok = false; report.error = String(error.stack ?? error); }
finally { writeFileSync(join(dir, 'report.json'), JSON.stringify(report, null, 2) + '\n'); await browser?.close(); await server?.close(); }
console.log(JSON.stringify({ ok: report.ok, report: join(dir, 'report.json'), cases: report.cases.map(row => ({ name: row.name, ok: row.ok, error: row.error?.split('\n')[0].slice(0, 260) })) }, null, 2)); if (!report.ok) process.exitCode = 1;
