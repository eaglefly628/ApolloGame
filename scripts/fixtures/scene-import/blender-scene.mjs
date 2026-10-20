// Reusable real-T7 fixture input generator. It writes only the authored input GLB,
// approved split data and closed build job in a caller-owned temporary directory.
// Call runBlenderJob(result.jobPath) to run the pinned real Blender bridge.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Euler, Quaternion } from 'three';
import { triangle } from './glb-fixtures.mjs';

export const SCENE_FIXTURE_LAYOUT = Object.freeze({
  wall: { name: 'col_wall', position: [0, 1, 0], size: [0.5, 2, 2], bounds: { min: [-0.25, 0, -1], max: [0.25, 2, 1] } },
  navigation: { bounds: { min: [-3, 0.001, -2.5], max: [3, 0.001, 2.5] }, cellSize: 0.5 },
  route: { from: [-2, 0, 0], to: [2, 0, 0], openAroundWallAtZ: [-1.5, 1.5] },
});

export function createSceneImportFixture(dir) {
  mkdirSync(dir, { recursive: true });
  const save = (name, value) => { const path = join(dir, name); writeFileSync(path, Buffer.isBuffer(value) ? value : JSON.stringify(value, null, 2)); return path; };
  const source = triangle(); source.json.nodes = [
    { name: 'authored_parent', translation: [2, 1, -3], rotation: new Quaternion().setFromEuler(new Euler(0.2, -0.4, 0.3)).toArray(), scale: [1.3, 0.7, 1.1], children: [1] },
    { name: 'authored_mesh', mesh: 0, translation: [0.25, 0.5, 0.75], scale: [1, 2, 0.5] },
  ]; save('nested-prop.glb', source.bytes());
  const row = (id, route) => ({ id, scene: 'e5-offline', bbox: [0, 0, 32, 32], route, skinKey: `fixture/${id}`, prompt: `explicit offline ${id}`, refs: ['keyart/offline.png'], state: 'approved' });
  save('asset-split.json', [row('floor', 'build'), row('wall', 'build'), row('prop', 'generate')]);
  const pose = { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 };
  const propPose = { position: [1, 0.5, 2], rotation: [0.1, 0.3, 0.2], scale: 1.2 }, wall = SCENE_FIXTURE_LAYOUT.wall;
  const job = { op: 'build-scene', inputs: ['asset-split.json', 'nested-prop.glb'], params: { scene: 'e5-offline', objects: [
    { ...pose, splitId: 'floor', name: 'col_floor', source: { primitive: 'box', size: [6, 0.2, 5] }, position: [0, -0.1, 0] },
    { ...pose, splitId: 'wall', name: wall.name, source: { primitive: 'box', size: [...wall.size] }, position: [...wall.position] },
    { ...pose, splitId: 'floor', name: 'nav_floor', source: { primitive: 'plane', size: [6, 0, 5] }, position: [0, 0.001, 0] },
    { ...propPose, splitId: 'prop', name: 'pick_prop', source: { input: 1 } },
    { ...pose, name: 'spawn_hero', source: { primitive: 'empty' }, position: [-1, 0, 1] },
  ] }, outputs: ['scene.glb'] };
  return { jobPath: save('build.json', job), job, source, propPose, layout: SCENE_FIXTURE_LAYOUT };
}
