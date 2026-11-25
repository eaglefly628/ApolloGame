# Game 628 reference street reconstruction · 2026-11-20

Final static candidate: **`handoffs/game628-life-controls-20261117/public/art/reference-rebuild-20261120/scene/street-reference-v3.glb`**. Use `scene-contract-v3.json`. Final SHA256: `8ba09e122cc6da11c94c480d2e88421776bb84b8d6c891b11516d7cb34b9ca03`.

This is a new original 3D interpretation of the authorized AI concept `generated_images/exec-e200c4ec-58a4-40bd-a8e6-2c5cfc5b3c19.png`. It does not reuse K building contours and does not modify K models, ledgers or services. It is a local scene candidate, not a claim of pixel-exact reproduction or final user art approval. No humans, camera, runtime lights, controls or UI are included in this static GLB; those are owned by parent/animation tasks.

## Geometry and scene interface

- Units meters; glTF +Y up; +Z toward street. Five shops left to right: grocery center -8.25 width4.0, bakery -4.35 width3.8, alley width1.6, noodles .9 width3.5, cat cafe4.55 width3.8, repair8.35 width3.8. Total main facade20.5m.
- Shop floors topY0. Interiors Z[-2.8,0], shop height3.0. One broad-window residential floor Y[3.1,6.6], rather than reused tall narrow-window blocks. Roof rails extend above residential wall top; whole-scene bounds include tree and pavement.
- Final near bounds: min(-11.35436,-.25,-9), max(11.09650,8.16223,4.87). 164 exported meshes, 42 materials, 116,904 triangles; approximately20MB self-contained GLB.
- Genuine segmented-wall openings and narrow window/storefront frames. No opaque store glass panel blocks interiors. Open bakery display is a deliberate visibility choice, not a promise of refractive glass simulation.
- Distinct contents: red/yellow/green produce heaps with crates and supporting cabinets; bread racks/loaves/baguettes; split red noren with bowl graphic, countertop/stools/stockpots/utensils; three original stylized cats and cat tree; bicycle frames/wheels/tools/workbench. Original chalkboard icons, not copied logos.
- Upper curtains, bookshelves/books, low plants, trailing vines, railing, aircon housings/pipes and drain lines. Left tree is real faceted geometry with gaps and a forward-reaching crown, not a shadow card. Pavement/tactile strip/bollards and foreground flowers are real solids.
- `scene-contract-v3.json` provides actual furniture bounds and suggested staff foot points (radius<=.22m). It is a geometric placement suggestion, not a full animation or collision-envelope guarantee. Five centerline floor rays independently reachedY0. Runtime collision/navigation is not generated here.

## Material and light ownership

26 shared512px PNG images (13 albedo/normal pairs) for plaster, stone, timber, brick grain, fabric and related surfaces. No baked sunlight, ambient shadows or painted leaf shadows. Brick mortar is geometric rather than duplicated in a mortar texture. Roughness is a physically meaningful scalar per material; normal microdetail is shallow. Palette values selected in sRGB are converted to linear shader factors; albedo PNGs remain sRGB, normals non-color. V1's pale appearance and fruit hidden below crate rims were corrected inV2.

No actual GLB lights, cameras, animations or environment maps. Pendant geometry contains only low emissive bulb material. Parent owns the sun, ambient light, four runtime local-light budget and final morning/evening/night appearance. Offline screenshots are diagnostic Blender CPU PBR, not Apollo runtime screenshots; parent separately viewed actual game output.

Optional distant asset: `background-reference-tintable.glb`, SHA256 `67d11099070c1daa4b081657e595634ff96ab375742c10ab4624c79f744f5030`. Original `background-reference.glb` retained unchanged. KHR_materials_unlit remains, original linear base colors were moved to float COLOR_0, material factors became white for parent Model3D.tint day/dusk/night. Exact geometry/normal/node preservation is in `background-tintable-report.json`. Background bounds min(-7.2,2.4,-31), max(5.4,7.825,-20.81). The engine has no per-model cast/receive flags: no claim that metadata disables them. Directional light dirZ must remain negative, so this geometry behind the near scene can only cast farther backward; near local lights cannot reach it. It remains separate from near-scene caster bounds.

## Final GLB checks and bounded conclusions

`CONNECTIONS.md` records expected joints/openings before modeling. ActualV2 GLB reimport (`street-reference-v2-geometry-report.json`) measured zero boundary edges after analysis-only1µm welding and zero degenerate triangles. Eight zero-area graphic-cat-ear triangles fromV1 were removed before finalV2 export. Actual delivered GLBs are not globally welded or Booleaned.

There are106 analysis-weld nonmanifold edges and40 coordinate-duplicate triangle occurrences at1µm, explained by controlled hidden caps/corners of separate closed parts. These counts are retained honestly; zero boundary is not a proof of an overall manifold union, absence of all self-intersections, or artistic acceptance.

`v2-contact-report.json`: eleven final-artifact ray/surface samples passed: five staff centerlines reachY0, five face-height rays find no opaque front panel, and a balcony middle-bar/rail sample measures42.5mm hidden insertion. Sampling is not exhaustive. Seven actual-GLB CPU views (`street-reference-v2-*.png`) cover overview, five shop fronts and a balcony/window close-up; all were viewed. No blocking architectural hole, exposed countertop end or frame break was observed in those front and slight-oblique views. Rear, bottom and every tiny decorative contact were not exhaustively visually audited, and are not claimed fully checked.

A known static-cat contact issue found in close view was **fixed inV3**: whole groups moved down21.000037mm,20.999994mm and55.999998mm, without deforming individual paws. Only2644 cat vertex occurrences in5 POSITION accessors changedY; min/max were recomputed. All noncat positions and every original normal/index/UV/tangent/material/node/bufferView remain byte-identical. `v3-cat-contact-report.json` proves all BIN differences are inside known cat POSITION.Y components;V2 itself is untouched.

`v3-reimport-report.json`: actual final GLB opened in Blender; each cat's24 unique paw coordinates matched. Paw minima .6150000095,1.7849999666,0 align support tops .615,1.785,0 to<=3.34e-8m. `street-reference-v3-cat-contact.png` is the final frozen-artifact contact view. Rounded bodies use a small controlled hidden insertion rather than floating above the support.

Residual artistic limits: this is simplified low-poly staging; decorative plants/clusters and shop objects are stylized, static, and are not botanical/growth, cooking, cat animation or repair mechanics. Not all details of the illustration are reconstructed literally. Runtime light leakage, shader tone, 4-light budget and final user acceptance remain parent scene checks. No other confirmed blocking front-view geometry issue remains within the stated inspection coverage; unseen areas are explicitly outside that conclusion.

## Editable source and reproduction

- `reference-street-source-v3.blend`: detailed editable source, including repaired whole-cat positions. `reference-street-source-v2.blend` andV1 source retained. `reference-street-final-v2.blend` stores compact mergedV2.
- `make_surface_textures.py`: deterministic original512px texture generator, fixed seed6281120. `build_reference_street_v2.py`: detailed geometry source builder. `finalize_reference_v2.py`: deterministic grouping in world coordinates, triangulation/degenerate removal and compactV2 export. The latter avoids thousands of repeated operator joins. Re-run those in order using BlenderCLI; they can recreate intermediateV2 files, so do not run them during live review without coordinating the frozen hash.
- `prepare_cat_contact_v3.py` reads the unmodifiedV2 editable source, measures actual paw minima, saves separately repairedV3 source and writes group coordinates/deltas. `patch_cat_contact_v3.py` patches a copy of frozenV2 toV3 with strict byte-difference guards and updated POSITION bounds. `reimport_cat_v3.py` verifies final contact in Blender and renders the close-up.
- `build_background.py`, `make_tintable_background.py` create the optional original skyline/hills and guarded tintable copy.
- `inspect_reference.py` and `check_final_contacts.py` record the above numerical/visual samples. Blender5.2.3 LTS RC was used. No reproducible whole-Blender-export SHA guarantee across versions is claimed; delivered hashes are recorded instead.

Only the assigned model/output directories were written. Own stale rendering/build processes were explicitly identified before termination; other roles' processes were not killed. Final diagnostic renders were limited to2CPU threads. No K originals, old prototype, prior material study, parent host/scene/UI, commits or pushes were modified.
