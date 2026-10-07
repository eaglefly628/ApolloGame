#!/usr/bin/env python3
"""Slice a Spritegen source sheet into transparent cell PNGs."""

from __future__ import annotations

import argparse
import json
import math
import shutil
from pathlib import Path

from PIL import Image


def parse_hex(value: str) -> tuple[int, int, int]:
    value = value.strip().lstrip("#")
    if len(value) != 6:
        raise ValueError(f"Expected #rrggbb chroma key, got {value!r}")
    return int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16)


def distance(a: tuple[int, int, int], b: tuple[int, int, int]) -> float:
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b, strict=True)))


def remove_chroma(image: Image.Image, chroma: tuple[int, int, int], tolerance: float) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            r, g, b, a = pixels[x, y]
            if a and distance((r, g, b), chroma) <= tolerance:
                pixels[x, y] = (r, g, b, 0)
    return rgba


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-dir", required=True)
    parser.add_argument("--source")
    parser.add_argument("--chroma-tolerance", type=float, default=18.0)
    parser.add_argument("--no-chroma", action="store_true")
    args = parser.parse_args()

    run_dir = Path(args.run_dir).expanduser().resolve()
    request = json.loads((run_dir / "sprite_request.json").read_text(encoding="utf-8"))
    source = Path(args.source).expanduser().resolve() if args.source else run_dir / "source" / "source.png"
    if not source.exists():
        raise SystemExit(f"Missing source image: {source}")

    columns, rows = request["grid"]
    cell_w, cell_h = request["cellSize"]
    chroma = parse_hex(request.get("chromaKey", "#39ff14"))

    with Image.open(source) as opened:
        image = opened.convert("RGBA")
    target_w, target_h = columns * cell_w, rows * cell_h
    if image.size != (target_w, target_h):
        raise SystemExit(f"Source size {image.size} differs from requested {(target_w, target_h)}; correct grid/cell metadata or regenerate. Apollo does not silently distort animation frames.")
    if not args.no_chroma:
        image = remove_chroma(image, chroma, args.chroma_tolerance)

    slices_dir = run_dir / "slices"
    if slices_dir.exists():
        shutil.rmtree(slices_dir)
    slices_dir.mkdir(parents=True)

    cells = []
    for row in range(rows):
        for col in range(columns):
            left, top = col * cell_w, row * cell_h
            cell = image.crop((left, top, left + cell_w, top + cell_h))
            name = f"cell-r{row:02d}-c{col:02d}.png"
            path = slices_dir / name
            cell.save(path)
            alpha = cell.getchannel("A")
            bbox = alpha.getbbox()
            cells.append({
                "row": row,
                "column": col,
                "file": str(path),
                "empty": bbox is None,
                "bbox": list(bbox) if bbox else None,
            })

    sheet_path = run_dir / "final" / "sheet.png"
    sheet_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(sheet_path)
    manifest = {
        "id": request["id"],
        "displayName": request["displayName"],
        "kind": request["kind"],
        "grid": request["grid"],
        "cellSize": request["cellSize"],
        "sheet": str(sheet_path),
        "cells": cells,
    }
    (run_dir / "final" / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(sheet_path)


if __name__ == "__main__":
    main()
