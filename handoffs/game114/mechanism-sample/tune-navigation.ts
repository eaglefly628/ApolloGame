// Reproducible parameter sweep for the existing game114 crossing; no game logic is changed here.
import { readFileSync } from 'node:fs';
import { Engine } from '@zerocraft/engine/runtime/engine.js';
import type { CrowdAvoidance, PathFollow, Shape, Transform, Velocity } from '@zerocraft/engine/engine/protocol/components.js';
import { oxTemplateIds, sampleBlueprint } from './scene';
import { ScenarioControls } from './scenario-controls';

type Candidate = { name: string; oxHorizon?: number; cartHorizon?: number; cartInertia?: number; neighborDistance?: number;
  pathfindDistance?: number; releaseDistance?: number; repathDistance?: number; occupancyPenalty?: number;
  edgeRepathSlots?: number; flowWeight?: number; lookAhead?: number; fieldCost?: number };

function evaluate(candidate: Candidate, ticks: number, oxCount: number) {
  const blueprint = { ...sampleBlueprint, entities: structuredClone(sampleBlueprint.entities) };
  const grid = blueprint.entities['navigation-map']!.NavigationGrid as { cost: number[] };
  if (candidate.fieldCost !== undefined) {
    grid.cost = grid.cost.map(value => value === 1 ? 1 : candidate.fieldCost!);
  }
  for (const ids of Object.values(oxTemplateIds)) for (const id of ids) {
    const entity = blueprint.entities[id]!;
    const cfg = entity.CrowdAvoidance as unknown as CrowdAvoidance;
    const path = entity.PathFollow as unknown as PathFollow;
    if (candidate.oxHorizon !== undefined) cfg.timeHorizon = candidate.oxHorizon;
    if (candidate.neighborDistance !== undefined) cfg.neighborDistance = candidate.neighborDistance;
    if (candidate.lookAhead !== undefined) path.lookAhead = candidate.lookAhead;
    const guide = cfg.flowGuide!;
    if (candidate.pathfindDistance !== undefined) guide.pathfindDistance = candidate.pathfindDistance;
    if (candidate.releaseDistance !== undefined) guide.releaseDistance = candidate.releaseDistance;
    if (candidate.repathDistance !== undefined) guide.repathDistance = candidate.repathDistance;
    if (candidate.occupancyPenalty !== undefined) guide.occupancyPenalty = candidate.occupancyPenalty;
    if (candidate.edgeRepathSlots !== undefined) guide.edgeRepathSlots = candidate.edgeRepathSlots;
    if (candidate.flowWeight !== undefined) guide.weight = candidate.flowWeight;
  }
  const cart = Object.entries(blueprint.entities).find(([, entity]) =>
    (entity.CrowdAvoidance as unknown as CrowdAvoidance | undefined)?.radius === 2.5)![1];
  if (candidate.cartHorizon !== undefined) (cart.CrowdAvoidance as unknown as CrowdAvoidance).timeHorizon = candidate.cartHorizon;
  if (candidate.cartInertia !== undefined) (cart.CrowdAvoidance as unknown as CrowdAvoidance).desiredInertia = candidate.cartInertia;
  const engine = new Engine();
  engine.load(blueprint);
  if (oxCount === 32) new ScenarioControls(engine.world).dispatch('scenario.double');
  const world = engine.world;
  const ids = world.query('CrowdAvoidance').map(([id]) => id);
  const cartId = ids.find(id => world.getComponent<CrowdAvoidance>(id, 'CrowdAvoidance')!.radius > 2)!;
  const oxIds = ids.filter(id => id !== cartId);
  // The stress control clones its templates from the imported scene, so carry
  // candidate settings onto the extra agents as well.
  if (oxCount === 32) for (const id of oxIds.filter(id => id.startsWith('stress-ox-'))) {
    const cfg = world.getComponent<CrowdAvoidance>(id, 'CrowdAvoidance')!;
    const path = world.getComponent<PathFollow>(id, 'PathFollow')!;
    if (candidate.oxHorizon !== undefined) cfg.timeHorizon = candidate.oxHorizon;
    if (candidate.neighborDistance !== undefined) cfg.neighborDistance = candidate.neighborDistance;
    if (candidate.lookAhead !== undefined) path.lookAhead = candidate.lookAhead;
    const guide = cfg.flowGuide!;
    if (candidate.pathfindDistance !== undefined) guide.pathfindDistance = candidate.pathfindDistance;
    if (candidate.releaseDistance !== undefined) guide.releaseDistance = candidate.releaseDistance;
    if (candidate.repathDistance !== undefined) guide.repathDistance = candidate.repathDistance;
    if (candidate.occupancyPenalty !== undefined) guide.occupancyPenalty = candidate.occupancyPenalty;
    if (candidate.edgeRepathSlots !== undefined) guide.edgeRepathSlots = candidate.edgeRepathSlots;
    if (candidate.flowWeight !== undefined) guide.weight = candidate.flowWeight;
  }
  const state = new Map(ids.map(id => {
    const t = world.getComponent<Transform>(id, 'Transform')!;
    const horizontal = id === cartId || Math.abs(t.x) > Math.abs(t.y);
    const axis = horizontal ? t.x : t.y;
    const initial = { horizontal, originSide: Math.sign(axis), nextSide: -Math.sign(axis),
      crossings: [] as number[], travel: 0, idle: 0, maxIdle: 0, maxLateral: 0,
      lastVx: 0, lastVy: 0, maxHeadingJump: 0 };
    return [id, initial] as const;
  }));
  let minGap = Infinity;
  for (let tick = 1; tick <= ticks; tick++) {
    world.tick();
    const positions = ids.map(id => world.getComponent<Transform>(id, 'Transform')!);
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i]!;
      const t = positions[i]!;
      const v = world.getComponent<Velocity>(id, 'Velocity')!;
      const s = state.get(id)!;
      const axis = s.horizontal ? t.x : t.y;
      const lateral = s.horizontal ? Math.abs(t.y - (id === cartId ? 4 : 0)) : Math.abs(t.x);
      const speed = Math.sqrt(v.vx * v.vx + v.vy * v.vy);
      const lastSpeed = Math.sqrt(s.lastVx * s.lastVx + s.lastVy * s.lastVy);
      s.travel += speed;
      s.maxLateral = Math.max(s.maxLateral, lateral);
      s.idle = speed < .007 ? s.idle + 1 : 0;
      s.maxIdle = Math.max(s.maxIdle, s.idle);
      if (speed > .01 && lastSpeed > .01) {
        const dot = (v.vx * s.lastVx + v.vy * s.lastVy) / (speed * lastSpeed);
        s.maxHeadingJump = Math.max(s.maxHeadingJump, Math.acos(Math.max(-1, Math.min(1, dot))));
      }
      s.lastVx = v.vx; s.lastVy = v.vy;
      if (axis * s.nextSide >= 4) {
        s.crossings.push(tick);
        s.nextSide *= -1;
      }
      for (let j = i + 1; j < ids.length; j++) {
        const other = positions[j]!;
        const r1 = world.getComponent<Shape>(id, 'Shape')!.radius!;
        const r2 = world.getComponent<Shape>(ids[j]!, 'Shape')!.radius!;
        const dx = t.x - other.x, dy = t.y - other.y;
        minGap = Math.min(minGap, Math.sqrt(dx * dx + dy * dy) - r1 - r2);
      }
    }
  }
  const ox = oxIds.map(id => state.get(id)!);
  const first = ox.map(s => s.crossings[0] ?? ticks + 1).sort((a, b) => a - b);
  const second = ox.map(s => s.crossings[1] ?? ticks + 1).sort((a, b) => a - b);
  const cartState = state.get(cartId)!;
  const completedFirst = first.filter(tick => tick <= ticks).length;
  const completedSecond = second.filter(tick => tick <= ticks).length;
  const crossingTime = first.reduce((sum, tick) => sum + tick, 0)
    + second.reduce((sum, tick) => sum + tick, 0);
  const cartCrossingTime = (cartState.crossings[0] ?? ticks + 1)
    + (cartState.crossings[1] ?? ticks + 1);
  const valid = minGap > -.1 && cartState.maxHeadingJump < .2
    && ox.every(s => s.travel > (oxCount === 32 ? 5 : 10));
  return { name: candidate.name, params: candidate, ticks, oxCount, valid, completedFirst, completedSecond,
    crossingTime, cartCrossingTime, allCrossingTime: crossingTime + cartCrossingTime,
    medianFirst: first[Math.floor(first.length / 2)],
    p90First: first[Math.floor(first.length * .9)],
    medianSecond: second[Math.floor(second.length / 2)],
    p90Second: second[Math.floor(second.length * .9)],
    maxIdle: Math.max(...ox.map(s => s.maxIdle)), maxLateral: Math.max(...ox.map(s => s.maxLateral)),
    minOxTravel: Math.min(...ox.map(s => s.travel)), minGap,
    cartCrossings: cartState.crossings, cartHeadingJump: cartState.maxHeadingJump,
    cartTravel: cartState.travel };
}

const file = process.argv[2];
if (!file) throw new Error('Usage: vite-node tune-navigation.ts <candidates.json> [ticks] [oxCount]');
const candidates = JSON.parse(readFileSync(file, 'utf8')) as Candidate[];
const ticks = Number(process.argv[3] ?? 1200), oxCount = Number(process.argv[4] ?? 16);
for (const candidate of candidates) console.log(JSON.stringify(evaluate(candidate, ticks, oxCount)));
