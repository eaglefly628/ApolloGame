#!/bin/bash
set -euo pipefail
MAC_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
WORKBENCH_DIR="$(cd -- "$MAC_DIR/.." && pwd)"
if [ "$#" -eq 0 ]; then
  printf 'Character image path: '
  read -r IMAGE_PATH
else
  IMAGE_PATH="$1"
fi
RESOLUTION="${2:-512}"
"$WORKBENCH_DIR/.venv-mac/bin/python" "$WORKBENCH_DIR/infer.py" "$IMAGE_PATH" --device mps --resolution "$RESOLUTION"
