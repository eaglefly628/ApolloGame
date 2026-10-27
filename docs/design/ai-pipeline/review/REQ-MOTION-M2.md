# M2 final compatibility independent review

Final verdict: **PASS for M2 code/compatibility and the small real pilot technical validation**, after constructor repaired the independently reproduced full-turn classification regression. Static-Skin materials/IBM, disconnected FBX subtrees, one-key constants and declared constant-axis compatibility pass. No reviewer implementation repairs, commits or pushes. This is not full-library conversion, human preview or full repository gate acceptance.

Reviewer independent from M2 constructor. Reviewed shared managed worktree and latest source freezes coordinated with motion_m2. Read CLAUDE.md, M2 spec and full relevant source/test deltas. Scope: `character-fbx.mjs`, `character-glb.mjs`, static-Skin `measureSkin`, new measurement v2, Blender worker clip naming, and actual local real-asset ingestion outputs. No real binaries copied to repository.

## Reproduced finding (repaired; independent recheck below)

`/tmp/motion-m2-turn-probe.mjs` creates a synthetic standard skeleton / marked carrier clip, 31 normalized quaternion samples at30fps: Hips performs a complete360° rotation, no translation. `measureMotion` returns `rootMotion:'none'`, `loop:true`, `inPlace:true`, although `maxTurnRadians=3.1415926535897927`. Endpoint heading difference `netTurnRadians≈1.1e-15` loses the full turn. Log `/tmp/motion-m2-turn-probe.log`. Expected rootMotion `turn`; change must preserve meaningful angular motion even when final orientation matches initial. Constructor repaired classification using maximum heading excursion; reviewer did not modify implementation. The independent original reproduction now returns turn. Historical failure evidence is preserved in the original log; fixed result is `/tmp/motion-m2-turn-probe-fixed.log`.

## Independent focused runs

- First material/subtree frozen state: three test files motion-library, character-glb, character-fbx **202/202 PASS**, exit0, before and after withdrawal. Logs `/tmp/motion-m2-final-focused-before.log`, `/tmp/motion-m2-final-focused-restored.log`.
- Latest constant/default-axis and measurement-v2 frozen state: same three files **209/209 PASS**, exit0. Log `/tmp/motion-m2-final-new-focused.log`. This green result does not cover the independent full-turn counterexample.
- Independent adversarial program `/tmp/motion-m2-final-adversarial.mjs` exits0. Log `/tmp/motion-m2-final-adversarial.log`.

## Actual real assets through native engine

Independent program `/tmp/motion-m2-final-real-engine.mjs`; latest log `/tmp/motion-m2-final-new-real-engine.log`.

- Idle original FBX SHA0ece42b3a33f218c22b0e8af0618b47dbb5ee6933fd4e298358c48aa119dd876 verified against catalog provenance. FBX7700: 315curves,159connected,156unbound,1unbound subtree,47,541active samples,9.933333333s. Disconnected exporter data excluded from active duration.
- YBot original FBX SHA77ee683804e899d9c75ab924df6bc920958351acf3845dfca309e36205fc73cd verified,1,982,368bytes.
- Converted idle GLB843,636bytes, SHA73d6c558aa783a494f34125dfb6c8c3dd69643c636fe0c453d50c9587d090d66,30fps299frames. Latest v2 measure rootMotion none/inPlace true/loop true; net horizontal8.78e-9m, while retained diagnostic max sway0.121296m. Metadata refreshed by constructor, GLB SHA unchanged.
- Converted YBot GLB2,198,844bytes, SHA3fbd12662e08cecdf8fa8a79ce66266f1bdd1f86a515a64c5e5307520a48dc45;65bones,35,434vertices,55,320triangles; hip0.9979195m, rest height≈1.804735m; T-pose and inverse-bind checks pass.
- Original YBot GLB default strict character validation still rejects its extension; only static-Skin material opt-in accepts it. Actual geometry/material/node topology loaded using native engine GLTFLoader; CPU image-decode override was installed defensively but textureRequests=0, so no image pixels were stubbed in this actual asset.
- Native `captureSkeletonRest` valid; independent world×inverse-bind matrix maximum identity error1.0943434e-6. Native `bindSkeletalClip(...,'humanoid')` produces66tracks for65shared bones, hip scale1.000, logs129intended dropped source translation/scale tracks.
- Native AnimationMixer evaluated0,.25,.5,1,and clip endpoint; all65joint world positions/quaternions finite at each. Technical compatibility only; no visual pose/contact approval.
- Whole local library validate at latest run: **4clips+2skins**, exit0. This is the small actual pilot; no full2445-action/108-Skin claim.

## New constant-axis compatibility strictness

Independent synthetic positive and negative cases verify: one-key constants alongside positive-duration playback; zero-duration rejects; missing source→CurveNode axis only accepted with finite exact Number property default; undeclared/unknown axes, Infinity defaults, default colliding with active axis, and wrong Number type reject. Unbound malformed increasing-time/finite-value checks remain active. Synthetic disconnected subtree whose unused20s keys coexist with1s connected playback reports1s and only2active samples.

Actual Reaching Out original validates with39declared constant-default links,159connected curves,156unbound,2,777active samples,4s. Actual walking validates with3one-key constants,159connected curves,156unbound,5,931active samples,1.233333s. Source hashes independently match provenance. These proofs concern supported structure and actual engine output validation; they do not claim source FBX interpolation equivalence under Blender resampling.

## Anchored withdrawal evidence

After constructor freeze, before root's current full gate, two exact anchors count asserted1; tests required nonzero exit; both files restored byte-for-byte in finally. Source no longer modified by reviewer. Log `/tmp/motion-m2-final-sabotage.log`.

1. `const materials = new Set(allowSkinMaterialExtensions ? value.materials ?? [] : []);`→empty Set: static specular opt-in test fails, exit1, reproduces real-Skin incompatibility.
2. Skip detached curve-node subtree branch disabled: test fails, exit1, active samples inflate2→8, active duration1→20s, connected curves1→4. This demonstrates exclusion is exercised.

Both anchors remain present in latest source. Root's full gate was running when latest constant/default-axis changes froze, so reviewer has not made further source mutations during that gate.

## Warnings and version evidence

- Focused suite expected reject diagnostics reviewed, no hidden unexpected warnings.
- Retained actual idle Blender job log has no warning lines. YBot actual Blender job log contains **65** `WARNING: User property type 'Short' is not supported` messages. They concern dropped FBX user-property metadata; this review establishes native geometry/bone/rest/bind compatibility, not preservation of arbitrary source custom properties. Warnings are explicitly retained, not erased by a green exit.
- Exact actual binary evidence `/private/tmp/motion-m2-blender-export-properties.log`: **Blender5.2.3 LTS Release Candidate**, hashfab76e95306d, built2026-10-21. Do not call this a verified stable4.5 build or omit Release Candidate.
- Actual5.2 ACTIVE_ACTIONS exporter default merged clip name is Animation; worker now explicitly passes clipId into `export_nla_strips_merged_animation_name`. Real idle output name matches id and passes native engine gate. Independent reviewer validated existing outputs and retained DCC evidence, not a second independent full Blender conversion invocation.

## Acceptance limits

Static-Skin opt-in only admits KHR_materials_specular at material locations; motion/default validator remains strict. Unknown/geometry extensions, malformed factors/declarations, animated opt-in and hidden remote image dependencies reject in independent probes. IBM identity ignores mesh-node transform per glTF Skin semantics; independent ignored mesh transform case passes and corrupted IBM rejects.

Material pixels, human preview, contacts, skin interpenetration and full library completeness remain separate. The full-turn classification issue above was repaired and independently rechecked; it no longer blocks this bounded technical PASS. Root owns full gate and publication. Reviewer is M6 constructor, so this independent report applies to M2 only.


## Final independent recheck of the full-turn repair

After the final constructor freeze, no further source substitutions or implementation edits were made, to avoid disturbing root's final gate.

- Original independent full360° counterexample: **PASS**, now `rootMotion:turn`, `inPlace:true`, `loop:true`; net heading≈1.1e-15 and maximum excursionπ retained as diagnostic values. `/tmp/motion-m2-turn-probe-fixed.log`.
- Additional independent angular cases in `/tmp/motion-m2-turn-boundaries.mjs`: positive360°, negative360°,720° all classify turn;179°→181° (2° across the branch cut) classifies none;170°→190° (20° across branch cut) classifies turn; zero rotation classifies none. All six assertions PASS, exit0. `/tmp/motion-m2-turn-boundaries.log`.
- Final same three focused suites: **210/210 PASS**, exit0 (41motion-library,61character-fbx,108character-glb). `/tmp/motion-m2-final-turn-fixed-tests.log`.
- Independent material/IBM/disconnected subtree/default-axis strictness program repeated after the turn repair: PASS, exit0. `/tmp/motion-m2-final-adversarial.log`.
- Real idle/YBot technical probe and whole pilot validation repeated after repair: **PASS**, exit0. `/tmp/motion-m2-final-turn-fixed-engine.log`. Same source/output SHAs as above; idle remains none/inPlace/loop, so recovering full turns does not regress the fixed breathing-sway case. Whole local library remains4clips+2skins; native retarget still65shared bones/66tracks; independent inverse-bind error remains1.094e-6; five sampled poses finite; zero actual texture decode requests.
- Existing two anchored withdrawal checks remain documented above, each unique count1 and restored byte-for-byte; their anchors are unchanged in final source. No additional withdrawal was run concurrently with root's final gate.

Remaining limits: rootMotion/inPlace are bounded heuristics (net horizontal endpoint displacement, maximum heading excursion, vertical excursion threshold), not general semantic proof. Reported loop status is a first/last-pose threshold test, not a visual loop-quality guarantee. The small real pilot does not establish2445-action or108-Skin completeness. Human Skin×motion preview, material appearance/contact quality, source-vs-resampled motion fidelity and root's full repository gate remain outside this independent technical PASS.
