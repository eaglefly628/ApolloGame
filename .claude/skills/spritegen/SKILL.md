---
name: spritegen
description: Generate, slice, validate and preview sprite sheets or frame animations for Apollo games using AI image generation and Spritegen. Export to Apollo AssetIndex and Image.sprite; preserve the game's chosen art style. Not Live2D rigging or automatic motion-quality assurance.
---

# Spritegen

## Apollo integration (read first)

Repository source lives in `.claude/skills/spritegen`; Codex's local discoverable mirror is `.agents/skills/spritegen`. Run commands from the repository root. Read [references/apollo.md](references/apollo.md) before preparing or importing an Apollo asset. It defines style overrides, safe run directories, stricter QA and the engine export command. Upstream provenance is recorded in `UPSTREAM.json`.

## Overview

Create generic 2D pixel-art assets with an image model, then use deterministic scripts for the mechanical parts: run setup, prompt manifests, source recording, slicing, alpha/chroma cleanup, contact sheets, validation, previews, and packaging.

This is an Apollo asset workflow, not the ChatGPT pet-generation workflow. Do not introduce pet-specific manifests or a fixed pet atlas into an Apollo asset request.

## Core Rule

Use the image generator available to your agent for visual generation. Use this skill's Python scripts only for deterministic asset operations.

Do not draw, invent, or fake final asset art with Python, SVG, HTML canvas, CSS, or local image transforms as a substitute for model-generated visuals. Local scripts may crop, slice, validate, compose contact sheets, render previews, convert formats, and package files.

## Image Generation by Agent

Pick the correct tool for the agent you are running in:

| Agent | How to generate images |
|---|---|
| **Codex** | `$imagegen` — built-in, call directly |
| **Antigravity** | Built-in image generation — call directly |
| **Gemini CLI** | Nano Banana extension: install with `gemini extension install nanobanana`, then use `/generate <prompt>` or the `generate_image` tool |
| **Claude Code** | Use an installed MCP image tool. Check for `mcp__pixa__*`, `mcp__imagegen__*`, `mcp__proxima__generate_image`, or any other available `*generate_image*` MCP tool. If none are installed, tell the user to install an image generation MCP (e.g. Pixa MCP or image-gen-mcp) and pause. |

If you cannot determine which agent you are in, look for available image generation tools and use the first one found. Never fabricate images locally.

## Default Workflow

1. Clarify or infer the asset target: `single`, `sheet`, `tileset`, `icons`, or `animation`.
2. Create a run folder and generation manifest:

```bash
SKILL_DIR=".claude/skills/spritegen"
python "$SKILL_DIR/scripts/prepare_sprite_run.py" \
  --name "<asset-name>" \
  --kind sheet \
  --concept "<what to make>" \
  --output-dir /absolute/path/to/run \
  --grid 4x4 \
  --cell-size 64x64
```

3. Read `prompts/generation-prompt.txt` and call your agent's image generator (see **Image Generation by Agent** above) with that prompt plus any user references. If references exist, attach them with clear role labels.
4. Record the selected original generated image:

```bash
python "$SKILL_DIR/scripts/record_sprite_result.py" \
  --run-dir /absolute/path/to/run \
  --source /absolute/path/to/generated-output.png
```

5. Slice and QA the source:

```bash
python "$SKILL_DIR/scripts/slice_asset_sheet.py" --run-dir /absolute/path/to/run
python "$SKILL_DIR/scripts/validate_sprite_assets.py" --run-dir /absolute/path/to/run
python "$SKILL_DIR/scripts/make_asset_contact_sheet.py" --run-dir /absolute/path/to/run
```

6. For animation strips, render previews:

```bash
python "$SKILL_DIR/scripts/render_asset_preview.py" \
  --run-dir /absolute/path/to/run \
  --fps 8
```

7. Package final outputs:

```bash
python "$SKILL_DIR/scripts/package_sprite_assets.py" --run-dir /absolute/path/to/run
```

## Asset Types

- `single`: one transparent asset, icon, prop, item, pickup, UI badge, character, or object.
- `sheet`: multiple related sprites in a uniform grid.
- `tileset`: grid-aligned terrain, walls, floors, platforms, edges, corners, or decorative map tiles.
- `icons`: readable item or UI icons with shared perspective and palette.
- `animation`: frame strip or grid for a small loop such as walk, slash, sparkle, flame, explosion, bounce, idle, or interact.

## Pixel-Art Style

Default to the game's explicitly chosen style. For pixel-art games use clean pixel-art-adjacent 2D game assets: chunky readable silhouette, hard edges, limited palette, flat cel-like shading and consistent pixel scale. For Game112 preserve its painterly storybook style; use `--art-style custom --style-notes "..."` in preparation.

Do not change a painterly game to pixel art merely to use this tool. Avoid text labels, UI mockups, scenery and inconsistent perspective in character animation sheets.

For detailed visual rules, read `references/pixel-style.md`.

## Layout Rules

- Prefer transparent PNG output when the image model supports it. Otherwise use the run's chroma-key background and remove it during slicing.
- Keep one asset or one frame per grid cell. No overlap across cell boundaries.
- Use stable cell sizes: common defaults are `32x32`, `48x48`, `64x64`, `96x96`, and `128x128`.
- Keep all assets in a sheet visually related: same camera angle, outline weight, palette, lighting logic, and pixel scale.
- Do not accept a sheet where assets are cropped from a larger illustration, repeated transforms of one frame, or blended into a background.
- For tilesets, ensure tile edges connect cleanly and avoid non-grid scenery.

For output contracts and packaging shape, read `references/asset-contract.md`.

## QA Rules

Before calling work complete, inspect:

- `qa/contact-sheet.png`
- `qa/review.json`
- `final/manifest.json`
- `preview/` files when animation previews are requested

Block acceptance when:

- requested cells are empty or mostly empty
- assets are clipped, slot-crossing, or joined together
- background cleanup removed meaningful pixels
- chroma-key color remains around edges
- style drifts away from the approved reference
- animation frames are static copies rather than meaningful frame variants
- tiles do not align to the requested grid

For detailed checks, read `references/qa-rubric.md`.

## Repair Workflow

Repair the smallest failing scope:

1. Regenerate only the source image if the whole sheet is wrong.
2. Regenerate only a row, region, or individual asset when the model/tooling supports it.
3. Re-run `record_sprite_result.py`, slicing, validation, contact sheet, and previews.

Do not patch broken art locally unless the user explicitly asks for manual pixel editing. Deterministic scripts may fix alpha, crop, scale, and packaging only.

## Script Summary

- `prepare_sprite_run.py`: create request metadata, generation prompt, layout guide, and run folders.
- `record_sprite_result.py`: copy a selected generated source into the run and record provenance.
- `slice_asset_sheet.py`: remove chroma background if configured, slice grid cells, trim/pad, and write `slices/`.
- `validate_sprite_assets.py`: inspect geometry, alpha, empty cells, edge pixels, and size consistency.
- `make_asset_contact_sheet.py`: build a visual QA sheet with transparent checkerboard.
- `render_asset_preview.py`: render GIF and MP4 previews for animation frames.
- `package_sprite_assets.py`: copy final usable files into `package/` with a manifest.
