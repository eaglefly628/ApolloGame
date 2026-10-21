import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
// The original workbench pinned 534 files across two upstreams. This runtime
// deliberately distributes only Stretchy Studio; See-through inference is not
// needed for playback. Verify every pinned file in the distributed subtree.
const base = new URL('./', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('upstream-files.json', base)));
const files = Object.entries(manifest).filter(([name]) => name.startsWith('vendor/stretchystudio/'));
assert.equal(files.length, 210, 'Pinned runtime subtree count changed');
for (const [name, expected] of files) {
  assert.equal(createHash('sha256').update(await readFile(new URL(name, base))).digest('hex'), expected, name);
}
console.log(`PASS: ${files.length} unchanged upstream runtime files (not the inference subtree).`);
