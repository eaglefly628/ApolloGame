# a4bef4211 integration independent review

Reviewer did not construct a4bef4211. Read CLAUDE.md including session ownership and the complete handoff. Worktree: /Users/junbaili/.codex/worktrees/motion-line/ApolloGame. No implementation edits, commits, pushes, source-asset changes, conversion batches or human receipts supplied by reviewer.

## Verdict

**PASS for the bounded tool integration and low-concurrency local conversion prerequisite.** The proposed batch wrapper has a separately reproduced stale-report defect that must be guarded before starting. After that guard, beginning a sequential resumable batch is supported by this review. This verdict does not mean full M2/M5 completion, human visual approval, or full-library compatibility.

## Independent execution

- Fresh focused Vitest execution across motion-library, match, variant, compose, preview, Blender bridge, character FBX/GLB, preview client/layout: **368 passed, 2 skipped, 10 files, exit 0**. /tmp/motion-release-a4-baseline.log. Initial accidental `node --test` invocation could not run Vitest fixtures; corrected to the actual Vitest runner. That invocation is not defect evidence.
- The two skipped cases were explicitly gated by MOTION_VARIANT_BLENDER, not silently ignored. Repeated variant suite with actual installed Blender: **23/23 passed, zero skipped, exit 0**. /tmp/motion-release-a4-native-variant.log. Uses synthetic fixtures, native mathutils and actual trim/mirror/loop-fix worker outputs accepted by the native engine.
- Real current library `motion-library validate`: **4 clips, 2 skins, exit 0**. /tmp/motion-release-a4-real-validate.log. Independent metadata read: all six rows remain draft. This is not 2445 converted clips or 108 standardized skins.
- Actual CLI subprocesses: compose with missing recipe, mutually exclusive variant operations and unknown ingest argument all reject with exit 1; compose/variant dynamic dispatch has no unsettled-top-level-await warning. Real catalog query with unrelated token returns JSON empty candidates and explicit reject, exit 0. Catalog hash unchanged throughout these probes.
- Original managed tree remains clean except the pre-existing untracked node_modules symlink. No source substitutions were made in it.

## Two fresh anchored withdrawals in an isolated commit snapshot

`git archive a4bef4211` extracted into /private/tmp/motion-a4-review; no real Mixamo binaries copied into it. Each anchor asserted exactly one match, modified in the private snapshot only, and restored byte-for-byte in finally. Harness: /tmp/motion-a4-mutations.py. Summary: /tmp/motion-a4-mutations.log.

1. Remove the existing-id requestSha256 consistency check. Existing changed-annotations test turns red: expected rejection becomes successful skip, exit 1. Restore: targeted test green, exit 0. Logs /tmp/motion-a4-mutant-1.log and /tmp/motion-a4-restored-1.log.
2. Remove preview HTTP per-request asset SHA comparison. Tampered-asset request returns 200 instead of required409, exit 1. Restore: targeted test green, exit 0. Logs /tmp/motion-a4-mutant-2.log and /tmp/motion-a4-restored-2.log.

These are actual semantic assertion failures, not parse/startup failures.

## Existing evidence inspected and limits

M2 report contains independent materials/IBM/FBX detached/default-axis checks and repaired full-turn counterexample. M4 report contains lexical score/filter subprocess checks and two withdrawals. M3 evidence describes actual 2-Skin ×3-action native renderer pilot and layout/lifecycle checks. M5 report covers local variants only. M6 covers synthetic and one real-asset numerical IK bake candidate with no publication/receipt. Those reports remain bounded; this review adds current integration reruns and does not relabel previous browser observations as newly independently viewed visuals.

Warnings/rejects read: expected ModelPool source translation/scale drops; explicit no-receipt candidate rejection; deliberate missing executable/SHA/symlink/unknown argument cases; intentional fake-Blender timeout and malformed-output rejections. No unexpected WARN/deprecated/unhandled/unsettled messages in current focused or actual variant logs. Historical Y Bot DCC user-property Short warnings and the exact Blender Release Candidate build remain documented in M2; green execution does not certify arbitrary custom-property preservation.

## Batch wrapper finding (outside a4 commit)

Inspected /private/tmp/apollo-motion-batch.py. Single process, 40-entry groups, exclusive runner lock plus converter ingest lock, existing-library preflight validation, missing-id selection and 20GiB free-space guard support controlled resumption without overwriting source FBX. Failed items are retained separately. Existing catalog entries must be validated before skipping.

**Reproduced blocking wrapper issue:** if ingest fails before writing last-ingest-report.json, wrapper accepts exit1 and reads the previous batch's old report, potentially counting false success. Concrete evidence /private/tmp/motion-stale-report-8l320j02: pre-existing ingest.lock, prior successful report listing previous-batch; real ingest requested idle-breathing exits1 EEXIST; previous report bytes unchanged. Root notified with evidence. Required guard: before counting, ingested + skipped + rejected IDs must be unique and exactly equal requested batch; exit code/report.ok consistency must hold; invalid or missing report stops. Initialization should also sit inside lock-cleanup try so metadata read failure cannot strand runner.lock.

The wrapper is not part of the reviewed commit. Root owns its fix. This report permits the technical conversion step once that guard is in place. Keep all annotations draft, preserve originals, do not auto-sign M6 preview or visual quality, retain rejection reports, validate the resulting full catalog, and report exact converted/failed/remaining counts. Frame resampling fidelity, semantic label quality, contacts, target-device rendering and full108/2445 completion are not certified here.

## Frozen wrapper independent recheck

Root repaired the stale-report issue without reviewer implementation edits. Final wrapper SHA256: `4b842bb95871ee822210054177b5f63d67819677a18d5ac2ca6cf059f4ba0462`. Extracted the exact frozen guard block and independently executed seven cases with actual temporary report files: stale unchanged report, wrong IDs, duplicate IDs, process-status mismatch and rejection-status mismatch all stop; valid success and valid per-item rejection both proceed. Initialization is within the cleanup try/finally. /tmp/motion-a4-runner-check.py and /tmp/motion-a4-runner-check.log, exit0. Source/annotation hashes are checked per batch; runner and before-catalog snapshots retained; non-complete exits nonzero.

**Final start decision: YES, low-concurrency local batch may start.** Keep the existing independent validation and failure separation. This approves running conversion, not acceptance of all resulting assets. Pausing during subprocess execution can leave the converter's ingest lock; inspect child processes before clearing/restarting. No automatic stale-lock deletion or concurrent writer was approved.
