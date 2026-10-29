Motion review preparation — not production acceptance

Ownership: existing REQ-MOTION-M2 Codex lock; motion-semantics-next only.
Fixed external review target: 1b87a04d5d032b472cd789382a78c79895eb9c75.
Remote verdict verified with git show: 5ae0ee47698d7f9b8f0e78bbbe2d69a49b0fe553 records Claude PASS for the exact fixed SHA. Local auth is no longer a blocker for that completed review.
Contract is docs/design/ai-pipeline/motion-review-next-contract.md (not docs/workflow/...).
The fixed-commit review requirement is satisfied for that SHA only. A frozen shared dictionary public API and separate reviews remain required for persistence/approval/new M4 integration.

scenarios.json contains 12 synthetic boundary fixtures for future API adapters. Identity hashes are fake repeated letters; no real asset data. Entries are partial adversarial cases, not complete future API request envelopes.
Fixture JSON/count/unique IDs verified. M2 persistence and M4 new semantic matching are NOT implemented or accepted by these fixtures. Existing source/extra-tags tests rerun: 57 passed across 3 files. This does not replace external Claude review or full push gate.

Next after prerequisites: freeze shared facet/value queries, adapt fixtures to that exact API, implement sidecar append/recovery with synthetic temporary libraries, then shared effective-label projection and M4 consumption, each independently reviewed. No live-library write or implicit approval before those gates.

External review handoff already exists: docs/workflow/motion-review-handoff-2026-10-29.md. No duplicate fixed-SHA review is needed. New five-counterexample fixes remain independently unapproved; 67 related tests pass after five previously red counterexamples.

Mink ybot-v005 remains candidate-not-approved / needs-refinement; long-match visual prototype only. No Skill and no main-catalog publication.
