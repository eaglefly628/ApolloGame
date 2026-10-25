#!/usr/bin/env node
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { execFileSync } from 'node:child_process';
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { engineAliases } from './engine-aliases.mjs';
import { filterRegistrySource } from './lib/registry-subset.mjs';
import { canonicalJson, productPath, sha256, validateProductConfig } from './lib/ios-product-config.mjs';
import { generateIOSProject } from './lib/ios-native.mjs';

export const PRODUCT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export async function listFiles(directory, prefix = '') {
  const result = [];
  for (const item of (await readdir(join(directory, prefix), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const name = prefix ? prefix + '/' + item.name : item.name;
    if (item.isSymbolicLink()) throw new Error('product: symlink forbidden: ' + name);
    if (item.isDirectory()) result.push(...await listFiles(directory, name));
    else if (item.isFile()) result.push(name);
    else throw new Error('product: unsupported file ' + name);
  }
  return result;
}
const scriptJson = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, c => '\\u' + c.charCodeAt(0).toString(16));
const htmlText = text => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Product bootstrap contains no launcher/authoring backend and no arbitrary route selection. */
export function productEntry(root, product, manifest) {
  const mobile = JSON.stringify(resolve(root, 'src/services/mobile/index.ts'));
  const source = product.source.kind === 'manifest'
    ? `import { parseManifestAsync } from ${JSON.stringify(resolve(root, 'src/assembly/manifest-async.ts'))};\nimport { mountMobileBlueprint } from ${mobile};\nconst stop=await mountMobileBlueprint(host,await parseManifestAsync(${scriptJson(manifest)}),{w:config.viewport.width,h:config.viewport.height},config.runtime??{});\ncleanup=stop;`
    : `import { mountMobileEnvironment } from ${mobile};\nimport * as game from ${JSON.stringify(resolve(root, product.source.entry))};\nconst mobile=mountMobileEnvironment(config.runtime??{},{touchTarget:host});\ncleanup=()=>mobile.dispose();\nif(typeof game.mount!=='function')throw new Error('Product module must export mount(host)');\nconst stop=await game.mount(host);\ncleanup=()=>{try{if(typeof stop==='function')stop();}finally{mobile.dispose();}};\nawait mobile.settled();`;
  // Import declarations must remain top-level; separate declarations from initialization.
  const lines = source.split('\n'), imports = lines.filter(s => s.startsWith('import ')), body = lines.filter(s => !s.startsWith('import '));
  return `${imports.join('\n')}\nconst config=${scriptJson(product)};\nconst host=document.getElementById('product-root');\nlet cleanup=()=>{};let failed=false;\nfunction reject(error){failed=true;host.dataset.productState='error';host.setAttribute('aria-label','Product could not start');console.error('[product] reject:',error);cleanup();}\nwindow.addEventListener('apollo:mobile-error',event=>reject(event.detail?.error??new Error('Mobile runtime failed')));\nasync function boot(){try{${body.join('\n')}\nif(!failed){host.dataset.productState='ready';console.info('[product] commit: ready '+config.id);}}catch(error){reject(error);}}\nvoid boot();\nwindow.addEventListener('pagehide',event=>{if(!event.persisted)cleanup();},{once:true});\n`;
}

function assertOutput(root, output) {
  const rel = relative(root, output);
  if (rel === '' || rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) throw new Error('product: output must be inside repository release/ios/');
  if (!rel.split(sep).slice(0, 2).every((part, i) => part === ['release', 'ios'][i]) || rel.split(sep).length < 3) throw new Error('product: output must be release/ios/<product>');
  let ancestor = output;
  while (!existsSync(ancestor)) ancestor = dirname(ancestor);
  if (ancestor !== root) productPath(root, relative(root, ancestor).split(sep).join('/'), { directory: true });
  const realRel = relative(realpathSync(root), realpathSync(ancestor));
  if (realRel === '..' || realRel.startsWith('..' + sep) || isAbsolute(realRel)) throw new Error('product: output parent escapes repository');
}

export async function prepareIOSProduct(configFile, { root = PRODUCT_ROOT, outputDir } = {}) {
  root = resolve(root); configFile = resolve(root, configFile);
  const configRel = relative(root, configFile).split(sep).join('/');
  productPath(root, configRel);
  const product = validateProductConfig(JSON.parse(await readFile(configFile, 'utf8')), root);
  const target = resolve(outputDir ?? join(root, 'release/ios', product.id));
  assertOutput(root, target);
  await mkdir(dirname(target), { recursive: true });
  // Only replace directories carrying our own receipt, after the new bundle succeeds.
  if (existsSync(target) && !existsSync(join(target, 'product-build.json'))) throw new Error('product: refusing to replace unrelated output directory');
  const stage = await mkdtemp(join(dirname(target), '.' + product.id + '-stage-'));
  const work = realpathSync(await mkdtemp(join(tmpdir(), 'apollo-ios-entry-')));
  const sourceNames = new Set([configRel, 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'scripts/ios-product.mjs', 'scripts/lib/ios-product-config.mjs', 'scripts/lib/ios-native.mjs', 'scripts/lib/ios-release.mjs', 'scripts/ios-release.mjs', 'scripts/engine-aliases.mjs', 'scripts/lib/registry-subset.mjs', 'scripts/manifest-check.mjs']);
  let manifest, subset = null;
  try {
    if (product.source.kind === 'manifest') {
      const file = productPath(root, product.source.path);
      manifest = JSON.parse(await readFile(file, 'utf8')); sourceNames.add(product.source.path);
      // Reuse the real engine validator/load probe, rather than trusting manifest JSON shape.
      const reply = execFileSync(process.execPath, [join(root, 'node_modules/vite-node/vite-node.mjs'), 'scripts/manifest-check.mjs'], { cwd: root, input: JSON.stringify(manifest), encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
      const rep = JSON.parse(reply.trim().split('\n').at(-1));
      if (!rep.ok || !Array.isArray(rep.capabilities)) throw new Error('product: manifest did not pass engine probe');
      subset = rep.capabilities;
    } else sourceNames.add(product.source.entry);
    const registry = resolve(root, 'src/assembly/capability-registry.gen.ts');
    await writeFile(join(work, 'entry.ts'), productEntry(root, product, manifest));
    await writeFile(join(work, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${htmlText(product.title)}</title><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#101827}#product-root{position:absolute;inset:0;overflow:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);box-sizing:border-box}</style></head><body><main id="product-root" data-product-state="loading"></main><script type="module" src="./entry.ts"></script></body></html>`);
    await build({
      configFile: false, root: work, publicDir: false, base: './', logLevel: 'warn',
      plugins: [react(), { name: 'ios-product-source-receipt', enforce: 'pre',
        load(id) {
          const name = id.split('?')[0];
          if (isAbsolute(name)) {
            const rel = relative(root, name).split(sep).join('/');
            if (!rel.startsWith('../') && !rel.startsWith('node_modules/') && !rel.includes('/node_modules/')) sourceNames.add(rel);
          }
          if (name === registry && subset !== null) return filterRegistrySource(readFileSync(registry, 'utf8'), subset).src;
          return null;
        },
      }],
      resolve: { alias: { ...engineAliases(root), '@games': resolve(root, 'games') } },
      define: { __TARGET_GAME__: JSON.stringify(product.id) },
      build: { outDir: join(stage, 'www'), emptyOutDir: true, target: 'safari15', assetsInlineLimit: 4096 },
    });
    for (const resource of product.resources ?? []) {
      const from = resolve(root, 'public', resource), stat = await lstat(from);
      if (stat.isSymbolicLink()) throw new Error('product: resource symlink forbidden');
      const names = stat.isDirectory() ? (await listFiles(from)).map(p => resource + '/' + p) : [resource];
      for (const name of names) {
        sourceNames.add('public/' + name);
        const out = join(stage, 'www', name);
        if (existsSync(out)) throw new Error('product: resource collision ' + name);
        await mkdir(dirname(out), { recursive: true }); await cp(join(root, 'public', name), out);
      }
    }
    // No CDN, remote module or authoring API is needed by the declared sample. Runtime requests
    // are verified separately by the browser gate; this scan does not claim to prove JS fetches.
    const entryHtml = await readFile(join(stage, 'www/index.html'), 'utf8');
    if (/<(?:script|link)\b[^>]*(?:src|href)=["']https?:/i.test(entryHtml)) throw new Error('product: remote startup dependency');
    await writeFile(join(stage, 'product.json'), canonicalJson(product) + '\n');
    const nativeProduct = { ...product, ...(product.icon ? { icon: productPath(root, product.icon) } : {}) };
    await generateIOSProject({ outputDir: stage, product: nativeProduct, webDir: join(stage, 'www') });
    for (const name of await listFiles(join(root, 'ios/templates'))) sourceNames.add('ios/templates/' + name);
    // The build-time manifest validator loads the full capability catalog, including modules
    // trimmed from the shipped bundle. Bind that source tree too, so dirty validator changes
    // cannot reuse evidence from a different build input set.
    if (product.source.kind === 'manifest') for (const name of await listFiles(join(root, 'src'))) sourceNames.add('src/' + name);
    if (product.icon) sourceNames.add(product.icon);
    const sourceFiles = {}, files = {};
    for (const name of [...sourceNames].sort()) {
      if (existsSync(join(root, name)) && (await lstat(join(root, name))).isFile()) sourceFiles[name] = sha256(await readFile(join(root, name)));
    }
    for (const name of await listFiles(stage)) files[name] = sha256(await readFile(join(stage, name)));
    const identity = { schemaVersion: 1, productId: product.id, sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), configHash: sha256(canonicalJson(product)), files, sourceFiles };
    const receipt = { ...identity, sourceRoot: root, buildId: sha256(canonicalJson(identity)) };
    await writeFile(join(stage, 'product-build.json'), canonicalJson(receipt) + '\n');
    const backup = target + '.previous';
    if (existsSync(backup)) throw new Error('product: previous interrupted replacement requires inspection: ' + backup);
    const hadTarget = existsSync(target);
    if (hadTarget) await rename(target, backup);
    try { await rename(stage, target); } catch (error) { if (hadTarget) await rename(backup, target); throw error; }
    if (hadTarget) await rm(backup, { recursive: true });
    console.info(`[ios-product] commit: ${product.id} build=${receipt.buildId} output=${target}`);
    return { outputDir: target, receipt };
  } catch (error) {
    console.error('[ios-product] reject:', error.message); throw error;
  } finally { await rm(work, { recursive: true, force: true }); await rm(stage, { recursive: true, force: true }); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, file, ...rest] = process.argv.slice(2);
  if (command !== 'prepare' || !file || rest.length) { console.error('Usage: node scripts/ios-product.mjs prepare products/<product>.json'); process.exitCode = 2; }
  else { try { await prepareIOSProduct(file); } catch { process.exitCode = 1; } }
}
