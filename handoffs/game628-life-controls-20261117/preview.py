"""Local production preview. Double-click start-preview.command to open it."""
import argparse
import functools
import http.server
import threading
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path

URL = "http://127.0.0.1:18829/"
DIST = Path(__file__).resolve().parent / "dist"


def ready():
    try:
        with urllib.request.urlopen(URL, timeout=2) as response:
            return "Game 628" in response.read().decode("utf-8")
    except (OSError, urllib.error.URLError):
        return False


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--scene", choices=["streets", "people", "material-street", "reference-street", "reference-walk", "reference-characters", "face-studio", "face-gallery", "crowd-street", "crowd-navigation"])
    args = parser.parse_args()
    target_url = URL + ("?scene=" + args.scene if args.scene else "")
    if args.check:
        print("READY" if ready() else "NOT RUNNING", URL)
        return 0 if ready() else 1
    if ready():
        print("Game 628 已运行：", URL, flush=True)
        if not args.no_browser:
            webbrowser.open(target_url)
        return 0
    if not (DIST / "index.html").is_file():
        raise SystemExit("缺少预览构建，请先按 README 编译。")
    handler = functools.partial(Handler, directory=str(DIST))
    try:
        server = http.server.ThreadingHTTPServer(("127.0.0.1", 18829), handler)
    except OSError as error:
        raise SystemExit(f"预览端口无法使用：{error}") from error
    print("Game 628 已启动：", URL, "\n试玩期间请保留本终端窗口。", flush=True)
    if not args.no_browser:
        threading.Timer(0.3, lambda: webbrowser.open(target_url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
