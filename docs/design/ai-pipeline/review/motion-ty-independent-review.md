# Ty static-Skin compatibility independent review

Verdict: **PASS for the frozen bounded compatibility patch**, not visual approval or library publication. Reviewer did not implement the patch. No active motion-line source, ingest lock, catalog or asset files changed. No Ty publication, human preview receipt, tagging confirmation, downloads, commits or pushes.

## Scope

Frozen constructor tree `/private/tmp/motion-skin-extension-12283e5ad`, patch `/private/tmp/motion-skin-extension-12283e5ad.patch`, only `scripts/lib/character-glb.mjs` and `scripts/character-glb.test.mjs`. Compatibility is limited to explicitly opted-in static Skin imports. KHR_texture_transform accepted only on known core/specular material textureInfo locations, with finite numeric vectors/rotation, nonnegative integer coordinates, valid texture/image/sampler dependencies and actual referenced UV accessors on every primitive sharing that material. Default character and animation paths still reject extensions. Geometry/compression/unknown extensions remain rejected.

Consulted official Khronos schema: https://raw.githubusercontent.com/KhronosGroup/glTF/main/extensions/2.0/Khronos/KHR_texture_transform/schema/textureInfo.KHR_texture_transform.schema.json . Payload dimensions/types agree. This does not claim support for arbitrary glTF extensions.

## Reproduced issue repaired before final freeze

Early isolated patch accepted `KHR_texture_transform.texCoord=99` on a material whose mesh has no TEXCOORD_99. Independent reproduction `/tmp/motion-ty-uv-probe.mjs` printed `ACCEPTED invalid TEXCOORD_99 override`; source GLB was modified in memory only. Constructor added UV-binding/accessor checks. Final independent reproduction rejects the same malformed override. Reviewer made no implementation repair.

## Independent runs

- Frozen character-glb + motion-library suites: **175/175 PASS, exit0**. `/tmp/motion-ty-independent-focused.log`.
- Independent real-GLB in-memory adversarial probes: **11 rejection cases PASS**, exit0: unsupported placement, unknown extension, unknown transform field, wrong offset dimensions, nonnumeric rotation, negative coordinate, missing coordinate set, invalid texture reference, external image URI, undeclared extension and geometry compression. Default strict path rejects the unmodified Ty GLB. `/tmp/motion-ty-adversarial.mjs`, `/tmp/motion-ty-independent-adversarial.log`.
- Real unchanged output passes static opt-in inspector: 69 bones, 3487 vertices, 5638 triangles. Native `measureSkin` returns hipHeight0.8465223110493248m, pose T-pose, skeleton apollo-humanoid-v1. This is structural/rest validation, not a rendered appearance claim.
- Original Ty FBX SHA independently matches source manifest: `f7c10a2a42e880394f1a1484e736bb2c6b623758026f269ae5d623a461747f38`.
- Actual output GLB SHA verified before/after probes unchanged: `3799e818a7150a73dc839e69ed7828d2af0cca8e18880f5f2e9ce162bc570197`, 4331548 bytes.

## Fresh independent anchored withdrawal checks

Copied the two frozen files into a separate private snapshot `/private/tmp/motion-a4-review`. Neither constructor tree nor active processing tree was changed. Harness `/tmp/motion-ty-mutations.py`; summary `/tmp/motion-ty-independent-mutations.log`.

1. Unique `textureTransform(extension);` anchor count1, remove: invalid-payload assertions fail exit1. Restore byte-for-byte: green exit0.
2. Unique UV accessor type/component/normalization check anchor count1, remove: invalid-UV-accessor assertion fails exit1. Restore byte-for-byte: green exit0.

Logs `/tmp/motion-ty-independent-{red,restored}-{1,2}.log`. Failures are semantic assertion failures, not startup or syntax errors.

## Warning/limit review

Expected synthetic ingest decision/reject output inspected; no unexpected warning/unhandled/unsettled lines in independent focused log. Default strict-extension rejection, static-only rejection and unknown/geometry extension rejection tests remain green. Actual original material/image/UV/mesh bytes were not rewritten, removed or normalized away; the patch admits a supported render metadata extension only.

This permits integrating the frozen code after root's required gate and ownership coordination. Do not hot-change the active batch's source, clear its locks, or auto-publish Ty from this review. Ty still needs a deliberate retry after the code is integrated, catalog validation and actual visual/material preview. No claim that all108 Skins or2445 motions are accepted follows from this bounded result.
