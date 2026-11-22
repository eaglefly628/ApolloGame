from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

class StaticPreview(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        path = urlsplit(path).path
        root = Path(__file__).resolve().parent
        if path in ("/prototype", "/prototype/"):
            return str(root / "dist/index.html")
        if path == "/qa/embed.html":
            return str(root / "qa/embed.html")
        if path.startswith("/scenes/uw-qa-") and "/" not in path.removeprefix("/scenes/"):
            return str(root / "qa/scenes" / Path(path).name)
        return super().translate_path(path)

if __name__ == "__main__":
    dist = Path(__file__).resolve().parent / "dist"
    with ThreadingHTTPServer(("127.0.0.1", 18845), partial(StaticPreview, directory=str(dist))) as server:
        print("http://127.0.0.1:18845/prototype?scene=reference-walk", flush=True)
        server.serve_forever()
