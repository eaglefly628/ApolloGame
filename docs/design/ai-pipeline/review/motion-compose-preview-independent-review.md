# Unpublished M6 candidate preview — independent review

Verdict **PASS for the isolated review helper and CLI integration**. Reviewer did not implement `scripts/lib/motion-compose-preview.mjs`, `scripts/motion-compose-preview.test.mjs`, or the new CLI option. Reviewer constructed the separate M3 bounds/framing correction and does not self-approve that correction here.

Frozen tree `/Users/junbaili/.codex/worktrees/motion-compat/ApolloGame`. Read root's helper and tests and full CLI branch. Helper constrains evidence to the library's canonical `.compose/id/recipeSha/evidence.json`; validates closed recipe, source/candidate SHA, numerical verification metadata/frame counts, actual native clip/Skin structure; creates a separate local `preview` library with hard links and a draft review catalog. No main catalog/ingest-lock/receipt mutation, clip publication or status confirmation. Browser playback remains the existing native preview path.

## Independent execution

- Existing four synthetic actual native-bake/helper tests: **4/4 PASS**, exit0. `/tmp/motion-compose-preview-independent-focused.log`. Covers no receipt/publication/lock changes, idempotent existing review, changed recipe/source/candidate/evidence rejections, canonical evidence path, evidence/output symlink escapes, no catalog overwrite/status upgrade.
- Five real CLI subprocess rejection probes: receipt option forbidden, missing candidate value, duplicate candidate option, duplicate library option and unknown executable option. All exit1 with usage and no server URL. `/tmp/motion-compose-preview-cli-check.py`, `/tmp/motion-compose-preview-independent-cli.log`. No credentials, network downloads or alternate download paths.
- Actual existing Mixamo-derived unreviewed candidate prepared idempotently through the frozen helper. Recipe SHA cc09b6aad564b9958e6c98af545e514c50cec7ef56498762545956e13d8044e3; preview library `/Users/junbaili/ApolloAssets/motion-lib/.compose/review-real-idle-ybot-right-hand-20261027/cc09b6aad564b9958e6c98af545e514c50cec7ef56498762545956e13d8044e3/preview`. New candidate row remains draft/reviewOnly, no reviewedPreviewSha and no main `clips/<candidate-id>.glb`. Existing base and Skin source rows unchanged. Source/candidate byte SHAs before/after match:
  - base73d6c558aa783a494f34125dfb6c8c3dd69643c636fe0c453d50c9587d090d66
  - Skin3fbd12662e08cecdf8fa8a79ce66266f1bdd1f86a515a64c5e5307520a48dc45
  - candidate2b9b5658f880e9d370aac9bf7a438a4dc7c55b91e7bfe97fec43c4ccc4b079ba
- Real probe `/tmp/motion-compose-preview-independent-real.mjs`, log `/tmp/motion-compose-preview-independent-real.log`, exit0. Active batch may append unrelated main catalog rows, so this review compares existing source rows and candidate absence rather than falsely claiming the main catalog stayed globally byte-identical during batch work. Synthetic isolated tests do assert full catalog bytes and an existing lock unchanged.

## Two fresh independent anchored withdrawals

Only helper/test copied into separate `/private/tmp/motion-a4-review` snapshot. Neither compat frozen helper nor active tree changed. Each exact anchor asserted unique count1, removed, and restored byte-for-byte finally.

1. Remove source-entry SHA equality guard: changed-base-evidence case is accepted, test turns red exit1; restored green exit0.
2. Remove measured/evidence/recipe frame equality guard: wrong verification frame count is accepted, test turns red exit1; restored green exit0.

Harness `/tmp/motion-compose-preview-independent-mut.py`, summary `/tmp/motion-compose-preview-independent-mut.log`, `/tmp/motion-compose-preview-independent-{red,restored}-{1,2}.log`. Semantic assertion failures, not startup errors.

## Warning and acceptance limits

Expected native retarget dropped-track decisions and explicit unreviewed-candidate/review-only diagnostics read. No unexpected WARN/Unhandled/unsettled lines. This helper validates candidate structure plus existing numerical evidence; it does not independently recompute the full IK/runtime equivalence, approve contact/plausibility, verify rendered materials or sign a human preview receipt. These remain separate from merely displaying an unpublished candidate. This review supplies no human approval and does not authorize publication. Root owns full repository gate and independent M3 browser framing acceptance.
