import { t } from '../../core/schema.js';
import { LOCOMOTION_STATES } from '../../animation/locomotion-driver.js';
const n = t.num, s = t.str;
const clip = t.obj({ asset: t.asset('animation'), clipName: s(), loop: t.bool(), durationTicks: n(), sourceSha256: s(), motionSpace: t.lit('in-place'), sync: t.enum(['gait', 'free']) });
const node = t.union([t.obj({ kind: t.lit('clip'), clip: s() }), t.obj({ kind: t.lit('blend2d'), space: t.enum(['standing', 'crouched']) })], 'kind');
const state = t.obj({ node, minTicks: n(), interruptible: t.bool(), restartOnEnter: t.bool(), onComplete: t.enum(['stay', 'motor', ...LOCOMOTION_STATES]) });
const space = t.obj({ samples: t.arr(t.obj({ id: s(), clip: s(), xQps: n(), yQps: n() })), triangles: t.arr(t.obj({ id: s(), vertices: t.arr(s()) })) });
const marker = t.obj({ id: s(), phaseQ: n(), foot: t.enum(['left', 'right']), kind: t.enum(['plant', 'lift']) });
const gait = t.obj({ version: t.lit(1), id: s(), referenceStrideDistanceQ: n(), markers: t.arr(marker), members: t.rec(t.obj({ durationSubticks: n(), markers: t.arr(t.obj({ id: s(), atSubtick: n() })), strideDistanceQ: n(), sourceSha256: s(), calibrationStatus: t.lit('reviewed'), provenance: s() })) });
const phase = t.obj({ version: t.lit(1), configCanonical: s(), phaseQ: n(), cycle: n(), remainder: n(), instance: n(), started: t.bool() });
const playback = t.obj({ version: t.lit(1), configCanonical: s(), tick: n(), lastFactsSeq: n(), lastCommandSeq: n(), paused: t.bool(), state: t.enum(LOCOMOTION_STATES), stateTicks: n(), stateInstance: n(), nextInstance: n(), seenJumpInstance: n(), seenLandingInstance: n(), lastStance: t.enum(['standing', 'crouch-in', 'crouched', 'crouch-out']), stopLatched: t.bool(), cursors: t.rec(t.obj({ timeSubticks: n(), cycle: n() })), weightsQ: t.rec(n()), gait: phase, distanceAdapter: t.opt(t.obj({ version: t.lit(1), configCanonical: s(), referenceRemainderMicroQ: n(), discardedDivisionSteps: n(), tick: n() })) });
const event = t.obj({ id: s(), groupId: s(), instance: n(), cycle: n(), markerId: s(), phaseQ: n(), kind: t.lit('plant'), foot: t.enum(['left', 'right']) });
export const LOCOMOTION_SCHEMAS = {
    LocomotionDriver3D: t.obj({ version: t.lit(1), tickRate: n(), localAxes: t.obj({ up: t.lit('Y'), forward: t.lit('+Z'), lateral: t.lit('+X') }), stridePolicy: t.enum(['normalized-reference', 'weighted-measured']), thresholds: t.obj({ moveEnterQps: n(), moveExitQps: n(), turnEnterUnits: n(), turnExitUnits: n() }), clips: t.rec(clip), states: t.obj(Object.fromEntries(LOCOMOTION_STATES.map(id => [id, state]))), spaces: t.obj({ standing: space, crouched: space }), gait }),
    LocomotionPlayback3D: t.obj({ version: t.lit(1), playback, events: t.arr(event) }),
    LocomotionCommand3D: t.obj({ version: t.lit(1), commands: t.arr(t.union([t.obj({ seq: n(), op: t.lit('pause') }), t.obj({ seq: n(), op: t.lit('resume') }), t.obj({ seq: n(), op: t.lit('preview-seek'), state: t.enum(LOCOMOTION_STATES), tick: n(), phaseQ: n(), cycle: n() })], 'op')) }),
} as const;
