# Cap visor topology repair · 2026-11-20

The parent investigated a thin white line near the character's head. This subtask checks the asset; it does **not** claim to establish the screen artifact's root cause.

## Actual exported-asset findings

The v2/v3 visor was generated with outer dimensions .49 × .035 × .24m and profile radius .025m. The rounded XY profile reverses at the thin edge because radius exceeds half the height (.0175m). Reconstructing its exact sampled profile gives two crossings, one per side.

More importantly, the **actual final GLB triangle data** confirms a defect:

- `check-exported-slice.py` intersects exported visor triangles with local Z planes. Near front/back ends (Z=.119, .1199 and -.1199), v3 has non-adjacent sidewall segment crossings; central slices alone would miss the problem. Shared endpoints within 1μm are excluded.
- Analysis-only coincident welding at 1μm finds **8 boundary edges** in v3, zero nonmanifold edges, zero duplicate triangle copies. Earcut failed to fill four cap triangles on the self-crossing profile.
- No degenerate-area triangles or triangle/normal opposition were found in either version. Those checks alone would therefore have missed this defect.

The head region is also enumerated in `hat-report-v3.json`: cap crown and visor both use green base color [.25818,.31399,.16203], roughness .9 and no emissive. The area above the head contains hair, fringe and cap, with no extra white mesh or white material. Cap crown/visor overlap is the intended seated cap joint; it is not a duplicate coplanar surface. It has not been proven that this geometry defect creates the user's white line, especially if that line is detached above the crown rather than on the brim.

## v4 isolated candidate

`public/art/reference-rebuild-20261120/character/traveler-v4.glb`

SHA256: `89848c4f0fa8eff8783b36af445e29a639fe5656c53ee84dae159e7754d55e8f`.

Only cap-visor mesh POSITION/NORMAL/UV attributes change. Radius is .012m (and generator clamps against all half dimensions), outer size and placement remain .49/.035/.24m. Visor is 92 triangles versus 88 before. Nodes, materials, all animations, every nonvisor mesh, and the original binary prefix are unchanged. In particular **the v3 240Hz exact-sole grounding curves remain identical**. Source v3 is retained unchanged.

v4 sampled exported sections show no crossings; welded analysis shows boundary0 / nonmanifold0 / duplicate0. This is an asset topology fix, ready for same-camera/light v3/v4 browser A/B. Main session owns that visual verification. No shader darkening, material swaps, light changes, global sinks or hidden geometry were used to mask it.

## Reproduce

```sh
node handoffs/game628-life-controls-20261117/reference-rebuild-20261120/character/hat-topology-fix-20261120/build-v4.mjs
node handoffs/game628-life-controls-20261117/reference-rebuild-20261120/character/hat-topology-fix-20261120/check-hat.mjs v3
node handoffs/game628-life-controls-20261117/reference-rebuild-20261120/character/hat-topology-fix-20261120/check-hat.mjs v4
python3 handoffs/game628-life-controls-20261117/reference-rebuild-20261120/character/hat-topology-fix-20261120/check-exported-slice.py
```

`character-contract-v4.json` records source/candidate SHA and invariants; `visor-edge-check.json` records exact welded edge counts. No shared renderer/host/scene/source-animation change, no commit or push.

## Follow-up full-cycle exclusion check

After the user reported the line followed the player, `check-animation-extrema.mjs v4` sampled all rendered vertices at 120Hz over complete idle / walk / wave cycles (1194 / 169 / 569 samples). The actual GLB contains 51 rigidly animated meshes and no SkinnedMesh/skin; source rig empties have no geometry. Every sampled frame's highest rendered point belongs to `cap-crown`; no other mesh rises above the hat, and no vertex stretches up toward a second floor. Peak Y is 1.724685m / 1.753363m / 1.733919m for the respective clips. Thin triangles belong to intended laces, bag straps and visor; their actual indexed triangle edges stay below .5m. No detached white head-region geometry was found. Per-mesh world extrema, source empty-node maxima and real indexed triangle statistics are recorded in `animation-extrema-v4.json`.

The main session subsequently reproduced the artifact on the follow-camera scene and isolated the tall transparent-white `camera-anchor` rod by A/B replacement with a tiny cube plus Pivot offset. That screen-space conclusion is the parent's actual-browser evidence; this subtask's asset scan only excludes the alleged flying vertex/mesh explanation. The independent visor topology repair remains valid, but is not represented as the white-line fix.
