import { orcaVelocity, type OrcaAgent, type OrcaStats } from './orca.js';
import { nudgeSide } from './crowd-config.js';

/** Keep the low-speed retry inside the same ORCA solver and its collision constraints. */
export function solveCrowdVelocity(
  id: string, agent: OrcaAgent, neighbors: OrcaAgent[],
  preferred: { x: number; y: number }, desired: { x: number; y: number },
  maxSpeed: number, horizon: number, zeroEscape: boolean | undefined, stats: OrcaStats,
) {
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
  return { raw, out, recovered, unresolved };
}
