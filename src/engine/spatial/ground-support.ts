import type { IWorld } from '../core/types.js';
import type { Collider3D, GroundContact3D, GroundSurface3D, GroundWalker3D, Transform, Velocity } from '../protocol/components.js';
import { sampleGroundSurface, walkGroundSurface } from './ground-surface.js';
import type { Contact3 } from './contact3d.js';

/** The actual contact must point from the named static support to the walker,
 * matching its currently covered triangle. Not a blanket per-hull exemption. */
function supported(world: IWorld, walkerId: string, supportId: string, nx: number, ny: number, nz: number): boolean {
  if (ny <= 0 || world.hasComponent(supportId, 'Velocity')) return false;
  const walker = world.getComponent<GroundWalker3D>(walkerId, 'GroundWalker3D');
  const contact = world.getComponent<GroundContact3D>(walkerId, 'GroundContact3D');
  if (!walker || !contact?.supported || contact.surfaceId !== walker.surfaceId) return false;
  const surface = world.getComponent<GroundSurface3D>(walker.surfaceId, 'GroundSurface3D');
  const transform = world.getComponent<Transform>(walkerId, 'Transform');
  const body = world.getComponent<Collider3D>(walkerId, 'Collider3D');
  if (!surface || !transform || !body) return false;
  try {
    const hit = sampleGroundSurface(surface, Math.round((transform.x + (body.offsetX ?? 0)) * 10000), Math.round((transform.y + (body.offsetZ ?? 0)) * 10000), contact.triangleId);
    if (!hit || !surface.supportIds[hit.triangleId]?.includes(supportId)) return false;
    const i = hit.triangleId * 9, p = surface.triangles;
    const ax = p[i + 3] - p[i], ay = p[i + 4] - p[i + 1], az = p[i + 5] - p[i + 2];
    const bx = p[i + 6] - p[i], by = p[i + 7] - p[i + 1], bz = p[i + 8] - p[i + 2];
    let ux = ay * bz - az * by, uy = az * bx - ax * bz, uz = ax * by - ay * bx;
    if (uy < 0) { ux = -ux; uy = -uy; uz = -uz; }
    const length = Math.sqrt(ux * ux + uy * uy + uz * uz);
    return length > 0 && (nx * ux + ny * uy + nz * uz) / length >= 0.999;
  } catch { return false; } // malformed live table is rejected by the ground system
}

export function isGroundSupportContact(world: IWorld, a: string, b: string, contact: Contact3): boolean {
  return supported(world, b, a, contact.nx, contact.ny, contact.nz)
    || supported(world, a, b, -contact.nx, -contact.ny, -contact.nz);
}

/** A permitted stair riser is a distinct rule from supporting-plane contact.
 * Before the foot centre crosses a low step, a finite-radius character already
 * touches its vertical side. Require forward intent, continuous ground all the
 * way across that footprint, and the actual obstacle's supported upper face. */
function stepContact(world: IWorld, walkerId: string, supportId: string, nx: number, ny: number, nz: number): boolean {
  if (ny < 0 || world.hasComponent(supportId, 'Velocity')) return false;
  const walker = world.getComponent<GroundWalker3D>(walkerId, 'GroundWalker3D');
  const contact = world.getComponent<GroundContact3D>(walkerId, 'GroundContact3D');
  const velocity = world.getComponent<Velocity>(walkerId, 'Velocity');
  const transform = world.getComponent<Transform>(walkerId, 'Transform');
  const body = world.getComponent<Collider3D>(walkerId, 'Collider3D');
  if (!walker || !contact?.supported || contact.surfaceId !== walker.surfaceId || !velocity || !transform || !body) return false;
  const surface = world.getComponent<GroundSurface3D>(walker.surfaceId, 'GroundSurface3D');
  if (!surface) return false;
  const length = Math.sqrt(nx * nx + nz * nz);
  const approach = velocity.vx * nx + velocity.vy * nz;
  if (length < 1e-8 || Math.abs(approach) < 1e-8) return false;
  const dx = -nx / length, dz = -nz / length;
  const reach = body.kind === 'sphere' || body.kind === 'capsule' ? body.radius ?? 0
    : body.kind === 'box' ? Math.abs(dx) * (body.halfX ?? 0) + Math.abs(dz) * (body.halfZ ?? 0) : 0;
  if (!Number.isFinite(reach) || reach <= 0) return false;
  try {
    const xQ = Math.round((transform.x + (body.offsetX ?? 0)) * 10000), zQ = Math.round((transform.y + (body.offsetZ ?? 0)) * 10000);
    const from = sampleGroundSurface(surface, xQ, zQ, contact.triangleId);
    if (!from) return false;
    const targetXQ = Math.round(xQ + dx * (reach * 10000 + 1)), targetZQ = Math.round(zQ + dz * (reach * 10000 + 1));
    // When walking away/down, the rear cap still touches the high riser after
    // the centre has descended. Validate the reverse connection using the
    // downward allowance, rather than injecting a spurious horizontal shove.
    const limit = approach < 0 ? walker.maxStepUpQ ?? 2500 : walker.maxStepDownQ ?? 5000;
    const reverseLimit = approach < 0 ? walker.maxStepDownQ ?? 5000 : walker.maxStepUpQ ?? 2500;
    const hit = walkGroundSurface(surface, xQ, zQ, targetXQ, targetZQ, from.heightQ, limit, reverseLimit, from.triangleId);
    return !!hit && hit.heightQ > from.heightQ
      && hit.heightQ - from.heightQ <= limit
      && !!surface.supportIds[hit.triangleId]?.includes(supportId);
  } catch { return false; }
}

export function isGroundStepContact(world: IWorld, a: string, b: string, contact: Contact3): boolean {
  return stepContact(world, b, a, contact.nx, contact.ny, contact.nz)
    || stepContact(world, a, b, -contact.nx, -contact.ny, -contact.nz);
}
