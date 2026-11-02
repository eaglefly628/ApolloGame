# Animation cue → Signal v1

`AnimationCueSignals3D` is an authoritative data bridge, not a callback or a new
animation clock. It reads committed, validated same-actor source events only:
D1 notifies/completion, montage notifies/completion, explicitly calibrated gait
plant markers, and motor jump/land events. It does not infer contact from source
Description or replace completion with a timer. It does not adjudicate damage.

The config has `version:1`, explicit `maxSignalsPerTick` (1–256; normally author
256), and 1–64 bindings `{id,match,signal,arg?}`. `match` is a literal closed union:

- `base-notify {clip,cueId}` / `base-complete {clip}`
- `performance-notify {slot,montage,section?,cueId}` /
  `performance-complete {slot,montage}`
- `plant {foot:'left'|'right'}` / `jump` / `land`

Every reference is checked against the declared source config, including notify
existence and montage section interval. No undeclared source cue is accepted.
No source playback on its initial frame is normal; source config must exist.
A missing/replaced playback after observation, changed source identity, decreasing
or skipped source tick, or different snapshot at the same tick rejects the batch.
Pause/retrigger/seek use the source's actual event list and instances. Preview
seeks generate no synthetic cue. Signal IDs are deterministic reserved IDs:
`animation-cue:<URI-encoded actor ID>:<monotonic emission sequence>`.

The bridge playback saves exact canonical config + digest, actor ID, source
identity/tick/exact snapshot witnesses, sequence and owned event references. Saved
source witnesses are parsed and validated by their native source validators;
owned event IDs must occur in those witnesses and match their declared binding.
This is structural provenance, not a cryptographic signature against arbitrary
replacement of an entire World. A full JSON World restore reproduces IDs/events
and hash; the bridge contains no wall clock or renderer input.

## Two deterministic ECS delivery stages

1. Commit+4 (24), after D1 (21) and montage (23), publishes each current cue as an
   existing `Signal {name,source:actorId,arg?}` plus `AnimationCueSource3D` marker
   with `delivery:'pending'`. End-frame presentation services see the new cue.
2. Next tick, existing `event-when` at phase 0 may remove Signal. The bridge's
   queued-delivery phase 19 validates every pending marker, restores its identical
   Signal if absent, and marks it `delivered`. Existing effect-apply at 20 can now
   consume it. Already emitted cues are delivered even if animation is now paused
   or their owner was destroyed. No new animation time is sampled at phase 19.
3. Phase 24 validates and removes the old owned Signal/marker event entity before
   publishing the next current cues. End-frame presentation does not see the old
   redelivery. Consumers may remove Signal; its marker is still safely reclaimed.

This does **not** claim same-phase attack damage. The existing effect system runs
one fixed tick later and retains its existing Signal-name coalescing semantics.
Choosing two bindings with the same signal name does not change Effect into a
per-event hit counter. Combat consequences remain separate combat adjudication.
D6 preview still retains deterministic sim Signals during seeks while its existing
FrameServices mute external side effects.

## Ownership, bounds and atomicity

Each phase first stages all actors and all marker checks, then commits. Marker
entity IDs must match their actor/sequence namespace and exact payload. A live
owner's playback must list the matching reference. The event entity may contain
only Signal and its provenance marker; foreign components or a foreign Signal
cause rejection, never deletion. Forged playback cannot nominate a character ID
for cleanup. Destroyed owners' reserved event entities are reclaimed; reusing an
owner ID for an unrelated live entity rejects. New event ID collisions reject.

Static per-actor conservative bounds are checked at loading and every live plan:
once source notify/completion ≤1; loop source bound `floor(speed/durationTicks)+2`
per binding (speed zero gives 0); montage notify ≤2, completion ≤1; motor ≤1;
plant ≤64 per binding. Sum must fit `maxSignalsPerTick`; the whole World bound and
actual transient publication are capped at 4096. A conservative overestimate can
reject an otherwise quiet config; no event is silently truncated to fit.

Runtime limits remain checked for malicious/malformed raw writes. Atomicity is
per bridge phase batch. Phase-19 delivery and phase-20 effects may already have
committed if a later producer/phase-24 fails; ordinary World execution has no
whole-tick transaction. The D6 preview session's separate rollback boundary is
unchanged. Never describe this bridge as global World rollback.

All three bridge components are sim-owned. The provider has no user callback,
free expression, file I/O or renderer dependency. `DebugTrace` is optional, at
most one commit/reject record per bridge system per tick; no activity gives none.
