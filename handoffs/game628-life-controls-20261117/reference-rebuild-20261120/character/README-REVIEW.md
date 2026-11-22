# Game 628 · reference characters and actual local motion reuse

Local study, no source-library edits, no shared runtime/renderer edits, no commit/push. Original geometry is authored for this study; library source Skin/FBX files are not copied. Derived GLBs contain local Mixamo-library motion and are not registered as distributable approved assets.

## Deliverables

Use `public/art/reference-rebuild-20261120/character/traveler-v2.glb` and `shopkeeper-v2.glb`. `character-contract-v2.json` records final SHA, sources, clips, dimensions and nominal speed. `build-character-v2.mjs` reproduces the original geometry and local motion adaptation; `check-character.py` reopens the final GLBs and verifies source rotations/finite data, clips and sampled contacts.

Both face +Z, Y-up, use scale 1, and reach approximately 1.737m including cap in rest geometry. Traveler has muted green clothing/backpack; shopkeeper has cream sleeves and green apron. All clothing/face/hat geometry is original rigid segmented low-poly construction, parented to an inherited humanoid hierarchy. It is not a newly weighted deforming skin or a final character art approval.

## Real library sources

Read-only catalog: `/Users/junbaili/ApolloAssets/motion-lib-full-frames/catalog.json`. Source titles and SHA are pinned in the contract.

|Output clip|Actual source|Duration|Use|
|---|---|---|---|
|idle|idle-breathing / Breathing Idle|9.933333s|Breathing stand|
|walk|walking-100460901 / Walking|1.4s|One happy walking cycle, adapted in place|
|wave|waving-106100901 / Waving|4.733333s|Greeting gesture|

All 65 quaternion channels in each output clip are byte-identical to the actual selected source channel payloads. Local Hips planar **linear net displacement** is removed; periodic lateral/body sway is retained. The Armature unit transform and .86 study scale are preserved. Per-frame sole height correction modifies only vertical Hips translation; source root XZ is not also applied as scene locomotion. No claim is made that this local export exercises the newer shared locomotion-driver tree; parent uses existing AnimState3D presentation.

Nominal walking speed is `0.92214608845 m/s`, from measured source cycle travel × .86 / 1.4s. Current prototype uses per-tick Velocity; its `speedAtVelocity` should therefore be `0.92214608845 / 60 = 0.01536910147` at 60Hz. Parent scene chooses idle/walk and owns actual accepted planar movement; wave playback duration remains source seconds.

## Numeric checks and limits

`character-verification-v2.json` reopens final files: finite geometry, monotonic animation keys, 4894 / 4710 triangles, source quaternions equal, and first/last rotation max difference about .00069rad (float rounding bound).

The offline side replay samples 30fps. Low forefoot stance is explicitly defined as ToeBase height <.08m for the full 200ms window; walk supplies six such overlapping windows for each foot. At nominal path speed, worst tangential ToeBase drift is 1.701cm left / .671cm right. Idle and wave windows are below .5mm. Evaluated shoe-sole AABB minimums are above -4.1e-8m after offline vertical correction. Heel roll, swing phases, turning, accelerating, collisions, slopes, runtime blend transitions and different skins are **not covered** by that 2cm conclusion. This is not a full-cycle runtime foot-lock certification.

The first concept GLB had a bevel-induced enlarged head and cap/scalp intersections. Actual CPU and main engine screenshots exposed those defects. The v2 source corrects outer bevel dimensions, lowers/widens the head, separates cap and visor above dark hair, adds side/back hair and full sleeves. Original first-engine assets are retained as `*-v1.glb` and producer sources remain. v2 geometry/animation numeric checks passed; final visual acceptance belongs to the main in-engine review.

## Process evidence

`traveler-front.png`, `shopkeeper-front.png` are **old v1** offline CPU views, not v2 proof. `*-pose.glb`/`*-v2-pose.glb` are frozen idle-time0 helper assets. `render-character.py` / `render-character-v2.py` can reproduce CPU inspection. Sandbox Blender startup crashed before script; host CPU invocation succeeded for old views. The v2 optional render was stopped (own PID 6872 only) at parent's request to free resources for actual engine review. No unrelated process was stopped.

All source-library files and SHA remain unchanged; no global catalog or K line files were edited. No automatic art registration or publication.
