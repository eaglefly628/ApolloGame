#!/usr/bin/env python3
"""Prepare a Spritegen run folder with request metadata and image prompt."""

from __future__ import annotations

import argparse
import json
import re
import shutil
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:  # pragma: no cover
    Image = None
    ImageDraw = None
    ImageFont = None


KINDS = {"single", "sheet", "tileset", "icons", "animation"}


def slugify(value: str) -> str:
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-") or "sprite-asset"


def parse_pair(value: str, name: str) -> tuple[int, int]:
    match = re.fullmatch(r"\s*(\d+)\s*[x,]\s*(\d+)\s*", value)
    if not match:
        raise argparse.ArgumentTypeError(f"{name} must look like 4x4 or 64x64")
    first, second = int(match.group(1)), int(match.group(2))
    if first <= 0 or second <= 0:
        raise argparse.ArgumentTypeError(f"{name} values must be positive")
    return first, second


def infer_output_dir(name: str) -> Path:
    return Path.cwd() / "runs" / slugify(name)


def write_layout_guide(path: Path, grid: tuple[int, int], cell_size: tuple[int, int]) -> None:
    if Image is None:
        return
    columns, rows = grid
    cell_w, cell_h = cell_size
    width, height = columns * cell_w, rows * cell_h
    image = Image.new("RGB", (width, height), "#39ff14")
    draw = ImageDraw.Draw(image)
    grid_color = "#0b5d0b"
    for x in range(0, width + 1, cell_w):
        draw.line((x, 0, x, height), fill=grid_color, width=1)
    for y in range(0, height + 1, cell_h):
        draw.line((0, y, width, y), fill=grid_color, width=1)
    try:
        font = ImageFont.load_default()
    except Exception:
        font = None
    for row in range(rows):
        for col in range(columns):
            label = f"{col},{row}"
            draw.text((col * cell_w + 4, row * cell_h + 4), label, fill="#003000", font=font)
    image.save(path)


def build_prompt(args: argparse.Namespace, grid: tuple[int, int], cell_size: tuple[int, int]) -> str:
    columns, rows = grid
    cell_w, cell_h = cell_size
    total = columns * rows
    pixel = args.art_style == "pixel"
    if not pixel and not args.style_notes.strip():
        raise ValueError("custom art style requires --style-notes")
    lines = [
        f"Create a {args.kind} asset sheet named {args.name}.",
        f"Concept: {args.concept}",
        "",
        "Style: clean 2D pixel art, hard edges, limited palette, consistent pixel scale." if pixel else f"Style: {args.style_notes}. Preserve the approved references; do not pixelate.",
        "Avoid text, labels, UI panels, scenery, visible grid lines, frame numbers, and cast shadows.",
        f"Layout: {columns} columns by {rows} rows, {total} cells total, each cell represents one independent asset or frame.",
        f"Target cell size: {cell_w}x{cell_h} pixels. Keep each asset centered and fully inside its own cell with safe padding.",
        f"Background: transparent if supported; otherwise a perfectly flat chroma-key background using {args.chroma_key}. Do not use the chroma-key color inside the asset.",
    ]
    if args.kind == "animation":
        lines.append("Animation: ordered frames left-to-right, top-to-bottom. Stable camera, scale, identity and grounded foot contact. A true cyclic motion with adjacent first/last phases; no duplicated poses, crossfades or mirror-flip turns. Separate idle, walking and turning into separate runs.")
    if args.kind == "tileset":
        lines.append("Tileset: every tile must align to the grid and edge connections should be clean.")
    if args.style_notes:
        lines.extend(["", f"Additional style constraints: {args.style_notes}"])
    if args.negative:
        lines.extend(["", f"Negative constraints: {args.negative}"])
    if args.reference:
        lines.extend(["", "Use the attached reference images for identity, palette, camera and shape language; preserve the requested art style."])
    return "\n".join(lines).strip() + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--name", default="Sprite Asset")
    parser.add_argument("--kind", choices=sorted(KINDS), default="sheet")
    parser.add_argument("--concept", required=True)
    parser.add_argument("--output-dir")
    parser.add_argument("--grid", type=lambda value: parse_pair(value, "grid"), default="1x1")
    parser.add_argument("--cell-size", type=lambda value: parse_pair(value, "cell-size"), default="64x64")
    parser.add_argument("--chroma-key", default="#39ff14")
    parser.add_argument("--style-notes", default="")
    parser.add_argument("--art-style", choices=["pixel", "custom"], default="pixel")
    parser.add_argument("--negative", default="")
    parser.add_argument("--reference", action="append", default=[])
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    run_dir = Path(args.output_dir).expanduser().resolve() if args.output_dir else infer_output_dir(args.name).resolve()
    if args.force:
        raise SystemExit("Apollo: --force is disabled; choose a new run directory instead of deleting previous art.")
    if run_dir.exists() and any(run_dir.iterdir()):
        raise SystemExit(f"Run directory already exists and is not empty: {run_dir}")

    for folder in ("prompts", "references", "source", "slices", "qa", "preview", "final", "package"):
        (run_dir / folder).mkdir(parents=True, exist_ok=True)

    references = []
    for ref in args.reference:
        source = Path(ref).expanduser().resolve()
        if not source.exists():
            raise SystemExit(f"Reference does not exist: {source}")
        target = run_dir / "references" / source.name
        shutil.copy2(source, target)
        references.append(str(target))

    guide_path = run_dir / "references" / "layout-guide.png"
    write_layout_guide(guide_path, args.grid, args.cell_size)

    request = {
        "id": slugify(args.name),
        "displayName": args.name,
        "kind": args.kind,
        "concept": args.concept,
        "grid": list(args.grid),
        "cellSize": list(args.cell_size),
        "chromaKey": args.chroma_key,
        "styleNotes": args.style_notes,
        "artStyle": args.art_style,
        "negative": args.negative,
        "references": references,
        "layoutGuide": str(guide_path) if guide_path.exists() else None,
        "source": None,
    }
    (run_dir / "sprite_request.json").write_text(json.dumps(request, indent=2) + "\n", encoding="utf-8")
    (run_dir / "prompts" / "generation-prompt.txt").write_text(build_prompt(args, args.grid, args.cell_size), encoding="utf-8")
    print(run_dir)


if __name__ == "__main__":
    main()
