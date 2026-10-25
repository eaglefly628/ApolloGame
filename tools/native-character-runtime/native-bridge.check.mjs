import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

// Execute the actual bridge with only GPU/model imports replaced by test stores.
// Anchors make a missing/moved bridge fail rather than quietly testing a copy.
const source = readFileSync(new URL('./native-bridge.mjs', import.meta.url), 'utf8');
assert.equal(source.match(/^import .*;$/gm)?.length, 9, 'bridge import anchors');
assert.equal(source.split('export function installNativeBridge(').length, 2, 'bridge installation anchor');
const executable = source.replace(/^import .*;$/gm, '').replace('export function installNativeBridge(', 'function installNativeBridge(');
const channel = 'apollo-native-character-v1';
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
function fixture(href, origin = new URL(href).origin) {
  const sent = [], listeners = new Map(), warnings = [];
  const parent = { postMessage(data, target) { if (target === 'null') throw new DOMException('Invalid targetOrigin', 'SyntaxError'); sent.push({ data, target }); } };
  const location = { href, origin, search: new URL(href).search };
  const window = { parent, addEventListener: (kind, listener) => listeners.set(kind, listener), removeEventListener: kind => listeners.delete(kind) };
  const canvas = { dataset: {}, getContext: () => ({ getContextAttributes: () => ({ antialias: false }) }) };
  const context = vm.createContext({ window, location, URL, URLSearchParams, console: { info() {}, error() {}, warn: (...value) => warnings.push(value) }, requestAnimationFrame: fn => fn(), document: { querySelector: () => canvas }, useProjectStore: { getState: () => ({ project: { animations: [], parameters: [] } }) }, useAnimationStore: { getState: () => ({ activeAnimationId: null, currentTime: 0, isPlaying: false }) } });
  vm.runInContext(executable, context);
  let dispose;
  const install = () => { dispose = context.installNativeBridge(); };
  const message = (data, messageOrigin = origin, source = parent) => listeners.get('message')?.({ data: { channel, type: 'command', id: 1, command: { type: 'status' }, ...data }, origin: messageOrigin, source });
  return { sent, listeners, warnings, install, message, parent, dispose: () => dispose?.() };
}
for (const [href, origin, target] of [['https://example.test/player', 'https://example.test', 'https://example.test'], ['apollo://app/player', 'null', '*'], ['apollo://app/player', 'apollo://app', 'apollo://app']]) {
  test(`ready/reply preserves v1 and uses ${target} for ${href} (${origin})`, async () => {
    const f = fixture(href, origin); f.install(); await flush();
    assert.equal(f.sent.length, 1); assert.equal(f.sent[0].data.type, 'ready'); assert.equal(f.sent[0].target, target);
    f.message({}, origin === 'null' ? 'apollo://other' : 'null'); f.message({}, origin, {}); f.message({}, origin, null);
    await flush(); assert.equal(f.sent.length, 1, 'foreign origin/window must receive no reply');
    f.message({}); await flush();
    assert.equal(f.sent.length, 2); assert.equal(f.sent[1].target, target); assert.equal(f.sent[1].data.ok, true); assert.equal(f.sent[1].data.id, 1);
    f.message({ id: 2, command: { type: 'unknown' } }); await flush();
    assert.equal(f.sent[2].target, target); assert.equal(f.sent[2].data.ok, false); assert.match(f.sent[2].data.error, /Unknown/);
    f.dispose(); assert.equal(f.listeners.size, 0);
  });
}
for (const href of ['file:///player.html', 'data:text/html,player', 'other://app/player', 'apollo://other/player', 'apollo://app:80/player', 'apollo://user@app/player', 'apollo://@app/player', 'https://user:secret@example.test/player']) {
  test(`does not install or announce a bridge on ${href}`, async () => {
    const f = fixture(href);
    assert.throws(f.install, /host origin/); await flush();
    assert.equal(f.listeners.size, 0); assert.equal(f.sent.length, 0);
  });
}
