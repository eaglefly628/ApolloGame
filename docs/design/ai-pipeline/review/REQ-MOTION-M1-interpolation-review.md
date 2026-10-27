# M1 independent review of STEP repair

Verdict: PASS for the bounded M1 interpolation repair described below. This is not a full project gate, real asset visual acceptance, or arbitrary curve exactness verdict.

Reviewer independent from current constructor (root lock7836f06c0). Reviewed shared managed worktree `/Users/junbaili/.codex/worktrees/motion-line/ApolloGame`, 2026-10-27. Read CLAUDE.md including session handoff section, original review request, previous STEP reproduction, complete skeletal-clips.ts and implementation/test diff. No implementation changes made.

## Evidence

- Original prescribed four files independently run: 94/94 tests PASS, exit 0. Includes protocol validation, loader/model graph integration, strict default, and retarget tests.
- Original prior independent STEP reproduction now PASS. Exact logged midpoint angular error: **0 rad** (old failure 0.30942166227627776 rad).
- Additional independent adversarial tests: 5/5 PASS. Synthetic artifact includes original reproduction for 6 total tests: `/tmp/motion-m1-independent-synthetic.ts.txt`.
- STEP rotation and hip holds: sampled 0, 1e-8, 0.5-1e-8, 0.5, 0.5+1e-8, 1-1e-8, 1, 1.1 with LoopOnce and clamped endpoint; source versus target with scale 1.7, differing per-bone rolls, extra target-only UpperChest inserted between Chest and Neck. All 17 shared world rotations satisfy 1e-4 rad bound; hips 1e-5 position bound. UpperChest has no generated track and retains its own rest local rotation while participating in parent chain.
- Inverse mixed property modes tested: homogeneous LINEAR rotation plus independent STEP hips, including key boundary and endpoint. Existing constructor test covers homogeneous STEP rotation plus independent LINEAR hips.
- Strict default preserves per-track mixed STEP/LINEAR interpolation; opt-in humanoid rejects it and emits one reject warning.
- Cubic rotation and cubic hips factories rejected before sampler invocation; smooth hip rejected. All three expected warnings asserted, without concealing unexpected warnings.
- Equal sample count with unequal actual times rejected.
- Final restored run across original four files + independent artifact: **100/100 PASS, exit 0**, no stderr warnings or property-binding warnings. Expected reject warnings are explicitly spied/asserted by tests. Original prior repro emits the expected zero-error stdout only.

## Independent withdrawal / sabotage

Both substitutions assert anchor occurrence count exactly 1, run tests, and restore source bytes in `finally`. Source was verified restored byte-for-byte before notifying constructor. Detailed evidence: `/tmp/motion-m1-sabotage.log`.

1. Remove rotation output interpolation argument (`Array.from(values.get(name)!), rotationMode))`): exit 1, 2/6 independent tests fail; prior reproduction returns **0.30942166227627776 rad**, and boundary STEP Hips error **0.2499999775 rad**.
2. Change hip output from `hipMode` to `rotationMode` (`Array.from(hipValues), hipMode))`): exit 1, independent LINEAR rotation / STEP hip case fails with position error **0.12160389207152793**.

These anchors differ from initial construction self-tests and previous independent world-parent/hip-track sabotage.

## Scope and remaining limitations

- PASS means homogeneous STEP rotation holds are preserved, Hips retains its own STEP/LINEAR mode independently, strict default remains unchanged, and unsupported cubic/smooth or mixed rotation modes fail explicitly during binding. No new per-frame retarget path is introduced; output remains ordinary AnimationClip tracks.
- This is a binding-time key bake. Do not claim arbitrary source curve exactness. Source-only animated intermediaries can compose rotations into nonlinear curves; this review does not establish continuous equivalence for arbitrary differing source/target hierarchy under LINEAR interpolation.
- Cubic/smooth and mixed STEP/LINEAR rotations require offline normalization in M2. M1 rejection is deliberate; no silently sampled approximation is accepted for these modes.
- Existing rest stance, alignment, animated hip-parent approximation and extreme-proportion/IK limitations continue to apply.
- No real Mixamo assets downloaded or exercised by this review; no visual two-Skin claim. No new 300-frame/60-bone benchmark run (repair adds binding-time checks and preserves runtime representation).
- Full scoped gate is handled independently by root. This PASS must not be reported as full-gate PASS.
- The existing review document still contains historical FAIL and legacy wording; constructor must append the repaired review outcome and bounded interpolation contract before delivery. I did not edit root-owned docs/requests.

## Cleanup

Temporary `src/renderer/three/skeletal-retarget.review.test.ts` removed after exact content check against retained /tmp artifact. No M2 files, docs, requests, git commits or pushes touched. Initial unprivileged Vite run hit EPERM writing its generated config under managed worktree; authorized escalated reruns above executed successfully. An initial setup invocation used unavailable `python`; corrected to `python3`, no source mutation occurred in failed invocation.
