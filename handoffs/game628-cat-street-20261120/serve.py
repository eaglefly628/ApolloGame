#!/usr/bin/env python3
"""Serve the isolated Game 628 animation candidate."""
import argparse
import re
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
import webbrowser

SITE = Path(__file__).resolve().parent / 'site'


class PreviewHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        if urlsplit(path).path in ('/prototype', '/prototype/'):
            return str(SITE / 'prototype/index.html')
        return super().translate_path(path)

    def do_POST(self):
        match = re.fullmatch(r'/qa/evidence/(cat-(?:day|night)\.(?:webm|json))', self.path)
        if match is None or self.headers.get('Origin') != f'http://127.0.0.1:{self.server.server_port}':
            self.send_error(404)
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            self.send_error(400)
            return
        if not 0 < length <= 45_000_000:
            self.send_error(413)
            return
        output = SITE.parent / 'evidence' / match.group(1)
        data = self.rfile.read(length)
        if len(data) != length:
            self.send_error(400)
            return
        output.write_bytes(data)
        self.send_response(201)
        self.end_headers()

    def list_directory(self, path):
        self.send_error(404)
        return None

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=18853, help='loopback port (0 for a free port)')
    parser.add_argument('--open', action='store_true', help='open the preview in the default browser')
    args = parser.parse_args()
    handler = partial(PreviewHandler, directory=str(SITE))
    try:
        server = ThreadingHTTPServer(('127.0.0.1', args.port), handler)
    except OSError as error:
        parser.exit(1, f'无法启动本机试玩（{error}）。可运行 python3 serve.py --port 0 --open。\n')
    with server:
        url = f'http://127.0.0.1:{server.server_port}/'
        print(f'Game 628 · {url}', flush=True)
        if args.open:
            webbrowser.open(url)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    main()
