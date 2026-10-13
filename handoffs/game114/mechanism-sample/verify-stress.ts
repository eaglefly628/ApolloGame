import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { Engine } from '@zerocraft/engine/runtime/engine.js';
import type { Transform, Velocity, Shape } from '@zerocraft/engine/engine/protocol/components.js';
import { sampleBlueprint } from './scene';
import { ScenarioControls } from './scenario-controls';

const engine = new Engine();
engine.load(sampleBlueprint);
const controls = new ScenarioControls(engine.world);
controls.dispatch('scenario.double');
assert.equal(controls.state.oxen, 32);
const world = engine.world;
const ids = world.query('CrowdAvoidance').map(([id]) => id);
assert.equal(ids.length, 33);
const travel = new Map(ids.map(id => [id, 0]));
let minCircleGap = Infinity;
let worstPair: {tick:number; a:string; b:string; ax:number; ay:number; bx:number; by:number}|undefined;
const tickTimes: number[] = [];
for (let tick = 0; tick < 1200; tick++) {
  const start = performance.now();
  world.tick();
  if (tick > 30) tickTimes.push(performance.now() - start);
  const positions = ids.map(id => world.getComponent<Transform>(id, 'Transform')!);
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]!;
    const t = positions[i]!;
    const v = world.getComponent<Velocity>(id, 'Velocity')!;
    assert([t.x, t.y, v.vx, v.vy].every(Number.isFinite), `nonfinite ${id} at tick ${tick}`);
    travel.set(id, travel.get(id)! + Math.hypot(v.vx, v.vy));
    for (let j = i + 1; j < ids.length; j++) {
      const otherId = ids[j]!;
      const other = positions[j]!;
      const gap = Math.hypot(t.x - other.x, t.y - other.y)
        - world.getComponent<Shape>(id, 'Shape')!.radius!
        - world.getComponent<Shape>(otherId, 'Shape')!.radius!;
      if (gap < minCircleGap) { minCircleGap = gap; worstPair = {tick,a:id,b:otherId,ax:t.x,ay:t.y,bx:other.x,by:other.y}; }
    }
  }
}
tickTimes.sort((a, b) => a - b);
const oxTravel = ids.filter(id => !id.includes('turtle')).map(id => travel.get(id)!);
const result = {
  ticks: 1200, oxen: controls.state.oxen, cart: 1, minCircleGap, worstPair,
  movingOxen: oxTravel.filter(value => value > 5).length,
  minOxTravel: Math.min(...oxTravel), medianOxTravel: oxTravel.sort((a, b) => a - b)[16],
  cartTravel: travel.get(ids.find(id => id.includes('turtle'))!)!,
  meanTickMs: tickTimes.reduce((sum, value) => sum + value, 0) / tickTimes.length,
  p95TickMs: tickTimes[Math.floor(tickTimes.length * .95)],
};
assert(minCircleGap > -.1, `dense crowd penetrated circles by ${-minCircleGap}`);
assert(result.movingOxen >= 30, `only ${result.movingOxen} oxen made progress`);
assert(result.cartTravel > 15, `cart traveled only ${result.cartTravel}`);
console.log(JSON.stringify(result, null, 2));
writeFileSync(new URL('./stress-verification.json', import.meta.url), `${JSON.stringify(result, null, 2)}\n`);
