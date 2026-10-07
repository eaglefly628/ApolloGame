#!/usr/bin/env python3
"""Create a checkerboard contact sheet for Spritegen sliced cells."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def checker(size: tuple[int, int], square: int = 8) -> Image.Image:
    image = Image.new("RGB", size, "#ffffff")
    draw = ImageDraw.Draw(image)
    for y in range(0, size[1], square):
        for x in range(0, size[0], square):
            if (x // square + y // square) % 2:
                draw.rectangle((x, y, x + square - 1, y + square - 1), fill="#e6e6e6")
    return image


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-dir", required=True)
    parser.add_argument("--scale", type=int, default=3)
    args = parser.parse_args()

    run_dir = Path(args.run_dir).expanduser().resolve()
    manifest_path = run_dir / "final" / "manifest.json"
    if not manifest_path.exists():
        raise SystemExit("Run slice_asset_sheet.py before making the contact sheet")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    columns, rows = manifest["grid"]
    cell_w, cell_h = manifest["cellSize"]
    label_h = 18
    out_w, out_h = columns * cell_w * args.scale, rows * (cell_h * args.scale + label_h)
    output = Image.new("RGB", (out_w, out_h), "#f4f4f4")
    draw = ImageDraw.Draw(output)
    try:
        font = ImageFont.load_default()
    except Exception:
        font = None

    by_pos = {(cell["column"], cell["row"]): cell for cell in manifest["cells"]}
    for row in range(rows):
        for col in range(columns):
            cell = by_pos[(col, row)]
            with Image.open(cell["file"]) as opened:
                sprite = opened.convert("RGBA").resize((cell_w * args.scale, cell_h * args.scale), Image.Resampling.NEAREST)
            x = col * cell_w * args.scale
            y = row * (cell_h * args.scale + label_h)
            bg = checker(sprite.size)
            bg.paste(sprite, (0, 0), sprite)
            output.paste(bg, (x, y))
            draw.rectangle((x, y, x + sprite.width - 1, y + sprite.height - 1), outline="#333333")
            draw.text((x + 3, y + sprite.height + 2), f"r{row} c{col}", fill="#111111", font=font)

    qa_dir = run_dir / "qa"
    qa_dir.mkdir(parents=True, exist_ok=True)
    target = qa_dir / "contact-sheet.png"
    output.save(target)
    print(target)


if __name__ == "__main__":
    main()
