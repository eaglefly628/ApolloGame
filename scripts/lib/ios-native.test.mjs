import { it as test } from 'vitest';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile, access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { generateIOSProject } from './ios-native.mjs';

const product = { id: 'test-game', title: 'Game & "Name"', version: '1.2.3', buildNumber: 7, viewport: { width: 390, height: 844, orientation: 'portrait' }, ios: { bundleIdentifier: 'com.example.apollo', minimumOS: '15.0' } };
async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'apollo-ios-test-'));
  t.onTestFinished(() => rm(root, { recursive: true, force: true }));
  const webDir = path.join(root, 'web');
  const outputDir = path.join(root, 'output');
  await mkdir(webDir);
  await mkdir(path.join(webDir, 'assets'));
  await writeFile(path.join(webDir, 'index.html'), '<!doctype html><title>Game</title>');
  await writeFile(path.join(webDir, 'assets', 'game.js'), 'window.game=true;');
  return { root, webDir, outputDir, product: structuredClone(product) };
}

test('generates scheme, complete nested web resources, escaped metadata and privacy manifest', async t => {
  const args = await fixture(t);
  const result = await generateIOSProject(args);
  assert.equal(result.scheme, 'ApolloProduct');
  assert.equal(await readFile(path.join(result.webDir, 'assets/game.js'), 'utf8'), 'window.game=true;');
  const plist = await readFile(path.join(args.outputDir, 'ApolloProduct/Info.plist'), 'utf8');
  assert.match(plist, /Game &amp; &quot;Name&quot;/);
  assert.match(plist, /UIInterfaceOrientationPortrait/);
  assert.doesNotMatch(plist, /UsageDescription|NonExemptEncryption|NSAppTransportSecurity|UIBackgroundModes/);
  const privacy = await readFile(path.join(args.outputDir, 'ApolloProduct/PrivacyInfo.xcprivacy'), 'utf8');
  assert.match(privacy, /NSPrivacyTracking<\/key><false\/>/);
  assert.match(privacy, /NSPrivacyAccessedAPITypes<\/key><array\/>/);
  await access(path.join(result.projectPath, 'xcshareddata/xcschemes/ApolloProduct.xcscheme'));
});

test('uses an already built outputDir/www without recursively copying itself', async t => {
  const args = await fixture(t);
  args.outputDir = args.root;
  args.webDir = path.join(args.root, 'www');
  await mkdir(args.webDir);
  await writeFile(path.join(args.webDir, 'index.html'), 'already built');
  const result = await generateIOSProject(args);
  assert.equal(await readFile(path.join(result.webDir, 'index.html'), 'utf8'), 'already built');
});

test('rejects malformed product settings before generating native code', async t => {
  const cases = [
    ['id', '../escape'], ['title', 'bad\0title'], ['version', '1.0; injected=YES'],
    ['buildNumber', '0'], ['viewport', { width: 1, height: 1, orientation: 'anything' }],
    ['ios', { bundleIdentifier: 'x"; BAD = YES;', minimumOS: '15.0' }],
    ['ios', { bundleIdentifier: 'com.example.game', minimumOS: '14.0' }]
  ];
  for (const [key, value] of cases) {
    const args = await fixture(t);
    args.product[key] = value;
    await assert.rejects(generateIOSProject(args), /Invalid|at least/);
    await assert.rejects(access(args.outputDir));
  }
});

test('rejects nested or root symlinks and missing index; refuses copying across overlapping paths', async t => {
  const args = await fixture(t);
  await symlink('/etc/hosts', path.join(args.webDir, 'assets', 'escape'));
  await assert.rejects(generateIOSProject(args), /symlink/);
  await rm(path.join(args.webDir, 'assets', 'escape'));
  await symlink(args.webDir, path.join(args.root, 'linked-web'));
  await assert.rejects(generateIOSProject({ ...args, webDir: path.join(args.root, 'linked-web') }), /real directory/);
  await rm(path.join(args.root, 'linked-web'));
  await assert.rejects(generateIOSProject({ ...args, outputDir: path.join(args.webDir, 'out') }), /Overlapping/);
  await assert.rejects(generateIOSProject({ ...args, outputDir: args.root }), /Overlapping/);
  await rm(path.join(args.webDir, 'index.html'));
  await assert.rejects(generateIOSProject(args), /ENOENT/);
});

test('refuses stale copied resource trees and invalid app icons', async t => {
  const args = await fixture(t);
  await mkdir(path.join(args.outputDir, 'www'), { recursive: true });
  await assert.rejects(generateIOSProject(args), /already exists/);
  await rm(args.outputDir, { recursive: true });
  const icon = path.join(args.root, 'icon.png');
  await writeFile(icon, 'not a PNG');
  await assert.rejects(generateIOSProject({ ...args, product: { ...args.product, icon } }), /1024 x 1024 PNG/);
  await assert.rejects(access(args.outputDir));
});

test('landscape and all orientations are emitted declaratively', async t => {
  for (const orientation of ['landscape', 'all']) {
    const args = await fixture(t);
    args.product.viewport.orientation = orientation;
    await generateIOSProject(args);
    const plist = await readFile(path.join(args.outputDir, 'ApolloProduct/Info.plist'), 'utf8');
    assert.match(plist, /UIInterfaceOrientationLandscapeLeft/);
    assert.equal(plist.includes('UIInterfaceOrientationPortrait</string>'), orientation === 'all');
  }
});

test('rejects pre-existing output symlinks before writing native sources or project files', async t => {
  for (const relative of ['ApolloProduct', 'ApolloProduct/AppDelegate.swift', 'ApolloProduct/Info.plist', 'ApolloProduct.xcodeproj', 'ApolloProduct.xcodeproj/project.pbxproj', 'ApolloProduct.xcodeproj/xcshareddata', 'ApolloProduct.xcodeproj/xcshareddata/xcschemes']) {
    const args = await fixture(t);
    const outside = path.join(args.root, 'outside'); await mkdir(outside);
    const destination = path.join(args.outputDir, relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await symlink(outside, destination);
    await assert.rejects(generateIOSProject(args), /Output symlink/);
    await assert.rejects(access(path.join(outside, 'AppDelegate.swift')));
    await assert.rejects(access(path.join(outside, 'ApolloProduct.xcscheme')));
  }
  const args = await fixture(t);
  const outside = path.join(args.root, 'outside'); await mkdir(outside);
  await symlink(outside, args.outputDir);
  await assert.rejects(generateIOSProject(args), /Output symlink/);
  await assert.rejects(access(path.join(outside, 'ApolloProduct')));
  await assert.rejects(generateIOSProject({ ...args, outputDir: path.join(args.outputDir, 'nested') }), /Output symlink/);
  await assert.rejects(access(path.join(outside, 'nested')));
});
