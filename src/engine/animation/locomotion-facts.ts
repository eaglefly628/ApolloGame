/** Fixed-tick accepted movement projection shared by motor and animation.
 * +X lateral, +Z forward; Q10000 meters, Qps per second. No visual input.
 */
export interface LocomotionMotorFacts {
 readonly seq:number;
 readonly localLateralQps:number;readonly localForwardQps:number;
 readonly acceptedDistanceQ:number;readonly desiredSpeedQps:number;
 readonly mode:'grounded'|'rising'|'falling';
 readonly stance:'standing'|'crouch-in'|'crouched'|'crouch-out';
 readonly yawErrorUnits:number;readonly jumpInstance:number;readonly landingInstance:number;
}
