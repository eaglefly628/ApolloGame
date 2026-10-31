---
name: motion-match
description: Match explicit story constraints against Description-derived Apollo motion evidence, then author existing AnimGraph3D and Timeline data from verified candidate identities. Use for choosing existing character actions; composition and motion baking use the separate M6 pipeline.
---

# Motion matching

Read `docs/workflow/motion-production-line.md` for playback contracts. For M2/M4 selection use the shared source-evidence matcher, with an explicit current library (the None full-frame library is normally `~/ApolloAssets/motion-lib-full-frames`):

```sh
node scripts/motion-story-match.mjs dictionary
# For a pinned older library use: dictionary --version <snapshot dictionaryVersion>
node scripts/motion-story-match.mjs snapshot --lib <library-root>
node scripts/motion-story-match.mjs labels --lib <library-root>
node scripts/motion-story-match.mjs match --lib <library-root> --input <local-story-request.json>
```

Use the returned dictionary and snapshot binding to author the JSON request. The matcher does not interpret the natural-language `text`: translate the beat faithfully into explicit facet/value constraints, and disclose omissions or relaxed constraints. Unknown values remain pending vocabulary; do not silently substitute a convenient known tag. See `docs/design/ai-pipeline/motion-semantic-migration-and-match.md` for schema and examples; its sample story has a zero catalog SHA that must be replaced by the actual snapshot receipt. Keep the filled request and result outside Git. Honor the snapshot dictionary version; v2 review identities remain v2 even when a newer source dictionary is available. See `docs/design/ai-pipeline/motion-label-refinement-2026-10-31.md` for the version boundary.

Choose only returned `candidates` from the current catalog. Return source quotes, label status and unresolved constraints with the choice. `source-candidates-only` is a text-evidence proposal even when the underlying asset is confirmed. `needs-tag-review` has flagged evidence. Intent-only labels describe a stated goal or preparation, not execution; `intent-not-execution` gaps do not mean the library lacks a motion. Keep gazeDirection distinct from movement direction. Unknown forbidden conditions do not prove safety; required unknowns block default strict retrieval. `partialReferences` are incomplete references, never whole-beat matches. Preview the actual Skin × motion before asserting physical or visual suitability.

No candidates does not prove that the animation library lacks the movement. Distinguish `pending-vocabulary`, `no-source-evidence`, combinations not jointly satisfied, and separate scene/multi-character authoring. A known individual walk and a known individual run do not prove a clip containing both. M6 authoring suggestions are review tasks; this matcher never generates, bakes or registers a new motion. Scene effects and multi-character interactions are not covered by single-person hand IK.

The old `scripts/motion-match.mjs` remains a legacy lexical metadata lookup. Its category/emotion defaults and `requiresHumanConfirmation` are not source-label approval; prefer the new evidence path for story selection. `tools/motion-workbench/story-plan.mjs` is a historical text-reference view, not M4 semantic coverage. For catalog upgrades, use the explicit migration workflow in the linked document; do not delete a stale log or change its binding by hand.

Author only existing closed data for playback. Resolve the candidate file to the destination project's registered asset key; do not assume a local file path is an asset key. In `AnimGraph3D.clips`, set `asset` to that verified key, `clip` to the returned ID and `retarget: 'humanoid'`; preserve the catalog's loop intention. Internal graph aliases must satisfy `src/engine/protocol/components/anim-graph.ts`. Use actual states and transitions, and map graph parameters to `flag:<flagId>`. Schedule the same flags through existing `Timeline.cues` entries `{ at: <integer tick>, do: { kind: 'flag', flagId: <same id>, value: <boolean> } }`, using the project's configured tick rate. Check `src/engine/protocol/components/logic.ts` for the complete Timeline envelope. Reuse an available idle state when a cue must return to idle; do not invent an idle catalog clip.

Validate the resulting graph through `validateAnimGraph3D` and the project's data validation path. If the destination asset key, tick rate, initial state or return state is unavailable, make that dependency explicit before representing the result as playable. Preview the actual chosen Skin × motion in M3 and obtain the human confirmation required for draft labels and any proposed M6 bake. A metadata match alone does not validate retargeting, contacts or an animation's visual quality.

Queries are read-only; the evidence matcher also checks selected full/partial candidate asset SHA. Keep original FBX/GLB/texture files local; do not upload or use them for training. This skill does not authorize writing catalog labels, importing assets, baking a proposed composition, publishing, or messaging another chat.
