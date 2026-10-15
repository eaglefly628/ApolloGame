import type { CrowdAvoidance } from '@engine/protocol/components/crowd.js';

export const valid = (a: CrowdAvoidance): boolean => Number.isFinite(a.radius) && a.radius > 0 &&
  Number.isFinite(a.maxSpeed) && a.maxSpeed >= 0 &&
  (a.timeHorizon === undefined || (Number.isFinite(a.timeHorizon) && a.timeHorizon > 0)) &&
  (a.maxNeighbors === undefined || (Number.isSafeInteger(a.maxNeighbors) && a.maxNeighbors >= 1)) &&
  (a.neighborDistance === undefined || (Number.isFinite(a.neighborDistance) && a.neighborDistance > 0)) &&
  (a.yieldAfterTicks === undefined || (Number.isSafeInteger(a.yieldAfterTicks) && a.yieldAfterTicks >= 3)) &&
  (a.minRadiusScale === undefined || (Number.isFinite(a.minRadiusScale) && a.minRadiusScale > 0 && a.minRadiusScale <= 1)) &&
  (a.radiusStep === undefined || (Number.isFinite(a.radiusStep) && a.radiusStep > 0 && a.radiusStep <= 1)) &&
  (a.nudgeStrength === undefined || (Number.isFinite(a.nudgeStrength) && a.nudgeStrength > 0 && a.nudgeStrength <= 1)) &&
  (a.anticipatoryOffset === undefined || (Number.isFinite(a.anticipatoryOffset) && a.anticipatoryOffset > 0 && a.anticipatoryOffset <= 1)) &&
  (a.zeroEscape === undefined || typeof a.zeroEscape === 'boolean') &&
  (a.priorityMode === undefined || a.priorityMode === 'mass-stall') &&
  (a.desiredInertia === undefined || (Number.isFinite(a.desiredInertia) && a.desiredInertia >= 0 && a.desiredInertia < 1)) &&
  (a.flowGuide === undefined || (a.flowGuide !== null && typeof a.flowGuide === 'object' &&
    typeof a.flowGuide.fieldId === 'string' && a.flowGuide.fieldId.length > 0 &&
    (a.flowGuide.weight === undefined || (Number.isFinite(a.flowGuide.weight) && a.flowGuide.weight >= 0 && a.flowGuide.weight <= 1)) &&
    (a.flowGuide.repathDistance === undefined || (Number.isFinite(a.flowGuide.repathDistance) && a.flowGuide.repathDistance > 0)) &&
    (a.flowGuide.pathfindDistance === undefined || (Number.isFinite(a.flowGuide.pathfindDistance) && a.flowGuide.pathfindDistance > 0)) &&
    (a.flowGuide.releaseDistance === undefined || (Number.isFinite(a.flowGuide.releaseDistance) && a.flowGuide.releaseDistance >= 0
      && a.flowGuide.pathfindDistance !== undefined && a.flowGuide.releaseDistance < a.flowGuide.pathfindDistance)) &&
    (a.flowGuide.occupancyPenalty === undefined || (Number.isFinite(a.flowGuide.occupancyPenalty) && a.flowGuide.occupancyPenalty >= 0 && a.flowGuide.occupancyPenalty <= 4)) &&
    (a.flowGuide.pathfindPeriod === undefined || (Number.isSafeInteger(a.flowGuide.pathfindPeriod) && a.flowGuide.pathfindPeriod >= 1)) &&
    (a.flowGuide.edgeRepathSlots === undefined || (Number.isSafeInteger(a.flowGuide.edgeRepathSlots) && a.flowGuide.edgeRepathSlots >= 1)))) &&
  (a.debugVectorPrefix === undefined || (typeof a.debugVectorPrefix === 'string' && a.debugVectorPrefix.length > 0)) &&
  (a.debugVectorScale === undefined || (Number.isFinite(a.debugVectorScale) && a.debugVectorScale > 0)) &&
  (a.debugVectorY === undefined || (Number.isFinite(a.debugVectorY) && a.debugVectorY >= 0));

export function nudgeSide(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (Math.imul(hash, 31) + id.charCodeAt(i)) | 0;
  return hash & 1 ? 1 : -1;
}
