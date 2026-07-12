"""LLM 交互日志（JSONL）+ /api/llm-logs 端点。"""
import os
import time
import json

from .sysutil import ROOT

# ── LLM 交互日志（每次往返落一行 JSONL·排障用·REQ-STUDIO 心跳单第 0 项）──────────
# 目录 .apollo/llm-logs/YYYY-MM-DD.jsonl（gitignore）。**API key 绝不落盘**；prompt/response 全文
# 默认不落（只落字符数），APOLLO_LOG_VERBOSE=1 才落全文（本地排障）。best-effort：任何异常都吞掉，
# 绝不让日志拖垮一次生成。「三轮失败是什么」从此 `cat` 一下 jsonl 就有答案。
LLM_LOGS_DIR = ROOT / '.apollo' / 'llm-logs'

def _log_verbose() -> bool:
    return os.environ.get('APOLLO_LOG_VERBOSE', '') in ('1', 'true', 'yes')

def _trunc(s, n: int = 200) -> str:
    s = '' if s is None else str(s)
    return s if len(s) <= n else s[:n] + '…'

def _llm_log(*, provider: str, model: str, mode: str, req: dict,
             validation=None, errors=None, prompt_full: str = '', response_full: str = '') -> None:
    """把一次 LLM 往返落一行 JSONL。req = _provider_request 的返回（含 promptChars/responseChars/elapsedMs/usage）。
    行 schema：{ts, provider, model, mode, promptChars, responseChars, validation, errors[≤200字], elapsedMs, usage?}。"""
    try:
        rec = {
            'ts': time.strftime('%Y-%m-%dT%H:%M:%S'),
            'provider': provider,
            'model': model,
            'mode': mode,
            'promptChars': req.get('promptChars', 0),
            'responseChars': req.get('responseChars', 0),
            'validation': validation,
            'errors': [_trunc(e) for e in (errors or []) if e],
            'elapsedMs': req.get('elapsedMs', 0),
        }
        usage = req.get('usage')
        if usage:
            rec['usage'] = usage
        if not req.get('success'):
            rec['error'] = _trunc(req.get('error'))
        if _log_verbose():  # 本地排障：落 prompt/response 全文（仍不含 API key——key 只在 HTTP 头）
            rec['prompt'] = prompt_full
            rec['response'] = response_full or req.get('text', '')
        LLM_LOGS_DIR.mkdir(parents=True, exist_ok=True)
        fname = LLM_LOGS_DIR / (time.strftime('%Y-%m-%d') + '.jsonl')
        with fname.open('a', encoding='utf-8') as f:
            f.write(json.dumps(rec, ensure_ascii=False) + '\n')
    except Exception:
        pass  # 日志失败绝不影响生成

def handle_llm_logs(n: int = 50) -> dict:
    """GET /api/llm-logs[?n=50]。今天的 LLM 交互日志尾部（新在前·壳设置页「调试日志」块消费）。
    全文 prompt/response 不出端点（文件里才有·APOLLO_LOG_VERBOSE=1 时落）——端点只回度量行。"""
    n = max(1, min(int(n or 50), 200))
    f = LLM_LOGS_DIR / (time.strftime('%Y-%m-%d') + '.jsonl')
    lines = []
    if f.is_file():
        try:
            for raw in f.read_text('utf-8').splitlines()[-n:]:
                try:
                    rec = json.loads(raw)
                except Exception:
                    continue
                rec.pop('prompt', None); rec.pop('response', None)  # 全文只留文件·不出线
                lines.append(rec)
        except Exception as e:
            return {'success': False, 'error': str(e), 'file': str(f)}
    lines.reverse()
    return {'success': True, 'file': str(f), 'verbose': _log_verbose(), 'lines': lines}
