import { describe, expect, it, vi } from 'vitest';
import { bakeGroundSurface } from '@engine/spatial/ground-surface.js';
import { Engine } from '@runtime/engine.js';
import { groundWalk3dCapability } from '@skills/tier2/ground-walk-3d.js';
import { validateGroundWalkers } from './ground-walkers.js';
import { parseManifest } from './manifest.js';
import { parseManifestAsync } from './manifest-async.js';

const xf = { x: .25, y: .25, rotation: 0, scaleX: 1, scaleY: 1 };
function fixture(): Record<string, Record<string, unknown>> {
  const { type: _type, ...surface } = bakeGroundSurface([{ points: [[0, 0, 0], [10000, 0, 0], [0, 0, 10000]] }]);
  return { terrain: { GroundSurface3D: surface },
    actor: { Transform: { ...xf }, Collider3D: { kind: 'capsule', radius: .1, height: 1 }, GroundWalker3D: { surfaceId: 'terrain' } } };
}
describe('atomic ground walker load validation', () => {
  it('accepts canonical generated tables with blueprint type omitted, and infers the runtime', async () => {
    const entities = fixture(), before = JSON.stringify(entities);
    validateGroundWalkers(entities);
    const a = parseManifest({ entities }), b = await parseManifestAsync({ entities });
    expect(a.capabilities.some(c => c.id === 't2-ground-walk-3d')).toBe(true);
    expect(b.entities).toEqual(a.entities);
    expect(JSON.stringify(entities)).toBe(before);
  });
  it('rejects missing surface, invalid step units, offsets and incompatible bodies before mutating Engine', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const cases = [
        (e: ReturnType<typeof fixture>) => { e.actor.GroundWalker3D = { surfaceId: 'missing' }; },
        (e: ReturnType<typeof fixture>) => { e.actor.GroundWalker3D = { surfaceId: 'terrain', maxStepUpQ: .5 }; },
        (e: ReturnType<typeof fixture>) => { e.actor.Collider3D = { kind: 'hull', verts: [] }; },
        (e: ReturnType<typeof fixture>) => { e.actor.Collider3D = { kind: 'sphere', radius: .1, offsetX: Infinity }; },
        (e: ReturnType<typeof fixture>) => { e.actor.Transform = { ...xf, x: '0.25' }; },
      ];
      for (const change of cases) {
        const e = fixture(); change(e); const engine = new Engine();
        expect(() => engine.load({ entities: e, capabilities: [groundWalk3dCapability] } as never)).toThrow(/ground-walk/);
        expect(engine.world.query()).toEqual([]);
        expect(engine.world.getSortedSystems()).toEqual([]);
      }
      expect(warn).toHaveBeenCalled();
    } finally { warn.mockRestore(); }
  });
  it('rejects competing presentation/hierarchy drivers and caller-authored contacts', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      for (const field of ['Transform3D', 'RigidBody3D', 'Anim3D', 'Path3D', 'Hierarchy', 'Pivot3D', 'GroundContact3D']) {
        const e = fixture(); e.actor[field] = {};
        expect(() => validateGroundWalkers(e)).toThrow(/conflict|runtime-owned/);
      }
      const e = fixture(); e.presentation = { Pivot3D: { children: ['actor'] } };
      expect(() => validateGroundWalkers(e)).toThrow(/render pivot/);
    } finally { warn.mockRestore(); }
  });
  it('accepts an authored GroundTeleport3D, applies it on the first tick, and rejects malformed or orphan intents', () => {
    const e = fixture(); e.actor.GroundTeleport3D = { x: .1, y: .6 };
    const engine = new Engine(); engine.load({ entities: e, capabilities: [groundWalk3dCapability] } as never);
    engine.world.tick();
    expect(engine.world.getComponent('actor', 'Transform')).toMatchObject({ x: .1, y: .6 });
    expect(engine.world.getComponent('actor', 'GroundContact3D')).toMatchObject({ acceptedXQ: 1000, acceptedZQ: 6000, supported: true });
    expect(engine.world.hasComponent('actor', 'GroundTeleport3D')).toBe(false);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const cases: Array<[(e: ReturnType<typeof fixture>) => void, RegExp]> = [
        [e => { e.terrain.GroundTeleport3D = { x: .1, y: .1 }; }, /requires GroundWalker3D/],
        [e => { e.actor.GroundTeleport3D = { x: .1, y: .1, z: 0 }; }, /expected GroundTeleport3D/],
        [e => { e.actor.GroundTeleport3D = { x: '0.1', y: .1 }; }, /expected GroundTeleport3D/],
        [e => { e.actor.GroundTeleport3D = { x: Infinity, y: .1 }; }, /expected GroundTeleport3D/],
        [e => { e.actor.GroundTeleport3D = { x: 2e6, y: .1 }; }, /coordinate budget/],
      ];
      for (const [change, message] of cases) {
        const bad = fixture(); change(bad);
        expect(() => validateGroundWalkers(bad)).toThrow(message);
      }
    } finally { warn.mockRestore(); }
  });
  it('rejects forged bucket entries and table type without touching caller data', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      for (const patch of [{ indices: [] }, { type: 'Wrong' }]) {
        const e = fixture(); Object.assign(e.terrain.GroundSurface3D!, patch);
        const before = JSON.stringify(e);
        expect(() => validateGroundWalkers(e)).toThrow(/noncanonical|invalid/);
        expect(JSON.stringify(e)).toBe(before);
      }
    } finally { warn.mockRestore(); }
  });
});
