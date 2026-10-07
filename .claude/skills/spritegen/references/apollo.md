# Apollo Spritegen bridge

Source: https://github.com/usexless/Spritegen at the revision in `../UPSTREAM.json`.
This is an offline art-authoring tool, not a runtime dependency, animation model or Live2D rig.
Python 3.10+ and Pillow are required; ffmpeg is optional for MP4. Do not install dependencies globally without approval. From the repository root, set `SKILL_DIR=.claude/skills/spritegen` (tracked source); `.agents/skills/spritegen` is the local Codex mirror. The repository intentionally ignores `.agents/`; do not change that policy to ship machine-local skills.

## Prepare and generate

Use a new dedicated run directory, preferably under `/private/tmp`; never `--force` an existing run. The Apollo patch disables recursive deletion in preparation. Keep the source and intermediate outputs outside production `public/` until reviewed.

```sh
python3 .claude/skills/spritegen/scripts/prepare_sprite_run.py --name xuetuan-idle --kind animation --concept 'Same cat breathing gently; head and paws stationary, small chest and tail movement' --grid 6x1 --cell-size 256x256 --art-style custom --style-notes 'Game112 hand-painted cozy gouache, preserve Ragdoll identity and fixed camera' --output-dir /private/tmp/xuetuan-idle-review
```

Read the generated prompt and attach the actual identity references using the available imagegen tool. Generation is still performed by that tool, not Spritegen. Never claim a model call happened when only the run/prompt was prepared.

Record, slice (`--no-chroma` for actual transparent output), validate and preview following SKILL.md. Source size must equal grid × cellSize; do not silently resize or independently center every frame (causes sliding). An empty frame fails validation. Edge warnings require visual review. Review GIF at native scale with `--scale 1`; MP4 failure does not mean GIF failed.

Pixel style is appropriate only when requested. Game112 uses custom style, not the upstream pixel preset. Walking and genuine turning require separate source runs; never mirror or fade a walking strip to simulate a turn.

## Accept and export

Inspect contact sheet, per-frame alpha and the preview for clipping, drifting scale/identity, ground contact, first/last transition and duplicated poses. Automated alpha checks do not establish motion quality. Do not approve old rejected cat art as a new result.

After approval, package with `package_sprite_assets.py`, then:

```sh
node tools/spritegen-export.mjs --package /private/tmp/xuetuan-idle-review/package --out /private/tmp/xuetuan-idle-export --id game112/cat/xuetuan-idle --url /games/game112/art/cat/xuetuan-idle.png --fps 6 --license 'Generated asset terms verified for this source' --visual-approved
```

The exporter rejects QA errors/warnings, missing cells, unsafe paths and invalid image geometry. `--visual-approved` records a real manual review; never pass it just to unblock export. A reviewed edge warning requires correcting the artifact or deliberate separate investigation, not deleting the report.

Export contains `sheet.png`, `asset-index.json`, `image-node.json` and provenance. The existing AssetIndex `spec.sheet` supports grids. Existing LayoutNode `Image.sprite` supports **one horizontal row only**: a multi-row sheet exports its index but intentionally no Image node. Split multi-row animation into separate horizontal runs for this consumer.

Use resource-manager rules to copy approved output into the game's local art directory and merge its entry into the local index, preserving existing IDs and original image-generation provenance. This command only produces a staging package; it never replaces a game asset or edits a save. Register through `registerAssetIndex`; no new renderer/system is needed.

## License / upstream caveats

The upstream package declares MIT but this pinned repository contains no full LICENSE text. Local authoring installation is recorded with attribution; do not present the vendor as fully license-cleared for external redistribution. Generated art has separate provider/reference rights. Upstream packaging can succeed with warnings, so Apollo checks again before exporting.
