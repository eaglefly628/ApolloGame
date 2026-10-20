// Real offline E5/T7 proof; fails if the pinned Blender executable is unavailable.
// BLENDER_BIN=<4.5.14 executable> SCENE_IMPORT_KEEP_EVIDENCE=1 node scripts/scene-import.integration.mjs
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { Matrix4, Quaternion, Euler, Vector3 } from 'three';
import { runBlenderJob } from './blender-job.mjs';
import { importScene } from './scene-import.mjs';
import { realDracoVariant } from './fixtures/scene-import/draco-variant.mjs';
import { createSceneImportFixture } from './fixtures/scene-import/blender-scene.mjs';

if (!process.env.BLENDER_BIN) throw new Error('Set pinned Blender 4.5.14 BLENDER_BIN; real E5 integration cannot skip or use mock');
const dir = mkdtempSync(join(tmpdir(), 'apollo-scene-import-real-'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const save = (name, value) => { const path = join(dir, name); writeFileSync(path, Buffer.isBuffer(value) ? value : JSON.stringify(value, null, 2)); return path; };
try {
  const { jobPath, source, propPose, layout } = createSceneImportFixture(dir);
  const a = runBlenderJob(jobPath), firstBytes = readFileSync(a.outputs[0].path), b = runBlenderJob(jobPath), secondBytes = readFileSync(b.outputs[0].path);
  assert.equal(a.mock, false); assert.equal(b.mock, false); assert.deepEqual(firstBytes, secondBytes, 'real T7 GLB must reproduce byte-for-byte');
  const data = await importScene(a.outputs[0].path, { out: join(dir, 'scene-a.json') });
  await importScene(b.outputs[0].path, { out: join(dir, 'scene-b.json') });
  assert.deepEqual(readFileSync(join(dir, 'scene-a.json')), readFileSync(join(dir, 'scene-b.json')), 'bake twice must reproduce exact candidate bytes');
  assert.equal(data.sourceSha256, sha(firstBytes));
  const byKind = Object.fromEntries(data.nodes.filter(n => n.kind !== 'display').map(n => [n.kind, n]));
  const byName = Object.fromEntries(data.nodes.map(n => [n.name, n]));
  assert.deepEqual(Object.keys(byKind).sort(), ['collision', 'navigation', 'pick', 'spawn']);
  assert.equal(data.nodes.filter(n => n.kind === 'collision').length, 2);
  assert.deepEqual(byName.col_floor.bounds, { min: [-3, -0.2, -2.5], max: [3, 0, 2.5] });
  assert.deepEqual(byName.col_wall.bounds, layout.wall.bounds);
  assert.deepEqual(byKind.navigation.bounds, layout.navigation.bounds);
  assert.equal(byName.col_floor.indices.length, 36); assert.equal(byName.col_wall.indices.length, 36); assert.equal(byKind.navigation.indices.length, 6); assert.equal(byKind.pick.indices.length, 3);
  assert(byName.col_wall.bounds.min[2] - byKind.navigation.bounds.min[2] >= 1.5 && byKind.navigation.bounds.max[2] - byName.col_wall.bounds.max[2] >= 1.5, 'wall must leave a 1.5m navigation passage at both ends');
  assert.equal(byKind.spawn.positions, undefined); assert.deepEqual(byKind.spawn.worldMatrix.slice(12, 15), [-1, 0, 1]);
  assert(data.nodes.some(n => n.path.length >= 3 && n.path.includes(byKind.pick.index)), 'real Blender must preserve nested imported hierarchy');
  const compose = node => new Matrix4().compose(new Vector3(...(node.translation || [0, 0, 0])), new Quaternion(...(node.rotation || [0, 0, 0, 1])), new Vector3(...(node.scale || [1, 1, 1])));
  const expected = compose({ translation: propPose.position, rotation: new Quaternion().setFromEuler(new Euler(...propPose.rotation)).toArray(), scale: [propPose.scale, propPose.scale, propPose.scale] }).multiply(compose(source.json.nodes[0])).multiply(compose(source.json.nodes[1]));
  const expectedPoints = [[0, 0, 0], [2, 0, 0], [0, 0, 3]].map(v => new Vector3(...v).applyMatrix4(expected));
  const actualPoints = Array.from({ length: byKind.pick.positions.length / 3 }, (_, i) => new Vector3(...byKind.pick.positions.slice(i * 3, i * 3 + 3)));
  for (const point of expectedPoints) assert(actualPoints.some(actual => actual.distanceTo(point) < 0.0003), `real world-space corner missing: ${point.toArray()}`);
  const dracoBytes = realDracoVariant(firstBytes); assert.deepEqual(realDracoVariant(firstBytes), dracoBytes, 'real encoder must be deterministic');
  const dracoPath = save('scene-draco.glb', dracoBytes), draco = await importScene(dracoPath, { out: join(dir, 'scene-draco.json') });
  assert.notEqual(draco.sourceSha256, data.sourceSha256); assert.deepEqual(draco.nodes, data.nodes, 'real same-scene Draco variant must decode to identical quantized data and parent matrices');
  const summary = { sourceSha256: data.sourceSha256, dracoSourceSha256: draco.sourceSha256, candidateSha256: sha(readFileSync(join(dir, 'scene-a.json'))), evidenceDir: dir, blenderRuns: [a.evidenceDir, b.evidenceDir], nodes: data.nodes.map(n => ({ index: n.index, path: n.path, name: n.name, kind: n.kind, triangles: (n.indices?.length || 0) / 3, bounds: n.bounds })), parentExpected: expected.toArray(), layout };
  save('measurements.json', summary); console.log(JSON.stringify(summary));
} finally {
  if (process.env.SCENE_IMPORT_KEEP_EVIDENCE === '1') console.error(`[scene-import-real] evidence retained: ${dir}`);
  else rmSync(dir, { recursive: true, force: true });
}
