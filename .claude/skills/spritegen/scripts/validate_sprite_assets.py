#!/usr/bin/env python3
"""Validate basic geometry and alpha quality for Spritegen outputs."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image


def alpha_count(image: Image.Image) -> int:
    histogram = image.getchannel("A").histogram()
    return sum(histogram[1:])


def edge_alpha_count(image: Image.Image) -> int:
    alpha = image.getchannel("A")
    count = 0
    for x in range(image.width):
        count += 1 if alpha.getpixel((x, 0)) else 0
        count += 1 if alpha.getpixel((x, image.height - 1)) else 0
    for y in range(1, image.height - 1):
        count += 1 if alpha.getpixel((0, y)) else 0
        count += 1 if alpha.getpixel((image.width - 1, y)) else 0
    return count


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-dir", required=True)
    parser.add_argument("--allow-empty", action="store_true")
    args = parser.parse_args()

    run_dir = Path(args.run_dir).expanduser().resolve()
    request = json.loads((run_dir / "sprite_request.json").read_text(encoding="utf-8"))
    manifest_path = run_dir / "final" / "manifest.json"
    if not manifest_path.exists():
        raise SystemExit("Run slice_asset_sheet.py before validation")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    errors = []
    warnings = []
    cell_w, cell_h = request["cellSize"]
    columns, rows = request["grid"]
    sheet = Path(manifest["sheet"])
    with Image.open(sheet) as image:
        if image.size != (columns * cell_w, rows * cell_h):
            errors.append(f"sheet size {image.size} does not match requested grid/cell size")

    cell_reviews = []
    for cell in manifest["cells"]:
        path = Path(cell["file"])
        with Image.open(path) as opened:
            image = opened.convert("RGBA")
        if image.size != (cell_w, cell_h):
            errors.append(f"{path.name} size {image.size} does not match cell size {(cell_w, cell_h)}")
        non_empty = alpha_count(image)
        edge = edge_alpha_count(image)
        if non_empty == 0 and not args.allow_empty:
            errors.append(f"{path.name} is empty")
        if edge:
            warnings.append(f"{path.name} has {edge} opaque edge pixels; inspect for clipping or slot crossing")
        cell_reviews.append({
            "file": str(path),
            "opaquePixels": non_empty,
            "edgeOpaquePixels": edge,
        })

    review = {
        "errors": errors,
        "warnings": warnings,
        "cells": cell_reviews,
    }
    qa_dir = run_dir / "qa"
    qa_dir.mkdir(parents=True, exist_ok=True)
    (qa_dir / "review.json").write_text(json.dumps(review, indent=2) + "\n", encoding="utf-8")
    if errors:
        raise SystemExit("\n".join(errors))
    print(qa_dir / "review.json")


if __name__ == "__main__":
    main()
