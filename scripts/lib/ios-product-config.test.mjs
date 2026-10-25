import { it, expect } from 'vitest';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { canonicalJson, validateProductConfig } from './ios-product-config.mjs';
import { productEntry } from '../ios-product.mjs';

const config = () => ({ schemaVersion: 1, id: 'test-product', title: 'A Product', version: '1.0.0', buildNumber: 1, source: { kind: 'module', entry: 'games/test/main.ts' }, viewport: { width: 640, height: 400, orientation: 'landscape' }, ios: { bundleIdentifier: 'dev.apollo.test', minimumOS: '15.0' } });
const validate = c => validateProductConfig(c, '/not-read', { checkFiles: false });
it('accepts both product sources without requiring unpublished App Store metadata', () => {
  expect(validate(config()).id).toBe('test-product');
  const c = config(); c.source = { kind: 'manifest', path: 'products/test/manifest.json' };
  expect(validate(c).source.kind).toBe('manifest');
});
it('canonical identity is stable across object insertion order', () => {
  expect(canonicalJson({ z: [3, { b: 2, a: 1 }], a: 0 })).toBe(canonicalJson({ a: 0, z: [3, { a: 1, b: 2 }] }));
  expect(() => canonicalJson({ x: NaN })).toThrow(/nonfinite/);
});
it.each(['../secret.ts', '/tmp/secret.ts', 'games/../secret.ts', 'games//main.ts', 'games/test\\main.ts'])('rejects unsafe product source %s', path => {
  const c = config(); c.source.entry = path; expect(() => validate(c)).toThrow();
});
it('rejects unknown fields, secrets and conflicting source controls', () => {
  expect(() => validate({ ...config(), apiKey: 'do-not-store' })).toThrow(/unknown field/);
  const c = config(); c.source.path = 'products/test.json'; expect(() => validate(c)).toThrow(/module requires/);
});
it('rejects unusable touch, unversioned save slots and nonfinite audio', () => {
  const c = config(); c.runtime = { touch: { mode: 'drag', deadZone: 64, range: 64 } }; expect(() => validate(c)).toThrow(/deadZone/);
  c.runtime = { save: { slot: 'not-versioned' } }; expect(() => validate(c)).toThrow(/versioned/);
  c.runtime = { audio: { specs: { beep: { partials: [{ freq: Infinity }] } } } }; expect(() => validate(c)).toThrow(/freq/);
});
it('validates permission-free sound data and explicit store declarations', () => {
  const c = config(); c.runtime = { audio: { specs: { beep: { partials: [{ freq: 440 }] } } } };
  c.store = { privacyPolicyURL: 'https://example.com/privacy', supportURL: 'https://example.com/support', ageRating: '4+', exportCompliance: { usesNonExemptEncryption: false } };
  expect(validate(c).store.exportCompliance.usesNonExemptEncryption).toBe(false);
  c.store.privacyPolicyURL = 'http://example.com'; expect(() => validate(c)).toThrow(/HTTPS/);
});
it('rejects resources which could overwrite the generated bundle', () => {
  const c = config(); c.resources = ['assets/game.js']; expect(() => validate(c)).toThrow(/collides/);
  c.resources = ['../.apollo-config.json']; expect(() => validate(c)).toThrow(/unsafe/);
});
it('resolves actual declared sources and rejects a symlink escaping the repository', async t => {
  const root = await mkdtemp(join(tmpdir(), 'apollo-config-test-')), outside = await mkdtemp(join(tmpdir(), 'apollo-config-outside-'));
  t.onTestFinished(async () => { await rm(root, { recursive: true, force: true }); await rm(outside, { recursive: true, force: true }); });
  await mkdir(join(root, 'games/test'), { recursive: true }); await writeFile(join(root, 'games/test/main.ts'), 'export const mount=()=>()=>{};');
  expect(validateProductConfig(config(), root).id).toBe('test-product');
  await writeFile(join(outside, 'main.ts'), 'external');
  await symlink(outside, join(root, 'games/escape'));
  const c = config(); c.source.entry = 'games/escape/main.ts'; expect(() => validateProductConfig(c, root)).toThrow(/symlink|escapes/);
});
it('rejects intermediate public symlinks even when the target remains inside the repository', async t => {
  const root = await mkdtemp(join(tmpdir(), 'apollo-public-boundary-'));
  t.onTestFinished(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'games/test'), { recursive: true }); await writeFile(join(root, 'games/test/main.ts'), 'export const mount=()=>()=>{}');
  await mkdir(join(root, 'public')); await mkdir(join(root, 'private')); await writeFile(join(root, 'private/credentials.txt'), 'fake private data');
  await symlink(join(root, 'private'), join(root, 'public/bridge'));
  const c = config(); c.resources = ['bridge/credentials.txt'];
  expect(() => validateProductConfig(c, root)).toThrow(/symlink/);
});
it('product bootstrap imports the declared module directly and waits for runtime readiness', () => {
  const entry = productEntry('/repo', config());
  expect(entry).toContain('"/repo/games/test/main.ts"');
  expect(entry).toContain('await mobile.settled()');
  expect(entry).not.toContain('Unknown game:');
});
it('manifest bootstrap uses the existing parser and contains no executable inline HTML terminator', () => {
  const c = config(); c.source = { kind: 'manifest', path: 'products/test.json' };
  const entry = productEntry('/repo', c, { title: '</script><img src=x>', entities: {} });
  expect(entry).toContain('mountMobileBlueprint'); expect(entry).toContain('parseManifestAsync');
  expect(entry).not.toContain('</script>');
});
