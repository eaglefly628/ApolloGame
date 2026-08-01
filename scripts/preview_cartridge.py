#!/usr/bin/env python3
"""Serve dist-cartridge/ on localhost and open the browser automatically.

Run directly (F5 in VS Code, or: python3 scripts/preview_cartridge.py)
Press Ctrl+C to stop.
"""
from __future__ import annotations

import http.server
import os
import threading
import webbrowser
from pathlib import Path

try:
    import sys
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[union-attr]
except Exception:
    pass

PORT = 8080
ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist-cartridge"


def main() -> None:
    if not DIST.exists():
        print(f"  dist-cartridge/ not found — run Build Cartridge first.")
        return

    os.chdir(DIST)
    handler = http.server.SimpleHTTPRequestHandler
    handler.log_message = lambda *_: None  # silence request logs

    with http.server.HTTPServer(("127.0.0.1", PORT), handler) as httpd:
        url = f"http://127.0.0.1:{PORT}/cartridge.html"
        print(f"\n  ZEROCRAFT OS Preview → {url}")
        print("  Press Ctrl+C to stop.\n")
        threading.Timer(0.4, lambda: webbrowser.open(url)).start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n  Stopped.")


if __name__ == "__main__":
    main()
