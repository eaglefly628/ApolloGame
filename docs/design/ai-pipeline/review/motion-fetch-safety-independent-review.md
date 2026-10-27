# M5 download safety independent review — final

Final verdict: **PASS for the isolated fake-service download safety patch**, after the constructor repaired the independently reproduced diagnostic and path-alias failures. Independent reviewer made no implementation repairs; two temporary sensitivity substitutions were restored byte-for-byte in finally. Review takes place only in isolated archive `/private/tmp/motion-m5-fetch-safety-svw798yn`; no real Mixamo requests, no real token/credential reads, no motion-line or asset-library changes, no commits.

Read CLAUDE.md earlier in this session, root's exact safety task, isolated patch, implementation and tests. Constructor freeze confirmed before review. Original isolated archive is based on12283e5ad; source patch covers only mixamo-fetch.mjs/test.mjs. Isolated dependencies are shared read-only symlink; follow-up review test config explicitly sets private `/private/tmp/motion-m5-fetch-review-vite-cache` to avoid shared Vite cache writes.

## Baseline evidence

`node /Users/junbaili/Documents/GitHub/ApolloGame/node_modules/vitest/vitest.mjs run --config m5-vitest.config.mjs`: **50/50 PASS**, exit0. `/tmp/motion-fetch-safety-focused.log`.

Independent program `/tmp/motion-fetch-safety-independent-probes.mjs`; log `/tmp/motion-fetch-safety-independent-probes.log`. Global fetch is disabled; client uses only in-process fake fetch responses. A clearly synthetic credential sentinel is defined in the probe, never obtained from environment/browser/files. All output paths are disposable `/tmp` trees and dummy repositories.

- All **18** combinations of401/403/429 × primary/search/product/export/monitor/download stop at the failing request; no later entry or retry. Primary checked through client StopError; remaining phases through runFetch stopped result. No files downloaded on stop.
- Normal successful path: synthetic credential only in API Authorization, not CDN headers; no credential in normal logs or manifest.
- Constructor tests independently passed direct and CLI limit rejection,40export ceiling,39injected waits each4000ms, resume SHA behavior, repository alias rejection, and expected reject diagnostics.

## Originally reproduced blockers (repaired and independently rechecked)

### P1: final download path can write into a repository

Physical output check is only at run preflight.

1. Fake download-stage callback replaces the initially external outDir with a symlink to a temporary dummy repository (marked by a `.git` file). runFetch reports `downloaded:['first']` and writes first.fbx inside the repository. Probe log `publicationRaceWritesRepository:true`.
2. Simpler static alias case: external outDir remains a normal directory, but first.fbx is pre-created as a symlink to dummy repository/owned.txt. Successful fake download overwrites owned.txt with fake FBX and reports success. Probe log `outputFileAliasOverwritesRepo:true`.

No real repository/asset data is targeted. Constructor notified that final file paths and manifest temporary paths need protection, not only initial outDir or a post-request directory recheck.

### P1/P2: provider error diagnostics can echo credential

Fake monitor response `{status:'failed',message:'provider diagnostic '+syntheticCredential}`. waitJob embeds raw provider message into Error; runFetch writes it verbatim to console.warn and result.failed.error. Probe log `providerDiagnosticCredentialLeak:true`. Normal path nonleak test does not cover this error path. Constructor owns repair; reviewer did not sanitize implementation.

## Final frozen repair recheck

Constructor repaired only the isolated implementation/test files and froze them again. Final patch `/private/tmp/motion-m5-fetch-safety.patch` SHA256 **0f830757222f034fed99c2a214d0e136a1d1601f7f84eaebd78e81cadbba0c58**.

- Final implementation SHA2561798688c04dea94da15ec23c0d3dc1f27e2165b3ea4bd0df10bc09df5a30ed1c.
- Final test SHA2563819466aa5393d9986c692aae79f8e7a312fba60b757ed79c10ee5eb1451740b.
- Independent fixed suite **60/60 PASS**, exit0, `/tmp/motion-fetch-safety-fixed-focused.log`.
- Independent final restored suite **60/60 PASS**, exit0, `/tmp/motion-fetch-safety-restored.log`, using `m5-review-vitest.config.mjs` with private cacheDir. Initial50baseline used constructor's initial config; all repair/withdrawal/restored review runs used the private cache.
- Own fake-service probes re-run after repair and after restoration:18stop-phase combinations PASS; normal credential/header handling PASS; provider diagnostic, thrown transport and JSON exception credential-leak booleans allfalse; asynchronous root swap, static output file alias and manifest temporary alias repository-write booleans allfalse; no successful download recorded for the rejected alias cases. Assertions require those booleans false. `/tmp/motion-fetch-safety-final-independent.log`.
- Constructor suite additionally checks static aliases at all four named writes (`first.fbx`, `first.fbx.tmp`, `manifest.json`, `manifest.json.tmp`) and body-reader/CLI primary transport diagnostics. Original victim contents unchanged in every alias regression.
- Separate independent default-timer probe uses the production default wait (no injected wait function): first export completes, second remains blocked on exactly4000ms scheduled timer callback; only after callback release does second export run. `/tmp/motion-fetch-default-delay-probe.mjs`, `/tmp/motion-fetch-default-delay-final.log`.
- Direct API and CLI both invoke the same max/delay checks before unsafe limits reach requests/output creation. Limits1..40; integer delay4000..2147483647 avoids native timer overflow collapsing an oversized delay to≈1ms. Tests reject0/2000/3999/NaN/Infinity/fractions/overflow and over-limit40; valid41-entry run performs40exports and39waits each4000ms.
- Physical output checks now repeat at publication, reject repository/alias changes for final and temp files, use exclusive temp writes, and atomically rename local entries. Error output uses controlled stage/HTTP descriptions; credential-bearing remote/transport/body diagnostics are omitted.

## Independent uniquely anchored withdrawal

Only isolated `/private/tmp/.../scripts/mixamo-fetch.mjs` was temporarily modified; each exact anchor count asserted **1**, original bytes restored in finally and verified byte-for-byte. Both substitutions differ from constructor's API/CLI guard-removal self-checks. Log `/tmp/motion-fetch-safety-sabotage.log`.

1. Remove the download-stage401/403/429 StopError branch: exit1, all3status cases fail. Logs demonstrate a later entry is attempted and `stopped` remains null, proving tests exercise immediate whole-run stopping rather than only error reporting.
2. Replace `const message = publicFailure(e, stage);` with raw `e.message`: exit1, provider echo test exposes the clearly synthetic test credential in result.failed.error and fails privacy assertion.

After both checks: source hash matches final frozen implementation,60/60restored tests PASS, own probes PASS. Constructor notified restoration before any further source use.

## Warning review and boundaries

Expected reject/stop/path/privacy diagnostics were inspected; no unexplained warnings or real service errors were hidden. Synthetic strings in intentional red-test failure output are test constants, never real credentials. Global fetch was disabled except explicit in-process fake responses; no browser, credential file or environment token was read. No active motion-line source/asset library was modified, and no commit/push performed.

This PASS establishes fake-service safety for tested CLI/direct API limits, normal and diagnostic credential handling, all six request stages, and tested static/asynchronous output aliases. It does not certify a real Mixamo request or current server API/authorization behavior. Spacing applies to exports; it is not a claim that every search/poll/HTTP request waits4seconds. Root owns applying the isolated patch and its full project gate.
