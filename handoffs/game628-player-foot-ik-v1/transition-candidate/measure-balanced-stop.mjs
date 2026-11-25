import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { bindShoe } from './heel-contact.mjs';
import { file, makeReplay } from './replay.mjs';

const hz = 480;
const bytes = Uint8Array.from(await readFile(new URL(file, import.meta.url))).buffer;
const mm = n => +(n * 1000).toFixed(2);
async function sample(mode, release, supportingSide) {
  const { scene, animations } = await new GLTFLoader().parseAsync(bytes, '');
  const pose = makeReplay(scene, animations, mode, release);
  const side = supportingSide === 0 ? 'Left' : 'Right';
  const foot = scene.getObjectByName(side + 'Foot');
  const shoe = bindShoe(foot, scene.getObjectByName(side + '-sole'));
  let support, origin;
  const rows = [];
  for (let frame = -60; frame < Math.ceil((release + .57) * hz); frame++) {
    const t = frame / hz;
    const sample = pose(t);
    const inWorld = point => point.clone().applyMatrix4(foot.matrixWorld);
    if (t < release) {
      support = shoe.points.reduce((a, b) => inWorld(a).y <= inWorld(b).y ? a : b);
      origin = inWorld(support);
    } else {
      const point = inWorld(support);
      rows.push({ delay: t - release, sample, pivot: Math.hypot(point.x - origin.x, point.z - origin.z) });
    }
  }
  return rows;
}
function describe(rows, side) {
  const held = rows.filter(row => row.delay < .141);
  const settle = held.find(row => row.sample.sections[side][0] < .02);
  return {
    heelBelow20Ms: settle ? Math.round(settle.delay * 1000) : null,
    heelAt120Mm: mm(held.find(row => row.delay >= .12).sample.sections[side][0]),
    maxGroundPivotDriftBeforeTransferMm: mm(Math.max(...held.map(row => row.pivot))),
    maxBothOffGroundMm: mm(Math.max(...rows.map(row => Math.min(...row.sample.shoes)))),
    deepestMm: mm(Math.min(...rows.flatMap(row => row.sample.shoes))),
    finalClearanceMm: rows.at(-1).sample.shoes.map(mm),
  };
}
const releases = [];
for (const [time, side] of [[3.196, 0], [2.658, 1], [.24, 1], [.49, 1], [.82, 0], [1.06, 0], [1.25, 1], [1.46, 1], [1.60, 1], [2.06, 0], [2.26, 0]]) {
  const [before, after] = await Promise.all(['recovery-step', 'balanced-stop'].map(mode => sample(mode, time, side)));
  const original = describe(before, side), adjusted = describe(after, side);
  releases.push({ time, side, original, adjusted });
  if (time === 3.196 || time === 2.658) {
    assert.ok(original.heelAt120Mm > 150 && adjusted.heelAt120Mm < 15 && adjusted.heelBelow20Ms < 80);
    assert.ok(adjusted.maxGroundPivotDriftBeforeTransferMm < 1);
  }
  assert.ok(adjusted.maxBothOffGroundMm <= 1.5 && adjusted.deepestMm >= -1.5 &&
    adjusted.finalClearanceMm.every(height => Math.abs(height) <= 1.5), JSON.stringify({ time, adjusted }));
}
await writeFile(new URL('balanced-stop-verification.json', import.meta.url), JSON.stringify({ hz, releases }, null, 2) + '\n');
console.log(JSON.stringify(releases.slice(0, 2)));
