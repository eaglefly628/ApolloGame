"""Expose the isolated shell, scene host and pinned static assets on loopback."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

HERE = Path(__file__).resolve().parent

class Preview(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        route = urlsplit(path).path.rstrip('/')
        if route in ('', '/prototype'):
            return str(HERE / 'web' / ('prototype/index.html' if route else 'index.html'))
        relative = Path(super().translate_path(path)).relative_to(HERE)
        for directory in ('web','site'):
            file = HERE / directory / relative
            if file.is_file():
                return str(file)
        return str(HERE / 'site' / relative)

    def list_directory(self, _path):
        self.send_error(404)
        return None

    def end_headers(self):
        self.send_header('Cache-Control','no-store')
        super().end_headers()

if __name__ == '__main__':
    with ThreadingHTTPServer(('127.0.0.1',18857), partial(Preview,directory=str(HERE))) as server:
        print('http://127.0.0.1:18857/',flush=True)
        server.serve_forever()
