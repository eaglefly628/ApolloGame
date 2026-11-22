import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome' });
const origin = 'http://127.0.0.1:18854/';
const evidence = fileURLToPath(new URL('../evidence', import.meta.url));

function probe(page) {
  const faults = [];
  page.on('pageerror', error => faults.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) faults.push(response.url());
  });
  return {
    faults,
    async shown(key) {
      await page.waitForFunction(key => {
        const app = window.apolloPrototype;
        return app?.stats().models === 1 && app.snapshot()[key]?.Visibility?.visible === true;
      }, key);
    },
    async fit() {
      assert.equal(await page.locator('button').evaluateAll(nodes => nodes.every(node => {
        const r = node.getBoundingClientRect();
        return r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
      })), true, 'buttons clipped or undersized');
    },
  };
}

try {
  for (const [id, viewport] of Object.entries({desktop:{width:1280,height:800}, narrow:{width:320,height:568}})) {
    const page = await browser.newPage({viewport, hasTouch:id==='narrow'});
    const checks = probe(page);
    await page.goto(origin);
    await checks.shown('avatar-0100');
    await checks.fit();
    await page.locator('#expression-2-available').click();
    await page.locator('#build-2-available').click();
    await page.locator('#hand-1-available').focus();
    await page.keyboard.press('Enter');
    await checks.shown('avatar-2201');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'hand-1-selected');
    assert.equal(await page.evaluate(() => window.apolloPrototype.snapshot()['applied-look'].State.current), '0100');
    await page.locator('#avatar-apply').click();
    await page.locator('#applied-status').waitFor();
    assert.equal(await page.evaluate(() => window.apolloPrototype.snapshot()['applied-look'].State.current), '2201');
    await page.locator('#avatar-reset').click();
    await checks.shown('avatar-0100');
    await page.locator('#avatar-view-applied').click();
    await checks.shown('avatar-2201');
    await page.locator('#hand-1-selected').waitFor();
    if (id === 'desktop') await page.screenshot({path:`${evidence}/applied-desktop.jpg`, quality:90});
    await page.locator('#avatar-view-draft').click();
    await checks.shown('avatar-0100');
    await page.locator('#hands-lab').click();
    await page.waitForURL('**/?scene=hands-lab');
    await checks.shown('contact-cup-10');
    await checks.fit();
    assert.deepEqual(checks.faults, []);
    await page.close();
    console.log('edit and routing', id, 'passed');
  }

  for (const [scene, action, sampleMs] of [['hands-lab','cup',1480],['hands-press','press',1230],['hands-handoff','handoff',1930]]) {
    const page = await browser.newPage({viewport:{width:1280,height:800}});
    const checks = probe(page);
    await page.goto(origin + '?scene=' + scene);
    await checks.shown(`contact-${action}-10`);
    await page.locator('#build-2-available').click();
    await page.locator('#hand-1-available').click();
    const key = `contact-${action}-21`;
    await checks.shown(key);
    await page.locator('#perform').click();
    await page.waitForFunction(({key, action}) => window.apolloPrototype.snapshot()[key].AnimState3D.clip === action, {key,action});
    const start = Date.now();
    await page.waitForTimeout(sampleMs);
    await page.screenshot({path:`${evidence}/${action}-contact.jpg`, quality:92});
    await page.waitForTimeout(Math.max(0, 4140 - (Date.now()-start)));
    assert.equal(await page.evaluate(key => window.apolloPrototype.snapshot()[key].AnimState3D.loop, key), false);
    await page.screenshot({path:`${evidence}/${action}-release.jpg`, quality:92});
    await page.waitForFunction(key => window.apolloPrototype.snapshot()[key].AnimState3D.clip === 'idle', key);
    assert.deepEqual(checks.faults, []);
    await page.close();
    console.log(scene, 'clip, release window and idle passed');
  }
} finally { await browser.close(); }
