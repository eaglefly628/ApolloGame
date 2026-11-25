# Game 628 supplementary modern modules — local draft

Original low-poly cartoon-realistic supplementary props, flat PBR color materials; no third-party textures, concept-image projection, baked illumination, animations, added runtime lights or K-library modifications. The concept is a visual guide, not a literal recreation. Six modules are producer-reviewed usable study candidates; planter is not approved (see below). Final user art acceptance and in-engine scene acceptance remain pending.

GLBs: `../../public/art/neighborhood-v1/custom/`. Editable source: `neighborhood-modules.blend`. Reproducible source: `build_modules.py`. `repair_balcony.py` records the only post-export repair: bar top initially stopped 12.5mm below the rail; raised bars retain 5mm deck insertion and now overlap the rail about 7.5mm. Source generator includes the repair.

Run Blender background with `--python build_modules.py` to regenerate. Append `-- --check-only` to inspect/render existing frozen GLBs. `check_contacts.py` only analyzes surface contact samples. Current hashes are in `geometry-report.json`.

## Measured final exported/reimported geometry

Meter units, glTF +Y up, +Z street-facing. Report uses evaluated world coordinates. Hard-normal/UV split vertices are welded **only in an analysis copy** at 1 micrometer; after that all seven contain zero boundary edges, zero degenerate triangles and zero duplicate triangles. The GLBs themselves are not welded. All fit the 3500-triangle budget.

|Module|Triangles|Bounds minimum X,Y,Z|Bounds maximum X,Y,Z|
|---|---:|---|---|
|balcony|572|-1.8000, -0.4500, -0.0200|1.8000, 1.0525, 0.8500|
|aircon|604|-0.3250, -0.2800, -0.0500|0.3250, 0.2250, 0.3033|
|awning|952|-1.8000, -0.4050, -0.0300|1.8000, 0.0500, 0.9650|
|shop-sign|344|-1.6000, -0.2000, -0.0000|1.6000, 0.2000, 0.1319|
|bicycle|2268|-0.8400, -0.0000, -0.2200|0.8400, 1.0040, 0.2200|
|street-planter|440|-0.3350, 0.0000, -0.2100|0.3350, 0.4025, 0.2100|
|broadleaf-tree|304|-1.4403, -0.0050, -1.3305|1.4181, 4.4470, 1.3135|

`CONNECTIONS.md` records intended openings and hidden insertions. `contact-report.json` records selected actual triangle-surface intersections, plus all 468 imported front-rim vertices tested inside the closed tire. These samples are not an exhaustive proof of all interfaces or self-intersection absence. Closed individual mesh parts and intentional hidden intersections remain separate parts.

## Visual evidence and disposition

`front-oblique.png`, `back-oblique.png`, `low-front.png` show actual reimported complete assemblies. Every module has `*-contact-front.png` and `*-contact-rear.png`, isolated from unrelated gallery props but retaining its complete assembly. Offline Blender CPU PBR, neutral floor, not engine screenshots. Tree detail crops emphasize branch/crown contact; complete tree silhouette is in the grouped overview.

- Balcony: repaired bar/rail gap; full front/back close views show seated bars, rail corners and brackets. Producer visual passed as local draft. Final building attachment belongs to parent scene review.
- Aircon: fixed decorative fan/recess; casing and brackets closed. Producer visual passed.
- Awning: continuous closed strip shell, closed scalloped valance, supported rear mounts. Producer visual passed.
- Sign: original blank green face and timber rim; text is parent scene responsibility. Producer visual passed.
- Bicycle: frame, rim, tire, basket and handlebar join reviewed front/back; simple static silhouette, no chain/drivetrain/riding motion promised. Producer visual passed as static prop.
- Tree: overlapping closed crown clusters and trunk into crown; root reaches Y=-0.005m, place +0.005m above ground. Producer visual passed as local draft; no wind animation.
- **Planter: needs_review — close view reveals dark rectangular artifacts at coplanar rim corner overlaps. Do not use in the sample scene; parent has K potted bushes. Not corrected because this low-priority module was stopped at review.** Soil edge has intentional 2.5mm fit clearance over a closed base.

Blender sandbox startup crashed before Python execution (Metal startup); host execution completed export, reimport and finite CPU checks. No processes killed, no K services/ledgers touched, no commits/pushes. Assets remain local candidates, not production acceptance.
