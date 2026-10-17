import { describe, it, expect, vi, afterEach } from 'vitest';
import { runInNewContext } from 'node:vm';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { designResourceMap, installDesignResources } from './design-resources.mjs';
import { captureFrames } from './keyart-capture.mjs';

const driver = vi.hoisted(() => ({ newPage: null, browserClosed: 0, serverClosed: 0 }));
vi.mock('vite', () => ({
  createServer: async () => ({ listen: async () => {}, httpServer: { address: () => ({ port: 12345 }) }, close: async () => { driver.serverClosed++; } }),
  optimizeDeps: async () => {},
}));
vi.mock('playwright', () => ({ chromium: { launch: async () => ({ newPage: (...args) => driver.newPage(...args), close: async () => { driver.browserClosed++; } }) } }));
vi.mock('./render-harness.mjs', () => ({ detectBrowserRuntime: () => ({ ok: true, execPath: '/fixture/chromium' }) }));
const dirs = [];
afterEach(() => { vi.restoreAllMocks(); dirs.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true })); });
const EXPECTED = {
  'https://unpkg.com/react@18.3.1/umd/react.production.min.js': 'http://127.0.0.1:12345/__vendor/react.js',
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js': 'http://127.0.0.1:12345/__vendor/react-dom.js',
  'https://unpkg.com/@babel/standalone@7.29.0/babel.min.js': 'http://127.0.0.1:12345/__vendor/babel.js',
};
function installedResources(page) {
  const [install, resources] = page.addInitScript.mock.calls[0];
  const window = {};
  runInNewContext(`(${install.toString()})(${JSON.stringify(resources)})`, { window });
  return window.__resources;
}

describe('C5 shared Design resource remapping', () => {
  it('C5 produces the exact three local vendor resources from the page origin', () => {
    expect(designResourceMap('http://127.0.0.1:12345/nested/menu.html?x=1')).toEqual(EXPECTED);
    const map = designResourceMap('http://127.0.0.1:12345');
    map['https://unpkg.com/react@18.3.1/umd/react.production.min.js'] = '/changed';
    expect(designResourceMap('http://127.0.0.1:12345')).toEqual(EXPECTED); // no mutable shared state
  });
  it('C5 init script installs the complete map without relying on a module closure', async () => {
    const page = { addInitScript: vi.fn() };
    await installDesignResources(page, 'http://127.0.0.1:12345');
    expect(installedResources(page)).toEqual(EXPECTED);
  });
  it('C5 capture consumer installs the common vendor map on both independent reloads', async () => {
    const root = mkdtempSync(join(tmpdir(), 'c5-resource-capture-')); dirs.push(root);
    const pages = [];
    driver.browserClosed = 0; driver.serverClosed = 0;
    driver.newPage = vi.fn(async () => {
      const page = {
        clock: { install: vi.fn(), pauseAt: vi.fn(), runFor: vi.fn() },
        addInitScript: vi.fn(), route: vi.fn(), goto: vi.fn(), waitForLoadState: vi.fn(),
        evaluate: vi.fn(), addStyleTag: vi.fn(), on: vi.fn(), close: vi.fn(),
        screenshot: vi.fn(async () => Buffer.from('repeatable protocol fixture')),
      };
      pages.push(page); return page;
    });
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const result = await captureFrames(root, 'demo', 'yard', { mode: 'scene', viewport: { width: 16, height: 16 }, entry: 'index.html', presets: [{ id: 'front', frame: 1 }] });
    expect(result.shots).toHaveLength(1);
    expect(pages).toHaveLength(2);
    for (const page of pages) {
      expect(installedResources(page)).toEqual(EXPECTED);
      expect(page.addInitScript.mock.calls[1][1]).toEqual({ camera: null }); // the independent seed/camera script remains separate
      expect(page.close).toHaveBeenCalledTimes(1);
    }
    expect(driver.browserClosed).toBe(1);
    expect(driver.serverClosed).toBe(1);
  });
});
