# Traveler sole floating correction · 2026-11-20

## Reproduced cause

The v2 preparation used `Box3.setFromObject(sole)` to ground each 30fps pose. That fast path transforms the sole's **local bounding-box corners**. The beveled/rounded sole has no vertex at some of those corners. When the foot rolls, the artificial AABB corner reaches the floor while the actual sole surface stays above it.

This was reproduced on the **exported traveler-v2.glb loaded by Three GLTFLoader**, not only on the procedural construction. `diagnose.mjs` uses the same AnimationMixer interpolation and `Box3.setFromObject(sole,true)` (actual transformed POSITION vertices). At t=.666667s in the walk, fast-box minY is effectively zero while the real right sole minY is **10.478mm**. The other foot is higher. This is actual simultaneous shoe/floor separation, not a ToeBase label assumption.

## Minimal asset-only fix

`build-v3.mjs` reads v2 and appends new Hips translation streams. It samples every 1/240s, computes the minimum of the two **real rounded sole surfaces**, and corrects the corresponding vertical Hip coordinate. No uniform scene/model sinking offset is added; swing-foot motion is preserved and the appropriate lower foot establishes contact. Original v2 bytes are retained as the prefix of the new binary buffer.

New file: `public/art/reference-rebuild-20261120/character/traveler-v3.glb`.

SHA256: `366ae491bd1340a2a59109adbb0650742e12cff2f67d28731ab83a6dc3a7a59b`.

Geometry, indices, normals, node transforms, materials, scenes, all original accessor/bufferView metadata and every quaternion track remain unchanged. Exactly one Hips translation sampler per clip changes; source library/v2 file are untouched. Nominal speed and per-tick speedAtVelocity remain unchanged.

## Final exported-GLB verification

Reimported both variants and sampled at **960Hz**, including all subframes between the 240Hz preparation keys:

|Walk lower sole vs Y=0|v2|v3|
|---|---:|---:|
|Maximum positive gap|10.478mm|0.519mm|
|Minimum contact height|+0.199mm|-0.038mm|

v3 idle max positive gap is approximately .00017mm; wave approximately .00145mm. The remaining submillimeter walk cusp is the support-foot handoff between linear dense height keys, below a 1mm numeric acceptance limit; it is not reported as mathematically exact continuous contact.

Also simulated both idle→walk and walk→idle, fades .18s and .25s, eight start phases each, walking rate 1.301312303×. The current shared `models.ts` actually uses **.25s**, despite the initial task mentioning .18s. Across these 32 transitions, v3's largest floating gap is approximately 3.34e-8m.

**Separate pre-existing limitation:** ordinary pose crossfading bends/rotates the planted legs while linearly blending Hip heights. v2 has transition penetration up to about 5.51cm; v3 up to 5.83cm. The asset-only contact rebake removes the reported floating but does not claim to solve arbitrary real-time blended-pose foot planting. That requires blend-aware contact/IK or a separate transition design; it cannot be certified from independently grounded clip curves. This is explicitly surfaced to the parent, not hidden with a global sinking offset.

Measurements use flat Y=0. Actual brick-grout recesses around -3cm are a scene geometry issue and are not treated as the character's support plane. No terrain fitting, slopes, runtime collision, action interruption or cross-skin conclusion is claimed.

## Reproduce

From repository root:

```sh
node handoffs/game628-life-controls-20261117/reference-rebuild-20261120/character/foot-contact-fix-20261120/build-v3.mjs
node handoffs/game628-life-controls-20261117/reference-rebuild-20261120/character/foot-contact-fix-20261120/diagnose.mjs v2 960
node handoffs/game628-life-controls-20261117/reference-rebuild-20261120/character/foot-contact-fix-20261120/diagnose.mjs v3 960
```

`character-contract-v3.json` records exact identity checks and numeric results. `v2-gap-report.json` / `v3-gap-report.json` contain all clip and transition worst samples. Main session performs actual browser review; no producer in-engine visual pass is asserted here. No renderer, host, scene, animation source, shared code, commit or push changed.
