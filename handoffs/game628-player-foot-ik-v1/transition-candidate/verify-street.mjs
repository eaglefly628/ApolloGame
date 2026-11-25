import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-unsafe-swiftshader'] });
const balance = process.argv.includes('--balanced-stop');
const recovery = balance || process.argv.includes('--recovery-step');
const heelFirst = recovery || process.argv.includes('--heel-first');
const heel = heelFirst || process.argv.includes('--heel');
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await context.addInitScript(() => {
    window.transitions = [];
    window.addEventListener('game628:transition-contact', ({ detail }) => window.transitions.push(detail));
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const port = balance ? 18868 : recovery ? 18867 : heelFirst ? 18866 : heel ? 18865 : 18864;
  assert.ok((await page.goto(`http://127.0.0.1:${port}/?transition-probe=1`))?.ok());
  await page.getByRole('button', { name: '游客进入', exact: true }).click();
  await page.getByRole('button', { name: '确认角色', exact: true }).click({ timeout: 30000 });
  await page.locator('iframe#preview').waitFor({ state: 'visible' });
  const game = page.frames().find(frame => frame.url().includes('/prototype?scene='));
  assert.ok(game, 'Street scene must load from guest flow');
  await game.waitForFunction(() => window.transitions.length > 12 && window.apolloPrototype?.stats().models >= 15, null, { timeout: 30000 });
  await game.locator('canvas').first().click({ position: { x: 30, y: 30 } });
  await game.waitForFunction(() => window.transitions.at(-1)?.clip === 'idle');
  await game.evaluate(() => { window.transitions.length = 0; });
  const initial = await game.evaluate(() => window.apolloPrototype.snapshot().player);
  await page.keyboard.down('KeyD');
  await game.waitForFunction(() => window.transitions.some(row => row.mode === 'start'));
  await game.waitForFunction(x => window.apolloPrototype.snapshot().player.Transform.x > x,
    initial.Transform.x + (heel ? 2.08 : 1.1), { timeout: 7000 });
  await page.keyboard.up('KeyD');
  await game.waitForFunction(() => window.transitions.some(row => row.mode === 'stop'));
  await game.waitForFunction(age => {
    const rows = window.transitions;
    return rows.some(row => row.mode === 'stop') && rows.at(-1)?.clip === 'idle' && rows.at(-1).age > age && !rows.at(-1).mode;
  }, recovery ? .55 : .37);
  const ended = await game.evaluate(() => ({ player: window.apolloPrototype.snapshot().player, rows: window.transitions }));
  const start = ended.rows.filter(row => row.mode === 'start');
  const stop = ended.rows.filter(row => row.mode === 'stop');
  const walk = ended.rows.filter(row => row.clip === 'walk' && !row.mode);
  assert.ok(start.length >= 2 && stop.length >= 2 && walk.length >= 2);
  assert.ok(start.some(row => row.before.some((height, i) => height - row.shoes[i] > .001)));
  assert.ok(stop.some(row => row.before.some((height, i) => Math.abs(height - row.shoes[i]) > .001)));
  assert.ok(ended.rows.at(-1).shoes.every(height => Math.abs(height) <= .0015));
  if (heel) {
    const load = walk.filter(row => row.phase >= .045 && row.phase < .225);
    assert.ok(load.length >= 2);
    assert.ok(load.every(row => Math.abs(row.sections[1][0]) <= .0015));
  } else {
    assert.ok(walk.every(row => row.shoes.every((height, i) => height === row.before[i])));
  }
  assert.equal(ended.player.AnimState3D.clip, 'idle');
  assert.deepEqual(errors, []);
  const result = {
    deltaXMeters: ended.player.Transform.x - initial.Transform.x,
    frameCounts: { start: start.length, walk: walk.length, stop: stop.length },
    stopFirstMm: stop[0].shoes.map(height => +((height * 1000).toFixed(2))),
    last: ended.rows.at(-1),
  };
  const output = balance ? 'balanced-stop-street-verification.json' : recovery ? 'recovery-step-street-verification.json' :
    heelFirst ? 'heel-first-street-verification.json' : heel ? 'heel-street-verification.json' : 'street-verification.json';
  await writeFile(new URL(output, import.meta.url),
    JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
