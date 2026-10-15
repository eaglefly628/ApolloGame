import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import JSZip from 'jszip';
import { validateNativeProject } from './project-validation.mjs';
const base = new URL('./', import.meta.url);
const zip = await JSZip.loadAsync(await readFile(new URL('public/art/native-character-demo.stretch', base)));
const project = JSON.parse(await zip.file('project.json').async('string'));
validateNativeProject(project);
const mutate = change => { const copy=structuredClone(project);change(copy);return copy; };
const rejects = [
  [p => { p.nodes[0].parent = 'head'; }, /cyclic hierarchy/],
  [p => { p.nodes[0].parent = 'missing'; }, /missing parent/],
  [p => { p.nodes[1].id = p.nodes[0].id; }, /duplicate node ID/],
  [p => { p.textures.pop(); }, /missing texture/],
  [p => { p.nodes.find(n => n.mesh).mesh.triangles[0][0] = 65536; }, /triangle index/],
  [p => { p.nodes.find(n => n.mesh).mesh.uvs.pop(); }, /invalid mesh/],
  [p => { p.nodes.find(n => n.mesh).mesh.vertices[0].x = Infinity; }, /non-finite mesh/],
  [p => { p.animations[0].tracks[0].keyframes[1].time = 0; }, /keyframe time/],
  [p => { p.animations[0].tracks[0].property = 'puppet_pins'; }, /animation track/],
  [p => { p.animations[0].tracks.find(t => t.property === 'mesh_verts').keyframes[0].value.pop(); }, /mesh keyframe/],
  [p => { p.parameters[0].max = -2; }, /invalid parameter/],
];
for (const [change, expected] of rejects) assert.throws(() => validateNativeProject(mutate(change)), expected);
const manifest = JSON.parse(await readFile(new URL('upstream-files.json', base)));
for (const [relative, expected] of Object.entries(manifest)) {
  const actual=createHash('sha256').update(await readFile(new URL(relative,base))).digest('hex');
  assert.equal(actual,expected,`Upstream source modified: ${relative}`);
}
console.log(`PASS: fixture + ${rejects.length} malformed-project cases; ${Object.keys(manifest).length} upstream files unchanged.`);
