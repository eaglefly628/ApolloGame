# D4 deterministic planar Root Motion · pure core contract

This batch adds `root-motion.ts`, its tests, and a standalone protocol module. It does not register components or modify renderer/physics/assembly. The production host must pair `RootMotion3D` with `RootMotionSource3D`, validate actual clip references/bytes and commit motor + root playback + animation atomically. Existing motor AABB work is a separate integration batch; slopes/steps remain a D2 gap.

## Data and asset pairing

- Q=10000 metres, Y-up, +Z forward; positive yaw turns toward +X, 65536 units/turn. Root samples contain cumulative XZ and **unwrapped** signed yaw from an explicit zero sample through an explicit duration endpoint. Y/gravity/jump belongs to motor. No scaling from render, mesh compensation, or second addition of root translation.
- Config binds original `sourceSha256` and paired **root-removed** `inPlaceClipSha256`. Pure validation checks declarations; the trusted loader must verify actual selected motion bytes/paired extraction envelope. D1 graph lacks SHA, so renderer must check its existing motion digest against the latter; sim must not read renderer or live bones. These declarations are not extraction/retarget/loop quality approval.
- `hips-linear-xz-v1` explicitly means Hips carrier, Y retained in bones, zero root yaw, and mathematically linear XZ samples. It matches the existing `motion-planar-root.mjs` policy after explicit Q/time quantization. This batch does not change that tool or invent real curved extraction. `root-bone-xz-yaw-v1` declares a separately extracted root-bone curve; an author/tool must actually produce its pair.
- Curve 2..256 samples, duration 1..36,000,000 subticks, tickRate1..240, coordinate each axis ±100,000,000Q, unwrapped sample yaw ±1,048,576. `limits` bound per-request Euclidean XZ length (≤100,000,000Q), absolute yaw delta (≤65536) and cycle crossings1..32. Excess rejects, never truncates.
- `once` accepts its explicit terminal duration endpoint (the authoritative source clock clamps; out-of-range core input rejects); repeat cursors use `subtick<duration`, endpoint belongs to the next cycle at subtick0. Each loop accumulates its full SE2 translation/yaw; a turning clip rotates the next cycle's displacement. Loop accumulation is a mathematical policy, not skeletal seam approval.

## APIs and authority

`createRootMotionPlayback(config, actorId, instance, cursor?, driverTick=0)` is explicit activation. Instance1..1e9 must be newly allocated by the authoritative source on replay/retrigger; an existing state never accepts a changed actor or instance. No module cache, clocks, randomness, callback or World writes.

`proposeRootMotion(config, previous, input)` returns `{playback, request}`. `input` is actorId/instance/epoch, driverTick, authoritative cursor `{cycle,subtick}`, mode `'advance'|'seek'`, actual accepted body pose `{positionQ:{x,z},yawUnits}`, optional sim anchor. `driverTick===lastDriverTick+1`; root config tickRate must equal Engine and source driver rate. Host maps the **same tick's planned/committed** source clip cursor (1000 subticks/tick, speed-adjusted by that driver), not an independently incremented root counter. `RootMotionSource3D.driver` chooses exactly `{kind:'animation-driver',clip}` or `{kind:'performance-slot',slot,clip}`; `warpAnchorId` is an optional sim entity. Shape validator does not resolve real references. Host must reject missing/ambiguous/blended root authorities rather than average unrelated root streams.

Advance returns a pending state whose consumed cursor/lastDriverTick remain unchanged until accepted. Stable request shape:

```
{ requestId, actorId, instance, epoch, driverTick,
  deltaQ: { x, z }, yawDeltaUnits }
```

ID binds lifecycle, source/pair SHA, from/to cursor, source body pose, anchor and desired delta; JSON snapshots contain all pending inputs. `validateRootMotionPlayback` recomputes pending request from config and its base state, rejecting forged projection. Proposed request and returned playback are independent data copies.

`acceptRootMotion(config, pendingPlayback, feedback)` requires matching requestId/actor/instance/epoch/driverTick and a real pending request. Feedback is `{acceptedDeltaQ,acceptedYawDeltaUnits,blocked}` plus those identities. No pending or double consumption rejects. Accepted norm cannot exceed requested norm or configured request budget, cannot point opposite desired displacement, and accepted yaw must preserve sign/magnitude budget. Exact accepted request requires blocked=false; any difference requires blocked=true. This is a trusted physics feedback seam, not a geometric collision proof: core does not authenticate a caller's claim that a cast happened. Host must supply actual motor acceptance, not renderer/LLM data.

Commit advances the root cursor even when blocked. Lost integer displacement is discarded; blocked results also clear fractional remainder. There is no catch-up/anchor chase next tick. Actual pose is retained and must match the next input, preventing an independent location stream. Surface response, stand/jump, gravity, support and collision events remain motor-owned.

Seek returns request=null, rebases cursor, increments epoch, clears warp/fractional remainder/feedback and leaves body pose stationary. Repeating/skipping driver ticks or backward advance rejects; use explicit seek. Seeking into the interior of an unbound warp window cannot resume its alignment: restart at window start or restore the matching authoritative snapshot. Rollback restores complete JSON state and re-emits identical deterministic request/feedback on resim; it is not seek-with-side-effects-muted. Pause may either not call this core or submit the unchanged source cursor on the next real sim tick; no root displacement is manufactured.

## Fixed precision and warp

Existing `yaw-fixed.yawDirectionQ` supplies the same interpolated Q1e6 basis as motor/yaw; no new trig. Curve translation is interpolated with BigInt into micro-Q (1Q/1e6), yaw into integer units. Products use BigInt with symmetric nearest rounding, then signed division truncates world delta to integer Q and preserves the ±999999 micro-Q remainder in playback. This avoids per-tick integer loss at 30/60Hz. The checked-in basis has its existing bounded interpolation error; not exact trigonometry. There is no new universal visual/contact precision claim. Physics must not round accepted displacement to a different hidden mesh path.

Once-only warp window declares start/end subticks and max Euclidean translation/yaw correction. The exact start cursor must be visited. Entering with a leap across start, missing target, changed frozen anchor, correction overflow or per-tick delta overflow rejects atomically. Anchor `{id,positionQ:{x,z},yawUnits}` must come from the named authoritative sim entity, never a render socket pose. At window start snapshot source body pose and anchor; predict unwarped endpoint, distribute bounded XZ and shortest-turn yaw correction by absolute window progress. Translation alignment is fixed to that start snapshot, so facing correction does not secretly rotate the remaining root path. Requests after window use accepted body yaw. Blockage does not recompute residual to force the endpoint. No runtime warp of arbitrary loops, dynamic chasing target, vertical warp or physics bypass is claimed.

All three `ROOT_MOTION_SCHEMAS` are real `t.obj` closed structural schemas with no `t.any`; optional absent pose/warp/pending/lastFeedback avoid permissive null fields. Strict pure validators enforce fields, integer budgets and request projection. No aggregation/hash exclusion/provider changes in this batch: root/source/playback must participate in deterministic snapshots when the host connects them.
