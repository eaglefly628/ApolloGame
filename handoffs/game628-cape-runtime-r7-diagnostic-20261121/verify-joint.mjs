import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const tag = process.argv[2];
assert.ok(!tag || /^[a-z0-9-]+$/.test(tag), 'Use a plain lowercase evidence tag');
const evidence = new URL(tag ? `./evidence/${tag}/` : './evidence/', import.meta.url);
await mkdir(evidence, { recursive: true });
const records = [];
const url = 'http://127.0.0.1:18854/cape-r7-diagnostic/?scene=avatar-studio';
const sha256 = value => createHash('sha256').update(value).digest('hex');
const servedFile = async path => {
  const response = await fetch(new URL(path, url), { cache: 'no-store' });
  assert.ok(response.ok, `HTTP ${response.status} for ${path}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  return { path, bytes, sha256: sha256(bytes) };
};
async function buildIdentity() {
  const html = await servedFile('index.html');
  const modulePath = html.bytes.toString().match(/<script\b[^>]*\bsrc="(\.\/assets\/[^"]+\.js)"/)?.[1];
  assert.ok(modulePath, '18854 HTTP page has no built module entry');
  const module = await servedFile(modulePath);
  const scene = await servedFile('scenes/avatar-studio.json');
  const files = [];
  for (const file of [html, module, scene]) {
    const local = await readFile(new URL(`./dist/${file.path}`, import.meta.url));
    assert.equal(sha256(local), file.sha256, `18854 does not serve current dist${file.path}`);
    files.push({ path: file.path, sha256: file.sha256 });
  }
  return { url, files };
}
const build = await buildIdentity();
const browser = await chromium.launch({ channel: 'chrome' });
const ready = async page => page.waitForFunction(() => window.apolloPrototype?.stats().models === 1);
const shot = (page, name) => page.screenshot({ path: fileURLToPath(new URL(name + '.jpg', evidence)), quality: 92 });
const triangles = page => page.evaluate(() => window.apolloPrototype.stats().triangles);
const expectTriangles = (page, count) => page.waitForFunction(count => window.apolloPrototype.stats().triangles === count, count);
const snapshot = page => page.evaluate(() => {
  const app = window.apolloPrototype;
  const world = app.snapshot();
  const cape = app.capeStatus();
  const actor = world[cape.request.avatarId];
  const cloth = world['cape-preview-cloth']?.Cloth3D ?? null;
  const proxies = Object.entries(world)
    .filter(([id, entity]) => id.startsWith('cape-preview-proxy-') && entity.ClothCollider3D)
    .map(([id, entity]) => ({ id, binding: entity.ClothCollider3D }));
  return { cape, cloth, proxies, root: world['cape-preview-root'].Transform, pose: actor.Transform3D, clip: actor.AnimState3D.clip, stats: app.stats() };
});

async function openBody(page, bodyIndex, bodyId) {
  await page.goto(url);
  await ready(page);
  await page.locator(`#build-${bodyIndex}-available`).click();
  await page.waitForFunction(bodyId => window.apolloPrototype.capeRequest()?.bodyId === bodyId, bodyId);
  await ready(page);
  await page.locator('#open-cape').click();
  await page.locator('#cape-undressed').waitFor();
  return triangles(page);
}

async function advance(page, key, { axis, delta }) {
  const before = (await snapshot(page)).root[axis];
  await page.keyboard.down(key);
  await page.waitForFunction(({ axis, before, delta }) => {
    const app = window.apolloPrototype;
    const world = app.snapshot();
    const actor = world[app.capeRequest().avatarId];
    return Math.sign(delta) * (world['cape-preview-root'].Transform[axis] - before) > Math.abs(delta) && actor.AnimState3D.clip === 'walk';
  }, { axis, before, delta });
  const walking = await snapshot(page);
  if (key === 'ArrowRight') await shot(page, `${walking.cape.request.bodyId}-side-walking`);
  await page.keyboard.up(key);
  await page.waitForFunction(() => {
    const app = window.apolloPrototype;
    return app.snapshot()[app.capeRequest().avatarId].AnimState3D.clip === 'idle';
  });
  const stopped = await snapshot(page);
  await page.waitForTimeout(95);
  assert.deepEqual((await snapshot(page)).root, stopped.root);
  return { walking, stopped };
}

try {
  for (const [bodyId, index] of [['slim', 0], ['full', 2]]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', msg => { if (msg.type() === 'warning' && msg.text().startsWith('[cloth]')) errors.push(msg.text()); });
    const base = await openBody(page, index, bodyId);
    await page.locator('#cape-enter').click();
    await expectTriangles(page, base + 96);
    const start = await snapshot(page);
    await shot(page, `${bodyId}-front`);
    assert.equal(start.proxies.length, bodyId === 'slim' ? 42 : 58);
    assert.equal(start.cloth.attachment.left.node, 'LeftShoulder');
    assert.deepEqual(start.cloth.wind, { z: 1.1 });
    assert.equal(start.cape.activeTier, 'normal');
    const left = await advance(page, 'ArrowLeft', { axis: 'x', delta: -.26 });
    const right = await advance(page, 'ArrowRight', { axis: 'x', delta: .55 });
    const turned = await advance(page, 'ArrowUp', { axis: 'y', delta: -.25 });
    const back = await snapshot(page);
    assert.ok(Math.abs(back.pose.rotY) > 2.8, JSON.stringify(back.pose));
    for (const step of [left.walking, left.stopped, right.walking, right.stopped, turned.walking, back]) {
      assert.equal(step.cape.generation, start.cape.generation);
      assert.equal(step.stats.triangles, base + 96);
    }
    await shot(page, `${bodyId}-normal`);
    await page.locator('#cape-wave').click();
    await page.waitForFunction(() => {
      const app = window.apolloPrototype;
      return app.snapshot()[app.capeRequest().avatarId].AnimState3D.clip === 'wave';
    });
    await page.waitForTimeout(750);
    await expectTriangles(page, base + 96);
    const waving = await snapshot(page);
    assert.equal(waving.clip, 'wave');
    assert.equal(waving.cape.generation, start.cape.generation);
    assert.deepEqual(waving.cloth, start.cloth);
    assert.deepEqual(waving.proxies, start.proxies);
    await shot(page, `${bodyId}-wave`);

    await page.locator('#cape-tier-low').click();
    await expectTriangles(page, base + 48);
    const low = await snapshot(page);
    assert.equal(low.cape.activeTier, 'low');
    await shot(page, `${bodyId}-low`);
    await page.locator('#cape-tier-off').click();
    await expectTriangles(page, base);
    const off = await snapshot(page);
    assert.equal(off.cape.activeTier, undefined);
    assert.equal(off.cloth, null);
    assert.deepEqual(off.proxies, []);
    await page.locator('#cape-tier-normal').click();
    await expectTriangles(page, base + 96);
    await page.locator('#cape-remove').click();
    await expectTriangles(page, base);
    await page.locator('#cape-enter').click();
    await expectTriangles(page, base + 96);
    const reworn = await snapshot(page);
    assert.equal(reworn.stats.geometries, start.stats.geometries);
    await shot(page, `${bodyId}-reworn`);
    assert.deepEqual(errors, []);
    records.push({ bodyId, baseTriangles: base, start, left, right, turned, waving, low, off, reworn });
    await page.close();
    console.log(bodyId, 'wear, gait, stop, turns, wave, low, off and rewear');
  }

  const page = await browser.newPage({ viewport: { width: 320, height: 568 }, hasTouch: true });
  const base = await openBody(page, 0, 'slim');
  await page.locator('#cape-enter').click();
  await expectTriangles(page, base + 96);
  const cdp = await page.context().newCDPSession(page);
  const decisions = [];
  const graphicsRenderer = await page.locator('canvas').evaluate(canvas => {
    const gl = canvas.getContext('webgl2');
    const debug = gl?.getExtension('WEBGL_debug_renderer_info');
    return debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null;
  });
  page.on('console', message => { if (message.text().startsWith('[cape-editor:decision]')) decisions.push(message.text()); });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 16 });
  await page.waitForFunction(() => ['low', 'off'].includes(window.apolloPrototype.capeStatus().effectiveTier), null, { timeout: 15000 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const throttled = await snapshot(page);
  assert.match(throttled.cape.reason, /cpu-budget/);
  assert.ok(decisions.length > 0);
  await expectTriangles(page, base + (throttled.cape.effectiveTier === 'low' ? 48 : 0));
  await shot(page, 'slow-device-tier');
  await page.locator('#cape-remove').click();
  await expectTriangles(page, base);
  assert.equal(await page.locator('#cape-controls button').evaluateAll(buttons => buttons.every(button => {
    const r = button.getBoundingClientRect();
    return r.width >= 44 && r.height >= 44 && r.left >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
  })), true);
  records.push({ scenario: 'Chrome CPU throttling at 16x, narrow viewport', throttled, decisions, graphicsRenderer });
  await page.close();
  console.log('slow preview automatic downgrade', throttled.cape.effectiveTier, throttled.cape.reason);
} finally { await browser.close(); }
assert.deepEqual(await buildIdentity(), build, '18854 build changed during browser acceptance');
await writeFile(new URL('build-identity.json', evidence), JSON.stringify(build, null, 2) + '\n');
await writeFile(new URL('joint-browser.json', evidence), JSON.stringify(records, null, 2) + '\n');
