import { describe, expect, it } from 'vitest';
import { World } from '@engine/core/world.js';
import type { Transform, Velocity } from '@engine/protocol/components.js';
import { crowdAvoidanceCapability as crowd } from './crowd-avoidance.js';
import { orcaVelocity } from './orca.js';
import { motionApplyCapability as motion } from '../tier1/motion-apply.js';
import { collisionResolveCapability as collision } from './collision-resolve.js';
import { overlapDetectCapability as overlap } from '../atoms/overlap-detect/index.js';
import { bounceRelayCapability as bounce } from './bounce-relay.js';
import { topologicalSort } from '@engine/core/topological-sort.js';

function actor(w: World, id: string, x: number, y: number, vx: number, vy: number, radius = .3, maxSpeed = .2) {
  w.createEntity(id);
  w.addComponent(id, { type: 'Transform', x, y, rotation: 0, scaleX: 1, scaleY: 1 });
  w.addComponent(id, { type: 'Velocity', vx, vy, angular: 0 });
  w.addComponent(id, { type: 'CrowdAvoidance', radius, maxSpeed });
  w.addComponent(id, { type: 'Shape', kind: 'circle', radius });
}
const vel = (w: World, id: string) => w.getComponent<Velocity>(id, 'Velocity')!;
const pos = (w: World, id: string) => w.getComponent<Transform>(id, 'Transform')!;

describe('REQ-114 independent crowd review', () => {
  it('post-motion bounce reactions do not form an ordering cycle with crowd velocity reads',()=>{
    expect(()=>topologicalSort([...crowd.systems,...motion.systems,...bounce.systems],{softCycle:'throw'})).not.toThrow();
  });
  it('uses previous actual velocities rather than current navigation preferences for all neighbors', () => {
    const w = new World();
    actor(w, 'a', 0, 0, .03, .09);
    actor(w, 'b', .8, .1, -.02, -.04);
    crowd.systems[0].execute(w);
    vel(w, 'a').vx = .2; vel(w, 'a').vy = 0;
    vel(w, 'b').vx = -.2; vel(w, 'b').vy = 0;
    const a = { x: 0, y: 0, vx: .03, vy: .09, radius: .3, idx: 0, reciprocal: true };
    const b = { x: .8, y: .1, vx: -.02, vy: -.04, radius: .3, idx: 1, reciprocal: true };
    const expectedA = orcaVelocity(a, [b], { x: .2, y: 0 }, .2, 8, 1);
    const expectedB = orcaVelocity(b, [a], { x: -.2, y: 0 }, .2, 8, 1);
    crowd.systems[1].execute(w);
    expect([vel(w, 'a').vx, vel(w, 'a').vy]).toEqual([expectedA.x, expectedA.y]);
    expect([vel(w, 'b').vx, vel(w, 'b').vy]).toEqual([expectedB.x, expectedB.y]);
  });

  it('stopped neighbor is static and moving agent assumes full avoidance responsibility', () => {
    const w = new World();
    actor(w, 'a', 0, 0, .2, 0);
    actor(w, 'b', .8, .1, -.2, 0);
    crowd.systems[0].execute(w);
    vel(w, 'b').vx = 0;
    const expected = orcaVelocity(
      { x: 0, y: 0, vx: .2, vy: 0, radius: .3, idx: 0, reciprocal: true },
      [{ x: .8, y: .1, vx: 0, vy: 0, radius: .3, idx: 1, reciprocal: false }],
      { x: .2, y: 0 }, .2, 8, 1,
    );
    crowd.systems[1].execute(w);
    expect([vel(w, 'a').vx, vel(w, 'a').vy]).toEqual([expected.x, expected.y]);
    expect([vel(w, 'b').vx, vel(w, 'b').vy]).toEqual([0, 0]);
  });

  it('normal-speed static wall remains solid in the full collision composition', () => {
    const w = new World();
    for (const c of [crowd, motion, overlap, collision]) for (const s of c.systems) w.addSystem(s);
    actor(w, 'a', 0, 0, .2, 0);
    w.createEntity('wall');
    w.addComponent('wall', { type: 'Transform', x: 1, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });
    w.addComponent('wall', { type: 'Shape', kind: 'box', width: .2, height: 10 });
    for (let i = 0; i < 20; i++) { vel(w, 'a').vx = .2; w.tick(); }
    expect(pos(w, 'a').x).toBeCloseTo(.6, 10);
  });

  it('dense endpoint crowd stays finite and speed-bounded', () => {
    const w = new World();
    for (const c of [crowd, motion]) for (const s of c.systems) w.addSystem(s);
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6;
      actor(w, String(i).padStart(2, '0'), Math.cos(angle) * 2, Math.sin(angle) * 2, 0, 0);
    }
    for (let tick = 0; tick < 100; tick++) {
      for (let i = 0; i < 12; i++) {
        const id = String(i).padStart(2, '0'); const p = pos(w, id); const v = vel(w, id);
        const d = Math.hypot(p.x, p.y);
        v.vx = d > .1 ? -.2 * p.x / d : 0; v.vy = d > .1 ? -.2 * p.y / d : 0;
      }
      w.tick();
      for (let i = 0; i < 12; i++) {
        const id = String(i).padStart(2, '0'); const p = pos(w, id); const v = vel(w, id);
        expect([p.x, p.y, v.vx, v.vy].every(Number.isFinite)).toBe(true);
        expect(Math.hypot(v.vx, v.vy)).toBeLessThanOrEqual(.20000001);
      }
    }
  });
});
