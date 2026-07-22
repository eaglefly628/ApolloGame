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
# tsCarts：TS 例外卡带（打勾允许 logic.ts）。owner 07-13 转正：默认开=开关常驻卡带选项
#   （打开时壳弹 warning 提示记债）；仍可全局关停：配置 {"features":{"tsCarts":false}}
#   或环境 APOLLO_FEATURE_TSCARTS=0（配置可关原则不变）。
_FEATURE_DEFAULTS = {'capgap': True, 'tsCarts': True}

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

GEN_KEY_NAMES = ('DASHSCOPE_API_KEY', 'TRIPO_API_KEY', 'MESHY_API_KEY', 'ARK_API_KEY', 'SEEDANCE_API_KEY', 'NANO_BANANA_API_KEY', 'PIXVERSE_API_KEY')
# 文生图/文生 3D key 的显示名（数据驱动·/api/settings 随 genKeys 回 label·壳读 label 即可，
# 以后加新 key 只改这里、无需动壳）。owner 2026-07-21：Seedream（字节·火山方舟·文生图·美术主力·ARK_API_KEY）。
GEN_KEY_LABELS = {
    'DASHSCOPE_API_KEY': '千问万相（2D 主力）', 'TRIPO_API_KEY': 'Tripo（3D）', 'MESHY_API_KEY': 'Meshy（3D 备选）',
    'ARK_API_KEY': 'Seedream（字节·火山方舟·文生图·美术主力·owner 07-21）',
    'SEEDANCE_API_KEY': 'Seedance（字节·文生视频）', 'NANO_BANANA_API_KEY': 'Nano Banana（Google Gemini 图像）',
    'PIXVERSE_API_KEY': '爱诗 PixVerse（文生视频·owner 07-12）',
}

# 生成选项（非 key·数据驱动·owner 2026-07-21）：某 provider 的可选参数（如模型版本）。
# 设置面板渲染在 forKey 那行下方；选中值经 _gen_env 注成同名 env（ai-gen.mjs 读它）。
# free=True → **自由文本**（火山方舟模型 ID 账号专属+带版本日期·如 doubao-seedream-5-0-pro-260628·
#   硬编码闭集必漂移·故 Seedream 模型走自由填·choices 仅作快填建议·任何非空串都接受·前后空白剥掉）；
# free 缺省=False → 闭集（value 在册才注入·防注入乱值）。加新选项只改这里。
GEN_OPTIONS = {
    'ARK_SEEDREAM_MODEL': {
        'label': 'Seedream 模型 ID', 'forKey': 'ARK_API_KEY', 'free': True,
        'default': 'doubao-seedream-4-0-250828',
        'hint': '填你火山方舟账号**已开通**的模型 ID（控制台「开通管理」里的准确 ID·如 doubao-seedream-5-0-pro-260628）；或接入点 ep- ID。下方为快填建议。',
        'choices': [
            {'value': 'doubao-seedream-5-0-pro-260628', 'label': 'Seedream 5.0 Pro（260628）'},
            {'value': 'doubao-seedream-4-0-250828', 'label': 'Seedream 4.0（250828）'},
            {'value': 'doubao-seedream-4-5-251128', 'label': 'Seedream 4.5（251128）'},
        ],
    },
}

def gen_option_choice(name: str, cfg: dict) -> str:
    """某生成选项当前生效值（config.genOptions·free=任何非空串·闭集=在册值·否则回退 default）。UI/env 共用。"""
    spec = GEN_OPTIONS.get(name)
    if not spec:
        return ''
    go = cfg.get('genOptions') if isinstance(cfg.get('genOptions'), dict) else {}
    v = go.get(name)
    if spec.get('free'):
        return v.strip() if isinstance(v, str) and v.strip() else spec['default']
    valid = {c['value'] for c in spec['choices']}
    return v if isinstance(v, str) and v in valid else spec['default']

def _gen_env() -> dict:
    """美术生成子进程的 env：进程 env + 设置面板配置的生成 key（config.genKeys；千问缺省回退
    providers.qwen.apiKey——DashScope 一 key 两用）+ 生成选项（config.genOptions·如 Seedream 模型版本）。
    env 已有的**不覆盖**（显式 env 优先）。key 绝不打印/落日志。"""
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
    # Seedream 模型 ID 优先级（owner 2026-07-21「让我自己填·别猜」）：
    #   ① 显式 env ARK_SEEDREAM_MODEL  ② UI 设置 genOptions  ③ env 别名 ARK_IMAGEGEN_MODEL  ④ default
    # 别名 ③ 必须先于「④ 默认回填」判定——否则下面 GEN_OPTIONS 循环会把默认值盖上、别名白填。
    go = cfg.get('genOptions') if isinstance(cfg.get('genOptions'), dict) else {}
    ui_model = go.get('ARK_SEEDREAM_MODEL')
    if not env.get('ARK_SEEDREAM_MODEL') and not (isinstance(ui_model, str) and ui_model.strip()) and env.get('ARK_IMAGEGEN_MODEL'):
        env['ARK_SEEDREAM_MODEL'] = env['ARK_IMAGEGEN_MODEL'].strip()
    for name in GEN_OPTIONS:  # 生成选项注成同名 env（free=任意串·闭集=在册值·env 已设不覆盖=显式/别名优先）
        if not env.get(name):
            env[name] = gen_option_choice(name, cfg)
    return env
