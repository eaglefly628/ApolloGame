/** iOS execution evidence. Unsigned archives, simulator runs and uploads are distinct states. */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const execFileAsync = promisify(execFile);
export const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
export function canonicalJSON(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonicalJSON(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
const readJSON = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const exists = async file => fs.stat(file).then(() => true, () => false);
const within = (root, relative) => {
  if (typeof relative !== 'string' || path.isAbsolute(relative) || relative.split(/[\\/]/).includes('..')) throw Error(`Unsafe evidence path: ${relative}`);
  return path.resolve(root, relative);
};
async function regularFile(root, relative) {
  const file = within(root, relative);
  const realRoot = await fs.realpath(root), realFile = await fs.realpath(file);
  if (!realFile.startsWith(`${realRoot}${path.sep}`) || !(await fs.stat(file)).isFile()) throw Error(`Evidence must be a regular file inside product: ${relative}`);
  return file;
}
async function listFiles(root, prefix = '', ignore = new Set()) {
  const result = [];
  for (const entry of await fs.readdir(path.join(root, prefix), { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (!prefix && ignore.has(entry.name)) continue;
    if (entry.isSymbolicLink()) throw Error(`Symbolic links are not permitted in product payload: ${relative}`);
    if (entry.isDirectory()) result.push(...await listFiles(root, relative));
    else if (entry.isFile()) result.push(relative);
  }
  return result.sort();
}
async function assertSafeOutputTree(root) {
  const absolute = path.resolve(root);
  const segments = absolute.split(path.sep).filter(Boolean);
  let ancestor = path.parse(absolute).root;
  for (const segment of segments) {
    ancestor = path.join(ancestor, segment);
    try {
      if ((await fs.lstat(ancestor)).isSymbolicLink()) {
        const systemAlias = process.platform === 'darwin' && ['/tmp', '/var'].includes(ancestor) && await fs.realpath(ancestor) === '/private' + ancestor;
        if (!systemAlias) throw Error(`Output symlink is forbidden: ${ancestor}`);
      }
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const inspect = async directory => {
    let stat;
    try { stat = await fs.lstat(directory); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
    if (stat.isSymbolicLink()) throw Error(`Output symlink is forbidden: ${directory}`);
    if (!stat.isDirectory()) throw Error(`Output path must be a directory: ${directory}`);
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const child = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw Error(`Output symlink is forbidden: ${child}`);
      if (entry.isDirectory()) await inspect(child);
      else if (!entry.isFile()) throw Error(`Unsupported output entry: ${child}`);
    }
  };
  await inspect(absolute);
}
async function containedArtifact(root, relative) {
  await assertSafeOutputTree(root);
  const file = within(root, relative), realRoot = await fs.realpath(root), realFile = await fs.realpath(file);
  if (!realFile.startsWith(realRoot + path.sep)) throw Error('Artifact must remain inside the actual product root');
  return file;
}
export async function artifactHash(file) {
  const stat = await fs.lstat(file);
  if (stat.isSymbolicLink()) return sha256(`link:${await fs.readlink(file)}`);
  if (stat.isFile()) return sha256(await fs.readFile(file));
  if (!stat.isDirectory()) throw Error(`Unsupported artifact: ${file}`);
  const entries = await fs.readdir(file); entries.sort();
  const tree = [];
  for (const name of entries) tree.push([name, await artifactHash(path.join(file, name))]);
  return sha256(canonicalJSON(tree));
}
export async function verifyProduct(outputDir, { repoRoot, sourceRoot, sourceCommit, requireSources = true } = {}) {
  const config = await readJSON(path.join(outputDir, 'product.json'));
  const product = await readJSON(path.join(outputDir, 'product-build.json'));
  repoRoot = sourceRoot || repoRoot || product.sourceRoot || process.cwd();
  const identity = { schemaVersion: 1, productId: product.productId, sourceCommit: product.sourceCommit, configHash: product.configHash, files: product.files, sourceFiles: product.sourceFiles };
  if (product.buildId !== sha256(canonicalJSON(identity))) throw Error('Product buildId does not match its content identity');
  if (product.schemaVersion !== 1 || !product.buildId || product.productId !== (config.id || config.productId)) throw Error('Invalid product build identity');
  if (product.configHash !== sha256(canonicalJSON(config))) throw Error('Product configuration changed; rebuild required');
  if (!product.files || !Object.keys(product.files).length) throw Error('Product file manifest is missing');
  for (const [relative, hash] of Object.entries(product.files)) {
    const actual = sha256(await fs.readFile(await regularFile(outputDir, relative)));
    if (actual !== hash) throw Error(`Product artifact changed: ${relative}`);
  }
  const covered = Object.keys(product.files).sort();
  const actualFiles = await listFiles(outputDir, '', new Set(['build', 'release', 'product-build.json']));
  if (canonicalJSON(covered) !== canonicalJSON(actualFiles)) throw Error('Product file manifest does not cover every generated file');
  if (!Object.keys(product.files).some(f => f.startsWith('www/')) || !Object.keys(product.files).some(f => f.startsWith('ApolloProduct.xcodeproj/'))) throw Error('Product manifest must cover web payload and native project');
  if (requireSources && (!product.sourceFiles || !Object.keys(product.sourceFiles).length)) throw Error('Source file evidence missing; rebuild with sourceFiles');
  for (const [relative, hash] of Object.entries(product.sourceFiles || {})) {
    const actual = sha256(await fs.readFile(await regularFile(repoRoot, relative)));
    if (actual !== hash) throw Error(`Source changed since product build: ${relative}`);
  }
  if (!sourceCommit) ({ stdout: sourceCommit } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot }));
  if (!product.sourceCommit || product.sourceCommit !== sourceCommit.trim()) throw Error('Source commit changed; rebuild required');
  await assertSafeOutputTree(outputDir);
  return { config, product, manifestHash: sha256(canonicalJSON(product)) };
}
async function productionRun(command, argv, options) {
  try {
    const result = await execFileAsync(command, argv, { cwd: options.cwd, env: options.env || process.env, maxBuffer: 16 * 1024 * 1024, timeout: options.timeout || 15 * 60 * 1000, shell: false });
    return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) { return { exitCode: typeof error.code === 'number' ? error.code : null, stdout: error.stdout || '', stderr: error.stderr || '', errorCode: error.killed ? 'TIMED_OUT' : typeof error.code === 'string' ? error.code : undefined, signal: error.signal || undefined }; }
}
function metadataIssues(config) {
  const store = config.appStore || config.store || config;
  const privacy = store.privacyPolicyURL || store.privacyPolicyUrl || config.privacyPolicyURL || config.privacyPolicyUrl;
  const support = store.supportURL || store.supportUrl || config.supportURL || config.supportUrl;
  const issues = [];
  for (const [name, value] of [['privacyPolicyURL', privacy], ['supportURL', support]]) {
    try { const url = new URL(value); if (url.protocol !== 'https:' || /example\.(com|org|net)$|localhost/.test(url.hostname)) throw Error(); } catch { issues.push(`${name} must be supplied as a real HTTPS URL`); }
  }
  if (!['4+', '9+', '13+', '16+', '18+'].includes(store.ageRating)) issues.push('ageRating must be supplied');
  if (typeof (store.usesNonExemptEncryption ?? store.exportCompliance?.usesNonExemptEncryption ?? config.exportCompliance?.usesNonExemptEncryption) !== 'boolean') issues.push('Export encryption declaration must be supplied');
  const icon = config.icon || config.appIcon || store.icon;
  if (!icon || typeof icon !== 'string') issues.push('Product icon must be supplied');
  return issues;
}
export async function runReleaseAction(action, outputDir, options = {}, dependencies = {}) {
  const root = path.resolve(outputDir), repoRoot = options.sourceRoot || options.repoRoot;
  const run = dependencies.run || productionRun;
  const now = dependencies.now || (() => new Date().toISOString());
  const report = { schemaVersion: 1, action, startedAt: now(), status: 'blocked', buildId: null, commands: [], issues: [], artifact: null };
  let verified;
  try { await assertSafeOutputTree(root); } catch (error) {
    report.issues.push(error.message); report.finishedAt = now(); report.persistence = 'blocked: unsafe output paths'; return report;
  }
  const command = async (bin, argv, extra = {}) => {
    await assertSafeOutputTree(root);
    const result = await run(bin, argv, { cwd: root, ...extra });
    const safeArgv = argv.map((v, i) => ['--apiKey', '--apiIssuer'].includes(argv[i - 1]) ? '[REDACTED]' : v);
    report.commands.push({ command: bin, argv: safeArgv, exitCode: result.exitCode, ...(result.errorCode ? { errorCode: result.errorCode } : {}), ...(result.signal ? { signal: result.signal } : {}) });
    if (result.exitCode !== 0) throw Error(`${bin} failed with exit code ${result.exitCode}${result.errorCode ? ` (${result.errorCode})` : ''}`);
    return `${result.stdout || ''}${result.stderr || ''}`;
  };
  const attach = async file => {
    if (!(await exists(file))) throw Error(`Required artifact missing: ${file}`);
    const relative = path.relative(root, file);
    await containedArtifact(root, relative);
    report.artifact = { path: relative, sha256: await artifactHash(file) };
  };
  const verifyPayload = async app => {
    const expectedFiles = Object.keys(verified.product.files).filter(f => f.startsWith('www/')).sort();
    const actualFiles = (await listFiles(path.join(app, 'www'))).map(f => `www/${f}`);
    if (canonicalJSON(expectedFiles) !== canonicalJSON(actualFiles)) throw Error('Embedded payload file set differs from product build');
    for (const [relative, hash] of Object.entries(verified.product.files)) {
      if (!relative.startsWith('www/')) continue;
      const file = await regularFile(app, relative);
      if (sha256(await fs.readFile(file)) !== hash) throw Error(`Embedded product payload differs from build: ${relative}`);
    }
  };
  const appInfo = async file => {
    const raw = await command('/usr/bin/plutil', ['-convert', 'json', '-o', '-', path.join(file, 'Info.plist')]);
    return JSON.parse(raw);
  };
  const checkApp = async (app, platform, distribution = false, signatureRequired = true) => {
    const info = await appInfo(app);
    await verifyPayload(app);
    if (!info.CFBundleSupportedPlatforms?.includes(platform)) throw Error(`App platform must be ${platform}`);
    if (!info.CFBundleExecutable || typeof info.CFBundleExecutable !== 'string') throw Error('App executable is missing');
    const executable = await regularFile(app, info.CFBundleExecutable);
    const macho = await command('/usr/bin/xcrun', ['vtool', '-show-build', executable]);
    const expectedPlatform = platform === 'iPhoneOS' ? 'IOS' : 'IOSSIMULATOR';
    const platforms = [...macho.matchAll(/platform\s+(\S+)/g)].map(match => match[1]);
    if (!platforms.length || platforms.some(value => value !== expectedPlatform)) throw Error(`Native executable must target ${expectedPlatform}`);
    const expected = verified.config.ios?.bundleIdentifier || verified.config.bundleId || verified.config.bundleIdentifier;
    if (!expected || info.CFBundleIdentifier !== expected) throw Error('App bundle identifier does not match product');
    if (verified.config.version && info.CFBundleShortVersionString !== verified.config.version) throw Error('App marketing version does not match product');
    if (verified.config.buildNumber && String(info.CFBundleVersion) !== String(verified.config.buildNumber)) throw Error('App build number does not match product');
    if (platform === 'iPhoneOS' && signatureRequired) {
      await command('/usr/bin/codesign', ['--verify', '--deep', '--strict', app]);
      const identity = await command('/usr/bin/codesign', ['--display', '--verbose=4', app]);
      if (!/TeamIdentifier=[A-Z0-9]{10}(?:\s|$)/.test(identity) || /Signature=adhoc/.test(identity) || !/Authority=Apple Root CA(?:\s|$)/.test(identity) || !/Authority=(Apple (Development|Distribution)|iPhone (Developer|Distribution))/.test(identity)) throw Error('Real Apple code signature required');
      if (distribution && !/Authority=(Apple Distribution|iPhone Distribution)/.test(identity)) throw Error('App Store distribution signature required');
    }
    return info;
  };
  const evidence = async required => {
    const directory = path.join(root, 'release', 'receipts');
    if (!(await exists(directory))) throw Error(`Missing ${required} evidence`);
    const receipts = [];
    for (const file of await fs.readdir(directory)) {
      if (!file.endsWith('.json')) continue;
      const fullPath = path.join(directory, file);
      const r = await readJSON(fullPath);
      if (r.action === required && r.buildId === report.buildId && r.manifestHash === report.manifestHash) receipts.push({ ...r, modifiedAt: (await fs.stat(fullPath)).mtimeMs });
    }
    receipts.sort((a, b) => b.finishedAt.localeCompare(a.finishedAt) || b.modifiedAt - a.modifiedAt);
    const found = receipts[0];
    if (found && found.status !== 'passed') throw Error(`Latest ${required} execution is ${found.status}`);
    if (found && (!Number.isFinite(Date.parse(found.finishedAt)) || Date.parse(found.finishedAt) > Date.parse(now()) + 60000)) throw Error(`Invalid ${required} execution timestamp`);
    if (!found?.artifact || !(await exists(within(root, found.artifact.path))) || await artifactHash(await containedArtifact(root, found.artifact.path)) !== found.artifact.sha256) throw Error(`Missing or stale ${required} artifact evidence`);
    if (!found.commands?.length || found.commands.some(c => c.exitCode !== 0)) throw Error(`Invalid ${required} execution evidence`);
    const has = (...args) => found.commands.some(c => args.every(a => c.argv.includes(a)));
    if (required === 'device' && (found.validation !== 'physical-device-install-launch' || !found.deviceIdentifier || !has('devicectl', 'device', 'install', 'app', found.deviceIdentifier) || !has('devicectl', 'device', 'process', 'launch', found.deviceIdentifier))) throw Error('Physical device execution evidence required');
    if (required === 'simulator' && (found.validation !== 'simulator-build-only' || !has('iphonesimulator', 'build'))) throw Error('Simulator build evidence required');
    if (required === 'sign' && (found.validation !== 'signed-device-archive' || !has('iphoneos', 'archive'))) throw Error('Signed device archive evidence required');
    if (required === 'export' && (found.validation !== 'signed-app-store-ipa' || !has('-exportArchive'))) throw Error('App Store IPA export evidence required');
    if (required === 'testflight-status' && (!found.appStoreConnect || !has(`/v1/apps/${found.appStoreConnect.appId}`) || !found.commands.some(c => c.command === 'https:GET' && c.argv.some(a => a.endsWith('/buildBetaDetail'))))) throw Error('Actual App Store Connect query evidence required');
    if (required === 'upload' && (found.validation !== 'upload-accepted-processing-unverified' || !has('altool', '--upload-app'))) throw Error('Actual upload execution evidence required');
    return found;
  };
  const isPhysical = (d, id) => (!id || d.identifier === id || d.hardwareProperties?.udid === id) && d.hardwareProperties?.platform === 'iOS' && d.connectionProperties?.pairingState === 'paired' && d.connectionProperties?.tunnelState === 'connected' && ['wired', 'network'].includes(d.connectionProperties?.transportType);
  const connectedDevice = async identifier => {
    const listing = path.join(root, 'build', `devices-${crypto.randomBytes(6).toString('hex')}.json`);
    await command('/usr/bin/xcrun', ['devicectl', 'list', 'devices', '--json-output', listing]);
    const devices = (await readJSON(listing)).result?.devices || [];
    if (!devices.some(d => isPhysical(d, identifier))) throw Error('Requested physical iOS device is not connected and paired');
    return devices;
  };
  try {
    await fs.mkdir(path.join(root, 'build'), { recursive: true });
    try {
      verified = await verifyProduct(root, { repoRoot, sourceCommit: dependencies.sourceCommit, requireSources: action !== 'doctor' });
      report.buildId = verified.product.buildId; report.manifestHash = verified.manifestHash;
    } catch (error) {
      if (action !== 'doctor') throw error;
      report.issues.push(error.message);
    }
    const project = path.join(root, 'ApolloProduct.xcodeproj');
    const base = ['-project', project, '-scheme', 'ApolloProduct', '-configuration', 'Release'];
    const archive = path.join(root, 'build', 'ApolloProduct.xcarchive');
    const simulatorApp = path.join(root, 'build', 'simulator', 'Build', 'Products', 'Release-iphonesimulator', 'ApolloProduct.app');
    const archiveApp = path.join(archive, 'Products', 'Applications', 'ApolloProduct.app');
    if (action === 'doctor') {
      const probe = async (name, operation) => {
        try { return await operation(); } catch (error) { report.issues.push(`${name}: ${error.message}`); return null; }
      };
      const xcode = await probe('Xcode', () => command('/usr/bin/xcodebuild', ['-version']));
      const sdks = await probe('SDKs', () => command('/usr/bin/xcodebuild', ['-showsdks']));
      const runtimes = await probe('Simulator runtimes', async () => JSON.parse(await command('/usr/bin/xcrun', ['simctl', 'list', 'runtimes', '-j'])));
      const simulatorDevices = await probe('Simulator devices', async () => JSON.parse(await command('/usr/bin/xcrun', ['simctl', 'list', 'devices', '-j'])));
      const deviceFile = path.join(root, 'build', `doctor-devices-${crypto.randomBytes(6).toString('hex')}.json`);
      const devices = await probe('Physical devices', async () => {
        await command('/usr/bin/xcrun', ['devicectl', 'list', 'devices', '--json-output', deviceFile]);
        return readJSON(deviceFile);
      });
      report.environment = { xcode: xcode?.trim() || null, sdks: sdks?.trim() || null, runtimes: runtimes?.runtimes || [], simulatorDevices: simulatorDevices?.devices || {}, devices: devices?.result?.devices || [] };
      report.validation = 'environment-inspection-only';
      if (Number(/Xcode (\d+)/.exec(xcode || '')?.[1] || 0) < 26) report.issues.push('Xcode 26 or newer required');
      if (!/iphoneos26|iphoneos2[7-9]|iphoneos[3-9]\d/.test(sdks || '')) report.issues.push('iOS 26 or newer SDK required');
      if (!runtimes?.runtimes?.some(r => r.isAvailable === true && /iOS/.test(r.name))) report.issues.push('No available iOS simulator runtime');
      report.deviceStatus = report.environment.devices.some(d => isPhysical(d)) ? 'connected-physical-device-unvalidated' : 'blocked: no connected paired physical iOS device';
      report.status = report.commands.some(c => c.exitCode !== 0) ? 'failed' : report.issues.length ? 'blocked' : 'passed';
    } else if (action === 'simulator') {
      const runtimes = JSON.parse(await command('/usr/bin/xcrun', ['simctl', 'list', 'runtimes', '-j']));
      if (!runtimes.runtimes?.some(r => r.isAvailable === true && /iOS/.test(r.name))) throw Error('No available iOS simulator runtime; install one in Xcode Settings');
      await command('/usr/bin/xcodebuild', [...base, '-sdk', 'iphonesimulator', '-destination', 'generic/platform=iOS Simulator', '-derivedDataPath', path.join(root, 'build', 'simulator'), 'CODE_SIGNING_ALLOWED=NO', 'build']);
      await checkApp(simulatorApp, 'iPhoneSimulator');
      await attach(simulatorApp); report.status = 'passed'; report.validation = 'simulator-build-only';
    } else if (action === 'sdk-build') {
      const target = options.target || 'simulator';
      if (!['simulator', 'device'].includes(target)) throw Error('SDK build target must be simulator or device');
      report.sdkTarget = target;
      const sdk = target === 'simulator' ? 'iphonesimulator' : 'iphoneos';
      const buildRoot = path.join(root, 'build', 'sdk', target);
      const products = path.join(buildRoot, 'products');
      await command('/usr/bin/xcodebuild', ['-project', project, '-target', 'ApolloProduct', '-configuration', 'Release', '-sdk', sdk, 'ARCHS=arm64', 'ONLY_ACTIVE_ARCH=YES', 'CODE_SIGNING_ALLOWED=NO', `CONFIGURATION_BUILD_DIR=${products}`, `OBJROOT=${path.join(buildRoot, 'obj')}`, `SYMROOT=${path.join(buildRoot, 'sym')}`, 'build']);
      const app = path.join(products, 'ApolloProduct.app');
      await checkApp(app, target === 'simulator' ? 'iPhoneSimulator' : 'iPhoneOS', false, false);
      await attach(app); report.status = 'passed'; report.validation = `unsigned-${target}-sdk-build`;
    } else if (action === 'archive' || action === 'sign') {
      if (action === 'sign' && (!/^[A-Z0-9]{10}$/.test(options.teamId || '') || !options.execute)) throw Error('Signing requires --execute and explicit --team-id');
      const signing = action === 'sign' ? [`DEVELOPMENT_TEAM=${options.teamId}`, 'CODE_SIGN_STYLE=Automatic', ...(options.allowProvisioningUpdates ? ['-allowProvisioningUpdates'] : [])] : ['CODE_SIGNING_ALLOWED=NO', 'CODE_SIGNING_REQUIRED=NO'];
      await command('/usr/bin/xcodebuild', [...base, '-sdk', 'iphoneos', '-destination', 'generic/platform=iOS', '-archivePath', archive, ...signing, 'archive']);
      const info = await appInfo(archiveApp);
      await verifyPayload(archiveApp);
      if (!info.CFBundleSupportedPlatforms?.includes('iPhoneOS')) throw Error('Archive must target a physical iOS device');
      await checkApp(archiveApp, 'iPhoneOS', false, action === 'sign');
      await attach(archive); report.status = 'passed'; report.validation = action === 'sign' ? 'signed-device-archive' : 'unsigned-device-archive';
    } else if (action === 'export') {
      if (!options.execute || !options.exportOptions) throw Error('Export requires --execute and --export-options plist supplied by the account owner');
      await evidence('sign'); await checkApp(archiveApp, 'iPhoneOS');
      const exportFile = path.resolve(options.exportOptions);
      const plist = JSON.parse(await command('/usr/bin/plutil', ['-convert', 'json', '-o', '-', exportFile]));
      if (plist.method !== 'app-store-connect' && plist.method !== 'app-store') throw Error('Export method must be app-store-connect');
      await command('/usr/bin/xcodebuild', ['-exportArchive', '-archivePath', archive, '-exportPath', path.join(root, 'build', 'export'), '-exportOptionsPlist', exportFile, ...(options.allowProvisioningUpdates ? ['-allowProvisioningUpdates'] : [])]);
      const files = (await fs.readdir(path.join(root, 'build', 'export'))).filter(f => f.endsWith('.ipa'));
      if (files.length !== 1) throw Error('Export must produce exactly one IPA');
      const ipa = path.join(root, 'build', 'export', files[0]);
      await verifyIPA(ipa); await attach(ipa); report.status = 'passed'; report.validation = 'signed-app-store-ipa';
    } else if (action === 'device') {
      if (!options.execute || !options.device) throw Error('Device validation requires --execute --device <connected physical device identifier>');
      await evidence('sign'); await checkApp(archiveApp, 'iPhoneOS');
      await connectedDevice(options.device);
      const info = await appInfo(archiveApp);
      await command('/usr/bin/xcrun', ['devicectl', 'device', 'install', 'app', '--device', options.device, archiveApp]);
      await command('/usr/bin/xcrun', ['devicectl', 'device', 'process', 'launch', '--device', options.device, info.CFBundleIdentifier]);
      await attach(archiveApp); report.status = 'passed'; report.validation = 'physical-device-install-launch'; report.deviceIdentifier = options.device;
    } else if (action === 'upload') {
      if (!options.execute) throw Error('Upload requires explicit --execute; no upload was attempted');
      const exported = await evidence('export');
      const ipa = within(root, exported.artifact.path); await verifyIPA(ipa);
      const env = dependencies.env || process.env;
      const key = env.ASC_API_KEY_ID, issuer = env.ASC_API_ISSUER_ID, keyFile = env.ASC_API_PRIVATE_KEY_PATH;
      if (!/^[A-Z0-9]{10}$/.test(key || '') || !/^[0-9a-f-]{36}$/i.test(issuer || '') || !keyFile || !(await exists(keyFile)) || path.basename(keyFile) !== `AuthKey_${key}.p8`) throw Error('Provide ASC_API_KEY_ID, ASC_API_ISSUER_ID and ASC_API_PRIVATE_KEY_PATH (AuthKey_<key-id>.p8) through environment');
      await command('/usr/bin/xcrun', ['altool', '--upload-app', '-f', ipa, '--type', 'ios', '--apiKey', key, '--apiIssuer', issuer], { env: { ...env, API_PRIVATE_KEYS_DIR: path.dirname(path.resolve(keyFile)) } });
      await attach(ipa); report.status = 'passed'; report.validation = 'upload-accepted-processing-unverified';
    } else if (action === 'testflight-status') {
      if (!options.execute) throw Error('App Store Connect query requires explicit --execute');
      const uploaded = await evidence('upload');
      const exported = await evidence('export');
      if (uploaded.artifact.sha256 !== exported.artifact.sha256) throw Error('Upload does not match signed export');
      report.appStoreConnect = await queryTestFlight(verified.config, uploaded, dependencies, report);
      await attach(within(root, exported.artifact.path));
      report.validation = report.appStoreConnect.state;
      if (['available-for-testing', 'distributed'].includes(report.validation)) report.status = 'passed';
      else { report.status = 'blocked'; report.issues.push(`App Store Connect build is ${report.validation}`); }
    } else if (action === 'gate') {
      const target = options.target || 'testflight';
      report.target = target; report.issues.push(...metadataIssues(verified.config));
      const icon = verified.config.icon || verified.config.appIcon || verified.config.appStore?.icon || verified.config.store?.icon;
      if (typeof icon === 'string' && !Object.keys(verified.product.files).includes(icon) && !Object.keys(verified.product.sourceFiles || {}).includes(icon)) report.issues.push('Provided product icon is not covered by build evidence');
      if (target === 'simulator') { const r = await evidence('simulator'); await checkApp(within(root, r.artifact.path), 'iPhoneSimulator'); report.validation = 'simulator-build-only'; }
      else if (target === 'device') { const r = await evidence('device'); await connectedDevice(r.deviceIdentifier); await checkApp(within(root, r.artifact.path), 'iPhoneOS'); report.validation = 'physical-device-install-launch'; }
      else if (target === 'testflight') {
        const device = await evidence('device'); await connectedDevice(device.deviceIdentifier); const exported = await evidence('export'); await verifyIPA(within(root, exported.artifact.path));
        const uploaded = await evidence('upload');
        const remote = await evidence('testflight-status');
        if (remote.artifact.sha256 !== exported.artifact.sha256 || uploaded.artifact.sha256 !== exported.artifact.sha256) throw Error('App Store Connect evidence does not match exported IPA');
        if (Date.parse(now()) - Date.parse(remote.finishedAt) > 60 * 60 * 1000 || Date.parse(remote.finishedAt) > Date.parse(now()) + 60000) throw Error('App Store Connect status evidence is stale; explicitly query again');
        if (!['available-for-testing', 'distributed'].includes(remote.appStoreConnect?.state)) throw Error('TestFlight availability is unverified');
        report.validation = remote.appStoreConnect.state; report.appStoreConnect = remote.appStoreConnect;
      } else throw Error('Gate target must be simulator, device or testflight');
      report.status = report.issues.length ? 'blocked' : 'passed';
    } else throw Error(`Unknown release action: ${action}`);
  } catch (error) { report.issues.push(error.message); report.status = report.commands.some(c => c.exitCode !== 0) ? 'failed' : 'blocked'; }
  report.finishedAt = now();
  try { await assertSafeOutputTree(root); } catch (error) {
    report.status = 'blocked'; report.artifact = null; report.issues.push(error.message); report.persistence = 'blocked: unsafe output paths'; return report;
  }
  const receipts = path.join(root, 'release', 'receipts'); await fs.mkdir(receipts, { recursive: true });
  const id = `${report.finishedAt.replace(/[^0-9]/g, '')}-${crypto.randomBytes(4).toString('hex')}`;
  await assertSafeOutputTree(root);
  await fs.writeFile(path.join(receipts, `${id}.json`), `${JSON.stringify(report, null, 2)}\n`);
  const stateFile = path.join(root, 'release', 'status.json');
  const state = await readJSON(stateFile).catch(() => ({ schemaVersion: 1, actions: {} }));
  if (state.buildId !== report.buildId || state.manifestHash !== report.manifestHash) state.actions = {};
  state.buildId = report.buildId; state.manifestHash = report.manifestHash;
  state.actions[action === 'gate' ? `gate:${report.target || options.target || 'testflight'}` : action === 'sdk-build' ? `sdk-build:${report.sdkTarget || options.target || 'simulator'}` : action] = report;
  await assertSafeOutputTree(root);
  await fs.writeFile(stateFile, `${JSON.stringify(state, null, 2)}\n`);
  return report;

  async function verifyIPA(ipa) {
    const directory = path.join(root, 'build', `verify-ipa-${crypto.randomBytes(6).toString('hex')}`);
    await fs.mkdir(directory, { recursive: true });
    try {
      await command('/usr/bin/ditto', ['-x', '-k', ipa, directory]);
      const payload = path.join(directory, 'Payload');
      const apps = (await fs.readdir(payload)).filter(f => f.endsWith('.app'));
      if (apps.length !== 1) throw Error('IPA must contain exactly one app');
      await checkApp(path.join(payload, apps[0]), 'iPhoneOS', true);
    } finally { await fs.rm(directory, { recursive: true, force: true }); }
  }
}


/** Apple official contracts: /v1/apps/{id}/builds; preReleaseVersion; buildBetaDetail.
 * https://developer.apple.com/documentation/appstoreconnectapi/get-v1-apps-_id_-builds
 * https://developer.apple.com/documentation/appstoreconnectapi/internalbetastate
 * https://developer.apple.com/documentation/appstoreconnectapi/generating-tokens-for-api-requests
 * No response bodies, JWTs or private key material are persisted.
 */
async function queryTestFlight(config, uploaded, dependencies, report) {
  const env = dependencies.env || process.env;
  const appId = env.ASC_APP_ID, keyId = env.ASC_API_KEY_ID, issuer = env.ASC_API_ISSUER_ID, keyPath = env.ASC_API_PRIVATE_KEY_PATH;
  if (!/^[0-9]+$/.test(appId || '') || !/^[A-Z0-9]{10}$/.test(keyId || '') || !/^[0-9a-f-]{36}$/i.test(issuer || '') || !keyPath) throw Error('Provide ASC_APP_ID and ASC_API_* credentials through environment for an explicit status query');
  let token;
  try {
    const issued = Math.floor(Date.now() / 1000);
    const enc = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const input = `${enc({ alg: 'ES256', kid: keyId, typ: 'JWT' })}.${enc({ iss: issuer, iat: issued, exp: issued + 120, aud: 'appstoreconnect-v1' })}`;
    const privateKey = await fs.readFile(keyPath);
    const key = crypto.createPrivateKey(privateKey);
    if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') throw Error();
    token = `${input}.${crypto.sign('sha256', Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
  } catch { throw Error('Cannot create App Store Connect ES256 authentication token from supplied environment credentials'); }
  const fetchImpl = dependencies.fetch || globalThis.fetch;
  const request = async route => {
    const url = new URL(route, 'https://api.appstoreconnect.apple.com');
    if (url.origin !== 'https://api.appstoreconnect.apple.com' || !url.pathname.startsWith('/v1/')) throw Error('Invalid App Store Connect pagination endpoint');
    let response;
    try { response = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}` }, redirect: 'error', signal: AbortSignal.timeout(30000) }); }
    catch { throw Error('App Store Connect request failed'); }
    report.commands.push({ command: 'https:GET', argv: [url.pathname + url.search], exitCode: response.ok ? 0 : 1, httpStatus: response.status });
    if (!response.ok) throw Error(`App Store Connect returned HTTP ${response.status}`);
    try { return await response.json(); } catch { throw Error('App Store Connect returned an invalid JSON response'); }
  };
  const app = (await request(`/v1/apps/${encodeURIComponent(appId)}`)).data;
  if (app?.type !== 'apps' || app.id !== appId || app.attributes?.bundleId !== (config.ios?.bundleIdentifier || config.bundleId)) throw Error('App Store Connect app does not match product bundle identifier');
  const candidates = []; let route = `/v1/apps/${encodeURIComponent(appId)}/builds?limit=200`;
  for (let page = 0; route && page < 50; page++) {
    const listing = await request(route);
    if (!Array.isArray(listing.data)) throw Error('App Store Connect build response is invalid');
    candidates.push(...listing.data.filter(b => b.type === 'builds' && b.attributes?.version === String(config.buildNumber)));
    route = listing.links?.next;
  }
  if (route) throw Error('App Store Connect build pagination limit exceeded');
  const matches = [];
  for (const build of candidates) {
    const version = (await request(`/v1/builds/${encodeURIComponent(build.id)}/preReleaseVersion`)).data;
    if (version?.type === 'preReleaseVersions' && version.attributes?.version === config.version && version.attributes.platform === 'IOS') matches.push(build);
  }
  if (matches.length !== 1) throw Error('No unique App Store Connect build matches product version and build number');
  const build = matches[0], attrs = build.attributes;
  if (!Number.isFinite(Date.parse(attrs.uploadedDate)) || Date.parse(attrs.uploadedDate) > Date.now() + 5 * 60000 || Date.parse(attrs.uploadedDate) < Date.parse(uploaded.startedAt) - 5 * 60000) throw Error('Remote build predates this product upload evidence');
  const beta = (await request(`/v1/builds/${encodeURIComponent(build.id)}/buildBetaDetail`)).data;
  if (beta?.type !== 'buildBetaDetails') throw Error('App Store Connect beta build detail is missing');
  const internal = beta.attributes?.internalBuildState, external = beta.attributes?.externalBuildState;
  let state = 'uploaded';
  if (attrs.expired === true || Date.parse(attrs.expirationDate) <= Date.now()) state = 'expired';
  else if (['FAILED', 'INVALID'].includes(attrs.processingState)) state = 'invalid';
  else if (attrs.processingState === 'PROCESSING') state = 'processing';
  else if (attrs.processingState === 'VALID') {
    if (attrs.expired !== false || !Number.isFinite(Date.parse(attrs.expirationDate))) throw Error('App Store Connect build expiration evidence is missing');
    if ([internal, external].includes('IN_BETA_TESTING')) state = 'distributed';
    else if (internal === 'READY_FOR_BETA_TESTING' || external === 'READY_FOR_BETA_TESTING') state = 'available-for-testing';
    else state = 'blocked';
  } else throw Error('Unknown App Store Connect processing state');
  return { appId, ascBuildId: build.id, bundleId: (config.ios?.bundleIdentifier || config.bundleId), version: config.version, buildNumber: String(config.buildNumber), uploadedDate: attrs.uploadedDate, processingState: attrs.processingState, internalBuildState: internal, externalBuildState: external, state };
}
