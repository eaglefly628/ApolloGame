import { describe, expect, it } from 'vitest';
import { World } from '../core/world.js';
import type { Collider3D, GroundContact3D, GroundSurface3D, Transform } from '../protocol/components.js';
import { bakeGroundSurface } from './ground-surface.js';
import { contact3d } from './contact3d.js';
import { isGroundSupportContact } from './ground-support.js';
import { groundWalk3dCapability } from '@skills/tier2/ground-walk-3d.js';
import { overlapDetect3dCapability } from '@atom-skills/overlap-detect-3d/index.js';
import { collisionResolve3dCapability } from '@atom-skills/collision-resolve-3d/index.js';
import { motionApplyCapability } from '@skills/tier1/motion-apply.js';

const t = (x: number, z: number): Transform => ({ type: 'Transform', x, y: z, rotation: 0, scaleX: 1, scaleY: 1 });
const ramp: Collider3D = { type: 'Collider3D', kind: 'hull', baseY: 0,
  verts: [0, -1, -1, 10, -1, -1, 0, 0, -1, 10, 5, -1, 0, -1, 1, 10, -1, 1, 0, 0, 1, 10, 5, 1],
  axes: [1, 0, 0, 0, 1, 0, 0, 0, 1, -.5, 1, 0] };
function setup(x = 5, z = 0, height = x / 2) {
  const w = new World();
  w.createEntity('terrain');
  w.addComponent('terrain', bakeGroundSurface([
    { points: [[0, 0, -10000], [100000, 50000, -10000], [100000, 50000, 10000]], supportIds: ['ramp'] },
    { points: [[0, 0, -10000], [100000, 50000, 10000], [0, 0, 10000]], supportIds: ['ramp'] },
  ]));
  w.createEntity('ramp'); w.addComponent('ramp', t(0, 0)); w.addComponent('ramp', structuredClone(ramp));
  w.createEntity('walker'); w.addComponent('walker', t(x, z));
  w.addComponent('walker', { type: 'Collider3D', kind: 'capsule', radius: .3, height: 1.8, baseY: height } as Collider3D);
  w.addComponent('walker', { type: 'GroundWalker3D', surfaceId: 'terrain' });
  w.addComponent('walker', { type: 'Velocity', vx: 0, vy: 0 });
  w.addComponent('walker', { type: 'GroundContact3D', surfaceId: 'terrain', supported: true, triangleId: 0, heightQ: Math.round(height * 10000),
    acceptedXQ: x * 10000, acceptedZQ: z * 10000, acceptedHeightQ: height * 10000, acceptedTriangleId: 0 } as GroundContact3D);
  return w;
}
function contact(w: World) {
  return contact3d(t(0, 0), ramp, w.getComponent<Transform>('walker', 'Transform')!, w.getComponent<Collider3D>('walker', 'Collider3D')!)!;
}
describe('R2 precise support contact', () => {
  it('climbs a legal step with an actual vertical collision riser', () => {
    const w = new World();
    w.createEntity('terrain');
    const triangles: Parameters<typeof bakeGroundSurface>[0][number][] = [];
    for (const [left, right, height, support] of [[-20000, 0, 0, 'floor'], [0, 20000, 2000, 'step']] as const) {
      triangles.push({ points: [[left, height, -10000], [right, height, -10000], [right, height, 10000]], supportIds: [support] },
        { points: [[left, height, -10000], [right, height, 10000], [left, height, 10000]], supportIds: [support] });
    }
    w.addComponent('terrain', bakeGroundSurface(triangles));
    for (const [id, x, baseY, halfY] of [['floor', -1, -.4, .2], ['step', 1, -.2, .2]] as const) {
      w.createEntity(id); w.addComponent(id, t(x, 0));
      w.addComponent(id, { type: 'Collider3D', kind: 'box', halfX: 1, halfY, halfZ: 1, baseY } as Collider3D);
    }
    w.createEntity('actor'); w.addComponent('actor', t(-1, 0));
    w.addComponent('actor', { type: 'Collider3D', kind: 'capsule', radius: .3, height: 1.8 } as Collider3D);
    w.addComponent('actor', { type: 'GroundWalker3D', surfaceId: 'terrain' });
    w.addComponent('actor', { type: 'Velocity', vx: .1, vy: 0 });
    for (const cap of [motionApplyCapability, groundWalk3dCapability, overlapDetect3dCapability, collisionResolve3dCapability]) for (const s of cap.systems) w.addSystem(s);
    for (let i = 0; i < 25; i++) {
      w.getComponent<{ type: 'Velocity'; vx: number; vy: number }>('actor', 'Velocity')!.vx = .1;
      w.tick();
    }
    expect(w.getComponent<Transform>('actor', 'Transform')!.x).toBeGreaterThan(1);
    expect(w.getComponent<Collider3D>('actor', 'Collider3D')!.baseY).toBe(.2);
    for (let i = 0; i < 25; i++) {
      w.getComponent<{ type: 'Velocity'; vx: number; vy: number }>('actor', 'Velocity')!.vx = -.1;
      w.tick();
    }
    expect(w.getComponent<Transform>('actor', 'Transform')!.x).toBeCloseTo(-1, 10);
    expect(w.getComponent<Collider3D>('actor', 'Collider3D')!.baseY).toBe(0);
  });
  it('exempts the upward sloped support in either entity order', () => {
    for (const x of [1, 5, 9]) {
      const w = setup(x), c = contact(w);
      expect(c.depth).toBeCloseTo(.0316718427, 8);
      expect(isGroundSupportContact(w, 'ramp', 'walker', c)).toBe(true);
      expect(isGroundSupportContact(w, 'walker', 'ramp', { ...c, nx: -c.nx, ny: -c.ny, nz: -c.nz })).toBe(true);
    }
  });
  it('keeps same-hull side, rounded edge, underside and unrelated wall blocking', () => {
    for (const [z, y] of [[1.2, 1.8], [1.05, 2.5], [0, -2.7]]) {
      const w = setup(5, z, y), c = contact(w);
      expect(c).not.toBeNull();
      expect(isGroundSupportContact(w, 'ramp', 'walker', c)).toBe(false);
    }
    const w = setup();
    expect(isGroundSupportContact(w, 'wall', 'walker', contact(w))).toBe(false);
    w.addComponent('ramp', { type: 'Velocity', vx: 0, vy: 0 });
    expect(isGroundSupportContact(w, 'ramp', 'walker', contact(w))).toBe(false);
  });
  it('rechecks actual coverage and support ownership after a positional correction', () => {
    const w = setup(), c = contact(w);
    expect(isGroundSupportContact(w, 'ramp', 'walker', c)).toBe(true);
    w.getComponent<Transform>('walker', 'Transform')!.y = 2;
    expect(isGroundSupportContact(w, 'ramp', 'walker', c)).toBe(false);
    w.getComponent<Transform>('walker', 'Transform')!.y = 0;
    w.getComponent<GroundSurface3D>('terrain', 'GroundSurface3D')!.supportIds = [[], []];
    expect(isGroundSupportContact(w, 'ramp', 'walker', c)).toBe(false);
  });
  it('walks the real convex ramp without downhill solver drift, while a separate wall still blocks', () => {
    const w = setup(1);
    for (const cap of [motionApplyCapability, groundWalk3dCapability, overlapDetect3dCapability, collisionResolve3dCapability]) for (const s of cap.systems) w.addSystem(s);
    w.createEntity('wall'); w.addComponent('wall', t(4, 0));
    w.addComponent('wall', { type: 'Collider3D', kind: 'box', halfX: .2, halfY: 5, halfZ: 1, baseY: 0 } as Collider3D);
    for (let i = 0; i < 80; i++) {
      const velocity = w.getComponent<{ type: 'Velocity'; vx: number; vy: number }>('walker', 'Velocity')!;
      velocity.vx = .1; velocity.vy = 0; w.tick();
      const at = w.getComponent<Transform>('walker', 'Transform')!;
      expect(at.y).toBeCloseTo(0, 10);
      expect(w.getComponent<Collider3D>('walker', 'Collider3D')!.baseY).toBeCloseTo(at.x / 2, 4);
    }
    expect(w.getComponent<Transform>('walker', 'Transform')!.x).toBeCloseTo(3.5, 8);
  });
});
