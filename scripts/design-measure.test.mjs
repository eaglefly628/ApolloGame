import { describe, it, expect, afterEach, vi } from 'vitest';
import { runInNewContext } from 'node:vm';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, symlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { measureDocument, measurePage, loadDesignMeasureConfig, runDesignMeasure, createDesignRequestHandler } from './design-measure.mjs';

const driver = vi.hoisted(() => ({ page: null, newPage: null, close: null }));
vi.mock('node:http', () => ({ createServer: () => ({
  once() {}, listen(_port, _host, callback) { callback(); }, address() { return { port: 12345 }; }, close(callback) { callback(); },
}) }));
vi.mock('playwright', () => ({ chromium: { launch: async () => ({ newPage: (...args) => driver.newPage(...args), close: (...args) => driver.close(...args) }) } }));

const temporary = [];
function temp() { const dir = mkdtempSync(join(tmpdir(), 'design-measure-test-')); temporary.push(dir); return dir; }
function config(root, value, slug = 'demo') {
  const dir = join(root, 'docs/design', slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'design-measure.json'), JSON.stringify(value));
  return dir;
}
function dom({ scaleX = 0.5, scaleY = scaleX, matches = 1, stageMatches = 1, tiny = false } = {}) {
  const style = { backgroundImage: 'none', backgroundColor: 'rgb(10, 20, 30)', color: 'rgb(250, 240, 230)', fontSize: '24px', fontWeight: '700', fontFamily: 'Inter, sans-serif', borderTopWidth: '2px', borderTopColor: 'rgb(1, 2, 3)', borderTopLeftRadius: '8px' };
  const item = { tagName: 'BUTTON', childNodes: [{ nodeType: 3, nodeValue: ' Confirm ' }, { nodeType: 1, nodeValue: 'ignored' }], getBoundingClientRect: () => ({ left: 100 + 200 * scaleX, top: 40 + 120 * scaleY, width: tiny ? 0 : 300 * scaleX, height: 80 * scaleY }) };
  const stage = {
    style: { width: '1920px', height: '1080px' },
    getBoundingClientRect: () => ({ left: 100, top: 40, width: 1920 * scaleX, height: 1080 * scaleY }),
    querySelectorAll: selector => selector === '*' ? [item] : Array.from({ length: matches }, () => item),
  };
  return { document: { querySelectorAll: selector => selector === '#stage' ? Array.from({ length: stageMatches }, () => stage) : [stage, item] }, getComputedStyle: () => style, console };
}
function game108Config(root) { return config(root, JSON.parse(readFileSync(new URL('../docs/design/game108/design-measure.json', import.meta.url), 'utf8')), 'game108'); }
function measure(opts = {}, fixture = {}) { return runInNewContext(`(${measureDocument.toString()})(${JSON.stringify(opts)})`, dom(fixture)); }
afterEach(() => { vi.restoreAllMocks(); for (const dir of temporary.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe('common browser ruler', () => {
  it('measures real position, dimensions, text and computed colors after stage scaling', () => {
    const m = measure({ items: [{ id: 'confirm', selector: '.confirm' }] });
    expect(m.scale).toBe(0.5);
    expect(m.count).toBe(1);
    expect(m.boxes[0]).toEqual({ id: 'confirm', tag: 'button', text: 'Confirm', x: 200, y: 120, w: 300, h: 80, bg: 'rgb(10, 20, 30)', color: 'rgb(250, 240, 230)', font: '24px/700 Inter', border: '2px rgb(1, 2, 3)', radius: '8px' });
  });
  it('corrects the two axes independently and retains old boxes shape without items', () => {
    const m = measure({}, { scaleX: 0.5, scaleY: 0.25 });
    expect(m.boxes[0]).toMatchObject({ x: 200, y: 120, w: 300, h: 80 });
    expect(m.boxes[0]).not.toHaveProperty('id');
  });
  it.each([0, 2])('rejects explicit selectors matching %s elements', matches => {
    expect(() => measure({ items: [{ id: 'confirm', selector: '.confirm' }] }, { matches })).toThrow(`元素 confirm selector 命中 ${matches} 件`);
  });
  it('rejects absent/ambiguous stages and invisible named elements', () => {
    expect(() => measure({ stageSelector: '#stage' }, { stageMatches: 0 })).toThrow('找不到');
    expect(() => measure({ stageSelector: '#stage' }, { stageMatches: 2 })).toThrow('舞台 selector 命中 2 件');
    expect(() => measure({ items: [{ id: 'confirm', selector: '.confirm' }] }, { tiny: true })).toThrow('元素 confirm 不可见');
    expect(measure({}, { tiny: true }).count).toBe(0);
    expect(() => measure({}, { scaleX: 0 })).toThrow('缩放为零');
  });
  it('rejects invalid dimensions and duplicate item identities', () => {
    expect(() => measure({ width: 0 })).toThrow('画布尺寸');
    expect(() => measure({ items: [{ id: 'a', selector: 'a' }, { id: 'a', selector: 'b' }] })).toThrow('唯一 id');
  });
  it('measurePage invokes the same self-contained ruler through the page API', async () => {
    const page = { evaluate: vi.fn((fn, opts) => runInNewContext(`(${fn.toString()})(${JSON.stringify(opts)})`, dom())) };
    const m = await measurePage(page, { items: [{ id: 'same', selector: '.confirm' }] });
    expect(page.evaluate).toHaveBeenCalledWith(measureDocument, { items: [{ id: 'same', selector: '.confirm' }] });
    expect(m.boxes[0]).toMatchObject({ id: 'same', x: 200, w: 300 });
  });
  it('logs refusal from a browser measurement failure', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(measurePage({ evaluate: async () => { throw new Error('selector not found'); } })).rejects.toThrow('selector not found');
    expect(log).toHaveBeenCalledWith(expect.stringContaining('拒收量稿'));
  });
});

describe('configuration and legacy protocol', () => {
  it('C5 committed game108 configuration retains source, output and five tab labels', () => {
    const root = temp(); game108Config(root);
    const c = loadDesignMeasureConfig('game108', { root });
    expect(c.source).toBe(join(root, 'games/game108/design_handoff_rule_of_three_battle'));
    expect(c.entry).toBe('design/battle-screen.dc.html');
    expect(c.out).toBe(join(root, 'docs/design/game108/design-ref'));
    expect(c.canvas).toEqual({ width: 1920, height: 1080 });
    expect(c.states).toEqual([{ id: 'T1', label: 'T1 蓄力' }, { id: 'T2', label: 'T2 出招' }, { id: 'T3', label: 'T3 对决' }, { id: 'T4', label: 'T4 结算' }, { id: '终局', label: '终局' }]);
    expect(c.items).toBeUndefined();
    expect(c.skipMissingStates).toBe(true);
  });
  it('C5 an unconfigured game108 follows the same generic defaults as every other slug', () => {
    const root = temp(), c = loadDesignMeasureConfig('game108', { root });
    expect(c.source).toBe(join(root, 'docs/design/game108/ui-refs'));
    expect(c.entry).toBe('index.html');
    expect(c.states).toEqual([{ id: 'default' }]);
    expect(c.skipMissingStates).toBe(false);
  });
  it('C5 five-state configuration is reusable by a different slug without any source branch', () => {
    const root = temp();
    const data = JSON.parse(readFileSync(new URL('../docs/design/game108/design-measure.json', import.meta.url), 'utf8'));
    config(root, data, 'another-game');
    expect(loadDesignMeasureConfig('another-game', { root }).states).toEqual([
      { id: 'T1', label: 'T1 蓄力' }, { id: 'T2', label: 'T2 出招' }, { id: 'T3', label: 'T3 对决' }, { id: 'T4', label: 'T4 结算' }, { id: '终局', label: '终局' },
    ]);
  });
  it('defaults a new slug to its ui-refs directory and accepts explicit shared-ruler settings', () => {
    const root = temp();
    expect(loadDesignMeasureConfig('demo', { root })).toMatchObject({ source: join(root, 'docs/design/demo/ui-refs'), entry: 'index.html', states: [{ id: 'default' }] });
    config(root, { source: 'docs/design/demo/ui-refs', entry: 'menu.html', canvas: { width: 800, height: 600, selector: '#canvas' }, states: [{ id: 'menu', label: 'Menu' }], items: [{ id: 'start', selector: '#start' }] });
    expect(loadDesignMeasureConfig('demo', { root })).toMatchObject({ entry: 'menu.html', canvas: { width: 800, height: 600, selector: '#canvas' }, items: [{ id: 'start', selector: '#start' }] });
  });
  it.each([
    [{ source: '../outside' }, '越界'], [{ source: '/etc' }, '相对路径'],
    [{ entry: '../../outside.html' }, '越界'], [{ entry: 'x.js' }, 'HTML'],
    [{ canvas: { width: 0, height: 10 } }, 'canvas'], [{ states: [] }, 'states'],
    [{ states: [{ id: '../bad' }] }, 'states'], [{ states: [{ id: 'a' }, { id: 'a' }] }, 'states'],
    [{ states: [{ id: 'a', label: 'same' }, { id: 'b', label: 'same' }] }, 'label'],
    [{ skipMissingStates: 'yes' }, 'skipMissingStates'],
    [{ items: [] }, 'items'], [{ items: [{ id: 'a', selector: '' }] }, 'items'],
    [{ items: [{ id: 'a', selector: '#a' }, { id: 'a', selector: '#b' }] }, 'items'],
  ])('rejects invalid config %j', (value, message) => {
    const root = temp(); config(root, value);
    expect(() => loadDesignMeasureConfig('demo', { root })).toThrow(message);
  });
  it('rejects slug traversal and symlink escape before opening HTML', () => {
    const root = temp(), outside = temp();
    expect(() => loadDesignMeasureConfig('../demo', { root })).toThrow('非法 slug');
    symlinkSync(outside, join(root, 'escaped'));
    config(root, { source: 'escaped', entry: 'index.html' });
    expect(() => loadDesignMeasureConfig('demo', { root })).toThrow('符号链接越界');
  });
  it('writes explicit offline mock in an isolated path, without real measurement artifacts', async () => {
    const root = temp(); config(root, { states: [{ id: 'menu', label: 'Menu' }] });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = await runDesignMeasure('demo', { root, mock: true });
    expect(r.mock).toBe(true);
    expect(JSON.parse(readFileSync(join(r.out, 'measure.json'), 'utf8'))).toMatchObject({ mock: true, states: { Menu: [] } });
    expect(r.out).toBe(join(root, 'docs/design/demo/design-ref/mock'));
    expect(existsSync(join(root, 'docs/design/demo/design-ref/measure.json'))).toBe(false);
    expect(existsSync(join(r.out, 'dc-menu.png'))).toBe(false);
  });
  it('original game108 command remains an executable wrapper and mock preserves its states', () => {
    const root = temp(); game108Config(root);
    const result = spawnSync(process.execPath, [resolve('scripts/game108-design-measure.mjs'), '--root', root, '--mock'], { encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    const data = JSON.parse(readFileSync(join(root, 'docs/design/game108/design-ref/mock/measure.json'), 'utf8'));
    expect(Object.keys(data.states)).toEqual(['T1 蓄力', 'T2 出招', 'T3 对决', 'T4 结算', '终局']);
    expect(data.mock).toBe(true);
  });
});

function request(handler, path, method = 'GET') {
  let status, text;
  handler({ url: path, method }, { writeHead: code => { status = code; }, end: body => { text = body?.toString() ?? ''; } });
  return { status, text };
}
describe('read-only local source serving', () => {
  it('serves only local files and refuses traversal, symlinks and writes', async () => {
    const source = temp(), outside = temp();
    writeFileSync(join(source, 'index.html'), '<div>local</div>');
    writeFileSync(join(outside, 'secret.html'), 'secret');
    symlinkSync(join(outside, 'secret.html'), join(source, 'escape.html'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const handler = createDesignRequestHandler(source);
    {
      expect(await request(handler, '/index.html')).toEqual({ status: 200, text: '<div>local</div>' });
      expect((await request(handler, '/..%2fsecret.html')).status).toBe(403);
      expect((await request(handler, '/escape.html')).status).toBe(403);
      expect((await request(handler, '/index.html', 'POST')).status).toBe(405);
      expect((await request(handler, '/missing.html')).status).toBe(404);
      expect((await request(handler, '/__vendor/react.js')).status).toBe(404);
    }
  });
});

describe('render driver protocol (mocked browser and listener)', () => {
  it('C5 configured game108 executes five exact labels and installs the shared resource map', async () => {
    const root = temp(), source = join(root, 'games/game108/design_handoff_rule_of_three_battle/design');
    game108Config(root);
    mkdirSync(source, { recursive: true });
    writeFileSync(join(source, 'battle-screen.dc.html'), '<div>fixture</div>');
    const clicked = [], shots = [], labels = ['T1 蓄力', 'T2 出招', 'T3 对决', 'T4 结算', '终局'];
    const page = {
      addInitScript: vi.fn(), on: vi.fn(), goto: vi.fn(), waitForTimeout: vi.fn(),
      $$: async () => labels.map(label => ({ textContent: async () => label, click: async () => clicked.push(label) })),
      evaluate: async (fn, opts) => runInNewContext(`(${fn.toString()})(${JSON.stringify(opts)})`, dom()),
      evaluateHandle: async () => ({ asElement: () => ({ screenshot: async ({ path }) => shots.push(path) }), dispose: vi.fn() }),
    };
    driver.newPage = vi.fn(async () => page); driver.close = vi.fn();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = await runDesignMeasure('game108', { root, env: { RENDER_PROBE_CHROMIUM: process.execPath } });
    expect(driver.newPage).toHaveBeenCalledWith({ viewport: { width: 1960, height: 1400 }, deviceScaleFactor: 1 });
    expect(clicked).toEqual(labels);
    expect(shots.map(path => path.split('/').at(-1))).toEqual(['dc-T1.png', 'dc-T2.png', 'dc-T3.png', 'dc-T4.png', 'dc-终局.png']);
    const measured = JSON.parse(readFileSync(join(result.out, 'measure.json'), 'utf8'));
    expect(Object.keys(measured)).toEqual(labels);
    expect(measured['T1 蓄力'][0]).toMatchObject({ x: 200, y: 120, w: 300, h: 80 });
    expect(measured['T1 蓄力'][0]).not.toHaveProperty('id');
    expect(driver.close).toHaveBeenCalledTimes(1);
    const [install, resources] = page.addInitScript.mock.calls[0];
    const window = {};
    runInNewContext(`(${install.toString()})(${JSON.stringify(resources)})`, { window });
    expect(window.__resources).toEqual({
      'https://unpkg.com/react@18.3.1/umd/react.production.min.js': 'http://127.0.0.1:12345/__vendor/react.js',
      'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js': 'http://127.0.0.1:12345/__vendor/react-dom.js',
      'https://unpkg.com/@babel/standalone@7.29.0/babel.min.js': 'http://127.0.0.1:12345/__vendor/babel.js',
    });
  });
  it('closes the browser on missing configured tabs and does not write a false measurement', async () => {
    const root = temp();
    config(root, { states: [{ id: 'missing', label: 'Missing' }] });
    mkdirSync(join(root, 'docs/design/demo/ui-refs'));
    writeFileSync(join(root, 'docs/design/demo/ui-refs/index.html'), 'fixture');
    driver.newPage = vi.fn(async () => ({ addInitScript() {}, on() {}, goto() {}, waitForTimeout() {}, $$: async () => [] }));
    driver.close = vi.fn();
    await expect(runDesignMeasure('demo', { root, env: { RENDER_PROBE_CHROMIUM: process.execPath } })).rejects.toThrow('页签 Missing 命中 0 件');
    expect(driver.close).toHaveBeenCalledTimes(1);
    expect(existsSync(join(root, 'docs/design/demo/design-ref/measure.json'))).toBe(false);
  });
});

describe('C5 data-driven missing-state compatibility', () => {
  it('C5 skipMissingStates preserves configured legacy tab skip behavior without a game branch', async () => {
    const root = temp(); config(root, { states: [{ id: 'absent', label: 'Absent' }], skipMissingStates: true });
    mkdirSync(join(root, 'docs/design/demo/ui-refs'));
    writeFileSync(join(root, 'docs/design/demo/ui-refs/index.html'), 'fixture');
    driver.newPage = vi.fn(async () => ({ addInitScript() {}, on() {}, goto() {}, waitForTimeout() {}, $$: async () => [] }));
    driver.close = vi.fn();
    const log = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = await runDesignMeasure('demo', { root, env: { RENDER_PROBE_CHROMIUM: process.execPath } });
    expect(JSON.parse(readFileSync(join(result.out, 'measure.json'), 'utf8'))).toEqual({});
    expect(log).toHaveBeenCalledWith(expect.stringContaining('找不到页签 Absent，跳过'));
    expect(driver.close).toHaveBeenCalledTimes(1);
  });
});
