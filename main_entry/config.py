"""BYO-key 配置存储 + 功能开关(features) + 生成 key + _CONFIG_CACHE（写穿透属主）。"""
import os
import json

from .sysutil import ROOT

# ── BYO-key 配置存储（.apollo-config.json·仓库根·已 gitignore）─────────────
# 结构：{ "providers": { "<id>": { "apiKey"?: str, "model"?: str } }, "default"?: "<id>" }
# key 解析优先级：config > env > .env（get_api_key 据此）。进程内缓存·_save_config 后失效重读。
# 明文存 key 于本地文件——仅本机创作台自用，绝不入引擎仓（.gitignore），GET 回前端一律打码。
CONFIG_PATH = ROOT / '.apollo-config.json'
_CONFIG_CACHE = None  # None=未读；dict=已读缓存。

def _load_config() -> dict:
    global _CONFIG_CACHE
    if _CONFIG_CACHE is None:
        try:
            data = json.loads(CONFIG_PATH.read_text(encoding='utf-8'))
            _CONFIG_CACHE = data if isinstance(data, dict) else {}
        except Exception:
            _CONFIG_CACHE = {}
    return _CONFIG_CACHE

def _save_config(cfg: dict) -> None:
    CONFIG_PATH.write_text(json.dumps(cfg, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    global _CONFIG_CACHE
    _CONFIG_CACHE = None  # 失效缓存，下次读重新加载（PUT 后即时生效）

def _config_provider(pid: str) -> dict:
    p = _load_config().get('providers')
    v = p.get(pid) if isinstance(p, dict) else None
    return v if isinstance(v, dict) else {}

def _config_api_key(pid: str):
    k = _config_provider(pid).get('apiKey')
    return k.strip() if isinstance(k, str) and k.strip() else None

def _config_model(pid: str):
    m = _config_provider(pid).get('model')
    return m if isinstance(m, str) and m.strip() else None

# ── 功能开关（owner 07-11 双拍板·REQ-ARCH）──────────────────────────
# capgap：agent 遇词表表达不了 → 产结构化能力提案（缺口→强模型下沉快速通道）。默认开、可关。
# tsCarts：TS 例外卡带（展示游戏打勾允许 logic.ts）。默认关——这就是 owner 要的「隐藏开关」：
#   配置 .apollo-config.json {"features":{"tsCarts":true}} 或环境 APOLLO_FEATURE_TSCARTS=1 才现形。
_FEATURE_DEFAULTS = {'capgap': True, 'tsCarts': False}

def _features() -> dict:
    cfg = _load_config().get('features')
    cfg = cfg if isinstance(cfg, dict) else {}
    out = {}
    for k, dflt in _FEATURE_DEFAULTS.items():
        env = os.environ.get(f'APOLLO_FEATURE_{k.upper()}')
        if env is not None:
            out[k] = env not in ('', '0', 'false', 'off')
        else:
            v = cfg.get(k)
            out[k] = bool(v) if isinstance(v, bool) else dflt
    return out

GEN_KEY_NAMES = ('DASHSCOPE_API_KEY', 'TRIPO_API_KEY', 'MESHY_API_KEY', 'SEEDANCE_API_KEY', 'NANO_BANANA_API_KEY', 'PIXVERSE_API_KEY')
# 文生图/文生 3D key 的显示名（数据驱动·/api/settings 随 genKeys 回 label·壳读 label 即可，
# 以后加新 key 只改这里、无需动壳）。owner 2026-07-11：Seedance（字节·主力）+ Nano Banana（Google 图像）。
GEN_KEY_LABELS = {
    'DASHSCOPE_API_KEY': '千问万相（2D 主力）', 'TRIPO_API_KEY': 'Tripo（3D）', 'MESHY_API_KEY': 'Meshy（3D 备选）',
    'SEEDANCE_API_KEY': 'Seedance（字节·文生图/视频·主力）', 'NANO_BANANA_API_KEY': 'Nano Banana（Google Gemini 图像）',
    'PIXVERSE_API_KEY': '爱诗 PixVerse（文生视频·owner 07-12）',
}

def _gen_env() -> dict:
    """美术生成子进程的 env：进程 env + 设置面板配置的生成 key（config.genKeys；千问缺省回退
    providers.qwen.apiKey——DashScope 一 key 两用）。env 已有的**不覆盖**（显式 env 优先）。key 绝不打印/落日志。"""
    env = dict(os.environ)
    cfg = _load_config()
    gk = cfg.get('genKeys') if isinstance(cfg.get('genKeys'), dict) else {}
    for name in GEN_KEY_NAMES:
        v = gk.get(name)
        if isinstance(v, str) and v.strip() and not env.get(name):
            env[name] = v.strip()
    if not env.get('DASHSCOPE_API_KEY'):
        q = _config_api_key('qwen')
        if q:
            env['DASHSCOPE_API_KEY'] = q
    return env
