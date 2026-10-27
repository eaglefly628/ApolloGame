---
name: motion-match
description: Match a script beat to the local Apollo motion catalog and author AnimGraph3D and Timeline flag data from returned candidates. Use for choosing existing character actions; composition and motion baking use the separate M6 pipeline.
---

# Motion matching

Read `docs/workflow/motion-production-line.md` for the standard skeleton and closed vocabularies. Query the actual local catalog before choosing a motion:

```sh
node scripts/motion-match.mjs "奶奶伸手接住她" --emotion tender --contact right-hand --max-duration 5 --top 5
```

The default library is `~/ApolloAssets/motion-lib`; `--lib <directory>` selects another library and `--catalog <file>` selects a metadata fixture or catalog directly. Optional `--category` uses the documented category vocabulary. Filters intersect; they do not give unrelated text a relevance score. Search matches normalized words and adjacent Chinese character pairs; it does not infer synonyms or the meaning of a whole scene. For an empty result, try an explicit faithful paraphrase or fewer optional filters, and report the changed constraints. Empty candidates remain an explicit no-match result.

Choose only a returned candidate ID. Explain the choice using its returned descriptions, score reasons, duration, emotion and contacts, plus any mismatch with the beat. Preserve `status`: a draft is a proposal requiring human confirmation, even when ranked first. Matching does not upgrade annotations or certify their accuracy. If the nearest returned candidate is incomplete, describe the missing movement separately and propose the future M6 completion recipe; do not describe a proposed composite as an existing clip, create a fake ID, or claim composition/baking has run. If there are no candidates, do not invent a nearest candidate.

Author only existing closed data for playback. Resolve the candidate file to the destination project's registered asset key; do not assume a local file path is an asset key. In `AnimGraph3D.clips`, set `asset` to that verified key, `clip` to the returned ID and `retarget: 'humanoid'`; preserve the catalog's loop intention. Internal graph aliases must satisfy `src/engine/protocol/components/anim-graph.ts`. Use actual states and transitions, and map graph parameters to `flag:<flagId>`. Schedule the same flags through existing `Timeline.cues` entries `{ at: <integer tick>, do: { kind: 'flag', flagId: <same id>, value: <boolean> } }`, using the project's configured tick rate. Check `src/engine/protocol/components/logic.ts` for the complete Timeline envelope. Reuse an available idle state when a cue must return to idle; do not invent an idle catalog clip.

Validate the resulting graph through `validateAnimGraph3D` and the project's data validation path. If the destination asset key, tick rate, initial state or return state is unavailable, make that dependency explicit before representing the result as playable. Preview the actual chosen Skin × motion in M3 and obtain the human confirmation required for draft labels and any proposed M6 bake. A metadata match alone does not validate retargeting, contacts or an animation's visual quality.

Queries read local metadata only. Keep original FBX/GLB/texture files local; do not upload or use them for training. This skill does not authorize writing catalog labels, importing assets, baking a proposed composition, publishing, or messaging another chat.
