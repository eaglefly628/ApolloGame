#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { smokeIOSWeb } from './ios-web-smoke.mjs';
import { verifyProduct } from './lib/ios-release.mjs';
import { detectBrowserRuntime } from './lib/render-harness.mjs';

/** This is a known-fixture behavior test, not a general game acceptance script. */
export function assertTouchOrbitFixture(config) {
  assert.equal(config?.id, 'touch-orbit', 'Touch smoke supports only the touch-orbit fixture');
  assert.equal(config.source?.kind, 'manifest', 'Touch Orbit must use its declared manifest');
  assert.equal(config.source?.path, 'products/examples/touch-orbit/manifest.json', 'Unexpected Touch Orbit fixture source');
  assert.equal(config.runtime?.touch?.mode, 'drag', 'Touch Orbit requires drag input');
  assert.equal(config.runtime?.save?.slot, 'touch-orbit-progress-v1', 'Unexpected Touch Orbit checkpoint slot');
}

async function playerPosition(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) throw new Error('Touch Orbit player canvas is missing');
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0, sumX = 0, sumY = 0;
    // The fixture player uses Color.tint=5621458 (#55c6d2). Observe the output,
    // rather than exposing an engine/world mutation API solely for the test.
    for (let offset = 0; offset < data.length; offset += 4) {
      if (data[offset] === 85 && data[offset + 1] === 198 && data[offset + 2] === 210 && data[offset + 3] === 255) {
        const pixel = offset / 4;
        count++; sumX += pixel % canvas.width; sumY += Math.floor(pixel / canvas.width);
      }
    }
    if (count < 100) throw new Error('Touch Orbit player pixels are missing');
    return { x: (sumX / count + 0.5) / canvas.width, y: (sumY / count + 0.5) / canvas.height };
  });
}

function assertPosition(actual, expected, label) {
  assert(Math.abs(actual.x - expected.x) < 0.003 && Math.abs(actual.y - expected.y) < 0.003,
    `${label}: normalized player position changed from ${JSON.stringify(expected)} to ${JSON.stringify(actual)}`);
}

async function fitViewport(page, viewport, label, report) {
  await page.setViewportSize(viewport);
  try {
    await page.waitForFunction(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return false;
      const box = canvas.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && box.left >= -0.5 && box.top >= -0.5
        && box.right <= innerWidth + 0.5 && box.bottom <= innerHeight + 0.5;
    }, null, { timeout: 5000 });
  } catch {
    const bounds = await page.locator('canvas').boundingBox();
    throw new Error(`${label}: canvas must fit completely inside ${JSON.stringify(viewport)}; actual ${JSON.stringify(bounds)}`);
  }
  const bounds = await page.locator('canvas').boundingBox();
  assert(bounds && bounds.width > 0 && bounds.height > 0, `${label}: canvas must be visible`);
  assert(bounds.x >= -0.5 && bounds.y >= -0.5 && bounds.x + bounds.width <= viewport.width + 0.5
    && bounds.y + bounds.height <= viewport.height + 0.5, `${label}: canvas extends outside the viewport`);
  assert(Math.abs(bounds.width / bounds.height - 640 / 400) < 0.01, `${label}: fixture aspect ratio must be preserved`);
  report.viewports ??= [];
  report.viewports.push({ label, viewport, canvas: bounds });
  report.checks.push(label + '-canvas-inside-viewport');
}

async function checkpoint(page, slot) {
  const value = await page.waitForFunction(async ({ slot }) => new Promise((done, reject) => {
    const request = indexedDB.open('apollo-db');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const read = db.transaction('kv', 'readonly').objectStore('kv').get('snap:' + slot);
      read.onerror = () => { db.close(); reject(read.error); };
      read.onsuccess = () => {
        db.close();
        try {
          const saved = read.result ? JSON.parse(read.result) : null;
          done(saved?.snapshot?.player?.Transform?.x > 335 ? saved : false);
        } catch (error) { reject(error); }
      };
    };
  }), { slot }, { timeout: 5000 });
  return value.jsonValue();
}

/** Desktop Chromium + actual CDP touch events; never claims iOS device verification. */
export async function smokeIOSTouch(outputDir) {
  const output = resolve(outputDir);
  const { config } = await verifyProduct(output);
  assertTouchOrbitFixture(config);
  const runtime = detectBrowserRuntime();
  if (!runtime.ok) throw new Error(runtime.reason ?? 'NO_BROWSER');
  const report = await smokeIOSWeb(output, {
    executablePath: runtime.execPath,
    exercise: async (page, report) => {
      report.fixture = 'touch-orbit';
      report.checks.push('touch-orbit-fixture-config');
      await fitViewport(page, { width: 844, height: 390 }, 'landscape', report);
      const initial = await playerPosition(page);
      await fitViewport(page, { width: 390, height: 844 }, 'portrait', report);
      assertPosition(await playerPosition(page), initial, 'Resize to portrait');
      await fitViewport(page, { width: 844, height: 390 }, 'landscape-restored', report);
      assertPosition(await playerPosition(page), initial, 'Resize back to landscape');
      await page.evaluate(() => {
        window.__APOLLO_TOUCH_SMOKE_EVENTS__ = [];
        for (const type of ['pointerdown', 'pointermove', 'pointercancel', 'pointerup']) {
          window.addEventListener(type, event => window.__APOLLO_TOUCH_SMOKE_EVENTS__.push({ type, trusted: event.isTrusted, pointerType: event.pointerType }));
        }
      });
      const bounds = await page.locator('canvas').boundingBox();
      const origin = { x: bounds.x + bounds.width * 0.25, y: bounds.y + bounds.height * 0.25 };
      const session = await page.context().newCDPSession(page);
      try {
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [origin] });
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: origin.x + 64, y: origin.y }] });
        await page.waitForTimeout(300);
        const moved = await playerPosition(page);
        report.touchEvents = await page.evaluate(() => window.__APOLLO_TOUCH_SMOKE_EVENTS__);
        assert(report.touchEvents.some(event => event.type === 'pointermove' && event.trusted && event.pointerType === 'touch'), 'A real trusted touch move must reach the game');
        assert(!report.touchEvents.some(event => event.type === 'pointercancel'), 'Browser pan must not cancel the game drag');
        assert(moved.x > initial.x + 0.02, 'Real touch drag must move the visible player');
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.evaluate(() => window.dispatchEvent(new CustomEvent('apollo:app-state', { detail: { active: false } })));
        const paused = await playerPosition(page);
        await page.waitForTimeout(180);
        assertPosition(await playerPosition(page), paused, 'Background pause');
        const saved = await checkpoint(page, config.runtime.save.slot);
        assertPosition({ x: saved.snapshot.player.Transform.x / 640, y: saved.snapshot.player.Transform.y / 400 }, paused, 'Persisted background checkpoint');
        await page.evaluate(() => window.dispatchEvent(new CustomEvent('apollo:app-state', { detail: { active: true } })));
        await page.waitForTimeout(180);
        assertPosition(await playerPosition(page), paused, 'Foreground must clear the prior drag');
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForFunction(() => document.getElementById('product-root')?.dataset.productState === 'ready', null, { timeout: 15000 });
        assertPosition(await playerPosition(page), paused, 'Reload must restore the checkpoint');
        await fitViewport(page, { width: 390, height: 844 }, 'reloaded-portrait', report);
        assertPosition(await playerPosition(page), paused, 'Restored position after portrait resize');
        await fitViewport(page, { width: 844, height: 390 }, 'reloaded-landscape', report);
        assertPosition(await playerPosition(page), paused, 'Restored position after landscape resize');
        report.playerPositions = { initial, moved, paused, reloaded: await playerPosition(page) };
        report.checks.push('trusted-touch-moves-visible-player', 'background-pauses-visible-world', 'foreground-clears-stale-drag', 'background-checkpoint-persists-through-reload');
      } finally { await session.detach(); }
    },
  });
  await mkdir(join(output, 'release'), { recursive: true });
  await writeFile(join(output, 'release/touch-smoke.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [output, ...extra] = process.argv.slice(2);
  try {
    if (!output || extra.length) throw new Error('Usage: node scripts/ios-touch-smoke.mjs release/ios/touch-orbit');
    const report = await smokeIOSTouch(output);
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.status === 'passed' ? 0 : 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
