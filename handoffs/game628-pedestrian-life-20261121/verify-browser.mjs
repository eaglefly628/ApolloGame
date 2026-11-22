import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const evidence = new URL('evidence/', import.meta.url);
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
  const failures = [];
  page.on('pageerror', error => failures.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) failures.push(response.url() + ' ' + response.status());
  });
  await page.goto('http://127.0.0.1:18856/?scene=crowd-street');
  await page.waitForFunction(() => window.apolloPrototype, null, { timeout: 25000 });
  const walking = await (await page.waitForFunction(() => {
    const state = window.apolloPrototype.snapshot();
    const residents = Object.entries(state).filter(([id]) => id.startsWith('resident-'));
    if (residents.length === 4 && residents.every(([, actor]) => actor.AnimState3D.clip.startsWith('walk-'))) {
      return Object.fromEntries(residents.map(([id, actor]) => [id, actor.AnimState3D]));
    }
    return false;
  })).jsonValue();
  if (new Set(Object.values(walking).map(actor => actor.clip)).size !== 3) throw new Error('Walking variation is missing');
  await page.screenshot({ path: new URL('street-walks.jpg', evidence).pathname, quality: 88 });
  const chat = await (await page.waitForFunction(() => {
    const entries = Object.entries(window.apolloPrototype.snapshot()).filter(([id, actor]) =>
      id.startsWith('resident-') && actor.PedestrianResponse.activity?.kind === 'chat');
    return entries.length === 2 && entries.some(([,actor]) => actor.AnimState3D.clip === 'street-chat')
      ? Object.fromEntries(entries.map(([id, actor]) => [id, actor.PedestrianResponse.activity])) : false;
  }, null, { timeout: 45000 })).jsonValue();
  await page.screenshot({ path: new URL('street-chat.jpg', evidence).pathname, quality: 88 });
  let response = null;
  for (let attempt = 0; attempt < 4 && !response; attempt++) {
    await page.waitForFunction(() => {
      const s = window.apolloPrototype.snapshot();
      const clock = s['street-response'].StreetResponse;
      const player = s.player.Transform;
      return clock.tick >= clock.nextSourceTick && Object.values(s).some(actor =>
        actor.PedestrianResponse && !actor.PedestrianResponse.activity && actor.PedestrianResponse.readyAt <= clock.tick &&
        Math.hypot(actor.Transform.x - player.x, actor.Transform.y - player.y) < 2.8);
    }, null, { timeout: 35000 });
    await page.getByRole('button', { name: '鼓掌', exact: true }).click();
    try {
      response = await (await page.waitForFunction(() => {
        const state = window.apolloPrototype.snapshot();
        const received = Object.entries(state).find(([id, actor]) => id.startsWith('resident-') &&
          actor.PedestrianResponse.activity?.kind === 'notice' && actor.PedestrianResponse.activity.hop === 0);
        return state.player.AnimState3D.clip === 'clap' && received ?
          { id: received[0], activity: received[1].PedestrianResponse.activity } : false;
      }, null, { timeout: 2200 })).jsonValue();
    } catch (error) {
      if (error.name !== 'TimeoutError') throw error;
    }
  }
  if (!response) throw new Error('No resident accepted the player stimulus within four eligible attempts');
  const errors = await page.evaluate(() => window.apolloPrototype.errors());
  if (errors.length || failures.length) throw new Error(JSON.stringify({ errors, failures }));
  const result = { walking, chat, response, failures, errors };
  await writeFile(new URL('browser.json', evidence), JSON.stringify(result, null, 2) + '\n');
  console.log(result);
} finally {
  await browser.close();
}
