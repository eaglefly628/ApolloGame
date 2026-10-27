# M6 independent review

Reviewer did not implement M6. Review scope: `scripts/motion-compose.mjs`, `scripts/lib/motion-compose-{recipe,runtime,engine,glb}.mjs`, the M6 tests, the closed-data spec and CLI integration.

Verdict: **PASS for the tested offline synthetic implementation after CLI integration corrections**. This does not sign off human preview, real Mixamo / target Skin motion quality, contact plausibility or all production gates.

## Independent execution

- Shared M6 baseline: 9/9 PASS, exit 0. Full output `/tmp/motion-m6-independent-baseline.log`.
- Isolated suite with one reviewer-authored corruption test: 10/10 PASS, exit 0. Corrupt a sampled Hips translation in baked GLB by 0.1 m; `verifyBake` must reject the baked/runtime mismatch.
- The tests exercise native retarget, native IK/Attach3D/target resolver, flag cue timing and fade, moving attached targets with local offsets, a differently sized transformed Skin, all-joint exported playback position/orientation equivalence, byte-identical original source, preview-only vs receipt publication, provenance, draft status, invalid/no-op/self-chasing recipes and filesystem escapes.
- Unknown fields/getters/cycles/numeric budgets are guarded by the closed recipe path; the implementation imports the existing engine solver rather than adding a second IK solver.

## Two isolated removal checks

Files were copied into a private directory; no production implementation was edited for mutation. Each anchor was asserted to occur exactly once.

1. Remove `check(maxPositionError<1e-5&&maxRotationError<1e-5,...)` in `verifyBake`: exit 1, the new corrupted-bake assertion fails because the corrupted output is accepted.
2. Replace `if(!reviewedPreviewSha){` with `if(false){`: exit 1, existing preview-only test fails because the unreviewed candidate publishes.
3. Restore original implementation: 10/10 PASS, exit 0.

Evidence directory: `/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/motion-m6-review-rjq7stye/`; files `baseline-plus-independent.log`, `bake-verification.log`, `preview-receipt.log`, `restored.log`, plus `source-hashes.json`.

## Reproduced integration defects, corrected by root

- Initially `motion-library compose --recipe ...` rejected `--recipe`, because the main entry had no compose dispatch. Root added the dynamic dispatch.
- Then a concrete top-level-await cycle occurred: library CLI awaited the dynamic compose/variant module, while those modules imported `libraryPath` from the still-evaluating library module. Node reported `Detected unsettled top-level await`. Root changed the bottom CLI launch to `void main().then(code=>{process.exitCode=code;});`.
- Independent post-fix commands now reach their actual subcommand and reject missing recipe/library with exit 1; neither emits the unsettled-await warning. This confirms both M6 and M5 dispatch paths load successfully.

## Review hygiene correction

The test `recipe()` returned the same global `annotations` object. The invalid-field test added `annotations.free` and polluted subsequent valid test cases. A newly appended independent case first reproduced `annotations has unknown fields`; resetting that incidental shared state made the new case pass. At root's explicit request the reviewer changed only the fixture return field to `annotations:structuredClone(annotations)`. This is test isolation, not a change to M6 production logic. Follow-up run is recorded in `/tmp/motion-m6-hygiene-restored.log`.

## Warnings read

- `[ModelPool] decision ... 33 source tracks dropped` is expected under M1: non-Hips translation and scale tracks are intentionally excluded from humanoid retarget. The 2× Skin fixture reports hip scale 2.000; others report 1.000.
- Unreviewed preview, duplicate output/id, source SHA mismatch, symlink escape and unknown CLI field produce expected rejection logs.
- The native self-chasing controlled-subtree warning is intentionally captured by its test, which asserts exactly one warning and the specific message. It is not silently ignored.
- No unexpected solver warning was present in the full captured baseline.

## Limits

The equality gate covers sampled joint world positions and orientations at the declared FPS. Intermediate-time interpolation, visual skin deformation, collisions, actual hand/foot contact and human plausibility are not independently certified. Published metadata remains `draft`, and the preview receipt is an explicit human assertion bound to the recipe hash. Real asset preview and final project-wide gates remain with the root workflow.

## Actual local asset pilot (no human receipt, no publication)

At root's explicit request, ran the real local `idle-breathing` clip (Breathing Idle) against the ingested Y Bot Skin `4f5d21e1-4ccc-41f1-b35b-fb2547bd8493`, with one native right-arm two-bone IK target and a bounded 1-second target trajectory. The closed recipe uses 30 FPS and 31 sampled frames; no Blender or alternate IK solver is involved.

- Recipe: `/Users/junbaili/ApolloAssets/motion-lib/.recipes/review-real-idle-ybot-right-hand-20261027.json`.
- Recipe SHA: `cc09b6aad564b9958e6c98af545e514c50cec7ef56498762545956e13d8044e3`.
- Candidate: `/Users/junbaili/ApolloAssets/motion-lib/.compose/review-real-idle-ybot-right-hand-20261027/cc09b6aad564b9958e6c98af545e514c50cec7ef56498762545956e13d8044e3/candidate.glb`.
- Native-vs-baked playback maximum joint error: **5.824576339718465e-8 m**, **9.993094612644669e-8 rad** over **31 frames**, both below 1e-5 thresholds.
- Source clip SHA: `73d6c558aa783a494f34125dfb6c8c3dd69643c636fe0c453d50c9587d090d66`.
- Y Bot Skin SHA: `3fbd12662e08cecdf8fa8a79ce66266f1bdd1f86a515a64c5e5307520a48dc45`.
- Real chain reports 65 shared bones, hip scale 1.000, and the expected 129 discarded non-Hips translation/scale tracks (64 + 65).
- Result `ok:true, published:false`; the unreviewed-preview rejection is expected. No reviewed-preview SHA was supplied.
- Catalog byte hash unchanged, both source asset hashes unchanged, and no `clips/review-real-idle-ybot-right-hand-20261027.glb` was published.
- Numerical pilot does not approve motion/contact plausibility or visual deformation. That remains for human preview.

Evidence: `/tmp/motion-m6-real-candidate-report.json`, `/tmp/motion-m6-real-candidate.log`, and the candidate's adjacent `evidence.json`. M6 review now includes one successful actual local-asset numerical chain in addition to synthetic tests.
