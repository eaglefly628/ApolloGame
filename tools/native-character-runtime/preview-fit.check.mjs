import assert from 'node:assert/strict';
import { previewFit, previewGroundOrigin, previewPosterRect } from './preview-fit.mjs';
const canvas = { width: 1312, height: 1199 }, paw = [490, 1138];
for (const [w, h] of [[540, 540], [800, 400], [400, 800]]) {
  const fit = previewFit(w, h, canvas);
  const ground = previewGroundOrigin(w, h, canvas, paw);
  assert.ok(fit.zoom > 0 && fit.panX >= 0 && fit.panY >= 0);
  for (const scale of [1, .75, .5]) {
    const projected = [fit.panX + paw[0] * fit.zoom, fit.panY + paw[1] * fit.zoom];
    assert.deepEqual(projected.map((v, i) => ground[i] + scale * (v - ground[i])), ground);
    const poster = previewPosterRect(w, h, canvas, paw, scale);
    const staticPaw = [poster.x + paw[0] / canvas.width * poster.width, poster.y + paw[1] / canvas.height * poster.height];
    staticPaw.forEach((v, i) => assert.ok(Math.abs(v - ground[i]) < 1e-9, 'Static fallback must use native paw projection'));
    assert.ok(Math.abs(poster.width / poster.height - canvas.width / canvas.height) < 1e-9);
    for (const [x, y] of [[0, 0], [445, 284], [1312, 1199]]) {
      const native = [ground[0] + scale * (fit.panX + x * fit.zoom - ground[0]), ground[1] + scale * (fit.panY + y * fit.zoom - ground[1])];
      const image = [poster.x + x / canvas.width * poster.width, poster.y + y / canvas.height * poster.height];
      image.forEach((v, i) => assert.ok(Math.abs(v - native[i]) < 1e-9, 'Whole-image projection must match native at every size'));
    }
  }
}
assert.ok(previewGroundOrigin(540, 540, canvas, paw)[1] < 540, 'Paw anchor must exclude the viewport bottom margin');
console.log('Preview fit: native + static poster projection matches at 3 sizes and 3 viewports');
