#!/usr/bin/env python3
"""Render GIF and optional MP4 previews from Spritegen animation cells."""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw


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
    parser.add_argument("--fps", type=float, default=8.0)
    parser.add_argument("--scale", type=int, default=4)
    parser.add_argument("--loops", type=int, default=0, help="GIF loop count, 0 means forever")
    parser.add_argument("--ffmpeg", default=shutil.which("ffmpeg") or "ffmpeg")
    args = parser.parse_args()

    run_dir = Path(args.run_dir).expanduser().resolve()
    manifest_path = run_dir / "final" / "manifest.json"
    if not manifest_path.exists():
        raise SystemExit("Run slice_asset_sheet.py before rendering previews")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    preview_dir = run_dir / "preview"
    preview_dir.mkdir(parents=True, exist_ok=True)
    duration_ms = max(20, int(1000 / args.fps))
    frames = []
    for cell in manifest["cells"]:
        if cell.get("empty"):
            continue
        with Image.open(cell["file"]) as opened:
            sprite = opened.convert("RGBA")
        size = (sprite.width * args.scale, sprite.height * args.scale)
        bg = checker(size)
        sprite = sprite.resize(size, Image.Resampling.NEAREST)
        bg.paste(sprite, (0, 0), sprite)
        frames.append(bg)
    if not frames:
        raise SystemExit("No non-empty frames to preview")

    gif_path = preview_dir / "preview.gif"
    frames[0].save(gif_path, save_all=True, append_images=frames[1:], duration=duration_ms, loop=args.loops)

    mp4_path = preview_dir / "preview.mp4"
    try:
        with tempfile.TemporaryDirectory(prefix="spritegen-preview-") as tmp_raw:
            tmp = Path(tmp_raw)
            for index, frame in enumerate(frames):
                frame.save(tmp / f"frame-{index:04d}.png")
            command = [
                args.ffmpeg,
                "-y",
                "-hide_banner",
                "-loglevel",
                "error",
                "-framerate",
                str(args.fps),
                "-i",
                str(tmp / "frame-%04d.png"),
                "-vf",
                "format=yuv420p",
                "-movflags",
                "+faststart",
                str(mp4_path),
            ]
            subprocess.run(command, check=True)
    except Exception as exc:
        (preview_dir / "mp4-error.txt").write_text(str(exc) + "\n", encoding="utf-8")

    print(gif_path)


if __name__ == "__main__":
    main()
