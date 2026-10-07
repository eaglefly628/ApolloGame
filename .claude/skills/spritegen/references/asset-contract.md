# Spritegen Asset Contract

## Run Shape

Each run is a normal folder containing source, generated, sliced, QA, preview, final, and package artifacts.

```text
run/
  sprite_request.json
  prompts/generation-prompt.txt
  references/
  source/source.png
  slices/*.png
  qa/contact-sheet.png
  qa/review.json
  preview/*.gif
  preview/*.mp4
  final/manifest.json
  package/
```

## Supported Layouts

- `single`: one asset in one cell.
- `sheet`: a rectangular grid of related assets.
- `tileset`: grid-aligned tile sheet.
- `icons`: grid-aligned icon sheet.
- `animation`: grid or strip of ordered frames.

## Cell Sizes

Prefer powers or common game sizes: `16x16`, `24x24`, `32x32`, `48x48`, `64x64`, `96x96`, `128x128`.

Use one consistent cell size per sheet. If the user needs mixed sizes, create separate runs.

## Background

Preferred: transparent PNG.

Fallback: clean flat chroma-key background selected during preparation. The selected key is stored in `sprite_request.json` and must not be used as an asset color.

## Package Manifest

`package/manifest.json` should include:

```json
{
  "id": "asset-name",
  "displayName": "Asset Name",
  "kind": "sheet",
  "cellSize": [64, 64],
  "grid": [4, 4],
  "files": {
    "source": "source.png",
    "sheet": "sheet.png",
    "contactSheet": "contact-sheet.png"
  },
  "slices": []
}
```
