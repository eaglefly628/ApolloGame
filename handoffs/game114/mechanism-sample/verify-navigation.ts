import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { Engine } from '@zerocraft/engine/runtime/engine.js';
import type { Transform, CrowdAvoidance, Shape, Velocity, Line3D } from '@zerocraft/engine/engine/protocol/components.js';
import { sampleBlueprint, oxTemplateIds } from './scene';
import navigation from './navigation.json';

assert.equal(navigation.routes.length, 16);
assert.equal(navigation.routes.filter(route => route.group === 'upper').length, 5);
assert.equal(navigation.routes.filter(route => route.group === 'lower').length, 5);
assert.equal(navigation.routes.filter(route => route.group === 'left').length, 3);
assert.equal(navigation.routes.filter(route => route.group === 'right').length, 3);
for (const route of navigation.routes) {
  if (route.group === 'upper' || route.group === 'lower') {
    assert(route.waypoints.every(([x]) => x === route.spawn[0]), 'vertical routes must stay on their authored lane');
  } else {
    assert(route.waypoints.every(([,y]) => y === route.spawn[1]), 'horizontal routes must stay on their authored lane');
  }
}
for (const [a, b, axis] of [['upper', 'lower', 0], ['left', 'right', 1]] as const) {
  const lanes = (group: string) => navigation.routes.filter(route => route.group === group).map(route => route.spawn[axis]).sort((x, y) => x - y);
  assert.deepEqual(lanes(a), lanes(b), `${a}/${b} should have opposing lanes`);
}

const engine = new Engine();
engine.load(sampleBlueprint);
const world = engine.world;
const ids = world.query('CrowdAvoidance').map(([id]) => id);
assert.equal(ids.length, 17, 'sixteen moving oxen and one cart');
const cart = ids.find(id => world.getComponent<CrowdAvoidance>(id,'CrowdAvoidance')!.radius > 2)!;
const oxIds = ids.filter(id => id !== cart);
assert(cart && oxIds.length === 16);
const origins = new Map(ids.map(id => [id, { ...world.getComponent<Transform>(id, 'Transform')! }]));
const upper = oxTemplateIds.upper;
const lower = oxTemplateIds.lower;
const left = oxTemplateIds.left;
const right = oxTemplateIds.right;
assert.equal(upper.length, 5);
assert.equal(lower.length, 5);
assert.equal(left.length, 3);
assert.equal(right.length, 3);
const frontUpper = upper.reduce((best,id)=>origins.get(id)!.y < origins.get(best)!.y ? id : best);
const frontLower = lower.reduce((best,id)=>origins.get(id)!.y > origins.get(best)!.y ? id : best);
const axisOf = (id:string, t:Transform) => upper.includes(id)||lower.includes(id) ? t.y : t.x;
const lateralOf = (id:string, t:Transform) => upper.includes(id)||lower.includes(id)
  ? Math.abs(t.x-origins.get(id)!.x) : Math.abs(t.y-origins.get(id)!.y);
const states = new Map(ids.map(id => [id, { travel: 0, middleCrossings: 0, lastAxis: axisOf(id,origins.get(id)!),
  longestIdleRun: 0, idleRun: 0, maxLateral: 0, squeezeTicks: 0, repathTicks: 0,
  lastVx: undefined as number|undefined, lastVy: undefined as number|undefined, maxVelocityDelta: 0, maxHeadingJump: 0 }]));
const previousOrder = new Map<string, number>();
let verticalExchanges = 0, horizontalExchanges = 0, minPairGap = Infinity, minCartOxGap = Infinity;
let frontDeflectionGap = -Infinity, frontDeflectionTick = -1;
let zeroSolutions = 0, zeroRecovered = 0, maxTickMs = 0, maxObservedSpeed = 0;
let maxConcurrentRepath = 0;
let maxRegularRepathPerField = 0;
const tickTimes: number[] = [];
for (let tick = 0; tick < 1200; tick++) {
  const start = performance.now();
  world.tick();
  const elapsed = performance.now() - start;
  if (tick > 0) maxTickMs = Math.max(maxTickMs, elapsed);
  if (tick >= 30) tickTimes.push(elapsed);
  const positions = new Map(ids.map(id => [id, world.getComponent<Transform>(id, 'Transform')!]));
  for (const id of ids) {
    const t = positions.get(id)!;
    const v = world.getComponent<Velocity>(id, 'Velocity')!;
    const cfg = world.getComponent<CrowdAvoidance>(id, 'CrowdAvoidance')!;
    const radius = world.getComponent<Shape>(id, 'Shape')!.radius!;
    const state = states.get(id)!;
    const speed = Math.hypot(v.vx, v.vy);
    assert([t.x,t.y,v.vx,v.vy].every(Number.isFinite), `nonfinite ${id}`);
    maxObservedSpeed = Math.max(maxObservedSpeed, speed);
    state.travel += speed;
    if (state.lastVx !== undefined && state.lastVy !== undefined) {
      state.maxVelocityDelta = Math.max(state.maxVelocityDelta,Math.hypot(v.vx-state.lastVx,v.vy-state.lastVy));
      const priorSpeed = Math.hypot(state.lastVx,state.lastVy);
      if (speed > .01 && priorSpeed > .01) {
        const angle = Math.acos(Math.max(-1,Math.min(1,(v.vx*state.lastVx+v.vy*state.lastVy)/(speed*priorSpeed))));
        state.maxHeadingJump = Math.max(state.maxHeadingJump,angle);
      }
    }
    state.lastVx=v.vx;state.lastVy=v.vy;
    state.maxLateral = Math.max(state.maxLateral, lateralOf(id,t));
    const axis = axisOf(id,t);
    if (state.lastAxis * axis < 0) state.middleCrossings++;
    state.lastAxis = axis;
    if (speed < .007) state.idleRun++;
    else state.idleRun = 0;
    state.longestIdleRun = Math.max(state.longestIdleRun, state.idleRun);
    if (radius < cfg.radius - 1e-9) state.squeezeTicks++;
    if (cfg.repathPath) state.repathTicks++;
    const prefix = cfg.debugVectorPrefix!;
    const desired = world.getComponent<Line3D>(`${prefix}:desired`, 'Line3D');
    const raw = world.getComponent<Line3D>(`${prefix}:raw`, 'Line3D');
    const actual = world.getComponent<Line3D>(`${prefix}:actual`, 'Line3D');
    assert(desired && raw && actual, `missing vectors for ${id}`);
    if (desired.points.length && !raw.points.length) {
      zeroSolutions++;
      if (actual.points.length) zeroRecovered++;
    }
  }
  maxConcurrentRepath = Math.max(maxConcurrentRepath,
    oxIds.filter(id => !!world.getComponent<CrowdAvoidance>(id, 'CrowdAvoidance')!.repathPath).length);
  const regularByField = new Map<string, number>();
  for (const id of oxIds) {
    const cfg = world.getComponent<CrowdAvoidance>(id, 'CrowdAvoidance')!;
    if (!cfg.repathPath || (cfg.stuckTicks ?? 0) >= Math.max(12, Math.floor((cfg.yieldAfterTicks ?? 60) / 2))) continue;
    const field = cfg.flowGuide?.fieldId ?? '';
    regularByField.set(field, (regularByField.get(field) ?? 0) + 1);
  }
  maxRegularRepathPerField = Math.max(maxRegularRepathPerField, ...regularByField.values());
  if (frontDeflectionTick < 0 && [frontUpper,frontLower].some(id => {
    const cfg = world.getComponent<CrowdAvoidance>(id,'CrowdAvoidance')!;
    const actual = world.getComponent<Line3D>(`${cfg.debugVectorPrefix}:actual`,'Line3D')!;
    return actual.points.length > 1 && Math.abs(actual.points[1][0]-actual.points[0][0]) > .002*(cfg.debugVectorScale ?? 50);
  })) {
    frontDeflectionTick = tick;
    const a = positions.get(frontUpper)!, b = positions.get(frontLower)!;
    frontDeflectionGap = Math.hypot(a.x-b.x,a.y-b.y)
      - world.getComponent<Shape>(frontUpper,'Shape')!.radius!
      - world.getComponent<Shape>(frontLower,'Shape')!.radius!;
  }
  for (let i = 0; i < ids.length; i++) for (let j = i+1; j < ids.length; j++) {
    const a = ids[i], b = ids[j], pa = positions.get(a)!, pb = positions.get(b)!;
    const gap = Math.hypot(pa.x-pb.x, pa.y-pb.y) - world.getComponent<Shape>(a,'Shape')!.radius! - world.getComponent<Shape>(b,'Shape')!.radius!;
    minPairGap = Math.min(minPairGap, gap);
    if (a===cart || b===cart) minCartOxGap = Math.min(minCartOxGap,gap);
  }
  for (const a of upper) for (const b of lower) {
    const key = `${a}/${b}`, sign = Math.sign(positions.get(a)!.y - positions.get(b)!.y);
    const before = previousOrder.get(key);
    if (before !== undefined && sign !== 0 && before !== 0 && sign !== before) verticalExchanges++;
    previousOrder.set(key, sign);
  }
  for (const a of left) for (const b of right) {
    const key = `${a}/${b}`, sign = Math.sign(positions.get(a)!.x - positions.get(b)!.x);
    const before = previousOrder.get(key);
    if (before !== undefined && sign !== 0 && before !== 0 && sign !== before) horizontalExchanges++;
    previousOrder.set(key, sign);
  }
}
tickTimes.sort((a,b)=>a-b);
const result = { ticks:1200, groups:{upper:upper.length,lower:lower.length,left:left.length,right:right.length,cart:1}, frontDeflectionTick,
  frontDeflectionGap, verticalExchanges, horizontalExchanges, minPairGap, minCartOxGap, zeroSolutions, zeroRecovered,
  maxConcurrentRepath, maxRegularRepathPerField,
  maxTickMs, maxObservedSpeed, steadyMeanTickMs:tickTimes.reduce((sum,x)=>sum+x,0)/tickTimes.length,
  steadyP95TickMs:tickTimes[Math.floor(tickTimes.length*.95)],
  actors:ids.map(id=>{const {lastVx,lastVy,...state}=states.get(id)!;return {id,...state};}) };
console.log(JSON.stringify(result,null,2));
assert(frontDeflectionTick >= 0 && frontDeflectionGap > 2, 'front oxen should anticipate before contact');
assert(verticalExchanges > 0 && horizontalExchanges > 0, 'both opposing routes should interleave');
assert(minPairGap > -.1 && minCartOxGap > -.1, 'hard circles should not deeply interpenetrate');
assert(states.get(cart)!.maxHeadingJump < .2, 'cart should not snap-turn');
assert(states.get(cart)!.travel > 30, 'cart should continue through the crossing');
assert(oxIds.some(id => states.get(id)!.repathTicks > 0), 'off-route ox should enter A* rejoin mode');
assert(maxRegularRepathPerField <= 2, 'edge-first mode should keep only two regular replans per flow field');
writeFileSync(new URL('./navigation-verification.json', import.meta.url), `${JSON.stringify(result, null, 2)}\n`);
