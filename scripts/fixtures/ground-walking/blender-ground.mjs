// Explicitly authored offline terrain for R2 acceptance. These inputs are not
// Tripo models, approved game assets, or evidence that a paid API was executed.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { glb } from '../scene-import/glb-fixtures.mjs';

const CUBE = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7];
export const GROUND_FIXTURE_LAYOUT = Object.freeze({
  ramp: { x: [-4, 4], z: [-5, -3], slopeX: .25, intercept: 1, from: { x: -3.5, z: -4 }, turn: { x: 1, z: -4 } },
  legalStep: { x: [-4, 4], z: [-1, 1], boundaryX: 0, lowY: 0, highY: .2 },
  highStep: { x: [-4, 4], z: [3, 5], boundaryX: 0, lowY: 0, highY: 1 },
  hole: { x: [-4, 4], z: [7, 9], gapX: [-.1, .1] },
  wallRamp: { x: [-4, 4], z: [11, 13], slopeX: .25, intercept: 1, wall: { min: [-.1, 0, 11.4], max: [.1, 4, 12.6] } },
  marker: { bounds: { min: [-.15, 0, -.1], max: [.15, 1.2, .1] }, pivot: 'feet' },
});
const clean = value => Math.round(value * 10000) / 10000 || 0;
function box(name, min, max, color, height = () => 0) {
  const [x0, y0, z0] = min, [x1, y1, z1] = max;
  const positions = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]].flatMap(([x, y, z]) => [x, clean(y + height(x, z)), z]);
  return { name, positions, indices: CUBE, color };
}
function nav(name, x0, z0, x1, z1, height) {
  return { name, positions: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].flatMap(([x, z]) => [x, clean(height(x, z)), z]), indices: [0, 2, 1, 0, 3, 2], color: [.2, .8, .4, 1] };
}
function authored(objects) {
  const json = { asset: { version: '2.0', generator: 'Apollo explicitly authored offline R2 terrain fixture' }, scene: 0, scenes: [{ nodes: [] }], nodes: [], meshes: [], accessors: [], bufferViews: [], buffers: [], materials: [] };
  const blobs = []; let offset = 0;
  const view = bytes => { const pad = Buffer.alloc((4 - offset % 4) % 4); blobs.push(pad); offset += pad.length; const id = json.bufferViews.length; json.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length }); blobs.push(bytes); offset += bytes.length; return id; };
  for (const object of objects) {
    const p = Buffer.alloc(object.positions.length * 4), i = Buffer.alloc(object.indices.length * 2);
    object.positions.forEach((value, index) => p.writeFloatLE(value, index * 4)); object.indices.forEach((value, index) => i.writeUInt16LE(value, index * 2));
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]; object.positions.forEach((value, index) => { min[index % 3] = Math.min(min[index % 3], value); max[index % 3] = Math.max(max[index % 3], value); });
    const position = json.accessors.length; json.accessors.push({ bufferView: view(p), componentType: 5126, type: 'VEC3', count: object.positions.length / 3, min, max });
    const indices = json.accessors.length; json.accessors.push({ bufferView: view(i), componentType: 5123, type: 'SCALAR', count: object.indices.length });
    const material = json.materials.length; json.materials.push({ name: object.name + '-material', doubleSided: false, pbrMetallicRoughness: { baseColorFactor: object.color, metallicFactor: 0, roughnessFactor: .7 } });
    const mesh = json.meshes.length; json.meshes.push({ name: object.name, primitives: [{ attributes: { POSITION: position }, indices, material }] });
    json.scenes[0].nodes.push(json.nodes.length); json.nodes.push({ name: object.name, mesh });
  }
  json.buffers.push({ byteLength: offset }); return glb(json, Buffer.concat(blobs));
}
export function createGroundWalkingFixture(dir) {
  mkdirSync(dir, { recursive: true });
  const save = (name, value) => { const path = join(dir, name); writeFileSync(path, Buffer.isBuffer(value) ? value : JSON.stringify(value, null, 2)); return path; };
  const objects = [], ramp = x => .25 * x + 1;
  function lane(id, x0, x1, z0, z1, height, color) {
    objects.push(box(`col_${id}`, [x0, -.4, z0], [x1, 0, z1], color, height), nav(`nav_${id}`, x0, z0, x1, z1, height));
  }
  lane('ramp', -4, 4, -5, -3, ramp, [.3, .55, .7, 1]);
  lane('step_low', -4, 0, -1, 1, () => 0, [.35, .6, .35, 1]);
  lane('step_high', 0, 4, -1, 1, () => .2, [.55, .7, .35, 1]);
  lane('high_low', -4, 0, 3, 5, () => 0, [.65, .45, .3, 1]);
  lane('high_high', 0, 4, 3, 5, () => 1, [.7, .3, .3, 1]);
  lane('hole_left', -4, -.1, 7, 9, () => 0, [.45, .4, .65, 1]);
  lane('hole_right', .1, 4, 7, 9, () => 0, [.45, .4, .65, 1]);
  lane('wall_ramp', -4, 4, 11, 13, ramp, [.35, .6, .6, 1]);
  objects.push(box('col_wall', GROUND_FIXTURE_LAYOUT.wallRamp.wall.min, GROUND_FIXTURE_LAYOUT.wallRamp.wall.max, [.7, .2, .2, 1]));
  const sourcePath = save('authored-terrain.glb', authored(objects));
  const markerPath = save('foot-marker.glb', authored([box('feet-pivot-marker', [-.15, 0, -.1], [.15, 1.2, .1], [.95, .7, .1, 1])]));
  save('asset-split.json', [{ id: 'terrain', scene: 'r2-offline', bbox: [0, 0, 32, 32], route: 'generate', skinKey: 'fixture/r2-terrain', prompt: 'Explicit offline authored geometry for R2 engine acceptance', refs: ['keyart/offline.png'], state: 'approved' }]);
  // T7 deliberately renames imported children. One semantic anchor per source
  // preserves col/nav intent without changing the production Blender worker.
  const inputs = ['asset-split.json'];
  const instances = objects.map((object, index) => {
    const name = `part-${index}.glb`; save(name, authored([{ ...object, name: 'authored-part' }])); inputs.push(name);
    return { splitId: 'terrain', name: object.name, source: { input: index + 1 }, position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 };
  });
  const job = { op: 'build-scene', inputs, params: { scene: 'r2-offline', objects: instances }, outputs: ['scene.glb'] };
  return { jobPath: save('build.json', job), sourcePath, markerPath, layout: GROUND_FIXTURE_LAYOUT };
}
