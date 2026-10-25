import { it as test } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { canonicalJSON, sha256, verifyProduct, runReleaseAction, artifactHash } from './ios-release.mjs';
const commit = 'a'.repeat(40);
const success = stdout => ({ exitCode: 0, stdout: typeof stdout === 'string' ? stdout : JSON.stringify(stdout), stderr: '' });
async function fixture(t, { metadata = true, runtime = true, devices = [], failCommand, platformOverride, machoPlatformOverride } = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'apollo-ios-release-test-'));
  t.onTestFinished(() => fs.rm(dir, { recursive: true, force: true }));
  const root = path.join(dir, 'product'); await fs.mkdir(root);
  const config = { schemaVersion: 1, id: 'test-product', version: '1.0.0', buildNumber: 7, ios: { bundleIdentifier: 'com.apollo.fixture' }, ...(metadata ? { icon: 'icon.png', store: { privacyPolicyURL: 'https://apollo.test/privacy', supportURL: 'https://apollo.test/support', ageRating: '4+', exportCompliance: { usesNonExemptEncryption: false } } } : {}) };
  await fs.writeFile(path.join(dir, 'source.js'), 'export const product = 1;');
  await fs.writeFile(path.join(dir, 'icon.png'), 'fixture-png');
  await fs.mkdir(path.join(root, 'www')); await fs.writeFile(path.join(root, 'www', 'index.html'), 'actual product');
  await fs.mkdir(path.join(root, 'ApolloProduct.xcodeproj')); await fs.writeFile(path.join(root, 'ApolloProduct.xcodeproj', 'project.pbxproj'), 'project');
  await fs.writeFile(path.join(root, 'product.json'), JSON.stringify(config));
  const product = { schemaVersion: 1, productId: config.id, sourceCommit: commit, configHash: sha256(canonicalJSON(config)), files: {}, sourceFiles: {} };
  for (const f of ['www/index.html', 'ApolloProduct.xcodeproj/project.pbxproj', 'product.json']) product.files[f] = sha256(await fs.readFile(path.join(root, f)));
  for (const f of ['source.js', 'icon.png']) product.sourceFiles[f] = sha256(await fs.readFile(path.join(dir, f)));
  product.buildId = sha256(canonicalJSON(product)); product.sourceRoot = dir;
  await fs.writeFile(path.join(root, 'product-build.json'), JSON.stringify(product));
  const app = async (target, platform) => {
    await fs.mkdir(path.join(target, 'www'), { recursive: true });
    await fs.copyFile(path.join(root, 'www/index.html'), path.join(target, 'www/index.html'));
    await fs.writeFile(path.join(target, 'ApolloProduct'), 'native executable fixture');
    await fs.writeFile(path.join(target, 'Info.plist'), JSON.stringify({ CFBundleIdentifier: config.ios.bundleIdentifier, CFBundleExecutable: 'ApolloProduct', CFBundleVersion: String(config.buildNumber), CFBundleShortVersionString: config.version, CFBundleSupportedPlatforms: [platformOverride || platform] }));
  };
  const run = async (bin, argv) => {
    if (failCommand && argv.includes(failCommand)) return { exitCode: 65, stdout: 'secret-output', stderr: 'build failure' };
    if (bin.endsWith('plutil')) return success(await fs.readFile(argv.at(-1), 'utf8'));
    if (bin.endsWith('codesign')) return success(argv.includes('--display') ? 'Authority=Apple Distribution: Fixture\nTeamIdentifier=ABCD123456\nAuthority=Apple Root CA\n' : '');
    if (argv.includes('altool')) return success('sensitive API key ABCD123456 should never appear in logs');
    if (argv.includes('vtool')) return success(`platform ${machoPlatformOverride || ((argv.at(-1).includes('Release-iphonesimulator') || argv.at(-1).includes('/sdk/simulator/')) ? 'IOSSIMULATOR' : 'IOS')}\n`);
    if (argv.includes('simctl') && argv.includes('devices')) return success({ devices: {} });
    if (argv.includes('simctl')) return success({ runtimes: runtime ? [{ name: 'iOS 26.0', isAvailable: true }] : [] });
    if (argv.includes('devicectl')) {
      if (argv.includes('list')) await fs.writeFile(argv[argv.indexOf('--json-output') + 1], JSON.stringify({ result: { devices } }));
      return success('');
    }
    if (bin.endsWith('xcodebuild')) {
      if (argv.includes('-version')) return success('Xcode 26.0\nBuild version 17A');
      if (argv.includes('-showsdks')) return success('iphoneos26.0 iphonesimulator26.0');
      if (argv.includes('archive')) await app(path.join(root, 'build/ApolloProduct.xcarchive/Products/Applications/ApolloProduct.app'), 'iPhoneOS');
      if (argv.includes('build')) {
        const output = argv.find(a => a.startsWith('CONFIGURATION_BUILD_DIR='));
        await app(output ? path.join(output.slice('CONFIGURATION_BUILD_DIR='.length), 'ApolloProduct.app') : path.join(root, 'build/simulator/Build/Products/Release-iphonesimulator/ApolloProduct.app'), argv.includes('iphoneos') ? 'iPhoneOS' : 'iPhoneSimulator');
      }
      if (argv.includes('-exportArchive')) { await fs.mkdir(path.join(root, 'build/export'), { recursive: true }); await fs.writeFile(path.join(root, 'build/export/ApolloProduct.ipa'), 'signed-ipa'); }
      return success('');
    }
    if (bin.endsWith('ditto')) { await app(path.join(argv.at(-1), 'Payload/ApolloProduct.app'), 'iPhoneOS'); return success(''); }
    throw Error(`Unexpected test command: ${bin} ${argv.join(' ')}`);
  };
  const deps = { run, sourceCommit: commit };
  const invoke = (action, options = {}, extra = {}) => runReleaseAction(action, root, options, { ...deps, ...extra });
  const signed = async () => { const r = await invoke('sign', { execute: true, teamId: 'ABCD123456' }); assert.equal(r.status, 'passed', r.issues.join('\n')); };
  const exported = async () => { await signed(); const file = path.join(dir, 'ExportOptions.plist'); await fs.writeFile(file, JSON.stringify({ method: 'app-store-connect' })); const r = await invoke('export', { execute: true, exportOptions: file }); assert.equal(r.status, 'passed', r.issues.join('\n')); };
  return { dir, root, product, config, deps, invoke, exported, devices };
}
test('receipt identity and current files must match; manifest edits cannot retain buildId', async t => {
  const f = await fixture(t); assert.equal((await verifyProduct(f.root, { sourceCommit: commit })).product.buildId, f.product.buildId);
  await fs.writeFile(path.join(f.root, 'www/index.html'), 'tampered');
  await assert.rejects(verifyProduct(f.root, { sourceCommit: commit }), /artifact changed/);
  f.product.files['www/index.html'] = sha256('tampered'); await fs.writeFile(path.join(f.root, 'product-build.json'), JSON.stringify(f.product));
  await assert.rejects(verifyProduct(f.root, { sourceCommit: commit }), /buildId/);
});
test('dirty source edits and changed source commits reject old evidence', async t => {
  const f = await fixture(t); await fs.writeFile(path.join(f.dir, 'source.js'), 'different');
  await assert.rejects(verifyProduct(f.root, { sourceCommit: commit }), /Source changed/);
  const g = await fixture(t); await assert.rejects(verifyProduct(g.root, { sourceCommit: 'b'.repeat(40) }), /Source commit changed/);
});
test('doctor cannot report ready when simulator runtime is absent', async t => {
  const f = await fixture(t, { runtime: false }); const r = await f.invoke('doctor');
  assert.equal(r.status, 'blocked'); assert.match(r.issues.join(' '), /No available iOS simulator runtime/); assert.match(r.deviceStatus, /no connected/);
});
test('missing runtime prevents simulator invocation and records no fake build', async t => {
  const f = await fixture(t, { runtime: false }); const r = await f.invoke('simulator');
  assert.equal(r.status, 'blocked'); assert.equal(r.commands.length, 1); assert.equal(r.artifact, null);
});
test('execution failures remain failed with actual exit code', async t => {
  const f = await fixture(t, { failCommand: 'build' }); const r = await f.invoke('simulator');
  assert.equal(r.status, 'failed'); assert.equal(r.commands.at(-1).exitCode, 65); assert.equal(r.artifact, null);
});
test('unsigned simulator and archive states cannot satisfy device or TestFlight gate', async t => {
  const f = await fixture(t); assert.equal((await f.invoke('simulator')).status, 'passed');
  const archive = await f.invoke('archive'); assert.equal(archive.validation, 'unsigned-device-archive');
  const r = await f.invoke('gate', { target: 'device' }); assert.equal(r.status, 'blocked'); assert.match(r.issues.join(' '), /device/);
  const tf = await f.invoke('gate'); assert.equal(tf.status, 'blocked');
});
test('real simulator gate checks artifact existence and metadata', async t => {
  const f = await fixture(t); await f.invoke('simulator'); assert.equal((await f.invoke('gate', { target: 'simulator' })).status, 'passed');
  await fs.writeFile(path.join(f.root, 'build/simulator/Build/Products/Release-iphonesimulator/ApolloProduct.app/www/index.html'), 'another app');
  assert.equal((await f.invoke('gate', { target: 'simulator' })).status, 'blocked');
  const g = await fixture(t, { metadata: false }); await g.invoke('simulator');
  const r = await g.invoke('gate', { target: 'simulator' }); assert.equal(r.status, 'blocked'); assert.match(r.issues.join(' '), /privacyPolicyURL/);
});
test('a simulator app cannot masquerade as a physical archive', async t => {
  const f = await fixture(t, { platformOverride: 'iPhoneSimulator' }); const r = await f.invoke('sign', { execute: true, teamId: 'ABCD123456' });
  assert.equal(r.status, 'blocked'); assert.match(r.issues.join(' '), /physical iOS device/);
});
test('device checks reject disconnected devices even with requested execute', async t => {
  const f = await fixture(t); await f.exported(); const r = await f.invoke('device', { execute: true, device: 'some-simulator-uuid' });
  assert.equal(r.status, 'blocked'); assert.match(r.issues.join(' '), /not connected and paired/);
});
test('upload requires explicit execution and does not persist credentials or command output', async t => {
  const f = await fixture(t); await f.exported();
  const key = path.join(f.dir, 'AuthKey_ZYXW987654.p8'); await fs.writeFile(key, 'PRIVATE KEY SHOULD NEVER APPEAR');
  const env = { ASC_API_KEY_ID: 'ZYXW987654', ASC_API_ISSUER_ID: '12345678-1234-1234-1234-123456789abc', ASC_API_PRIVATE_KEY_PATH: key };
  assert.equal((await f.invoke('upload', {}, { env })).status, 'blocked');
  const r = await f.invoke('upload', { execute: true }, { env }); assert.equal(r.status, 'passed'); assert.equal(r.validation, 'upload-accepted-processing-unverified');
  const serialized = JSON.stringify(r); for (const value of Object.values(env)) assert.ok(!serialized.includes(value));
  assert.ok(!serialized.includes('sensitive API key')); assert.ok(r.commands.at(-1).argv.includes('[REDACTED]'));
  const disk = await fs.readFile(path.join(f.root, 'release/status.json'), 'utf8'); assert.ok(!disk.includes(env.ASC_API_KEY_ID));
  assert.equal((await f.invoke('gate')).status, 'blocked');
});
async function remoteFixture(t, processingState = 'VALID', internalBuildState = 'READY_FOR_BETA_TESTING') {
  const f = await fixture(t); await f.exported();
  const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1', privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
  const key = path.join(f.dir, 'AuthKey_ZYXW987654.p8'); await fs.writeFile(key, privateKey);
  const env = { ASC_APP_ID: '123456789', ASC_API_KEY_ID: 'ZYXW987654', ASC_API_ISSUER_ID: '12345678-1234-1234-1234-123456789abc', ASC_API_PRIVATE_KEY_PATH: key };
  const uploaded = await f.invoke('upload', { execute: true }, { env }); assert.equal(uploaded.status, 'passed');
  const responses = {
    '/v1/apps/123456789': { data: { id: '123456789', type: 'apps', attributes: { bundleId: f.config.ios.bundleIdentifier } } },
    '/v1/apps/123456789/builds': { data: [{ id: 'apple-build-id', type: 'builds', attributes: { version: '7', processingState, expired: false, expirationDate: new Date(Date.now() + 86400000).toISOString(), uploadedDate: new Date().toISOString() } }] },
    '/v1/builds/apple-build-id/preReleaseVersion': { data: { type: 'preReleaseVersions', attributes: { version: '1.0.0', platform: 'IOS' } } },
    '/v1/builds/apple-build-id/buildBetaDetail': { data: { type: 'buildBetaDetails', attributes: { internalBuildState, externalBuildState: 'READY_FOR_BETA_SUBMISSION' } } },
  };
  const fetch = async (url, options) => {
    assert.equal(url.origin, 'https://api.appstoreconnect.apple.com'); assert.ok(options.headers.Authorization.startsWith('Bearer '));
    const token = options.headers.Authorization.slice(7), payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url')); assert.equal(payload.aud, 'appstoreconnect-v1'); assert.equal(payload.exp - payload.iat, 120);
    return { ok: true, status: 200, json: async () => responses[url.pathname] };
  };
  return { ...f, env, fetch, responses, privateKey };
}
test('ASC statuses distinguish processing, testing availability and actual testing distribution', async t => {
  for (const [processing, internal, expected, status] of [['PROCESSING', 'PROCESSING', 'processing', 'blocked'], ['VALID', 'READY_FOR_BETA_TESTING', 'available-for-testing', 'passed'], ['VALID', 'IN_BETA_TESTING', 'distributed', 'passed']]) {
    const f = await remoteFixture(t, processing, internal); const r = await f.invoke('testflight-status', { execute: true }, { env: f.env, fetch: f.fetch });
    assert.equal(r.validation, expected, r.issues.join(' ')); assert.equal(r.status, status);
    const serialized = JSON.stringify(r); assert.ok(!serialized.includes(f.privateKey)); assert.ok(!serialized.includes('Bearer')); assert.ok(!serialized.includes(f.env.ASC_API_ISSUER_ID));
  }
});
test('ASC app identity mismatch, old remote builds and failed HTTP requests never pass', async t => {
  const f = await remoteFixture(t); f.responses['/v1/apps/123456789'].data.attributes.bundleId = 'different.app';
  assert.equal((await f.invoke('testflight-status', { execute: true }, { env: f.env, fetch: f.fetch })).status, 'blocked');
  f.responses['/v1/apps/123456789'].data.attributes.bundleId = f.config.ios.bundleIdentifier;
  f.responses['/v1/apps/123456789/builds'].data[0].attributes.uploadedDate = '2001-01-01T00:00:00Z';
  assert.equal((await f.invoke('testflight-status', { execute: true }, { env: f.env, fetch: f.fetch })).status, 'blocked');
  const failed = await f.invoke('testflight-status', { execute: true }, { env: f.env, fetch: async () => ({ ok: false, status: 401 }) });
  assert.equal(failed.status, 'failed'); assert.ok(!JSON.stringify(failed).includes(f.env.ASC_API_ISSUER_ID));
});
test('a hand-edited simulator receipt cannot replace a device install/launch', async t => {
  const f = await fixture(t); const sim = await f.invoke('simulator');
  sim.action = 'device'; sim.validation = 'physical-device-install-launch'; sim.deviceIdentifier = 'fake';
  await fs.writeFile(path.join(f.root, 'release/receipts/forged.json'), JSON.stringify(sim));
  const r = await f.invoke('gate', { target: 'device' }); assert.equal(r.status, 'blocked'); assert.match(r.issues.join(' '), /Physical device execution evidence/);
});
test('manifest path traversal is rejected before reading out-of-product files', async t => {
  const f = await fixture(t); f.product.files['../source.js'] = sha256('export const product = 1;');
  const { buildId, sourceRoot, ...identity } = f.product; f.product.buildId = sha256(canonicalJSON(identity));
  await fs.writeFile(path.join(f.root, 'product-build.json'), JSON.stringify(f.product));
  await assert.rejects(verifyProduct(f.root, { sourceCommit: commit }), /Unsafe evidence path/);
});

const physical = { identifier: 'real-device-identifier', hardwareProperties: { platform: 'iOS', udid: 'physical-udid' }, connectionProperties: { pairingState: 'paired', tunnelState: 'connected', transportType: 'wired' } };
test('a current signed product with connected hardware and ASC confirmation can pass TestFlight gate', async t => {
  const f = await remoteFixture(t); f.devices.push(physical);
  const device = await f.invoke('device', { execute: true, device: physical.identifier }); assert.equal(device.status, 'passed', device.issues.join(' '));
  const remote = await f.invoke('testflight-status', { execute: true }, { env: f.env, fetch: f.fetch }); assert.equal(remote.status, 'passed');
  const gate = await f.invoke('gate', { target: 'testflight' }); assert.equal(gate.status, 'passed', gate.issues.join(' ')); assert.equal(gate.validation, 'available-for-testing');
  f.devices.length = 0;
  const disconnected = await f.invoke('gate', { target: 'device' }); assert.equal(disconnected.status, 'blocked'); assert.match(disconnected.issues.join(' '), /not connected/);
});
test('a stale ASC confirmation and a later processing response cannot reuse an earlier green state', async t => {
  const f = await remoteFixture(t); f.devices.push(physical); await f.invoke('device', { execute: true, device: physical.identifier });
  assert.equal((await f.invoke('testflight-status', { execute: true }, { env: f.env, fetch: f.fetch })).status, 'passed');
  const future = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const old = await f.invoke('gate', {}, { now: () => future }); assert.equal(old.status, 'blocked'); assert.match(old.issues.join(' '), /stale/);
  f.responses['/v1/apps/123456789/builds'].data[0].attributes.processingState = 'PROCESSING';
  assert.equal((await f.invoke('testflight-status', { execute: true }, { env: f.env, fetch: f.fetch })).status, 'blocked');
  const latest = await f.invoke('gate'); assert.equal(latest.status, 'blocked'); assert.match(latest.issues.join(' '), /Latest testflight-status execution is blocked/);
});
test('an extra generated file or an extra embedded web file cannot evade the manifest', async t => {
  const f = await fixture(t); await fs.writeFile(path.join(f.root, 'www/unlisted.js'), 'unhashed source');
  await assert.rejects(verifyProduct(f.root, { sourceCommit: commit }), /does not cover every generated file/);
  const g = await fixture(t); await g.invoke('simulator');
  const app = path.join(g.root, 'build/simulator/Build/Products/Release-iphonesimulator/ApolloProduct.app');
  await fs.writeFile(path.join(app, 'www/unlisted.js'), 'unhashed code');
  const r = await g.invoke('gate', { target: 'simulator' }); assert.equal(r.status, 'blocked');
});

test('Mach-O simulator platform is rejected even if Info.plist claims iPhoneOS', async t => {
  const f = await fixture(t, { machoPlatformOverride: 'IOSSIMULATOR' });
  const r = await f.invoke('sign', { execute: true, teamId: 'ABCD123456' }); assert.equal(r.status, 'blocked'); assert.match(r.issues.join(' '), /executable must target IOS/);
});

test('build and release symlinks reject before commands or writes can escape the product', async t => {
  for (const relative of ['build', 'build/simulator', 'release', 'release/receipts']) {
    const f = await fixture(t); const outside = path.join(f.dir, 'outside'); await fs.mkdir(outside);
    await fs.mkdir(path.dirname(path.join(f.root, relative)), { recursive: true });
    await fs.symlink(outside, path.join(f.root, relative));
    const r = await f.invoke('simulator'); assert.equal(r.status, 'blocked'); assert.match(r.issues.join(' '), /Output symlink/); assert.equal(r.commands.length, 0);
    assert.deepEqual(await fs.readdir(outside), []);
  }
});
test('an artifact or receipt symlink created after execution cannot become passing evidence', async t => {
  const f = await fixture(t); await f.invoke('simulator');
  const app = path.join(f.root, 'build/simulator/Build/Products/Release-iphonesimulator/ApolloProduct.app');
  const outside = path.join(f.dir, 'outside-app'); await fs.rename(app, outside); await fs.symlink(outside, app);
  const r = await f.invoke('gate', { target: 'simulator' }); assert.equal(r.status, 'blocked'); assert.match(r.issues.join(' '), /Output symlink/);
  const g = await fixture(t); await g.invoke('simulator'); const status = path.join(g.root, 'release/status.json');
  const secret = path.join(g.dir, 'must-not-overwrite.txt'); await fs.writeFile(secret, 'keep'); await fs.rm(status); await fs.symlink(secret, status);
  assert.equal((await g.invoke('gate', { target: 'simulator' })).status, 'blocked'); assert.equal(await fs.readFile(secret, 'utf8'), 'keep');
});

test('SDK target builds work without runtime and never substitute for simulator, device or archive evidence', async t => {
  const f = await fixture(t, { runtime: false });
  for (const target of ['simulator', 'device']) {
    const r = await f.invoke('sdk-build', { target }); assert.equal(r.status, 'passed', r.issues.join(' ')); assert.equal(r.validation, `unsigned-${target}-sdk-build`);
    assert.ok(r.commands.some(c => c.argv.includes('-target'))); assert.ok(!r.commands.some(c => c.argv.includes('simctl') || c.argv.includes('-scheme') || c.argv.includes('archive')));
    assert.equal((await f.invoke('gate', { target })).status, 'blocked');
  }
  assert.equal((await f.invoke('sdk-build', { target: 'testflight' })).status, 'blocked');
});
