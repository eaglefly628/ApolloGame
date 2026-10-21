import assert from 'node:assert/strict';
import { observeNativeFit } from './fit-observer.mjs';
import { previewFit } from './preview-fit.mjs';
let notify, observed, disconnected = false;
class Observer {
  constructor(fn) { notify = fn; }
  observe(el) { observed = el; }
  disconnect() { disconnected = true; }
}
const canvas = { clientWidth: 200, clientHeight: 200 };
const dimensions = { width: 1312, height: 1199 };
const views = [];
const release = observeNativeFit(canvas, () => dimensions, view => views.push(view), Observer);
assert.equal(observed, canvas);
assert.deepEqual(views.at(-1), previewFit(200, 200, dimensions));
for (const [width, height] of [[100, 100], [400, 200], [120, 300]]) {
  canvas.clientWidth = width; canvas.clientHeight = height; notify();
  assert.deepEqual(views.at(-1), previewFit(width, height, dimensions));
}
canvas.clientWidth = 0; notify();
assert.equal(views.length, 4, 'hidden zero-size box must not poison native view');
release(); assert.equal(disconnected, true);
console.log('PASS: native contain refits 1/.5 and asymmetric viewport updates, releases observer.');
