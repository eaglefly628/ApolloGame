#!/usr/bin/env python3
"""Package Spritegen outputs into a portable package directory."""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path


def copy_if_exists(source: Path, target: Path) -> str | None:
    if not source.exists():
        return None
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)
    return target.name


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-dir", required=True)
    args = parser.parse_args()

    run_dir = Path(args.run_dir).expanduser().resolve()
    request_path = run_dir / "sprite_request.json"
    manifest_path = run_dir / "final" / "manifest.json"
    if not request_path.exists():
        raise SystemExit(f"Missing sprite_request.json: {request_path}")
    if not manifest_path.exists():
        raise SystemExit("Run slice_asset_sheet.py before packaging")
    request = json.loads(request_path.read_text(encoding="utf-8"))
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    package_dir = run_dir / "package"
    slices_out = package_dir / "slices"
    package_dir.mkdir(parents=True, exist_ok=True)
    slices_out.mkdir(parents=True, exist_ok=True)

    files = {
        "request": copy_if_exists(request_path, package_dir / "sprite_request.json"),
        "prompt": copy_if_exists(run_dir / "prompts" / "generation-prompt.txt", package_dir / "generation-prompt.txt"),
        "source": copy_if_exists(run_dir / "source" / "source.png", package_dir / "source.png"),
        "sheet": copy_if_exists(run_dir / "final" / "sheet.png", package_dir / "sheet.png"),
        "contactSheet": copy_if_exists(run_dir / "qa" / "contact-sheet.png", package_dir / "contact-sheet.png"),
        "previewGif": copy_if_exists(run_dir / "preview" / "preview.gif", package_dir / "preview.gif"),
        "previewMp4": copy_if_exists(run_dir / "preview" / "preview.mp4", package_dir / "preview.mp4"),
        "review": copy_if_exists(run_dir / "qa" / "review.json", package_dir / "review.json"),
    }
    slices = []
    for cell in manifest["cells"]:
        source = Path(cell["file"])
        target = slices_out / source.name
        shutil.copy2(source, target)
        slices.append({
            "row": cell["row"],
            "column": cell["column"],
            "file": f"slices/{source.name}",
            "empty": cell["empty"],
            "bbox": cell["bbox"],
        })

    package_manifest = {
        "id": request["id"],
        "displayName": request["displayName"],
        "kind": request["kind"],
        "concept": request["concept"],
        "grid": request["grid"],
        "cellSize": request["cellSize"],
        "files": {key: value for key, value in files.items() if value},
        "slices": slices,
    }
    (package_dir / "manifest.json").write_text(json.dumps(package_manifest, indent=2) + "\n", encoding="utf-8")
    print(package_dir)


if __name__ == "__main__":
    main()
