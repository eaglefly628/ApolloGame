import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { exportSpritegen } from './spritegen-export.mjs';

// Header-only geometry fixtures: not generated art and never shipped as PNG assets.
function header(w, h) { const b = Buffer.alloc(33); Buffer.from('89504e470d0a1a0a', 'hex').copy(b); b.write('IHDR', 12); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return b; }
function fixture(rows = 1) {
  const dir = mkdtempSync(join(tmpdir(), 'apollo-spritegen-test-'));
  const cells = Array.from({ length: 2 * rows }, (_, i) => ({ row: Math.floor(i / 2), column: i % 2, file: `cell-${i}.png`, empty: false }));
  const manifest = { id: 'test-only', kind: 'animation', grid: [2, rows], cellSize: [32, 32], files: { sheet: 'sheet.png', review: 'review.json' }, slices: cells };
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest));
  writeFileSync(join(dir, 'review.json'), JSON.stringify({ errors: [], warnings: [], cells: cells.map(() => ({ opaquePixels: 100, edgeOpaquePixels: 0 })) }));
  writeFileSync(join(dir, 'sheet.png'), header(64, 32 * rows));
  cells.forEach((c) => writeFileSync(join(dir, c.file), header(32, 32)));
  return { dir, manifest, options: { package: dir, out: join(dir, 'export'), id: 'game112/cat/test', url: '/games/game112/art/cat/test.png', fps: 6, license: 'Test fixture only', 'visual-approved': true } };
}
test('horizontal sheet maps to existing AssetIndex and Image.sprite', () => {
  const f = fixture(); const r = exportSpritegen(f.options);
  assert.deepEqual(r.entry.spec.sheet, { frameWidth: 32, frameHeight: 32, columns: 2, count: 2 });
  assert.deepEqual(r.imageNode.props.sprite, { frames: 2, fps: 6, frameAspect: 1 });
  assert.equal(JSON.parse(readFileSync(join(r.out, 'asset-index.json'))).version, 1);
  assert.throws(() => exportSpritegen(f.options), /already exists/);
});
test('multi-row exports grid metadata, never a falsely horizontal UI sprite', () => {
  const f = fixture(2); const r = exportSpritegen(f.options);
  assert.equal(r.entry.spec.sheet.count, 4); assert.equal(r.imageNode, null);
  assert.equal(existsSync(join(r.out, 'image-node.json')), false);
});
test('reject unreviewed, invalid fps, unsafe URL before any output', () => {
  for (const patch of [{ 'visual-approved': false }, { fps: NaN }, { fps: 0 }, { url: '/games/../secret.png' }]) {
    const f = fixture(); assert.throws(() => exportSpritegen({ ...f.options, ...patch }));
    assert.equal(existsSync(f.options.out), false);
  }
});
test('QA warnings/errors or empty/out-of-order/missing cells prevent export', () => {
  for (const issue of ['warnings', 'errors', 'empty', 'order', 'missing']) {
    const f = fixture();
    if (issue === 'warnings' || issue === 'errors') writeFileSync(join(f.dir, 'review.json'), JSON.stringify({ errors: [], warnings: [], [issue]: ['bad frame'] }));
    else { if (issue === 'empty') f.manifest.slices[0].empty = true; if (issue === 'order') f.manifest.slices.reverse(); if (issue === 'missing') f.manifest.slices.pop(); writeFileSync(join(f.dir, 'manifest.json'), JSON.stringify(f.manifest)); }
    assert.throws(() => exportSpritegen(f.options)); assert.equal(existsSync(f.options.out), false);
  }
});
test('wrong sheet geometry and symlink escapes fail without writing output', () => {
  const f = fixture(); writeFileSync(join(f.dir, 'sheet.png'), header(32, 32));
  assert.throws(() => exportSpritegen(f.options), /dimensions/);
  const g = fixture(); symlinkSync(join(f.dir, 'sheet.png'), join(g.dir, 'outside.png'));
  g.manifest.files.sheet = 'outside.png'; writeFileSync(join(g.dir, 'manifest.json'), JSON.stringify(g.manifest));
  assert.throws(() => exportSpritegen(g.options), /escapes/);
});
