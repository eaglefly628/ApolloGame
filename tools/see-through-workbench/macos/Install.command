#!/bin/bash
set -euo pipefail
MAC_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
WORKBENCH_DIR="$(cd -- "$MAC_DIR/.." && pwd)"
PYTHON_BIN="$(command -v python3.12 || command -v python3 || true)"
if [ -z "$PYTHON_BIN" ]; then
  echo 'Please install Python 3.12 from python.org, then run this installer again.'
  exit 2
fi
"$PYTHON_BIN" -c 'import sys; assert sys.version_info[:2] == (3,12), "Python 3.12 required"'
"$PYTHON_BIN" -m venv "$WORKBENCH_DIR/.venv-mac"
PYTHON_ENV="$WORKBENCH_DIR/.venv-mac/bin/python"
"$PYTHON_ENV" -m pip install --upgrade pip
"$PYTHON_ENV" -m pip install torch==2.8.0 torchvision==0.23.0 torchaudio==2.8.0
"$PYTHON_ENV" "$MAC_DIR/check-gpu.py"
cd "$WORKBENCH_DIR/vendor/see-through"
"$PYTHON_ENV" -m pip install -r requirements.txt -c "$MAC_DIR/torch-constraints.txt"
"$PYTHON_ENV" -m pip check
echo 'Base environment installed. Local MPS inference uses the startup adapter; full-model compatibility must be validated separately.'
