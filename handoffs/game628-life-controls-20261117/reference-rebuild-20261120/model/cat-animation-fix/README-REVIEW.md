# Game 628 · V4 living cats and domestic variation

Local candidate assets, frozen after producer checks. No gameplay AI, walking, new runtime system, host/renderer/scene/UI edits, commits or pushes. V3 and all older assets remain intact.

## Final runtime files

All below: `handoffs/game628-life-controls-20261117/public/art/reference-rebuild-20261120/scene/`.

| File | Final SHA256 |
|---|---|
| street-reference-v4.glb | `9830230781952c079e73431b693855d51e6f742a8774ddcd7259890e959d7381` |
| cat-sleep-idle.glb | `f147f747f498ef114d5cddb0a78118d93b152e7147ad3c06f2e3d07daaab8b33` |
| cat-ginger-idle.glb | `491591600080d9ae7a594c628b22aa746b0a64b704177611d84aa15203609db4` |
| cat-floor-idle.glb | `1ade7b4ce39fa70416ac2b5f79e527fba0b45c88e1d6e1a3f3157f622e9d35f4` |

`scene-contract-v4.json` provides three independent cat entities, clips and placement. `variation-plan-v4.json` is the runtime-side record of the consumed offline variation input; no new runtime interpreter is required.

## Three cats: original shapes, actual idle clips

The three source cats' original body/head/ears/eyes/nose/paws/tail geometry was extracted from the editable V3 source, not redesigned. Each cat retains10 rigid mesh parts. No humanoid/Mink retargeting was used; this is rigid-node glTF animation consumed by the existing generic `AnimState3D`/AnimationMixer path.

| Cat | Entity position X,Y,Z | Euler rotation | Scale | Clip / loop duration |
|---|---|---|---|---|
| sleeping white | 4.97,.615,-.12 | 0,0,0 | 1 | cat_idle /8s |
| ginger on upper platform | 4.98,1.785,-.4 | 0,0,0 | 1 | cat_idle /7.2s |
| cream on pavement | 5.25,-.002,.68 | 0,0,0 | 1 | cat_idle /9s |

Body breath scales only the torso about its lower belly anchor. Head turns/nods around an embedded neck pivot. Eyes blink about their own centers. Ears flick gently about embedded bases; the short original tail sways about its base. The root and both paw nodes have **no animation channels**, and paw ancestors are static. No whole-cat bob or root translation. Different cycle lengths/event times avoid synchronized mechanical motion.

`idle-audit-summary.json` evaluates the actual exported glTF LINEAR and quaternion-slerp tracks at120Hz:961/865/1081 samples. Every paw vertex stays fixed (maximum displacement0); loop endpoints match. Maximum moving-vertex displacement is16.6/40.3/56.8mm. Neck, ear and tail anchor samples remain inside their host convex body/head surfaces at every sample (worst signed outside distance about-18mm). This anchor check is not an exhaustive self-intersection proof.

`cats-blender-playback-report.json` separately verifies actual Blender GLB import/playback fromframe0 to41 at30fps. All three show nonzero mesh motion, paws remain fixed and support heights match. `v4-cat-idle-frame0.png` / `v4-cat-idle-frame72.png` show actual imported animation poses in the rebuilt shop and were viewed. These are offline diagnostic images, not Apollo screenshots; the parent owns runtime playback acceptance.

Ground contact is measured at the actual paw vertices, not the root. `cat-floor-support-report.json` independently raycasts final V4 street triangles: lowest paws lie atX5.13000011/5.36999989,Z.81. They meet the pavement's45° front bevel atY-.00200002728; pawY-.002 differs by only2.73e-8m. The body-rootXZ(5.25,.68) instead lies over a flat tile atY0. A root ray is not the feet contact measurement. The platform paw heights remain .615 and1.785. Rounded bodies keep the existing small hidden resting overlap instead of hovering.

## Static scene removal and variation

Static V4 removes30 original cat objects /912 original cat triangles, preventing double cats behind the animated entities. Chalkboard cat graphics intentionally remain. `variation-build-report.json` records removed source names and exact preservation of2419 untargeted source objects' world geometry/material names. Ground-floor shops, exterior walls/window proportions, tree, pavement and runtime lighting are not redesigned by this update.

Five room recipes now differ: grocery gardening/potting bench/seed shelves; bakery dining table/chairs; noodles reading chair/bookcase/tea table; cat cafe sofa/cushions/coffee table; repair workbench/tools/pegboard/stool. The room recipes and15 furnishing roots are explicit data. Existing wall/window geometry is retained: low furniture can be partly hidden by the0.78m sill and railing from street-height cameras; nearer/higher views reveal more. This update does not claim that every item is fully legible from every wide camera.

Twenty-three roof/balcony planter slots (12roof,11balcony) vary count, rectangular/round body, pot color, broadleaf/herbs/shrub/flower/vine plant type, scale and purposeful yaw. `variation-plan.json` fixes seed6281120 and persists every slot, its support height, root range, scale range[.85,1.15] and yaw jitter range±12°. Semantic chair orientations can face the table; they are not arbitrary random rotation. Roof supportY6.715, balconyY4.0, room floorY3.22. Pot bodies remain inside rail bounds; vines have a connecting stem before their intentional overhang. The generator consumes this data offline, with no engine/gameplay changes.

Two newly detected furniture contacts were corrected before final freeze: garden seedlings gained short stems, and sofa pillows were lowered onto the cushion. No other beautification was added after that correction. `v4-domestic-variation-strip.png` shows the actual final imported roof/balcony/window compositions and was viewed.

`static-v4-reimport-report.json`: actual final GLB reimport,167 meshes /114,632tri, zero boundary edges after analysis-only1µm welding and zero degenerate triangles. Separate closed-part intersections/hidden caps remain intentionally separate; this is not a Boolean watertight union claim. No original static-cat material mesh groups remain.

## Reproduction and boundaries

- `variation-plan.json` is the canonical editable input; `create_variation_plan.py` reproduces its persisted default plan.
- `prepare_static_v4.py` reads the unmodified V3 detailed source, exports original cat parts, removes selected old domestic decorations and static cats, consumes the variation plan, verifies untargeted objects and saves `reference-street-source-v4.blend`.
- `build_idle_cats.py` generates the three node-animation GLBs from `cat-source-parts.json`; `audit_idle_cats.py` independently evaluates their actual streams.
- `finalize_static_v4.py` merges semantic material groups, removes zero-area faces and exports staticV4 plus the scene contract. `reference-street-final-v4.blend` is the compact editable output.
- `reimport_v4_visual.py` performs independent actual GLB import/playback/topology checks and generates diagnostic images. `check_cat_floor_support.py` checks paw support against actual street triangles.

All scripts/images/sources/reports stay under this isolated `cat-animation-fix/` folder; runtime GLBs/contracts are in the assigned scene directory. No shared renderer, runtime control, old K assets, background assets or character assets were altered. Clips are local art candidates, not autonomous pets or finished cat gameplay. Full-body surface collision at every microdetail and every rear/underside static contact have not been exhaustively inspected; final art and runtime presentation acceptance remain with the parent/user.
