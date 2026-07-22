"""设置端点（BYO key 面板）。"""
import os
import json
import urllib.request
import urllib.parse

from .config import GEN_KEY_LABELS, GEN_KEY_NAMES, GEN_OPTIONS, gen_option_choice, _config_api_key, _config_model, _load_config, _save_config
from .llm_transport import LLM_PROVIDERS, _provider_request, get_api_key
from .mock import _mock_enabled

# ── 设置端点（BYO key 面板 · M3）────────────────────────────────────────
# 面板 provider 顺序：千问第一，anthropic/deepseek/openai 兼容随后，ollama（本地·免 key）末位；
# mock 仅 env 开启时追加。GET 打码回显（绝不回传原文），PUT 写 .apollo-config.json（gitignore）。
SETTINGS_PROVIDER_ORDER = ['claude-code', 'qwen', 'anthropic', 'deepseek', 'openai', 'local']

def _mask_key(key: str) -> str:
    """打码：前3位***尾4位；短 key（<8）整体星号。绝不回传原文。"""
    if not key:
        return ''
    if len(key) < 8:
        return '*' * len(key)
    return f'{key[:3]}***{key[-4:]}'

def _settings_view() -> dict:
    """当前设置的**打码**视图：每 provider 的 name/models/model/isLocal/apiKeyMasked/keyAvailable。"""
    cfg = _load_config()
    order = list(SETTINGS_PROVIDER_ORDER)
    if _mock_enabled():
        order.append('mock')
    providers = []
    for pid in order:
        if pid == 'mock':
            info = {'name': 'Mock (测试)', 'models': ['mock'], 'env_key': ''}
        else:
            info = LLM_PROVIDERS.get(pid, {})
        models = list(info.get('models') or [])
        cfg_key = _config_api_key(pid)
        providers.append({
            'id': pid,
            'name': info.get('name', pid),
            'models': models,
            'model': _config_model(pid) or (models[0] if models else None),
            'isLocal': pid == 'local',
            'envKey': info.get('env_key', ''),
            'apiKeyMasked': _mask_key(cfg_key) if cfg_key else '',
            'hasConfigKey': cfg_key is not None,
            'keyAvailable': get_api_key(pid) is not None,
        })
    gk = cfg.get('genKeys') if isinstance(cfg.get('genKeys'), dict) else {}
    gen_keys = []
    for name in GEN_KEY_NAMES:
        cfg_v = gk.get(name) if isinstance(gk.get(name), str) and str(gk.get(name)).strip() else None
        gen_keys.append({
            'envKey': name,
            'label': GEN_KEY_LABELS.get(name, name),
            'apiKeyMasked': _mask_key(cfg_v) if cfg_v else '',
            'hasConfigKey': cfg_v is not None,
            'keyAvailable': bool(os.environ.get(name) or cfg_v or (name == 'DASHSCOPE_API_KEY' and _config_api_key('qwen'))),
        })
    gen_options = []
    for name, spec in GEN_OPTIONS.items():
        gen_options.append({
            'envKey': name, 'label': spec['label'], 'forKey': spec.get('forKey'),
            'choices': spec['choices'], 'default': spec['default'],
            'free': bool(spec.get('free')), 'hint': spec.get('hint', ''),
            'value': gen_option_choice(name, cfg),  # 当前生效值（free=任何非空串·闭集=在册·否则 default）
        })
    return {'providers': providers, 'default': cfg.get('default'), 'genKeys': gen_keys, 'genOptions': gen_options}

def handle_settings_get() -> dict:
    return _settings_view()

def handle_settings_put(body: dict) -> dict:
    """合并写入 config。apiKey 仅在前端明确送该字段（用户改动过）时才覆盖；空串=清除；未送=保持原值。"""
    cfg = json.loads(json.dumps(_load_config()))  # 深拷贝当前，防误改缓存
    if not isinstance(cfg.get('providers'), dict):
        cfg['providers'] = {}
    incoming = body.get('providers')
    if isinstance(incoming, dict):
        for pid, patch in incoming.items():
            if not isinstance(patch, dict):
                continue
            cur = cfg['providers'].get(pid)
            cur = dict(cur) if isinstance(cur, dict) else {}
            if 'apiKey' in patch:  # 前端只在用户改动该项时才送 apiKey
                ak = patch.get('apiKey')
                if isinstance(ak, str) and ak.strip():
                    cur['apiKey'] = ak.strip()
                else:
                    cur.pop('apiKey', None)  # 空=清除
            if 'model' in patch and isinstance(patch.get('model'), str) and patch['model'].strip():
                cur['model'] = patch['model'].strip()
            cfg['providers'][pid] = cur
    gen_in = body.get('genKeys')
    if isinstance(gen_in, dict):  # 生成 key（美术 API·R1 ②c）：送了才改；空串=清除
        cur = cfg.get('genKeys') if isinstance(cfg.get('genKeys'), dict) else {}
        cur = dict(cur)
        for name in GEN_KEY_NAMES:
            if name in gen_in:
                v = gen_in.get(name)
                if isinstance(v, str) and v.strip():
                    cur[name] = v.strip()
                else:
                    cur.pop(name, None)
        cfg['genKeys'] = cur
    opt_in = body.get('genOptions')
    if isinstance(opt_in, dict):  # 生成选项：free=任何非空串（模型 ID 账号专属）·闭集=在册才存·空/非法=清除回退 default
        cur = cfg.get('genOptions') if isinstance(cfg.get('genOptions'), dict) else {}
        cur = dict(cur)
        for name, spec in GEN_OPTIONS.items():
            if name in opt_in:
                v = opt_in.get(name)
                ok = (isinstance(v, str) and v.strip()) if spec.get('free') else (isinstance(v, str) and v in {c['value'] for c in spec['choices']})
                if ok:
                    cur[name] = v.strip()
                else:
                    cur.pop(name, None)
        cfg['genOptions'] = cur
    if 'default' in body:
        d = body.get('default')
        if isinstance(d, str) and d:
            cfg['default'] = d
        else:
            cfg.pop('default', None)
    _save_config(cfg)
    return {'success': True, **_settings_view()}  # 回打码视图

def handle_settings_test(body: dict) -> dict:
    """POST /api/settings/test {provider}：用当前生效配置对该 provider 发最小探活请求 → {ok, error?}。
    mock 直接成功；local 探 Ollama /api/version（2s 超时）；云 provider 发 max_tokens=8 的 ping。"""
    provider = str(body.get('provider') or '').strip()
    if provider == 'mock':
        return {'ok': True} if _mock_enabled() else {'ok': False, 'error': 'mock provider 未启用（需 APOLLO_MOCK_LLM=1）'}
    if provider not in LLM_PROVIDERS:
        return {'ok': False, 'error': f'未知 provider: {provider}'}
    if provider == 'local':  # 本地 Ollama：探版本端点，2s 超时（未跑服务即快速失败）。
        base = os.environ.get('OLLAMA_URL', 'http://localhost:11434')
        try:
            with urllib.request.urlopen(urllib.request.Request(base + '/api/version'), timeout=2) as resp:
                resp.read()
            return {'ok': True}
        except Exception as e:
            return {'ok': False, 'error': f'本地 Ollama 未响应（{base}）：{e}'}
    api_key = get_api_key(provider)
    if not api_key:
        return {'ok': False, 'error': '未配置 API Key（先在上方填写并保存）'}
    model = _config_model(provider) or (LLM_PROVIDERS[provider].get('models') or ['?'])[0]
    r = _provider_request(provider, api_key, model,
                          'You are a connectivity probe.', [{'role': 'user', 'content': 'ping'}], max_tokens=8)
    return {'ok': True} if r.get('success') else {'ok': False, 'error': r.get('error', '连接失败')}
