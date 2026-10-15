#!/bin/bash
set -euo pipefail
MAC_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
WORKBENCH_DIR="$(cd -- "$MAC_DIR/.." && pwd)"
python3 "$MAC_DIR/serve-viewer.py"
