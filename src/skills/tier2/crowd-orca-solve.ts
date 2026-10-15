import { orcaVelocity, type OrcaAgent, type OrcaStats } from './orca.js';
import { nudgeSide } from './crowd-config.js';

/** Keep the low-speed retry inside the same ORCA solver and its collision constraints. */
export function solveCrowdVelocity(
  id: string, agent: OrcaAgent, neighbors: OrcaAgent[],
  preferred: { x: number; y: number }, desired: { x: number; y: number },
  maxSpeed: number, horizon: number, zeroEscape: boolean | undefined, stats: OrcaStats,
  anticipatoryOffset = 0,
) {
  // Bias the *preferred* velocity before ORCA, never the solved velocity. A larger
  // circle presents more clearance to cover, so it starts a stronger lateral arc.
  let steered = false;
  if (anticipatoryOffset > 0 && neighbors.length) {
    const speed = Math.sqrt(desired.x * desired.x + desired.y * desired.y);
    if (speed > maxSpeed * .25) {
      const forwardX = desired.x / speed, forwardY = desired.y / speed;
      let best = 0, side = 0;
      for (const other of neighbors) {
        const dx = other.x - agent.x, dy = other.y - agent.y;
        const forward = dx * forwardX + dy * forwardY;
        const radius = agent.radius + other.radius;
        const otherSpeed = Math.sqrt(other.vx * other.vx + other.vy * other.vy);
        const reach = horizon * (maxSpeed + otherSpeed) + radius;
        if (forward <= 0 || forward >= reach) continue;
        const closing = speed - (other.vx * forwardX + other.vy * forwardY);
        if (closing <= 0 && forward > radius) continue;
        const lateral = dx * -forwardY + dy * forwardX;
        const clearance = radius + agent.radius * .15 - Math.abs(lateral);
        if (clearance <= 0) continue;
        const strength = Math.min(anticipatoryOffset,
          anticipatoryOffset * clearance / Math.max(forward, radius));
        if (strength > best) {
          best = strength;
          side = Math.abs(lateral) > radius * .25 ? (lateral > 0 ? -1 : 1) : nudgeSide(id);
        }
      }
      if (best > 0) {
        const norm = 1 / Math.sqrt(1 + best * best);
        preferred = { x: (preferred.x - side * preferred.y * best) * norm,
          y: (preferred.y + side * preferred.x * best) * norm };
        steered = true;
      }
    }
  }
  let out = orcaVelocity(agent, neighbors, preferred, maxSpeed, horizon, 1, stats);
  const raw = { x: out.x, y: out.y };
  const rawSpeed2 = raw.x * raw.x + raw.y * raw.y;
  const desiredSpeed = Math.sqrt(desired.x * desired.x + desired.y * desired.y);
  let recovered = false, unresolved = false;
  if (zeroEscape && desiredSpeed > maxSpeed * .25 && rawSpeed2 < (maxSpeed * .08) ** 2) {
    const side = nudgeSide(id);
    let bestSpeed2 = rawSpeed2;
    for (const sign of [side, -side]) {
      const lateral = { x: -desired.y * sign, y: desired.x * sign };
      const candidate = orcaVelocity(agent, neighbors, lateral, maxSpeed, horizon, 1, stats);
      const speed2 = candidate.x * candidate.x + candidate.y * candidate.y;
      const forward = candidate.x * desired.x + candidate.y * desired.y;
      if (forward >= -maxSpeed * desiredSpeed * .02 && speed2 > bestSpeed2 + (maxSpeed * .12) ** 2) {
        out = candidate; bestSpeed2 = speed2;
      }
    }
    recovered = bestSpeed2 > rawSpeed2;
    unresolved = !recovered;
  }
  return { raw, out, recovered, unresolved, steered };
}
