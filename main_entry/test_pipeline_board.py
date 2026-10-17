"""C7: execute the real POST dispatcher with JSON streams; stub only the CLI boundary."""
import io
import json
import unittest
from unittest.mock import patch

from . import pipeline_board, server


class PipelineBoardRoutes(unittest.TestCase):
    def post(self, path, body):
        handler = object.__new__(server.APIHandler)
        payload = json.dumps(body).encode('utf-8')
        handler.path = path
        handler.headers = {'Content-Length': str(len(payload))}
        handler.rfile = io.BytesIO(payload)
        responses = []
        handler._send_json = lambda status, data: responses.append((status, data))
        handler.do_POST()
        self.assertEqual(len(responses), 1, 'real POST dispatcher must produce one response')
        self.assertEqual(responses[0][0], 200)
        return responses[0][1]

    def test_gate_accepts_k2_d1_r1_routes(self):
        for stage in ('K2', 'D1', 'R1'):
            with self.subTest(stage=stage), patch.object(pipeline_board, '_pipeline_cli', return_value={'ok': True}) as cli:
                result = self.post('/api/pipeline/gate', {'slug': 'fixture-game', 'stage': stage})
                self.assertTrue(result['success'], result)
                cli.assert_called_once_with(['gate', 'fixture-game', stage], timeout=900)

    def test_signoff_k2_d1_passes_explicit_signer(self):
        for stage in ('K2', 'D1'):
            with self.subTest(stage=stage), patch.object(pipeline_board, '_pipeline_cli', return_value={'ok': True}) as cli:
                result = self.post('/api/pipeline/signoff', {
                    'slug': 'fixture-game', 'stage': stage, 'note': ' fixture approval ', 'by': ' Fixture Human ',
                })
                self.assertTrue(result['success'], result)
                cli.assert_called_once_with([
                    'signoff', 'fixture-game', stage, '--note', 'fixture approval', '--by', 'Fixture Human',
                ])

    def test_signoff_missing_null_empty_whitespace_by_rejected_without_cli(self):
        missing = object()
        for value in (missing, None, '', ' \t\n '):
            for stage in ('K2', 'D1', 'S1'):
                body = {'slug': 'fixture-game', 'stage': stage, 'note': 'fixture only'}
                if value is not missing:
                    body['by'] = value
                with self.subTest(stage=stage, by=repr(value)), patch.object(pipeline_board, '_pipeline_cli') as cli:
                    result = self.post('/api/pipeline/signoff', body)
                    self.assertEqual(result, {'success': False, 'error': '请填写真人签字人'})
                    cli.assert_not_called()

    def test_invalid_stage_rejected_without_cli(self):
        for endpoint in ('gate', 'signoff'):
            for stage in ('K1', 'D2', 'R2', 'S9', 'K2-extra', ''):
                with self.subTest(endpoint=endpoint, stage=stage), patch.object(pipeline_board, '_pipeline_cli') as cli:
                    result = self.post('/api/pipeline/' + endpoint, {
                        'slug': 'fixture-game', 'stage': stage, 'note': 'fixture only', 'by': 'Fixture Human',
                    })
                    self.assertFalse(result['success'])
                    self.assertTrue(result['error'].startswith('非法阶段:'), result)
                    cli.assert_not_called()

    def test_signoff_keeps_cli_human_whitelist_rejection(self):
        rejection = {'ok': False, 'error': '请 owner 填 docs/roles/humans.json'}
        with patch.object(pipeline_board, '_pipeline_cli', return_value=rejection) as cli:
            result = self.post('/api/pipeline/signoff', {
                'slug': 'fixture-game', 'stage': 'K2', 'note': 'fixture only', 'by': 'Fixture Human',
            })
            self.assertFalse(result['success'])
            self.assertEqual(result['error'], rejection['error'])
            cli.assert_called_once()


if __name__ == '__main__':
    unittest.main()
