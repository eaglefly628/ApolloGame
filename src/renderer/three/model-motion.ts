import type { AnimState3D, FaceDir, Velocity } from '@engine/protocol/components.js';

/** The ground plane maps simulation (x,y) to Three.js (X,Z); glTF forward is +Z. */
export function modelYawFromFaceDir(dir: FaceDir, fallback: number): number {
  if (!Number.isFinite(dir.x) || !Number.isFinite(dir.y) || dir.x * dir.x + dir.y * dir.y < 1e-12) return fallback;
  return Math.atan2(dir.x, dir.y);
}

/** Turn through the shortest arc, including the -π / π boundary. Render-only. */
export function turnModelYaw(current: number, target: number, maxStep: number): number {
  const tau = Math.PI * 2;
  const delta = ((target - current + Math.PI) % tau + tau) % tau - Math.PI;
  return Math.abs(delta) <= maxStep ? target : current + Math.sign(delta) * maxStep;
}

/** Optional distance-matched clip playback; an idle unit pauses its walk cycle. */
export function modelMotionSpeed(anim: AnimState3D, velocity?: Velocity): number {
  const reference = anim.speedAtVelocity;
  if (reference === undefined || !Number.isFinite(reference) || reference <= 0) return anim.speed ?? 1;
  const vx = velocity?.vx ?? 0, vy = velocity?.vy ?? 0;
  const actual = Number.isFinite(vx) && Number.isFinite(vy) ? Math.sqrt(vx * vx + vy * vy) : 0;
  return Math.min(2.5, Math.max(0, (anim.speed ?? 1) * actual / reference));
}
