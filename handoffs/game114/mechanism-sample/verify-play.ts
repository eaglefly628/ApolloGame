import assert from 'node:assert/strict';
import { Engine } from '@zerocraft/engine/runtime/engine.js';
import { applyCommands } from '@zerocraft/engine/net/commands.js';
import type { Camera3D, NavigationGrid, Shape, Transform } from '@zerocraft/engine/engine/protocol/components.js';
import { playBlueprint, playCartId, playPatrolIds, playRoutes } from './play-scene';
import { ScenarioControls } from './scenario-controls';

const engine = new Engine();
engine.load(playBlueprint);
const world = engine.world;
const controls = new ScenarioControls(world, 36, true, 'play');
assert.equal(controls.state.oxen, 36);
assert.equal(playRoutes.length, 6);
assert.equal(playPatrolIds.length, 36);
const occupiedTiles = new Set(playPatrolIds.map(id => {
  const point = playBlueprint.entities[id]!.Transform!;
  return `${Math.floor((point.x + 96) / 64)},${Math.floor((point.y + 96) / 64)}`;
}));
assert.equal(occupiedTiles.size, 9, 'all nine map squares need moving patrols');
for (const route of playRoutes) {
  const xs = route.points.map(point => point.x), ys = route.points.map(point => point.y);
  assert(Math.max(...xs) - Math.min(...xs) > 128 || Math.max(...ys) - Math.min(...ys) > 128,
    'each marked route must cross two map seams');
}
assert.equal(Object.keys(playBlueprint.entities).filter(id => id === 'block-0' || id.startsWith('garden-tile-')).length, 9);
const grid = world.getComponent<NavigationGrid>('navigation-map', 'NavigationGrid')!;
assert.equal(grid.cols, 384);
assert.equal(grid.rows, 384);
assert.equal(grid.originX, -96);
assert.equal(grid.originY, -96);
const camera = world.getComponent<Camera3D>('camera', 'Camera3D')!;
assert.equal(camera.mode, 'follow');
assert.equal(camera.pitch, Math.PI / 3, 'camera should show a visible angled view');
assert.equal(camera.follow?.lookAhead, 0, 'camera must not extrapolate fixed-step movement');
controls.dispatch('scenario.add');
assert.equal(controls.state.oxen, 38, 'debug add should spawn two route patrols');
controls.dispatch('scenario.remove');
assert.equal(controls.state.oxen, 36, 'debug remove should remove two route patrols');
controls.dispatch('scenario.double');
assert.equal(controls.state.oxen, 72, 'debug double should increase patrol density');
for (let i = 0; i < 18; i++) controls.dispatch('scenario.remove');
assert.equal(controls.state.oxen, 36);
assert.equal(world.query('Line3D').filter(([id]) => playRoutes.some(route => id === `main-path-${route.id}`)).length, 6);
controls.dispatch('scenario.lines');
assert.equal(world.query('Line3D').filter(([id]) => id.startsWith('main-path-')).length, 0);
controls.dispatch('scenario.lines');
assert.equal(world.query('Line3D').filter(([id]) => playRoutes.some(route => id === `main-path-${route.id}`)).length, 6);
assert.equal(world.query('Model3D').filter(([id]) => id.startsWith('ox-')).length, 0);
const start = structuredClone(world.getComponent<Transform>(playCartId, 'Transform')!);
const patrolIds = world.query('PathFollow').map(([id]) => id).filter(id => id.startsWith('patrol-'));
assert.equal(patrolIds.length, 36);
const patrolStart = new Map(patrolIds.map(id => [id, structuredClone(world.getComponent<Transform>(id, 'Transform')!)]));
const lastPatrolPosition = new Map(patrolStart);
const cumulativeTravel = new Map(patrolIds.map(id => [id, 0]));
let worstBuildingPenetration = 0;
for (let tick = 1; tick <= 850; tick++) {
  applyCommands(world, tick <= 700 ? [{ playerId: 'p1', tick, move: { dx: 1, dy: 0 } }] : []);
  world.tick();
  for (const id of [playCartId, ...patrolIds]) {
    const t = world.getComponent<Transform>(id, 'Transform')!;
    if (id !== playCartId) {
      const last = lastPatrolPosition.get(id)!;
      cumulativeTravel.set(id, cumulativeTravel.get(id)! + Math.hypot(t.x - last.x, t.y - last.y));
      lastPatrolPosition.set(id, { ...t });
    }
    const radius = world.getComponent<Shape>(id, 'Shape')!.radius!;
    assert(Number.isFinite(t.x) && Number.isFinite(t.y));
    for (const buildingId of ['cottage-wing', 'garden-annex']) {
      const b = world.getComponent<Transform>(buildingId, 'Transform')!;
      const shape = world.getComponent<Shape>(buildingId, 'Shape')!;
      const dx = Math.max(Math.abs(t.x - b.x) - shape.width! / 2, 0);
      const dy = Math.max(Math.abs(t.y - b.y) - shape.height! / 2, 0);
      worstBuildingPenetration = Math.max(worstBuildingPenetration, radius - Math.hypot(dx, dy));
    }
  }
}
const cart = world.getComponent<Transform>(playCartId, 'Transform')!;
const travel = Math.hypot(cart.x - start.x, cart.y - start.y);
const patrolTravel = patrolIds.map(id => {
  const initial = patrolStart.get(id)!;
  const current = world.getComponent<Transform>(id, 'Transform')!;
  return Math.hypot(current.x - initial.x, current.y - initial.y);
});
const tileOf = (point: Transform) => `${Math.floor((point.x + 96) / 64)},${Math.floor((point.y + 96) / 64)}`;
const crossedPatrols = patrolIds.filter(id =>
  tileOf(patrolStart.get(id)!) !== tileOf(world.getComponent<Transform>(id, 'Transform')!)).length;
const minDistanceTravelled = Math.min(...cumulativeTravel.values());
console.log(JSON.stringify({ patrols: patrolIds.length, routes: playRoutes.length,
  cartTravel: travel, crossedPatrols, minPatrolDisplacement: Math.min(...patrolTravel),
  minPatrolTravel: minDistanceTravelled,
  worstBuildingPenetration }, null, 2));
assert(travel > 2, 'keyboard command should move the fortress');
assert(cart.x > 32, 'WASD-controlled fortress should cross into the eastern map tile');
assert(minDistanceTravelled > 2, 'every NPC should advance along a main route');
assert(crossedPatrols >= 6, 'patrols should actually continue across tile boundaries');
assert(worstBuildingPenetration < .25, 'building collision must remain solid');
