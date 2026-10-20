import type { GroundSurface3D, GroundWalker3D, Collider3D } from '@engine/protocol/components.js';
import { assertGroundSurface } from '@engine/spatial/ground-surface.js';
import { validGroundBody, validGroundWalker, groundCoordinateQ } from '@skills/tier2/ground-walk-3d.js';

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
function reject(message: string): never {
  console.warn(`[ground-walk] reject: ${message}`);
  throw new Error(`ground-walk: ${message}`);
}
/** Atomic load validation shared by manifest and direct Engine.load. No mutation.
 * Spawned walkers are additionally checked by the runtime capability. */
export function validateGroundWalkers(entities: Record<string, unknown>): void {
  for (const [id, raw] of Object.entries(entities)) {
    if (!object(raw)) continue;
    if (raw.GroundSurface3D !== undefined) {
      if (!object(raw.GroundSurface3D)) reject(`${id}: invalid GroundSurface3D`);
      if (raw.GroundSurface3D.type !== undefined && raw.GroundSurface3D.type !== 'GroundSurface3D') reject(`${id}: invalid GroundSurface3D type`);
      try { assertGroundSurface({ ...raw.GroundSurface3D, type: 'GroundSurface3D' } as unknown as GroundSurface3D); }
      catch (error) { reject(`${id}: ${error instanceof Error ? error.message : 'invalid height table'}`); }
    }
    if (raw.GroundWalker3D === undefined) continue;
    if (!object(raw.GroundWalker3D) || !validGroundWalker(raw.GroundWalker3D as unknown as GroundWalker3D)) reject(`${id}: invalid GroundWalker3D`);
    const walker = raw.GroundWalker3D as unknown as GroundWalker3D;
    if (Object.keys(walker).some(k => !['type', 'surfaceId', 'maxStepUpQ', 'maxStepDownQ'].includes(k))) reject(`${id}: unknown GroundWalker3D field`);
    const surface = entities[walker.surfaceId];
    if (!object(surface) || !object(surface.GroundSurface3D)) reject(`${id}: missing GroundSurface3D "${walker.surfaceId}"`);
    if (!object(raw.Transform) || !object(raw.Collider3D) || !validGroundBody(raw.Collider3D as unknown as Collider3D)) reject(`${id}: expected planar Transform and non-trigger vertical sphere/capsule/box Collider3D`);
    try {
      if (typeof raw.Transform.x !== 'number' || typeof raw.Transform.y !== 'number') throw new Error('non-numeric planar coordinates');
      groundCoordinateQ(Number(raw.Transform.x) + Number(raw.Collider3D.offsetX ?? 0));
      groundCoordinateQ(Number(raw.Transform.y) + Number(raw.Collider3D.offsetZ ?? 0));
    } catch { reject(`${id}: invalid planar coordinates`); }
    for (const key of ['Transform3D', 'RigidBody3D', 'Anim3D', 'Path3D', 'Pivot3D', 'Hierarchy']) if (raw[key] !== undefined) reject(`${id}: ${key} conflicts with deterministic ground walking`);
    if (raw.GroundContact3D !== undefined) reject(`${id}: GroundContact3D is runtime-owned; restore snapshots using world.restore`);
    for (const [parentId, parent] of Object.entries(entities)) {
      if (object(parent) && object(parent.Pivot3D) && Array.isArray(parent.Pivot3D.children) && parent.Pivot3D.children.includes(id)) reject(`${id}: render pivot ${parentId} conflicts with ground walking`);
    }
  }
}
