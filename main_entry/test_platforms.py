"""三平台合并 P0：拉起外部平台。用真子进程（python 打印本机地址后常驻）跑真 POST/GET 分派器。"""
import io
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from . import platforms, server

SERVE = 'import time;print("booting",flush=True);print("http://127.0.0.1:5891",flush=True);time.sleep(30)'


class PlatformLaunch(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.cfg = Path(self.tmp.name) / 'platforms.json'
        patcher = patch.object(platforms, 'PLATFORMS_FILE', self.cfg)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.addCleanup(self.tmp.cleanup)
        self.addCleanup(self._kill_all)

    def _kill_all(self):
        for run in list(platforms._RUNNING.values()):
            run['proc'].kill()
            run['proc'].wait()
            if run['proc'] in platforms._processes:
                platforms._processes.remove(run['proc'])
        platforms._RUNNING.clear()

    def write(self, entries):
        self.cfg.write_text(json.dumps({'platforms': entries}), encoding='utf-8')

    def call(self, method, path):
        handler = object.__new__(server.APIHandler)
        handler.path = path
        handler.headers = {'Content-Length': '2'}
        handler.rfile = io.BytesIO(b'{}')
        out = []
        handler._send_json = lambda status, data: out.append((status, data))
        getattr(handler, 'do_' + method)()
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0][0], 200)
        return out[0][1]

    def test_unconfigured_slots_listed_and_launch_rejected(self):
        listed = self.call('GET', '/api/platforms')['platforms']
        self.assertEqual([p['id'] for p in listed], ['motion', 'asset3d'])
        self.assertFalse(any(p['configured'] for p in listed))
        r = self.call('POST', '/api/platforms/motion/launch')
        self.assertFalse(r['success'])
        self.assertFalse(r['configured'])

    def test_command_launch_captures_url_and_reuses_process(self):
        self.write({'motion': {'command': [sys.executable, '-c', SERVE]}})
        first = self.call('POST', '/api/platforms/motion/launch')
        self.assertEqual(first, {'success': True, 'url': 'http://127.0.0.1:5891', 'started': True})
        proc = platforms._RUNNING['motion']['proc']
        self.assertIn(proc, platforms._processes)
        again = self.call('POST', '/api/platforms/motion/launch')
        self.assertEqual(again['started'], False)
        self.assertIs(platforms._RUNNING['motion']['proc'], proc)
        motion = self.call('GET', '/api/platforms')['platforms'][0]
        self.assertTrue(motion['running'])
        self.assertEqual(motion['url'], 'http://127.0.0.1:5891')

    def test_url_mode_and_extra_entries(self):
        self.write({'asset3d': {'url': 'http://127.0.0.1:5199/'}, 'extra-tool': {'label': '额外', 'url': 'http://localhost:7000'}})
        r = self.call('POST', '/api/platforms/asset3d/launch')
        self.assertEqual(r, {'success': True, 'url': 'http://127.0.0.1:5199/', 'started': False})
        ids = [p['id'] for p in self.call('GET', '/api/platforms')['platforms']]
        self.assertEqual(ids, ['motion', 'asset3d', 'extra-tool'])

    def test_rejects_malformed_entries(self):
        self.write({
            'motion': {'command': 'node server.mjs'},           # 字符串命令 = 走 shell 风险 → 拒
            'asset3d': {'url': 'https://example.com/'},         # 非本机地址 → 拒
            'both': {'command': ['x'], 'url': 'http://127.0.0.1:1'},
        })
        listed = {p['id']: p for p in self.call('GET', '/api/platforms')['platforms']}
        self.assertFalse(listed['motion']['configured'])
        self.assertFalse(listed['asset3d']['configured'])
        self.assertNotIn('both', listed)

    def test_process_exit_without_url_reports_failure(self):
        self.write({'motion': {'command': [sys.executable, '-c', 'print("no address");raise SystemExit(3)']}})
        r = self.call('POST', '/api/platforms/motion/launch')
        self.assertFalse(r['success'])
        self.assertIn('code=3', r['error'])
        self.assertNotIn('motion', platforms._RUNNING)

    def test_timeout_stops_process(self):
        self.write({'motion': {'command': [sys.executable, '-c', 'import time;time.sleep(30)']}})
        r = platforms.handle_platform_launch('motion', timeout=0.5)
        self.assertFalse(r['success'])
        self.assertIn('未打印本机地址', r['error'])
        self.assertNotIn('motion', platforms._RUNNING)


class FakeCatalog(BaseHTTPRequestHandler):
    """最小「平台资产目录契约 v1」实现：回显查询参数，便于断言转发正确。"""
    def do_GET(self):
        from urllib.parse import urlsplit, parse_qs
        u = urlsplit(self.path)
        if u.path != '/entries':
            self.send_response(404); self.end_headers(); return
        q = {k: v[0] for k, v in parse_qs(u.query).items()}
        items = [{'key': 'library:walk', 'id': 'walk', 'type': 'motion', 'title': 'Walking', 'status': 'ready', 'sha256': 'x' * 64, 'secret': {'nested': 1}},
                 {'key': 'bad', 'title': 'no id'}]
        body = json.dumps({'total': 2, 'offset': 0, 'limit': int(q.get('limit', 50)), 'items': items, 'echo': q}).encode()
        self.send_response(200); self.send_header('Content-Type', 'application/json'); self.end_headers(); self.wfile.write(body)
        FakeCatalog.last = q

    def log_message(self, *a):
        pass


class PlatformCatalog(unittest.TestCase):
    def setUp(self):
        self.httpd = ThreadingHTTPServer(('127.0.0.1', 0), FakeCatalog)
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()
        self.addCleanup(self.httpd.server_close)
        self.addCleanup(self.httpd.shutdown)
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.cfg = Path(self.tmp.name) / 'platforms.json'
        p = patch.object(platforms, 'PLATFORMS_FILE', self.cfg)
        p.start()
        self.addCleanup(p.stop)

    def write(self, entries):
        self.cfg.write_text(json.dumps({'platforms': entries}), encoding='utf-8')

    def get(self, path):
        handler = object.__new__(server.APIHandler)
        handler.path = path
        handler.headers = {}
        out = []
        handler._send_json = lambda s, d: out.append((s, d))
        handler.do_GET()
        self.assertEqual(out[0][0], 200)
        return out[0][1]

    def test_search_forwards_query_and_keeps_only_contract_fields(self):
        port = self.httpd.server_address[1]
        self.write({'motion': {'url': f'http://127.0.0.1:{port}/driver/'}})  # 带子路径的地址 → 按源站根取 /entries
        r = self.get('/api/platforms/motion/catalog?text=walk%20fast&type=motion&limit=500')
        self.assertTrue(r['success'], r)
        self.assertEqual(FakeCatalog.last, {'text': 'walk fast', 'offset': '0', 'limit': '100', 'type': 'motion'})
        self.assertEqual(r['items'], [{'key': 'library:walk', 'id': 'walk', 'type': 'motion', 'title': 'Walking', 'status': 'ready'}])

    def test_not_running_and_unreachable(self):
        r = self.get('/api/platforms/motion/catalog?text=a')
        self.assertEqual((r['success'], r['running']), (False, False))
        self.write({'motion': {'url': 'http://127.0.0.1:9/'}})
        r = self.get('/api/platforms/motion/catalog?text=a')
        self.assertFalse(r['success'])
        self.assertIn('连不上', r['error'])


if __name__ == '__main__':
    unittest.main()
