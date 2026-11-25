import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const evidence = new URL('./evidence/', import.meta.url);
const browser = await chromium.launch({ channel: 'chrome' });
const rows = [];
try {
  for (const [name, viewport] of Object.entries({ desktop: { width: 1280, height: 800 }, narrow: { width: 320, height: 568 } })) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const frame = () => page.evaluate(() => {
      const app = window.apolloPrototype;
      const world = app.snapshot();
      const request = app.capeRequest();
      return {
        request,
        root: world['cape-preview-root'].Transform,
        visual: world[request.avatarId].Transform3D,
        clip: world[request.avatarId].AnimState3D.clip,
        stats: app.stats(),
      };
    });
    await page.goto('http://127.0.0.1:18854/?scene=avatar-studio');
    await page.waitForFunction(() => window.apolloPrototype?.stats().models === 1);
    for (const [bodyId, bodyIndex] of [['slim', 0], ['full', 2]]) {
      await page.locator(`#build-${bodyIndex}-available`).click();
      await page.waitForFunction(bodyId => window.apolloPrototype.capeRequest()?.bodyId === bodyId, bodyId);
      await page.locator('#open-cape').click();
      await page.locator('#cape-unavailable').waitFor();
      assert.equal(await page.locator('#cape-controls button').evaluateAll(buttons => buttons.every(button => {
        const r = button.getBoundingClientRect();
        return r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
      })), true);
      await page.locator('#cape-enter').click();
      await page.locator('#cape-remove').waitFor();
      await page.locator('#cape-tier-low').click();
      await page.locator('#cape-tier-low-active').waitFor();
      assert.deepEqual((await frame()).request, {
        avatarId: bodyId === 'slim' ? 'avatar-0000' : 'avatar-0200', bodyId, enabled: true, requestedTier: 'low',
      });

      const before = await frame();
      const goRight = before.root.x < .25;
      await page.keyboard.down(goRight ? 'ArrowRight' : 'ArrowLeft');
      await page.waitForFunction(({ threshold, goRight }) => {
        const view = window.apolloPrototype;
        const root = view.snapshot()['cape-preview-root'].Transform;
        return goRight ? root.x > threshold : root.x < threshold;
      }, { threshold: before.root.x + (goRight ? .23 : -.23), goRight });
      const walking = await frame();
      await page.keyboard.up(goRight ? 'ArrowRight' : 'ArrowLeft');
      await page.waitForFunction(() => {
        const app = window.apolloPrototype;
        return app.snapshot()[app.capeRequest().avatarId].AnimState3D.clip === 'idle';
      });
      const stopped = await frame();
      await page.waitForTimeout(155);
      assert.equal((await frame()).root.x, stopped.root.x);
      assert.equal(walking.clip, 'walk');
      assert.equal(stopped.visual.x, stopped.root.x);

      await page.keyboard.down(goRight ? 'ArrowLeft' : 'ArrowRight');
      await page.waitForFunction(goRight => {
        const view = window.apolloPrototype;
        const s = view.snapshot();
        const yaw = s[view.capeRequest().avatarId].Transform3D.rotY;
        return goRight ? yaw < -1.3 : yaw > 1.3;
      }, goRight);
      const turned = await frame();
      await page.keyboard.up(goRight ? 'ArrowLeft' : 'ArrowRight');
      if (name === 'desktop') {
        await page.screenshot({ path: fileURLToPath(new URL(`editor-${bodyId}.jpg`, evidence)), quality: 90 });
      }
      await page.locator('#cape-tier-off').click();
      await page.locator('#cape-tier-off-active').waitFor();
      await page.locator('#cape-remove').click();
      await page.locator('#cape-enter').waitFor();
      const final = await frame();
      assert.match(final.request.requestedTier, /^off$/);
      assert.equal(final.request.enabled, false);
      await page.locator('#close-cape').click();
      rows.push({ viewport: name, bodyId, walking, stopped, turned, final });
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
} finally { await browser.close(); }
await writeFile(new URL('editor-browser.json', evidence), JSON.stringify(rows, null, 2) + '\n');
console.log('Cape editor motion and request controls verified', rows.map(row => [row.viewport, row.bodyId]));
