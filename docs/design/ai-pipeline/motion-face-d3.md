# FacePose3D — named native morph interface v1

This is a render-only authored interface, not generated lip sync, emotion inference,
or evidence that an existing Mixamo Skin contains facial morphs. Missing actual
model channels are unsupported. No asset or review status is upgraded.

`FacePose3D` has `version:1` and `channels`, a closed alias table (1–64 entries).
Each channel is `{mesh,morph,weight}`. Mesh and morph are exact case-sensitive
native glTF names. The selected model must contain exactly one named Mesh and
that Mesh must expose the named `morphTargetDictionary` index and influence array.
Two aliases cannot address the same mesh/morph pair. No bone fallback is allowed.

Weight is either a finite number in `[0,1]` or:

```json
{"source":"performance-slot","slot":"upper","points":[{"atTick":0,"value":0},{"atTick":10,"value":1}]}
```

Points number 1–128, have strictly increasing integer ticks in `[0,10000000]`
and values in `[0,1]`. Sampling is linear between points and clamps endpoints.
Ticks are **section-local `cursorTick`**; section startTick is not added. Each
incoming and frozen outgoing montage source samples the curve at its own cursor
and contributes `sample * weightQ / 1000000`. The two are summed, not sampled
at only the incoming time. Cycle wraps naturally reuse the local curve. Pause,
seek, JSON replay and loops read the same validated playback; no wall clock or
simulation state is advanced. Playback actorId/config identity must match.
A defined but inactive slot gives zero. A first-frame config without playback
also gives zero and is re-evaluated next frame. Playback without config rejects;
a curve referencing an unknown slot in a supplied config rejects.

A channel overrides that morph's final native influence. Other morph indices
remain as sampled by the base/native animation. The interface does not add an
implicit neutral face or normalize unrelated channels.

`FacialAnimationPool` lifecycle:

1. `prepare(instance)` on each fresh clone **before native clipAction bindings**.
   It copies influence arrays once per instance; geometry/material stay shared.
2. `beginFrame(instance)` before any base/native animation. This is required even
   after FacePose3D removal, to restore values captured before the prior face pass.
3. Sample base/native animation and skeletal overlays.
4. `apply(instance,{actorId,face,performance?,playback?})`. It validates all channels
   and bindings before writing any influence. Repeated apply is idempotent. It
   never starts a mixer or reads or writes a World.
5. On model replacement/removal, `clear(instance)` restores the latest pre-face
   base and drops active face ownership. A weak preparation cache preserves array
   identity if the same model returns, so native bindings never point at old arrays.
   `dispose()` clears all active instances. Do not retain
   stale asynchronous writes; this helper is synchronous.

Results are `{status,channels,diagnostics}`. Missing model instance gives `loading`;
loaded model with missing/ambiguous mesh or missing morph gives `rejected` with
`unsupported-mesh`/`unsupported-morph`. Correct binding without an active source
is `ready` with zero weight, not permanent loading. Data, actor or binding mismatch
rejects atomically. A rejection does not silently replace morphs with skeleton poses.

Synthetic tests include actual GLB loading of a two-target morph triangle and a
native weight animation. That is technical evidence only; real facial content,
visual expression quality and automated lip sync remain outside this interface.
