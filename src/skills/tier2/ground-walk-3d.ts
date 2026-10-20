import { defineCapability } from '@engine/core/define-capability.js';
import { defineComponent } from '@engine/core/define-component.js';
import { t } from '@engine/core/schema.js';
import type { IWorld } from '@engine/core/types.js';
import type { Collider3D, GroundWalker3D, GroundSurface3D, GroundContact3D, GroundTeleport3D, Transform, Velocity } from '@engine/protocol/components.js';
import { sampleGroundSurface, walkGroundSurface } from '@engine/spatial/ground-surface.js';
import { findDebugTrace, appendTrace } from '../debug-trace.js';

export const GROUND_Q = 10000;
export const GROUND_STEP_UP_Q = 2500;
export const GROUND_STEP_DOWN_Q = 5000;
const LIMIT_Q = 1e10;
export function groundCoordinateQ(n: number): number {
  const q = Math.round(n * GROUND_Q) || 0;
  if (!Number.isFinite(n) || !Number.isSafeInteger(q) || Math.abs(q) > LIMIT_Q) throw new Error('ground coordinate exceeds ±1000000m');
  return q;
}
export function validGroundWalker(w: GroundWalker3D): boolean {
  return typeof w.surfaceId === 'string' && w.surfaceId.trim().length > 0
    && [w.maxStepUpQ, w.maxStepDownQ].every(v => v === undefined || Number.isSafeInteger(v) && v >= 0 && v <= LIMIT_Q);
}
export function validGroundBody(c: Collider3D | undefined): c is Collider3D {
  if (!c || c.trigger || !Number.isFinite(c.baseY ?? 0) || !Number.isFinite(c.offsetX ?? 0) || !Number.isFinite(c.offsetZ ?? 0)) return false;
  if (c.kind === 'sphere') return Number.isFinite(c.radius) && c.radius! > 0;
  if (c.kind === 'capsule') return Number.isFinite(c.radius) && c.radius! > 0 && Number.isFinite(c.height ?? 2 * c.radius!) && (c.height ?? 2 * c.radius!) >= 2 * c.radius!;
  return c.kind === 'box' && [c.halfX, c.halfY, c.halfZ].every(v => Number.isFinite(v) && v! > 0);
}
export function validGroundTeleport(v: GroundTeleport3D): boolean {
  return typeof v.x === 'number' && typeof v.y === 'number' && Number.isFinite(v.x) && Number.isFinite(v.y);
}

const fields = {
  surfaceId: t.entity(), heightQ: t.num(), triangleId: t.num(),
  acceptedXQ: t.num(), acceptedZQ: t.num(), acceptedHeightQ: t.num(), acceptedTriangleId: t.num(),
  supported: t.bool(), rejected: t.opt(t.bool()),
};

function initializeGroundContacts(world: IWorld, system = 'ground-init-3d'): void {
  const actors = world.query('GroundWalker3D').map(([id]) => id).sort();
  let initialized = 0, rejected = 0;
  const trace = actors.length ? findDebugTrace(world) : undefined;
  const failures: string[] = [];
  for (const id of actors) {
    if (world.hasComponent(id, 'GroundContact3D')) continue;
    const walker = world.getComponent<GroundWalker3D>(id, 'GroundWalker3D')!;
    const transform = world.getComponent<Transform>(id, 'Transform');
    const body = world.getComponent<Collider3D>(id, 'Collider3D');
    let xQ = 0, zQ = 0, heightQ = 0;
    let hit: { heightQ: number; triangleId: number } | undefined;
    try {
      if (!transform) throw new Error('missing transform');
      xQ = groundCoordinateQ(transform.x + (body?.offsetX ?? 0));
      zQ = groundCoordinateQ(transform.y + (body?.offsetZ ?? 0));
      heightQ = groundCoordinateQ(body?.baseY ?? 0);
      const surface = world.getComponent<GroundSurface3D>(walker.surfaceId, 'GroundSurface3D');
      if (!validGroundWalker(walker)) throw new Error('invalid walker/step units');
      if (!validGroundBody(body)) throw new Error('missing/invalid or trigger body');
      if (!surface) throw new Error(`missing ground surface ${walker.surfaceId}`);
      hit = sampleGroundSurface(surface, xQ, zQ);
      if (!hit) throw new Error('authored position is outside walkable coverage');
    } catch (error) {
      if (trace && failures.length < 3) failures.push(`${id}:${error instanceof Error ? error.message : 'invalid ground data'}`);
    }
    if (hit && body) { heightQ = hit.heightQ; body.baseY = heightQ / GROUND_Q; initialized++; }
    else rejected++;
    world.addComponent(id, { type: 'GroundContact3D', surfaceId: walker.surfaceId,
      heightQ, triangleId: hit?.triangleId ?? -1, acceptedXQ: xQ, acceptedZQ: zQ,
      acceptedHeightQ: heightQ, acceptedTriangleId: hit?.triangleId ?? -1, supported: !!hit, rejected: false } as GroundContact3D);
  }
  if (trace) {
    if (initialized || rejected) appendTrace(trace, world.getVersion(), system, rejected ? 'reject' : 'commit', `${initialized} supports acquired; ${rejected} initial positions unsupported`, rejected ? failures.join('; ') : 'At the actual authored/spawn position');
  }
}

/** An explicit relocation is not a walk: without this intent any discontinuous
 * Transform write is checked as one continuous segment and rolled back. The target
 * acquires only the support under it. Rejection writes nothing (no nearest-point
 * snap, no partial move); velocity is never touched. Runs before ground-init, so a
 * relocated actor also skips the authored-position acquisition. */
function applyGroundTeleports(world: IWorld): void {
  const ids = world.query('GroundTeleport3D').map(([id]) => id).sort();
  if (!ids.length) return;
  const trace = findDebugTrace(world);
  let accepted = 0, rejected = 0;
  const moved: string[] = [], failures: string[] = [];
  for (const id of ids) {
    const intent = world.getComponent<GroundTeleport3D>(id, 'GroundTeleport3D')!;
    try {
      const walker = world.getComponent<GroundWalker3D>(id, 'GroundWalker3D');
      const transform = world.getComponent<Transform>(id, 'Transform');
      const body = world.getComponent<Collider3D>(id, 'Collider3D');
      if (!walker || !validGroundWalker(walker)) throw new Error('not a valid ground walker');
      if (!transform || !validGroundBody(body)) throw new Error('missing transform or invalid/trigger body');
      if (!validGroundTeleport(intent)) throw new Error('target must be finite planar metres');
      const surface = world.getComponent<GroundSurface3D>(walker.surfaceId, 'GroundSurface3D');
      if (!surface) throw new Error(`missing ground surface ${walker.surfaceId}`);
      const xQ = groundCoordinateQ(intent.x + (body.offsetX ?? 0)), zQ = groundCoordinateQ(intent.y + (body.offsetZ ?? 0));
      const hit = sampleGroundSurface(surface, xQ, zQ);
      if (!hit) throw new Error('target is outside walkable coverage');
      transform.x = intent.x; transform.y = intent.y;
      body.baseY = hit.heightQ / GROUND_Q;
      world.addComponent(id, { type: 'GroundContact3D', surfaceId: walker.surfaceId, heightQ: hit.heightQ, triangleId: hit.triangleId,
        acceptedXQ: xQ, acceptedZQ: zQ, acceptedHeightQ: hit.heightQ, acceptedTriangleId: hit.triangleId, supported: true, rejected: false } as GroundContact3D);
      accepted++;
      if (moved.length < 3) moved.push(`${id}@${xQ},${zQ}/${hit.heightQ}`);
    } catch (error) {
      rejected++;
      if (failures.length < 3) failures.push(`${id}:${error instanceof Error ? error.message : 'invalid teleport'}`);
    }
  }
  if (trace) {
    if (accepted) appendTrace(trace, world.getVersion(), 'ground-teleport-3d', 'commit', `${accepted} teleports accepted`, moved.join('; '));
    if (rejected) appendTrace(trace, world.getVersion(), 'ground-teleport-3d', 'reject', `${rejected} teleports rejected; actors unchanged`, failures.join('; '));
  }
}

/** No actor cache: contact/accepted position is serialized world data. The table is
 * validated once by assembly; arithmetic/bucket budgets still reject bad live data. */
function groundPass(world: IWorld, final: boolean): void {
  // Update may have spawned actors after the Input bootstrap. Their actual
  // spawn point is acquired here before they first participate in collision.
  initializeGroundContacts(world, final ? 'ground-final-3d' : 'ground-pre-3d');
  const actors = world.query('GroundWalker3D').map(([id]) => id).sort();
  if (!actors.length) return;
  const trace = findDebugTrace(world), system = final ? 'ground-final-3d' : 'ground-pre-3d';
  let accepted = 0, rejected = 0, changed = 0;
  const failures: string[] = [];
  for (const id of actors) {
    const walker = world.getComponent<GroundWalker3D>(id, 'GroundWalker3D')!;
    const transform = world.getComponent<Transform>(id, 'Transform');
    const body = world.getComponent<Collider3D>(id, 'Collider3D');
    const surface = world.getComponent<GroundSurface3D>(walker.surfaceId, 'GroundSurface3D');
    let contact = world.getComponent<GroundContact3D>(id, 'GroundContact3D');
    const wasRejected = contact?.rejected === true;
    let reason: string | undefined;
    try {
      if (!validGroundWalker(walker) || !transform || !validGroundBody(body) || !surface) throw new Error('missing/invalid ground surface, walker or body');
      const xQ = groundCoordinateQ(transform.x + (body.offsetX ?? 0)), zQ = groundCoordinateQ(transform.y + (body.offsetZ ?? 0));
      const previous = contact?.supported && contact.surfaceId === walker.surfaceId ? contact : undefined;
      if (contact && !contact.supported) throw new Error('initial position has no walkable support');
      // Newly spawned actors acquire only the surface at their actual position.
      // No nearest-point or "highest col top" teleport fallback.
      if (!previous) {
        const hit = sampleGroundSurface(surface, xQ, zQ);
        if (!hit) throw new Error('initial position has no walkable support');
        contact = { type: 'GroundContact3D', surfaceId: walker.surfaceId, heightQ: hit.heightQ, triangleId: hit.triangleId,
          acceptedXQ: xQ, acceptedZQ: zQ, acceptedHeightQ: hit.heightQ, acceptedTriangleId: hit.triangleId, supported: true, rejected: false };
        world.addComponent(id, contact);
      }
      const state = contact!;
      const hit = walkGroundSurface(surface, state.acceptedXQ, state.acceptedZQ, xQ, zQ, state.acceptedHeightQ,
        walker.maxStepUpQ ?? GROUND_STEP_UP_Q, walker.maxStepDownQ ?? GROUND_STEP_DOWN_Q, state.acceptedTriangleId);
      if (!hit) throw new Error('movement crosses hole, boundary or excessive step');
      const nextY = hit.heightQ / GROUND_Q;
      if (body.baseY !== nextY || state.triangleId !== hit.triangleId || state.heightQ !== hit.heightQ
        || final && (state.acceptedXQ !== xQ || state.acceptedZQ !== zQ)) changed++;
      body.baseY = nextY;
      state.heightQ = hit.heightQ; state.triangleId = hit.triangleId; state.supported = true;
      if (final) {
        state.acceptedXQ = xQ; state.acceptedZQ = zQ; state.acceptedHeightQ = hit.heightQ; state.acceptedTriangleId = hit.triangleId;
        state.rejected = false;
      }
      accepted++;
    } catch (error) {
      reason = error instanceof Error ? error.message : 'invalid ground data';
      rejected++;
      if (trace && failures.length < 3) failures.push(`${id}:${reason}`);
      // Restore only a previously serialized accepted position, never a guessed
      // nearest edge. Keep pre's candidate separate until all constraints finish.
      if (contact && contact.surfaceId === walker.surfaceId && transform && body) {
        transform.x = contact.acceptedXQ / GROUND_Q - (body.offsetX ?? 0);
        transform.y = contact.acceptedZQ / GROUND_Q - (body.offsetZ ?? 0);
        body.baseY = contact.acceptedHeightQ / GROUND_Q;
        contact.heightQ = contact.acceptedHeightQ; contact.triangleId = contact.acceptedTriangleId;
        contact.rejected = !final;
      } else if (transform && !contact) {
        // Unsupported spawn remains where authored; final stops its velocity.
        contact = { type: 'GroundContact3D', surfaceId: walker.surfaceId, heightQ: 0, triangleId: -1,
          acceptedXQ: 0, acceptedZQ: 0, acceptedHeightQ: 0, acceptedTriangleId: -1, supported: false, rejected: !final };
        world.addComponent(id, contact);
      }
    }
    if (final && (reason !== undefined || wasRejected)) {
      const v = world.getComponent<Velocity>(id, 'Velocity');
      if (v) { v.vx = 0; v.vy = 0; }
      if (contact) contact.rejected = false;
    }
  }
  if (trace) {
    if (rejected) appendTrace(trace, world.getVersion(), system, 'reject', `${rejected} moves rejected`, failures.join('; '));
    if (changed) appendTrace(trace, world.getVersion(), system, 'commit', `${changed} heights/contact changes`, `${accepted} supported actors`);
  }
}

export const groundWalk3dCapability = defineCapability({
  id: 't2-ground-walk-3d', version: '1.0.0',
  describe: {
    name: 'ground-walk-3d', summary: 'Deterministic fixed-point height sampling and continuous supported walking on imported terrain.',
    semantic: ['tier2', 'movement', 'ground', '3d'],
    whenToUse: 'Opt-in 3D walkers on E5 ground surfaces; slopes, steps and holes with rollback-safe accepted position. Relocate (teleport/respawn) with a GroundTeleport3D intent, never a bare Transform write.',
    examples: ['GroundWalker3D:{surfaceId:"scene"}; SceneImport3D:{modelKey:"scene",rules:"default",ground:{source:"navigation"}}',
      'Checkpoint respawn: add GroundTeleport3D:{x:2.5,y:0.5} to the walker; applied next Input phase, rejected whole if unsupported'],
  },
  config: {},
  components: {
    provides: {
      GroundWalker3D: defineComponent('GroundWalker3D', { surfaceId: t.entity(), maxStepUpQ: t.opt(t.num()), maxStepDownQ: t.opt(t.num()) },
        { category: 'config', describe: 'Opt-in ground walker; Q=10000/metre, default up2500/down5000. Runtime body must be vertical sphere/capsule/box.',
          refine: v => validGroundWalker(v as unknown as GroundWalker3D) ? [] : [{ path: '', message: 'Invalid surface id or integer step limits', severity: 'error' }] }),
      GroundSurface3D: defineComponent('GroundSurface3D', { originXQ: t.num(), originZQ: t.num(), cellSizeQ: t.num(), cols: t.num(), rows: t.num(),
        triangles: t.arr(t.num()), supportIds: t.arr(t.arr(t.entity())), offsets: t.arr(t.num()), indices: t.arr(t.num()) },
        { category: 'config', describe: 'Canonical load-time integer triangle height table and bounded spatial buckets; participates in hash.' }),
      GroundContact3D: defineComponent('GroundContact3D', fields, { category: 'marker', describe: 'Current support and last final accepted point. Serialized, never a hidden cache.' }),
      GroundTeleport3D: defineComponent('GroundTeleport3D', { x: t.num(), y: t.num() },
        { category: 'intent', describe: 'One-shot relocation on the walker itself, planar Transform metres. Applied at the next Input phase if the target has walkable support; otherwise rejected whole. Always consumed.',
          refine: v => validGroundTeleport(v as unknown as GroundTeleport3D) ? [] : [{ path: '', message: 'Teleport target must be finite planar metres', severity: 'error' }] }),
    },
    reads: ['GroundWalker3D', 'GroundSurface3D', 'GroundContact3D', 'GroundTeleport3D', 'Transform', 'Collider3D', 'Velocity'],
    writes: ['GroundContact3D', 'Transform', 'Collider3D', 'Velocity'], consumes: ['GroundTeleport3D'],
  },
  systems: [{
    id: 'ground-teleport-3d', phase: -20,
    // Same Input bucket as ground-init: explicit edge overrides the inferred
    // Collider3D/GroundContact3D back-edge so the pair never forms a soft cycle.
    runsBefore: ['ground-init-3d'],
    reads: ['GroundTeleport3D', 'GroundWalker3D', 'GroundSurface3D', 'Transform', 'Collider3D'],
    writes: ['GroundContact3D', 'Transform', 'Collider3D'], consumes: ['GroundTeleport3D'],
    execute: world => applyGroundTeleports(world),
  }, {
    id: 'ground-init-3d', phase: -20,
    reads: ['GroundWalker3D', 'GroundSurface3D', 'GroundContact3D', 'Transform', 'Collider3D'],
    writes: ['GroundContact3D', 'Collider3D'], consumes: [], execute: world => initializeGroundContacts(world),
  }, {
    id: 'ground-pre-3d',
    // Intent producers read Transform before setting velocity. Explicitly keep
    // them ahead of this opt-in constraint; existing worlds do not install it.
    // This is a constraint after Update intents/facts, like Resolve's ordinary
    // push-out. List existing planar readers explicitly so the new opt-in
    // writer cannot join the legacy full-registry SCC through Transform.
    // Detection of 3D contacts remains the one downstream Update consumer.
    runsAfter: ['accel-apply', 'aggro', 'bounce-relay', 'camera-follow', 'caster', 'clickable',
      'crowd-avoidance', 'drag-place', 'drop-zone', 'flow-field', 'grid-drag-square', 'hitbox',
      'launch', 'match3-drag-swap', 'merge-on-place', 'merge-proximity-clear', 'merge-rule', 'mortal',
      'motion-apply', 'nav-follow', 'navmesh-bake', 'overlap-detect', 'path-follow', 'pull-anchor',
      'queue-slots', 'self-rule', 'steering', 'tray', 'zone-occupancy'],
    runsBefore: ['overlap-detect-3d'],
    reads: ['GroundWalker3D', 'GroundSurface3D', 'GroundContact3D', 'Transform', 'Collider3D'],
    writes: ['GroundContact3D', 'Transform', 'Collider3D'], consumes: [],
    execute: world => groundPass(world, false),
  }, {
    id: 'ground-final-3d', phase: 21, // after Commit(20) bounds, before Cleanup(30)
    reads: ['GroundWalker3D', 'GroundSurface3D', 'GroundContact3D', 'Transform', 'Collider3D', 'Velocity'],
    writes: ['GroundContact3D', 'Transform', 'Collider3D', 'Velocity'], consumes: [],
    execute: world => groundPass(world, true),
  }],
});
