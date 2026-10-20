// Real local browser: RENDER_PROBE_CHROMIUM=/absolute/chrome/path node scripts/scene-asset-groups.integration.mjs
// R4_KEEP_EVIDENCE=1 preserves screenshots and report. No remote network or mocked decoder.
import assert from 'node:assert/strict';
import { realpathSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createServer, build, preview } from 'vite';
import { chromium } from 'playwright';
import { engineAliases } from './engine-aliases.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const fixtures = join(root, 'scripts/fixtures/compressed-models');
const provenance = JSON.parse(readFileSync(join(fixtures, 'provenance.json')));
const kinds = ['raw', 'draco', 'ktx2'];
for (const kind of kinds) {
  const name = `cube-${kind}.glb`, bytes = readFileSync(join(fixtures, name)), meta = provenance.files[name];
  assert.equal(bytes.length, meta.bytes); assert.equal(createHash('sha256').update(bytes).digest('hex'), meta.sha256);
  const doc = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
  if (kind !== 'raw') assert(doc.extensionsRequired.includes({ draco: 'KHR_draco_mesh_compression', ktx2: 'KHR_texture_basisu' }[kind]));
}
assert(process.env.RENDER_PROBE_CHROMIUM, 'Set RENDER_PROBE_CHROMIUM to the fixed local Chrome executable');
const executablePath = realpathSync(process.env.RENDER_PROBE_CHROMIUM);
const dir = realpathSync(mkdtempSync(join(tmpdir(), 'apollo-r4-real-'))), publicDir = join(dir, 'public');
mkdirSync(join(publicDir, 'fixtures'), { recursive: true });
for (const kind of kinds) cpSync(join(fixtures, `cube-${kind}.glb`), join(publicDir, 'fixtures', `cube-${kind}.glb`));
cpSync(join(root, 'public/__vendor'), join(publicDir, '__vendor'), { recursive: true });
symlinkSync(join(root, 'node_modules'), join(dir, 'node_modules'), 'dir');
writeFileSync(join(dir, 'index.html'), '<!doctype html><html><head><link rel="icon" href="data:,"></head><body><script type="module" src="./probe.js"></script></body></html>');
writeFileSync(join(dir, 'probe.js'), `
import * as THREE from 'three';
import { ModelPool } from ${JSON.stringify(join(root, 'src/renderer/three/models.ts'))};
import { AssetManager } from ${JSON.stringify(join(root, 'src/assets/asset-manager.ts'))};
import { ModelAssetLoader } from ${JSON.stringify(join(root, 'src/assets/model-loader.ts'))};
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setSize(192,192); renderer.setPixelRatio(1); document.body.append(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x18212c);
const camera = new THREE.PerspectiveCamera(40,1,0.1,30); camera.position.set(6,5,8); camera.lookAt(0,0,0);
const loader = new ModelAssetLoader(import.meta.env.BASE_URL), loads = {}, nativeLoad = loader.load.bind(loader);
loader.load = descriptor => { loads[descriptor.key] = (loads[descriptor.key] ?? 0) + 1; return nativeLoad(descriptor); };
const assets = new AssetManager(loader);
for (const kind of ['raw','draco','ktx2']) assets.register({kind:'model',key:kind,src:'fixtures/cube-'+kind+'.glb'});
assets.registerGroups({ A:['raw','draco'], B:['draco','ktx2'] });
const pool = new ModelPool(assets, renderer), diagnostics = [], evictions = [];
assets.onEvict(event => evictions.push(event.key));
const oldError = console.error; console.error = (...args) => { diagnostics.push(args.map(String).join(' ')); oldError(...args); };
const disposed = new WeakMap(), templates = new WeakMap(), nativeClone = THREE.Material.prototype.clone;
THREE.Material.prototype.clone = function() { const clone = nativeClone.call(this); templates.set(clone, this); return clone; };
function track(resource) { if (!resource || disposed.has(resource)) return; disposed.set(resource, 0); resource.addEventListener('dispose', () => disposed.set(resource, disposed.get(resource) + 1)); }
const generations = [];
function owned(object) {
  const resources = new Set();
  object.traverse(mesh => { if (!mesh.isMesh) return; resources.add(mesh.geometry);
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      resources.add(material); resources.add(templates.get(material));
      for (const value of Object.values(material)) if (value?.isTexture) resources.add(value);
    }
  }); resources.delete(undefined); for (const resource of resources) track(resource); return [...resources];
}
function status() {
 const current = generations.at(-1);
 return { count:pool.count, loaded:Object.fromEntries(['raw','draco','ktx2'].map(key => [key, assets.isLoaded(key)])),
  progress:[assets.groupProgress('A'),assets.groupProgress('B')], loads:{...loads}, evictions:[...evictions],
  disposed:current ? Object.fromEntries(Object.entries(current.resources).map(([key,items]) => [key,items.map(item => disposed.get(item))])) : {},
  parents:current ? Object.fromEntries(Object.entries(current.objects).map(([id,obj]) => [id,!!obj.parent])) : {},
  memory:{...renderer.info.memory}, diagnostics:[...diagnostics] };
}
window.r4 = { async preload() {
 await Promise.all([assets.preloadGroup('A'), assets.preloadGroup('B')]);
 const objects = {}, resources = {}, start = performance.now();
 for (const [id,key] of [['raw','raw'],['draco','draco'],['draco-copy','draco'],['ktx2','ktx2']]) {
   let object; while (!(object = pool.ensure(scene,id,{type:'Model3D',modelKey:key}))) {
     if (diagnostics.length) throw new Error(diagnostics.join('\\n'));
     if (performance.now()-start > 15000) throw new Error('decode timeout '+key);
     await new Promise(resolve => setTimeout(resolve,10));
   }
   object.position.x = ({raw:-2,draco:0,'draco-copy':2,ktx2:0})[id]; object.position.z = id==='ktx2' ? 2 : 0;
   objects[id] = object; resources[key] = [...new Set([...(resources[key] ?? []), ...owned(object)])];
 }
 const geometries = Object.values(objects).map(object => {let result;object.traverse(mesh=>{if(mesh.isMesh)result=mesh.geometry;});return result;});
 const previous = generations.at(-1);
 generations.push({objects,resources,geometries}); renderer.render(scene,camera);
 const geometry = geometries[1], texture = objects.ktx2.children[0].material.map;
 return {...status(), generations:generations.length, fresh: !previous || geometries.every((geometry,i) => geometry !== previous.geometries[i]),
   draco:{positions:geometry.attributes.position.count,indices:geometry.index.count},
   ktx2:{compressed:texture.isCompressedTexture===true,width:texture.image.width,height:texture.image.height} };
 }, release(group) { assets.releaseGroup(group); renderer.render(scene,camera); return status(); },
 dispose() { pool.dispose(scene); renderer.dispose(); return status(); }
};
`);
function monitor() {
  const NativeWorker = window.Worker; let workers = 0, workersCreated = 0;
  window.Worker = class extends NativeWorker {
    closed = false;
    constructor(...args) { super(...args); workers++; workersCreated++; }
    terminate() { if (!this.closed) { this.closed = true; workers--; } super.terminate(); }
  };
  const urls = new Set(), create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = blob => { const url = create(blob); urls.add(url); return url; };
  URL.revokeObjectURL = url => { urls.delete(url); revoke(url); };
  window.r4Resources = () => ({ workers, workersCreated, blobs: urls.size });
}
const browser = await chromium.launch({ headless: true, executablePath, args: ['--no-sandbox'] });
const report = { browser: browser.version(), executablePath, fixtureProvenance: Object.fromEntries(kinds.map(kind => [`cube-${kind}.glb`, provenance.files[`cube-${kind}.glb`]])), runs: [] };
async function run(server, base, label) {
  const origin = 'http://127.0.0.1:' + server.httpServer.address().port, errors = [], requests = [];
  const context = await browser.newContext();
  await context.route('**/*', route => {
    const url = route.request().url();
    if (/^https?:/.test(url) && new URL(url).origin !== origin) { errors.push('external request ' + url); return route.abort(); }
    return route.continue();
  });
  await context.addInitScript(monitor);
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(new URL(request.url()).pathname); });
  try {
    await page.goto(origin + base); await page.waitForFunction(() => !!window.r4);
    const cycles = [];
    for (let generation = 1; generation <= 2; generation++) {
      const loaded = await page.evaluate(() => window.r4.preload());
      assert.equal(loaded.count, 4); assert.equal(loaded.generations, generation); assert(loaded.fresh, 'new group generation must decode new geometry');
      assert.deepEqual(loaded.loads, { raw: generation, draco: generation, ktx2: generation }, 'shared key loads once per generation');
      assert(loaded.progress.every(progress => progress.status === 'ready' && progress.loaded === 2 && progress.total === 2));
      assert.equal(loaded.draco.indices, 36); assert(loaded.draco.positions > 0); assert.deepEqual(loaded.ktx2, { compressed: true, width: 16, height: 16 });
      for (const counts of Object.values(loaded.disposed)) assert(counts.every(count => count === 0));
      await page.screenshot({ path: join(dir, `${label}-generation-${generation}.png`) });
      const a = await page.evaluate(() => window.r4.release('A'));
      assert.equal(a.count, 3); assert.deepEqual(a.loaded, { raw: false, draco: true, ktx2: true });
      assert.equal(a.parents.raw, false); assert.equal(a.parents.draco, true); assert.equal(a.parents['draco-copy'], true);
      assert(a.disposed.raw.every(count => count === 1), 'raw clone, template material, geometry and textures released');
      assert(a.disposed.draco.every(count => count === 0), 'B retains shared Draco resources');
      assert(a.disposed.ktx2.every(count => count === 0), 'unrelated KTX2 resources remain live');
      const b = await page.evaluate(() => window.r4.release('B'));
      assert.equal(b.count, 0); assert.deepEqual(b.loaded, { raw: false, draco: false, ktx2: false });
      for (const counts of Object.values(b.disposed)) assert(counts.every(count => count === 1), 'last group releases each owned resource exactly once');
      assert(Object.values(b.parents).every(parent => !parent));
      assert.equal(b.memory.geometries, 0); assert.equal(b.memory.textures, 0); assert.deepEqual(b.diagnostics, []);
      cycles.push({ loaded, releasedA: a, releasedB: b });
    }
    for (const name of ['draco_wasm_wrapper.js', 'draco_decoder.wasm', 'basis_transcoder.js', 'basis_transcoder.wasm']) {
      assert(requests.includes(base + '__vendor/three-r184/' + (name.startsWith('draco') ? 'draco/' : 'basis/') + name), name + ' must use local vendor');
    }
    assert(requests.every(path => path.startsWith(base)), 'all requests respect BASE_URL');
    await page.evaluate(() => window.r4.dispose());
    const released = await page.evaluate(() => window.r4Resources());
    assert(released.workersCreated >= 2, 'actual Draco and Basis decoder workers must run');
    assert.equal(released.workers, 0); assert.equal(released.blobs, 0); assert.deepEqual(errors, []);
    report.runs.push({ label, base, cycles, released, requests });
  } finally { await context.close(); }
}
try {
  const config = { configFile: false, root: dir, base: '/', publicDir, resolve: { alias: engineAliases(root) }, server: { host: '127.0.0.1', port: 0, fs: { allow: [root, dir] } }, logLevel: 'error' };
  const dev = await createServer(config); await dev.listen();
  try { await run(dev, '/', 'dev'); } finally { await dev.close(); }
  const base = '/r4-subpath/'; await build({ ...config, base, build: { outDir: join(dir, 'dist'), emptyOutDir: true } });
  const built = await preview({ ...config, base, build: { outDir: join(dir, 'dist') }, preview: { host: '127.0.0.1', port: 0 } });
  try { await run(built, base, 'build-subpath'); } finally { await new Promise(resolve => built.httpServer.close(resolve)); }
  writeFileSync(join(dir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ evidence: dir, ...report }, null, 2));
} catch (error) {
  writeFileSync(join(dir, 'report.json'), JSON.stringify({ ...report, error: String(error.stack || error) }, null, 2) + '\n');
  console.error('R4 evidence retained at ' + dir); throw error;
} finally {
  await browser.close(); if (report.runs.length === 2 && process.env.R4_KEEP_EVIDENCE !== '1') rmSync(dir, { recursive: true, force: true });
}
