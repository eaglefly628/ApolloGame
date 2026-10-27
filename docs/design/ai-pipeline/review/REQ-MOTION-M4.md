# M4 independent review

Verdict: **PASS** for deterministic local metadata matching and the matching skill, 2026-10-27. Reviewer did not construct M4. No M4 implementation or skill repairs were made; only two authorized temporary withdrawal substitutions, restored byte-for-byte in finally. No docs/requests changes, commits, pushes, downloads or network operations.

## Scope and source inspection

Read CLAUDE.md (including session ownership/handoff), exact M4 spec in `docs/workflow/handoff-codex-motion-line.md`, `scripts/motion-match.mjs`, `scripts/motion-match.test.mjs`, `.claude/skills/motion-match/SKILL.md`, and the shared catalog contract previously inspected for M2.

The implementation validates catalog metadata and option vocabularies before matching; performs NFKC/case normalization and locale-independent word/Han-pair tokenization; gives fixed field weights and explicit per-token score reasons; intersects emotion/contact/category/duration filters; discards unrelated rows; orders by descending score then ASCII id; and returns explicit empty candidates. It reads catalog only. CLI unknown/duplicate/missing or malformed options reject before emitting candidate JSON.

## Independent reruns and adversarial evidence

- Focused original suite: **25/25 PASS**, exit 0. Log `/tmp/motion-m4-focused.log`.
- Independent standalone probes: `/tmp/motion-m4-independent-probes.mjs`; final log `/tmp/motion-m4-independent-probes-final.log`; exit 0.
- Exact score ledger reproduced independently: duplicated normalized query `ＲＥＡＣＨ reach` and duplicate appearances within tags yield one tag contribution (6) plus description contribution (3), score 9; source catalog byte representation unchanged.
- Reversed source row order produces identical candidate ordering and contents. Stable ties and top truncation keep full `totalMatches` count.
- Intersected filters exclude an otherwise matching angry row, preserve duration exactly 2.0s at maxDuration 2.0, and exclude all 2.0s rows at 1.999.
- Non-BMP Han characters produce adjacent Unicode code-point pairs (no broken surrogate terms).
- Real subprocess CLI run twice produces identical JSON stdout; successful matching emits a decision diagnostic to stderr; unrelated Chinese text emits empty candidate JSON, totalMatches 0, exit 0 and explicit reject diagnostic. Invalid top emits exit 1, empty stdout and reject diagnostic. Catalog bytes unchanged by subprocess calls.
- Existing original tests additionally reproduce locale independence under C and Turkish locales, word-boundary avoidance of `eat` matching `breathe`, Chinese normalization, draft/confirmed flags, invalid excluded metadata rejection and duplicate id rejection.

## Anchored withdrawal / restore

Constructor/root confirmed freeze before modification. Each exact anchor count asserted **1**, then targeted test run required nonzero exit; original bytes restored in finally and compared exactly. Log `/tmp/motion-m4-sabotage.log`.

1. `['tags', 6]` → `['tags', 0]`: exit 1. Exact score/ranking test reverses candidates from required `tagged, description` to `description, tagged`.
2. `row.durationS > options.maxDuration` → `row.durationS >= options.maxDuration`: exit 1. Filter intersection test loses exact-boundary candidate `yes` and returns empty.

Final restored original suite: **25/25 PASS**, exit 0, `/tmp/motion-m4-restored.log`. Independent subprocess probes repeated after restoration: PASS, exit 0.

## Warning and skill review

Original focused run has no stderr warnings or unexplained diagnostics. Independent CLI probes explicitly inspect expected decision/reject stderr and ensure JSON-only stdout. Withdrawal failures were assertion failures, not startup/parse failures.

Skill requires querying real local catalog before selection, choosing only returned IDs, reporting score reasons/mismatches and preserving draft confirmation status. It distinguishes registered asset keys from local paths; requests existing graph aliases/states/transitions and same flag IDs in graph params/Timeline integer tick cues; points to native validators and tick-rate dependency; requires actual Skin × motion preview for visual conclusions. It does not authorize catalog edits, imports, composition, publication or messages. Proposed M6 completion is explicitly separated from existing clips. No actionable M4 skill contract violation found.

## Limits

- Keyword matching is not semantic similarity or synonym inference; adjacent Han pairs do not make a one-character query a substring search. Skill states these boundaries and requires faithful explicit paraphrasing when appropriate.
- Metadata validation does not inspect motion/skin files or verify byte SHA values against assets; this is intentional for M4, which reads catalog metadata only. M2/ingest validation and registered asset resolution remain required.
- Ranking does not prove label accuracy, retarget quality, contact, or motion plausibility. Draft status remains a human proposal; actual playback/preview and destination asset registration remain separate.
- No actual Mixamo corpus matching, animation playback, M6 execution or full repository scoped gate is certified by this review. Root owns full gate/publication. Reviewer is also M6 constructor, so this independent PASS applies only to M4.
