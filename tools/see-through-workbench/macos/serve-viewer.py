"""Serve the built native editor locally, without installing a second JS runtime."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
import webbrowser

workbench = Path(__file__).resolve().parent.parent
viewer = workbench / 'viewer'
if not (viewer / 'index.html').exists():
    viewer = workbench / 'dist'
if not (viewer / 'index.html').exists():
    raise SystemExit('Built editor missing. Use the prepared package or build the workbench first.')
try:
    server = ThreadingHTTPServer(('127.0.0.1', 5183), partial(SimpleHTTPRequestHandler, directory=str(viewer)))
except OSError as error:
    raise SystemExit(f'Could not start local editor on port 5183: {error}')
url = 'http://127.0.0.1:5183/index.html?demo=1'
print(f'Native editor: {url}\nLeave this window open while editing. Ctrl+C stops the local editor.')
webbrowser.open(url)
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
