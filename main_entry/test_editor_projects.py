"""AI 原生编辑器项目端点：真 GET/POST 分派器 + 临时库目录（不碰真 library/）。"""
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from . import editor_projects, paths, server


class EditorProjects(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.lib = Path(self.tmp.name) / 'library'
        self.lib.mkdir()
        for mod in (paths, editor_projects):
            p = patch.object(mod, 'LIBRARY_DIR', self.lib)
            p.start()
            self.addCleanup(p.stop)
        self.addCleanup(self.tmp.cleanup)

    def call(self, method, path, body=None, status=200):
        handler = object.__new__(server.APIHandler)
        payload = json.dumps(body or {}).encode('utf-8')
        handler.path = path
        handler.headers = {'Content-Length': str(len(payload))}
        handler.rfile = io.BytesIO(payload)
        out = []
        handler._send_json = lambda s, d: out.append((s, d))
        getattr(handler, 'do_' + method)()
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0][0], status, out[0][1])
        return out[0][1]

    def create(self, name='测试项目'):
        return self.call('POST', '/api/editor/projects', {'name': name})

    def test_create_numbers_sequentially_and_lists(self):
        self.assertEqual(self.create('甲')['id'], 'new1')
        (self.lib / 'game102').mkdir()  # 老游戏目录不算编号、不进列表
        self.assertEqual(self.create('乙')['id'], 'new2')
        listed = self.call('GET', '/api/editor/projects')['projects']
        self.assertEqual([(p['id'], p['name'], p['assets']) for p in listed], [('new1', '甲', 5), ('new2', '乙', 5)])

    def test_skeleton_files_readable_only_when_registered(self):
        self.create()
        project = self.call('GET', '/api/editor/projects/new1')['project']
        self.assertEqual(project['entry'], 'scenes/main')
        for a in project['assets']:
            r = self.call('GET', f'/api/editor/projects/new1/file?path={a["path"]}')
            self.assertTrue('json' in r or 'text' in r, a)
        self.assertIn('entities', self.call('GET', '/api/editor/projects/new1/file?path=manifest.json')['json'])
        self.assertIn('未在 project.json 登记', self.call('GET', '/api/editor/projects/new1/file?path=meta.json', status=400)['error'])
        self.call('GET', '/api/editor/projects/new1/file?path=../new1/project.json', status=400)
        self.call('GET', '/api/editor/projects/game102', status=400)  # 非 new<n> 拒

    def test_edit_scalar_records_change_and_rejects_structure(self):
        self.create()
        ptr = ['entities', 'player', 'Transform', 'x']
        r = self.call('POST', '/api/editor/projects/new1/edit', {'path': 'manifest.json', 'pointer': ptr, 'value': 200})
        self.assertEqual((r['change']['from'], r['change']['to'], r['change']['by']), (120, 200, 'human'))
        mf = json.loads((self.lib / 'new1' / 'manifest.json').read_text('utf-8'))
        self.assertEqual(mf['entities']['player']['Transform']['x'], 200)
        # 结构 / 类型 / 不存在的字段 → 拒，文件不动
        self.call('POST', '/api/editor/projects/new1/edit', {'path': 'manifest.json', 'pointer': ptr, 'value': '200'}, status=400)
        self.call('POST', '/api/editor/projects/new1/edit', {'path': 'manifest.json', 'pointer': ['entities', 'player', 'Transform'], 'value': 1}, status=400)
        self.call('POST', '/api/editor/projects/new1/edit', {'path': 'manifest.json', 'pointer': ['entities', 'ghost', 'x'], 'value': 1}, status=400)
        self.call('POST', '/api/editor/projects/new1/edit', {'path': 'design/overview.md', 'pointer': ['a'], 'value': 1}, status=400)
        self.assertEqual(json.loads((self.lib / 'new1' / 'manifest.json').read_text('utf-8'))['entities']['player']['Transform']['x'], 200)
        # UI 屏字符串、数组下标
        r = self.call('POST', '/api/editor/projects/new1/edit', {'path': 'ui/hud.json', 'pointer': ['children', 0, 'props', 'text'], 'value': '得分 0'})
        self.assertEqual(r['change']['to'], '得分 0')
        self.call('POST', '/api/editor/projects/new1/edit', {'path': 'ui/hud.json', 'pointer': ['children', 0, 'type'], 'value': 'Button'}, status=400)
        self.call('POST', '/api/editor/projects/new1/note', {'path': 'manifest.json', 'summary': 'AI 加了两个平台'})
        changes = self.call('GET', '/api/editor/projects/new1/changes')['changes']
        self.assertEqual([c['by'] for c in changes], ['human', 'human', 'ai'])


    def test_link_platform_asset_by_reference(self):
        self.create()
        body = {'type': 'motion', 'name': '走路', 'ref': {'platform': 'motion', 'id': 'Walking Fast_v2'}}
        r = self.call('POST', '/api/editor/projects/new1/link', body)
        self.assertEqual(r['asset'], {'id': 'motion/walking-fast-v2', 'type': 'motion', 'name': '走路', 'ref': {'platform': 'motion', 'id': 'Walking Fast_v2'}})
        again = self.call('POST', '/api/editor/projects/new1/link', body)  # 同一素材不重复链接
        self.assertTrue(again['existing'])
        other = self.call('POST', '/api/editor/projects/new1/link', {'type': 'motion', 'ref': {'platform': 'motion', 'id': 'walking-fast-v2'}})
        self.assertEqual(other['asset']['id'], 'motion/walking-fast-v2-2')  # 撞 id 自动加后缀
        project = self.call('GET', '/api/editor/projects/new1')['project']
        self.assertEqual(sum(1 for a in project['assets'] if 'ref' in a), 2)
        self.call('POST', '/api/editor/projects/new1/link', {'type': 'scene', 'ref': {'platform': 'motion', 'id': 'x'}}, status=400)
        self.call('POST', '/api/editor/projects/new1/link', {'type': 'motion', 'ref': {'platform': 'Bad Platform', 'id': 'x'}}, status=400)
        changes = self.call('GET', '/api/editor/projects/new1/changes')['changes']
        self.assertTrue(changes[-1]['summary'].startswith('链接 motion:walking-fast-v2'))


if __name__ == '__main__':
    unittest.main()
