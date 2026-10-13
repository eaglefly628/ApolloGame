import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { Engine } from '@zerocraft/engine/runtime/engine.js';
import type { Transform, Velocity, Shape } from '@zerocraft/engine/engine/protocol/components.js';
import { sampleBlueprint } from './scene';
import { ScenarioControls, MAX_OXEN } from './scenario-controls';

const oxen = Number(process.argv[2] ?? 64);
const ticks = Number(process.argv[3] ?? 600);
assert(Number.isInteger(oxen) && oxen >= 16 && oxen <= MAX_OXEN);
assert(Number.isInteger(ticks) && ticks > 0);

const engine = new Engine();
engine.load(sampleBlueprint);
const controls = new ScenarioControls(engine.world, oxen, false);
assert.equal(controls.state.oxen, oxen, 'the requested formation must actually spawn');
const world = engine.world;
const ids = world.query('CrowdAvoidance').map(([id]) => id);
assert.equal(ids.length, oxen + 1);
const cartId = ids.find(id => id.startsWith('turtle-'))!;
const travel = new Map(ids.map(id => [id, 0]));
const tickTimes: number[] = [];
let minCircleGap = Infinity;
let worstPair: { tick: number; a: string; b: string; ax: number; ay: number; bx: number; by: number } | undefined;
let movingAtEnd = 0;

for (let tick = 0; tick < ticks; tick++) {
  const start = performance.now();
  world.tick();
  if (tick >= 30) tickTimes.push(performance.now() - start);
  const positions = ids.map(id => world.getComponent<Transform>(id, 'Transform')!);
  movingAtEnd = 0;
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]!;
    const t = positions[i]!;
    const velocity = world.getComponent<Velocity>(id, 'Velocity')!;
    assert([t.x, t.y, velocity.vx, velocity.vy].every(Number.isFinite), `${id} produced a non-finite state at tick ${tick}`);
    const speed = Math.hypot(velocity.vx, velocity.vy);
    if (id !== cartId && speed > .007) movingAtEnd++;
    travel.set(id, travel.get(id)! + speed);
    const radius = world.getComponent<Shape>(id, 'Shape')!.radius!;
    for (let j = i + 1; j < ids.length; j++) {
      const otherId = ids[j]!;
      const other = positions[j]!;
      const otherRadius = world.getComponent<Shape>(otherId, 'Shape')!.radius!;
      const gap = Math.hypot(t.x - other.x, t.y - other.y) - radius - otherRadius;
      if (gap < minCircleGap) { minCircleGap = gap; worstPair = { tick, a: id, b: otherId,
        ax: t.x, ay: t.y, bx: other.x, by: other.y }; }
    }
  }
}

tickTimes.sort((a, b) => a - b);
const oxTravel = ids.filter(id => id !== cartId).map(id => travel.get(id)!).sort((a, b) => a - b);
const result = { oxen, ticks, minCircleGap, worstPair, movingAtEnd,
  movingOxen: oxTravel.filter(value => value > Math.min(5, ticks * .01)).length,
  minOxTravel: oxTravel[0], medianOxTravel: oxTravel[Math.floor(oxTravel.length / 2)],
  cartTravel: travel.get(cartId), meanTickMs: tickTimes.reduce((sum, value) => sum + value, 0) / tickTimes.length,
  p95TickMs: tickTimes[Math.floor(tickTimes.length * .95)] };
console.log(JSON.stringify(result, null, 2));
assert(minCircleGap > -.1, `circles penetrated by ${-minCircleGap}`);
assert(result.movingOxen >= oxen * .9, `only ${result.movingOxen}/${oxen} oxen made progress`);
assert(result.cartTravel! > 10, `cart traveled only ${result.cartTravel}`);
writeFileSync(new URL(`./battle-density-${oxen}.json`, import.meta.url), `${JSON.stringify(result, null, 2)}\n`);
