import { afterEach, describe, expect, it, vi } from 'vitest';
import { World } from '@engine/core/world.js';
import { topologicalSort } from '@engine/core/topological-sort.js';
import type { SystemDeclaration } from '@engine/core/types.js';
import type { Collider3D, DebugTrace, GroundContact3D, GroundSurface3D, GroundTeleport3D, GroundWalker3D, Transform, Velocity } from '@engine/protocol/components.js';
import { bakeGroundSurface, type GroundPointQ, type GroundTriangleInput } from '@engine/spatial/ground-surface.js';
import { hashSnapshot, hashWithOrder } from '../../net/determinism.js';
import { groundWalk3dCapability as ground } from './ground-walk-3d.js';
import { motionApplyCapability as motion } from '../tier1/motion-apply.js';
import { accelApplyCapability as accel } from '../tier1/accel-apply.js';
import { overlapDetect3dCapability as overlap } from '../atoms/overlap-detect-3d/index.js';
import { collisionResolve3dCapability as collision } from '../atoms/collision-resolve-3d/index.js';
import { navigationGridCapability as grid } from './navigation-grid.js';
import { pathfindCapability as nav } from './pathfind.js';
import { crowdAvoidanceCapability as crowd } from './crowd-avoidance.js';
import { flowFieldCapability as flow } from './flow-field.js';
import { prefabCapability as prefab } from '../tier3/prefab.js';

afterEach(() => vi.restoreAllMocks());
function patch(x0: number, x1: number, z0 = 0, z1 = 10000, y0 = 0, y1 = y0): GroundTriangleInput[] {
  const a: GroundPointQ = [x0, y0, z0], b: GroundPointQ = [x1, y1, z0];
  const c: GroundPointQ = [x1, y1, z1], d: GroundPointQ = [x0, y0, z1];
  return [{ points: [a, b, c] }, { points: [a, c, d] }];
}
const xf = (x: number, y = .5): Transform => ({ type: 'Transform', x, y, rotation: 0, scaleX: 1, scaleY: 1 });
const baseSystems = [...ground.systems, ...motion.systems];
function setup(surface = bakeGroundSurface(patch(0, 40000, 0, 10000, 0, 20000)), systems = baseSystems): World {
  const w = new World({ strict: true });
  for (const system of systems) w.addSystem(system);
  w.createEntity('surface'); w.addComponent('surface', surface);
  return w;
}
function actor(w: World, x = 1, vx = .1, id = 'actor', body: Partial<Collider3D> = {}): void {
  w.createEntity(id); w.addComponent(id, xf(x));
  w.addComponent(id, { type: 'Velocity', vx, vy: 0 } as Velocity);
  w.addComponent(id, { type: 'Collider3D', kind: 'sphere', radius: .1, baseY: 0, ...body } as Collider3D);
  w.addComponent(id, { type: 'GroundWalker3D', surfaceId: 'surface' });
}
const position = (w: World, id = 'actor') => w.getComponent<Transform>(id, 'Transform')!;
const body = (w: World, id = 'actor') => w.getComponent<Collider3D>(id, 'Collider3D')!;
const velocity = (w: World, id = 'actor') => w.getComponent<Velocity>(id, 'Velocity')!;
const contact = (w: World, id = 'actor') => w.getComponent<GroundContact3D>(id, 'GroundContact3D')!;
function trace(w: World): DebugTrace {
  w.createEntity('trace'); w.addComponent('trace', { type: 'DebugTrace', events: [], max: 10000 } as DebugTrace);
  return w.getComponent<DebugTrace>('trace', 'DebugTrace')!;
}

describe('ground walking in a strict real World', () => {
  it('acquires the initial support before motion and cannot jump a first-tick hole', () => {
    const s = bakeGroundSurface([...patch(0, 10000), ...patch(11000, 30000)]);
    const w = setup(s); actor(w, .5, 2);
    const events = trace(w).events;
    const seen: string[] = []; w.setObserver({ onSystemStart: system => seen.push(system.id) });
    w.tick();
    expect(seen.indexOf('ground-init-3d')).toBeLessThan(seen.indexOf('motion-apply'));
    expect(position(w).x).toBe(.5);
    expect(velocity(w)).toMatchObject({ vx: 0, vy: 0 });
    expect(contact(w)).toMatchObject({ acceptedXQ: 5000, heightQ: 0, supported: true, rejected: false });
    expect(events.some(event => event.system === 'ground-pre-3d' && event.kind === 'reject' && event.why?.includes('hole'))).toBe(true);
  });
  it('walks up and down a ramp with zero step allowance and exact Q foot heights', () => {
    const w = setup(); actor(w, .5, .1);
    Object.assign(w.getComponent('actor', 'GroundWalker3D')!, { maxStepUpQ: 0, maxStepDownQ: 0 });
    for (let i = 0; i < 20; i++) { w.tick(); expect(body(w).baseY).toBe(Math.round(position(w).x * 10000) / 20000); }
    velocity(w).vx = -.1;
    for (let i = 0; i < 20; i++) { w.tick(); expect(body(w).baseY).toBe(Math.round(position(w).x * 10000) / 20000); }
    expect(position(w).x).toBeCloseTo(.5, 12);
    expect(contact(w).acceptedHeightQ).toBe(2500);
  });
  it('accepts a legal upward/downward step and rolls back excessive steps', () => {
    for (const [height, accepted] of [[2500, true], [2501, false]] as const) {
      const w = setup(bakeGroundSurface([...patch(0, 10000), ...patch(10000, 30000, 0, 10000, height)]));
      actor(w, .9, .2); w.tick();
      expect(position(w).x).toBeCloseTo(accepted ? 1.1 : .9, 12);
      expect(body(w).baseY).toBe(accepted ? height / 10000 : 0);
      if (accepted) { velocity(w).vx = -.2; w.tick(); expect(position(w).x).toBeCloseTo(.9, 12); expect(body(w).baseY).toBe(0); }
      else expect(velocity(w).vx).toBe(0);
    }
  });
  it('samples at the actual collider offset and restores the corresponding Transform on rejection', () => {
    const w = setup(); actor(w, .25, .1, 'actor', { offsetX: .75, offsetZ: -.25 });
    w.tick();
    expect(contact(w)).toMatchObject({ acceptedXQ: 11000, acceptedZQ: 2500, heightQ: 5500 });
    expect(body(w).baseY).toBe(.55);
    velocity(w).vx = 4; w.tick();
    expect(position(w).x).toBeCloseTo(.35, 12);
    expect(body(w).baseY).toBe(.55);
    expect(velocity(w).vx).toBe(0);
  });
  it('keeps an unsupported spawn where authored even if motion could land on valid ground', () => {
    const w = setup(bakeGroundSurface(patch(0, 10000))); actor(w, 1.5, -.75);
    const events = trace(w).events; w.tick();
    expect(position(w).x).toBe(1.5);
    expect(velocity(w)).toMatchObject({ vx: 0, vy: 0 });
    expect(contact(w)).toMatchObject({ supported: false, acceptedXQ: 15000, triangleId: -1 });
    expect(events.some(event => event.kind === 'reject' && event.why?.includes('initial position has no walkable support'))).toBe(true);
  });
  it('initializes real prefab newborns at their spawn point and rejects unsupported newborn motion', () => {
    const w = setup(bakeGroundSurface(patch(0, 10000)), [...baseSystems, ...prefab.systems]);
    w.createEntity('library'); w.addComponent('library', { type: 'PrefabLibrary', seq: 0, templates: {
      walker: { entities: { body: {
        Transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        Collider3D: { kind: 'sphere', radius: .1, baseY: 0 }, Velocity: { vx: -.75, vy: 0 },
        GroundWalker3D: { surfaceId: 'surface' },
      } } },
    } });
    w.createEntity('request'); w.addComponent('request', { type: 'SpawnRequest', templateId: 'walker', x: 1.5, y: .5 });
    w.tick();
    expect(position(w, 'walker#0:body').x).toBe(1.5);
    expect(contact(w, 'walker#0:body').supported).toBe(false);
    expect(velocity(w, 'walker#0:body').vx).toBe(0);
    w.tick(); expect(position(w, 'walker#0:body').x).toBe(1.5);
  });
  it('stops velocity after a pre rejection even if a later system writes new velocity', () => {
    const lateVelocity: SystemDeclaration = {
      id: 'test-late-velocity', phase: 20, reads: [], writes: ['Velocity'], consumes: [],
      execute: world => { const v = world.getComponent<Velocity>('actor', 'Velocity')!; v.vx = .75; },
    };
    const w = setup(bakeGroundSurface([...patch(0, 10000), ...patch(11000, 30000)]), [...baseSystems, lateVelocity]);
    actor(w, .5, 2); w.tick();
    expect(position(w).x).toBe(.5);
    expect(velocity(w).vx).toBe(0);
    expect(contact(w).rejected).toBe(false);
  });
  it('rejects missing sources, invalid bodies and bad live buckets without moving or hanging', () => {
    for (const kind of ['missing', 'trigger', 'bad-bucket'] as const) {
      const w = setup(); actor(w, .5, .2); trace(w);
      if (kind === 'missing') w.removeComponent('surface', 'GroundSurface3D');
      if (kind === 'trigger') body(w).trigger = true;
      if (kind === 'bad-bucket') (w.getComponent<GroundSurface3D>('surface', 'GroundSurface3D')!.offsets as number[])[10] = -Infinity;
      expect(() => w.tick()).not.toThrow();
      expect(position(w).x).toBe(.5);
      expect(velocity(w).vx).toBe(0);
      expect(contact(w).supported).toBe(false);
    }
  });
  it('rejects a table corrupted after initial acquisition and restores its serialized accepted position', () => {
    const w = setup(); actor(w, .5, 0); const log = trace(w); w.tick();
    (w.getComponent<GroundSurface3D>('surface', 'GroundSurface3D')!.offsets as number[])[10] = -Infinity;
    velocity(w).vx = .2;
    expect(() => w.tick()).not.toThrow();
    expect(position(w).x).toBe(.5);
    expect(body(w).baseY).toBe(.25);
    expect(velocity(w).vx).toBe(0);
    expect(contact(w)).toMatchObject({ acceptedXQ: 5000, acceptedHeightQ: 2500, supported: true });
    expect(log.events.some(event => event.kind === 'reject' && event.why?.includes('invalid live bucket offsets'))).toBe(true);
  });
});

describe('ground final pass after actual 3D collision response', () => {
  const systems = [...baseSystems, ...overlap.systems, ...collision.systems];
  function wall(w: World, x: number): void {
    w.createEntity('wall'); w.addComponent('wall', xf(x));
    const verts: number[] = [];
    for (const dx of [-.2, .2]) for (const y of [0, 2]) for (const z of [-.3, .3]) verts.push(dx, y, z);
    w.addComponent('wall', { type: 'Collider3D', kind: 'hull', verts, axes: [1, 0, 0, 0, 1, 0, 0, 0, 1], baseY: 0 } as Collider3D);
  }
  it('updates the foot height at the resolved XZ in the same tick', () => {
    const w = setup(undefined, systems); actor(w, .9, .1, 'actor', { radius: .2 }); wall(w, 1.1);
    const observed: number[] = [];
    w.setObserver({ onSystemStart: system => { if (system.id === 'overlap-detect-3d') observed.push(body(w).baseY!); } });
    w.tick();
    expect(observed).toEqual([.5]);
    expect(position(w).x).toBeCloseTo(.7, 8);
    expect(body(w).baseY).toBe(.35);
    expect(contact(w)).toMatchObject({ acceptedXQ: 7000, acceptedHeightQ: 3500, heightQ: 3500 });
  });
  it('rolls back a collision correction outside support to the last final accepted point', () => {
    const w = setup(bakeGroundSurface(patch(0, 10000, 0, 10000, 0, 5000)), systems);
    actor(w, .1, 0, 'actor', { radius: .2 }); wall(w, .25);
    const events = trace(w).events; w.tick();
    expect(position(w).x).toBe(.1);
    expect(body(w).baseY).toBe(.05);
    expect(contact(w)).toMatchObject({ acceptedXQ: 1000, acceptedHeightQ: 500, heightQ: 500 });
    expect(velocity(w)).toMatchObject({ vx: 0, vy: 0 });
    expect(events.some(event => event.system === 'ground-final-3d' && event.kind === 'reject')).toBe(true);
  });
});

describe('movement combinations and deterministic ground state', () => {
  const common = [...baseSystems, ...overlap.systems, ...collision.systems];
  const combinations = {
    nav: [...grid.systems, ...nav.systems],
    'nav plus crowd': [...grid.systems, ...nav.systems, ...crowd.systems],
    'input acceleration': [...accel.systems],
    flow: [...grid.systems, ...flow.systems],
  };
  for (const [name, extra] of Object.entries(combinations)) it(`${name} has strict ordering and no new warning`, () => {
    const warn = vi.spyOn(console, 'warn');
    const systems = [...common, ...extra];
    const ids = topologicalSort(systems, { softCycle: 'throw' }).map(system => system.id);
    expect(ids.indexOf('ground-teleport-3d')).toBeLessThan(ids.indexOf('ground-init-3d'));
    expect(ids.indexOf('ground-init-3d')).toBeLessThan(ids.indexOf('motion-apply'));
    expect(ids.indexOf('motion-apply')).toBeLessThan(ids.indexOf('ground-pre-3d'));
    expect(ids.indexOf('ground-pre-3d')).toBeLessThan(ids.indexOf('overlap-detect-3d'));
    expect(ids.indexOf('collision-resolve-3d')).toBeLessThan(ids.indexOf('ground-final-3d'));
    const w = setup(undefined, systems); actor(w, .5, 0);
    if (name === 'input acceleration') w.addComponent('actor', { type: 'Acceleration', ax: .02, ay: 0 });
    else {
      w.createEntity('map'); w.addComponent('map', { type: 'NavigationGrid', originX: 0, originY: 0, cellSize: .5, cols: 8, rows: 2 });
      w.createEntity('profile'); w.addComponent('profile', { type: 'NavigationProfile', gridId: 'map', radius: 0, goals: [{ x: 3.5, y: .5 }] });
      if (name === 'flow') w.addComponent('actor', { type: 'FlowAgent', fieldId: 'profile', speed: .1 });
      else {
        w.createEntity('target'); w.addComponent('target', xf(3.5));
        w.addComponent('actor', { type: 'Relation', kind: 'target', targetId: 'target' });
        w.addComponent('actor', { type: 'NavAgent', graphId: 'profile', speed: .1, arriveRange: .05 });
        if (name.includes('crowd')) w.addComponent('actor', { type: 'CrowdAvoidance', radius: .1, maxSpeed: .1 });
      }
    }
    for (let tick = 0; tick < 5; tick++) w.tick();
    expect(position(w).x).toBeGreaterThan(.5);
    expect(body(w).baseY).toBe(Math.ceil(Math.round(position(w).x * 10000) / 2) / 10000);
    expect(warn.mock.calls).toEqual([]);
  });
  it('replays equal per-tick hashes and preserves future results through snapshot plus order restore', () => {
    const make = () => { const w = setup(); actor(w, .5, .05, '10'); actor(w, 1.5, -.025, '2'); return w; };
    const a = make(), b = make();
    for (let i = 0; i < 15; i++) { a.tick(); b.tick(); expect(hashWithOrder(a.snapshot(), a.snapshotOrder())).toBe(hashWithOrder(b.snapshot(), b.snapshotOrder())); }
    const saved = JSON.parse(JSON.stringify(a.snapshot())), order = [...a.snapshotOrder()];
    const restored = make(); restored.restore(saved, order);
    for (let i = 0; i < 20; i++) { a.tick(); restored.tick(); expect(hashWithOrder(a.snapshot(), a.snapshotOrder())).toBe(hashWithOrder(restored.snapshot(), restored.snapshotOrder())); }
    expect(restored.snapshotOrder()).toEqual(order);
    expect(restored.snapshot()).toEqual(a.snapshot());
  });
  it('trace on and off preserve hashes, log rejection reasons and stay within three events per system per tick', () => {
    const surface = bakeGroundSurface([...patch(0, 10000), ...patch(11000, 30000)]);
    const a = setup(surface), b = setup(JSON.parse(JSON.stringify(surface)));
    actor(a, .5, 2); actor(b, .5, 2); const log = trace(b);
    for (let tick = 0; tick < 3; tick++) {
      const before = log.events.length; a.tick(); b.tick();
      expect(hashSnapshot(a.snapshot())).toBe(hashSnapshot(b.snapshot()));
      const counts = new Map<string, number>();
      for (const event of log.events.slice(before)) counts.set(event.system, (counts.get(event.system) ?? 0) + 1);
      expect([...counts.values()].every(count => count <= 3)).toBe(true);
    }
    expect(log.events.some(event => event.kind === 'reject' && event.why?.includes('hole'))).toBe(true);
    const idle = setup(); const idleLog = trace(idle); idle.tick(); expect(idleLog.events).toEqual([]);
  });
});

describe('explicit GroundTeleport3D relocation', () => {
  // Two islands separated by a 1m hole; the far island is 3m higher than any legal step.
  const islands = () => bakeGroundSurface([...patch(0, 10000), ...patch(20000, 30000, 0, 10000, 30000)]);
  const teleport = (w: World, x: number, y = .5, id = 'actor'): void => w.addComponent(id, { type: 'GroundTeleport3D', x, y } as GroundTeleport3D);
  const actorState = (w: World, id = 'actor') => JSON.stringify(['Transform', 'Collider3D', 'Velocity', 'GroundContact3D'].map(type => w.getComponent(id, type)));
  // Same-tick ground-pre/final re-walk from whatever the teleport wrote, which can
  // mask a wrong write on continuous ground. Read the system's own output directly.
  const atTeleportEnd = (w: World, id = 'actor') => {
    const seen: { state?: string; baseY?: number; contact?: GroundContact3D } = {};
    w.setObserver({ onSystemEnd: system => {
      if (system.id !== 'ground-teleport-3d') return;
      seen.state = actorState(w, id); seen.baseY = w.getComponent<Collider3D>(id, 'Collider3D')?.baseY;
      seen.contact = structuredClone(w.getComponent<GroundContact3D>(id, 'GroundContact3D'));
    } });
    return seen;
  };

  it('relocates across a hole to a high island, consumes the intent and is not rolled back afterwards', () => {
    const w = setup(islands()); actor(w, .5, 0); const log = trace(w); w.tick();
    // A bare Transform write is still judged as a walk and rolled back.
    position(w).x = 2.5; w.tick();
    expect(position(w).x).toBe(.5);
    const seen = atTeleportEnd(w);
    teleport(w, 2.5); w.tick();
    expect(seen.baseY).toBe(3);
    expect(seen.contact).toMatchObject({ acceptedXQ: 25000, acceptedZQ: 5000, acceptedHeightQ: 30000, supported: true, rejected: false });
    expect(position(w)).toMatchObject({ x: 2.5, y: .5 });
    expect(body(w).baseY).toBe(3);
    expect(contact(w)).toMatchObject({ acceptedXQ: 25000, acceptedZQ: 5000, acceptedHeightQ: 30000, heightQ: 30000, supported: true, rejected: false });
    expect(w.hasComponent('actor', 'GroundTeleport3D')).toBe(false);
    expect(log.events.some(event => event.system === 'ground-teleport-3d' && event.kind === 'commit' && event.why?.includes('actor@25000,5000/30000'))).toBe(true);
    for (let i = 0; i < 3; i++) w.tick();
    expect(position(w).x).toBe(2.5);
    velocity(w).vx = .1; w.tick();
    expect(position(w).x).toBeCloseTo(2.6, 12);
    expect(body(w).baseY).toBe(3);
  });
  it('applies before motion in the same tick, so the first walk starts from the target', () => {
    const w = setup(islands()); actor(w, .5, .1); w.tick();
    teleport(w, 2.5); w.tick();
    expect(position(w).x).toBeCloseTo(2.6, 12);
    expect(contact(w)).toMatchObject({ acceptedXQ: 26000, acceptedHeightQ: 30000 });
    expect(velocity(w).vx).toBe(.1);
  });
  it('rejects unsupported, out-of-budget, malformed and ineligible teleports whole: zero writes, intent still consumed', () => {
    const cases: Array<[string, number, (w: World) => void, string]> = [
      ['hole', 1.5, () => {}, 'outside walkable coverage'],
      ['beyond the grid', 3.5, () => {}, 'outside walkable coverage'],
      ['negative', -.5, () => {}, 'outside walkable coverage'],
      ['NaN', Number.NaN, () => {}, 'finite planar metres'],
      ['over budget', 2e6, () => {}, 'coordinate'],
      ['invalid walker units', 2.5, w => { w.getComponent<GroundWalker3D>('actor', 'GroundWalker3D')!.maxStepUpQ = .5; }, 'not a valid ground walker'],
      ['trigger body', 2.5, w => { body(w).trigger = true; }, 'invalid/trigger body'],
      ['missing surface', 2.5, w => { w.removeComponent('surface', 'GroundSurface3D'); }, 'missing ground surface surface'],
    ];
    for (const [name, target, spoil, reason] of cases) {
      const w = setup(islands()); actor(w, .5, 0); const log = trace(w); w.tick();
      spoil(w);
      const before = actorState(w), seen = atTeleportEnd(w);
      teleport(w, target);
      expect(() => w.tick(), name).not.toThrow();
      expect(seen.state, name).toBe(before);
      expect(actorState(w), name).toBe(before);
      expect(w.hasComponent('actor', 'GroundTeleport3D'), name).toBe(false);
      expect(log.events.some(event => event.system === 'ground-teleport-3d' && event.kind === 'reject' && event.what.includes('actors unchanged') && event.why?.includes(reason)), name).toBe(true);
    }
  });
  it('rejects an intent on a non-walker without touching that entity', () => {
    const w = setup(islands()); actor(w, .5, 0); const log = trace(w);
    w.createEntity('prop'); w.addComponent('prop', xf(.5)); teleport(w, 2.5, .5, 'prop');
    w.tick();
    expect(position(w, 'prop').x).toBe(.5);
    expect(w.hasComponent('prop', 'GroundTeleport3D')).toBe(false);
    expect(w.hasComponent('prop', 'GroundContact3D')).toBe(false);
    expect(log.events.some(event => event.kind === 'reject' && event.why?.includes('prop:not a valid ground walker'))).toBe(true);
  });
  it('rescues an unsupported spawn onto real support, after which ordinary walking resumes', () => {
    const w = setup(islands()); actor(w, 1.5, .1); w.tick();
    expect(contact(w).supported).toBe(false);
    expect(position(w).x).toBe(1.5);
    velocity(w).vx = .1; teleport(w, .5); w.tick();
    expect(contact(w)).toMatchObject({ supported: true, acceptedXQ: 6000 });
    expect(position(w).x).toBeCloseTo(.6, 12);
  });
  it('keeps the authored Transform target exact and samples at the collider offset', () => {
    const w = setup(); actor(w, .5, 0, 'actor', { offsetX: .75, offsetZ: -.25 }); w.tick();
    const seen = atTeleportEnd(w);
    teleport(w, 2.25, .75); w.tick();
    expect(seen.contact).toMatchObject({ acceptedXQ: 30000, acceptedZQ: 5000, heightQ: 15000 });
    expect(seen.baseY).toBe(1.5);
    expect(position(w)).toMatchObject({ x: 2.25, y: .75 });
    expect(contact(w)).toMatchObject({ acceptedXQ: 30000, acceptedZQ: 5000, heightQ: 15000 });
    expect(body(w).baseY).toBe(1.5);
  });
  it('an intent added after the Input phase waits one tick deterministically', () => {
    const late: SystemDeclaration = {
      id: 'test-late-teleport', reads: [], writes: ['GroundTeleport3D'], consumes: [],
      execute: world => { if (world.getVersion() === 1) world.addComponent('actor', { type: 'GroundTeleport3D', x: 2.5, y: .5 }); },
    };
    const w = setup(islands(), [...baseSystems, late]); actor(w, .5, 0);
    w.tick(); w.tick();
    expect(position(w).x).toBe(.5);
    expect(w.hasComponent('actor', 'GroundTeleport3D')).toBe(true);
    w.tick();
    expect(position(w).x).toBe(2.5);
  });
  it('equal per-tick hashes, snapshot with a pending intent restores the same future, trace does not change hashes', () => {
    const make = () => { const w = setup(islands()); actor(w, .5, .05, '10'); actor(w, 1.5, 0, '2'); return w; };
    const a = make(), b = make(), log = trace(b);
    for (let i = 0; i < 12; i++) {
      if (i === 3) for (const w of [a, b]) { teleport(w, 2.5, .5, '10'); teleport(w, .25, .5, '2'); }
      a.tick(); b.tick();
      expect(hashSnapshot(a.snapshot())).toBe(hashSnapshot(b.snapshot()));
    }
    expect(log.events.some(event => event.system === 'ground-teleport-3d')).toBe(true);
    teleport(a, .25, .5, '10');
    const saved = JSON.parse(JSON.stringify(a.snapshot())), order = [...a.snapshotOrder()];
    const restored = make(); restored.restore(saved, order);
    for (let i = 0; i < 6; i++) {
      a.tick(); restored.tick();
      expect(hashWithOrder(a.snapshot(), a.snapshotOrder())).toBe(hashWithOrder(restored.snapshot(), restored.snapshotOrder()));
    }
    expect(position(restored, '10').x).toBeCloseTo(.25 + 6 * .05, 12);
  });
});
