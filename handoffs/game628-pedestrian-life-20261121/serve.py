"""Serve the isolated pedestrian-life preview, with read-only street assets."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

HERE = Path(__file__).resolve().parent
BASE = HERE.parent / "game628-cat-turn-20261121" / "site"


class PreviewHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        relative = Path(super().translate_path(path)).relative_to(HERE)
        if urlsplit(path).path.rstrip("/") == "/prototype":
            return str(HERE / "web" / "index.html")
        for root in (HERE / "web", HERE / "site", BASE):
            candidate = root / relative
            if candidate.is_file() or (relative == Path(".") and (candidate / "index.html").is_file()):
                return str(candidate)
        return str(HERE / "site" / relative)

    def list_directory(self, _path):
        self.send_error(404)
        return None


if __name__ == "__main__":
    handler = partial(PreviewHandler, directory=str(HERE))
    with ThreadingHTTPServer(("127.0.0.1", 18856), handler) as server:
        print("http://127.0.0.1:18856/?scene=crowd-street", flush=True)
        server.serve_forever()
