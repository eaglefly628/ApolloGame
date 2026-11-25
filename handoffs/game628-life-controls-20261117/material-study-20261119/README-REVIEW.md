# Five-building material study · 2026-11-19

Local material candidates only. Based on the user-authorized K library copies; K originals/library/ledger/services untouched. Geometry and original atlas UV0 preserved. No scene, renderer, host, UI, transform, structural additions, commits or pushes.

## Deliverables

|Candidate|Source|Unchanged triangles|Final SHA256 prefix|
|---|---|---:|---|
|housing-e-detail.glb|housing-e.glb|1424|d1702f28878b|
|housing-a-bakery.glb|housing-a.glb|630|dbaa9e835c87|
|housing-d-noodles.glb|housing-d.glb|1274|d8a41f81687d|
|housing-h-catcafe.glb|housing-h.glb|1979|0349f22454e5|
|housing-a-bikeshop.glb|housing-a.glb|630|a1e293882272|

Full final source/candidate SHA256, geometry assertions and changed material slots are in each `*-report.json`. GLBs and exported PBR PNGs reside in `../public/art/material-study-20261119/` relative to this study directory. Render evidence is alongside this README as `*-front-oblique.png` and `*-material-close.png`.

- Grocery/E: warm orange plaster, small lower brick courses, light limestone and restrained window runoff; existing red/cream awning stripe placement kept.
- Bakery/A: cream plaster, limestone, honey wood, existing teal/white stripe registration kept with cloth microdetail.
- Noodles/D: warm running-bond brick surface and darker wood in original wood slots. Mortar is albedo/normal detail; no bricks added to geometry.
- Cat cafe/H: muted green plaster and pale wood; original awning stripe registration kept.
- Bike shop/A: gray-blue plaster and dark painted frames. Last scalar material adjustment changed metallicFactor to .45 and roughnessFactor to .7 in former wood slots. Since their metallic-roughness image B channel is zero, effective metallic remains 0 (dielectric painted surface); actual gloss is lower roughness. Metallic exposed metal is not claimed.

## Reproduction and exact geometry preservation

`python3 build_material_study.py` rebuilds all five, or append an exact candidate stem to build only one. Python NumPy/Pillow only; fixed seed 6281119. The E variant was rebuilt independently into `repeat-check/` and its entire GLB SHA256 matched. That folder is audit evidence, not a sixth delivery candidate.

The script appends new data to the untouched original GLB BIN buffer and patches a deep copy of its JSON. Every final candidate is reopened and asserted against its source:

1. Entire original BIN prefix byte-for-byte identical, including original position/normal/index/UV0 streams.
2. POSITION, NORMAL, TEXCOORD_0 accessors retain original indices and exact value bytes; indices accessor likewise unchanged.
3. All original accessor and bufferView metadata unchanged; nodes, transforms, scenes, mesh names, primitive counts, material binding indices unchanged.
4. Only added UV1 streams, replaced tangent streams (allowed), appended procedural textures and edited material properties. No vertex duplication or Blender re-export. Silhouette, openings, geometry connections and triangle counts remain exactly source geometry.

UV0 is an authored/baked color atlas and is not blindly tiled. UV1 is a native-coordinate dominant-plane projection over 4 model units; changed wall/stone/wood surfaces use generated physically consistent maps. Awning base color remains registered to its original atlas and only receives fine weave pixels; roughness/normal use UV1. Source units/transforms are preserved, so perceived grain/brick scale still depends on the parent scene's existing building scale.

Maps: 1536×1536 PNG; sRGB albedo, tangent-space normal, linear roughness in G and metallic B=0. Original material/graphic/glazing textures retained where role is ambiguous. New maps contain pigment/pores/fabric/wood/mortar/runoff only, with no baked sunlight or ambient shadow. Original glass reflection graphics remain as source authored and are not a new interior simulation.

## Visual inspection and limits

CPU Blender 5.2.3 imported actual final GLBs, with neutral floor/large lights and fixed overview plus close view; 10 PNGs. Viewed all five overviews and key plaster/stone/brick closeups. Corrected an initial image-V orientation error so E brick band sits at the base; increased shallow plaster grain and modest rain traces for close-range readability. All ten final PNGs now match their listed candidate hashes, including two refreshed bike shop views after its last scalar-only finish adjustment. Parent reran numeric review after that hash changed and owns final engine screenshot validation.

This is a useful local PBR material study, not equality with the AI target image. Geometry was intentionally preserved: no new bevels, curtains, modeled pores, shop contents, interiors or structural detail. Some source decals/glazing remain flat graphic elements. No exhaustive new seam audit is claimed because this task changes no geometry; preservation is stronger byte equality, while texture projection and visible material continuity were inspected. Files are roughly 18–24MB each; uncompressed texture memory/download size is not production-optimized. Final artistic/user acceptance and runtime lighting comparison belong to the parent task.
