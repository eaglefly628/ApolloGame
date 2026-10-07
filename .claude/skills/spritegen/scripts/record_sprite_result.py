#!/usr/bin/env python3
"""Record a selected generated Spritegen source image into a run folder."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from pathlib import Path

from PIL import Image


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-dir", required=True)
    parser.add_argument("--source", required=True)
    args = parser.parse_args()

    run_dir = Path(args.run_dir).expanduser().resolve()
    source = Path(args.source).expanduser().resolve()
    request_path = run_dir / "sprite_request.json"
    if not request_path.exists():
        raise SystemExit(f"Missing sprite_request.json: {request_path}")
    if not source.exists():
        raise SystemExit(f"Source image does not exist: {source}")

    with Image.open(source) as image:
        width, height = image.size
        mode = image.mode

    target = run_dir / "source" / "source.png"
    target.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as image:
        image.convert("RGBA").save(target)

    request = json.loads(request_path.read_text(encoding="utf-8"))
    request["source"] = {
        "path": str(target),
        "originalPath": str(source),
        "sha256": sha256(source),
        "width": width,
        "height": height,
        "mode": mode,
    }
    request_path.write_text(json.dumps(request, indent=2) + "\n", encoding="utf-8")
    shutil.copy2(target, run_dir / "final" / "source.png")
    print(target)


if __name__ == "__main__":
    main()
