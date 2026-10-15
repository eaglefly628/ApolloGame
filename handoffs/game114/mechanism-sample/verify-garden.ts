import assert from 'node:assert/strict';
import { Engine } from '@zerocraft/engine/runtime/engine.js';
import type { NavigationGrid, Shape, Transform } from '@zerocraft/engine/engine/protocol/components.js';
import { gardenBlueprint, gardenCoverage } from './garden-scene';
import { ScenarioControls } from './scenario-controls';

const oxen = Number(process.argv[2] ?? 64);
const ticks = Number(process.argv[3] ?? 400);
const engine = new Engine();
engine.load(gardenBlueprint);
const world = engine.world;
const controls = new ScenarioControls(world, oxen, false, 'garden');
assert.equal(controls.state.oxen, oxen, 'all requested oxen should fit on the lawn');
assert(gardenCoverage.blockedCells / gardenCoverage.totalCells >= .19);
assert(gardenCoverage.blockedCells / gardenCoverage.totalCells <= .21);

const grid = world.getComponent<NavigationGrid>('navigation-map', 'NavigationGrid')!;
assert.equal(grid.blocked.filter(Boolean).length, gardenCoverage.blockedCells);
const ids = world.query('CrowdAvoidance').map(([id]) => id);
const initial = new Map(ids.map(id => {
  const t = world.getComponent<Transform>(id, 'Transform')!;
  return [id, { x: t.x, y: t.y }];
}));
let worstPenetration = 0;
for (let tick = 0; tick < ticks; tick++) {
  world.tick();
  for (const id of ids) {
    const t = world.getComponent<Transform>(id, 'Transform')!;
    assert(Number.isFinite(t.x) && Number.isFinite(t.y), `${id} left finite space`);
    const radius = world.getComponent<Shape>(id, 'Shape')!.radius!;
    for (const buildingId of ['cottage-wing', 'garden-annex']) {
      const b = world.getComponent<Transform>(buildingId, 'Transform')!;
      const shape = world.getComponent<Shape>(buildingId, 'Shape')!;
      const dx = Math.max(Math.abs(t.x - b.x) - shape.width! / 2, 0);
      const dy = Math.max(Math.abs(t.y - b.y) - shape.height! / 2, 0);
      worstPenetration = Math.max(worstPenetration, radius - Math.hypot(dx, dy));
    }
  }
}
const moved = ids.filter(id => {
  const t = world.getComponent<Transform>(id, 'Transform')!;
  const start = initial.get(id)!;
  return Math.hypot(t.x - start.x, t.y - start.y) > 1;
}).length;
console.log(JSON.stringify({ oxen, ticks, blockedPercent: gardenCoverage.blockedCells / gardenCoverage.totalCells * 100,
  moved, agents: ids.length, worstBuildingPenetration: worstPenetration }, null, 2));
assert(moved >= oxen * .7, `only ${moved} units changed position`);
assert(worstPenetration < .25, `units entered a building by ${worstPenetration}`);
